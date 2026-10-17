import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { Edge, EdgeKind, NodeType } from './model'

const edgesOf = (wid: string) => collection(db(), 'workspaces', wid, 'edges')

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

export function linked(edges: Edge[], a: string, b: string) {
  return edges.some((e) => (e.fromId === a && e.toId === b) || (e.fromId === b && e.toId === a))
}
