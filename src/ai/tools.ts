// The assistant's one tool (D-074): propose a set of changes. Nothing is written until the user accepts some of
// them in the chat; then they go through src/data/assistant.ts as one undo step. Deletes too (D-075), with their cascade.
import type { AssistantWrite, ChangeRef } from '../data/assistant'
import { linked } from '../data/edges'
import { COVERAGES, FEATURE_EFFORTS, FEATURE_PRIORITIES, FEATURE_STATUSES, type BoardType, type NodeType } from '../data/model'
import { CARD_H, CARD_W, findFreeSpot } from '../views/canvas/cardLayout'
import type { WorkspaceCtx } from '../views/workspace/context'
import type { ItemRef } from './context'
import { arrangeAreas, type AreaPlan } from './arrange'

export const PROPOSE = 'propose_changes'

const LINK_KINDS = ['relates', 'depends-on', 'contradicts', 'part-of', 'inspired-by', 'solves', 'competes-with', 'for'] as const
const CARD_TYPES = ['customer', 'problem', 'idea', 'feature'] as const
// Far more than one answer should hold; keeps a runaway call from flooding the board.
const MAX_CHANGES = 60

// Strict schemas: every property listed and required; "not given" is null.
const str = (description: string) => ({ type: 'string', description })
const optStr = (description: string) => ({ type: ['string', 'null'], description })
const optEnum = (values: readonly string[], description: string) => ({ type: ['string', 'null'], enum: [...values, null], description })
const optTags = { type: ['array', 'null'], items: { type: 'string' }, description: 'Replaces the tags. Lowercase words, no #.' }
const ref = (what: string) => str(`${what}: a ref from the workspace (without brackets) or the key of an item added in this same proposal.`)
const near = optStr('Ref or key of a card to place the new card beside, usually the one it will be linked to. Null: beside its own kind.')

function op(name: string, description: string, properties: Record<string, unknown>) {
  return {
    type: 'object',
    description,
    properties: { op: { type: 'string', enum: [name] }, ...properties },
    required: ['op', ...Object.keys(properties)],
    additionalProperties: false,
  }
}

