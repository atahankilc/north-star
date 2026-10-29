// A competitor's features (D-038, D-164): the basic cards inside a competitor, listed by category in its panel (D-221).
// Which of ours one matches is the old matrix's comparison doc (`<featureId>_<competitorId>`, its `competitorFeatureId`):
// one of theirs per feature of ours and competitor. Every write is one undo step; typing in one field merges.
import { deleteField, doc, FieldPath, writeBatch, type DocumentReference, type WriteBatch } from 'firebase/firestore'
import { db } from './firebase'
import { tracked } from './history'
import { present, runUi } from '../ops/firestore'
import { createCompetitorFeature, updateCompetitorFeature as updateFeatureOp } from '../ops/features'
import { deleteThings } from '../ops/cards'

export { AVAILABILITIES, CRITERION_SCORES } from '../model/shapes'
export type { Availability, CriterionScore } from '../model/shapes'
import type { Availability, CriterionScore } from '../model/shapes'

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


// One feature of ours against one competitor (the old matrix's cell, D-040): which of theirs matches it, and how they do
// on each of its must-haves (D-133; missing = not assessed).
export type Comparison = { id: string; featureId: string; competitorId: string; competitorFeatureId?: string; criteria?: Record<string, CriterionScore> }

const cmp = (wid: string, featureId: string, competitorId: string) => doc(db(), 'workspaces', wid, 'comparisons', `${featureId}_${competitorId}`)

export type NewCompetitorFeature = Pick<CompetitorFeature, 'name' | 'description' | 'category' | 'availability' | 'url'>

// Every write but dropCriterionScores is an op (S4, D-312: src/ops/features.ts, delete in src/ops/cards.ts) applied as
// one undo step; resolved once the server has it. The `comparisons` passed are read from the workspace instead and
// kept for the callers.

// A new one, whole (D-221: the form shows every field), and which of ours it matches, as one undo step.
export function addCompetitorFeature(wid: string, competitorId: string, fields: NewCompetitorFeature, oursId: string | null = null) {
  return runUi(wid, (ctx) => [createCompetitorFeature(ctx, { ...fields, competitor: competitorId, ours: oursId })], { label: 'add a competitor feature' })
}

// `undefined` or `''` clears an optional field (never the name).
export function updateCompetitorFeature(wid: string, id: string, fields: Partial<Omit<CompetitorFeature, 'id' | 'competitorId' | 'createdAt'>>) {
  const keys = Object.keys(fields).sort().join(',')
  return runUi(wid, (ctx) => [updateFeatureOp(ctx, { feature: id, fields })], { label: 'edit a competitor feature', key: `cfeature:${id}:${keys}` })
}

// With the matches that pointed at it.
export function removeCompetitorFeature(wid: string, f: CompetitorFeature, _comparisons: Comparison[]) {
  return runUi(wid, (ctx) => [deleteThings(ctx, { ids: present(ctx, [f.id]) })], { label: 'remove a competitor feature' })
}

// Which of ours their feature matches: `null` clears it. One of theirs per feature of ours and competitor, so matching
// another feature of theirs to the same one of ours replaces it.
export function matchOurs(wid: string, f: CompetitorFeature, featureId: string | null, _comparisons: Comparison[]) {
  return runUi(wid, (ctx) => [updateFeatureOp(ctx, { feature: f.id, ours: featureId })], { label: 'match a feature' })
}

// A criterion taken off a feature takes its scores with it, in the same undo step (D-133): its matrix cells (`cells`,
// D-249) and any left on the comparisons from before.
export function dropCriterionScores(wid: string, featureId: string, criterionId: string, comparisons: Comparison[], also: { ref: DocumentReference; write: (b: WriteBatch) => void }, cells: DocumentReference[] = []) {
  const scored = comparisons.filter((c) => c.featureId === featureId && c.criteria && criterionId in c.criteria)
  const refs = scored.map((c) => cmp(wid, c.featureId, c.competitorId))
  return tracked('remove a criterion', [also.ref, ...refs, ...cells], async () => {
    const batch = writeBatch(db())
    also.write(batch)
    refs.forEach((r) => batch.update(r, new FieldPath('criteria', criterionId), deleteField()))
    cells.forEach((r) => batch.delete(r))
    await batch.commit()
  })
}

export const removeComparison = (wid: string, c: Comparison) => runUi(wid, (ctx) => [deleteThings(ctx, { ids: present(ctx, [`${c.featureId}_${c.competitorId}`]) })], { label: 'unmatch' })
