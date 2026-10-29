// Card ops (S4, D-312; docs/specs/agent-actions.md §1, §6's create_package): pure builders `(ctx, args) => Plan`, the
// same writes data/cards.ts made before it wrapped them. Every cascade is read from the snapshot (R5), never passed in.
import { CARD, CARD_TYPES, TITLE_MAX, type AnyType, type Card, type CardFields, type CardType } from '../model/cards'
import { defaultKind, type Edge, type EdgeKind } from '../model/edges'
import { CANVAS, kindOf, type Label } from '../model/labels'
import { TEXT_NAMES } from './text'
import { MAIN } from '../model/canvases'
import { GRID, snap } from '../model/grid'
import { cardsOn, clearSpot, elsewhere, placeId, type Place } from '../model/placement'
import { besideSpot, clearOffset, firstClear, type Box, type Obstacle } from '../model/layout'
import { kindOfPiece } from '../model/pieces'
import { arrangeAny, sceneOf, type Scene } from './arrange'
import { project } from './project'
import { criterionCascade } from './lens'
import { DELETE, OpsRefused, type OpCtx, type Plan, type Write } from './types'
import { cardColl, cardData, cardIn, handleOf, once, one, plural, refuse, titleField } from './util'
import { evidenceData, type EvidenceInput } from './evidence'

// ---- create_card

export type CreateCardArgs = {
  type: CardType
  plane: string
  title?: string
  fields?: Partial<CardFields>
  // Where: its top-left (`x`, `y`, plane px, as given); centred on `at` and moved right past the cards there (the UI's
  // `+`; `avoid` the cards to move past, else those on the plane); right of a card (`near`); left out, the first clear
  // spot from the plane's top-left.
  where?: { x: number; y: number } | { at: [number, number]; avoid?: { x: number; y: number }[] } | { near: string }
  // Links from the new card (`reverse`: to it), kind as drawn when not given.
  links?: { to: string; kind?: EdgeKind; label?: string; reverse?: boolean }[]
  // Parts: new cards of its type below it, each `part of` it.
  parts?: (string | { title: string; fields?: Partial<CardFields> })[]
  evidence?: EvidenceInput[]
  handle?: string
}

const OP = 'create_card'

// What stays on a plane, for a new card to keep clear of (arrange's scene: the same boxes arrange keeps clear of).
type Room = { scene: Scene; obstacles: Obstacle[]; bounds?: Box }
function roomOn(ctx: OpCtx, plane: string): Room {
  const piece = ctx.ws.pieces.find((p) => p.id === plane)
  // Not a plane: validate refuses the plan; until then the spot is worked out on nothing.
  if (!piece || kindOfPiece(piece) !== 'plane') return { scene: { things: [], carries: () => [], obstacles: () => [], packageHolding: () => undefined }, obstacles: [] }
  const scene = sceneOf(ctx, { plane, canvas: '' })
  return { scene, obstacles: scene.obstacles(new Set()), bounds: scene.bounds }
}

// A card's spot moved the least it takes to sit clear (on the grid, inside the plane when it can).
function nudged(at: { x: number; y: number }, room: Room): { x: number; y: number } {
  const b = { x: snap(at.x), y: snap(at.y), ...CARD }
  const d = clearOffset([b], room.obstacles, room.bounds)
  return { x: b.x + d.dx, y: b.y + d.dy }
}

