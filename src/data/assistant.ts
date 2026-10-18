// Changes the assistant proposed and the user accepted (D-074, D-075), written together as one undo step.
// The assistant never writes on its own: src/ai/ builds these from a proposal only after the user presses apply.
import { collection, deleteField, doc, getDocs, query, where, writeBatch, type DocumentReference, type WriteBatch } from 'firebase/firestore'
import { cellId } from './comparisons'
import { db } from './firebase'
import { snapshotWith, tracked } from './history'
import type { Comparison, Criterion, CriterionScore, Edge, EdgeKind, NodeType } from './model'
import { COLLECTIONS, cascadeOf, nodeRef } from './nodes'
import { placementRef } from './planes'

// An item that exists, or one created earlier in the same set (by its key).
export type ChangeRef = { id: string; type: NodeType } | { key: string; type: NodeType }
// A plane that exists, or one made in the same set (D-142).
export type PlaneRef = { id: string } | { key: string }

export type AssistantWrite =
  // `parent` fills a competitor feature's competitorId.
  | { do: 'create'; key: string; type: NodeType; fields: Record<string, unknown>; parent?: ChangeRef }
  // In an update or a cell, a null field is removed (D-122).
  | { do: 'update'; target: { id: string; type: NodeType }; fields: Record<string, unknown> }
  | { do: 'link'; from: ChangeRef; to: ChangeRef; kind: EdgeKind; label?: string }
  // `theirs`: the competitor feature that matches ours (competitorFeatureId); null removes it, undefined keeps it.
  | { do: 'cell'; feature: ChangeRef; competitor: ChangeRef; fields: Record<string, unknown>; theirs?: ChangeRef | null }
  // With everything that hangs off it, like a delete by hand (nodes.ts cascadeOf).
  | { do: 'delete'; target: { id: string; type: NodeType } }
  | { do: 'unlink'; edgeIds: string[] }
  // Changes to a link that exists (D-108): kind, label (null removes it), direction (fromId/toId swapped).
  | { do: 'edge'; id: string; fields: Record<string, unknown> }
  // Board labels (D-086): a new one (no id), or changes to one; and removing one.
  | { do: 'label'; id?: string; fields: Record<string, unknown> }
  | { do: 'unlabel'; id: string }
  // The workspace's own name and description (D-120); undo puts back only those two (history.ts).
  | { do: 'project'; fields: { name?: string; description?: string } }
  // A feature's criteria (D-133): the new list (undefined keeps it; scores of the ones gone leave its cells) and scores
  // per competitor by criterion id (null: not assessed).
  // A piece of evidence on a card (D-137), new or added in the same set.
  | { do: 'evidence'; on: ChangeRef; fields: Record<string, string> }
  // Planes and packages (D-142): a new plane; a card's place on a plane (made or moved); cards off a plane; a package
  // made (`key`) or changed (`id`), its members and home given by ref.
  | { do: 'plane'; key: string; name: string; order: number }
  | { do: 'placement'; plane: PlaneRef; item: ChangeRef; x: number; y: number }
  | { do: 'unplace'; plane: string; itemIds: string[] }
  | { do: 'package'; key?: string; id?: string; fields: Record<string, unknown>; members?: ChangeRef[]; home?: PlaneRef }
  | { do: 'criteria'; feature: { id: string; type: NodeType }; criteria?: Criterion[]; cells: { competitor: ChangeRef; scores: Record<string, CriterionScore | null>; confidence?: string | null }[] }

const BATCH_LIMIT = 450

// A null field is one to remove.
const removing = (fields: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === null ? deleteField() : v]))

const col = (wid: string, name: string) => collection(db(), 'workspaces', wid, name)

