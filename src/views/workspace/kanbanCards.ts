// A kanban holding cards (D-268, docs/specs/priorities.md): its columns are a field's values, and dropping a card in a
// column sets that value. Which cards: its source (the table's rules, D-209), only those the field applies to, and stuck
// to a plane (D-255) only that plane's unless set to every plane. A `no value` column first holds the cards with the field
// unset; dragged out of it, they're rated; dragged into it, the value goes.
//
// Rows (D-269): another field across the columns, `no value` on top, so the kanban becomes a grid of boxes (a column ×
// a row), dropping into one setting both fields. A card shows only when both fields apply to it.
import type { AnyType, Card, CardFields } from '../../data/cards'
import { FEATURE_EFFORTS, FEATURE_IMPACTS, FEATURE_PRIORITIES, FEATURE_STATUSES, isOnPlane, VALIDATIONS } from '../../data/cards'
import type { Edge } from '../../data/edges'
import { rowsOf, type Source } from '../../data/source'
import type { CardField, KanbanSetup } from '../../data/tasks'
import type { Piece } from '../../data/model'
import { confidenceFor, scoreOf } from './cardFacts'

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
// features only shows the features' four; of ideas and features, both lists, the chain's first). Impact runs low → high
// across, high → low down (D-269: the best on top).
export function axisOf(field: CardField, cards: Card[], down = false): CardCol[] {
  const types = new Set(cards.map((c) => c.type))
  const lists = FIELD_VALUES[field].filter((v, _, all) => all.length === 1 || !cards.length || v.types.some((t) => types.has(t)))
  const order = (values: readonly string[]) => (down && field === 'impact' ? [...values].reverse() : values)
  return [
    { id: NO_VALUE, name: 'no value', types: [...new Set(lists.flatMap((l) => l.types))] },
    ...lists.flatMap((l) => order(l.values).map((v) => ({ id: v, name: v, types: l.types, done: v === 'shipped' || v === 'validated' || undefined, out: v === 'invalidated' || undefined }))),
  ]
}
export const columnsOf = (field: CardField, cards: Card[]) => axisOf(field, cards)
export const rowsOfField = (field: CardField, cards: Card[]) => axisOf(field, cards, true)

// Whether a column or a row takes a card: `no value` any it holds; a value only its own types'.
export const takes = (at: CardCol | undefined, card: Card) => !!at && at.types.includes(card.type)

// The value a card sits under on an axis: its own, or `no value`.
export const placeOf = (c: Card, field: CardField, axis: CardCol[]) => {
  const v = valueOf(c, field)
  return v && axis.some((a) => a.id === v) ? v : NO_VALUE
}

// The cards it holds: its source's cards the field applies to (and its rows' field, D-269; typed names left out: they
// aren't cards), stuck to a plane that plane's unless it shows every plane.
export function heldCards(piece: Pick<Piece, 'stuckTo'> & { kanban?: KanbanSetup }, cards: Card[]): Card[] {
  const k = piece.kanban
  const field = k?.colField ?? 'status'
  const row = rowFieldOf(k)
  const source: Source = k?.source ?? { rules: [], items: [] }
  return rowsOf(source, cards)
    .flatMap((r) => (r.card && appliesTo(field, r.card.type) && (!row || appliesTo(row, r.card.type)) ? [r.card] : []))
    .filter((c) => !piece.stuckTo || k?.everyPlane || isOnPlane(c, piece.stuckTo))
}

// Its rows' field (D-269): none, or one that isn't its columns'.
export const rowFieldOf = (k: KanbanSetup | undefined) => (k?.rowField && k.rowField !== (k.colField ?? 'status') ? k.rowField : undefined)