const OPS = [
  op('add_card', 'A new customer, problem, idea or feature card.', {
    key: str('A short name for this new card (e.g. "new1"), so other changes here can refer to it.'),
    type: { type: 'string', enum: CARD_TYPES },
    title: str('Short, like a card title.'),
    notes: optStr('Longer description, shown in its panel.'),
    tags: optTags,
    priority: optEnum(FEATURE_PRIORITIES, 'Features only.'),
    status: optEnum(FEATURE_STATUSES, 'Features only.'),
    effort: optEnum(FEATURE_EFFORTS, 'Features only.'),
    near,
  }),
  op('add_competitor', 'A new competitor card.', {
    key: str('A short name for this new competitor, so its features, links and matrix cells here can refer to it.'),
    name: str('The product or company name.'),
    url: optStr('Homepage, only if you are sure of it.'),
    description: optStr('What it is and does.'),
    pricing: optStr('Plans and prices, only if known.'),
    audience: optStr('Who it is for.'),
    notes: optStr('Strengths, weaknesses, anything else.'),
    tags: optTags,
    near,
  }),
  op('add_competitor_feature', "A feature in a competitor's breakdown (shown stacked behind its card).", {
    key: optStr('Only needed if a link here points at it.'),
    competitor: ref('The competitor'),
    name: str('The feature.'),
    category: optStr('Groups features in the breakdown, e.g. "scheduling", "payroll".'),
    description: optStr('How they do it.'),
  }),
  op('update_card', 'Edit an existing customer, problem, idea or feature. Null leaves a field as it is.', {
    target: ref('The card'),
    title: optStr('New title.'),
    notes: optStr('Replaces the whole notes text; include what should stay.'),
    tags: optTags,
    priority: optEnum(FEATURE_PRIORITIES, 'Features only.'),
    status: optEnum(FEATURE_STATUSES, 'Features only.'),
    effort: optEnum(FEATURE_EFFORTS, 'Features only.'),
  }),
  op('update_competitor', 'Edit an existing competitor. Null leaves a field as it is.', {
    target: ref('The competitor'),
    name: optStr('New name.'),
    url: optStr('Homepage.'),
    description: optStr('Replaces the description.'),
    pricing: optStr('Replaces the pricing.'),
    audience: optStr('Replaces the audience.'),
    notes: optStr('Replaces the whole notes text; include what should stay.'),
    tags: optTags,
  }),
  op('link', 'A link between two items. "for" tags an item with a customer (to = the customer).', {
    from: ref('From'),
    to: ref('To'),
    kind: {
      type: 'string',
      enum: LINK_KINDS,
      description:
        'idea solves problem; customer relates to a problem they have; competitor competes-with the problems it addresses and ideas it rivals; ' +
        'feature inspired-by the idea or competitor feature it comes from; "for" from any item to a customer.',
    },
    label: optStr('Rarely needed: a short note on the link.'),
  }),
  op('delete_item', 'Delete an item, like deleting it by hand: its links go too; a competitor takes its features and matrix cells with it.', {
    target: ref('The item'),
    reason: str('Why it should go, in a few words; shown to the user.'),
  }),
  op('unlink', 'Remove every link between two items (either direction), including a "for" tag.', {
    from: ref('One end'),
    to: ref('The other end'),
  }),
  op(
    'arrange_area',
    'Gather cards into one area of the board under a text label. You choose what goes together; the app lays the area out ' +
      '(a column per type in the order customers, problems, competitors, ideas, features) and puts it where the board has room.',
    {
      label: str('The area name as written on the board, 1 to 4 words. If a label with this text exists, it moves with its cards.'),
      items: {
        type: 'array',
        items: { type: 'string' },
        description: 'Refs (or keys of cards added here) of the cards and competitors in this area, in the order to show them. A card goes in one area at most.',
      },
    },
  ),
  op('rename_label', 'Change the text of a label on the board.', {
    label: str('Its current text, exactly as listed under AREAS ON THE BOARD.'),
    text: str('The new text.'),
  }),
  op('delete_label', 'Remove a label from the board; its cards stay where they are.', {
    label: str('Its current text, exactly as listed under AREAS ON THE BOARD.'),
    reason: str('Why it should go, in a few words; shown to the user.'),
  }),
  op('set_matrix_cell', 'One cell of the matrix: how well a competitor covers one of OUR features.', {
    feature: ref('Our feature'),
    competitor: ref('The competitor'),
    coverage: optEnum(COVERAGES, 'none, partial, full, or better than ours. Null leaves it.'),
    notes: optStr('Replaces the cell notes.'),
  }),
]

export const PROPOSE_TOOL = {
  type: 'function',
  name: PROPOSE,
  description:
    'Propose changes to the workspace. They are shown to the user as a checklist; nothing changes until they accept. ' +
    'Use it whenever the user asks you to add, link, fill in or edit something, or agrees to a suggestion of yours.',
  strict: true,
  parameters: {
    type: 'object',
    properties: {
      summary: str('One short line saying what this set does, e.g. "Add Deputy with its scheduling features".'),
      changes: { type: 'array', items: { anyOf: OPS } },
    },
    required: ['summary', 'changes'],
    additionalProperties: false,
  },
}

// ---- Reading a proposal ----

type Raw = Record<string, unknown> & { op: string }

// A row in the checklist.
export type Change = {
  n: number
  raw: Raw
  // What it does, in the checklist's words.
  sign: '+' | '~' | '→' | '▦' | '−' | '▤'
  kind: string
  // A board type colours the row (customer green…); competitor features take their competitor's.
  tone: BoardType | null
  text: string
  detail?: string
  // Keys of new items it needs: unchecking one of those unchecks this too.
  needs: string[]
  // Set when it can't be applied (unknown ref, wrong type, already linked).
  problem?: string
  // Removes something (shown struck through).
  removes?: boolean
  // Delete rows in this proposal that remove an item this row uses: while one of them is on, this row is off.
  clashes: number[]
}

