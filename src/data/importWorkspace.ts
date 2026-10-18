// Import (D-080): a bundle becomes a new workspace you own. Every id is new; links, matrix cells and competitor
// features follow their items, and anything pointing at an item that isn't in the file is left out.
import { collection, doc, getDoc, setDoc, writeBatch, type DocumentReference } from 'firebase/firestore'
import {
  cleanAttachment,
  cleanCard,
  cleanComparison,
  cleanEvidence,
  cleanPackage,
  cleanPlacement,
  cleanPlane,
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
import { BOARD_TYPES, EVIDENCE_TYPES, MAX_MEMBERS, type NodeType, type Workspace } from './model'
import { placementId } from './planes'
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

  // Planes (D-139) with new ids; their placements and text follow them. Text on a plane that didn't come over goes to All.
  const planeIds = new Map<string, string>()
  for (const d of bundle.planes) {
    const fields = cleanPlane(d, now)
    if (!fields) {
      skipped++
      continue
    }
    const ref = doc(col('planes'))
    planeIds.set(d.id, ref.id)
    writes.push([ref, fields])
  }
  // Packages (D-141) once the cards and planes have new ids: their members and home follow; one without a home is dropped.
  for (const d of bundle.packages) {
    const home = planeIds.get(d.homePlaneId as string)
    const fields = cleanPackage(d, now)
    const members = (Array.isArray(d.memberIds) ? d.memberIds : []).flatMap((m) => {
      const to = ids.get(m as string)
      return to ? [to.id] : []
    })
    add('package', d.id, home && fields ? { ...fields, memberIds: members.slice(0, MAX_MEMBERS), homePlaneId: home } : null)
  }
  for (const d of bundle.placements) {
    const plane = planeIds.get(d.planeId as string)
    const item = ids.get(d.itemId as string)
    const at = cleanPlacement(d)
    if (!plane || !item || !at || !(BOARD_TYPES as readonly string[]).includes(item.type)) {
      skipped++
      continue
    }
    writes.push([doc(col('placements'), placementId(plane, item.id)), { planeId: plane, itemId: item.id, itemType: item.type, ...at }])
  }

  for (const d of bundle.labels) {
    const fields = cleanLabel(d, now)
    const plane = planeIds.get(d.planeId as string)
    if (fields) writes.push([doc(col('labels')), { ...fields, ...(plane && { planeId: plane }) }])
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

  // Evidence (D-137) follows its card; evidence on a card that didn't come over is dropped.
  for (const d of bundle.evidence) {
    const on = ids.get(d.nodeId as string)
    const fields = cleanEvidence(d, now)
    if (!fields || !on || !(EVIDENCE_TYPES as readonly string[]).includes(on.type)) {
      skipped++
      continue
    }
    writes.push([doc(col('evidence')), { nodeId: on.id, nodeType: on.type, ...fields }])
  }

  // Research reports (D-090): yours now, shared as they were; their items follow, unknown ones are dropped.
  for (const d of bundle.reports ?? []) {
    const fields = cleanReport(d, now)
    if (!fields) {
      skipped++
      continue
    }
    const implications = fields.implications.map((x) => ({ ...x, items: x.items.map((i) => ids.get(i)?.id).filter((i): i is string => !!i) }))
    // A summary and its body (D-098); the summary is written first, as the body's rule reads it.
    const { sections, openQuestions, sources, implications: _old, ...meta } = fields
    const ref = doc(col('reports'))
    writes.push([ref, { ...meta, sectionCount: sections.length, sourceCount: sources.length, uid }])
    writes.push([doc(ref, 'content', 'body'), { sections, implications, openQuestions, sources }])
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
