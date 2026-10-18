// Several things on the board at once (D-108): move, delete, tag, copy and paste a selection of cards and text labels,
// each as one undo step (history.ts).
import { doc, collection, writeBatch, type DocumentData, type DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import { absent, snapshotWith, tracked, workspaceDoc } from './history'
import type { BoardType, Edge } from './model'
import { cascadeOf, COLLECTIONS, positionRef } from './nodes'
import { ALL, openPlane, placementRef } from './planes'

// A card (by its type) or a text label.
export type Piece = { kind: BoardType | 'label'; id: string }

const collectionOf = (kind: Piece['kind']) => (kind === 'label' ? 'labels' : COLLECTIONS[kind])
const refOf = (wid: string, p: Piece) => workspaceDoc(wid, collectionOf(p.kind), p.id)
// Where a piece's place on the open plane is (D-139): a label's own doc (it belongs to one plane), a card's per plane.
const placeOf = (wid: string, p: Piece) => (p.kind === 'label' ? refOf(wid, p) : positionRef(wid, p.kind, p.id))
const BATCH_LIMIT = 450

async function commit(writes: [DocumentReference, DocumentData | null, 'set' | 'update'][]) {
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db())
    for (const [ref, data, how] of writes.slice(i, i + BATCH_LIMIT)) {
      if (!data) batch.delete(ref)
      else if (how === 'update') batch.update(ref, data)
      else batch.set(ref, data)
    }
    await batch.commit()
  }
}

// The live stream while dragging several pieces: one batch, so collaborators (and this tab's own snapshot listeners) get
// one update per write, not one per piece. Not undoable on its own, see endMoveMany.
export function streamMany(wid: string, places: (Piece & { to: [number, number] })[]) {
  return commit(places.map((p) => [placeOf(wid, p), { x: p.to[0], y: p.to[1] }, 'update']))
}

// The end of a drag of several pieces: one undo step back to where they all started.
export async function endMoveMany(wid: string, moves: (Piece & { from: [number, number]; to: [number, number] })[]) {
  const refs = moves.map((m) => placeOf(wid, m))
  // The live stream already wrote the new places; what's undone to is where the drag began.
  const before = (await Promise.all(moves.map((m, i) => snapshotWith(refs[i], { x: m.from[0], y: m.from[1] })))).flat()
  return tracked(`move ${moves.length} things`, refs, () => commit(moves.map((m, i) => [refs[i], { x: m.to[0], y: m.to[1] }, 'update'])), { before })
}

// New places for several pieces at once, as one undo step: lining a selection up, spacing it out, nudging it with the
// arrow keys (D-124). Steps with the same `key` (a run of nudges) merge into one.
export function placeMany(wid: string, label: string, places: (Piece & { to: [number, number] })[], key?: string) {
  const refs = places.map((p) => placeOf(wid, p))
  return tracked(label, refs, () => commit(places.map((p, i) => [refs[i], { x: p.to[0], y: p.to[1] }, 'update'])), { key })
}

export async function deleteMany(wid: string, pieces: Piece[]) {
  const own = pieces.map((p) => refOf(wid, p))
  const cascades = await Promise.all(pieces.map((p) => (p.kind === 'label' ? [] : cascadeOf(wid, p.kind, p.id))))
  const seen = new Set(own.map((r) => r.path))
  const hanging: DocumentReference[] = []
  for (const r of cascades.flat()) {
    if (seen.has(r.path)) continue
    seen.add(r.path)
    hanging.push(r)
  }
  // What hangs off them first, the pieces last, like deleteNode.
  return tracked(`delete ${pieces.length} things`, [...hanging, ...own], () => commit([...hanging, ...own].map((r) => [r, null, 'set'])), {
    settle: true,
  })
}

// Adds and removes tags on every card in the selection at once (labels have none).
export function retagMany(wid: string, cards: { kind: BoardType; id: string; tags: string[] }[], add: string[], remove: string[]) {
  const next = (tags: string[]) => [...tags.filter((t) => !remove.includes(t)), ...add.filter((t) => !tags.includes(t))]
  const todo = cards.filter((c) => next(c.tags).join('\u0000') !== c.tags.join('\u0000'))
  const refs = todo.map((c) => refOf(wid, c))
  return tracked(`tag ${todo.length} cards`, refs, () => commit(todo.map((c, i) => [refs[i], { tags: next(c.tags), updatedAt: Date.now() }, 'update'])))
}

// What copy keeps: the documents themselves (so a paste still works after the originals are gone), the links between
// them, and their customer tags.
export type Clip = {
  wid: string
  pieces: { kind: Piece['kind']; id: string; data: DocumentData }[]
  // A copied competitor's own features.
  features: { id: string; data: DocumentData }[]
  edges: Edge[]
}

let clip: Clip | null = null
export const copied = () => clip
export function copy(next: Clip) {
  clip = next
}

// Pastes the clip with its top-left card at `at` (board units), keeping the layout, links among the pasted things and
// customer tags to customers that still exist here. Returns the new ids in the clip's order. On a plane other than All
// (D-139) the cards are placed there at `at` and land on All with their top-left at `allAt`; text stays on the plane.
export async function paste(
  wid: string,
  at: [number, number],
  customers: Set<string>,
  source: Clip | null = clip,
  allAt: [number, number] = at,
): Promise<Piece[]> {
  const plane = openPlane()
  if (!source || source.pieces.length === 0) return []
  const x0 = Math.min(...source.pieces.map((p) => p.data.x as number))
  const y0 = Math.max(...source.pieces.map((p) => p.data.y as number))
  const now = Date.now()
  const ids = new Map<string, string>()
  const writes: [DocumentReference, DocumentData][] = []
  const made: Piece[] = []
  for (const p of source.pieces) {
    const ref = doc(collection(db(), 'workspaces', wid, collectionOf(p.kind)))
    ids.set(p.id, ref.id)
    made.push({ kind: p.kind, id: ref.id })
    const dx = (p.data.x as number) - x0
    const dy = (p.data.y as number) - y0
    if (plane === ALL || p.kind === 'label') {
      const { planeId: _plane, ...data } = p.data
      writes.push([ref, { ...data, ...(plane !== ALL && { planeId: plane }), x: at[0] + dx, y: at[1] + dy, createdAt: now, updatedAt: now }])
    } else {
      writes.push([ref, { ...p.data, x: allAt[0] + dx, y: allAt[1] + dy, createdAt: now, updatedAt: now }])
      writes.push([placementRef(wid, plane, ref.id), { planeId: plane, itemId: ref.id, itemType: p.kind, x: at[0] + dx, y: at[1] + dy }])
    }
  }
  for (const f of source.features) {
    const owner = ids.get(f.data.competitorId as string)
    if (!owner) continue
    const ref = doc(collection(db(), 'workspaces', wid, COLLECTIONS.competitorFeature))
    ids.set(f.id, ref.id)
    writes.push([ref, { ...f.data, competitorId: owner, createdAt: now, updatedAt: now }])
  }
  for (const e of source.edges) {
    const from = ids.get(e.fromId)
    // A tag to a customer that isn't pasted keeps pointing at that customer, if it's in this workspace.
    const to = ids.get(e.toId) ?? (e.kind === 'for' && customers.has(e.toId) ? e.toId : undefined)
    if (!from || !to) continue
    writes.push([doc(collection(db(), 'workspaces', wid, 'edges')), { ...e, fromId: from, toId: to }])
  }
  const refs = writes.map(([r]) => r)
  await tracked(`paste ${made.length} things`, refs, () => commit(writes.map(([r, d]) => [r, d, 'set'])), { before: absent(refs) })
  return made
}
