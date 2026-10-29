// arrange by meaning (S9, D-312, R10; docs/specs/agent.md §2 point 4, §4.4; agent-actions.md's `arrange` row): the
// registry's `arrange`. With `layout` and/or `where` the app works out the spots (src/model/layout.ts) and moves the
// things through text.ts' arrange, which carries what they carry (a section's contents, a folded card's parts, a
// package's members, what's stuck to a plane or deck: S5/S6). Without either it is text.ts' arrange as before (`by`,
// `to`: the UI's moves and nudges).
//
// What's laid out is each named thing with what it carries, as one box drawn (an unfolded package is its frame, a folded
// card its folded height, a section its frame, a plane with the pieces stuck to it); something carried by another named
// thing, or hidden in a fold, rides with its carrier instead of being laid out itself. What stays: everything else in
// that space (a plane's cards at their spots there and its text; a canvas's pieces, its spots counted, and its text).
//
// Cluster headings (decided here): `headings: true` adds an H3 over each group in the same plan (one undo step; their ids
// by handle, `$heading1`…); left out, the groups are laid out apart (four grid steps) without words, and the caller can
// add its own with create_text `where: { near }`. A section named by `where: { in_section }` grows to hold the block (its
// w/h in the same plan), and refuses when growing would cover something outside it. Every other section is solid: a
// block never lands in one or on its name. A member of an unfolded package isn't moved without its package.
import { cardsOn } from '../model/placement'
import { CARD, type Card } from '../model/cards'
import { carriedWith, foldedHeight, foldsOf, packageBox, type Folds } from '../model/cardInside'
import { CANVAS, kindOf, type Label } from '../model/labels'
import { labelBox } from '../model/labelBox'
import { canvasOf, MAIN } from '../model/canvases'
import { cardBoxes, piecesShown, sectionHolds, type Boxed as TBoxed } from '../model/textPlace'
import { stuckChain } from '../model/pieceMoves'
import { kindOfPiece, KIND_NAME } from '../model/pieces'
import { VALIDATIONS, FEATURE_STATUSES } from '../model/cards'
import {
  ALIGNS,
  alignTo,
  besideSpot,
  BLOCK_LAYOUTS,
  boundsOf,
  clashes,
  clearOffset,
  clusterSpots,
  firstClear,
  GAP,
  gridCols,
  gridSpots,
  grownSection,
  LAYOUTS,
  sectionInner,
  columnSpots,
  within,
  SIDES,
  spreadTo,
  type Align,
  type Box,
  type Group,
  type Layout,
  type Obstacle,
  type Side,
} from '../model/layout'
import { GRID } from '../model/grid'
import { arrange, type ArrangeArgs } from './text'
import type { OpCtx, Plan, Write } from './types'
import { refuse } from './util'

export type Where = { near: string; side?: Side } | { in_section: string } | { at: 'clear' }
export const GROUP_KEYS = ['type', 'tag', 'status'] as const
export type GroupBy = (typeof GROUP_KEYS)[number] | { name: string; items: string[] }[]

export type LayoutArgs = ArrangeArgs & {
  // How they go together; left out with `where`: a grid.
  layout?: Layout
  // Where the block goes; left out: where they are now (its top-left), pushed clear when it would land on something.
  where?: Where
  // cluster: by card type (default), first tag, status, or groups given (each item in its first group; the rest last).
  group_by?: GroupBy
  // cluster: an H3 over each group, made in the same plan.
  headings?: boolean
  // Names the headings made: `<handle>_heading1`… (left out: `$heading1`…).
  handle?: string
}

const OP = 'arrange'

type Space = { plane: string | null; canvas: string }
type Kind = 'card' | 'text' | 'section' | 'piece'
// Something in the space: its stored top-left (`at`), its box as the panel counts it (`box`: a card's 200 × 100, text's
// labelBox, a piece's), as drawn (`shown`; null: hidden in a fold).
type Thing = { id: string; kind: Kind; at: { x: number; y: number }; box: Box; shown: Box | null; card?: Card; label?: Label; pieceKind?: string }