export function createCard(ctx: OpCtx, args: CreateCardArgs): Plan {
  if (!CARD_TYPES.includes(args.type as CardType))
    refuse(OP, `${String(args.type)} isn't a card type`, `use one of ${CARD_TYPES.join(', ')} (a package: create_package)`)
  const h = handleOf(args)
  const id = ctx.newId()
  const type = args.type
  const here = cardsOn(ctx.ws.cards, ctx.ws.places, args.plane)
  const w = args.where
  // Where the app picks the spot (no `where`, `near`, the parts): clear of everything on the plane, not only its cards
  // (docs/specs/agent.md §2 point 4, §4.4): cards as drawn, text by labelBox, package frames, sections as frames (a card
  // may sit wholly inside one, never across its edge or name strip). The UI's own drops (`x`/`y`, `at`) stay as they were.
  const room = !w || 'near' in w || args.parts?.length ? roomOn(ctx, args.plane) : undefined
  let spot: { x: number; y: number }
  if (w && 'x' in w) spot = { x: w.x, y: w.y }
  else if (w && 'at' in w) spot = clearSpot(w.at, w.avoid ?? here)
  else if (w && 'near' in w) {
    const c = here.find((x) => x.id === w.near)
    if (!c) refuse(OP, `card ${String(w.near)} isn't on plane ${args.plane}`, 'name a card on that plane, or leave `where` out for the first clear spot')
    const anchor = room!.scene.things.find((t) => t.id === c.id)?.shown ?? { x: c.x, y: c.y, w: CARD.w, h: CARD.h }
    spot = nudged(besideSpot(anchor, CARD, 'right'), room!)
  } else spot = firstClear(CARD, room!.obstacles, room!.bounds)
  const now = ctx.now
  const ids: Record<string, string> = { [h]: id }
  const writes: Write[] = [
    {
      coll: cardColl(type),
      id,
      set: { [titleField(type)]: (args.title ?? '').slice(0, TITLE_MAX), pieceId: args.plane, ...spot, ...cardData(type, args.fields as Record<string, unknown>, false), createdAt: now, updatedAt: now },
    },
  ]
  ;(args.links ?? []).forEach((l, i) => {
    const other = cardIn(ctx, OP, l.to)
    const [from, to] = l.reverse ? [{ id: other.id, type: other.type }, { id, type }] : [{ id, type }, { id: other.id, type: other.type }]
    const eid = ctx.newId()
    ids[`${h}.link${i + 1}`] = eid
    writes.push({ coll: 'edges', id: eid, set: { fromId: from.id, fromType: from.type, toId: to.id, toType: to.type, kind: l.kind ?? defaultKind(from.type, to.type), ...(l.label ? { label: l.label } : {}) } })
  })
  if (room) room.obstacles.push({ ...spot, ...CARD })
  ;(args.parts ?? []).forEach((p, i) => {
    const part = typeof p === 'string' ? { title: p } : p
    const pid = ctx.newId()
    const s = nudged({ x: spot.x + i * (CARD.w + GRID), y: spot.y + CARD.h + 2 * GRID }, room!)
    room!.obstacles.push({ ...s, ...CARD })
    ids[`${h}.part${i + 1}`] = pid
    writes.push({ coll: cardColl(type), id: pid, set: { [titleField(type)]: part.title.slice(0, TITLE_MAX), pieceId: args.plane, ...s, ...cardData(type, part.fields as Record<string, unknown>, false), createdAt: now, updatedAt: now } })
    const eid = ctx.newId()
    ids[`${h}.part${i + 1}.link`] = eid
    writes.push({ coll: 'edges', id: eid, set: { fromId: pid, fromType: type, toId: id, toType: type, kind: 'part-of' } })
  })
  ;(args.evidence ?? []).forEach((e, i) => {
    const eid = ctx.newId()
    ids[`${h}.evidence${i + 1}`] = eid
    writes.push({ coll: 'evidence', id: eid, set: evidenceData({ ...e, nodeId: id, nodeType: type as 'customer' }, now) })
  })
  return { op: OP, label: `add ${one(type)}`, writes, ids, meta: { kind: type } }
}

// ---- update_card

export type UpdateCardArgs = {
  card: string
  // The plane it's shown on, for its spot and fold there (D-281); its home unless said.
  plane?: string
  title?: string
  // `undefined` / `null` takes a field away.
  fields?: Partial<Record<keyof CardFields, unknown>>
  x?: number
  y?: number
  folded?: boolean
}

