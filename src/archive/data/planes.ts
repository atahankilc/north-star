// Planes (D-139): boards of their own in the workspace, holding the same cards placed where each wants them. All is the
// plane every workspace has: every card is on it, at its own x/y. Another plane holds the cards placed on it
// (`placements/{planeId}_{itemId}`), and its own text and sections (`planeId` on labels).
import { collection, doc, getDocs, query, setDoc, updateDoc, where, writeBatch, type DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import { absent, tracked } from './history'
import type { BoardType, Placement } from './model'

export const ALL = 'all'

const col = (wid: string, name: string) => collection(db(), 'workspaces', wid, name)
export const placementId = (planeId: string, itemId: string) => `${planeId}_${itemId}`
export const placementRef = (wid: string, planeId: string, itemId: string) => doc(col(wid, 'placements'), placementId(planeId, itemId))

// The plane the board has open, which card moves and new things go to. Set by the board; anything else (other views,
// the assistant) writes to All.
let open = ALL
export const openPlane = () => open
export function setOpenPlane(planeId: string) {
  open = planeId
}

export async function createPlane(wid: string, name: string, order: number) {
  const ref = doc(col(wid, 'planes'))
  const now = Date.now()
  await tracked('new plane', [ref], () => setDoc(ref, { name: name.trim().slice(0, 80), order, createdAt: now, updatedAt: now }), { before: absent([ref]) })
  return ref.id
}

export function renamePlane(wid: string, planeId: string, name: string) {
  const ref = doc(col(wid, 'planes'), planeId)
  return tracked('rename plane', [ref], () => updateDoc(ref, { name: name.trim().slice(0, 80), updatedAt: Date.now() }), { key: `plane:${planeId}` })
}

const BATCH_LIMIT = 450

async function commit(writes: [DocumentReference, object | null][]) {
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db())
    for (const [ref, data] of writes.slice(i, i + BATCH_LIMIT)) {
      if (data) batch.set(ref, data)
      else batch.delete(ref)
    }
    await batch.commit()
  }
}

// The plane with its placements, text and sections, as one undo step. Its cards stay (on All, and any other plane).
export async function deletePlane(wid: string, planeId: string) {
  const [places, labels] = await Promise.all([
    getDocs(query(col(wid, 'placements'), where('planeId', '==', planeId))),
    getDocs(query(col(wid, 'labels'), where('planeId', '==', planeId))),
  ])
  const refs = [...places.docs.map((d) => d.ref), ...labels.docs.map((d) => d.ref), doc(col(wid, 'planes'), planeId)]
  return tracked('delete plane', refs, () => commit(refs.map((r) => [r, null])), { settle: true })
}

export type Placed = { id: string; type: BoardType; x: number; y: number }

// Cards onto a plane, at these places: one undo step.
export function place(wid: string, planeId: string, cards: Placed[]) {
  const writes = cards.map((c): [DocumentReference, Placement] => [
    placementRef(wid, planeId, c.id),
    { planeId, itemId: c.id, itemType: c.type, x: c.x, y: c.y },
  ])
  const refs = writes.map(([r]) => r)
  return tracked(`place ${cards.length === 1 ? 'a card' : `${cards.length} cards`}`, refs, () => commit(writes), { before: absent(refs) })
}

// Cards off a plane: they stay everywhere else. One undo step.
export function unplace(wid: string, planeId: string, itemIds: string[]) {
  const refs = itemIds.map((id) => placementRef(wid, planeId, id))
  return tracked(`remove ${itemIds.length === 1 ? 'a card' : `${itemIds.length} cards`} from the plane`, refs, () => commit(refs.map((r) => [r, null])))
}
