// Piece and canvas ops (S6, D-312; docs/specs/agent-actions.md §9, §10): pure builders `(ctx, args) => Plan`, the same
// writes data/pieces.ts and data/canvases.ts made before they wrapped them. Every canvas is named in the args (R1: never
// the screen's), every cascade is read from the snapshot (R5), and what follows a plane, what sticks and what goes along
// to another canvas is worked out here and in src/model/pieceMoves.ts (R7), not in the views.
//
// The model sees `deck`; the data keeps `kanban` (D-301): create_piece takes either and stores `kanban`.
import { KIND_NAME, PIECE_MIN, PIECE_NAME_MAX, PIECE_SIZE, canOpen, hostKinds, kindOfPiece, sticks } from '../model/pieces'
import { CANVAS_NAME_MAX, MAIN, MAIN_NAME, canvasGoes, canvasOf, canvasTextOn, canvasesOf, withStuck } from '../model/canvases'
import { GRID, snap } from '../model/grid'
import { TEMPLATES as MATRIX_TEMPLATES_ALL } from '../model/matrix'
import { TEMPLATES as TABLE_TEMPLATES_ALL } from '../model/table'
import { matrixSetupFrom, type MatrixSpec } from './matrix'
import { tableSetupFrom, type TableSpec } from './table'
import { deckSetupFrom, type DeckSpec } from './deck'
import { kindOf, type Label } from '../model/labels'
import { labelBox } from '../model/labelBox'
import { clearSpotFor, piecesShown, sectionHolds, type Box } from '../model/textPlace'
import { STICK_GAP, followerMoves, nearClearIn } from '../model/pieceMoves'
import type { Card } from '../model/cards'
import type { Piece, PieceKind } from '../data/model'
import type { DocumentsSetup } from '../data/documents'
import { DELETE, type OpCtx, type Plan, type Write } from './types'
import { a, cardColl, find, handleOf, once, refuse } from './util'
import { cardCascade } from './cards'
import { TEXT_NAMES, updateText } from './text'
import { boundTo, withPatch } from './stick'

type P = Piece & { id: string }

// What the model may make, by the names it sees.
export const PIECE_KINDS = ['plane', 'deck', 'matrix', 'table', 'timeline', 'documents', 'document'] as const
const STORED: Record<string, PieceKind> = { plane: 'plane', deck: 'kanban', kanban: 'kanban', matrix: 'matrix', table: 'table', timeline: 'timeline', documents: 'documents', document: 'document' }
// The setup field each kind keeps.
const SETUP_KEY: Partial<Record<PieceKind, 'matrix' | 'table' | 'kanban' | 'timeline' | 'documents'>> = { matrix: 'matrix', table: 'table', kanban: 'kanban', timeline: 'timeline', documents: 'documents' }

export const pieceName = (p: Pick<Piece, 'kind'>) => KIND_NAME[kindOfPiece(p)]
const aPiece = (p: Pick<Piece, 'kind'>) => `a ${pieceName(p)}`

const pieceIn = (ctx: OpCtx, op: string, id: unknown): P => find(ctx.ws.pieces as P[], op, id, 'piece')

function canvasIn(ctx: OpCtx, op: string, canvas: unknown): string {
  if (typeof canvas !== 'string' || !canvas) refuse(op, 'which canvas?', `give canvas: the id of one (${MAIN} for the first)`)
  if (canvas !== MAIN && !ctx.ws.canvases.some((c) => c.id === canvas)) refuse(op, `there is no canvas ${canvas}`, `use the id of an existing canvas (${MAIN} for the first)`)
  return canvas
}

const canvasName = (ctx: OpCtx, id: string) => ctx.ws.canvases.find((c) => c.id === id)?.name ?? (id === MAIN ? MAIN_NAME : id)

// The pieces drawn on `canvas`, each at its spot there.
const shownOn = (ctx: OpCtx, canvas: string) => piecesShown(canvas, ctx.ws.pieces as P[], ctx.ws.spots)

const boxOf = (p: Pick<Piece, 'x' | 'y' | 'w' | 'h'>): Box => ({ x: p.x, y: p.y, w: p.w, h: p.h })
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

// Writes, a doc's patches merged into one (a piece's spot and size on its own canvas are one doc).
class Writes {
  list: Write[] = []
  patch(coll: Write['coll'], id: string, patch: Record<string, unknown>) {
    const w = this.list.find((x) => x.coll === coll && x.id === id && x.patch)
    if (w) Object.assign(w.patch!, patch)
    else this.list.push({ coll, id, patch: { ...patch } })
  }
  push(...w: Write[]) {
    this.list.push(...w)
  }
}

// Where a piece is put on `canvas`: its own doc on its own canvas, its spot elsewhere (a spot has no updatedAt).
function moveTo(ctx: OpCtx, op: string, out: Writes, p: P, canvas: string, x: number, y: number) {
  if (canvasOf(p) === canvas) return out.patch('pieces', p.id, { x, y, updatedAt: ctx.now })
  const s = ctx.ws.spots.find((sp) => sp.canvasId === canvas && sp.pieceId === p.id)
  if (!s) refuse(op, `${aPiece(p)} ${p.id} isn't on canvas ${canvas}`, 'give the canvas it is on (its own, or one it was put on too)')
  out.patch('pieceSpots', s.id, { x, y })
}