export type Proposal = { summary: string; changes: Change[] }

type Resolved = { ref: ChangeRef; name: string; type: NodeType; isNew: boolean }

const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
// Models sometimes copy a ref with its brackets.
export const refKey = (v: unknown) => s(v)?.replace(/^\[|\]$/g, '')
const clip = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

// `labels`: the texts of the board's labels now, so label changes can be checked (D-086).
export function parseProposal(args: string, refs: Map<string, ItemRef>, labels: string[] = []): Proposal {
  let data: { summary?: unknown; changes?: unknown }
  try {
    data = JSON.parse(args)
  } catch {
    return { summary: 'The proposal came back garbled.', changes: [] }
  }
  const raws = (Array.isArray(data.changes) ? data.changes : []).slice(0, MAX_CHANGES) as Raw[]

  // New items first, so changes can refer to them in any order.
  const fresh = new Map<string, { type: NodeType; name: string }>()
  for (const r of raws) {
    const key = s(r.key)
    if (!key) continue
    if (r.op === 'add_card') fresh.set(key, { type: r.type as NodeType, name: s(r.title) ?? 'Untitled' })
    if (r.op === 'add_competitor') fresh.set(key, { type: 'competitor', name: s(r.name) ?? 'Untitled' })
    if (r.op === 'add_competitor_feature') fresh.set(key, { type: 'competitorFeature', name: s(r.name) ?? 'Untitled' })
  }
  const resolve = (v: unknown): Resolved | undefined => {
    const k = refKey(v)
    if (!k) return undefined
    const f = fresh.get(k)
    if (f) return { ref: { key: k, type: f.type }, name: f.name, type: f.type, isNew: true }
    const e = refs.get(k)
    if (e) return { ref: { id: e.id, type: e.type }, name: e.name, type: e.type, isNew: false }
    return undefined
  }
  const needsOf = (...rs: (Resolved | undefined)[]) => rs.flatMap((r) => (r && 'key' in r.ref ? [r.ref.key] : []))
  const isBoardCard = (t: NodeType) => (CARD_TYPES as readonly string[]).includes(t)
  const hasLabel = (v: unknown) => labels.some((l) => sameLabel(l, v))
  // Which area each card went to first: a card is in one area at most.
  const areaOf = new Map<string, string>()

  const changes: Change[] = raws.map((raw, i) => {
    const base = { n: i, raw, needs: [] as string[], clashes: [] as number[] }
    switch (raw.op) {
      case 'add_card': {
        const type = raw.type as BoardType
        const meta = [s(raw.priority), s(raw.status), s(raw.effort) && `effort ${s(raw.effort)}`].filter(Boolean).join(' · ')
        return {
          ...base,
          sign: '+',
          kind: type,
          tone: type,
          text: s(raw.title) ?? 'Untitled',
          detail: [meta, tagText(raw.tags), s(raw.notes) && clip(s(raw.notes)!)].filter(Boolean).join(' · ') || undefined,
          needs: needsOf(resolve(raw.near)),
          problem: isBoardCard(type) ? undefined : 'unknown card type',
        }
      }
      case 'add_competitor':
        return {
          ...base,
          sign: '+',
          kind: 'competitor',
          tone: 'competitor',
          text: s(raw.name) ?? 'Untitled',
          detail:
            [s(raw.pricing) && clip(s(raw.pricing)!, 40), tagText(raw.tags), s(raw.description) && clip(s(raw.description)!), sourcesOf(raw)]
              .filter(Boolean)
              .join(' · ') || undefined,
          needs: needsOf(resolve(raw.near)),
        }
      case 'add_competitor_feature': {
        const c = resolve(raw.competitor)
        return {
          ...base,
          sign: '+',
          kind: 'their feature',
          tone: 'competitor',
          text: `${c?.name ?? '?'}: ${s(raw.name) ?? 'Untitled'}`,
          detail: [s(raw.category), s(raw.description) && clip(s(raw.description)!), sourcesOf(raw)].filter(Boolean).join(' · ') || undefined,
          needs: needsOf(c),
          problem: !c ? 'unknown competitor' : c.type !== 'competitor' ? `${c.name} isn't a competitor` : undefined,
        }
      }
      case 'update_card':
      case 'update_competitor': {
        const t = resolve(raw.target)
        const want = raw.op === 'update_competitor' ? 'competitor' : 'card'
        const fit = t && (want === 'competitor' ? t.type === 'competitor' : isBoardCard(t.type))
        const edits = Object.entries(raw)
          .filter(([k, v]) => !['op', 'target'].includes(k) && v !== null && v !== undefined)
          .map(([k, v]) => (k === 'tags' ? `tags ${tagText(v) || 'none'}` : `${k} ${clip(String(v), 50)}`))
        return {
          ...base,
          sign: '~',
          kind: t?.type === 'competitor' ? 'competitor' : (t?.type ?? want),
          tone: t && t.type !== 'competitorFeature' ? (t.type as BoardType) : null,
          text: t?.name ?? '?',
          detail: [...edits, sourcesOf(raw)].filter(Boolean).join(' · ') || undefined,
          needs: needsOf(t),
          problem: !t ? 'unknown item' : !fit ? `${t.name} isn't a ${want}` : edits.length === 0 ? 'nothing to change' : undefined,
        }
      }
      case 'link': {
        const from = resolve(raw.from)
        const to = resolve(raw.to)
        const kind = s(raw.kind) ?? 'relates'
        const problem = !from || !to
          ? 'unknown item'
          : from.ref === to.ref || ('id' in from.ref && 'id' in to.ref && from.ref.id === to.ref.id)
            ? 'links an item to itself'
            : kind === 'for' && to.type !== 'customer'
              ? '"for" must point at a customer'
              : undefined
        return {
          ...base,
          sign: '→',
          kind: kind === 'for' ? 'tag' : 'link',
          tone: null,
          text: kind === 'for' ? `${from?.name ?? '?'}  for  ${to?.name ?? '?'}` : `${from?.name ?? '?'}  —${kind}→  ${to?.name ?? '?'}`,
          detail: s(raw.label),
          needs: needsOf(from, to),
          problem,
        }
      }
      case 'set_matrix_cell': {
        const f = resolve(raw.feature)
        const c = resolve(raw.competitor)
        return {
          ...base,
          sign: '▦',
          kind: 'matrix',
          tone: null,
          text: `${f?.name ?? '?'} × ${c?.name ?? '?'}`,
          detail: [s(raw.coverage), s(raw.notes) && clip(s(raw.notes)!)].filter(Boolean).join(' · ') || undefined,
          needs: needsOf(f, c),
          problem: !f || !c
            ? 'unknown item'
            : f.type !== 'feature'
              ? `${f.name} isn't one of our features`
              : c.type !== 'competitor'
                ? `${c.name} isn't a competitor`
                : !s(raw.coverage) && !s(raw.notes)
                  ? 'nothing to change'
                  : undefined,
        }
      }
      case 'arrange_area': {
        const label = s(raw.label) ?? 'Untitled'
        const items = (Array.isArray(raw.items) ? raw.items : []).map((v) => ({ v, r: resolve(v) }))
        const unknown = items.filter((x) => !x.r).length
        const wrong = items.find((x) => x.r && x.r.type === 'competitorFeature')
        const twice = items.find((x) => x.r && areaOf.has(refKey(x.v)!))
        for (const x of items) if (x.r && !areaOf.has(refKey(x.v)!)) areaOf.set(refKey(x.v)!, label)
        const names = items.map((x) => x.r?.name ?? '?')
        return {
          ...base,
          sign: '▤',
          kind: 'area',
          tone: null,
          text: label,
          detail: `${items.length} card${items.length === 1 ? '' : 's'}${hasLabel(label) ? ', moves the label' : ''}: ${clip(names.join(', '), 160)}`,
          needs: needsOf(...items.map((x) => x.r)),
          problem: !items.length
            ? 'no cards'
            : unknown
              ? `${unknown} unknown item${unknown === 1 ? '' : 's'}`
              : wrong
                ? `${wrong.r!.name} can't be moved on its own (it sits behind its competitor)`
                : twice
                  ? `${twice.r!.name} is already in "${areaOf.get(refKey(twice.v)!)}"`
                  : undefined,
        }
      }
      case 'rename_label':
        return {
          ...base,
          sign: '~',
          kind: 'label',
          tone: null,
          text: `${s(raw.label) ?? '?'}  →  ${s(raw.text) ?? '?'}`,
          problem: !hasLabel(raw.label) ? 'no label with this text' : !s(raw.text) ? 'no new text' : undefined,
        }
      case 'delete_label':
        return {
          ...base,
          sign: '−',
          kind: 'label',
          tone: null,
          text: s(raw.label) ?? '?',
          detail: s(raw.reason),
          removes: true,
          problem: !hasLabel(raw.label) ? 'no label with this text' : undefined,
        }
      case 'delete_item': {
        const t = resolve(raw.target)
        return {
          ...base,
          sign: '−',
          kind: t?.type === 'competitorFeature' ? 'their feature' : (t?.type ?? 'item'),
          tone: t && t.type !== 'competitorFeature' ? (t.type as BoardType) : null,
          text: t?.name ?? '?',
          detail: s(raw.reason),
          removes: true,
          problem: !t ? 'unknown item' : t.isNew ? 'added in this same proposal' : undefined,
        }
      }
      case 'unlink': {
        const from = resolve(raw.from)
        const to = resolve(raw.to)
        return {
          ...base,
          sign: '−',
          kind: to?.type === 'customer' ? 'untag' : 'unlink',
          tone: null,
          text: `${from?.name ?? '?'}  ×  ${to?.name ?? '?'}`,
          removes: true,
          problem: !from || !to ? 'unknown item' : from.isNew || to.isNew ? 'added in this same proposal' : undefined,
        }
      }
      default:
        return { ...base, sign: '~', kind: '?', tone: null, text: String(raw.op), problem: 'unknown change' }
    }
  })

  // Nothing else may use an item this proposal deletes, unless that delete is unticked.
  const deleting = new Map<string, number>()
  for (const c of changes) {
    const k = refKey(c.raw.target)
    if (c.raw.op === 'delete_item' && !c.problem && k) deleting.set(k, c.n)
  }
  for (const c of changes) {
    if (c.raw.op === 'delete_item') continue
    for (const v of [...['target', 'from', 'to', 'competitor', 'feature', 'near'].map((f) => c.raw[f]), ...itemsOf(c.raw)]) {
      const d = deleting.get(refKey(v) ?? '')
      if (d !== undefined && !c.clashes.includes(d)) c.clashes.push(d)
    }
  }
  return { summary: s(data.summary) ?? 'Proposed changes', changes }
}

