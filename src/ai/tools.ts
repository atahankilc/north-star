// The assistant's one tool (D-074): propose a set of changes. Nothing is written until the user accepts some of
// them in the chat; then they go through src/data/assistant.ts as one undo step. Deletes too (D-075), with their cascade.
import type { AssistantWrite, ChangeRef } from '../data/assistant'
import { linked } from '../data/edges'
import { COVERAGES, FEATURE_EFFORTS, FEATURE_PRIORITIES, FEATURE_STATUSES, type BoardType, type NodeType } from '../data/model'
import { CARD_H, CARD_W, findFreeSpot } from '../views/canvas/cardLayout'
import type { WorkspaceCtx } from '../views/workspace/context'
import type { ItemRef } from './context'

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
  sign: '+' | '~' | '→' | '▦' | '−'
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
const refKey = (v: unknown) => s(v)?.replace(/^\[|\]$/g, '')
const clip = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

export function parseProposal(args: string, refs: Map<string, ItemRef>): Proposal {
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
          detail: [s(raw.url), tagText(raw.tags), s(raw.description) && clip(s(raw.description)!)].filter(Boolean).join(' · ') || undefined,
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
          detail: [s(raw.category), s(raw.description) && clip(s(raw.description)!)].filter(Boolean).join(' · ') || undefined,
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
          detail: edits.join(' · ') || undefined,
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
    for (const field of ['target', 'from', 'to', 'competitor', 'feature', 'near']) {
      const d = deleting.get(refKey(c.raw[field]) ?? '')
      if (d !== undefined && !c.clashes.includes(d)) c.clashes.push(d)
    }
  }
  return { summary: s(data.summary) ?? 'Proposed changes', changes }
}

function tagText(v: unknown): string {
  return Array.isArray(v) ? v.map((t) => `#${String(t).replace(/^#/, '')}`).join(' ') : ''
}

// Which rows can still be applied against the workspace as it is now (an item may have gone since).
export function stillValid(change: Change, ws: WorkspaceCtx, refs: Map<string, ItemRef>): string | undefined {
  if (change.problem) return change.problem
  const exists = new Set<string>()
  for (const list of [ws.customers, ws.problems, ws.ideas, ws.features, ws.competitors, ws.competitorFeatures]) for (const n of list) exists.add(n.id)
  for (const k of ['target', 'from', 'to', 'competitor', 'feature', 'near']) {
    const r = refs.get(refKey(change.raw[k]) ?? '')
    if (r && !exists.has(r.id)) return `${r.name} was deleted`
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
  const cards = [...position.values()]
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

  return accepted.map((c): AssistantWrite => {
    const r = c.raw
    switch (r.op) {
      case 'add_card': {
        const type = r.type as BoardType
        const at = spot(s(r.key)!, type, r.near)
        const extra = type === 'feature' ? { priority: text(r.priority), status: text(r.status), effort: text(r.effort) } : {}
        return {
          do: 'create',
          key: s(r.key)!,
          type,
          fields: compact({ title: text(r.title) ?? 'Untitled', body: text(r.notes), tags: tags(r.tags), ...extra, ...at }),
        }
      }
      case 'add_competitor': {
        const at = spot(s(r.key)!, 'competitor', r.near)
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
