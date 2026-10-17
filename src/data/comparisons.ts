// Matrix cells: one per (feature, competitor), keyed so concurrent first clicks can't duplicate it.
import { collection, deleteField, doc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { tracked } from './history'
import type { Comparison } from './model'

export const cellId = (featureId: string, competitorId: string) => `${featureId}_${competitorId}`

// Creates the cell on first edit. `undefined` clears a field.
export function setCell(
  wid: string,
  featureId: string,
  competitorId: string,
  fields: Partial<Pick<Comparison, 'coverage' | 'notes' | 'competitorFeatureId'>>,
) {
  const data: Record<string, unknown> = { featureId, competitorId, updatedAt: Date.now() }
  for (const [k, v] of Object.entries(fields)) data[k] = v === undefined ? deleteField() : v
  const ref = doc(collection(db(), 'workspaces', wid, 'comparisons'), cellId(featureId, competitorId))
  const keys = Object.keys(fields).sort().join(',')
  return tracked('matrix cell', [ref], () => setDoc(ref, data, { merge: true }), { key: `cell:${ref.id}:${keys}` })
}