// An arrange_area row's cards.
export const itemsOf = (raw: Raw): unknown[] => (Array.isArray(raw.items) ? raw.items : [])
// Labels are named by their text: the same text, ignoring case and spaces at the ends.
const sameLabel = (text: string, v: unknown) => text.trim().toLowerCase() === (s(v) ?? '').toLowerCase()

// Where researched facts came from (D-076): the domains of every URL in the row's text fields.
function sourcesOf(raw: Raw): string | undefined {
  const domains = new Set<string>()
  for (const v of Object.values(raw)) {
    if (typeof v !== 'string') continue
    for (const m of v.matchAll(/https?:\/\/(?:www\.)?([^/\s),\]]+)/g)) domains.add(m[1])
  }
  return domains.size ? `sources: ${[...domains].join(', ')}` : undefined
}

function tagText(v: unknown): string {
  return Array.isArray(v) ? v.map((t) => `#${String(t).replace(/^#/, '')}`).join(' ') : ''
}

// Which rows can still be applied against the workspace as it is now (an item may have gone since).
export function stillValid(change: Change, ws: WorkspaceCtx, refs: Map<string, ItemRef>): string | undefined {
  if (change.problem) return change.problem
  const exists = new Set<string>()
  for (const list of [ws.customers, ws.problems, ws.ideas, ws.features, ws.competitors, ws.competitorFeatures]) for (const n of list) exists.add(n.id)
  for (const v of [...['target', 'from', 'to', 'competitor', 'feature', 'near'].map((k) => change.raw[k]), ...itemsOf(change.raw)]) {
    const r = refs.get(refKey(v) ?? '')
    if (r && !exists.has(r.id)) return `${r.name} was deleted`
  }
  if (['rename_label', 'delete_label'].includes(change.raw.op) && !ws.labels.some((l) => sameLabel(l.text, change.raw.label))) {
    return 'the label is gone'
  }
  const a = refs.get(refKey(change.raw.from) ?? '')
  const b = refs.get(refKey(change.raw.to) ?? '')
  if (change.raw.op === 'link' && a && b && linked(ws.edges, a.id, b.id)) return 'already linked'
  if (change.raw.op === 'unlink' && a && b && !linked(ws.edges, a.id, b.id)) return 'not linked'
  return undefined
}

