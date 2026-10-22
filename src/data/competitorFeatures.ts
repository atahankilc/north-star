// A competitor's features (D-038, D-164): the basic cards inside a competitor, listed by category in its panel (D-221).
// Which of ours one matches is the old matrix's comparison doc (`<featureId>_<competitorId>`, its `competitorFeatureId`):
// one of theirs per feature of ours and competitor. Every write is one undo step; typing in one field merges.
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { absent, tracked } from './history'

export const AVAILABILITIES = ['free', 'paid', 'enterprise', 'beta'] as const
export type Availability = (typeof AVAILABILITIES)[number]

export type CompetitorFeature = {
  id: string
  competitorId: string
  name: string
  description?: string
  category?: string
  availability?: Availability
  // Where it was seen.
  url?: string
  createdAt: number
}

export type Comparison = { id: string; featureId: string; competitorId: string; competitorFeatureId?: string }

const col = (wid: string) => collection(db(), 'workspaces', wid, 'competitorFeatures')
const cmp = (wid: string, featureId: string, competitorId: string) => doc(db(), 'workspaces', wid, 'comparisons', `${featureId}_${competitorId}`)

export function addCompetitorFeature(wid: string, competitorId: string, name: string, category?: string) {
  const ref = doc(col(wid))
  const now = Date.now()
  return tracked('add a competitor feature', [ref], () => setDoc(ref, { competitorId, name, ...(category ? { category } : {}), createdAt: now, updatedAt: now }), {
    before: absent([ref]),
  })
}

// `undefined` or `''` clears an optional field (never the name).
export function updateCompetitorFeature(wid: string, id: string, fields: Partial<Omit<CompetitorFeature, 'id' | 'competitorId' | 'createdAt'>>) {
  const ref = doc(col(wid), id)
  const data: Record<string, unknown> = { updatedAt: Date.now() }
  for (const [k, v] of Object.entries(fields)) data[k] = k !== 'name' && (v === undefined || v === '') ? deleteField() : v
  const keys = Object.keys(fields).sort().join(',')
  return tracked('edit a competitor feature', [ref], () => updateDoc(ref, data), { key: `cfeature:${id}:${keys}` })
}

// With the matches that pointed at it.
export function removeCompetitorFeature(wid: string, f: CompetitorFeature, comparisons: Comparison[]) {
  const ref = doc(col(wid), f.id)
  const matched = comparisons.filter((c) => c.competitorFeatureId === f.id).map((c) => cmp(wid, c.featureId, c.competitorId))
  return tracked('remove a competitor feature', [ref, ...matched], () => {
    const batch = writeBatch(db())
    batch.delete(ref)
    matched.forEach((r) => batch.update(r, { competitorFeatureId: deleteField() }))
    return batch.commit()
  })
}

// Which of ours their feature matches: `null` clears it. One of theirs per feature of ours and competitor, so matching
// another feature of theirs to the same one of ours replaces it.
export function matchOurs(wid: string, f: CompetitorFeature, featureId: string | null, comparisons: Comparison[]) {
  const was = comparisons.find((c) => c.competitorFeatureId === f.id)
  const refs = [...(was ? [cmp(wid, was.featureId, was.competitorId)] : []), ...(featureId ? [cmp(wid, featureId, f.competitorId)] : [])]
  return tracked('match a feature', refs, async () => {
    const batch = writeBatch(db())
    if (was && was.featureId !== featureId) batch.update(cmp(wid, was.featureId, was.competitorId), { competitorFeatureId: deleteField() })
    if (featureId) batch.set(cmp(wid, featureId, f.competitorId), { featureId, competitorId: f.competitorId, competitorFeatureId: f.id }, { merge: true })
    await batch.commit()
  })
}

export const removeComparison = (wid: string, c: Comparison) => tracked('unmatch', [cmp(wid, c.featureId, c.competitorId)], () => deleteDoc(cmp(wid, c.featureId, c.competitorId)))
