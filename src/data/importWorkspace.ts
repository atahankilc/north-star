// Import (D-080, D-246): a bundle becomes a new workspace you own. Every id is new, and everything that points at
// something follows it: cards their plane, text its space, links and evidence their cards, a package its members, a
// matrix or a table its planes, cards and cells, a document piece its document, a card's other planes (D-281). Anything pointing at something that isn't
// in the file is left out (a card on a plane that didn't come over, a link to a card that didn't). Not undoable: it's a
// new workspace; if a write fails, the half-made workspace is deleted.
import { collection, doc, getDoc, writeBatch, type DocumentReference } from 'firebase/firestore'
import {
  cleanCard,
  cleanCell,
  cleanComparison,
  cleanCompetitorFeature,
  cleanDocument,
  cleanEdge,
  cleanEvidence,
  cleanLabel,
  cleanPiece,
  cleanPlace,
  cleanTask,
  type Bundle,
  type Ids,
} from '../io/bundle'
import { ALL_TYPES, CARD_COLLECTION, type AnyType } from './cards'
import { CANVAS } from './labels'
import { SUB, subKey } from './matrix'
import { db } from './firebase'
import type { Workspace } from './model'
import { createWorkspace, deleteWorkspace } from './workspaces'

// A batch takes 500 writes and about 10 MB; cards and notes can be long, so batches are cut by size too.
const BATCH_WRITES = 450
const BATCH_BYTES = 4_000_000
// A document's content rule reads its summary (getAfter), and a batch's rules may read at most 20 documents.
const DOCUMENTS_PER_BATCH = 6

// `skipped`: docs left out (broken, or pointing at what didn't come over).
export type ImportResult = { workspaceId: string; written: number; skipped: number }

type Write = [DocumentReference, object]