const TYPE_ORDER = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package']
const TYPE_HEAD: Record<string, string> = { customer: 'Customers', problem: 'Problems', competitor: 'Competitors', idea: 'Ideas', feature: 'Features', package: 'Packages', sticky: 'Notes', heading: 'Headings', paragraph: 'Paragraphs', section: 'Sections', title: 'Title' }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function arrangeAny(ctx: OpCtx, args: LayoutArgs): Plan {
  if (args.layout === undefined && args.where === undefined) return arrange(ctx, args)
  if (args.by || args.to) refuse(OP, 'a layout places things itself', 'give layout and/or where, or by/to, not both')
  const layout: Layout = args.layout ?? 'grid'
  if ((layout as string) === 'near') refuse(OP, 'beside a thing is a where, not a layout', "say where: { near: id, side? } (with layout grid, row, column or cluster)")
  if (!LAYOUTS.includes(layout)) refuse(OP, `${String(layout)} isn't a layout`, `use one of ${LAYOUTS.join(', ')}`)
  const isAlign = (ALIGNS as readonly string[]).includes(layout)
  const isSpread = layout === 'spread-x' || layout === 'spread-y'
  if ((isAlign || isSpread) && args.where) refuse(OP, `${layout} keeps things where they are along the other way`, 'leave where out (or use grid, row, column or cluster with where)')
  if (args.group_by !== undefined && layout !== 'cluster') refuse(OP, 'group_by is for the cluster layout', "say layout: 'cluster', or leave group_by out")
  if (args.headings && layout !== 'cluster') refuse(OP, 'headings are for the cluster layout', 'leave headings out, or add headings with create_text')
  const items = [...new Set(args.items ?? [])]
  if (!items.length) refuse(OP, 'nothing to arrange', 'name the items')
  if ((isAlign || isSpread) && items.length < 2) refuse(OP, `${layout} needs two things or more`, 'name the things to line up')

  const space = spaceOf(ctx, items, args)
  const scene = sceneOf(ctx, space)
  const byId = new Map(scene.things.map((t) => [t.id, t]))
  for (const id of items) if (!byId.has(id)) refuse(OP, `${id} isn't on ${spaceName(space)}`, 'name text, cards (with the plane they are shown on) or pieces in one space')

  // What each carries, all the way down (as text.ts' arrange will carry it).
  const carry = args.carry !== false
  const carriedBy = new Map<string, string[]>()
  const carriedOf = (id: string): string[] => {
    const known = carriedBy.get(id)
    if (known) return known
    const out = new Set<string>()
    const walk = (x: string) => {
      for (const c of scene.carries(x)) if (c !== id && !out.has(c)) (out.add(c), walk(c))
    }
    if (carry) walk(id)
    carriedBy.set(id, [...out])
    return [...out]
  }
  // Rides along: hidden in a fold, or carried by another named thing.
  const riding = new Set<string>()
  for (const id of items) {
    if (!byId.get(id)!.shown) riding.add(id)
    for (const c of carriedOf(id)) if (c !== id) riding.add(c)
  }
  const units = items.filter((id) => !riding.has(id)).map((id) => byId.get(id)!)
  if (!units.length) refuse(OP, 'everything named rides with something else (folded into a card, inside a section or package)', 'arrange what holds them')
  const moving = new Set<string>(units.flatMap((u) => [u.id, ...carriedOf(u.id)]))
  // A member of an unfolded package that stays would stretch its frame over everything between: not moved alone.
  for (const id of moving) {
    const pkg = scene.packageHolding(id)
    if (pkg && !moving.has(pkg)) refuse(OP, `${id} is in package ${pkg}, which isn't moving`, `take it out of the package first (update_card on ${pkg}'s memberIds), or arrange the package`)
  }
  const feet = new Map(units.map((u) => [u.id, boundsOf([u.shown!, ...carriedOf(u.id).flatMap((c) => byId.get(c)?.shown ?? [])])]))

  // What stays.
  const section = args.where && 'in_section' in args.where ? sectionIn(scene, args.where.in_section, moving, space) : undefined
  // Sections nobody named are solid (nothing lands in one, nor on its name); only the section named, and those round it,
  // are open. `framed`: every section as a frame, for whether a grown section cuts or swallows something.
  const framed = scene.obstacles(moving, section?.id)
  const obstacles: Obstacle[] = framed.map((o) => (o.frame && !(section && within(section.box, o)) ? { x: o.x, y: o.y, w: o.w, h: o.h } : o))
  const bounds = scene.bounds

  // Each unit's move (dx, dy), on the grid.
  const delta = new Map<string, { dx: number; dy: number }>()
  const heads: { name: string; x: number; y: number }[] = []
  let grown: Box | undefined

  if (isAlign || isSpread) {
    const spots = isAlign ? alignTo(units.map((u) => ({ id: u.id, ...u.box })), layout as Align) : spreadTo(units.map((u) => ({ id: u.id, ...u.box })), layout === 'spread-y' ? 'y' : 'x')
    for (const u of units) {
      const s = spots.get(u.id)!
      delta.set(u.id, { dx: s.x - u.box.x, dy: s.y - u.box.y })
    }
    // Things lined up on top of each other step apart the other way (the panel leaves them overlapping).
    const perp: 'x' | 'y' = layout === 'align-left' || layout === 'align-centre' || layout === 'align-right' || layout === 'spread-x' ? 'y' : 'x'
    const placed: Box[] = []
    const moved = (u: Thing) => shift(feet.get(u.id)!, delta.get(u.id)!)
    for (const u of [...units].sort((p, q) => moved(p)[perp] - moved(q)[perp] || moved(p)[perp === 'y' ? 'x' : 'y'] - moved(q)[perp === 'y' ? 'x' : 'y'])) {
      const d = delta.get(u.id)!
      for (let hit = placed.find((p) => clashes([moved(u)], [p])); hit; hit = placed.find((p) => clashes([moved(u)], [p]))) {
        const f = moved(u)
        if (perp === 'y') d.dy += Math.ceil((hit.y + hit.h + GAP - f.y) / GRID) * GRID
        else d.dx += Math.ceil((hit.x + hit.w + GAP - f.x) / GRID) * GRID
      }
      placed.push(moved(u))
    }
    if (bounds && perp === 'x' && Math.max(...units.map((u) => moved(u).x + moved(u).w)) > bounds.x + bounds.w - GRID)
      refuse(OP, `lined up, these would run past the plane's right edge (they sit on top of each other, so they step apart sideways)`, "use layout: 'row' or 'grid' for them instead, or line up fewer")
    const o = clearOffset(units.map(moved), obstacles, bounds)
    for (const d of delta.values()) ((d.dx += o.dx), (d.dy += o.dy))
  } else {
    const sizes = units.map((u) => feet.get(u.id)!)
    const inner = section ? sectionInner(section.box, section.side) : undefined
    const maxW = inner ? Math.max(inner.w, Math.max(...sizes.map((s) => s.w))) : bounds ? bounds.w - 4 * GRID : undefined
    let rel: { x: number; y: number }[]
    let size: { w: number; h: number }
    let groupBoxes: ReturnType<typeof clusterSpots>['groups'] = []
    if (layout === 'cluster') {
      const groups = groupsOf(units, args.group_by ?? 'type', !!args.headings)
      const c = clusterSpots(sizes, groups, maxW)
      ;[rel, size, groupBoxes] = [c.spots, c, c.groups]
    } else {
      let g: { spots: { x: number; y: number }[]; w: number; h: number }
      if (layout === 'column') {
        // In a section a column wraps into the next one at the plane's bottom.
        let rows = units.length
        g = columnSpots(sizes, rows)
        const room = inner && bounds ? bounds.y + bounds.h - GRID - inner.y : Infinity
        while (rows > 1 && g.h > room) g = columnSpots(sizes, --rows)
      } else if (layout === 'row') {
        // In a section a row wraps at the plane's right edge (the section growing sideways that far).
        const room = inner ? Math.max(inner.w, bounds ? bounds.x + bounds.w - 2 * GRID - inner.x : inner.w) : Infinity
        let cols = units.length
        g = gridSpots(sizes, cols)
        while (cols > 1 && g.w > room) g = gridSpots(sizes, --cols)
      } else g = gridSpots(sizes, gridCols(sizes, maxW))
      ;[rel, size] = [g.spots, g]
    }
    // The block at `o`: each unit's foot there (its stored spot kept on the grid), and the headings' boxes.
    const at = (o: { x: number; y: number }) => {
      const ds = units.map((u, i) => {
        const f = feet.get(u.id)!
        const nx = snapTo(u.at.x + o.x + rel[i].x - f.x)
        const ny = snapTo(u.at.y + o.y + rel[i].y - f.y)
        return { dx: nx - u.at.x, dy: ny - u.at.y }
      })
      const hs = groupBoxes.flatMap((g) => (g.head ? [{ name: g.name, x: o.x + g.head.x, y: o.y + g.head.y }] : []))
      const boxes = [...units.map((u, i) => shift(feet.get(u.id)!, ds[i])), ...hs.map((h) => headBox(h))]
      return { ds, hs, boxes }
    }
    const w = args.where
    let o: { x: number; y: number }
    if (w && 'near' in w) {
      const anchor = byId.get(w.near)
      if (!anchor || !anchor.shown) refuse(OP, `${String(w.near)} isn't on ${spaceName(space)}`, 'name something in the same space to go beside')
      if (moving.has(anchor.id)) refuse(OP, `${anchor.id} is one of the things moving`, 'go beside something that stays')
      if (w.side !== undefined && !SIDES.includes(w.side)) refuse(OP, `${String(w.side)} isn't a side`, `use one of ${SIDES.join(', ')}`)
      const sides = w.side ? [w.side] : SIDES
      const fits = (s: Side) => {
        const p = besideSpot(anchor.shown!, size, s)
        const b = at(p).boxes
        const bb = boundsOf(b)
        return (!bounds || (bb.x >= bounds.x + GRID && bb.y >= bounds.y + GRID && (bb.w > bounds.w - 2 * GRID || bb.x + bb.w <= bounds.x + bounds.w - GRID))) && !clashes(b, obstacles) ? p : null
      }
      o = sides.map(fits).find((p) => p) ?? besideSpot(anchor.shown, size, w.side ?? 'right')
    } else if (w && 'in_section' in w) {
      o = { x: inner!.x, y: inner!.y }
      // Under what's already in it, a row at a time.
      for (let k = 0; k < 400 && clashes(at(o).boxes, obstacles); k++) o = { x: o.x, y: o.y + GAP }
    } else if (w && 'at' in w) {
      if (w.at !== 'clear') refuse(OP, `at: ${String(w.at)} isn't a place`, "say where: { at: 'clear' }")
      o = firstClear(size, obstacles, bounds)
    } else if (w) {
      refuse(OP, 'where is { near }, { in_section } or { at: "clear" }', 'name a thing to go beside, a section to go in, or the nearest clear area')
    } else {
      const now = boundsOf(units.map((u) => feet.get(u.id)!))
      o = { x: snapTo(now.x), y: snapTo(now.y) }
    }
    let placed = at(o)
    // In a section it only goes down (the section grows); elsewhere to the nearest clear spot.
    if (!(w && 'in_section' in w)) {
      const d = clearOffset(placed.boxes, obstacles, bounds)
      if (d.dx || d.dy) placed = at({ x: o.x + d.dx, y: o.y + d.dy })
    }
    units.forEach((u, i) => delta.set(u.id, placed.ds[i]))
    heads.push(...placed.hs)
    if (section) {
      const g = grownSection(section.box, boundsOf(placed.boxes))
      if (g.w !== section.box.w || g.h !== section.box.h) {
        // Grown, it mustn't cut through or swallow what stays outside it (another section round it is fine).
        const outside = framed.filter((o) => !within(o, section.box))
        if (clashes([g], outside))
          refuse(OP, `section ${section.id} has no room for them: grown to fit, it would cover things outside it`, 'arrange what is in it first, move what is under or beside it, or use a bigger section')
        grown = g
      }
    }
  }

  // Into text.ts' arrange: exact spots, carrying what they carry.
  const to = units.flatMap((u) => {
    const d = delta.get(u.id)!
    return d.dx || d.dy ? [{ id: u.id, x: u.at.x + d.dx, y: u.at.y + d.dy }] : []
  })
  const writes: Write[] = to.length ? arrange(ctx, { to, ...(space.plane ? { plane: space.plane } : { canvas: space.canvas }), carry: args.carry }).writes : []
  if (grown && section) writes.push({ coll: 'labels', id: section.id, patch: { w: grown.w, h: grown.h, updatedAt: ctx.now } })
  const made: string[] = []
  const ids: Record<string, string> = {}
  for (const h of heads) {
    const id = ctx.newId()
    made.push(id)
    // Each heading by handle: `$heading1`… (with a handle given, `<handle>_heading1`…).
    ids[`${args.handle ?? '$'}${args.handle ? '_' : ''}heading${made.length}`] = id
    writes.push({
      coll: 'labels',
      id,
      set: { pieceId: space.plane ?? CANVAS, ...(!space.plane && space.canvas !== MAIN ? { canvasId: space.canvas } : {}), text: h.name.slice(0, 200), size: 'minor', x: h.x, y: h.y, createdAt: ctx.now, updatedAt: ctx.now },
    })
  }
  const n = units.length
  const label = isAlign
    ? `line up ${n} things`
    : isSpread
      ? `space out ${n} things`
      : layout === 'cluster'
        ? `group ${n} things`
        : `arrange ${n} things${layout === 'grid' ? '' : ` in a ${layout}`}`
  return { op: OP, label, writes, ids, meta: { kind: layout, ...(made.length ? { ids: made } : {}) } }
}

