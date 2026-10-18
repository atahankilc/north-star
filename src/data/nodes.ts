// Create, edit and delete for every node type. Edges live in edges.ts, matrix cells in comparisons.ts.
// Everything here is undoable (history.ts) except the live position stream during a drag.
import {
  collection,
  deleteField,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import { attachmentsAvailable } from './attachments'
import { db } from './firebase'
import { absent, snapshotWith, tracked } from './history'
import type {
  Attachment,
  BoardNode,
  BoardType,
  Comparison,
  Competitor,
  CompetitorFeature,
  Customer,
  Edge,
  Evidence,
  Feature,
  Idea,
  NodeType,
  Problem,
} from './model'

export const COLLECTIONS = {
  customer: 'customers',
  problem: 'problems',
  idea: 'ideas',
  feature: 'features',
  competitor: 'competitors',
  competitorFeature: 'competitorFeatures',
} as const satisfies Record<NodeType, string>

type Fields = {
  customer: Customer
  problem: Problem
  idea: Idea
  feature: Feature
  competitor: Competitor
  competitorFeature: CompetitorFeature
}

const col = (wid: string, name: string) => collection(db(), 'workspaces', wid, name)

export async function createNode<T extends NodeType>(
  wid: string,
  type: T,
  fields: Omit<Fields[T], 'createdAt' | 'updatedAt'>,
) {
  const now = Date.now()
  const ref = doc(col(wid, COLLECTIONS[type]))
  await tracked(`new ${LABELS[type]}`, [ref], () => setDoc(ref, { ...fields, createdAt: now, updatedAt: now }), { before: absent([ref]) })
  return ref.id
}

const LABELS: Record<NodeType, string> = {
  customer: 'customer',
  problem: 'problem',
  idea: 'idea',
  feature: 'feature',
  competitor: 'competitor',
  competitorFeature: 'competitor feature',
}

// A new card on the board. Competitors keep their title as `name`.
export function createBoardNode(
  wid: string,
  type: BoardType,
  at: { x: number; y: number },
  fields: Partial<BoardNode> = {},
) {
  if (type === 'competitor') {
    const { title = '', body: _body, tags: _tags, ...rest } = fields
    return createNode(wid, 'competitor', { ...rest, name: title, x: at.x, y: at.y })
  }
  return createNode(wid, type, { title: '', ...fields, x: at.x, y: at.y } as never)
}

// `undefined` clears a field (Firestore rejects undefined values).
// Typing in one field merges into one undo step.
export function updateNode<T extends NodeType>(wid: string, type: T, id: string, fields: Partial<Fields[T]>) {
  const data: Record<string, unknown> = { updatedAt: Date.now() }
  for (const [k, v] of Object.entries(fields)) data[k] = v === undefined ? deleteField() : v
  const ref = doc(col(wid, COLLECTIONS[type]), id)
  const keys = Object.keys(fields).sort().join(',')
  return tracked(`edit ${LABELS[type]}`, [ref], () => updateDoc(ref, data), { key: `edit:${id}:${keys}` })
}

// The live stream while dragging: not undoable on its own, see endMove.
export function moveNode(wid: string, type: BoardType, id: string, x: number, y: number) {
  return updateDoc(doc(col(wid, COLLECTIONS[type]), id), { x, y })
}

// The end of a drag: one undo step from where the card started.
export async function endMove(wid: string, type: BoardType, id: string, from: [number, number], to: [number, number]) {
  const ref = doc(col(wid, COLLECTIONS[type]), id)
  const before = await snapshotWith(ref, { x: from[0], y: from[1] })
  return tracked(`move ${LABELS[type]}`, [ref], () => updateDoc(ref, { x: to[0], y: to[1] }), { before })
}

const BATCH_LIMIT = 450

async function deleteAll(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db())
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(ref)
    await batch.commit()
  }
}

// Everything that hangs off a node and goes with it: its edges, its evidence (D-137), its attachments (records only; the files stay for undo,
// D-083), a feature's or competitor's matrix cells, and a competitor's own features (with their edges).
// Firestore doesn't cascade. The node itself is not included.
export async function cascadeOf(wid: string, type: NodeType, id: string): Promise<DocumentReference[]> {
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
  // Evidence about it (D-137).
  if (type === 'customer' || type === 'problem' || type === 'idea') {
    const evidence = await getDocs(col(wid, 'evidence'))
    for (const d of evidence.docs) if ((d.data() as Evidence).nodeId === id) refs.push(d.ref)
  }
  if (attachmentsAvailable) {
    const files = await getDocs(col(wid, 'attachments'))
    for (const d of files.docs) if (ids.has((d.data() as Attachment).nodeId)) refs.push(d.ref)
  }
  return refs
}

export const nodeRef = (wid: string, type: NodeType, id: string) => doc(col(wid, COLLECTIONS[type]), id)

// Deletes the node and everything that hangs off it (cascadeOf).
export async function deleteNode(wid: string, type: NodeType, id: string) {
  const refs = await cascadeOf(wid, type, id)
  // The node itself goes last, so a failure part-way leaves it visible to retry.
  const self = nodeRef(wid, type, id)
  await tracked(
    `delete ${LABELS[type]}`,
    [...refs, self],
    async () => {
      await deleteAll(refs)
      await deleteAll([self])
    },
    { settle: true },
  )
}
