// Evidence ops (S4, D-312; agent-actions.md §3): what was learned about a customer, problem or idea (D-137).
import type { EvidenceKind } from '../model/shapes'
import { DELETE, type OpCtx, type Plan } from './types'
import { cardIn, find, handleOf, refuse } from './util'

export type EvidenceInput = { kind: EvidenceKind; text: string; stance: 'supports' | 'contradicts'; source?: string; url?: string; date?: string }

// A new piece's doc: empty optional fields left out (evidence.ts' addEvidence).
export function evidenceData(fields: EvidenceInput & { nodeId: string; nodeType: string }, now: number): Record<string, unknown> {
  const data: Record<string, unknown> = { ...fields, createdAt: now, updatedAt: now }
  for (const k of Object.keys(data)) if (data[k] === undefined || data[k] === '') delete data[k]
  return data
}

// `from_task` (S8, D-254): what a finished task taught, logged on its card (the task's when `card` is left out), the
// task marked as having logged it (`learned`), in the same step (data/tasks.ts' logLearned).
export type CreateEvidenceArgs = EvidenceInput & { card?: string; from_task?: string; handle?: string }

export function createEvidence(ctx: OpCtx, args: CreateEvidenceArgs): Plan {
  const op = 'create_evidence'
  const task = args.from_task !== undefined ? find(ctx.ws.tasks, op, args.from_task, 'task') : undefined
  if (task && args.card === undefined && !task.cardId) refuse(op, `the task ${task.title} is for no card`, 'give card: the customer, problem or idea it taught something about')
  const card = cardIn(ctx, op, args.card ?? task?.cardId)
  const { card: _, handle: __, from_task: ___, ...fields } = args
  const id = ctx.newId()
  return {
    op,
    label: task ? 'log what a task taught' : 'add evidence',
    writes: [
      { coll: 'evidence', id, set: evidenceData({ ...fields, nodeId: card.id, nodeType: card.type }, ctx.now) },
      ...(task ? [{ coll: 'tasks' as const, id: task.id, patch: { learned: id, updatedAt: ctx.now } }] : []),
    ],
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