// ---- The space and what's in it

const spaceName = (s: Space) => (s.plane ? `plane ${s.plane}` : `canvas ${s.canvas}`)
const snapTo = (v: number) => Math.round(v / GRID) * GRID
const shift = (b: Box, d: { dx: number; dy: number }): Box => ({ x: b.x + d.dx, y: b.y + d.dy, w: b.w, h: b.h })
// An H3 over a group, as labelBox counts it.
const headBox = (h: { name: string; x: number; y: number }): Box => labelBox({ id: '', pieceId: '', text: h.name, size: 'minor', x: h.x, y: h.y, createdAt: 0 })

// Every item in one space: text where it is, cards on `plane` (else each one's home), pieces on `canvas` (else the
// ctx's).
function spaceOf(ctx: OpCtx, items: string[], args: LayoutArgs): Space {
  const ws = ctx.ws
  let found: Space | null = null
  for (const id of items) {
    let s: Space
    const l = ws.labels.find((x) => x.id === id)
    const c = l ? undefined : ws.cards.find((x) => x.id === id)
    const p = l || c ? undefined : ws.pieces.find((x) => x.id === id)
    if (l) s = l.pieceId === CANVAS ? { plane: null, canvas: canvasOf(l) } : { plane: l.pieceId, canvas: '' }
    else if (c) s = { plane: args.plane ?? c.pieceId, canvas: '' }
    else if (p) s = { plane: null, canvas: args.canvas ?? ws.canvas ?? MAIN }
    else refuse(OP, `there is no text, card or piece ${id}`, 'use the id of text, a card or a piece')
    if (found && (found.plane !== s.plane || (!s.plane && found.canvas !== s.canvas)))
      refuse(OP, `the items are in more than one space (${spaceName(found)}, ${spaceName(s)})`, 'arrange the things of one plane, or of one canvas, at a time')
    found = s
  }
  const s = found!
  if (s.plane) {
    const plane = ws.pieces.find((p) => p.id === s.plane)
    if (!plane || kindOfPiece(plane) !== 'plane') refuse(OP, `there is no plane ${s.plane}`, 'give the plane the cards are shown on')
  } else if (s.canvas !== MAIN && !ws.canvases.some((c) => c.id === s.canvas)) refuse(OP, `there is no canvas ${s.canvas}`, 'use the id of an existing canvas, or leave canvas out')
  return s
}

