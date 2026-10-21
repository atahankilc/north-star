// Where a lens's rows come from (D-209): a list of rules, every one of which a card must meet, then entries added by
// hand (a card, or just a typed name). No rule is required: no rules at all is every card on every plane. A rule is a
// field, `is` or `is not`, and the values it takes (any of them): a plane, a card type, a status, a tag; or a few words
// the title holds. Generic on purpose, so a table (and later a matrix's axes) can show any slice of the workspace.
import type { Card } from './cards'

export const RULE_FIELDS = ['plane', 'type', 'status', 'tag', 'title'] as const
export type RuleField = (typeof RULE_FIELDS)[number]

export type Rule = {
  field: RuleField
  // `is not`: the cards that don't match.
  not?: boolean
  // Any of these; for `title`, the words it holds (the first value).
  values: string[]
  // Set by itself (D-210): the plane the table is stuck to. Changing it makes it yours; letting go takes it away.
  auto?: boolean
}

// Added by hand, after the rules' cards: one card, or a typed name.
export type SourceItem = { id: string; name?: string; cardType?: Card['type']; cardId?: string }

export type Source = {
  rules: Rule[]
  // Cards the rules bring, taken out by hand.
  hide?: string[]
  items: SourceItem[]
}

// firestore.rules' validSource allows these.
export const MAX_RULES = 12
export const MAX_VALUES = 50
export const MAX_ITEMS = 200
export const VALUE_MAX = 200

// A card's status: a customer's, problem's or idea's validation (D-137), a feature's own (D-138).
export const statusOf = (c: Card) => c.validation ?? c.status

export const STATUSES = ['hypothesis', 'testing', 'validated', 'invalidated', 'idea', 'planned', 'building', 'shipped']

function meets(c: Card, r: Rule) {
  const v = r.values
  let hit: boolean
  switch (r.field) {
    case 'plane':
      hit = v.includes(c.pieceId)
      break
    case 'type':
      hit = v.includes(c.type)
      break
    case 'status': {
      const s = statusOf(c)
      hit = !!s && v.includes(s)
      break
    }
    case 'tag':
      hit = !!c.tags?.some((t) => v.includes(t))
      break
    case 'title': {
      const words = (v[0] ?? '').trim().toLowerCase()
      hit = !words || c.title.toLowerCase().includes(words)
      break
    }
  }
  return r.not ? !hit : hit
}

// A rule with nothing picked yet doesn't narrow anything: it's being set up.
const active = (r: Rule) => r.values.some((x) => x.trim())

export const matches = (c: Card, rules: Rule[]) => rules.every((r) => !active(r) || meets(c, r))

// One row as shown: its key (the card's id or the entry's), its name, and the card or entry behind it. `auto`: the rules
// brought it.
export type Row = { key: string; name: string; card?: Card; item?: SourceItem; auto: boolean }

const TYPE_ORDER: Card['type'][] = ['customer', 'problem', 'competitor', 'idea', 'feature']
// The chain's order (D-045), then by title, unnamed last.
const byChain = (a: Card, b: Card) =>
  TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || (a.title ? (b.title ? a.title.localeCompare(b.title) : -1) : b.title ? 1 : 0)

// The rules' cards, then what was added by hand. A card added by hand that the rules already bring shows once; a card
// that's gone is left out (its cells stay, and come back with ⌘Z). `fromRules` false: only what was added by hand.
export function rowsOf(s: Source, cards: Card[], fromRules = true): Row[] {
  const hidden = new Set(s.hide ?? [])
  const auto = fromRules ? cards.filter((c) => !hidden.has(c.id) && matches(c, s.rules)).sort(byChain) : []
  const seen = new Set(auto.map((c) => c.id))
  const byId = new Map(cards.map((c) => [c.id, c]))
  const out: Row[] = auto.map((c) => ({ key: c.id, name: c.title, card: c, auto: true }))
  for (const item of s.items) {
    if (item.cardId) {
      const c = byId.get(item.cardId)
      if (!c || seen.has(c.id)) continue
      seen.add(c.id)
      out.push({ key: c.id, name: c.title, card: c, item, auto: false })
    } else out.push({ key: item.id, name: item.name ?? '', item, auto: false })
  }
  return out
}

// The values a rule can pick from, as the workspace has them now.
export function choicesOf(field: RuleField, cards: Card[], planes: { id: string; name?: string }[]): { value: string; label: string }[] {
  switch (field) {
    case 'plane':
      return planes.map((p) => ({ value: p.id, label: p.name || 'unnamed plane' }))
    case 'type':
      return TYPE_ORDER.map((t) => ({ value: t, label: t }))
    case 'status':
      return STATUSES.map((s) => ({ value: s, label: s }))
    case 'tag':
      return [...new Set(cards.flatMap((c) => c.tags ?? []))].sort().map((t) => ({ value: t, label: `#${t}` }))
    case 'title':
      return []
  }
}
