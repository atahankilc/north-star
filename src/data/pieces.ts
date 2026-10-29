// The workspace's canvas (D-174, D-176): what's placed on it. Planes (D-180), matrices (D-204), tables (D-209), and
// documents (D-232): a list of them, or one on its own; kanbans (D-251).
// Every write is an op (S6, src/ops/pieces.ts) behind the same signature: the canvas shown (this module's global, R1) is
// read here and passed to the op, which never reads it.
import { collection, doc, writeBatch } from 'firebase/firestore'
import { emptySetup, type MatrixSetup } from './matrix'
import { emptyTable, type TableSetup } from './table'
import { docRef, type Doc, type DocumentsSetup } from './documents'
import { emptyKanban, type KanbanSetup } from './tasks'
import { db } from './firebase'
import { GRID, snap } from '../model/grid'
import { tracked } from './history'
import type { Piece, PieceKind } from './model'
import { canvasField, canvasHere, onCanvas, shownHere, type Spot } from './canvases'
import type { Card } from './cards'
import type { Label } from './labels'
import type { Cell } from './matrix'
import type { Edge } from './edges'
import type { Task } from './tasks'
import type { Place } from './places'
import { applyUi, runUi, sayRefused, uiCtx } from '../ops/firestore'
import { createPiece, place, rename as renameOp, updatePiece } from '../ops/pieces'
import { deleteAny } from '../ops/delete'
import { nearClearIn } from '../model/pieceMoves'

const col = (wid: string) => collection(db(), 'workspaces', wid, 'pieces')
export const pieceRef = (wid: string, id: string) => doc(col(wid), id)

// What a piece is lives in src/model/pieces.ts, without Firebase (S3).
export { PIECE_SIZE, PIECE_MIN, KIND_NAME, kindOfPiece, isBare, isLens, sticks, hostKinds, isHost, canOpen, PIECE_NAME_MAX } from '../model/pieces'
import { KIND_NAME, PIECE_MIN, PIECE_SIZE, kindOfPiece } from '../model/pieces'

// Pieces sit on the canvas's 25 px grid (D-182), the step of a plane's `+` marks, so marks of planes side by side line up.
export { GRID, snap }

export type Box = Pick<Piece, 'x' | 'y' | 'w' | 'h'>

// Where a new piece goes (asked 2026-10-22: "direkt baktığım yere koysun … edit modda başlasın"): where it was asked
// for (the middle of the screen), or the nearest clear place round it within about its own size, so it's still in
// view; with none clear there, on top of what's there (it starts in edit mode, to be moved). Steps of the grid, nearest
// first (src/model/pieceMoves.ts' nearClearIn).
// Only what's on the canvas shown is in the way (D-302), or on `canvas` (moved there, D-302's session 2).
export function nearClear(box: Box, all: Box[], canvas = canvasHere()): Pick<Box, 'x' | 'y'> {
  // On the canvas shown, what's drawn there (through spots too, D-307); elsewhere, the list given.
  const here = canvas === canvasHere() ? shownHere() : null
  const others = here ?? (all as (Box & { canvasId?: string; spot?: string })[]).filter((o) => (o.spot ? o.spot === canvas : onCanvas(canvas)(o)))
  return nearClearIn(box, others)
}