type Scene = {
  things: Thing[]
  bounds?: Box
  carries: (id: string) => string[]
  obstacles: (moving: Set<string>, except?: string) => Obstacle[]
  // The unfolded package (shown, not inside a fold) whose frame holds this card, if any.
  packageHolding: (id: string) => string | undefined
}

function sceneOf(ctx: OpCtx, s: Space): Scene {
  const ws = ctx.ws
  const things: Thing[] = []
  const labels = ws.labels.filter((l) => (s.plane ? l.pieceId === s.plane : l.pieceId === CANVAS && canvasOf(l) === s.canvas))
  for (const l of labels) {
    const b = labelBox(l)
    things.push({ id: l.id, kind: kindOf(l) === 'section' ? 'section' : 'text', at: { x: l.x, y: l.y }, box: b, shown: b, label: l })
  }
  if (s.plane) {
    const plane = ws.pieces.find((p) => p.id === s.plane)!
    const cards = cardsOn(ws.cards, ws.places, s.plane)
    const folds = foldsOf(cards, ws.edges)
    const shownOf = shownCards(cards, folds)
    for (const c of cards) things.push({ id: c.id, kind: 'card', at: { x: c.x, y: c.y }, box: { x: c.x, y: c.y, w: CARD.w, h: CARD.h }, shown: shownOf.get(c.id) ?? null, card: c })
    const others: TBoxed[] = cardBoxes(cards)
    const holder = new Map<string, string>()
    for (const c of cards)
      if (c.type === 'package' && !c.folded && !folds.hidden.has(c.id)) for (const m of folds.members.get(c.id) ?? []) if (m.id !== c.id && !holder.has(m.id)) holder.set(m.id, c.id)
    return {
      things,
      packageHolding: (id) => holder.get(id),
      bounds: { x: 0, y: 0, w: plane.w, h: plane.h },
      carries: (id) => {
        const l = labels.find((x) => x.id === id)
        if (l) return l.kind === 'section' ? sectionHolds(l, labels, others) : []
        return cards.some((c) => c.id === id) ? carriedWith(folds, cards, id) : []
      },
      obstacles: (moving, except) => {
        const out: Obstacle[] = []
        for (const t of things) {
          if (moving.has(t.id) || t.id === except || !t.shown) continue
          // An unfolded package that stays, some of its members moving away: its frame round those that stay.
          if (t.card?.type === 'package' && !t.card.folded && (folds.members.get(t.id) ?? []).some((m) => moving.has(m.id))) {
            const kept = (folds.members.get(t.id) ?? []).filter((m) => !moving.has(m.id)).flatMap((m) => shownOf.get(m.id) ?? [])
            const frame = packageBox(kept)
            if (frame) out.push(frame)
            continue
          }
          out.push(t.kind === 'section' ? { ...t.shown, frame: true } : t.shown)
        }
        return out
      },
    }
  }
  const shown = piecesShown(s.canvas, ws.pieces, ws.spots)
  for (const p of shown) {
    const b = { x: p.x, y: p.y, w: p.w, h: p.h }
    things.push({ id: p.id, kind: 'piece', at: { x: p.x, y: p.y }, box: b, shown: b, pieceKind: KIND_NAME[kindOfPiece(p)] })
  }
  const others: TBoxed[] = shown.map((p) => ({ id: p.id, x: p.x, y: p.y, w: p.w, h: p.h }))
  return {
    things,
    packageHolding: () => undefined,
    carries: (id) => {
      const l = labels.find((x) => x.id === id)
      if (l) return l.kind === 'section' ? sectionHolds(l, labels, others) : []
      return shown.some((p) => p.id === id) ? stuckChain(shown, id).map((f) => f.id) : []
    },
    obstacles: (moving, except) => things.filter((t) => !moving.has(t.id) && t.id !== except).map((t) => (t.kind === 'section' ? { ...t.shown!, frame: true } : t.shown!)),
  }
}