export function updateCard(ctx: OpCtx, args: UpdateCardArgs): Plan {
  const op = 'update_card'
  const card = cardIn(ctx, op, args.card)
  for (const k of ['title', 'name'])
    if (args.fields && k in args.fields) refuse(op, `${k} isn't one of a card's fields here`, 'use title (the argument beside fields) to rename it')
  const now = ctx.now
  const own: Record<string, unknown> = { ...cardData(card.type, args.fields as Record<string, unknown>, true) }
  if (args.title !== undefined) own[titleField(card.type)] = String(args.title).slice(0, TITLE_MAX)
  const spot: Record<string, unknown> = {}
  if (args.x !== undefined) spot.x = args.x
  if (args.y !== undefined) spot.y = args.y
  if (args.folded !== undefined) spot.folded = args.folded || DELETE
  const away = args.plane !== undefined && args.plane !== card.pieceId
  if (away && !ctx.ws.places.some((p) => p.planeId === args.plane && p.cardId === card.id))
    refuse(op, `card ${card.id} isn't on plane ${args.plane}`, 'give the plane it is shown on (its home, or one it was placed on), or leave plane out')
  const writes: Write[] = []
  if (away && Object.keys(spot).length) {
    // A place has no `updatedAt`.
    writes.push({ coll: 'places', id: placeId(args.plane!, card.id), patch: spot })
    if (Object.keys(own).length) writes.unshift({ coll: cardColl(card.type), id: card.id, patch: { ...own, updatedAt: now } })
  } else if (Object.keys(own).length || Object.keys(spot).length) {
    writes.push({ coll: cardColl(card.type), id: card.id, patch: { ...own, ...spot, updatedAt: now } })
  }
  // Criteria taken off a feature take their scores with them (D-133, D-249): matrix cells and old comparisons' scores.
  if (args.fields && 'criteria' in args.fields && card.type === 'feature') {
    const next = new Set(((args.fields.criteria as { id: string }[] | null | undefined) ?? []).map((c) => c.id))
    writes.push(...criterionCascade(ctx, card.id, (card.criteria ?? []).map((c) => c.id).filter((id) => !next.has(id))))
  }
  const onlySpot = !Object.keys(own).length
  const label =
    onlySpot && args.folded !== undefined
      ? card.type === 'package'
        ? args.folded
          ? 'fold a package'
          : 'unfold a package'
        : args.folded
          ? 'fold parts'
          : 'unfold parts'
      : onlySpot && Object.keys(spot).length
        ? `move ${one(card.type)}`
        : args.title !== undefined && !args.fields
          ? `rename ${one(card.type)}`
          : `edit ${one(card.type)}`
  return { op, label, writes, ids: {}, meta: { kind: card.type } }
}

// ---- create_package (agent-actions.md §6; data/cards.ts' addPackage)

export type CreatePackageArgs = { cards: string[]; plane?: string; name?: string; x?: number; y?: number; handle?: string }

export function createPackage(ctx: OpCtx, args: CreatePackageArgs): Plan {
  const op = 'create_package'
  const members = args.cards.map((id) => cardIn(ctx, op, id))
  if (!members.length) refuse(op, 'a package needs cards', 'name the cards it holds')
  const plane = args.plane ?? members[0].pieceId
  const shown = new Map(cardsOn(ctx.ws.cards, ctx.ws.places, plane).map((c) => [c.id, c]))
  const spots = members.map((m) => shown.get(m.id) ?? m)
  const x = args.x ?? Math.min(...spots.map((s) => s.x))
  const y = args.y ?? Math.min(...spots.map((s) => s.y))
  const n = ctx.ws.cards.filter((c) => c.type === 'package').length + 1
  const id = ctx.newId()
  const now = ctx.now
  const set: Record<string, unknown> = { title: (args.name ?? `Package ${n}`).slice(0, TITLE_MAX), pieceId: plane, memberIds: members.map((m) => m.id).slice(0, 60), x: snap(x), y: snap(y), createdAt: now, updatedAt: now }
  const writes: Write[] = [{ coll: 'packages', id, set }]
  // Its frame (padding and the band on top, packageBox) mustn't cut what's round its members (agent.md §2 point 4,
  // §4.4): when it would, the package moves clear as one, its members with it, in this same plan (one undo step).
  // This is the UI's `package these` too (data/cards.ts' addPackage builds this op): that's meant, it never overlaps.
  if (ctx.ws.pieces.some((p) => p.id === plane && kindOfPiece(p) === 'plane')) {
    const there = { ...ctx, ws: project(ctx.ws, [{ op, label: '', writes, ids: {} }]) }
    let moved: Write[] = []
    try {
      // arrange with a layout and no `where`: where it is, pushed clear when it would land on something.
      moved = arrangeAny(there, { items: [id], plane, layout: 'grid' }).writes
    } catch (e) {
      // Its members inside another unfolded package that stays: arrange won't move them out of it, so it stays put.
      if (!(e instanceof OpsRefused)) throw e
    }
    for (const m of moved) {
      // Its own move goes into the doc it makes.
      if (m.coll === 'packages' && m.id === id && m.patch) Object.assign(set, m.patch, { updatedAt: now })
      else writes.push(m)
    }
  }
  return { op, label: 'package these', writes, ids: { [handleOf(args)]: id }, meta: { kind: 'package' } }
}