// The cards in each column. No hand order (D-253): by score, best first (D-271: the suggested order's, `score`, unrated
// last), then by type in the chain's order, then by title.
const ORDER: AnyType[] = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package']
type Score = (c: Card) => number | null
const sorted = (list: Card[], score?: Score) =>
  list.sort((a, b) => (score ? (score(b) ?? -1) - (score(a) ?? -1) : 0) || ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || (a.title || '\uffff').localeCompare(b.title || '\uffff'))
export function byColumn(field: CardField, cols: CardCol[], cards: Card[]) {
  const out = new Map<string, Card[]>(cols.map((c) => [c.id, []]))
  for (const c of cards) out.get(placeOf(c, field, cols))!.push(c)
  for (const list of out.values()) sorted(list)
  return out
}

// Each card's score (D-271), for sorting the boxes.
export function scorer(cards: Card[], edges: Edge[]): Score {
  const memo = new Map<string, number | null>()
  return (c) => {
    if (!memo.has(c.id)) memo.set(c.id, scoreOf(c, confidenceFor(c, cards, edges)?.level))
    return memo.get(c.id)!
  }
}

// The cards in each box (D-269), keyed `col|row` (row '' without rows).
export const boxKey = (col: string, row: string) => `${col}|${row}`
export function byBox(colField: CardField, cols: CardCol[], rowField: CardField | undefined, rows: CardCol[], cards: Card[], score?: Score) {
  const out = new Map<string, Card[]>()
  for (const c of cards) {
    const k = boxKey(placeOf(c, colField, cols), rowField ? placeOf(c, rowField, rows) : '')
    out.set(k, [...(out.get(k) ?? []), c])
  }
  for (const list of out.values()) sorted(list, score)
  return out
}

// What dropping a card in a box writes (both fields at once, one undo step); null: nothing changes. A box whose column
// or row doesn't take it is never offered.
export function boxPatch(c: Card, colField: CardField, col: string, rowField: CardField | undefined, row: string): Partial<CardFields> | null {
  const patch = { ...patchFor(c, colField, col), ...(rowField ? patchFor(c, rowField, row) : null) }
  return Object.keys(patch).length ? patch : null
}

// How sure we are of it, on its sheet: the one rule (D-271, cardFacts.ts); customers, problems, ideas: nothing.
export const sureOf = (c: Card, cards: Card[], edges: Edge[]) => confidenceFor(c, cards, edges)?.level

// Templates for a new kanban (D-268): today's tasks, features by status, priorities (D-271).
export type KanbanTemplate = { key: string; name: string; hint: string; setup: () => Partial<KanbanSetup> }
export const KANBAN_TEMPLATES: KanbanTemplate[] = [
  { key: 'tasks', name: 'tasks', hint: 'todo · doing · done; the team’s work', setup: () => ({}) },
  {
    key: 'features',
    name: 'features by status',
    hint: 'idea · planned · building · shipped; drag to move one on',
    setup: () => ({ holds: 'cards', colField: 'status', source: { rules: [{ field: 'type', values: ['feature'] }], items: [] } }),
  },
  // Priorities (D-138, D-271): features and packages, effort across, impact down, the four corners named.
  {
    key: 'priorities',
    name: 'priorities',
    hint: 'effort × impact; quick wins, big bets, fill-ins, money pits; a suggested order beside',
    setup: () => ({
      holds: 'cards',
      colField: 'effort',
      rowField: 'impact',
      source: { rules: [{ field: 'type', values: ['feature', 'package'] }], items: [] },
      names: [
        { col: 'S', row: 'high', name: 'quick wins', tone: 'good' },
        { col: 'L', row: 'high', name: 'big bets' },
        { col: 'S', row: 'low', name: 'fill-ins' },
        { col: 'L', row: 'low', name: 'money pits', tone: 'bad' },
      ],
    }),
  },
]

// Whether a kanban is set up as priorities (effort across, impact down): then its suggested order can show beside it.
export const isPriorities = (k: KanbanSetup | undefined) => k?.holds === 'cards' && (k.colField ?? 'status') === 'effort' && rowFieldOf(k) === 'impact'
