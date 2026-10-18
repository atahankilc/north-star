// Matrix cells: one per (feature, competitor), keyed so concurrent first clicks can't duplicate it.
import { collection, deleteField, doc, setDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { tracked } from './history'
import type { Comparison, Criterion, CriterionScore } from './model'

export const cellId = (featureId: string, competitorId: string) => `${featureId}_${competitorId}`

const cellRef = (wid: string, id: string) => doc(collection(db(), 'workspaces', wid, 'comparisons'), id)

// Creates the cell on first edit. `undefined` clears a field.
export function setCell(
  wid: string,
  featureId: string,
  competitorId: string,
  fields: Partial<Pick<Comparison, 'coverage' | 'notes' | 'competitorFeatureId'>>,
) {
  const data: Record<string, unknown> = { featureId, competitorId, updatedAt: Date.now() }
  for (const [k, v] of Object.entries(fields)) data[k] = v === undefined ? deleteField() : v
  const ref = cellRef(wid, cellId(featureId, competitorId))
  const keys = Object.keys(fields).sort().join(',')
  return tracked('matrix cell', [ref], () => setDoc(ref, data, { merge: true }), { key: `cell:${ref.id}:${keys}` })
}

// One criterion's score in a cell (D-133); `undefined` makes it not assessed again.
export function setScore(wid: string, featureId: string, competitorId: string, criterionId: string, score: CriterionScore | undefined) {
  const ref = cellRef(wid, cellId(featureId, competitorId))
  const data = { featureId, competitorId, updatedAt: Date.now(), criteria: { [criterionId]: score ?? deleteField() } }
  return tracked('criterion score', [ref], () => setDoc(ref, data, { merge: true }))
}

export const newCriterionId = () => Math.random().toString(36).slice(2, 8)

// A feature's criteria, written whole. Scores of the ones removed leave the cells too, in the same undo step.
// Typing in one criterion merges into one step.
export function setCriteria(wid: string, featureId: string, criteria: Criterion[], cells: Comparison[], key?: string) {
  const kept = new Set(criteria.map((c) => c.id))
  const stale = cells.filter((c) => c.featureId === featureId && Object.keys(c.criteria ?? {}).some((id) => !kept.has(id)))
  const featureRef = doc(collection(db(), 'workspaces', wid, 'features'), featureId)
  const refs = [featureRef, ...stale.map((c) => cellRef(wid, cellId(c.featureId, c.competitorId)))]
  return tracked(
    'criteria',
    refs,
    () => {
      const batch = writeBatch(db())
      batch.update(featureRef, { criteria: criteria.length ? criteria : deleteField(), updatedAt: Date.now() })
      for (const c of stale) {
        const gone = Object.keys(c.criteria ?? {}).filter((id) => !kept.has(id))
        batch.update(cellRef(wid, cellId(c.featureId, c.competitorId)), Object.fromEntries(gone.map((id) => [`criteria.${id}`, deleteField()])))
      }
      return batch.commit()
    },
    key ? { key: `criteria:${featureId}:${key}` } : {},
  )
}