// ---- Setups to start from (S7/S8 bring the templates; the UI passes its own)

function startSetup(ctx: OpCtx, kind: PieceKind): Record<string, unknown> | undefined {
  const id = () => ctx.newId().slice(-8)
  // A matrix starts blank (D-204), a table with every card (D-209): the templates in src/model/matrix.ts and table.ts.
  if (kind === 'matrix') return JSON.parse(JSON.stringify(MATRIX_TEMPLATES_ALL.find((t) => t.key === 'blank')!.setup(id)))
  if (kind === 'table') return JSON.parse(JSON.stringify(TABLE_TEMPLATES_ALL[0].setup(id)))
  if (kind === 'kanban') return { cols: [{ id: id(), name: 'todo' }, { id: id(), name: 'doing' }, { id: id(), name: 'done', done: true }] }
  if (kind === 'documents') return { view: 'table', pageSize: 10 }
  return undefined
}

// ---- create_piece

export type CreatePieceArgs = {
  kind: (typeof PIECE_KINDS)[number] | 'kanban'
  name?: string
  // The canvas it goes on (R1: always said; the UI passes the one shown).
  canvas: string
  // A matrix's, table's, deck's, timeline's or documents list's setup; left out, a blank one.
  setup?: Record<string, unknown>
  // A matrix's or a table's setup from typed arguments (S7: src/ops/matrix.ts' matrixSetupFrom, table.ts'
  // tableSetupFrom), converted to the stored setup; instead of setup.
  matrix?: MatrixSpec
  table?: TableSpec
  // A deck's setup from typed arguments (S8: src/ops/deck.ts' deckSetupFrom): holds, columns, cards, lanes…
  deck?: DeckSpec
  // A document piece: the document it shows (shared: a private one is shared first, by a person).
  doc?: string
  size?: { w: number; h: number }
  // Stuck to this plane (a timeline: a deck or a plane): beside it, showing its cards.
  stuck_to?: string
  // Its top-left (the UI's, already clear); centred on `at` and moved to the nearest clear place; right of a piece; left
  // out: beside what it's stuck to, else under everything on the canvas.
  where?: { x: number; y: number } | { at: [number, number] } | { near: string }
  handle?: string
}

