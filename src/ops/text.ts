// Text ops (S5, D-312; docs/specs/agent-actions.md §7, §6's band drag, §8's moves): pure builders `(ctx, args) => Plan`,
// the same writes data/labels.ts made before it wrapped them. Text anywhere: headings H1–H3, paragraphs, sticky notes,
// sections and the project title, on the canvas (`pieceId: 'canvas'`, its canvas from the args or the ctx, never the
// screen's: R1) or on a plane. `arrange` moves text, cards and pieces; a section carries what's wholly inside it (R7,
// src/model/textPlace.ts). `delete` takes text too (cards.ts' deleteThings): nothing goes with it.
import { cardsOn } from '../model/placement'
import { carriedWith, foldsOf } from '../model/cardInside'
import { CANVAS, kindOf, LABEL_COLORS, PARA_W, STICKY_W, TITLE_W, textMax, type Label, type LabelColor, type TextKind, type TextScale } from '../model/labels'
import { labelBox } from '../model/labelBox'
import { canvasOf, MAIN } from '../model/canvases'
import { around, cardBoxes, clearSpotFor, downPast, inSection, piecesShown, rightOf, sectionHolds, type Box, type Boxed } from '../model/textPlace'
import { followerMoves, STICK_REACH, stickTarget, stuckChain } from '../model/pieceMoves'
import { hostKinds, KIND_NAME, kindOfPiece, sticks } from '../model/pieces'
import { boundTo } from './stick'
import { DELETE, type OpCtx, type Plan, type Write } from './types'
import { a, cardColl, find, handleOf, refuse } from './util'

export const TEXT_KINDS = ['heading', 'paragraph', 'sticky', 'section', 'title'] as const
export const HEADING_SIZES = ['heading', 'subheading', 'minor'] as const
export const TEXT_SCALES = ['small', 'medium', 'large'] as const

// For undo's labels (data/labels.ts said the same).
export const TEXT_NAMES: Record<TextKind, string> = { heading: 'a heading', paragraph: 'a paragraph', sticky: 'a sticky note', section: 'a section', title: 'the project title' }

// How text is set: the fields a kind may have (the text bar's, TextItems.tsx' LabelBar), null or undefined taking one
// away in update_text.
export type TextStyle = {
  text?: string
  // A heading's small line over it, a section's number before its name.
  kicker?: string | null
  // A heading's or a section name's size: H1, H2, H3.
  size?: (typeof HEADING_SIZES)[number] | null
  // A paragraph's or sticky note's text size.
  scale?: TextScale | null
  color?: LabelColor | null
  bold?: boolean | null
  italic?: boolean | null
  caps?: boolean | null
  rotate?: 90 | -90 | null
  side?: 'left' | null
  folded?: boolean | null
  w?: number | null
  h?: number | null
}

const ALLOWED: Record<keyof TextStyle, TextKind[]> = {
  text: ['heading', 'paragraph', 'sticky', 'section'],
  kicker: ['heading', 'section'],
  size: ['heading', 'section'],
  scale: ['paragraph', 'sticky'],
  color: ['heading', 'paragraph', 'sticky', 'section', 'title'],
  bold: ['heading', 'paragraph', 'section', 'title'],
  italic: ['heading', 'paragraph', 'section', 'title'],
  caps: ['heading', 'paragraph', 'section', 'title'],
  rotate: ['heading', 'paragraph'],
  side: ['section'],
  folded: ['sticky'],
  w: ['paragraph', 'sticky', 'section', 'title'],
  h: ['section'],
}

const FIX: Partial<Record<keyof TextStyle, string>> = {
  text: "the project title shows the workspace's name and description (Settings → general), not text of its own",
  size: 'size is H1–H3 for a heading or a section name; a paragraph or sticky note takes scale',
  scale: 'scale is for a paragraph or sticky note; a heading takes size',
}

const STYLE_KEYS = Object.keys(ALLOWED) as (keyof TextStyle)[]

