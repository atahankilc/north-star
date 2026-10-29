// Links between cards (D-059, D-207): the old `edges` collection, as before. A link has no plane of its own: a plane
// draws the links whose two cards are both on it. Every write is one undo step (history.ts).
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc, type DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import { absent, tracked } from './history'
import type { AnyType } from '../model/cards'

// What a link is lives in src/model/edges.ts, without Firebase (S3).
export { FOR, defaultKind, linked, edgesOn } from '../model/edges'
export type { EdgeKind, Edge } from '../model/edges'
import { FOR, type Edge, type EdgeKind } from '../model/edges'

const edgesOf = (wid: string) => collection(db(), 'workspaces', wid, 'edges')
export const edgeRef = (wid: string, id: string): DocumentReference => doc(edgesOf(wid), id)

// Returns the new link's id at once (the write goes on behind), so it can be selected straight away (D-154).
export function createEdge(wid: string, from: { id: string; type: AnyType }, to: { id: string; type: AnyType }, kind: EdgeKind): string {
  const ref = doc(edgesOf(wid))
  void tracked(kind === FOR ? 'tag' : 'link', [ref], () => setDoc(ref, { fromId: from.id, fromType: from.type, toId: to.id, toType: to.type, kind }), {
    before: absent([ref]),
  })
  return ref.id
}

// `undefined` clears the label.
export function updateEdge(wid: string, id: string, fields: { kind?: EdgeKind; label?: string | undefined }) {
  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) data[k] = v === undefined ? deleteField() : v
  return tracked('label' in fields ? 'link label' : 'link type', [edgeRef(wid, id)], () => updateDoc(edgeRef(wid, id), data))
}

// "A solves B" becomes "B solves A".
export function reverseEdge(wid: string, e: Edge) {
  return tracked('reverse link', [edgeRef(wid, e.id)], () =>
    updateDoc(edgeRef(wid, e.id), {
      fromId: e.toId,
      fromType: e.toType,
      toId: e.fromId,
      toType: e.fromType,
    }),
  )
}

export function deleteEdge(wid: string, id: string) {
  return tracked('unlink', [edgeRef(wid, id)], () => deleteDoc(edgeRef(wid, id)))
}
