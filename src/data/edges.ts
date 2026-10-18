// Links between any two nodes. Undoable (history.ts).
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc } from 'firebase/firestore'
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

// `undefined` clears a field (a link's own label).
export function updateEdge(wid: string, id: string, fields: Partial<Pick<Edge, 'kind' | 'label'>>) {
  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) data[k] = v === undefined ? deleteField() : v
  const ref = doc(edgesOf(wid), id)
  return tracked('label' in fields ? 'link label' : 'link type', [ref], () => updateDoc(ref, data))
}

export function deleteEdge(wid: string, id: string) {
  const ref = doc(edgesOf(wid), id)
  return tracked('unlink', [ref], () => deleteDoc(ref))
}

export function linked(edges: Edge[], a: string, b: string) {
  return edges.some((e) => (e.fromId === a && e.toId === b) || (e.fromId === b && e.toId === a))
}

// Turns a link around: "A solves B" becomes "B solves A".
export function reverseEdge(wid: string, id: string, edge: Edge) {
  const ref = doc(edgesOf(wid), id)
  return tracked('reverse link', [ref], () =>
    updateDoc(ref, { fromId: edge.toId, fromType: edge.toType, toId: edge.fromId, toType: edge.fromType }),
  )
}
