// Every entity op in one list (S4, D-312; docs/specs/agent-actions.md): its name (snake_case, the naming rule there), the
// kind of thing it works on, one line for the model, its arguments (a JSON-schema-ish object, for the agent's tools
// later) and its builder. Plain data and functions: the agent's tools, validate's op names and onboarding read it.
// Later steps (S5–S8) add theirs.
//
// What S4 left for later steps (still plain tracked() writes in data/):
// - competitorFeatures.ts' dropCriterionScores (a criterion taken off a feature, with its scores): S7, as a criterion
//   delete op that works out the matrix cells it takes itself (today the component passes them and a batch callback).
// - places.ts' planeGoes and runOps (what a plane's delete does to its cards and places): S6, with pieces.ts'
//   deletePiece; places.ts' rehome already writes what ops' rehome (cards.ts) plans, through it.
import { CARD_TYPES } from '../model/cards'
import { VALIDATIONS, FEATURE_PRIORITIES, FEATURE_STATUSES, FEATURE_IMPACTS, FEATURE_EFFORTS } from '../model/cards'
import { EVIDENCE_KINDS, AVAILABILITIES } from '../model/shapes'
import { project } from './project'
import { createCard, createPackage, deleteThings, duplicate, updateCard } from './cards'
import { EDGE_KINDS, link, unlink, updateLink } from './edges'
import { createEvidence, updateEvidence } from './evidence'
import { createCompetitorFeature, updateCompetitorFeature } from './features'
import { placeOn, takeOff } from './places'
import type { OpCtx, Plan } from './types'
import { refuse } from './util'

// A JSON-schema-ish description: enough for a tool definition, not a validator (validate is the validator).
export type ArgSchema = { type?: string | string[]; anyOf?: ArgSchema[]; description?: string; enum?: readonly (string | number)[]; items?: ArgSchema; properties?: Record<string, ArgSchema>; required?: string[] }

export type OpDef = {
  name: string
  kind: 'card' | 'link' | 'evidence' | 'feature' | 'place' | 'package' | 'any'
  summary: string
  args: ArgSchema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: (ctx: OpCtx, args: any) => Plan
}

const s = (description?: string): ArgSchema => ({ type: 'string', ...(description ? { description } : {}) })
const n = (description?: string): ArgSchema => ({ type: 'number', ...(description ? { description } : {}) })
const b = (description?: string): ArgSchema => ({ type: 'boolean', ...(description ? { description } : {}) })
const ids = (description: string): ArgSchema => ({ type: 'array', items: s(), description })
const obj = (properties: Record<string, ArgSchema>, required: string[] = [], description?: string): ArgSchema => ({ type: 'object', properties, required, ...(description ? { description } : {}) })
const kindArg = (description?: string): ArgSchema => ({ type: 'string', enum: EDGE_KINDS, ...(description ? { description } : {}) })
const orNull = (description: string): ArgSchema => ({ type: ['string', 'null'], description })
const handle = s('a name for the new thing ($a, $b…) that later ops in the same batch can use instead of its id')

const cardFields = obj(
  {
    validation: { type: 'string', enum: VALIDATIONS, description: 'customer, problem, idea: how far it is tested' },
    tags: { type: 'array', items: s() },
    notes: s(),
    regions: { type: 'array', items: s(), description: 'competitor only' },
    description: s('competitor only'),
    audience: s('competitor only'),
    pricing: s('competitor only'),
    url: s('competitor only'),
    priority: { type: 'string', enum: FEATURE_PRIORITIES, description: 'feature only' },
    status: { type: 'string', enum: FEATURE_STATUSES, description: 'feature only' },
    impact: { type: 'string', enum: FEATURE_IMPACTS, description: 'feature or package' },
    effort: { type: 'string', enum: FEATURE_EFFORTS, description: 'feature or package' },
    criteria: { type: 'array', items: obj({ id: s('a–z 0–9, ≤ 16'), text: s() }, ['id', 'text']), description: 'feature only: what it is judged on (≤ 8)' },
    memberIds: ids('package only: the cards it holds'),
  },
  [],
  'fields to set; null takes one away',
)
const evidenceArgs = { kind: { type: 'string', enum: EVIDENCE_KINDS }, text: s('what was learned, a sentence or a quote'), stance: { type: 'string', enum: ['supports', 'contradicts'] }, source: s('who or where'), url: s(), date: s('YYYY-MM-DD') }
const featureFields = { name: s(), description: s(), category: s(), availability: { type: 'string', enum: AVAILABILITIES }, url: s() }

