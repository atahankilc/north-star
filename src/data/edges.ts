// Links between cards (D-059, D-207): the old `edges` collection, as before. A link has no plane of its own: a plane
// draws the links whose two cards are both on it. Every write is one undo step (history.ts).
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc, type DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import { absent, tracked } from './history'
import type { AnyType } from './cards'

// A customer tag (D-044): item → customer.
export const FOR = 'for'

export type EdgeKind = 'relates' | 'depends-on' | 'contradicts' | 'part-of' | 'inspired-by' | 'solves' | 'competes-with' | typeof FOR | (string & {})

// Bend points (D-155) aren't drawn on planes yet; a link keeps the ones it has.
export type Edge = { id: string; fromId: string; fromType: string; toId: string; toType: string; kind: EdgeKind; label?: string; bends?: { x: number; y: number }[] }

const edgesOf = (wid: string) => collection(db(), 'workspaces', wid, 'edges')
export const edgeRef = (wid: string, id: string): DocumentReference => doc(edgesOf(wid), id)

// The kind a link gets when drawn from one card to another (the old board's defaultKind); changed in its bar.
export function defaultKind(from: AnyType, to: AnyType): EdgeKind {
  if (to === 'customer' && from !== 'customer') return FOR
  if (from === 'idea' && to === 'problem') return 'solves'
  if (from === 'competitor' && (to === 'problem' || to === 'idea')) return 'competes-with'
  if (from === 'feature' && to === 'idea') return 'inspired-by'
  return 'relates'
}

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

// "A solves B" becomes "B solves A"; its bend points the other way round.
export function reverseEdge(wid: string, e: Edge) {
  return tracked('reverse link', [edgeRef(wid, e.id)], () =>
    updateDoc(edgeRef(wid, e.id), {
      fromId: e.toId,
      fromType: e.toType,
      toId: e.fromId,
      toType: e.fromType,
      ...(e.bends ? { bends: [...e.bends].reverse() } : {}),
    }),
  )
}

export function deleteEdge(wid: string, id: string) {
  return tracked('unlink', [edgeRef(wid, id)], () => deleteDoc(edgeRef(wid, id)))
}

export const linked = (edges: Edge[], a: string, b: string) => edges.some((e) => (e.fromId === a && e.toId === b) || (e.fromId === b && e.toId === a))

// The links a card's deletion takes with it.
export const edgesOn = (edges: Edge[], ids: Set<string>) => edges.filter((e) => ids.has(e.fromId) || ids.has(e.toId))