// ---- Accepted rows → writes ----

export function toWrites(accepted: Change[], ws: WorkspaceCtx, refs: Map<string, ItemRef>): AssistantWrite[] {
  const fresh = new Map<string, NodeType>()
  for (const c of accepted) {
    const key = s(c.raw.key)
    if (!key) continue
    if (c.raw.op === 'add_card') fresh.set(key, c.raw.type as NodeType)
    if (c.raw.op === 'add_competitor') fresh.set(key, 'competitor')
    if (c.raw.op === 'add_competitor_feature') fresh.set(key, 'competitorFeature')
  }
  const refOf = (v: unknown): ChangeRef => {
    const k = refKey(v)!
    const t = fresh.get(k)
    if (t) return { key: k, type: t }
    const e = refs.get(k)!
    return { id: e.id, type: e.type }
  }

  // New cards go in their own kind's column (the board usually reads as columns, D-045): level with the card they're
  // placed near, or under the last of their kind; then the nearest free spot, never on top of another card.
  const position = new Map<string, { x: number; y: number }>()
  for (const n of [...ws.customers, ...ws.problems, ...ws.ideas, ...ws.features]) position.set(n.id, { x: n.x, y: n.y })
  for (const c of ws.competitors) if (c.x !== undefined && c.y !== undefined) position.set(c.id, { x: c.x, y: c.y })
  // Areas first (D-086): their cards (new ones too) get their place from the layout, and what's left is placed around them.
  const plans: AreaPlan[] = accepted
    .filter((c) => c.raw.op === 'arrange_area')
    .map((c) => ({ label: s(c.raw.label)!, items: itemsOf(c.raw).map((v) => refOf(v)).map((r) => ({ id: 'id' in r ? r.id : r.key, type: r.type })) }))
  const moving = new Set(plans.flatMap((p) => p.items.map((i) => i.id)))
  const movingLabels = new Set(ws.labels.filter((l) => plans.some((p) => sameLabel(l.text, p.label))).map((l) => l.id))
  const droppedLabels = new Set(
    accepted.filter((c) => c.raw.op === 'delete_label').flatMap((c) => ws.labels.filter((l) => sameLabel(l.text, c.raw.label)).map((l) => l.id)),
  )
  const layout = plans.length
    ? arrangeAreas(
        plans,
        {
          cards: [...position.entries()].filter(([id]) => !moving.has(id)).map(([, p]) => p),
          labels: ws.labels.filter((l) => !movingLabels.has(l.id) && !droppedLabels.has(l.id)),
        },
        [...position.values()],
      )
    : null
  const cards = [...position.entries()].filter(([id]) => !moving.has(id)).map(([, p]) => p)
  if (layout) cards.push(...layout.cards.values())
  const placed = new Map<string, { x: number; y: number }>()
  const ofType = (type: BoardType) => {
    const list: { x?: number; y?: number }[] = type === 'competitor' ? ws.competitors : ws[`${type}s` as 'ideas']
    return list.filter((c): c is { x: number; y: number } => c.x !== undefined && c.y !== undefined)
  }
  const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]
  const spot = (key: string, type: BoardType, nearRef: unknown): { x: number; y: number } => {
    const k = refKey(nearRef)
    const anchor = (k && placed.get(k)) || (k && refs.get(k) && position.get(refs.get(k)!.id)) || undefined
    const kin = [...ofType(type), ...[...placed.entries()].filter(([pk]) => freshType(pk) === type).map(([, p]) => p)]
    let start: [number, number]
    if (kin.length) start = [median(kin.map((c) => c.x)), anchor ? anchor.y : Math.min(...kin.map((c) => c.y)) - (CARD_H + 0.3)]
    else start = anchor ? [anchor.x + CARD_W + 0.3, anchor.y] : [0, 0]
    const [x, y] = kin.length ? columnSpot(start) : findFreeSpot(start, cards)
    const at = { x, y }
    cards.push(at)
    placed.set(key, at)
    return at
  }
  const freshType = (key: string) => fresh.get(key)
  // Up and down the column first, nearest row first; sideways only if the column is full here.
  const columnSpot = ([x, y]: [number, number]): [number, number] => {
    const gapY = CARD_H + 0.3
    const free = (cy: number) => cards.every((c) => Math.abs(c.x - x) >= CARD_W + 0.3 || Math.abs(c.y - cy) >= gapY)
    for (let i = 0; i < 24; i++) for (const cy of i ? [y - i * gapY, y + i * gapY] : [y]) if (free(cy)) return [x, cy]
    return findFreeSpot([x, y], cards)
  }

  const text = (v: unknown) => s(v)
  const compact = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
  const tags = (v: unknown) => (Array.isArray(v) ? v.map((t) => String(t).replace(/^#/, '').trim()).filter(Boolean).slice(0, 30) : undefined)

  // Existing cards an area moves: one position update each.
  const moves: AssistantWrite[] = []
  for (const [id, p] of layout?.cards ?? []) {
    const e = [...refs.values()].find((x) => x.id === id)
    if (e) moves.push({ do: 'update', target: { id, type: e.type }, fields: { x: p.x, y: p.y } })
  }

  const writes = accepted.map((c): AssistantWrite => {
    const r = c.raw
    switch (r.op) {
      case 'add_card': {
        const type = r.type as BoardType
        const at = layout?.cards.get(s(r.key)!) ?? spot(s(r.key)!, type, r.near)
        const extra = type === 'feature' ? { priority: text(r.priority), status: text(r.status), effort: text(r.effort) } : {}
        return {
          do: 'create',
          key: s(r.key)!,
          type,
          fields: compact({ title: text(r.title) ?? 'Untitled', body: text(r.notes), tags: tags(r.tags), ...extra, ...at }),
        }
      }
      case 'add_competitor': {
        const at = layout?.cards.get(s(r.key)!) ?? spot(s(r.key)!, 'competitor', r.near)
        return {
          do: 'create',
          key: s(r.key)!,
          type: 'competitor',
          fields: compact({
            name: text(r.name) ?? 'Untitled',
            url: text(r.url),
            description: text(r.description),
            pricing: text(r.pricing),
            audience: text(r.audience),
            notes: text(r.notes),
            tags: tags(r.tags),
            ...at,
          }),
        }
      }
      case 'add_competitor_feature':
        return {
          do: 'create',
          key: s(r.key) ?? `feature-${c.n}`,
          type: 'competitorFeature',
          parent: refOf(r.competitor),
          fields: compact({ name: text(r.name) ?? 'Untitled', category: text(r.category), description: text(r.description) }),
        }
      case 'update_card':
      case 'update_competitor': {
        const target = refOf(r.target) as { id: string; type: NodeType }
        const fields =
          r.op === 'update_card'
            ? compact({ title: text(r.title), body: text(r.notes), tags: tags(r.tags), priority: text(r.priority), status: text(r.status), effort: text(r.effort) })
            : compact({
                name: text(r.name),
                url: text(r.url),
                description: text(r.description),
                pricing: text(r.pricing),
                audience: text(r.audience),
                notes: text(r.notes),
                tags: tags(r.tags),
              })
        return { do: 'update', target, fields }
      }
      case 'link':
        return { do: 'link', from: refOf(r.from), to: refOf(r.to), kind: s(r.kind) ?? 'relates', label: text(r.label) }
      case 'delete_item':
        return { do: 'delete', target: refOf(r.target) as { id: string; type: NodeType } }
      case 'arrange_area': {
        const plan = layout!.labels.find((l) => sameLabel(l.text, r.label))!
        const existing = ws.labels.find((l) => sameLabel(l.text, r.label))
        const fields = { x: plan.x, y: plan.y }
        return existing ? { do: 'label', id: existing.id, fields } : { do: 'label', fields: { text: plan.text, ...fields } }
      }
      case 'rename_label':
        return { do: 'label', id: ws.labels.find((l) => sameLabel(l.text, r.label))!.id, fields: { text: s(r.text)!.slice(0, 200) } }
      case 'delete_label':
        return { do: 'unlabel', id: ws.labels.find((l) => sameLabel(l.text, r.label))!.id }
      case 'unlink': {
        const a = (refOf(r.from) as { id: string }).id
        const b = (refOf(r.to) as { id: string }).id
        const edgeIds = ws.edges.filter((e) => (e.fromId === a && e.toId === b) || (e.fromId === b && e.toId === a)).map((e) => e.id)
        return { do: 'unlink', edgeIds }
      }
      default:
        return {
          do: 'cell',
          feature: refOf(r.feature),
          competitor: refOf(r.competitor),
          fields: compact({ coverage: text(r.coverage), notes: text(r.notes) }),
        }
    }
  })
  return [...writes, ...moves]
}

// The proposal and what became of it, as plain text for the model's next turn.
export function proposalForHistory(p: Proposal, state: ProposalState): string {
  const rows = p.changes.map((c) => `${c.sign} ${c.kind} ${c.text}`).join('; ')
  const outcome =
    state.status === 'pending'
      ? 'The user has not decided yet.'
      : state.status === 'discarded'
        ? 'The user discarded it; nothing was changed.'
        : `The user applied ${state.applied} of ${p.changes.length}; the workspace below shows the result.`
  return `[I proposed: ${p.summary} (${rows}). ${outcome}]`
}

export type ProposalState = { status: 'pending' | 'discarded' | 'applied'; applied?: number; rows?: number[] }

// What the model hears back after proposing (D-084): the rows that can't be applied, so it can fix them in the same answer.
export function proposalReport(p: Proposal): string {
  const bad = p.changes.filter((c) => c.problem)
  const shown = `Shown to the user as a checklist of ${p.changes.length} change${p.changes.length === 1 ? '' : 's'}; they decide what to apply.`
  if (!p.changes.length) return 'The proposal had no valid changes. Check the arguments and call it again, or answer in words.'
  if (!bad.length) return `${shown} Don't list the changes again; finish with at most a sentence, or nothing.`
  const rows = bad.map((c) => `- change ${c.n + 1} (${c.raw.op}: ${c.text}): ${c.problem}`).join('\n')
  return (
    `${shown} These rows can't be applied and are switched off:\n${rows}\n` +
    `If you can fix them (copy refs exactly from the workspace), call ${PROPOSE} again with the whole corrected set: it replaces ` +
    'this one. Otherwise finish with at most a sentence.'
  )
}
