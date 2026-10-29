// Competitor feature ops (S4, D-312; agent-actions.md §4): a competitor's features (D-164) and which of ours each
// matches (the comparison doc `<featureId>_<competitorId>`, its `competitorFeatureId`: one of theirs per feature of ours
// and competitor).
import type { Availability } from '../model/shapes'
import { DELETE, type OpCtx, type Plan, type Write } from './types'
import { a, cardIn, find, handleOf, refuse } from './util'

export type FeatureFields = { name: string; description?: string; category?: string; availability?: Availability; url?: string }

// `ours` must be one of our features.
function oursOk(ctx: OpCtx, op: string, ours: string | null | undefined) {
  if (!ours) return
  const c = cardIn(ctx, op, ours)
  if (c.type !== 'feature') refuse(op, `ours ${c.id} is ${a(c.type)}, not a feature`, 'match it to one of our features (a feature card), or pass null')
}

const cmpId = (featureId: string, competitorId: string) => `${featureId}_${competitorId}`

export type CreateFeatureArgs = FeatureFields & { competitor: string; ours?: string | null; handle?: string }

export function createCompetitorFeature(ctx: OpCtx, args: CreateFeatureArgs): Plan {
  const op = 'create_competitor_feature'
  const comp = cardIn(ctx, op, args.competitor)
  if (comp.type !== 'competitor') refuse(op, `${comp.id} is a ${comp.type}, not a competitor`, 'add the feature to a competitor')
  const { competitor: _, ours, handle: __, ...fields } = args
  oursOk(ctx, op, ours)
  const id = ctx.newId()
  const data: Record<string, unknown> = { competitorId: comp.id, ...fields, createdAt: ctx.now, updatedAt: ctx.now }
  for (const k of Object.keys(data)) if (data[k] === undefined || data[k] === '') delete data[k]
  const writes: Write[] = [{ coll: 'competitorFeatures', id, set: data }]
  if (ours) writes.push({ coll: 'comparisons', id: cmpId(ours, comp.id), merge: true, set: { featureId: ours, competitorId: comp.id, competitorFeatureId: id } })
  return { op, label: 'add a competitor feature', writes, ids: { [handleOf(args)]: id }, meta: { kind: 'feature' } }
}

// `fields`: `undefined`, `null` or `''` takes an optional field away (never the name). `ours`: which of our features it
// matches, `null` none (matching another of theirs to the same one of ours replaces that match).
export type UpdateFeatureArgs = { feature: string; fields?: Partial<Record<keyof FeatureFields, unknown>>; ours?: string | null }

export function updateCompetitorFeature(ctx: OpCtx, args: UpdateFeatureArgs): Plan {
  const op = 'update_competitor_feature'
  const f = find(ctx.ws.competitorFeatures, op, args.feature, 'competitor feature')
  oursOk(ctx, op, args.ours)
  const writes: Write[] = []
  if (args.fields && Object.keys(args.fields).length) {
    const patch: Record<string, unknown> = { updatedAt: ctx.now }
    for (const [k, v] of Object.entries(args.fields)) patch[k] = k !== 'name' && (v === undefined || v === null || v === '') ? DELETE : v
    writes.push({ coll: 'competitorFeatures', id: f.id, patch })
  }
  if (args.ours !== undefined) {
    const was = ctx.ws.comparisons.find((c) => c.competitorFeatureId === f.id)
    if (was && was.featureId !== args.ours) writes.push({ coll: 'comparisons', id: cmpId(was.featureId, was.competitorId), patch: { competitorFeatureId: DELETE } })
    if (args.ours) writes.push({ coll: 'comparisons', id: cmpId(args.ours, f.competitorId), merge: true, set: { featureId: args.ours, competitorId: f.competitorId, competitorFeatureId: f.id } })
  }
  const label = args.ours !== undefined && !writes.some((w) => w.coll === 'competitorFeatures') ? 'match a feature' : 'edit a competitor feature'
  return { op, label, writes, ids: {}, meta: { kind: 'feature' } }
}
