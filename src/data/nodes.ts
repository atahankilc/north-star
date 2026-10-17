// Create, edit and delete for every node type. Edges live in edges.ts, matrix cells in comparisons.ts.
import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import { db } from './firebase'
import type { BoardNode, BoardType, Comparison, Competitor, CompetitorFeature, Edge, Feature, Idea, NodeType } from './model'

export const COLLECTIONS = {
  idea: 'ideas',
  group: 'groups',
  feature: 'features',
  competitor: 'competitors',
  competitorFeature: 'competitorFeatures',
} as const satisfies Record<NodeType, string>

type Fields = {
  idea: Idea
  group: never
  feature: Feature
  competitor: Competitor
  competitorFeature: CompetitorFeature
}

const col = (wid: string, name: string) => collection(db(), 'workspaces', wid, name)

export async function createNode<T extends Exclude<NodeType, 'group'>>(
  wid: string,
  type: T,
  fields: Omit<Fields[T], 'createdAt' | 'updatedAt'>,
) {
  const now = Date.now()
  const ref = await addDoc(col(wid, COLLECTIONS[type]), { ...fields, createdAt: now, updatedAt: now })
  return ref.id
}

export function createBoardNode(wid: string, type: BoardType, at: { x: number; y: number }, fields: Partial<BoardNode> = {}) {
  return createNode(wid, type, { title: '', ...fields, x: at.x, y: at.y })
}

// `undefined` clears a field (Firestore rejects undefined values).
export function updateNode<T extends NodeType>(wid: string, type: T, id: string, fields: Partial<Fields[T]>) {
  const data: Record<string, unknown> = { updatedAt: Date.now() }
  for (const [k, v] of Object.entries(fields)) data[k] = v === undefined ? deleteField() : v
  return updateDoc(doc(col(wid, COLLECTIONS[type]), id), data)
}

export function moveNode(wid: string, type: BoardType, id: string, x: number, y: number) {
  return updateDoc(doc(col(wid, COLLECTIONS[type]), id), { x, y })
}

const BATCH_LIMIT = 450

async function deleteAll(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db())
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(ref)
    await batch.commit()
  }
}

// Deletes the node and everything that hangs off it: its edges, a feature's or competitor's
// matrix cells, and a competitor's own features (with their edges). Firestore doesn't cascade.
export async function deleteNode(wid: string, type: NodeType, id: string) {
  const ids = new Set([id])
  const refs: DocumentReference[] = []

  if (type === 'competitor') {
    const features = await getDocs(col(wid, COLLECTIONS.competitorFeature))
    for (const d of features.docs) {
      if ((d.data() as CompetitorFeature).competitorId !== id) continue
      ids.add(d.id)
      refs.push(d.ref)
    }
  }
  if (type === 'feature' || type === 'competitor') {
    const key = type === 'feature' ? 'featureId' : 'competitorId'
    const cells = await getDocs(col(wid, 'comparisons'))
    for (const d of cells.docs) if ((d.data() as Comparison)[key] === id) refs.push(d.ref)
  }
  const edges = await getDocs(col(wid, 'edges'))
  for (const d of edges.docs) {
    const e = d.data() as Edge
    if (ids.has(e.fromId) || ids.has(e.toId)) refs.push(d.ref)
  }

  // The node itself goes last, so a failure part-way leaves it visible to retry.
  await deleteAll(refs)
  await deleteAll([doc(col(wid, COLLECTIONS[type]), id)])
}
