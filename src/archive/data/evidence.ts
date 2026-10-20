// What was learned about a customer, problem or idea (D-137): its own collection, one doc per piece, so people can add
// and edit pieces at once. Every write is one undo step; typing in one field merges.
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { tracked } from './history'
import type { Evidence, Stance, Validation } from './model'

const col = (wid: string) => collection(db(), 'workspaces', wid, 'evidence')

export type EvidenceFields = Omit<Evidence, 'createdAt' | 'updatedAt'>

export function addEvidence(wid: string, fields: EvidenceFields) {
  const ref = doc(col(wid))
  const now = Date.now()
  return tracked('add evidence', [ref], () => setDoc(ref, { ...fields, createdAt: now, updatedAt: now }))
}

// `undefined` clears an optional field.
export function updateEvidence(wid: string, id: string, fields: Partial<Omit<EvidenceFields, 'nodeId' | 'nodeType'>>) {
  const ref = doc(col(wid), id)
  const data: Record<string, unknown> = { updatedAt: Date.now() }
  for (const [k, v] of Object.entries(fields)) data[k] = v === undefined ? deleteField() : v
  const keys = Object.keys(fields).sort().join(',')
  return tracked('edit evidence', [ref], () => updateDoc(ref, data), { key: `evidence:${id}:${keys}` })
}

export function removeEvidence(wid: string, id: string) {
  const ref = doc(col(wid), id)
  return tracked('remove evidence', [ref], () => deleteDoc(ref))
}

// For / against, of what a card has (D-137).
export function tally(list: { stance: Evidence['stance'] }[]) {
  return { supports: list.filter((e) => e.stance === 'supports').length, contradicts: list.filter((e) => e.stance === 'contradicts').length }
}

// When the status and the evidence disagree, in words; null when they don't.
export function mismatch(status: Validation | undefined, list: { stance: Stance }[]): string | null {
  const t = tally(list)
  if (status === 'validated' && t.supports === 0) return 'Validated, but no evidence supports it yet.'
  if (status === 'validated' && t.contradicts > t.supports) return 'Validated, but more evidence contradicts it than supports it.'
  if (status === 'invalidated' && t.contradicts === 0) return 'Invalidated, but no evidence contradicts it.'
  return null
}
