// What was learned about a customer, problem or idea (D-137): its own collection, one doc per piece, so people can add
// and edit pieces at once. Every write is one undo step; typing in one field merges.
import type { Validation } from './cards'
import { present, runUi } from '../ops/firestore'
import { createEvidence, updateEvidence as updateEvidenceOp } from '../ops/evidence'
import { deleteThings } from '../ops/cards'

export { EVIDENCE_KINDS } from '../model/shapes'
export type { EvidenceKind } from '../model/shapes'
import type { EvidenceKind } from '../model/shapes'
export type Stance = 'supports' | 'contradicts'

export type Evidence = {
  id: string
  nodeId: string
  nodeType: 'customer' | 'problem' | 'idea'
  kind: EvidenceKind
  // What was learned, in a sentence or a quote.
  text: string
  stance: Stance
  // Who or where it came from ("Anna, café owner").
  source?: string
  url?: string
  // When it was learned, `YYYY-MM-DD`.
  date?: string
  createdAt: number
}

// Every write is an op (S4, D-312: src/ops/evidence.ts) applied as one undo step; resolved once the server has it.
export function addEvidence(wid: string, fields: Omit<Evidence, 'id' | 'createdAt'>) {
  const { nodeId, nodeType: _, ...rest } = fields
  return runUi(wid, (ctx) => [createEvidence(ctx, { ...rest, card: nodeId })], { label: 'add evidence' })
}

// `undefined` clears an optional field.
export function updateEvidence(wid: string, id: string, fields: Partial<Omit<Evidence, 'id' | 'nodeId' | 'nodeType' | 'createdAt'>>) {
  const keys = Object.keys(fields).sort().join(',')
  return runUi(wid, (ctx) => [updateEvidenceOp(ctx, { evidence: id, fields })], { label: 'edit evidence', key: `evidence:${id}:${keys}` })
}

export function removeEvidence(wid: string, id: string) {
  return runUi(wid, (ctx) => [deleteThings(ctx, { ids: present(ctx, [id]) })], { label: 'remove evidence' })
}

// For / against, of what a card has.
export const tally = (list: { stance: Stance }[]) => ({
  supports: list.filter((e) => e.stance === 'supports').length,
  contradicts: list.filter((e) => e.stance === 'contradicts').length,
})

// When the status and the evidence disagree, in words; null when they don't.
export function mismatch(status: Validation | undefined, list: { stance: Stance }[]): string | null {
  const t = tally(list)
  if (status === 'validated' && t.supports === 0) return 'Validated, but no evidence supports it yet.'
  if (status === 'validated' && t.contradicts > t.supports) return 'Validated, but more evidence contradicts it than supports it.'
  if (status === 'invalidated' && t.contradicts === 0) return 'Invalidated, but no evidence contradicts it.'
  return null
}
