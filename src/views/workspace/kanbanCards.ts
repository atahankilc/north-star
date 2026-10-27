// A kanban holding cards (D-268, docs/specs/priorities.md): its columns are a field's values, and dropping a card in a
// column sets that value. Which cards: its source (the table's rules, D-209), only those the field applies to, and stuck
// to a plane (D-255) only that plane's unless set to every plane. A `no value` column first holds the cards with the field
// unset; dragged out of it, they're rated; dragged into it, the value goes.
import type { AnyType, Card, CardFields } from '../../data/cards'
import { FEATURE_EFFORTS, FEATURE_IMPACTS, FEATURE_PRIORITIES, FEATURE_STATUSES, VALIDATIONS } from '../../data/cards'
import type { Edge } from '../../data/edges'
import { FOR } from '../../data/edges'
import { rowsOf, type Source } from '../../data/source'
import type { CardField, KanbanSetup } from '../../data/tasks'
import type { Piece } from '../../data/model'
import { packageTree } from './cardInside'
import { confidenceOf } from './cardFacts'

// The column of cards with the field unset.
export const NO_VALUE = '-'

export const FIELD_NAME: Record<CardField, string> = { status: 'status', impact: 'impact', effort: 'effort', priority: 'priority' }

// A status is a customer's, problem's or idea's validation (D-137), a feature's own (D-138): two lists, each for its types.
const VALIDATED: AnyType[] = ['customer', 'problem', 'idea']
type Values = { values: readonly string[]; types: AnyType[] }
const FIELD_VALUES: Record<CardField, Values[]> = {
  status: [
    { values: VALIDATIONS, types: VALIDATED },
    { values: FEATURE_STATUSES, types: ['feature'] },
  ],
  impact: [{ values: FEATURE_IMPACTS, types: ['feature', 'package'] }],
  effort: [{ values: FEATURE_EFFORTS, types: ['feature', 'package'] }],
  // firestore.rules allows a priority on features only.
  priority: [{ values: FEATURE_PRIORITIES, types: ['feature'] }],
}

export const appliesTo = (field: CardField, type: AnyType) => FIELD_VALUES[field].some((v) => v.types.includes(type))

// Which value a card has: its validation for a customer, problem or idea; the field itself otherwise.
export function valueOf(c: Card, field: CardField): string | undefined {
  if (field === 'status') return VALIDATED.includes(c.type) ? c.validation : c.status
  return c[field]
}

// What dropping it in a column writes; null: nothing (the column isn't for its type, or it's there already).
export function patchFor(c: Card, field: CardField, col: string): Partial<CardFields> | null {
  const value = col === NO_VALUE ? undefined : col
  if (value !== undefined && !FIELD_VALUES[field].some((v) => v.types.includes(c.type) && v.values.includes(value))) return null
  if (value === valueOf(c, field)) return null
  const key = field === 'status' && VALIDATED.includes(c.type) ? 'validation' : field
  return { [key]: value } as Partial<CardFields>
}

export type CardCol = {
  id: string
  name: string
  // The types it takes (a status column only its own types'); `no value` takes every type.
  types: AnyType[]
  // Finished (shipped, validated): its name green, as a kanban's finished column.
  done?: boolean
  // Ruled out (invalidated): its name magenta.
  out?: boolean
}

// Its columns: `no value`, then the values of the field, for the types of the cards it holds (a status kanban of
// features only shows the features' four; of ideas and features, both lists, the chain's first). Impact runs low → high.
export function columnsOf(field: CardField, cards: Card[]): CardCol[] {
  const types = new Set(cards.map((c) => c.type))
  const lists = FIELD_VALUES[field].filter((v, _, all) => all.length === 1 || !cards.length || v.types.some((t) => types.has(t)))
  return [
    { id: NO_VALUE, name: 'no value', types: [...new Set(lists.flatMap((l) => l.types))] },
    ...lists.flatMap((l) => l.values.map((v) => ({ id: v, name: v, types: l.types, done: v === 'shipped' || v === 'validated' || undefined, out: v === 'invalidated' || undefined }))),
  ]
}

// The cards it holds: its source's cards the field applies to (typed names left out: they aren't cards), stuck to a plane
// that plane's unless it shows every plane.
export function heldCards(piece: Pick<Piece, 'stuckTo'> & { kanban?: KanbanSetup }, cards: Card[]): Card[] {
  const k = piece.kanban
  const field = k?.colField ?? 'status'
  const source: Source = k?.source ?? { rules: [], items: [] }
  return rowsOf(source, cards)
    .flatMap((r) => (r.card && appliesTo(field, r.card.type) ? [r.card] : []))
    .filter((c) => !piece.stuckTo || k?.everyPlane || c.pieceId === piece.stuckTo)
}

// The cards in each column. No hand order (D-253): by type in the chain's order, then by title (P3 sorts by score).
const ORDER: AnyType[] = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package']
export function byColumn(field: CardField, cols: CardCol[], cards: Card[]) {
  const out = new Map<string, Card[]>(cols.map((c) => [c.id, []]))
  for (const c of cards) {
    const v = valueOf(c, field)
    const at = v && out.has(v) ? v : NO_VALUE
    out.get(at)!.push(c)
  }
  for (const list of out.values()) list.sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || (a.title || '￿').localeCompare(b.title || '￿'))
  return out
}

// How sure we are of it, on its sheet: a package from what it holds (D-239), a feature from the ideas linked to it and the
// problems they solve, by the same rule (D-138's share; P3 makes this one rule everywhere, D-253). Others: nothing.
export function sureOf(c: Card, cards: Card[], edges: Edge[]) {
  if (c.type === 'package') return confidenceOf(packageTree(c, cards, edges).map((r) => r.card))
  if (c.type !== 'feature') return undefined
  const byId = new Map(cards.map((x) => [x.id, x]))
  const ideas = edges
    .filter((e) => e.kind !== FOR && e.kind !== 'part-of' && ((e.fromId === c.id && e.toType === 'idea') || (e.toId === c.id && e.fromType === 'idea')))
    .flatMap((e) => byId.get(e.fromId === c.id ? e.toId : e.fromId) ?? [])
  const problems = ideas.flatMap((i) => edges.filter((e) => e.kind === 'solves' && e.fromId === i.id).flatMap((e) => byId.get(e.toId) ?? []))
  return confidenceOf([...ideas, ...problems])
}

// Templates for a new kanban (D-268): today's tasks, or features by status. P3 adds priorities.
export type KanbanTemplate = { key: string; name: string; hint: string; setup: () => Partial<KanbanSetup> }
export const KANBAN_TEMPLATES: KanbanTemplate[] = [
  { key: 'tasks', name: 'tasks', hint: 'todo · doing · done; the team’s work', setup: () => ({}) },
  {
    key: 'features',
    name: 'features by status',
    hint: 'idea · planned · building · shipped; drag to move one on',
    setup: () => ({ holds: 'cards', colField: 'status', source: { rules: [{ field: 'type', values: ['feature'] }], items: [] } }),
  },
]