// A piece centred on `at` (canvas pixels), or the nearest clear place round it (nearClear): one undo step.
// A matrix starts blank (D-204), a table with every card (D-209), a kanban with tasks (D-251), or from the setup given
// (a kanban's from its wizard, D-268).
// A document piece (D-232) shows `docId`, sized as `size` when given (an image's shape).
// An op (S6: create_piece) on the canvas shown; '' when none was made (refused, or no workspace shown).
export async function addPiece(wid: string, kind: PieceKind, at: [number, number], others: Box[], setup?: MatrixSetup | TableSetup | KanbanSetup, name?: string, docId?: string, size?: { w: number; h: number }) {
  const ctx = uiCtx(wid)
  if (!ctx) return ''
  const { w, h } = size ?? PIECE_SIZE[kind]
  const box = { x: snap(at[0] - w / 2), y: snap(at[1] - h / 2), w, h }
  Object.assign(box, nearClear(box, others))
  const start = kind === 'matrix' ? (setup ?? emptySetup()) : kind === 'table' ? (setup ?? emptyTable()) : kind === 'kanban' ? (setup ?? emptyKanban()) : undefined
  // Only the kinds that always took a name keep one (as before).
  const named = name && (kind === 'matrix' || kind === 'table' || kind === 'documents' || kind === 'kanban') ? { name } : {}
  let plan
  try {
    plan = createPiece(ctx, {
      kind,
      canvas: canvasHere(),
      where: { x: box.x, y: box.y },
      ...(size ? { size } : {}),
      ...named,
      ...(start ? { setup: JSON.parse(JSON.stringify(start)) } : {}),
      ...(kind === 'document' && docId ? { doc: docId } : {}),
    })
  } catch (e) {
    sayRefused(e, `add a ${KIND_NAME[kind]}`)
    return ''
  }
  const id = plan.ids.$new
  const done = await applyUi(wid, ctx, [plan])
  if (!done) return ''
  await done.written
  return id
}

// The end of a move or a resize (D-180): one undo step from the box it started as.
// A plane's move or resize carries what's stuck to it (D-210), `followers` with where each goes: the same undo step.
// An op (S6: pieces.ts' place, as arrange or resize) on the canvas shown: through its spot there when it's shown through
// one (D-302's session 3), its size its own; a follower only moves.
export async function placePiece(wid: string, id: string, from: Box, to: Box, kind: PieceKind = 'plane', followers: { id: string; from: Box; to: Box }[] = []) {
  const what = from.w === to.w && from.h === to.h ? 'move' : 'resize'
  const label = `${what} a ${KIND_NAME[kind]}`
  return runUi(wid, (ctx) => [place(ctx, { id, canvas: canvasHere(), to, followers: followers.map((f) => ({ id: f.id, to: f.to })), label }, what === 'move' ? 'arrange' : 'resize')], { label })
}

// ---- Sticking (D-210): a matrix or a table dropped near a plane's edge sits one grid step out from it and is bound to
// it: it moves with the plane, and what it shows is that plane's cards (a rule set by itself, `auto`, still changeable).
// Pulled away, it lets go and its own rule goes. The geometry is src/model/pieceMoves.ts'.
export { STICK_GAP, stickTarget, touchSide, sideOf, followTo, type Side } from '../model/pieceMoves'

// Linked to a plane, or let go, from its console's dropdown (D-215), where it is: one undo step (S6: update_piece).
export const linkLens = (wid: string, piece: Piece & { id: string }, plane: string | null) => {
  const kind = KIND_NAME[kindOfPiece(piece)]
  return runUi(wid, (ctx) => [updatePiece(ctx, { id: piece.id, stuck_to: plane })], { label: `${plane ? 'stick' : 'unstick'} a ${kind}` })
}

// The end of a matrix's or table's move: stuck to a plane, or let go; one undo step.
// A kanban is stuck and a host at once (D-262): what's stuck to it (`followers`) moves with it, in the same step.
export async function placeLens(wid: string, piece: Piece & { id: string }, _from: Box, to: Box, stuck: string | null, followers: { id: string; from: Box; to: Box }[] = []) {
  const kind = kindOfPiece(piece)
  const what = stuck && stuck !== piece.stuckTo ? 'stick' : !stuck && piece.stuckTo ? 'unstick' : 'move'
  const label = `${what} a ${KIND_NAME[kind]}`
  return runUi(wid, (ctx) => [place(ctx, { id: piece.id, canvas: canvasHere(), to, stuck, followers: followers.map((f) => ({ id: f.id, to: f.to })), label })], { label })
}

