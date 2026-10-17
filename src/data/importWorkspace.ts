// Import (D-080): a bundle becomes a new workspace you own. Every id is new; links, matrix cells and competitor
// features follow their items, and anything pointing at an item that isn't in the file is left out.
import { collection, doc, getDoc, setDoc, writeBatch, type DocumentReference } from 'firebase/firestore'
import {
  cleanAttachment,
  cleanCard,
  cleanComparison,
  cleanCompetitor,
  cleanCompetitorFeature,
  cleanEdge,
  cleanFeature,
  cleanLabel,
  cleanReport,
  type LoadedBundle,
} from '../io/bundle'
import { attachmentsAvailable, uploadImported } from './attachments'
import { db } from './firebase'
import type { NodeType, Workspace } from './model'
import { COLLECTIONS } from './nodes'
import { createWorkspace, deleteWorkspace } from './workspaces'

const BATCH_LIMIT = 450

// `filesLeftOut`: attachments not brought over because files can't be stored here yet (D-083).
export type ImportResult = { workspaceId: string; written: number; skipped: number; filesLeftOut: number }

export async function importWorkspace(bundle: LoadedBundle, uid: string): Promise<ImportResult> {
  const wid = await createWorkspace(bundle.workspace.name, uid, bundle.workspace.description)
  const col = (name: string) => collection(db(), 'workspaces', wid, name)
  const now = Date.now()
  const writes: [DocumentReference, object][] = []
  // Old id → new id and type, for everything that can be linked.
  const ids = new Map<string, { id: string; type: NodeType }>()
  let skipped = 0

  const add = (type: NodeType, oldId: string, fields: object | null) => {
    if (!fields) return skipped++
    const ref = doc(col(COLLECTIONS[type]))
    ids.set(oldId, { id: ref.id, type })
    writes.push([ref, fields])
  }
  for (const d of bundle.customers) add('customer', d.id, cleanCard(d, now))
  for (const d of bundle.problems) add('problem', d.id, cleanCard(d, now))
  for (const d of bundle.ideas) add('idea', d.id, cleanCard(d, now))
  for (const d of bundle.features) add('feature', d.id, cleanFeature(d, now))
  for (const d of bundle.competitors) add('competitor', d.id, cleanCompetitor(d, now))
  for (const d of bundle.competitorFeatures) {
    const owner = ids.get(d.competitorId as string)
    add('competitorFeature', d.id, owner?.type === 'competitor' ? { competitorId: owner.id, ...cleanCompetitorFeature(d, now) } : null)
  }

  for (const d of bundle.labels) {
    const fields = cleanLabel(d, now)
    if (fields) writes.push([doc(col('labels')), fields])
    else skipped++
  }

  const seen = new Set<string>()
  for (const d of bundle.edges) {
    const from = ids.get(d.fromId as string)
    const to = ids.get(d.toId as string)
    const fields = cleanEdge(d)
    const key = from && to && `${from.id}>${to.id}>${fields?.kind}`
    if (!from || !to || !fields || from.id === to.id || seen.has(key as string)) {
      skipped++
      continue
    }
    seen.add(key as string)
    writes.push([doc(col('edges')), { fromId: from.id, fromType: from.type, toId: to.id, toType: to.type, ...fields }])
  }

  for (const d of bundle.comparisons) {
    const feature = ids.get(d.featureId as string)
    const competitor = ids.get(d.competitorId as string)
    if (feature?.type !== 'feature' || competitor?.type !== 'competitor') {
      skipped++
      continue
    }
    const theirs = ids.get(d.competitorFeatureId as string)
    writes.push([
      doc(col('comparisons'), `${feature.id}_${competitor.id}`),
      {
        featureId: feature.id,
        competitorId: competitor.id,
        ...cleanComparison(d, now),
        ...(theirs?.type === 'competitorFeature' && { competitorFeatureId: theirs.id }),
      },
    ])
  }

  // Research reports (D-090): yours now, shared as they were; their items follow, unknown ones are dropped.
  for (const d of bundle.reports ?? []) {
    const fields = cleanReport(d, now)
    if (!fields) {
      skipped++
      continue
    }
    const implications = fields.implications.map((x) => ({ ...x, items: x.items.map((i) => ids.get(i)?.id).filter((i): i is string => !!i) }))
    writes.push([doc(col('reports')), { ...fields, implications, uid }])
  }

  let written = writes.length
  try {
    for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db())
      for (const [ref, fields] of writes.slice(i, i + BATCH_LIMIT)) batch.set(ref, fields)
      await batch.commit()
    }
  } catch (err) {
    // Half a workspace is worse than none: take it away again.
    const ws = await getDoc(doc(db(), 'workspaces', wid)).catch(() => null)
    const code = (ws?.data() as Workspace | undefined)?.inviteCode
    if (code) await deleteWorkspace(wid, code, uid).catch(() => {})
    throw err
  }

  // Attachments last, once their items exist: each file goes up under a new id, then its record. One that fails is
  // left out rather than undoing the whole import.
  const attachments = bundle.attachments ?? []
  let filesLeftOut = 0
  if (!attachmentsAvailable) filesLeftOut = attachments.length
  else {
    for (const d of attachments) {
      const owner = ids.get(d.nodeId as string)
      const fields = cleanAttachment(d, now)
      const bytes = fields && bundle.files[d.file as string]
      if (!owner || !fields || !bytes) {
        skipped++
        continue
      }
      try {
        const { id, data } = await uploadImported(wid, bytes, { ...fields, nodeId: owner.id, nodeType: owner.type, uid })
        await setDoc(doc(col('attachments'), id), data)
        written++
      } catch {
        skipped++
      }
    }
  }
  return { workspaceId: wid, written, skipped, filesLeftOut }
}