export function createPiece(ctx: OpCtx, args: CreatePieceArgs): Plan {
  const op = 'create_piece'
  const kind = STORED[args.kind as string]
  if (!kind) refuse(op, `${String(args.kind)} isn't a kind of piece`, `use one of ${PIECE_KINDS.join(', ')}`)
  const canvas = canvasIn(ctx, op, args.canvas)
  const ws = ctx.ws
  const key = SETUP_KEY[kind]
  if (args.setup !== undefined && (!key || !args.setup || typeof args.setup !== 'object' || Array.isArray(args.setup)))
    refuse(op, key ? 'setup is an object' : `${a(KIND_NAME[kind])} has no setup`, key ? `give the ${KIND_NAME[kind]}'s setup as an object, or leave it out for a blank one` : 'leave setup out')
  if (kind === 'document') {
    if (typeof args.doc !== 'string') refuse(op, 'a document piece shows a document', 'give doc: the id of a document')
    const d = (ws.documents ?? []).find((x) => x.id === args.doc)
    if (!d) refuse(op, `there is no document ${args.doc}`, 'use the id of a document you can see')
    if (!d.shared) refuse(op, 'that document is private: everyone sees the canvas', 'ask its owner to share it first')
  } else if (args.doc !== undefined) refuse(op, `${a(KIND_NAME[kind])} shows no document`, 'say kind: document, or leave doc out')
  let size = PIECE_SIZE[kind]
  if (args.size !== undefined) {
    if (!args.size || !num(args.size.w) || !num(args.size.h) || args.size.w <= 0 || args.size.h <= 0) refuse(op, 'size is { w, h }, two numbers above 0', 'give w and h in canvas px, or leave size out')
    size = { w: args.size.w, h: args.size.h }
  }
  const shown = shownOn(ctx, canvas)
  let host: P | undefined
  if (args.stuck_to !== undefined) {
    const kinds = hostKinds({ kind })
    if (!kinds.length) refuse(op, `${a(KIND_NAME[kind])} doesn't stick to anything`, 'leave stuck_to out (matrices, tables and decks stick to a plane, a timeline to a deck or a plane)')
    host = pieceIn(ctx, op, args.stuck_to)
    if (!kinds.includes(kindOfPiece(host))) refuse(op, `${a(KIND_NAME[kind])} sticks to ${a(kinds.map((k) => KIND_NAME[k]).join(' or '))}, not ${aPiece(host)}`, `stick it to ${a(kinds.map((k) => KIND_NAME[k]).join(' or '))}`)
    if (!shown.some((p) => p.id === host!.id)) refuse(op, `${aPiece(host)} ${host.id} isn't on canvas ${canvas}`, 'make it on the canvas the piece it sticks to is on')
  }

  // Where.
  let spot: { x: number; y: number }
  const w = args.where
  const hostShown = host && shown.find((p) => p.id === host!.id)
  if (w && 'x' in w) {
    if (!num(w.x) || !num(w.y)) refuse(op, 'x and y must be numbers', 'give where in canvas px')
    spot = { x: w.x, y: w.y }
  } else if (w && 'at' in w) {
    if (!Array.isArray(w.at) || !num(w.at[0]) || !num(w.at[1])) refuse(op, 'at is [x, y], two numbers', 'give at in canvas px')
    const box = { x: snap(w.at[0] - size.w / 2), y: snap(w.at[1] - size.h / 2), ...size }
    spot = nearClearIn(box, shown)
  } else if (w && 'near' in w) {
    const n = shown.find((p) => p.id === w.near)
    if (!n) refuse(op, `there is no piece ${String(w.near)} on canvas ${canvas}`, 'name a piece on that canvas, or leave where out')
    spot = nearClearIn({ x: snap(n.x + n.w + 4 * GRID), y: snap(n.y), ...size }, shown)
  } else if (hostShown) spot = { x: hostShown.x + hostShown.w + STICK_GAP, y: hostShown.y }
  else spot = clearSpotFor(size, [...shown, ...ws.labels.filter(canvasTextOn(canvas)).map(labelBox)])

  if (args.matrix !== undefined && kind !== 'matrix') refuse(op, `${a(KIND_NAME[kind])} has no matrix setup`, 'say kind: matrix, or leave matrix out')
  if (args.table !== undefined && kind !== 'table') refuse(op, `${a(KIND_NAME[kind])} has no table setup`, 'say kind: table, or leave table out')
  if (args.deck !== undefined && kind !== 'kanban') refuse(op, `${a(KIND_NAME[kind])} has no deck setup`, 'say kind: deck, or leave deck out')
  if ((args.matrix !== undefined || args.table !== undefined || args.deck !== undefined) && args.setup !== undefined) refuse(op, `setup and ${KIND_NAME[kind]} both say how it's set up`, `give ${KIND_NAME[kind]} (typed) and leave setup out`)
  const typed =
    args.matrix !== undefined ? matrixSetupFrom(ctx, op, args.matrix) : args.table !== undefined ? tableSetupFrom(ctx, op, args.table) : args.deck !== undefined ? deckSetupFrom(ctx, op, args.deck) : undefined
  const setup = key ? (typed ? (typed as unknown as Record<string, unknown>) : args.setup ? structuredClone(args.setup) : startSetup(ctx, kind)) : undefined
  const name = typeof args.name === 'string' ? args.name.trim().slice(0, PIECE_NAME_MAX) : ''
  const now = ctx.now
  let data: Record<string, unknown> = {
    kind,
    ...spot,
    ...size,
    ...(name ? { name } : {}),
    ...(key && setup ? { [key]: setup } : {}),
    ...(kind === 'document' ? { docId: args.doc } : {}),
    ...(host ? { stuckTo: host.id } : {}),
    ...(canvas !== MAIN ? { canvasId: canvas } : {}),
    createdAt: now,
    updatedAt: now,
  }
  // Stuck at once: what it shows is that plane's (a table's rule, a matrix's typed axes).
  if (host && kindOfPiece(host) === 'plane') data = withPatch(data, boundTo({ kind, ...(setup ? { [kind]: setup } : {}) } as Piece, host.id))
  const id = ctx.newId()
  return { op, label: `add a ${KIND_NAME[kind]}`, writes: [{ coll: 'pieces', id, set: data }], ids: { [handleOf(args)]: id }, meta: { kind } }
}

// ---- update_piece (its name, frame, link to a plane, a documents list's setup)

export type UpdatePieceArgs = {
  id: string
  name?: string | null
  // false: out of its window onto the canvas (D-228); true: back in it.
  framed?: boolean
  // Stuck to this plane (a timeline: a deck or a plane), or let go (null), where it is.
  stuck_to?: string | null
  // A documents list's view, kinds, sort, page size, merged (undefined or null takes one away).
  documents?: Partial<Record<keyof DocumentsSetup, unknown>>
}