// Each card's box as drawn on the plane: hidden in a fold (none), a folded card's or package's folded height, an
// unfolded package's frame round its members, else 200 × 100.
function shownCards(cards: Card[], folds: Folds): Map<string, Box> {
  const out = new Map<string, Box>()
  const of = (c: Card, depth = 0): Box | null => {
    if (out.has(c.id)) return out.get(c.id)!
    if (folds.hidden.has(c.id)) return null
    let b: Box = { x: c.x, y: c.y, w: CARD.w, h: CARD.h }
    const rows = folds.rows.get(c.id)
    if (rows) b = { ...b, h: foldedHeight(rows.length) }
    else if (c.type === 'package' && !c.folded && depth < 8) {
      const here = (folds.members.get(c.id) ?? []).filter((m) => m.id !== c.id && cards.some((k) => k.id === m.id))
      const frame = packageBox(here.flatMap((m) => of(m, depth + 1) ?? []))
      if (frame) b = frame
    }
    out.set(c.id, b)
    return b
  }
  for (const c of cards) of(c)
  return out
}

function sectionIn(scene: Scene, id: string, moving: Set<string>, space: Space): { id: string; box: Box; side?: 'left' } {
  const t = scene.things.find((x) => x.id === id)
  if (!t || t.kind !== 'section') refuse(OP, `${String(id)} isn't a section on ${spaceName(space)}`, 'name a section in the same space, or leave where out')
  if (moving.has(id)) refuse(OP, `section ${id} is one of the things moving`, 'arrange into a section that stays')
  return { id, box: t.shown!, side: t.label?.side }
}