// Resolves with the ids given to new items, by key, once the server has the batch.
export async function applyAssistantChanges(wid: string, writes: AssistantWrite[]): Promise<Record<string, string>> {
  const created = new Map<string, DocumentReference>()
  for (const w of writes) if (w.do === 'create') created.set(w.key, doc(col(wid, COLLECTIONS[w.type])))
  const idOf = (r: ChangeRef) => {
    if ('id' in r) return r.id
    const ref = created.get(r.key)
    if (!ref) throw new Error(`Nothing named ${r.key} in this set`)
    return ref.id
  }

  const planes = new Map<string, DocumentReference>()
  for (const w of writes) if (w.do === 'plane') planes.set(w.key, doc(col(wid, 'planes')))
  const planeOf = (p: PlaneRef) => ('id' in p ? p.id : planes.get(p.key)!.id)
  // New packages get their ids up front too, so links and placements in the same set can point at them.
  for (const w of writes) if (w.do === 'package' && w.key) created.set(w.key, doc(col(wid, 'packages')))

  const now = Date.now()
  // Queued, then committed in batches of BATCH_LIMIT (a big cascade can pass Firestore's 500).
  const ops: ((b: WriteBatch) => void)[] = []
  const fresh: DocumentReference[] = []
  const existing: DocumentReference[] = []
  // Deletes go last, so nothing written above touches a document that's gone.
  const gone: DocumentReference[] = []
  for (const w of writes) {
    if (w.do === 'delete') {
      gone.push(...(await cascadeOf(wid, w.target.type, w.target.id)), nodeRef(wid, w.target.type, w.target.id))
      continue
    }
    if (w.do === 'unlink') {
      gone.push(...w.edgeIds.map((id) => doc(col(wid, 'edges'), id)))
      continue
    }
    if (w.do === 'unlabel') {
      gone.push(doc(col(wid, 'labels'), w.id))
      continue
    }
    if (w.do === 'project') {
      const ref = doc(db(), 'workspaces', wid)
      ops.push((b) => b.update(ref, w.fields))
      existing.push(ref)
      continue
    }
    if (w.do === 'plane') {
      const ref = planes.get(w.key)!
      ops.push((b) => b.set(ref, { name: w.name.slice(0, 80), order: w.order, createdAt: now, updatedAt: now }))
      fresh.push(ref)
      continue
    }
    if (w.do === 'placement') {
      const planeId = planeOf(w.plane)
      const ref = placementRef(wid, planeId, idOf(w.item))
      const data = { planeId, itemId: idOf(w.item), itemType: w.item.type, x: w.x, y: w.y }
      ops.push((b) => b.set(ref, data))
      // Its snapshot before (absent if it wasn't on the plane) undoes it; a new plane's or card's can't exist yet.
      if ('key' in w.plane || 'key' in w.item) fresh.push(ref)
      else existing.push(ref)
      continue
    }
    if (w.do === 'unplace') {
      gone.push(...w.itemIds.map((id) => placementRef(wid, w.plane, id)))
      continue
    }
    if (w.do === 'package') {
      const ref = w.key ? created.get(w.key)! : doc(col(wid, 'packages'), w.id!)
      const data = {
        ...removing(w.fields),
        ...(w.members && { memberIds: w.members.map(idOf) }),
        ...(w.home && { homePlaneId: planeOf(w.home) }),
        updatedAt: now,
      }
      if (w.key) {
        ops.push((b) => b.set(ref, { ...data, createdAt: now }))
        fresh.push(ref)
      } else {
        ops.push((b) => b.update(ref, data))
        existing.push(ref)
      }
      continue
    }
    if (w.do === 'evidence') {
      const ref = doc(col(wid, 'evidence'))
      const on = w.on
      ops.push((b) => b.set(ref, { ...w.fields, nodeId: idOf(on), nodeType: on.type, createdAt: now, updatedAt: now }))
      fresh.push(ref)
      continue
    }
    if (w.do === 'criteria') {
      const featureId = w.feature.id
      if (w.criteria) {
        const ref = doc(col(wid, 'features'), featureId)
        const list = w.criteria
        ops.push((b) => b.update(ref, { criteria: list.length ? list : deleteField(), updatedAt: now }))
        existing.push(ref)
        const kept = new Set(list.map((k) => k.id))
        const cells = await getDocs(query(col(wid, 'comparisons'), where('featureId', '==', featureId)))
        for (const d of cells.docs) {
          const gone = Object.keys((d.data() as Comparison).criteria ?? {}).filter((id) => !kept.has(id))
          if (!gone.length) continue
          ops.push((b) => b.update(d.ref, Object.fromEntries(gone.map((id) => [`criteria.${id}`, deleteField()]))))
          existing.push(d.ref)
        }
      }
      for (const c of w.cells) {
        const competitorId = idOf(c.competitor)
        const ref = doc(col(wid, 'comparisons'), cellId(featureId, competitorId))
        const scores = Object.fromEntries(Object.entries(c.scores).map(([id, v]) => [id, v ?? deleteField()]))
        // How sure (D-136): null clears it, undefined leaves it.
        const sure = c.confidence === undefined ? {} : { confidence: c.confidence ?? deleteField() }
        ops.push((b) => b.set(ref, { featureId, competitorId, criteria: scores, ...sure, updatedAt: now }, { merge: true }))
        if ('key' in c.competitor) fresh.push(ref)
        else existing.push(ref)
      }
      continue
    }
    if (w.do === 'edge') {
      const ref = doc(col(wid, 'edges'), w.id)
      ops.push((b) => b.update(ref, removing(w.fields)))
      existing.push(ref)
      continue
    }
    if (w.do === 'label') {
      if (w.id) {
        const ref = doc(col(wid, 'labels'), w.id)
        ops.push((b) => b.update(ref, { ...removing(w.fields), updatedAt: now }))
        existing.push(ref)
      } else {
        const ref = doc(col(wid, 'labels'))
        ops.push((b) => b.set(ref, { ...w.fields, createdAt: now, updatedAt: now }))
        fresh.push(ref)
      }
      continue
    }
    if (w.do === 'create') {
      const ref = created.get(w.key)!
      const parent = w.parent ? { competitorId: idOf(w.parent) } : {}
      ops.push((b) => b.set(ref, { ...w.fields, ...parent, createdAt: now, updatedAt: now }))
      fresh.push(ref)
    } else if (w.do === 'update') {
      const ref = doc(col(wid, COLLECTIONS[w.target.type]), w.target.id)
      ops.push((b) => b.update(ref, { ...removing(w.fields), updatedAt: now }))
      existing.push(ref)
    } else if (w.do === 'link') {
      const edge: Edge = { fromId: idOf(w.from), fromType: w.from.type, toId: idOf(w.to), toType: w.to.type, kind: w.kind }
      if (w.label) edge.label = w.label
      const ref = doc(col(wid, 'edges'))
      ops.push((b) => b.set(ref, edge))
      fresh.push(ref)
    } else {
      const featureId = idOf(w.feature)
      const competitorId = idOf(w.competitor)
      const ref = doc(col(wid, 'comparisons'), cellId(featureId, competitorId))
      const theirs = w.theirs === undefined ? {} : { competitorFeatureId: w.theirs && idOf(w.theirs) }
      ops.push((b) => b.set(ref, { ...removing({ ...w.fields, ...theirs }), featureId, competitorId, updatedAt: now }, { merge: true }))
      // A cell between two new items can't exist yet; any other might.
      if ('key' in w.feature || 'key' in w.competitor) fresh.push(ref)
      else existing.push(ref)
    }
  }

  // One entry per document, even when two changes touch it (an edge of two deleted cards).
  const seen = new Set(fresh.map((r) => r.path))
  const old: DocumentReference[] = []
  for (const ref of [...existing, ...gone]) {
    if (seen.has(ref.path)) continue
    seen.add(ref.path)
    old.push(ref)
  }
  const dropped = new Set(gone.map((r) => r.path))
  for (const ref of old) if (dropped.has(ref.path)) ops.push((b) => b.delete(ref))

  const before = [...fresh.map((ref) => ({ ref, data: null })), ...(await Promise.all(old.map((ref) => snapshotWith(ref, {})))).flat()]
  const label = `assistant: ${writes.length} change${writes.length === 1 ? '' : 's'}`
  const commit = () => {
    const commits: Promise<void>[] = []
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const b = writeBatch(db())
      for (const op of ops.slice(i, i + BATCH_LIMIT)) op(b)
      commits.push(b.commit())
    }
    return Promise.all(commits)
  }
  await tracked(label, [...fresh, ...old], commit, { before })
  return Object.fromEntries([...created].map(([key, ref]) => [key, ref.id]))
}