export async function importWorkspace(bundle: Bundle, uid: string, name: string): Promise<ImportResult> {
  const wid = await createWorkspace(bundle.workspace.name, uid, bundle.workspace.description)
  const col = (c: string) => collection(db(), 'workspaces', wid, c)
  const now = Date.now()
  const writes: Write[] = []
  const docWrites: Write[][] = []
  let skipped = 0

  // New ids first, for everything that can be pointed at: pieces, cards (and competitor features), documents.
  const pieceIds = new Map(bundle.pieces.map((p) => [p.id, doc(col('pieces')).id]))
  const cardIds = new Map<string, { id: string; type: AnyType | 'competitorFeature' }>()
  for (const type of ALL_TYPES) for (const d of bundle[CARD_COLLECTION[type] as 'customers']) cardIds.set(d.id, { id: doc(col(CARD_COLLECTION[type])).id, type })
  for (const d of bundle.competitorFeatures) cardIds.set(d.id, { id: doc(col('competitorFeatures')).id, type: 'competitorFeature' })
  const docIds = new Map(bundle.documents.map((d) => [d.id, doc(col('documents')).id]))
  const key = (v: unknown) => (typeof v === 'string' ? v : '')
  const ids: Ids = {
    card: (v) => cardIds.get(key(v)),
    piece: (v) => pieceIds.get(key(v)),
    doc: (v) => docIds.get(key(v)),
  }

  const put = (ref: DocumentReference, fields: object | null) => (fields ? writes.push([ref, fields]) : skipped++)

  // Kept by old id: a kanban's tasks go into the columns written (D-251).
  const cleanPieces = new Map(bundle.pieces.map((d) => [d.id, cleanPiece(d, now, ids)]))
  for (const d of bundle.pieces) put(doc(col('pieces'), pieceIds.get(d.id)!), cleanPieces.get(d.id) ?? null)

  // Cards written, with their home: a place needs its card here, on another plane than that.
  const homes = new Map<string, string>()
  for (const type of ALL_TYPES) {
    for (const d of bundle[CARD_COLLECTION[type] as 'customers']) {
      // On a plane that came over (D-187).
      const fields = cleanCard(type, d, now)
      const on = ids.piece(d.pieceId)
      if (!fields || !on) {
        skipped++
        continue
      }
      // A package's members (D-239) that came over.
      const members = type === 'package' && { memberIds: (Array.isArray(d.memberIds) ? d.memberIds : []).flatMap((m) => ids.card(m)?.id ?? []).slice(0, 60) }
      writes.push([doc(col(CARD_COLLECTION[type]), cardIds.get(d.id)!.id), { ...fields, pieceId: on, ...members }])
      homes.set(cardIds.get(d.id)!.id, on)
    }
  }

  // The other planes a card is on (D-281): a plane that came over, not its home; once per plane. The id is fixed by the two.
  const placed = new Set<string>()
  for (const d of bundle.places) {
    const card = ids.card(d.cardId)
    const plane = ids.piece(d.planeId)
    const fields = cleanPlace(d, now)
    const id = `${plane}_${card?.id}`
    const ok = card && card.type !== 'competitorFeature' && plane && homes.has(card.id) && homes.get(card.id) !== plane
    if (!ok || !fields || cleanPieces.get(d.planeId as string)?.kind !== 'plane' || placed.has(id)) {
      skipped++
      continue
    }
    placed.add(id)
    writes.push([doc(col('places'), id), { planeId: plane, cardId: card.id, type: card.type, ...fields }])
  }

  for (const d of bundle.competitorFeatures) {
    const owner = ids.card(d.competitorId)
    put(doc(col('competitorFeatures'), cardIds.get(d.id)!.id), owner?.type === 'competitor' ? { competitorId: owner.id, ...cleanCompetitorFeature(d, now) } : null)
  }

  // One per feature of ours and competitor, its id fixed by the two.
  const compared = new Set<string>()
  for (const d of bundle.comparisons) {
    const feature = ids.card(d.featureId)
    const competitor = ids.card(d.competitorId)
    const id = `${feature?.id}_${competitor?.id}`
    if (feature?.type !== 'feature' || competitor?.type !== 'competitor' || compared.has(id)) {
      skipped++
      continue
    }
    compared.add(id)
    const theirs = ids.card(d.competitorFeatureId)
    writes.push([
      doc(col('comparisons'), id),
      { featureId: feature.id, competitorId: competitor.id, ...cleanComparison(d, now), ...(theirs?.type === 'competitorFeature' && { competitorFeatureId: theirs.id }) },
    ])
  }

  // Links: both ends came over; no link to itself, no exact twin.
  const linked = new Set<string>()
  for (const d of bundle.edges) {
    const from = ids.card(d.fromId)
    const to = ids.card(d.toId)
    const fields = cleanEdge(d)
    const twin = `${from?.id}>${to?.id}>${fields?.kind}>${fields?.label ?? ''}`
    if (!from || !to || !fields || from.id === to.id || linked.has(twin)) {
      skipped++
      continue
    }
    linked.add(twin)
    writes.push([doc(col('edges')), { fromId: from.id, fromType: from.type, toId: to.id, toType: to.type, ...fields }])
  }

  // Evidence (D-137) on a customer, problem or idea.
  for (const d of bundle.evidence) {
    const on = ids.card(d.nodeId)
    const fields = cleanEvidence(d, now)
    const ok = on && (on.type === 'customer' || on.type === 'problem' || on.type === 'idea')
    put(doc(col('evidence')), ok && fields ? { nodeId: on.id, nodeType: on.type, ...fields } : null)
  }

  // Text (D-188): on the canvas, or on a plane that came over.
  for (const d of bundle.labels) {
    const fields = cleanLabel(d, now)
    const on = d.pieceId === CANVAS ? CANVAS : ids.piece(d.pieceId)
    put(doc(col('labels')), fields && on ? { ...fields, pieceId: on } : null)
  }

  // A matrix's or a table's cells (D-204, D-209): its piece came over; a row or column that's a card takes the card's new
  // id, a typed one keeps its own. The id is fixed by the three.
  const celled = new Set<string>()
  for (const d of bundle.cells) {
    const matrix = ids.piece(d.matrixId)
    // What a card unfolded into, `card~criterion` (D-249): the card's new id, the criterion's kept.
    const one = (v: string) => {
      const [card, sub] = v.split(SUB)
      return sub === undefined ? (ids.card(v)?.id ?? v) : subKey(ids.card(card)?.id ?? card, sub)
    }
    const at = (v: unknown) => (typeof v === 'string' && v && v.length <= 128 && !v.includes('/') ? one(v) : undefined)
    const row = at(d.row)
    const column = at(d.col)
    const id = `${matrix}_${row}_${column}`
    if (!matrix || !row || !column || celled.has(id)) {
      skipped++
      continue
    }
    celled.add(id)
    writes.push([doc(col('cells'), id), { matrixId: matrix, row, col: column, ...cleanCell(d, now) }])
  }

  // A kanban's tasks (D-251): their kanban came over, in one of its columns (else its first); the card they're for when
  // it came over too.
  for (const d of bundle.tasks) {
    const on = ids.piece(d.pieceId)
    const fields = cleanTask(d, now)
    const cols = cleanPieces.get(typeof d.pieceId === 'string' ? d.pieceId : '')?.kanban?.cols ?? []
    if (!on || !fields || !cols.length) {
      skipped++
      continue
    }
    const column = cols.some((c) => c.id === d.col) ? (d.col as string) : cols[0].id
    const card = ids.card(d.cardId)
    writes.push([doc(col('tasks')), { ...fields, pieceId: on, col: column, uid, ...(card && card.type !== 'competitorFeature' && { cardId: card.id, cardType: card.type }) }])
  }

  // Documents (D-232): yours now, shared as they were, under the name of whoever added them. The summary first, as its
  // content's rule reads it.
  for (const d of bundle.documents) {
    const clean = cleanDocument(d, now, ids)
    if (!clean) {
      skipped++
      continue
    }
    const ref = doc(col('documents'), docIds.get(d.id)!)
    docWrites.push([
      [ref, { ...clean.summary, uid, name: clean.summary.name ?? name }],
      [doc(ref, 'content', 'body'), clean.body],
    ])
  }

  try {
    await commit(writes)
    for (let i = 0; i < docWrites.length; i += DOCUMENTS_PER_BATCH) await commit(docWrites.slice(i, i + DOCUMENTS_PER_BATCH).flat())
  } catch (err) {
    // Half a workspace is worse than none: take it away again.
    const ws = await getDoc(doc(db(), 'workspaces', wid)).catch(() => null)
    const code = (ws?.data() as Workspace | undefined)?.inviteCode
    if (code) await deleteWorkspace(wid, code, uid).catch(() => {})
    throw err
  }
  return { workspaceId: wid, written: writes.length + docWrites.length, skipped }
}

// In batches, cut at BATCH_WRITES writes or about BATCH_BYTES of data.
async function commit(writes: Write[]) {
  let batch = writeBatch(db())
  let n = 0
  let size = 0
  for (const [ref, fields] of writes) {
    const bytes = JSON.stringify(fields).length
    if (n && (n >= BATCH_WRITES || size + bytes > BATCH_BYTES)) {
      await batch.commit()
      batch = writeBatch(db())
      n = 0
      size = 0
    }
    batch.set(ref, fields)
    n++
    size += bytes
  }
  if (n) await batch.commit()
}