export function updatePiece(ctx: OpCtx, args: UpdatePieceArgs): Plan {
  const op = 'update_piece'
  const p = pieceIn(ctx, op, args.id)
  const kind = kindOfPiece(p)
  const patch: Record<string, unknown> = {}
  const said: string[] = []
  if ('name' in args) {
    if (args.name !== null && args.name !== undefined && typeof args.name !== 'string') refuse(op, 'name is text', 'give the name as a string, or null to take it away')
    const value = (args.name ?? '').trim().slice(0, PIECE_NAME_MAX)
    patch.name = value || DELETE
    said.push(`rename ${aPiece(p)}`)
  }
  if (args.framed !== undefined) {
    if (typeof args.framed !== 'boolean') refuse(op, 'framed is true or false', 'say framed: false to lay it on the canvas, true to put it back in its window')
    if (!canOpen(p)) refuse(op, `${aPiece(p)} is always framed`, 'only matrices, tables, documents, decks and timelines come out of their window')
    patch.open = args.framed ? DELETE : true
    said.push(`${args.framed ? 'close' : 'open'} ${aPiece(p)}`)
  }
  if (args.stuck_to !== undefined) {
    if (!sticks(p)) refuse(op, `${aPiece(p)} doesn't stick to anything`, 'leave stuck_to out (matrices, tables and decks stick to a plane, a timeline to a deck or a plane)')
    const to = args.stuck_to
    if (to !== null) {
      const host = pieceIn(ctx, op, to)
      const kinds = hostKinds(p)
      if (!kinds.includes(kindOfPiece(host))) refuse(op, `${aPiece(p)} sticks to ${a(kinds.map((k) => KIND_NAME[k]).join(' or '))}, not ${aPiece(host)}`, `stick it to ${a(kinds.map((k) => KIND_NAME[k]).join(' or '))}`)
      if (host.id === p.id) refuse(op, "a piece can't stick to itself", 'stick it to another piece')
    }
    if (to !== (p.stuckTo ?? null)) {
      Object.assign(patch, { stuckTo: to ?? DELETE, ...boundTo(p, to) })
      said.push(`${to ? 'stick' : 'unstick'} ${aPiece(p)}`)
    }
  }
  if (args.documents !== undefined) {
    if (kind !== 'documents') refuse(op, `${aPiece(p)} isn't a documents list`, 'documents is for a documents list only')
    const next: Record<string, unknown> = { ...(p.documents ?? { view: 'table', pageSize: 10 }), ...args.documents }
    for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === null) delete next[k]
    patch.documents = next
    said.push('change a documents list')
  }
  const writes: Write[] = Object.keys(patch).length ? [{ coll: 'pieces', id: p.id, patch: { ...patch, updatedAt: ctx.now } }] : []
  return { op, label: said.length === 1 ? said[0] : `change ${aPiece(p)}`, writes, ids: {}, meta: { kind } }
}

// ---- rename (a piece or a canvas; a card's title is update_card, text's words update_text)

export type RenameArgs = { id: string; name: string; handle?: string }

export function rename(ctx: OpCtx, args: RenameArgs): Plan {
  const op = 'rename'
  if (typeof args.name !== 'string') refuse(op, 'name is text', 'give the new name as a string')
  if (ctx.ws.pieces.some((p) => p.id === args.id)) return { ...updatePiece(ctx, { id: args.id, name: args.name }), op }
  const c = ctx.ws.canvases.find((x) => x.id === args.id)
  if (c) {
    const value = args.name.trim().slice(0, CANVAS_NAME_MAX) || MAIN_NAME
    // `main` may have no doc yet: written whole (and so made: listed in ids).
    if (!c.createdAt) return { op, label: 'rename a canvas', writes: [{ coll: 'canvases', id: c.id, set: { name: value, order: c.order, createdAt: ctx.now } }], ids: { [args.handle ?? '$main']: c.id }, meta: { kind: 'canvas' } }
    return { op, label: 'rename a canvas', writes: [{ coll: 'canvases', id: c.id, patch: { name: value } }], ids: {}, meta: { kind: 'canvas' } }
  }
  if (ctx.ws.cards.some((x) => x.id === args.id)) refuse(op, "a card's title isn't renamed here", 'use update_card with title')
  if (ctx.ws.labels.some((x) => x.id === args.id)) refuse(op, "text's words aren't renamed here", 'use update_text with text')
  refuse(op, `there is no piece or canvas ${String(args.id)}`, 'use the id of a piece or a canvas')
}

// ---- Where a piece goes and how big (the UI's drag and resize; the model's resize)

export type PlaceArgs = {
  id: string
  // The canvas it's moved on (R1: the UI passes the one shown).
  canvas: string
  // Its box at the end (x/y on that canvas; w/h its own).
  to: Box
  // Where what follows it goes (the UI's, as it drew them); left out, worked out (followerMoves).
  followers?: { id: string; to: Box }[]
  // Stuck to this plane at the end, or let go (null); left out, as it was.
  stuck?: string | null
  label?: string
}

export function place(ctx: OpCtx, args: PlaceArgs, op = 'arrange'): Plan {
  const p = pieceIn(ctx, op, args.id)
  const canvas = canvasIn(ctx, op, args.canvas)
  const out = new Writes()
  const t = args.to
  if (![t?.x, t?.y, t?.w, t?.h].every(num)) refuse(op, 'the box is x, y, w and h, numbers', 'give them in canvas px')
  const shown = shownOn(ctx, canvas)
  const from = shown.find((x) => x.id === p.id) ?? p
  moveTo(ctx, op, out, p, canvas, t.x, t.y)
  const resized = t.w !== p.w || t.h !== p.h
  const own: Record<string, unknown> = resized ? { w: t.w, h: t.h } : {}
  let change = ''
  if (args.stuck !== undefined && args.stuck !== (p.stuckTo ?? null)) {
    Object.assign(own, { stuckTo: args.stuck ?? DELETE, ...boundTo(p, args.stuck) })
    change = args.stuck ? 'stick' : 'unstick'
  }
  if (Object.keys(own).length) out.patch('pieces', p.id, { ...own, updatedAt: ctx.now })
  const followers = args.followers ?? followerMoves(shown, p.id, boxOf(from), t)
  for (const f of followers) moveTo(ctx, op, out, pieceIn(ctx, op, f.id), canvas, f.to.x, f.to.y)
  const label = args.label ?? `${change || (resized ? 'resize' : 'move')} ${aPiece(p)}`
  return { op, label, writes: out.list, ids: {}, meta: { kind: kindOfPiece(p) } }
}