// The style fields given, checked for the kind: a field it can't have or a value it can't take is refused with a fix.
function styleOf(op: string, kind: TextKind, args: TextStyle, patch: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of STYLE_KEYS) {
    if (!(k in args)) continue
    const v = args[k]
    if (v === undefined || v === null || (k === 'text' && kind === 'title' && v === '')) {
      if (patch && k !== 'text') out[k] = DELETE
      continue
    }
    if (!ALLOWED[k].includes(kind)) refuse(op, `${a(kind)} has no ${k}`, FIX[k] ?? `leave ${k} out (${ALLOWED[k].join(', ')} have it)`)
    const bad = (allowed: readonly unknown[]) => void (!allowed.includes(v as unknown) && refuse(op, `${String(v)} isn't a ${k}`, `use one of ${allowed.join(', ')}`))
    if (k === 'size') bad(HEADING_SIZES)
    else if (k === 'scale') bad(TEXT_SCALES)
    else if (k === 'color') bad(LABEL_COLORS)
    else if (k === 'rotate') bad([90, -90])
    else if (k === 'side') bad(['left'])
    else if (k === 'bold' || k === 'italic' || k === 'caps' || k === 'folded') {
      if (typeof v !== 'boolean') refuse(op, `${k} is true or false`, `say ${k}: true, or null to take it away`)
      // false is stored as nothing (the bar takes the field away).
      if (!v) {
        if (patch) out[k] = DELETE
        continue
      }
    } else if (k === 'w' || k === 'h') {
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) refuse(op, `${k} must be a number above 0`, `give ${k} in its space's px`)
    } else if (typeof v !== 'string') refuse(op, `${k} must be text`, `give ${k} as a string`)
    out[k] = k === 'text' ? String(v).slice(0, textMax(kind === 'paragraph' ? { size: 'note' } : kind === 'sticky' ? { kind: 'sticky' } : {})) : k === 'kicker' ? String(v).slice(0, 60) : v
  }
  return out
}

// ---- Where things are, in a space (a plane, or a canvas)

type Space = { plane: string | null; canvas: string }

function spaceOf(ctx: OpCtx, op: string, plane: string | undefined, canvas: string | undefined): Space {
  if (plane !== undefined && plane !== CANVAS) {
    const p = ctx.ws.pieces.find((x) => x.id === plane)
    if (!p) refuse(op, `there is no plane ${plane}`, 'use the id of an existing plane, or leave plane out for the canvas')
    if (p.kind !== 'plane') refuse(op, `${plane} is ${a(String(p.kind))}, not a plane`, 'put text on a plane or on the canvas')
    return { plane, canvas: canvasOf(p) }
  }
  const c = canvas ?? ctx.ws.canvas ?? MAIN
  if (c !== MAIN && !ctx.ws.canvases.some((x) => x.id === c)) refuse(op, `there is no canvas ${c}`, 'use the id of an existing canvas, or leave canvas out for the one shown')
  return { plane: null, canvas: c }
}

const inSpace = (s: Space) => (l: Label) => (s.plane ? l.pieceId === s.plane : l.pieceId === CANVAS && canvasOf(l) === s.canvas)

// Everything in the space as boxes: its text, and a plane's cards or a canvas's pieces.
function boxesIn(ctx: OpCtx, s: Space): { labels: Label[]; others: Boxed[] } {
  const labels = ctx.ws.labels.filter(inSpace(s))
  const others = s.plane ? cardBoxes(cardsOn(ctx.ws.cards, ctx.ws.places, s.plane)) : piecesShown(s.canvas, ctx.ws.pieces, ctx.ws.spots).map((p) => ({ id: p.id, x: p.x, y: p.y, w: p.w, h: p.h }))
  return { labels, others }
}

function boxIn(ctx: OpCtx, op: string, s: Space, id: string): Boxed {
  const { labels, others } = boxesIn(ctx, s)
  const l = labels.find((x) => x.id === id)
  if (l) return { id, ...labelBox(l) }
  const o = others.find((x) => x.id === id)
  if (o) return o
  refuse(op, `${id} isn't on ${s.plane ? `plane ${s.plane}` : 'that canvas'}`, `name text, ${s.plane ? 'a card' : 'a piece'} there (search for it), or leave it out`)
}

// ---- create_text