// A matrix, a table or documents (D-234) opened onto the canvas, or closed back into its window (D-228): shared, one
// undo step (S6: update_piece framed).
export function openPiece(wid: string, piece: Piece & { id: string }, open: boolean) {
  const kind = kindOfPiece(piece)
  return runUi(wid, (ctx) => [updatePiece(ctx, { id: piece.id, framed: !open })], { label: `${open ? 'open' : 'close'} a ${KIND_NAME[kind]}` })
}

// A document on its own on the canvas (D-232), centred on `at` or the nearest clear place round it (nearClear); shared in the same
// step when it isn't yet (asked first: everyone sees the canvas). An image takes its own shape. One undo step.
// Already shared: an op (S6: create_piece). Shared in the same step: a plain batch, as before (documents aren't an ops
// collection yet).
export async function placeDocument(wid: string, d: Pick<Doc, 'shared' | 'kind' | 'width' | 'height'> & { id: string }, at: [number, number], others: Box[], share: boolean) {
  const base = PIECE_SIZE.document
  const size = d.kind === 'image' && d.width && d.height ? { w: base.w, h: snap(Math.max(PIECE_MIN.h, Math.min(1200, (base.w * d.height) / d.width))) } : base
  const box = { x: snap(at[0] - size.w / 2), y: snap(at[1] - size.h / 2), ...size }
  Object.assign(box, nearClear(box, others))
  if (!share) {
    const ctx = uiCtx(wid)
    if (!ctx) return ''
    let plan
    try {
      plan = createPiece(ctx, { kind: 'document', doc: d.id, canvas: canvasHere(), size, where: { x: box.x, y: box.y } })
    } catch (e) {
      sayRefused(e, 'place a document')
      return ''
    }
    const done = await applyUi(wid, ctx, [plan], { label: 'place a document' })
    if (!done) return ''
    await done.written
    return plan.ids.$new
  }
  const ref = doc(col(wid))
  const now = Date.now()
  const shared = docRef(wid, d.id)
  await tracked('share and place a document', [ref, shared], () => {
    const batch = writeBatch(db())
    batch.set(ref, { kind: 'document', docId: d.id, ...box, ...canvasField(), createdAt: now, updatedAt: now })
    batch.update(shared, { shared: true, updatedAt: now })
    return batch.commit()
  })
  return ref.id
}

// A documents list's setup (D-232): its view, kinds, sort, page size, merged; one undo step (S6: update_piece).
export function setDocumentsSetup(wid: string, piece: Piece & { id: string }, change: Partial<DocumentsSetup>) {
  return runUi(wid, (ctx) => [updatePiece(ctx, { id: piece.id, documents: change })], { label: 'change a documents list' })
}

// Its name (D-179); empty takes it away, so it shows its kind again. Typing merges into one undo step (S6: rename).
export function renamePiece(wid: string, id: string, name: string, kind: PieceKind = 'plane') {
  return runUi(wid, (ctx) => [renameOp(ctx, { id, name })], { label: `rename a ${KIND_NAME[kind]}`, key: `piece-name:${id}` })
}

// The plane, its cards (D-187) and its text (D-188), or the matrix or table and its cells (D-204, D-209), or the kanban
// and its tasks (D-251), as one undo step.
// A plane takes its cards with it, except those also on another plane, which stay there with their links (D-281); the
// places on it go.
// Its spots on other canvases go too (D-302's session 3: deleted everywhere).
// An op (S6: delete, everywhere): what goes with it is read from the workspace (R5); the lists passed are ignored.
export function deletePiece(wid: string, id: string, _cards: Card[], _labels: Label[], _cells: Cell[] = [], kind: PieceKind = 'plane', _edges: Edge[] = [], _tasks: Task[] = [], _places: Place[] = [], _spots: Spot[] = []) {
  const ctx = uiCtx(wid)
  if (!ctx) return Promise.resolve()
  // Gone already (a collaborator deleted it a moment ago): nothing to do.
  if (!ctx.ws.pieces.some((p) => p.id === id)) return Promise.resolve()
  return runUi(wid, (c) => [deleteAny(c, { ids: [id], everywhere: true })], { label: `delete a ${KIND_NAME[kind]}` })
}