// ---- delete (cards and what hangs off them; links, evidence, competitor features, matches, text)

export type DeleteArgs = {
  ids: string[]
  // On a plane (`plane`, not `everywhere`): cards also on another plane only come off this one (take_off); the rest
  // are deleted. Else every card named is deleted from every plane it's on.
  plane?: string
  everywhere?: boolean
}

// Moving a card's home to another plane it's on (the earliest it came to): its spot and fold there become the card's,
// that place goes. Null when it's on no other plane (`except` left out too).
export function rehome(ctx: OpCtx, card: Card, except: string): Write[] | null {
  const p = ctx.ws.places.filter((x) => x.cardId === card.id && x.planeId !== card.pieceId && x.planeId !== except).sort((a, b) => a.createdAt - b.createdAt)[0]
  if (!p) return null
  return [
    { coll: cardColl(card.type), id: card.id, patch: { pieceId: p.planeId, x: p.x, y: p.y, folded: p.folded ? true : DELETE, updatedAt: ctx.now } },
    { coll: 'places', id: p.id, del: true },
  ]
}

// Off `plane`: a card at home there moves home to another plane it's on, else its place there goes. Null when it's on
// no other plane.
export function offPlane(ctx: OpCtx, card: Card, plane: string): Write[] | null {
  if (card.pieceId === plane) return rehome(ctx, card, plane)
  const p = ctx.ws.places.find((x) => x.cardId === card.id && x.planeId === plane)
  return p ? [{ coll: 'places', id: p.id, del: true }] : null
}

// Cards deleted from everywhere, with what hangs off them: their links, places, evidence, a competitor's features, the
// matches naming them. Matrix cells and tasks naming them stay (the app reads past a missing card, D-141), and so do
// the packages listing them.
export function cardCascade(ctx: OpCtx, gone: Card[]): Write[] {
  const ids = new Set(gone.map((c) => c.id))
  const { edges, places, evidence, competitorFeatures, comparisons } = ctx.ws
  return [
    ...gone.map((c): Write => ({ coll: cardColl(c.type), id: c.id, del: true })),
    ...edges.filter((e) => ids.has(e.fromId) || ids.has(e.toId)).map((e): Write => ({ coll: 'edges', id: e.id, del: true })),
    ...places.filter((p) => ids.has(p.cardId)).map((p): Write => ({ coll: 'places', id: p.id, del: true })),
    ...evidence.filter((e) => ids.has(e.nodeId)).map((e): Write => ({ coll: 'evidence', id: e.id, del: true })),
    ...competitorFeatures.filter((f) => ids.has(f.competitorId)).map((f): Write => ({ coll: 'competitorFeatures', id: f.id, del: true })),
    ...comparisons.filter((c) => ids.has(c.featureId) || ids.has(c.competitorId)).map((c): Write => ({ coll: 'comparisons', id: c.id, del: true })),
  ]
}