export type CreateTextArgs = TextStyle & {
  kind: TextKind
  // The plane it goes on; left out (or 'canvas'): the canvas.
  plane?: string
  // On the canvas: which one (D-302); else the one in the ctx (the workspace shown).
  canvas?: string
  // A sticky note's signed line: who wrote it (the UI's `uid`/`author`; else the actor's uid and name).
  author?: string
  uid?: string
  // Where: its top-left (x, y in its space's px, as given: the UI's); right of a thing there (`near`); inside a section
  // there (`in_section`); left out, a clear spot (a plane's first, row by row; on the canvas under everything).
  where?: { x: number; y: number } | { near: string } | { in_section: string }
  // A section round these (text, cards on its plane, pieces on its canvas): its box fitted round them.
  around?: string[]
  handle?: string
}

export function createText(ctx: OpCtx, args: CreateTextArgs): Plan {
  const op = 'create_text'
  const kind = args.kind
  if (!TEXT_KINDS.includes(kind)) refuse(op, `${String(kind)} isn't a kind of text`, `use one of ${TEXT_KINDS.join(', ')}`)
  if (args.plane !== undefined && args.plane !== CANVAS && args.canvas !== undefined)
    refuse(op, 'text goes on a plane or on a canvas, not both', 'give plane (it goes where its plane goes) or canvas, not both')
  const s = spaceOf(ctx, op, args.plane, args.canvas)
  if (kind === 'title') {
    if (s.plane) refuse(op, 'the project title goes on the canvas only', 'leave plane out')
    if (ctx.ws.labels.some((l) => l.kind === 'title')) refuse(op, 'the workspace already has its project title (one per workspace)', 'move or change the one there (update_text, arrange)')
  }
  if (args.around && kind !== 'section') refuse(op, 'only a section goes round things', 'say kind: section, or use where: { near } to put it beside them')
  if (args.around && args.where) refuse(op, 'a section round things is placed by them', 'give around or where, not both')
  const style = styleOf(op, kind, args, false)
  const fields: Record<string, unknown> = { ...style }
  if (kind === 'heading') fields.size ??= 'heading'
  else if (kind === 'paragraph') ((fields.size = 'note'), (fields.w ??= PARA_W.initial))
  else if (kind === 'sticky') {
    fields.kind = 'sticky'
    fields.w ??= STICKY_W.initial
    fields.color ??= 'yellow'
    fields.uid = args.uid ?? ctx.actor.uid
    const author = args.author ?? ctx.actor.name
    if (author) fields.author = String(author).slice(0, 200)
  } else if (kind === 'section') fields.kind = 'section'
  else ((fields.kind = 'title'), (fields.w ??= TITLE_W.initial))
  fields.text = kind === 'title' ? '' : ((style.text as string | undefined) ?? '')

  // Where.
  let spot: { x: number; y: number }
  const w = args.where
  if (kind === 'section' && args.around) {
    if (!args.around.length) refuse(op, 'a section round nothing', 'name the things it goes round, or give where with w and h')
    const box = around(args.around.map((id) => boxIn(ctx, op, s, id)))
    spot = { x: box.x, y: box.y }
    fields.w = box.w
    fields.h = box.h
  } else {
    if (kind === 'section') ((fields.w ??= 400), (fields.h ??= 300))
    const size = labelBox({ ...(fields as object), id: '', pieceId: '', x: 0, y: 0, createdAt: 0 } as unknown as Label)
    const { labels, others } = boxesIn(ctx, s)
    const taken: Box[] = [...labels.map(labelBox), ...others]
    if (w && 'x' in w) {
      if (typeof w.x !== 'number' || typeof w.y !== 'number' || !Number.isFinite(w.x) || !Number.isFinite(w.y)) refuse(op, 'x and y must be numbers', "give where's x and y in its space's px")
      spot = { x: w.x, y: w.y }
    } else if (w && 'near' in w) spot = downPast(rightOf(boxIn(ctx, op, s, w.near)), size, [...labels.filter((l) => l.kind !== 'section').map(labelBox), ...others])
    else if (w && 'in_section' in w) {
      const sec = ctx.ws.labels.find((l) => l.id === w.in_section && inSpace(s)(l))
      if (!sec || sec.kind !== 'section') refuse(op, `${String(w.in_section)} isn't a section on ${s.plane ? `plane ${s.plane}` : 'that canvas'}`, 'name a section in the same space, or leave where out')
      spot = inSection(labelBox(sec), size, [...labels.filter((l) => l.id !== sec.id).map(labelBox), ...others])
    } else spot = clearSpotFor(size, taken, s.plane ? ctx.ws.pieces.find((p) => p.id === s.plane)!.w : undefined)
  }

  const id = ctx.newId()
  const now = ctx.now
  const data = {
    ...fields,
    pieceId: s.plane ?? CANVAS,
    ...(!s.plane && s.canvas !== MAIN ? { canvasId: s.canvas } : {}),
    x: spot.x,
    y: spot.y,
    createdAt: now,
    updatedAt: now,
  }
  return { op, label: `add ${TEXT_NAMES[kind]}`, writes: [{ coll: 'labels', id, set: data }], ids: { [handleOf(args)]: id }, meta: { kind } }
}