// ---- Clusters

function groupsOf(units: Thing[], by: GroupBy, headings: boolean): Group[] {
  const keyOf = (u: Thing): string => {
    if (Array.isArray(by)) return String(by.findIndex((g) => g.items?.includes(u.id)))
    if (by === 'type') return u.card ? u.card.type : u.label ? (u.kind === 'section' ? 'section' : kindOf(u.label)) : (u.pieceKind ?? 'piece')
    if (by === 'tag') return u.card ? (u.card.tags?.[0] ? `#${u.card.tags[0]}` : '') : ''
    return u.card ? (u.card.validation ?? u.card.status ?? '') : ''
  }
  if (!Array.isArray(by) && !GROUP_KEYS.includes(by)) refuse(OP, `${String(by)} isn't a way to group`, `use ${GROUP_KEYS.join(', ')} or a list of { name, items }`)
  const keys = new Map<string, number[]>()
  units.forEach((u, i) => {
    const k = keyOf(u)
    keys.set(k, [...(keys.get(k) ?? []), i])
  })
  const order = (k: string) => {
    if (Array.isArray(by)) return k === '-1' ? 1e9 : Number(k)
    if (k === '') return 1e9
    if (by === 'type') return TYPE_ORDER.includes(k) ? TYPE_ORDER.indexOf(k) : 100
    if (by === 'status') {
      const i = [...VALIDATIONS, ...FEATURE_STATUSES].indexOf(k as never)
      return i < 0 ? 100 : i
    }
    return 0
  }
  const nameOf = (k: string) =>
    Array.isArray(by)
      ? k === '-1'
        ? 'Other'
        : by[Number(k)].name
      : k === ''
        ? by === 'tag'
          ? 'Untagged'
          : 'No status'
        : by === 'type'
          ? (TYPE_HEAD[k] ?? cap(k))
          : by === 'status'
            ? cap(k)
            : k
  return [...keys.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]))
    .map(([k, members]) => {
      const name = nameOf(k)
      return { name, members, ...(headings ? { head: headBox({ name, x: 0, y: 0 }) } : {}) }
    })
}

export { BLOCK_LAYOUTS, LAYOUTS, SIDES }
