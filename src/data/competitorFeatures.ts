// A competitor's features (D-038, D-164): the basic cards inside a competitor, listed by category in its panel (D-221).
// Which of ours one matches is the old matrix's comparison doc (`<featureId>_<competitorId>`, its `competitorFeatureId`):
// one of theirs per feature of ours and competitor. Every write is one undo step; typing in one field merges.
import { collection, deleteDoc, deleteField, doc, FieldPath, setDoc, updateDoc, writeBatch, type DocumentReference, type WriteBatch } from 'firebase/firestore'
import { db } from './firebase'
import { tracked } from './history'

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

export type CriterionScore = 'met' | 'part' | 'no'
export const CRITERION_SCORES: CriterionScore[] = ['met', 'part', 'no']

// One feature of ours against one competitor (the old matrix's cell, D-040): which of theirs matches it, and how they do
// on each of its must-haves (D-133; missing = not assessed).
export type Comparison = { id: string; featureId: string; competitorId: string; competitorFeatureId?: string; criteria?: Record<string, CriterionScore> }

const col = (wid: string) => collection(db(), 'workspaces', wid, 'competitorFeatures')
const cmp = (wid: string, featureId: string, competitorId: string) => doc(db(), 'workspaces', wid, 'comparisons', `${featureId}_${competitorId}`)

export type NewCompetitorFeature = Pick<CompetitorFeature, 'name' | 'description' | 'category' | 'availability' | 'url'>

// A new one, whole (D-221: the form shows every field), and which of ours it matches, as one undo step.
export function addCompetitorFeature(wid: string, competitorId: string, fields: NewCompetitorFeature, oursId: string | null = null) {
  const ref = doc(col(wid))
  const now = Date.now()
  const data: Record<string, unknown> = { competitorId, ...fields, createdAt: now, updatedAt: now }
  for (const k of Object.keys(data)) if (data[k] === undefined || data[k] === '') delete data[k]
  const match = oursId ? cmp(wid, oursId, competitorId) : null
  return tracked('add a competitor feature', match ? [ref, match] : [ref], async () => {
    const batch = writeBatch(db())
    batch.set(ref, data)
    if (match) batch.set(match, { featureId: oursId, competitorId, competitorFeatureId: ref.id }, { merge: true })
    await batch.commit()
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

// How a competitor does on one of a feature's must-haves: `null` takes the score away.
export function scoreCriterion(wid: string, featureId: string, competitorId: string, criterionId: string, score: CriterionScore | null) {
  const ref = cmp(wid, featureId, competitorId)
  return tracked('score a must-have', [ref], () =>
    setDoc(ref, { featureId, competitorId, criteria: { [criterionId]: score ?? deleteField() } }, { merge: true }),
  )
}

// A must-have taken off a feature takes its scores from every competitor, in the same undo step (D-133).
export function dropCriterionScores(wid: string, featureId: string, criterionId: string, comparisons: Comparison[], also: { ref: DocumentReference; write: (b: WriteBatch) => void }) {
  const scored = comparisons.filter((c) => c.featureId === featureId && c.criteria && criterionId in c.criteria)
  const refs = scored.map((c) => cmp(wid, c.featureId, c.competitorId))
  return tracked('remove a must-have', [also.ref, ...refs], async () => {
    const batch = writeBatch(db())
    also.write(batch)
    refs.forEach((r) => batch.update(r, new FieldPath('criteria', criterionId), deleteField()))
    await batch.commit()
  })
}

export const removeComparison = (wid: string, c: Comparison) => tracked('unmatch', [cmp(wid, c.featureId, c.competitorId)], () => deleteDoc(cmp(wid, c.featureId, c.competitorId)))