export type ResizeArgs = {
  id: string
  w: number
  h?: number
  // A piece: the canvas it's resized on (its own unless said) and its new top-left when an edge on the left or top moved.
  canvas?: string
  x?: number
  y?: number
}

// A piece (with what follows it) or text (a paragraph's, sticky note's or the title's width; a section's box).
export function resize(ctx: OpCtx, args: ResizeArgs): Plan {
  const op = 'resize'
  const l = ctx.ws.labels.find((x) => x.id === args.id)
  if (l) {
    const plan = updateText(ctx, { id: l.id, w: args.w, ...(args.h !== undefined ? { h: args.h } : {}), ...(args.x !== undefined ? { x: args.x } : {}), ...(args.y !== undefined ? { y: args.y } : {}) })
    return { ...plan, op, label: `resize ${TEXT_NAMES[kindOf(l)]}` }
  }
  const p = pieceIn(ctx, op, args.id)
  if (p.open) refuse(op, `${aPiece(p)} laid on the canvas is as big as what it shows`, 'frame it first (update_piece framed: true), then resize its window')
  const h = args.h ?? p.h
  if (!num(args.w) || !num(h)) refuse(op, 'w and h must be numbers', 'give them in canvas px')
  if (args.w < PIECE_MIN.w || h < PIECE_MIN.h) refuse(op, `a piece is at least ${PIECE_MIN.w} × ${PIECE_MIN.h}`, `give w ≥ ${PIECE_MIN.w} and h ≥ ${PIECE_MIN.h}`)
  const canvas = args.canvas ?? canvasOf(p)
  const at = shownOn(ctx, canvasIn(ctx, op, canvas)).find((x) => x.id === p.id) ?? p
  return place(ctx, { id: p.id, canvas, to: { x: args.x ?? at.x, y: args.y ?? at.y, w: Math.round(args.w), h: Math.round(h) } }, op)
}

export { followerMoves }

// ---- delete (pieces and canvases; ops/delete.ts sends them here)

export type DeletePiecesArgs = {
  ids: string[]
  // A piece on several canvases (D-313): off `canvas` only (`here`), or deleted from all of them.
  scope?: 'here' | 'everywhere'
  everywhere?: boolean
  canvas?: string
}

// A canvas's piece taken off it, staying on the others it's on: a spot goes; on its home, the home moves to its first
// other canvas and that spot goes.
function takeOffWrites(ctx: OpCtx, op: string, p: P, canvas: string): Write[] {
  const on = canvasesOf(p, ctx.ws.spots)
  if (!on.includes(canvas)) refuse(op, `${aPiece(p)} ${p.id} isn't on canvas ${canvas}`, 'give a canvas it is on')
  const still = on.filter((c) => c !== canvas)
  if (!still.length) refuse(op, `${aPiece(p)} ${p.id} is on no other canvas`, 'delete it instead')
  if (canvasOf(p) !== canvas) return [{ coll: 'pieceSpots', id: `${canvas}_${p.id}`, del: true }]
  const s = ctx.ws.spots.find((x) => x.pieceId === p.id && x.canvasId === still[0])!
  return [
    { coll: 'pieces', id: p.id, patch: { canvasId: s.canvasId === MAIN ? DELETE : s.canvasId, x: s.x, y: s.y, updatedAt: ctx.now } },
    { coll: 'pieceSpots', id: s.id, del: true },
  ]
}

