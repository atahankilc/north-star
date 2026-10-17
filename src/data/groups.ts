// Groups: labelled frames on the board (Q-012, D-047). Moving one moves what's inside it, as one undo step.
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc, writeBatch, type DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import { absent, snapshotWith, tracked } from './history'
import type { BoardType, Group } from './model'
import { COLLECTIONS } from './nodes'

const groupsOf = (wid: string) => collection(db(), 'workspaces', wid, 'groups')

export async function createGroup(wid: string, fields: Omit<Group, 'createdAt' | 'updatedAt'>) {
  const now = Date.now()
  const ref = doc(groupsOf(wid))
  await tracked('new group', [ref], () => setDoc(ref, { ...fields, createdAt: now, updatedAt: now }), { before: absent([ref]) })
  return ref.id
}

// `undefined` clears a field. Typing in one field merges into one undo step.
export function updateGroup(wid: string, id: string, fields: Partial<Omit<Group, 'createdAt' | 'updatedAt'>>) {
  const data: Record<string, unknown> = { updatedAt: Date.now() }
  for (const [k, v] of Object.entries(fields)) data[k] = v === undefined ? deleteField() : v
  const ref = doc(groupsOf(wid), id)
  const keys = Object.keys(fields).sort().join(',')
  return tracked(keys === 'h,w' || keys === 'h,w,x,y' ? 'resize group' : 'edit group', [ref], () => updateDoc(ref, data), {
    key: `group:${id}:${keys}`,
  })
}

// Deletes the frame only; the cards in it stay where they are.
export function deleteGroup(wid: string, id: string) {
  const ref = doc(groupsOf(wid), id)
  return tracked('delete group', [ref], () => deleteDoc(ref))
}

// Something that moves with a group: a card or a smaller group inside it.
export type Passenger = { type: BoardType | 'group'; id: string; from: [number, number] }

const refOf = (wid: string, p: Pick<Passenger, 'type' | 'id'>): DocumentReference =>
  p.type === 'group' ? doc(groupsOf(wid), p.id) : doc(collection(db(), 'workspaces', wid, COLLECTIONS[p.type]), p.id)

// The live stream while dragging (not undoable on its own, see endGroupMove).
export function moveGroupLive(wid: string, passengers: Passenger[], delta: [number, number]) {
  const batch = writeBatch(db())
  for (const p of passengers) batch.update(refOf(wid, p), { x: p.from[0] + delta[0], y: p.from[1] + delta[1] })
  return batch.commit()
}

// The end of a drag: one undo step for the group and everything that moved with it.
export async function endGroupMove(wid: string, passengers: Passenger[], delta: [number, number]) {
  const refs = passengers.map((p) => refOf(wid, p))
  const before = (await Promise.all(passengers.map((p, i) => snapshotWith(refs[i], { x: p.from[0], y: p.from[1] })))).flat()
  return tracked('move group', refs, () => moveGroupLive(wid, passengers, delta), { before })
}
