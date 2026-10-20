// The workspace's canvas (D-174, D-176): what's placed on it. A board for now; tables and more later.
import { collection, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { absent, snapshotWith, tracked } from './history'
import type { Piece, PieceKind } from './model'

const col = (wid: string) => collection(db(), 'workspaces', wid, 'pieces')

// A new board's size in canvas pixels at zoom 1.
export const PIECE_SIZE: Record<PieceKind, { w: number; h: number }> = {
  board: { w: 960, h: 600 },
}

const NAMES: Record<PieceKind, string> = { board: 'board' }

type Box = Pick<Piece, 'x' | 'y' | 'w' | 'h'>
const GAP = 80
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP

// A piece centred on `at` (canvas pixels), or the nearest place right of it clear of the others: one undo step.
export async function addPiece(wid: string, kind: PieceKind, at: [number, number], others: Box[]) {
  const ref = doc(col(wid))
  const { w, h } = PIECE_SIZE[kind]
  const box = { x: Math.round(at[0] - w / 2), y: Math.round(at[1] - h / 2), w, h }
  for (let hit = others.find((o) => overlaps(box, o)); hit; hit = others.find((o) => overlaps(box, o))) box.x = hit.x + hit.w + GAP
  const now = Date.now()
  const data = { kind, ...box, createdAt: now, updatedAt: now }
  await tracked(`add a ${NAMES[kind]}`, [ref], () => setDoc(ref, data), { before: absent([ref]) })
  return ref.id
}

// The end of a drag: one undo step from where it started.
export async function movePiece(wid: string, id: string, from: [number, number], to: [number, number]) {
  const ref = doc(col(wid), id)
  const before = await snapshotWith(ref, { x: from[0], y: from[1] })
  return tracked('move a board', [ref], () => updateDoc(ref, { x: to[0], y: to[1], updatedAt: Date.now() }), { before })
}

export function deletePiece(wid: string, id: string) {
  const ref = doc(col(wid), id)
  return tracked('delete a board', [ref], () => deleteDoc(ref))
}