// Pieces deleted with what's theirs (D-187, D-204, D-209, D-251, D-281, D-302): a plane's cards (those also on a plane
// that stays move their home there), their links and what hangs off them, its text and the places on it; a matrix's or
// table's cells; a deck's tasks; every spot of theirs. Threads stay (never written by ops); pieces stuck to them stay,
// let go by the app's reading (D-141).
export function pieceCascade(ctx: OpCtx, list: P[]): Write[] {
  const ws = ctx.ws
  const going = new Set(list.map((p) => p.id))
  const writes: Write[] = list.map((p): Write => ({ coll: 'pieces', id: p.id, del: true }))
  const gone: Card[] = []
  for (const c of ws.cards) {
    if (!going.has(c.pieceId)) continue
    const away = ws.places.filter((p) => p.cardId === c.id && !going.has(p.planeId) && p.planeId !== c.pieceId).sort((x, y) => x.createdAt - y.createdAt)[0]
    if (!away) {
      gone.push(c)
      continue
    }
    writes.push(
      { coll: cardColl(c.type), id: c.id, patch: { pieceId: away.planeId, x: away.x, y: away.y, folded: away.folded ? true : DELETE, updatedAt: ctx.now } },
      { coll: 'places', id: away.id, del: true },
    )
  }
  writes.push(...cardCascade(ctx, gone))
  for (const p of ws.places) if (going.has(p.planeId)) writes.push({ coll: 'places', id: p.id, del: true })
  for (const l of ws.labels) if (going.has(l.pieceId)) writes.push({ coll: 'labels', id: l.id, del: true })
  for (const c of ws.cells) if (going.has(c.matrixId)) writes.push({ coll: 'cells', id: (c as { id?: string }).id ?? `${c.matrixId}_${c.row}_${c.col}`, del: true })
  for (const t of ws.tasks) if (going.has(t.pieceId)) writes.push({ coll: 'tasks', id: t.id, del: true })
  for (const s of ws.spots) if (going.has(s.pieceId)) writes.push({ coll: 'pieceSpots', id: s.id, del: true })
  return once(writes)
}

export function deletePieces(ctx: OpCtx, args: DeletePiecesArgs, op = 'delete'): Plan {
  const list = args.ids.map((id) => pieceIn(ctx, op, id))
  const everywhere = args.everywhere || args.scope === 'everywhere'
  const off: P[] = []
  const gone: P[] = []
  for (const p of list) {
    const on = canvasesOf(p, ctx.ws.spots)
    if (on.length < 2 || everywhere) gone.push(p)
    else if (args.scope === 'here') off.push(p)
    else
      refuse(op, `${aPiece(p)} ${p.id} is on ${on.length} canvases (${on.map((c) => canvasName(ctx, c)).join(', ')})`, "say scope: 'here' with canvas to take it off one, or scope: 'everywhere' to delete it")
  }
  const writes: Write[] = []
  if (off.length) {
    const canvas = canvasIn(ctx, op, args.canvas)
    for (const p of off) writes.push(...takeOffWrites(ctx, op, p, canvas))
  }
  writes.push(...pieceCascade(ctx, gone))
  const kinds = new Set(list.map((p) => kindOfPiece(p)))
  const label =
    list.length === 1 ? (off.length ? `take ${aPiece(list[0])} off this canvas` : `delete ${aPiece(list[0])}`) : off.length && !gone.length ? `take ${list.length} things off this canvas` : `delete ${list.length} things`
  return { op, label, writes: once(writes), ids: {}, meta: kinds.size === 1 ? { kind: [...kinds][0] } : {} }
}

// A canvas with what's on it (canvasGoes); the first canvas is never deleted (D-311).
export function deleteCanvasWrites(ctx: OpCtx, op: string, canvas: string): Write[] {
  if (canvas === MAIN) refuse(op, 'the first canvas is never deleted', 'delete what is on it instead, or another canvas')
  if (!ctx.ws.canvases.some((c) => c.id === canvas)) refuse(op, `there is no canvas ${canvas}`, 'use the id of an existing canvas')
  const ws = ctx.ws
  const { pieces, going, kept } = canvasGoes(canvas, ws)
  const writes: Write[] = [{ coll: 'canvases', id: canvas, del: true }, ...pieceCascade(ctx, pieces as P[])]
  // A piece also elsewhere: its home moves to its first other canvas, that spot goes.
  for (const { piece, to } of kept)
    writes.push({ coll: 'pieces', id: piece.id, patch: { canvasId: to.canvasId === MAIN ? DELETE : to.canvasId, x: to.x, y: to.y, updatedAt: ctx.now } }, { coll: 'pieceSpots', id: to.id, del: true })
  for (const l of ws.labels) if (canvasTextOn(canvas)(l)) writes.push({ coll: 'labels', id: l.id, del: true })
  for (const s of ws.spots) if (s.canvasId === canvas || going.has(s.pieceId)) writes.push({ coll: 'pieceSpots', id: s.id, del: true })
  return once(writes)
}

// ---- Canvases (D-302)

export type CreateCanvasArgs = { name: string; handle?: string }

// A new canvas after the others; `main`'s doc written with it the first time (it had none).
export function createCanvas(ctx: OpCtx, args: CreateCanvasArgs): Plan {
  const op = 'create_canvas'
  const name = typeof args.name === 'string' ? args.name.trim().slice(0, CANVAS_NAME_MAX) : ''
  if (!name) refuse(op, 'a canvas needs a name', 'give it a name (≤ 60 characters)')
  const h = handleOf(args)
  const id = ctx.newId()
  const now = ctx.now
  const list = ctx.ws.canvases
  const main = list.find((c) => c.id === MAIN && !c.createdAt)
  const order = Math.max(0, ...list.map((c) => c.order)) + 1
  const writes: Write[] = [{ coll: 'canvases', id, set: { name, order, createdAt: now, ...(ctx.actor.uid ? { createdBy: ctx.actor.uid } : {}) } }]
  const ids: Record<string, string> = { [h]: id }
  if (main) (writes.push({ coll: 'canvases', id: MAIN, set: { name: MAIN_NAME, order: 0, createdAt: now } }), (ids[`${h}.main`] = MAIN))
  return { op, label: 'add a canvas', writes, ids, meta: { kind: 'canvas' } }
}

