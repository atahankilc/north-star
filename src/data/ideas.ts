import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { useWorkspaceCollection } from './hooks'
import type { Edge, EdgeKind, Idea, NodeType } from './model'

const ideasOf = (wid: string) => collection(db(), 'workspaces', wid, 'ideas')
const edgesOf = (wid: string) => collection(db(), 'workspaces', wid, 'edges')

export function useIdeas(wid: string) {
  return useWorkspaceCollection<Idea>(wid, 'ideas')
}

export function useEdges(wid: string) {
  return useWorkspaceCollection<Edge>(wid, 'edges')
}

export async function createIdea(wid: string, at: { x: number; y: number }, fields: Partial<Idea> = {}) {
  const now = Date.now()
  const idea: Idea = { title: '', x: at.x, y: at.y, createdAt: now, updatedAt: now, ...fields }
  const ref = await addDoc(ideasOf(wid), idea)
  return ref.id
}

// `undefined` clears a field (Firestore rejects undefined values).
export function updateIdea(wid: string, id: string, fields: Partial<Idea>) {
  const data: Record<string, unknown> = { updatedAt: Date.now() }
  for (const [k, v] of Object.entries(fields)) data[k] = v === undefined ? deleteField() : v
  return updateDoc(doc(ideasOf(wid), id), data)
}

export function moveIdea(wid: string, id: string, x: number, y: number) {
  return updateDoc(doc(ideasOf(wid), id), { x, y })
}

// Deletes the idea and every edge touching it, atomically.
export async function deleteIdea(wid: string, id: string) {
  const [from, to] = await Promise.all([
    getDocs(query(edgesOf(wid), where('fromId', '==', id))),
    getDocs(query(edgesOf(wid), where('toId', '==', id))),
  ])
  const batch = writeBatch(db())
  for (const e of [...from.docs, ...to.docs]) batch.delete(e.ref)
  batch.delete(doc(ideasOf(wid), id))
  await batch.commit()
}

export async function createEdge(
  wid: string,
  from: { id: string; type: NodeType },
  to: { id: string; type: NodeType },
  kind: EdgeKind = 'relates',
) {
  const edge: Edge = { fromId: from.id, fromType: from.type, toId: to.id, toType: to.type, kind }
  const ref = await addDoc(edgesOf(wid), edge)
  return ref.id
}

export function updateEdge(wid: string, id: string, fields: Partial<Pick<Edge, 'kind' | 'label'>>) {
  return updateDoc(doc(edgesOf(wid), id), fields)
}

export function deleteEdge(wid: string, id: string) {
  return deleteDoc(doc(edgesOf(wid), id))
}