// ---- update_text

export type UpdateTextArgs = TextStyle & {
  // The text's id.
  id: string
  // Its top-left (moving it alone; arrange carries a section's contents).
  x?: number
  y?: number
}

export function updateText(ctx: OpCtx, args: UpdateTextArgs): Plan {
  const op = 'update_text'
  const l = find(ctx.ws.labels, op, args.id, 'text')
  const kind = kindOf(l)
  const patch = styleOf(op, kind, args, true)
  for (const k of ['x', 'y'] as const) {
    if (args[k] === undefined) continue
    if (typeof args[k] !== 'number' || !Number.isFinite(args[k])) refuse(op, `${k} must be a number`, `give ${k} in its space's px`)
    patch[k] = args[k]
  }
  const writes: Write[] = Object.keys(patch).length ? [{ coll: 'labels', id: l.id, patch: { ...patch, updatedAt: ctx.now } }] : []
  return { op, label: `change ${TEXT_NAMES[kind]}`, writes, ids: {}, meta: { kind } }
}

// ---- arrange (data/labels.ts' moveMany: drags, nudges, line up, a package's band, a section with what it holds)

export type ArrangeArgs = {
  // What moves: text, cards (their spot on `plane`) and pieces (their spot on `canvas`).
  items?: string[]
  // The plane cards are shown on (else each card's home), the canvas pieces are on (else the ctx's).
  plane?: string
  canvas?: string
  // Everything moved by [dx, dy] (its space's px).
  by?: [number, number]
  // Exact spots (the app's own moves), each with the plane or canvas it's on when not the one above.
  to?: { id: string; x: number; y: number; plane?: string; canvas?: string }[]
  // A section carries what's wholly inside it, a plane or deck what's stuck to it (S6), by the same distance (true unless
  // false: the UI passes what it found).
  carry?: boolean
  // A matrix, table, deck or timeline dropped within reach of a plane's edge (a timeline's: a deck's too) snaps one grid
  // step out from it and sticks there (D-210); dropped elsewhere it stays as it was.
  stick?: boolean
}

type Move = { id: string; x: number; y: number; plane?: string; canvas?: string }

