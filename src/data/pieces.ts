// The workspace's canvas (D-174, D-176): what's placed on it. Planes (D-180), matrices (D-204), tables (D-209), and
// documents (D-232): a list of them, or one on its own; kanbans (D-251).
import { collection, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { cardRef, type Card } from './cards'
import { planeGoes, runOps, type Place } from './places'
import { edgeRef, edgesOn, type Edge } from './edges'
import { labelRef, type Label } from './labels'
import { cellKey, cellRef, emptySetup, type Cell, type MatrixSetup } from './matrix'
import { emptyTable, type TableSetup } from './table'
import { docRef, emptyDocuments, type Doc, type DocumentsSetup } from './documents'
import { emptyKanban, taskRef, type KanbanSetup, type Task } from './tasks'
import { db } from './firebase'
import { GRID, snap } from './grid'
import { absent, snapshotWith, tracked } from './history'
import type { Piece, PieceKind } from './model'
import { canvasField, canvasHere, onCanvas } from './canvases'

const col = (wid: string) => collection(db(), 'workspaces', wid, 'pieces')
export const pieceRef = (wid: string, id: string) => doc(col(wid), id)

// A new piece's size in canvas pixels at zoom 1.
export const PIECE_SIZE: Record<PieceKind, { w: number; h: number }> = {
  plane: { w: 960, h: 600 },
  matrix: { w: 800, h: 500 },
  table: { w: 800, h: 400 },
  documents: { w: 800, h: 450 },
  document: { w: 650, h: 500 },
  kanban: { w: 900, h: 500 },
  timeline: { w: 1000, h: 420 },
}

// The smallest a piece resizes to (D-180): room for its name and its console. Whole steps of the grid.
export const PIECE_MIN = { w: 325, h: 200 }

// Pieces sit on the canvas's 25 px grid (D-182), the step of a plane's `+` marks, so marks of planes side by side line up.
export { GRID, snap }

export const KIND_NAME: Record<PieceKind, string> = { plane: 'plane', matrix: 'matrix', table: 'table', documents: 'documents', document: 'document', kanban: 'deck', timeline: 'timeline' }

// What a piece is.
const KINDS: PieceKind[] = ['matrix', 'table', 'documents', 'document', 'kanban', 'timeline']
export const kindOfPiece = (p: Pick<Piece, 'kind'>): PieceKind => (KINDS.includes(p.kind) ? p.kind : 'plane')

// Not a plane (D-206, D-209, D-232): just its contents on the canvas, at their own size, with a focus of its own (no
// ink, no marks).
export const isBare = (p: Pick<Piece, 'kind'>) => kindOfPiece(p) !== 'plane'

// A lens on the cards (D-209): a matrix or a table, which sticks to a plane (D-210) and opens onto the canvas (D-228).
export const isLens = (p: Pick<Piece, 'kind'>) => p.kind === 'matrix' || p.kind === 'table'

// What sticks to something (D-210): a lens or a kanban to a plane (D-255), a timeline to a kanban (D-262).
export const sticks = (p: Pick<Piece, 'kind'>) => isLens(p) || p.kind === 'kanban' || p.kind === 'timeline'
// What it sticks to.
export const hostKind = (p: Pick<Piece, 'kind'>): PieceKind | null => (p.kind === 'timeline' ? 'kanban' : sticks(p) ? 'plane' : null)
// What others stick to: a plane, a kanban.
export const isHost = (p: Pick<Piece, 'kind'>) => kindOfPiece(p) === 'plane' || p.kind === 'kanban'

// What can be taken out of its window onto the canvas (D-228): a lens, the documents list, a document (D-234), a kanban
// (D-251), a timeline (D-289).
export const canOpen = (p: Pick<Piece, 'kind'>) => isLens(p) || p.kind === 'documents' || p.kind === 'document' || p.kind === 'kanban' || p.kind === 'timeline'

// firestore.rules' validPiece allows 80.
export const PIECE_NAME_MAX = 80

export type Box = Pick<Piece, 'x' | 'y' | 'w' | 'h'>
const GAP = 3 * GRID
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP

// Where a new piece goes (asked 2026-10-22: "direkt baktığım yere koysun … edit modda başlasın"): where it was asked
// for (the middle of the screen), or the nearest clear place round it within about its own size, so it's still in
// view; with none clear there, on top of what's there (it starts in edit mode, to be moved). Steps of the grid, nearest
// first.
// Only what's on the canvas shown is in the way (D-302).
function nearClear(box: Box, all: Box[]): Pick<Box, 'x' | 'y'> {
  const others = (all as (Box & { canvasId?: string })[]).filter(onCanvas(canvasHere()))
  const free = (b: Box) => !others.some((o) => overlaps(b, o))
  if (free(box)) return { x: box.x, y: box.y }
  const step = 4 * GRID
  const reach = Math.ceil(Math.max(box.w, box.h) / step)
  const tries: [number, number][] = []
  for (let i = -reach; i <= reach; i++) for (let j = -reach; j <= reach; j++) if (i || j) tries.push([i * step, j * step])
  tries.sort((a, b) => Math.hypot(...a) - Math.hypot(...b))
  for (const [dx, dy] of tries) {
    const b = { ...box, x: box.x + dx, y: box.y + dy }
    if (free(b)) return { x: b.x, y: b.y }
  }
  return { x: box.x, y: box.y }
}

// A piece centred on `at` (canvas pixels), or the nearest clear place round it (nearClear): one undo step.
// A matrix starts blank (D-204), a table with every card (D-209), a kanban with tasks (D-251), or from the setup given
// (a kanban's from its wizard, D-268).
// A document piece (D-232) shows `docId`, sized as `size` when given (an image's shape).
export async function addPiece(wid: string, kind: PieceKind, at: [number, number], others: Box[], setup?: MatrixSetup | TableSetup | KanbanSetup, name?: string, docId?: string, size?: { w: number; h: number }) {
  const ref = doc(col(wid))
  const { w, h } = size ?? PIECE_SIZE[kind]
  const box = { x: snap(at[0] - w / 2), y: snap(at[1] - h / 2), w, h }
  Object.assign(box, nearClear(box, others))
  const now = Date.now()
  const extra =
    kind === 'matrix'
      ? { matrix: JSON.parse(JSON.stringify(setup ?? emptySetup())), ...(name ? { name } : {}) }
      : kind === 'table'
        ? { table: JSON.parse(JSON.stringify(setup ?? emptyTable())), ...(name ? { name } : {}) }
        : kind === 'documents'
          ? { documents: emptyDocuments(), ...(name ? { name } : {}) }
          : kind === 'kanban'
            ? { kanban: JSON.parse(JSON.stringify(setup ?? emptyKanban())), ...(name ? { name } : {}) }
          : kind === 'document' && docId
            ? { docId }
            : {}
  const data = { kind, ...box, ...extra, ...canvasField(), createdAt: now, updatedAt: now }
  await tracked(`add a ${KIND_NAME[kind]}`, [ref], () => setDoc(ref, data), { before: absent([ref]) })
  return ref.id
}

// The end of a move or a resize (D-180): one undo step from the box it started as.
// A plane's move or resize carries what's stuck to it (D-210), `followers` with where each goes: the same undo step.
export async function placePiece(wid: string, id: string, from: Box, to: Box, kind: PieceKind = 'plane', followers: { id: string; from: Box; to: Box }[] = []) {
  const ref = doc(col(wid), id)
  const refs = [ref, ...followers.map((f) => doc(col(wid), f.id))]
  // A follower only moves (its size is its own; an open one's shown size isn't even stored, D-228).
  const at = (b: Box) => ({ x: b.x, y: b.y })
  const before = (await Promise.all([snapshotWith(ref, { ...from }), ...followers.map((f, i) => snapshotWith(refs[i + 1], at(f.from)))])).flat()
  const what = from.w === to.w && from.h === to.h ? 'move' : 'resize'
  return tracked(
    `${what} a ${KIND_NAME[kind]}`,
    refs,
    () => {
      const batch = writeBatch(db())
      const now = Date.now()
      batch.update(ref, { ...to, updatedAt: now })
      followers.forEach((f, i) => batch.update(refs[i + 1], { ...at(f.to), updatedAt: now }))
      return batch.commit()
    },
    { before },
  )
}

// ---- Sticking (D-210): a matrix or a table dropped near a plane's edge sits one grid step out from it and is bound to
// it: it moves with the plane, and what it shows is that plane's cards (a rule set by itself, `auto`, still changeable).
// Pulled away, it lets go and its own rule goes.

export type Side = 'left' | 'right' | 'top' | 'bottom'
export const STICK_GAP = GRID

// The plane whose edge `box` is within `reach` of (canvas px), and where it would sit there; its top (or left) edge
// lines up with the plane's when that's near too.
export function stickTarget(box: Box, planes: (Box & { id: string })[], reach: number): { plane: string; box: Box; side: Side } | null {
  let best: { plane: string; box: Box; side: Side; d: number } | null = null
  const near = (a: number, b: number) => Math.abs(a - b) < reach
  for (const p of planes) {
    const alongY = box.y < p.y + p.h && p.y < box.y + box.h
    const alongX = box.x < p.x + p.w && p.x < box.x + box.w
    const y = near(box.y, p.y) ? p.y : box.y
    const x = near(box.x, p.x) ? p.x : box.x
    const options: { side: Side; d: number; at: [number, number] }[] = []
    if (alongY) {
      options.push({ side: 'right', d: Math.abs(box.x - (p.x + p.w + STICK_GAP)), at: [p.x + p.w + STICK_GAP, y] })
      options.push({ side: 'left', d: Math.abs(box.x + box.w - (p.x - STICK_GAP)), at: [p.x - STICK_GAP - box.w, y] })
    }
    if (alongX) {
      options.push({ side: 'bottom', d: Math.abs(box.y - (p.y + p.h + STICK_GAP)), at: [x, p.y + p.h + STICK_GAP] })
      options.push({ side: 'top', d: Math.abs(box.y + box.h - (p.y - STICK_GAP)), at: [x, p.y - STICK_GAP - box.h] })
    }
    for (const o of options)
      if (o.d < reach && (!best || o.d < best.d)) best = { plane: p.id, side: o.side, d: o.d, box: { ...box, x: o.at[0], y: o.at[1] } }
  }
  return best && { plane: best.plane, box: best.box, side: best.side }
}

// The side of `plane` a piece touches (D-215): one grid step out from that edge and alongside it; null when it's apart.
export function touchSide(box: Box, plane: Box): Side | null {
  const side = sideOf(box, plane)
  const gap = side === 'right' ? box.x - (plane.x + plane.w) : side === 'left' ? plane.x - (box.x + box.w) : side === 'bottom' ? box.y - (plane.y + plane.h) : plane.y - (box.y + box.h)
  const along = side === 'right' || side === 'left' ? box.y < plane.y + plane.h && plane.y < box.y + box.h : box.x < plane.x + plane.w && plane.x < box.x + box.w
  return along && Math.abs(gap - STICK_GAP) <= 1 ? side : null
}

// Which side of `plane` a stuck piece sits on.
export function sideOf(box: Box, plane: Box): Side {
  const gaps: [Side, number][] = [
    ['right', box.x - (plane.x + plane.w)],
    ['left', plane.x - (box.x + box.w)],
    ['bottom', box.y - (plane.y + plane.h)],
    ['top', plane.y - (box.y + box.h)],
  ]
  return gaps.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
}

// Where a piece stuck on `side` goes when its plane becomes `to`: kept on that edge, its place along it moved with the
// plane's matching corner.
export function followTo(box: Box, side: Side, from: Box, to: Box): Box {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (side === 'right') return { ...box, x: to.x + to.w + STICK_GAP, y: box.y + dy }
  if (side === 'left') return { ...box, x: to.x - STICK_GAP - box.w, y: box.y + dy }
  if (side === 'bottom') return { ...box, x: box.x + dx, y: to.y + to.h + STICK_GAP }
  return { ...box, x: box.x + dx, y: to.y - STICK_GAP - box.h }
}

// What a piece shows, bound to a plane or let go: a table's own plane rule (first), a matrix's typed axes' plane.
function boundTo(piece: Piece, plane: string | null): Record<string, unknown> {
  const was = piece.stuckTo ?? null
  if (piece.kind === 'table' && piece.table) {
    const rules = piece.table.rows.rules.filter((r) => !r.auto)
    return { 'table.rows.rules': plane ? [{ field: 'plane', values: [plane], auto: true }, ...rules] : rules }
  }
  if (piece.kind === 'matrix' && piece.matrix) {
    const out: Record<string, unknown> = {}
    for (const which of ['rows', 'cols'] as const) {
      const a = piece.matrix[which]
      if (!a.type) continue
      // Only a plane it had from being stuck, or none: one picked by hand stays.
      if (plane && (!a.plane || a.plane === was)) out[`matrix.${which}.plane`] = plane
      if (!plane && was && a.plane === was) out[`matrix.${which}.plane`] = deleteField()
    }
    return out
  }
  return {}
}

// Linked to a plane, or let go, from its console's dropdown (D-215), where it is: one undo step.
export const linkLens = (wid: string, piece: Piece & { id: string }, plane: string | null) => placeLens(wid, piece, piece, piece, plane)

// The end of a matrix's or table's move: stuck to a plane, or let go; one undo step.
// A kanban is stuck and a host at once (D-262): what's stuck to it (`followers`) moves with it, in the same step.
export async function placeLens(wid: string, piece: Piece & { id: string }, from: Box, to: Box, stuck: string | null, followers: { id: string; from: Box; to: Box }[] = []) {
  const ref = doc(col(wid), piece.id)
  const refs = [ref, ...followers.map((f) => doc(col(wid), f.id))]
  const at = (b: Box) => ({ x: b.x, y: b.y })
  const before = (await Promise.all([snapshotWith(ref, { ...from }), ...followers.map((f, i) => snapshotWith(refs[i + 1], at(f.from)))])).flat()
  const kind = kindOfPiece(piece)
  const change = stuck === (piece.stuckTo ?? null) ? {} : { stuckTo: stuck ?? deleteField(), ...boundTo(piece, stuck) }
  const what = stuck && stuck !== piece.stuckTo ? 'stick' : !stuck && piece.stuckTo ? 'unstick' : 'move'
  return tracked(
    `${what} a ${KIND_NAME[kind]}`,
    refs,
    () => {
      const batch = writeBatch(db())
      const now = Date.now()
      batch.update(ref, { ...to, ...change, updatedAt: now })
      followers.forEach((f, i) => batch.update(refs[i + 1], { ...at(f.to), updatedAt: now }))
      return batch.commit()
    },
    { before },
  )
}

// A matrix, a table or documents (D-234) opened onto the canvas, or closed back into its window (D-228): shared, one undo step.
export function openPiece(wid: string, piece: Piece & { id: string }, open: boolean) {
  const ref = doc(col(wid), piece.id)
  const kind = kindOfPiece(piece)
  return tracked(`${open ? 'open' : 'close'} a ${KIND_NAME[kind]}`, [ref], () => updateDoc(ref, { open: open || deleteField(), updatedAt: Date.now() }))
}

// A document on its own on the canvas (D-232), centred on `at` or the nearest clear place round it (nearClear); shared in the same
// step when it isn't yet (asked first: everyone sees the canvas). An image takes its own shape. One undo step.
export async function placeDocument(wid: string, d: Pick<Doc, 'shared' | 'kind' | 'width' | 'height'> & { id: string }, at: [number, number], others: Box[], share: boolean) {
  const ref = doc(col(wid))
  const base = PIECE_SIZE.document
  const size = d.kind === 'image' && d.width && d.height ? { w: base.w, h: snap(Math.max(PIECE_MIN.h, Math.min(1200, (base.w * d.height) / d.width))) } : base
  const box = { x: snap(at[0] - size.w / 2), y: snap(at[1] - size.h / 2), ...size }
  Object.assign(box, nearClear(box, others))
  const now = Date.now()
  const shared = docRef(wid, d.id)
  await tracked(share ? 'share and place a document' : 'place a document', share ? [ref, shared] : [ref], () => {
    const batch = writeBatch(db())
    batch.set(ref, { kind: 'document', docId: d.id, ...box, ...canvasField(), createdAt: now, updatedAt: now })
    if (share) batch.update(shared, { shared: true, updatedAt: now })
    return batch.commit()
  })
  return ref.id
}

// A documents list's setup (D-232): its view, kinds, sort, page size, merged; one undo step.
export function setDocumentsSetup(wid: string, piece: Piece & { id: string }, change: Partial<DocumentsSetup>) {
  const ref = doc(col(wid), piece.id)
  const next = { ...(piece.documents ?? emptyDocuments()), ...change }
  for (const k of Object.keys(next) as (keyof DocumentsSetup)[]) if (next[k] === undefined) delete next[k]
  return tracked('change a documents list', [ref], () => updateDoc(ref, { documents: next, updatedAt: Date.now() }))
}

// Its name (D-179); empty takes it away, so it shows its kind again. Typing merges into one undo step.
export function renamePiece(wid: string, id: string, name: string, kind: PieceKind = 'plane') {
  const ref = doc(col(wid), id)
  const value = name.trim().slice(0, PIECE_NAME_MAX)
  return tracked(`rename a ${KIND_NAME[kind]}`, [ref], () => updateDoc(ref, { name: value || deleteField(), updatedAt: Date.now() }), { key: `piece-name:${id}` })
}

// The plane, its cards (D-187) and its text (D-188), or the matrix or table and its cells (D-204, D-209), or the kanban
// and its tasks (D-251), as one undo step.
// A plane takes its cards with it, except those also on another plane, which stay there with their links (D-281); the
// places on it go.
export function deletePiece(wid: string, id: string, cards: Card[], labels: Label[], cells: Cell[] = [], kind: PieceKind = 'plane', edges: Edge[] = [], tasks: Task[] = [], places: Place[] = []) {
  const kept = planeGoes(wid, id, cards, places)
  const on = cards.filter((c) => c.pieceId === id && !kept.stay.has(c.id))
  const gone = [
    doc(col(wid), id),
    ...on.map((c) => cardRef(wid, c.type, c.id)),
    // Its cards' links (D-207).
    ...edgesOn(edges, new Set(on.map((c) => c.id))).map((e) => edgeRef(wid, e.id)),
    ...labels.filter((l) => l.pieceId === id).map((l) => labelRef(wid, l.id)),
    ...cells.filter((c) => c.matrixId === id).map((c) => cellRef(wid, cellKey(c.matrixId, c.row, c.col))),
    ...tasks.filter((t) => t.pieceId === id).map((t) => taskRef(wid, t.id)),
  ]
  // A big matrix has more cells than one batch takes.
  const ops = [...gone.map((ref) => ({ ref, data: null })), ...kept.ops]
  return tracked(`delete a ${KIND_NAME[kind]}`, ops.map((o) => o.ref), runOps(ops))
}
