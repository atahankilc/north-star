// Links between any two nodes. Undoable (history.ts).
import { collection, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { absent, tracked } from './history'
import type { Edge, EdgeKind, NodeType } from './model'

const edgesOf = (wid: string) => collection(db(), 'workspaces', wid, 'edges')

export async function createEdge(
  wid: string,
  from: { id: string; type: NodeType },
  to: { id: string; type: NodeType },
  kind: EdgeKind = 'relates',
) {
  const edge: Edge = { fromId: from.id, fromType: from.type, toId: to.id, toType: to.type, kind }
  const ref = doc(edgesOf(wid))
  await tracked(kind === 'for' ? 'tag' : 'link', [ref], () => setDoc(ref, edge), { before: absent([ref]) })
  return ref.id
}

export function updateEdge(wid: string, id: string, fields: Partial<Pick<Edge, 'kind' | 'label'>>) {
  const ref = doc(edgesOf(wid), id)
  return tracked('link type', [ref], () => updateDoc(ref, fields))
}

export function deleteEdge(wid: string, id: string) {
  const ref = doc(edgesOf(wid), id)
  return tracked('unlink', [ref], () => deleteDoc(ref))
}

export function linked(edges: Edge[], a: string, b: string) {
  return edges.some((e) => (e.fromId === a && e.toId === b) || (e.fromId === b && e.toId === a))
}