export type MoveCanvasArgs = { canvas: string; by: 'up' | 'down' | -1 | 1 }

// One place up or down: the list written in its new order (orders made distinct).
export function moveCanvas(ctx: OpCtx, args: MoveCanvasArgs): Plan {
  const op = 'move_canvas'
  const list = ctx.ws.canvases
  const i = list.findIndex((c) => c.id === args.canvas)
  if (i < 0) refuse(op, `there is no canvas ${String(args.canvas)}`, 'use the id of an existing canvas')
  const by = args.by === 'up' || args.by === -1 ? -1 : args.by === 'down' || args.by === 1 ? 1 : 0
  if (!by) refuse(op, 'by is up or down', "say by: 'up' or 'down'")
  const j = i + by
  if (j < 0 || j >= list.length) refuse(op, `it's ${by < 0 ? 'first' : 'last'} already`, `move it ${by < 0 ? 'down' : 'up'}, or leave it`)
  const next = list.slice()
  ;[next[i], next[j]] = [next[j], next[i]]
  const ids: Record<string, string> = {}
  const writes: Write[] = next.map((c, k) => {
    if (!c.createdAt) ids.$main = c.id
    return { coll: 'canvases', id: c.id, set: { name: c.name, order: k, createdAt: c.createdAt || ctx.now, ...(c.createdBy ? { createdBy: c.createdBy } : {}) } }
  })
  return { op, label: 'move a canvas', writes, ids, meta: { kind: 'canvas' } }
}

// What a move or a share to another canvas takes: the pieces named and what's stuck to them, and (moving) the canvas's
// text named with what its sections hold wholly (pieces and text), as MoveToCanvas.tsx' go found them.
function goingAlong(ctx: OpCtx, op: string, items: string[], from: string, carry: boolean) {
  const shown = shownOn(ctx, from)
  const text = ctx.ws.labels.filter(canvasTextOn(from))
  const pieces: string[] = []
  const labels: Label[] = []
  for (const id of items) {
    if (shown.some((p) => p.id === id)) pieces.push(id)
    else {
      const l = text.find((x) => x.id === id)
      if (!l) refuse(op, `${id} isn't a piece or the canvas's text on canvas ${from}`, 'name pieces and text on the canvas they are moved from (text on a plane goes with its plane)')
      labels.push(l)
    }
  }
  if (carry) {
    const boxes = shown.map((p) => ({ id: p.id, ...boxOf(p) }))
    for (const s of labels.filter((l) => kindOf(l) === 'section'))
      for (const id of sectionHolds(s, text, boxes)) {
        if (boxes.some((b) => b.id === id)) !pieces.includes(id) && pieces.push(id)
        else if (!labels.some((l) => l.id === id)) labels.push(text.find((l) => l.id === id)!)
      }
  }
  const list = carry ? withStuck(pieces, shown) : shown.filter((p) => pieces.includes(p.id))
  return { pieces: list, labels }
}

const boundsOf = (boxes: Box[]): Box => {
  const x0 = Math.min(...boxes.map((b) => b.x))
  const y0 = Math.min(...boxes.map((b) => b.y))
  return { x: x0, y: y0, w: Math.max(...boxes.map((b) => b.x + b.w)) - x0, h: Math.max(...boxes.map((b) => b.y + b.h)) - y0 }
}

export type MoveToCanvasArgs = {
  // Pieces and the canvas's text (on `from`).
  items: string[]
  canvas: string
  // The canvas they're on now (R1: the UI passes the one shown); left out, the snapshot's.
  from?: string
  // What's stuck to them and what their sections hold go too (true unless false: the UI passes what it found).
  carry?: boolean
  // How big each is as drawn (the UI's, for where they land); left out, their stored boxes.
  boxes?: Box[]
}