export const OPS: OpDef[] = [
  {
    name: 'create_card',
    kind: 'card',
    summary: 'Make a card on a plane, whole: title, fields, links, parts and evidence in one step.',
    args: obj(
      {
        type: { type: 'string', enum: CARD_TYPES },
        plane: s('the plane it goes on'),
        title: s(),
        fields: cardFields,
        where: obj({ near: s('right of this card') }, [], 'left out: the first clear spot on the plane'),
        links: { type: 'array', items: obj({ to: s('a card'), kind: kindArg('as drawn when left out'), label: s(), reverse: b('the link points at the new card') }, ['to']) },
        parts: { type: 'array', description: 'parts: new cards of its type, each part of it', items: { anyOf: [s('its title'), obj({ title: s(), fields: cardFields }, ['title'])] } },
        evidence: { type: 'array', items: obj(evidenceArgs, ['kind', 'text', 'stance']) },
        handle,
      },
      ['type', 'plane'],
    ),
    build: createCard,
  },
  {
    name: 'update_card',
    kind: 'card',
    summary: "Change a card: its title, fields, or its spot and fold on a plane it's on.",
    args: obj({ card: s(), plane: s("the plane for x, y and folded (its home when left out)"), title: s(), fields: cardFields, x: n(), y: n(), folded: b() }, ['card']),
    build: updateCard,
  },
  {
    name: 'create_package',
    kind: 'package',
    summary: 'Package cards on their plane (named "Package N" unless named).',
    args: obj({ cards: ids('the cards it holds'), plane: s(), name: s(), handle }, ['cards']),
    build: createPackage,
  },
  {
    name: 'delete',
    kind: 'any',
    summary: 'Delete cards (with their links, places, evidence, competitor features and matches), links, evidence, competitor features, matches or text. On a plane, cards also elsewhere only come off it.',
    args: obj({ ids: ids('what to delete'), plane: s('delete here only: cards on other planes stay there'), everywhere: b('delete cards from every plane') }, ['ids']),
    build: deleteThings,
  },
  {
    name: 'duplicate',
    kind: 'card',
    summary: 'Copy cards and text onto a plane, with the links between them (not evidence, competitor features, tasks or places).',
    args: obj({ ids: ids('cards and text'), from: s('the plane they are shown on'), to: s('the plane the copies go on'), by: { type: 'array', items: n(), description: '[dx, dy], plane px' }, handle }, ['ids', 'to']),
    build: duplicate,
  },
  {
    name: 'link',
    kind: 'link',
    summary: 'Link two cards (kind as drawn when left out: for, solves, competes-with, inspired-by, relates, part-of, depends-on, contradicts).',
    args: obj({ from: s(), to: s(), kind: kindArg('as drawn when left out'), label: s(), handle }, ['from', 'to']),
    build: link,
  },
  { name: 'unlink', kind: 'link', summary: 'Remove a link.', args: obj({ link: s() }, ['link']), build: unlink },
  {
    name: 'update_link',
    kind: 'link',
    summary: "Change a link's kind or label, or turn it round.",
    args: obj({ link: s(), kind: kindArg(), label: orNull('empty or null takes it away'), reverse: b() }, ['link']),
    build: updateLink,
  },
  {
    name: 'create_evidence',
    kind: 'evidence',
    summary: 'Add what was learned to a customer, problem or idea.',
    args: obj({ card: s(), ...evidenceArgs, handle }, ['card', 'kind', 'text', 'stance']),
    build: createEvidence,
  },
  {
    name: 'update_evidence',
    kind: 'evidence',
    summary: 'Change a piece of evidence.',
    args: obj({ evidence: s(), fields: obj(evidenceArgs) }, ['evidence', 'fields']),
    build: updateEvidence,
  },
  {
    name: 'create_competitor_feature',
    kind: 'feature',
    summary: "Add a feature to a competitor, optionally matched to one of ours.",
    args: obj({ competitor: s(), ...featureFields, ours: orNull('our feature it matches'), handle }, ['competitor', 'name']),
    build: createCompetitorFeature,
  },
  {
    name: 'update_competitor_feature',
    kind: 'feature',
    summary: "Change a competitor's feature, or which of ours it matches (ours: null for none).",
    args: obj({ feature: s(), fields: obj(featureFields), ours: orNull('our feature it matches; null: none') }, ['feature']),
    build: updateCompetitorFeature,
  },
  {
    name: 'place_on',
    kind: 'place',
    summary: 'Show the same cards on another plane too (with their parts and members); move: their home moves there.',
    args: obj({ cards: ids('the cards'), plane: s(), move: b() }, ['cards', 'plane']),
    build: placeOn,
  },
  {
    name: 'take_off',
    kind: 'place',
    summary: "Take cards off one plane; they stay on the others (a card on no other plane isn't touched).",
    args: obj({ cards: ids('the cards'), plane: s() }, ['cards', 'plane']),
    build: takeOff,
  },
]

export const REGISTRY: ReadonlyMap<string, OpDef> = new Map(OPS.map((o) => [o.name, o]))

export function build(ctx: OpCtx, op: string, args: unknown): Plan {
  const def = REGISTRY.get(op)
  if (!def) refuse(op, `there is no op ${op}`, `use one of ${OPS.map((o) => o.name).join(', ')}`)
  return def.build(ctx, args)
}

// `$a`-style handles in args replaced by the ids made earlier in the batch (deeply, in strings that are a handle).
function resolve(v: unknown, made: Record<string, string>): unknown {
  if (typeof v === 'string') return v.startsWith('$') && v in made ? made[v] : v
  if (Array.isArray(v)) return v.map((x) => resolve(x, made))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x, made)]))
  return v
}

export type Step = { op: string; args: Record<string, unknown> }

// A batch built in order: each op sees the workspace as the ops before it left it (projected), and may name what they
// made by handle. A step that makes something and gives no handle gets `$1`, `$2`… (its place in the batch).
export function buildBatch(ctx: OpCtx, steps: Step[]): Plan[] {
  const plans: Plan[] = []
  const made: Record<string, string> = {}
  let ws = ctx.ws
  steps.forEach((step, i) => {
    const args = resolve(step.args, made) as Record<string, unknown>
    if (!('handle' in args)) args.handle = `$${i + 1}`
    const plan = build({ ...ctx, ws }, step.op, args)
    for (const [h, id] of Object.entries(plan.ids)) {
      if (made[h] && made[h] !== id) refuse(step.op, `the handle ${h} is used twice`, 'give each new thing its own handle')
      made[h] = id
    }
    plans.push(plan)
    ws = project(ws, [plan])
  })
  return plans
}