// The write moving one thing on its plane or canvas: text, a card's spot (its doc at home, its place elsewhere), a
// piece's spot (its doc on its own canvas, its pieceSpot elsewhere). Places and spots have no updatedAt.
function moveWrite(ctx: OpCtx, op: string, m: Move): { write: Write; from: { x: number; y: number }; space: Space } {
  const ws = ctx.ws
  const l = ws.labels.find((x) => x.id === m.id)
  if (l)
    return {
      write: { coll: 'labels', id: l.id, patch: { x: m.x, y: m.y, updatedAt: ctx.now } },
      from: l,
      space: l.pieceId === CANVAS ? { plane: null, canvas: canvasOf(l) } : { plane: l.pieceId, canvas: '' },
    }
  const c = ws.cards.find((x) => x.id === m.id)
  if (c) {
    const plane = m.plane ?? c.pieceId
    if (plane === c.pieceId) return { write: { coll: cardColl(c.type), id: c.id, patch: { x: m.x, y: m.y, updatedAt: ctx.now } }, from: c, space: { plane, canvas: '' } }
    const p = ws.places.find((x) => x.planeId === plane && x.cardId === c.id)
    if (!p) refuse(op, `card ${c.id} isn't on plane ${plane}`, 'give the plane it is shown on (its home, or one it was placed on)')
    return { write: { coll: 'places', id: p.id, patch: { x: m.x, y: m.y } }, from: p, space: { plane, canvas: '' } }
  }
  const pc = ws.pieces.find((x) => x.id === m.id)
  if (pc) {
    const canvas = m.canvas ?? ws.canvas ?? MAIN
    if (canvas === canvasOf(pc)) return { write: { coll: 'pieces', id: pc.id, patch: { x: m.x, y: m.y, updatedAt: ctx.now } }, from: pc, space: { plane: null, canvas } }
    const sp = ws.spots.find((x) => x.canvasId === canvas && x.pieceId === pc.id)
    if (!sp) refuse(op, `piece ${pc.id} isn't on canvas ${canvas}`, 'give the canvas it is on (its own, or one it was placed on)')
    return { write: { coll: 'pieceSpots', id: sp.id, patch: { x: m.x, y: m.y } }, from: sp, space: { plane: null, canvas } }
  }
  refuse(op, `there is no text, card or piece ${m.id}`, 'use the id of text, a card or a piece')
}

// Where a thing is now on the plane or canvas named (for `by`).
function spotOf(ctx: OpCtx, op: string, id: string, plane?: string, canvas?: string) {
  const m = moveWrite(ctx, op, { id, x: 0, y: 0, plane, canvas })
  return m.from
}