// Pieces and the canvas's text moved to `canvas`, all by one step: where they were, or the nearest clear place there. A
// piece stuck to one that stays lets go; one already on `canvas` too (a spot) has its spot there go. A piece shown on
// `from` only through a spot isn't moved (its own canvas keeps it). Returns where they landed, to look there.
export function moveToCanvasPlan(ctx: OpCtx, args: MoveToCanvasArgs): { plan: Plan; landed: Box } {
  const op = 'move_to_canvas'
  const to = canvasIn(ctx, op, args.canvas)
  const from = canvasIn(ctx, op, args.from ?? ctx.ws.canvas ?? MAIN)
  if (to === from) refuse(op, 'they are on that canvas already', 'name another canvas')
  if (!Array.isArray(args.items) || !args.items.length) refuse(op, 'nothing to move', 'name the pieces and text')
  const along = goingAlong(ctx, op, args.items, from, args.carry !== false)
  const pieces = along.pieces.filter((p) => canvasOf(p) === from).map((p) => pieceIn(ctx, op, p.id))
  const labels = along.labels
  if (!pieces.length && !labels.length) refuse(op, 'those are only shown here: their own canvas keeps them', 'take them off this canvas instead (delete with scope here)')
  const bounds = boundsOf(args.boxes?.length ? args.boxes : [...pieces.map(boxOf), ...labels.map(labelBox)])
  const at = nearClearIn(bounds, shownOn(ctx, to))
  const [dx, dy] = [at.x - bounds.x, at.y - bounds.y]
  const canvasId = to === MAIN ? DELETE : to
  const moved = new Set(pieces.map((p) => p.id))
  const writes: Write[] = [
    ...pieces.map((p): Write => ({ coll: 'pieces', id: p.id, patch: { canvasId, x: p.x + dx, y: p.y + dy, ...(p.stuckTo && !moved.has(p.stuckTo) ? { stuckTo: DELETE } : {}), updatedAt: ctx.now } })),
    ...ctx.ws.spots.filter((s) => s.canvasId === to && moved.has(s.pieceId)).map((s): Write => ({ coll: 'pieceSpots', id: s.id, del: true })),
    ...labels.map((l): Write => ({ coll: 'labels', id: l.id, patch: { canvasId, x: l.x + dx, y: l.y + dy, updatedAt: ctx.now } })),
  ]
  const n = pieces.length + labels.length
  const what = n > 1 ? `${n} things` : pieces.length ? aPiece(pieces[0]) : 'text'
  const kinds = new Set(pieces.map((p) => kindOfPiece(p)))
  return { plan: { op, label: `move ${what} to ${canvasName(ctx, to)}`, writes, ids: {}, meta: kinds.size === 1 && !labels.length ? { kind: [...kinds][0] } : {} }, landed: { ...bounds, x: at.x, y: at.y } }
}

export const moveToCanvas = (ctx: OpCtx, args: MoveToCanvasArgs): Plan => moveToCanvasPlan(ctx, args).plan

export type PiecesOnArgs = { pieces: string[]; canvas: string; from?: string; carry?: boolean; boxes?: Box[]; handle?: string }

// The same pieces on `canvas` as well (D-307), with what's stuck to them, all by one offset, where they are or the
// nearest clear place there; those already there stay as they are. Null `landed` when every one is there already.
export function piecesOnPlan(ctx: OpCtx, args: PiecesOnArgs): { plan: Plan; landed: Box | null } {
  const op = 'place_on'
  const to = canvasIn(ctx, op, args.canvas)
  const from = canvasIn(ctx, op, args.from ?? ctx.ws.canvas ?? MAIN)
  if (!Array.isArray(args.pieces) || !args.pieces.length) refuse(op, 'no pieces named', 'name the pieces to put on that canvas too')
  for (const id of args.pieces) pieceIn(ctx, op, id)
  const along = goingAlong(ctx, op, args.pieces, from, args.carry !== false).pieces
  const there = new Set(shownOn(ctx, to).map((p) => p.id))
  const list = along.filter((p) => !there.has(p.id))
  if (!list.length) return { plan: { op, label: 'put it on another canvas too', writes: [], ids: {}, meta: {} }, landed: null }
  const bounds = boundsOf(args.boxes?.length ? args.boxes : along.map(boxOf))
  const at = nearClearIn(bounds, shownOn(ctx, to))
  const ids: Record<string, string> = {}
  const h = handleOf(args)
  const writes: Write[] = list.map((p, i) => {
    const id = `${to}_${p.id}`
    ids[i === 0 ? h : `${h}.${i + 1}`] = id
    return { coll: 'pieceSpots', id, set: { canvasId: to, pieceId: p.id, x: p.x + at.x - bounds.x, y: p.y + at.y - bounds.y, createdAt: ctx.now } }
  })
  const label = `put ${list.length > 1 ? `${list.length} things` : aPiece(list[0])} on ${canvasName(ctx, to)} too`
  return { plan: { op, label, writes, ids, meta: list.length === 1 ? { kind: kindOfPiece(list[0]) } : {} }, landed: { ...bounds, x: at.x, y: at.y } }
}

export type PieceOffArgs = { piece?: string; pieces?: string[]; canvas: string }

// Off `canvas` only, staying on the others they're on (D-307).
export function piecesOff(ctx: OpCtx, args: PieceOffArgs): Plan {
  const op = 'take_off'
  const ids = args.pieces ?? (args.piece ? [args.piece] : [])
  if (!ids.length) refuse(op, 'no pieces named', 'name the pieces to take off that canvas')
  const canvas = canvasIn(ctx, op, args.canvas)
  const list = ids.map((id) => pieceIn(ctx, op, id))
  const writes = once(list.flatMap((p) => takeOffWrites(ctx, op, p, canvas)))
  const kinds = new Set(list.map((p) => kindOfPiece(p)))
  return { op, label: list.length === 1 ? `take ${aPiece(list[0])} off this canvas` : `take ${list.length} things off this canvas`, writes, ids: {}, meta: kinds.size === 1 ? { kind: [...kinds][0] } : {} }
}
