// The workspace's canvas (D-174, D-176): what's placed on it. Planes (D-180), matrices (D-204) and tables (D-209); more later.
import { collection, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { cardRef, type Card } from './cards'
import { edgeRef, edgesOn, type Edge } from './edges'
import { labelRef, type Label } from './labels'
import { cellKey, cellRef, emptySetup, type Cell, type MatrixSetup } from './matrix'
import { emptyTable, type TableSetup } from './table'
import { db } from './firebase'
import { GRID, snap } from './grid'
import { absent, snapshotWith, tracked } from './history'
import type { Piece, PieceKind } from './model'

const col = (wid: string) => collection(db(), 'workspaces', wid, 'pieces')
export const pieceRef = (wid: string, id: string) => doc(col(wid), id)

// A new piece's size in canvas pixels at zoom 1.
export const PIECE_SIZE: Record<PieceKind, { w: number; h: number }> = {
  plane: { w: 960, h: 600 },
  matrix: { w: 800, h: 500 },
  table: { w: 800, h: 400 },
}

// The smallest a piece resizes to (D-180): room for its name and its console. Whole steps of the grid.
export const PIECE_MIN = { w: 325, h: 200 }

// Pieces sit on the canvas's 25 px grid (D-182), the step of a plane's `+` marks, so marks of planes side by side line up.
export { GRID, snap }

export const KIND_NAME: Record<PieceKind, string> = { plane: 'plane', matrix: 'matrix', table: 'table' }

// What a piece is; a `board` from before D-180 is a plane.
export const kindOfPiece = (p: Pick<Piece, 'kind'>): PieceKind => (p.kind === 'matrix' || p.kind === 'table' ? p.kind : 'plane')

// Not a plane (D-206, D-209): just its table on the canvas, at its own size, with a focus of its own (no ink, no marks).
export const isBare = (p: Pick<Piece, 'kind'>) => kindOfPiece(p) !== 'plane'

// firestore.rules' validPiece allows 80.
export const PIECE_NAME_MAX = 80

export type Box = Pick<Piece, 'x' | 'y' | 'w' | 'h'>
const GAP = 3 * GRID
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP

// A piece centred on `at` (canvas pixels), or the nearest place right of it clear of the others: one undo step.
// A matrix starts blank (D-204), a table with every card (D-209), or from the setup given.
export async function addPiece(wid: string, kind: PieceKind, at: [number, number], others: Box[], setup?: MatrixSetup | TableSetup, name?: string) {
  const ref = doc(col(wid))
  const { w, h } = PIECE_SIZE[kind]
  const box = { x: snap(at[0] - w / 2), y: snap(at[1] - h / 2), w, h }
  for (let hit = others.find((o) => overlaps(box, o)); hit; hit = others.find((o) => overlaps(box, o))) box.x = hit.x + hit.w + GAP
  const now = Date.now()
  const extra =
    kind === 'matrix'
      ? { matrix: JSON.parse(JSON.stringify(setup ?? emptySetup())), ...(name ? { name } : {}) }
      : kind === 'table'
        ? { table: JSON.parse(JSON.stringify(setup ?? emptyTable())), ...(name ? { name } : {}) }
        : {}
  const data = { kind, ...box, ...extra, createdAt: now, updatedAt: now }
  await tracked(`add a ${KIND_NAME[kind]}`, [ref], () => setDoc(ref, data), { before: absent([ref]) })
  return ref.id
}

// The end of a move or a resize (D-180): one undo step from the box it started as.
export async function placePiece(wid: string, id: string, from: Box, to: Box, kind: PieceKind = 'plane') {
  const ref = doc(col(wid), id)
  const before = await snapshotWith(ref, { ...from })
  const what = from.w === to.w && from.h === to.h ? 'move' : 'resize'
  return tracked(`${what} a ${KIND_NAME[kind]}`, [ref], () => updateDoc(ref, { ...to, updatedAt: Date.now() }), { before })
}

// Its name (D-179); empty takes it away, so it shows its kind again. Typing merges into one undo step.
export function renamePiece(wid: string, id: string, name: string, kind: PieceKind = 'plane') {
  const ref = doc(col(wid), id)
  const value = name.trim().slice(0, PIECE_NAME_MAX)
  return tracked(`rename a ${KIND_NAME[kind]}`, [ref], () => updateDoc(ref, { name: value || deleteField(), updatedAt: Date.now() }), { key: `piece-name:${id}` })
}

// The plane, its cards (D-187) and its text (D-188), or the matrix or table and its cells (D-204, D-209), as one undo step.
export function deletePiece(wid: string, id: string, cards: Card[], labels: Label[], cells: Cell[] = [], kind: PieceKind = 'plane', edges: Edge[] = []) {
  const on = cards.filter((c) => c.pieceId === id)
  const refs = [
    doc(col(wid), id),
    ...on.map((c) => cardRef(wid, c.type, c.id)),
    // Its cards' links (D-207).
    ...edgesOn(edges, new Set(on.map((c) => c.id))).map((e) => edgeRef(wid, e.id)),
    ...labels.filter((l) => l.pieceId === id).map((l) => labelRef(wid, l.id)),
    ...cells.filter((c) => c.matrixId === id).map((c) => cellRef(wid, cellKey(c.matrixId, c.row, c.col))),
  ]
  return tracked(`delete a ${KIND_NAME[kind]}`, refs, async () => {
    // A big matrix has more cells than one batch takes.
    for (let i = 0; i < refs.length; i += 450) {
      const batch = writeBatch(db())
      refs.slice(i, i + 450).forEach((r) => batch.delete(r))
      await batch.commit()
    }
  })
}