export function arrange(ctx: OpCtx, args: ArrangeArgs): Plan {
  const op = 'arrange'
  if (!args.to && !args.by) refuse(op, 'arrange needs where things go', 'give by: [dx, dy] with items')
  if (args.by && (!Array.isArray(args.by) || args.by.length !== 2 || !args.by.every((v) => typeof v === 'number' && Number.isFinite(v)))) refuse(op, 'by is [dx, dy], two numbers', 'say by: [50, 0] to move right 50 px')
  const moves: Move[] = args.to
    ? args.to.map((t) => ({ plane: args.plane, canvas: args.canvas, ...t }))
    : (args.items ?? []).map((id) => {
        const f = spotOf(ctx, op, id, args.plane, args.canvas)
        return { id, x: f.x + args.by![0], y: f.y + args.by![1], plane: args.plane, canvas: args.canvas }
      })
  if (!moves.length) refuse(op, 'nothing to move', 'name the items')
  const listed = new Set(moves.map((m) => m.id))
  const out: Write[] = []
  let carried = 0
  const kinds = new Set<string>()
  const given = moves.length
  // Each plane's folds, worked out once (the cards at their spots there).
  const foldsOn = new Map<string, { cards: ReturnType<typeof cardsOn>; folds: ReturnType<typeof foldsOf> }>()
  const foldsFor = (plane: string) => {
    let f = foldsOn.get(plane)
    if (!f) {
      const cards = cardsOn(ctx.ws.cards, ctx.ws.places, plane)
      foldsOn.set(plane, (f = { cards, folds: foldsOf(cards, ctx.ws.edges) }))
    }
    return f
  }
  // What's carried moves by the same distance as what carries it, on the same plane or canvas.
  const bring = (ids: string[], space: Space, dx: number, dy: number) => {
    for (const id of ids) {
      if (listed.has(id)) continue
      listed.add(id)
      const where = { plane: space.plane ?? undefined, canvas: space.plane ? undefined : space.canvas }
      const f = spotOf(ctx, op, id, where.plane, where.canvas)
      moves.push({ id, x: f.x + dx, y: f.y + dy, ...where })
      carried++
    }
  }
  // The list grows as things are carried: what a section holds brings its own folded parts and package members too.
  let stuck = ''
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i]
    const piece = i < given && args.stick ? ctx.ws.pieces.find((p) => p.id === m.id) : undefined
    if (piece && sticks(piece)) {
      const canvas = m.canvas ?? ctx.ws.canvas ?? MAIN
      const shown = piecesShown(canvas, ctx.ws.pieces, ctx.ws.spots)
      const followers = new Set(stuckChain(shown, piece.id).map((f) => f.id))
      const kinds = hostKinds(piece)
      const hosts = shown.filter((x) => x.id !== piece.id && !followers.has(x.id) && kinds.includes(kindOfPiece(x)))
      const t = stickTarget({ x: m.x, y: m.y, w: piece.w, h: piece.h }, hosts, STICK_REACH)
      if (t) {
        ;[m.x, m.y] = [t.box.x, t.box.y]
        if (t.plane !== piece.stuckTo) (out.push({ coll: 'pieces', id: piece.id, patch: { stuckTo: t.plane, ...boundTo(piece, t.plane), updatedAt: ctx.now } }), (stuck = KIND_NAME[kindOfPiece(piece)]))
      }
    }
    const { write, from, space } = moveWrite(ctx, op, m)
    out.push(write)
    const l = ctx.ws.labels.find((x) => x.id === m.id)
    const card = l ? undefined : ctx.ws.cards.find((c) => c.id === m.id)
    if (i < given) kinds.add(l ? kindOf(l) : card ? (card.type === 'package' ? 'package' : 'card') : kindOfPiece(ctx.ws.pieces.find((p) => p.id === m.id)!))
    if (args.carry === false) continue
    const [dx, dy] = [m.x - from.x, m.y - from.y]
    // A section carries what's wholly inside it where it was (R7); a card what's folded into it, a package its members.
    if (l?.kind === 'section') {
      const { labels, others } = boxesIn(ctx, space)
      bring(sectionHolds(l, labels, others), space, dx, dy)
    } else if (card && space.plane) {
      const f = foldsFor(space.plane)
      bring(carriedWith(f.folds, f.cards, card.id), space, dx, dy)
    } else if (!l && !card && !space.plane) {
      // A plane (or a deck) brings what's stuck to it (D-210, D-298): on its edge, or as its corner moves (R7).
      const pc = ctx.ws.pieces.find((p) => p.id === m.id)!
      const shown = piecesShown(space.canvas, ctx.ws.pieces, ctx.ws.spots)
      const box = { x: from.x, y: from.y, w: pc.w, h: pc.h }
      for (const f of followerMoves(shown, pc.id, box, { ...box, x: m.x, y: m.y })) {
        if (listed.has(f.id)) continue
        listed.add(f.id)
        moves.push({ id: f.id, x: f.to.x, y: f.to.y, canvas: space.canvas })
        carried++
      }
    }
  }
  const n = moves.length
  const one = given === 1 ? ctx.ws.labels.find((x) => x.id === moves[0].id) : undefined
  const pkg = given === 1 ? ctx.ws.cards.find((c) => c.id === moves[0].id && c.type === 'package') : undefined
  const piece1 = given === 1 ? ctx.ws.pieces.find((p) => p.id === moves[0].id) : undefined
  const label = stuck
    ? `stick a ${stuck}`
    : piece1
      ? `move a ${KIND_NAME[kindOfPiece(piece1)]}`
      : one?.kind === 'section' && carried
      ? 'move a section and what is in it'
      : one
        ? `move ${one.kind === 'title' ? 'the title' : `a ${kindOf(one)}`}`
        : pkg
          ? 'move a package'
          : given === 1 && ctx.ws.cards.some((c) => c.id === moves[0].id)
            ? `move a card${carried ? ' and its parts' : ''}`
            : `move ${n} things`
  // A piece's spot and its sticking, on its own canvas, are one doc: one patch.
  const merged: Write[] = []
  for (const w of out) {
    const same = w.patch && merged.find((x) => x.patch && x.coll === w.coll && x.id === w.id)
    if (same) Object.assign(same.patch!, w.patch)
    else merged.push(w.patch ? { ...w, patch: { ...w.patch } } : w)
  }
  return { op, label, writes: merged, ids: {}, meta: { ...(kinds.size === 1 ? { kind: [...kinds][0] } : {}) } }
}

export type { Label }