export function deleteThings(ctx: OpCtx, args: DeleteArgs): Plan {
  const op = 'delete'
  const ws = ctx.ws
  const cards: Card[] = []
  const labels: Label[] = []
  const writes: Write[] = []
  let kind: string | undefined
  const kinds = new Set<string>()
  let single = ''
  for (const id of args.ids) {
    const card = ws.cards.find((c) => c.id === id)
    if (card) {
      cards.push(card)
      kinds.add(card.type)
      continue
    }
    const label = ws.labels.find((l) => l.id === id)
    if (label) {
      labels.push(label)
      kinds.add(kindOf(label))
      continue
    }
    if (ws.edges.some((e) => e.id === id)) {
      writes.push({ coll: 'edges', id, del: true })
      kinds.add('link')
      single = 'unlink'
      continue
    }
    if (ws.evidence.some((e) => e.id === id)) {
      writes.push({ coll: 'evidence', id, del: true })
      kinds.add('evidence')
      single = 'remove evidence'
      continue
    }
    if (ws.competitorFeatures.some((f) => f.id === id)) {
      // With the matches that pointed at it (they stay, unmatched).
      writes.push({ coll: 'competitorFeatures', id, del: true })
      for (const c of ws.comparisons) if (c.competitorFeatureId === id) writes.push({ coll: 'comparisons', id: c.id, patch: { competitorFeatureId: DELETE } })
      kinds.add('feature')
      single = 'remove a competitor feature'
      continue
    }
    if (ws.comparisons.some((c) => c.id === id)) {
      writes.push({ coll: 'comparisons', id, del: true })
      kinds.add('feature')
      single = 'unmatch'
      continue
    }
    refuse(op, `there is nothing with the id ${id} that delete can take away`, 'use the id of a card, link, piece of evidence, competitor feature, match, text, piece, canvas, task or deck column')
  }
  if (kinds.size === 1) kind = [...kinds][0]

  const plane = args.everywhere ? undefined : args.plane
  const off = plane ? cards.filter((c) => elsewhere(c, ws.places, plane).length) : []
  const gone = cards.filter((c) => !off.includes(c))
  for (const c of off) writes.push(...(offPlane(ctx, c, plane!) ?? []))
  writes.push(...cardCascade(ctx, gone))
  for (const l of labels) writes.push({ coll: 'labels', id: l.id, del: true })

  // The labels the UI's toasts and undo lines have said.
  const n = cards.length + labels.length
  let label: string
  if (!cards.length && !labels.length) label = args.ids.length === 1 ? single : `delete ${args.ids.length} things`
  else if (plane) label = !gone.length && !labels.length ? `take ${plural(off.length)} off this plane` : off.length ? `remove ${n} things` : `delete ${n > 1 ? `${n} things` : gone.length ? 'a card' : TEXT_NAMES[kindOf(labels[0])]}`
  else if (cards.length === 1 && !labels.length && args.ids.length === 1) label = `delete ${one(cards[0].type)}`
  else if (labels.length === 1 && !cards.length && args.ids.length === 1) label = `delete ${TEXT_NAMES[kindOf(labels[0])]}`
  else label = `delete ${n} ${labels.length ? 'things' : 'cards'}`
  return { op, label, writes: once(writes), ids: {}, meta: { ...(kind ? { kind } : {}) } }
}

// ---- duplicate (data/cards.ts' copyCards: paste, ⌘D)

export type DuplicateArgs = {
  // Cards and text in the workspace, as they're shown on `from` (else on `to`).
  ids?: string[]
  from?: string
  to: string
  // How far the copies move from the originals (plane px); two grid steps right and down unless said.
  by?: [number, number]
  // What was copied, as it was (the tab's clipboard: it may hold cards since changed or deleted). Instead of `ids`.
  source?: { cards: Card[]; edges: Edge[]; labels?: ({ id: string; x: number; y: number } & Record<string, unknown>)[] }
  handle?: string
}

const COPIED = ['tags', 'validation', 'regions', 'priority', 'status', 'impact', 'effort', 'description', 'audience', 'pricing', 'url', 'criteria', 'folded'] as const

