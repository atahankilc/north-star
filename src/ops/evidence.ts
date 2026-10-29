// Evidence ops (S4, D-312; agent-actions.md §3): what was learned about a customer, problem or idea (D-137).
import type { EvidenceKind } from '../model/shapes'
import { DELETE, type OpCtx, type Plan } from './types'
import { cardIn, find, handleOf } from './util'

export type EvidenceInput = { kind: EvidenceKind; text: string; stance: 'supports' | 'contradicts'; source?: string; url?: string; date?: string }

// A new piece's doc: empty optional fields left out (evidence.ts' addEvidence).
export function evidenceData(fields: EvidenceInput & { nodeId: string; nodeType: string }, now: number): Record<string, unknown> {
  const data: Record<string, unknown> = { ...fields, createdAt: now, updatedAt: now }
  for (const k of Object.keys(data)) if (data[k] === undefined || data[k] === '') delete data[k]
  return data
}

export type CreateEvidenceArgs = EvidenceInput & { card: string; handle?: string }

export function createEvidence(ctx: OpCtx, args: CreateEvidenceArgs): Plan {
  const card = cardIn(ctx, 'create_evidence', args.card)
  const { card: _, handle: __, ...fields } = args
  const id = ctx.newId()
  return {
    op: 'create_evidence',
    label: 'add evidence',
    writes: [{ coll: 'evidence', id, set: evidenceData({ ...fields, nodeId: card.id, nodeType: card.type }, ctx.now) }],
    ids: { [handleOf(args)]: id },
    meta: { kind: 'evidence' },
  }
}

export type UpdateEvidenceArgs = { evidence: string; fields: Partial<Record<keyof EvidenceInput, unknown>> }

// `undefined`, `null` or `''` takes an optional field away.
export function updateEvidence(ctx: OpCtx, args: UpdateEvidenceArgs): Plan {
  const e = find(ctx.ws.evidence, 'update_evidence', args.evidence, 'piece of evidence')
  const patch: Record<string, unknown> = { updatedAt: ctx.now }
  for (const [k, v] of Object.entries(args.fields)) patch[k] = v === undefined || v === null || v === '' ? DELETE : v
  return { op: 'update_evidence', label: 'edit evidence', writes: [{ coll: 'evidence', id: e.id, patch }], ids: {}, meta: { kind: 'evidence' } }
}
