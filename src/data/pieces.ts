// The workspace's canvas (D-174, D-176): what's placed on it. A plane for now (D-180); tables and more later.
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { absent, snapshotWith, tracked } from './history'
import type { Piece, PieceKind } from './model'

const col = (wid: string) => collection(db(), 'workspaces', wid, 'pieces')

// A new plane's size in canvas pixels at zoom 1.
export const PIECE_SIZE: Record<PieceKind, { w: number; h: number }> = {
  plane: { w: 960, h: 600 },
}

// The smallest a piece resizes to (D-180): room for its name and its console. Whole steps of the grid.
export const PIECE_MIN = { w: 325, h: 200 }

// Pieces sit on the canvas's 25 px grid (D-182), the step of a plane's `+` marks, so marks of planes side by side line up.
export const GRID = 25
export const snap = (v: number) => Math.round(v / GRID) * GRID

export const KIND_NAME: Record<PieceKind, string> = { plane: 'plane' }

// firestore.rules' validPiece allows 80.
export const PIECE_NAME_MAX = 80

export type Box = Pick<Piece, 'x' | 'y' | 'w' | 'h'>
const GAP = 3 * GRID
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP

// A piece centred on `at` (canvas pixels), or the nearest place right of it clear of the others: one undo step.
export async function addPiece(wid: string, kind: PieceKind, at: [number, number], others: Box[]) {
  const ref = doc(col(wid))
  const { w, h } = PIECE_SIZE[kind]
  const box = { x: snap(at[0] - w / 2), y: snap(at[1] - h / 2), w, h }
  for (let hit = others.find((o) => overlaps(box, o)); hit; hit = others.find((o) => overlaps(box, o))) box.x = hit.x + hit.w + GAP
  const now = Date.now()
  const data = { kind, ...box, createdAt: now, updatedAt: now }
  await tracked(`add a ${KIND_NAME[kind]}`, [ref], () => setDoc(ref, data), { before: absent([ref]) })
  return ref.id
}

// The end of a move or a resize (D-180): one undo step from the box it started as.
export async function placePiece(wid: string, id: string, from: Box, to: Box) {
  const ref = doc(col(wid), id)
  const before = await snapshotWith(ref, { ...from })
  const what = from.w === to.w && from.h === to.h ? 'move' : 'resize'
  return tracked(`${what} a plane`, [ref], () => updateDoc(ref, { ...to, updatedAt: Date.now() }), { before })
}

// Its name (D-179); empty takes it away, so it shows its kind again. Typing merges into one undo step.
export function renamePiece(wid: string, id: string, name: string) {
  const ref = doc(col(wid), id)
  const value = name.trim().slice(0, PIECE_NAME_MAX)
  return tracked('rename a plane', [ref], () => updateDoc(ref, { name: value || deleteField(), updatedAt: Date.now() }), { key: `piece-name:${id}` })
}

export function deletePiece(wid: string, id: string) {
  const ref = doc(col(wid), id)
  return tracked('delete a plane', [ref], () => deleteDoc(ref))
}