// The plan and the new ids in order (cards, then text).
export function duplicatePlan(ctx: OpCtx, args: DuplicateArgs): { plan: Plan; ids: string[] } {
  const op = 'duplicate'
  const ws = ctx.ws
  let list: Card[]
  let edges: Edge[]
  let labels: ({ id: string; x: number; y: number } & Record<string, unknown>)[]
  if (args.source) ((list = args.source.cards), (edges = args.source.edges), (labels = args.source.labels ?? []))
  else {
    const shown = new Map(cardsOn(ws.cards, ws.places, args.from ?? args.to).map((c) => [c.id, c]))
    list = []
    labels = []
    for (const id of args.ids ?? []) {
      const c = ws.cards.find((x) => x.id === id)
      if (c) list.push(shown.get(id) ?? c)
      else {
        const l = ws.labels.find((x) => x.id === id)
        if (!l) refuse(op, `there is no card or text ${id}`, 'use the id of an existing card or text')
        labels.push(l as unknown as { id: string; x: number; y: number } & Record<string, unknown>)
      }
    }
    edges = ws.edges
  }
  const by = args.by ?? [2 * GRID, 2 * GRID]
  const h = handleOf(args)
  const made = new Map(list.map((c) => [c.id, ctx.newId()]))
  const ids = new Set(list.map((c) => c.id))
  const inner = edges.filter((e) => ids.has(e.fromId) && ids.has(e.toId))
  const exists = new Set(ws.cards.map((c) => c.id))
  const now = ctx.now
  const writes: Write[] = []
  const handles: Record<string, string> = {}
  const order: string[] = []
  for (const c of list) {
    const d: Record<string, unknown> = { [titleField(c.type)]: c.title, pieceId: args.to, x: c.x + by[0], y: c.y + by[1], createdAt: now, updatedAt: now }
    for (const k of COPIED) if (c[k] !== undefined) d[k] = c[k]
    // A package keeps its members: the copies when they were copied with it, else the same cards (D-239); members
    // since deleted are left out (a new doc may not point at what isn't there).
    if (c.type === 'package') d.memberIds = (c.memberIds ?? []).map((m) => made.get(m) ?? m).filter((m) => exists.has(m) || [...made.values()].includes(m))
    if (c.notes) d[c.type === 'competitor' ? 'notes' : 'body'] = c.notes
    const id = made.get(c.id)!
    writes.push({ coll: cardColl(c.type), id, set: d })
    order.push(id)
  }
  const texts: string[] = []
  const canvas = ws.canvas && ws.canvas !== MAIN ? { canvasId: ws.canvas } : {}
  for (const l of labels) {
    const { id: _, canvasId: __, ...rest } = l
    const id = ctx.newId()
    // On the canvas: the one shown (D-302).
    writes.push({ coll: 'labels', id, set: { ...rest, pieceId: args.to, ...(args.to === CANVAS ? canvas : {}), x: l.x + by[0], y: l.y + by[1], createdAt: now } })
    texts.push(id)
  }
  inner.forEach((e) => {
    const id = ctx.newId()
    writes.push({ coll: 'edges', id, set: { fromId: made.get(e.fromId)!, fromType: e.fromType, toId: made.get(e.toId)!, toType: e.toType, kind: e.kind, ...(e.label ? { label: e.label } : {}) } })
    handles[`${h}.link${Object.keys(handles).length + 1}`] = id
  })
  const all = [...order, ...texts]
  all.forEach((id, i) => (handles[i === 0 ? h : `${h}.${i + 1}`] = id))
  const n = list.length + labels.length
  const types = new Set(list.map((c) => c.type))
  return {
    plan: { op, label: n > 1 ? `paste ${n} things` : list.length ? `paste ${one(list[0].type)}` : 'paste text', writes, ids: handles, meta: { ...(types.size === 1 && !labels.length ? { kind: [...types][0] } : {}) } },
    ids: all,
  }
}

export const duplicate = (ctx: OpCtx, args: DuplicateArgs): Plan => duplicatePlan(ctx, args).plan

export type { AnyType, Place }
