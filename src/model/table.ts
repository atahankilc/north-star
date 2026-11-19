// A table (D-209), without Firebase (S7, D-312: moved from data/table.ts, which re-exports it and keeps the writes):
// a piece on the canvas (`kind: 'table'`), the first lens. Its rows come from a source (source.ts: rules
// any card must meet, then cards and typed names added by hand); its columns are the cards' own fields (type, plane,
// status, tags…, read-only for now, as D-205 shows them) and columns of its own, each with its own kind of value: a
// scale of steps, a number (with a unit), a short text, or a check. The first column is always the row's name: a card's
// live title, or the typed name.
//
// The setup lives on the piece (`table`); the own columns' values in `cells/{tableId}_{row}_{col}` like a matrix's
// (D-204, `matrixId` holding the table's id), so deleting the table or a column takes them along.
import type { Cell, Step } from './matrix'
import { newId, SCALES } from './scales'
import { statusOf, type Row, type Rule, type Source } from './source'
import type { Card } from './cards'

export { FIELDS, OWN_KINDS, COL_W } from './shapes'
export type { Field, OwnKind } from './shapes'
import type { Field, OwnKind } from './shapes'
import { TABLE_COL_NAME_MAX as COL_NAME_MAX } from './limits'
export { COL_NAME_MAX }

export type Column = {
  id: string
  // A card's field; or, without one, a column of its own.
  field?: Field
  name?: string
  kind?: OwnKind
  // A scale's steps, low to high (kept when the kind changes, so changing back finds them).
  steps?: Step[]
  unit?: string
  // Its width in the table's px, dragged from its head's right edge; unset = its kind's own.
  width?: number
}

export type TableSetup = {
  rows: Source
  // Only what's added by hand: the rules bring no cards (a list of names).
  manual?: boolean
  cols: Column[]
  // Sorted by a column (`name` for the first), shared by everyone; unset = the source's order.
  sort?: { col: string; desc?: boolean }
  // Rows a page (D-213), shared; unset = all on one page. Which page you're on is yours (Table.tsx's useTableUi).
  pageSize?: number
  // The name column's width, dragged like a column's; unset = the default.
  nameWidth?: number
}

// firestore.rules' validTable allows these.
export const MAX_COLS = 30
export const CHECKED = 'yes'
export const NAME_COL = 'name'

// The page sizes the dock offers (D-213).

// What a column is called in its head.
export const colName = (c: Column) => c.name || c.field || 'column'

const own = (id: () => string, name: string, kind: OwnKind, extra: Partial<Column> = {}): Column => ({ id: id(), name, kind, ...extra })
const field = (id: () => string, f: Field): Column => ({ id: id(), field: f })
const rule = (r: Rule) => r

// Setups to start from; the setup changes any of it after.
export const TEMPLATES: { key: string; name: string; hint: string; setup: (id?: () => string) => TableSetup }[] = [
  {
    key: 'cards',
    name: 'every card',
    hint: 'every card, its type, plane and status',
    setup: (id = newId) => ({ rows: { rules: [], items: [] }, cols: [field(id, 'type'), field(id, 'plane'), field(id, 'status'), field(id, 'tags')] }),
  },
  {
    key: 'features',
    name: 'features',
    hint: 'features by priority, impact and effort',
    setup: (id = newId) => ({
      rows: { rules: [rule({ field: 'type', values: ['feature'] })], items: [] },
      cols: [field(id, 'status'), field(id, 'priority'), field(id, 'impact'), field(id, 'effort'), own(id, 'cost', 'number')],
    }),
  },
  {
    key: 'competitors',
    name: 'competitors',
    hint: 'competitors by region, price and threat',
    setup: (id = newId) => ({
      rows: { rules: [rule({ field: 'type', values: ['competitor'] })], items: [] },
      cols: [field(id, 'regions'), field(id, 'tags'), own(id, 'price', 'text'), own(id, 'threat', 'scale', { steps: SCALES[2].steps })],
    }),
  },
  {
    key: 'blank',
    name: 'blank',
    hint: 'rows you name, columns you make',
    setup: (id = newId) => ({
      rows: { rules: [], items: [{ id: id(), name: 'row 1' }, { id: id(), name: 'row 2' }] },
      manual: true,
      cols: [own(id, 'notes', 'text'), own(id, 'done', 'check')],
    }),
  },
]

export const emptyTable = (): TableSetup => TEMPLATES[0].setup()

// The steps a new scale column starts with.
export const DEFAULT_STEPS = SCALES[2].steps

// What an own column's cell shows: a step, a number, a text, a check, or nothing.
export function readOwn(col: Column, cell: Cell | undefined): { step?: Step; number?: number; text?: string; checked?: boolean } {
  const v = cell?.value
  if (v === undefined) return {}
  switch (col.kind) {
    case 'scale':
      return typeof v === 'string' ? { step: (col.steps ?? DEFAULT_STEPS).find((s) => s.id === v) } : {}
    case 'number':
      return typeof v === 'number' ? { number: v } : {}
    case 'check':
      return v === CHECKED ? { checked: true } : {}
    default:
      return typeof v === 'string' && v ? { text: v } : {}
  }
}


// ---- What a table reads, for everyone who reads one (the app's view, the finder, the agent): one text per field and
// one order, so the agent sees the rows as the person does (D-388).

// A table's cells by `row|col` (a matrix's too: `matrixId` holds either's id), and the one at a row and a column.
const cellKey = (row: string, col: string) => `${row}|${col}`
export const cellsByKey = (cells: Cell[], pieceId: string) => new Map(cells.filter((c) => c.matrixId === pieceId).map((c) => [cellKey(c.row, c.col), c]))
export const cellAt = (byKey: Map<string, Cell>, row: string, col: string) => byKey.get(cellKey(row, col))

// What the field's text needs from outside the card: the names of the planes it's on (its home first, D-281), and its
// evidence counted (cardFacts.ts' `proof`).
export type FieldCtx = {
  planes: (card: Card) => string[]
  proof: (card: Card) => { supports: number; contradicts: number } | undefined
}

// A card's field as its column shows it.
export function fieldText(ctx: FieldCtx, c: Card | undefined, field: Field): string {
  if (!c) return ''
  switch (field) {
    case 'type':
      return c.type
    case 'plane':
      return ctx.planes(c).filter(Boolean).join(', ')
    case 'status':
      return statusOf(c) ?? ''
    case 'tags':
      return (c.tags ?? []).map((t) => `#${t}`).join(' ')
    case 'regions':
      return (c.regions ?? []).join(' · ')
    case 'evidence': {
      const p = ctx.proof(c)
      return p ? [p.supports && `+${p.supports}`, p.contradicts && `−${p.contradicts}`].filter(Boolean).join(' ') : ''
    }
    default:
      return c[field] ?? ''
  }
}

// What a row sorts by in a column: text in lower case, a step's place on its scale, a number, a check as 1; '' = empty.
export function sortKey(col: Column | typeof NAME_COL, row: Row, text: (row: Row, field: Field) => string, byKey: Map<string, Cell>): string | number {
  if (col === NAME_COL) return row.name.toLowerCase()
  if (col.field) return text(row, col.field).toLowerCase()
  const v = readOwn(col, cellAt(byKey, row.key, col.id))
  if (v.step) return (col.steps ?? DEFAULT_STEPS).indexOf(v.step)
  if (v.number !== undefined) return v.number
  if (v.checked) return 1
  return v.text?.toLowerCase() ?? ''
}

// The rows as the table's sort says (its source's order without one); empty ones last, whichever way.
export function sortedRows(setup: TableSetup, rows: Row[], text: (row: Row, field: Field) => string, byKey: Map<string, Cell>): Row[] {
  const s = setup.sort
  const col = s && (s.col === NAME_COL ? NAME_COL : setup.cols.find((c) => c.id === s.col))
  if (!s || !col) return rows
  const keyed = rows.map((row) => ({ row, k: sortKey(col, row, text, byKey) }))
  keyed.sort((a, b) => {
    if ((a.k === '') !== (b.k === '')) return a.k === '' ? 1 : -1
    const d = typeof a.k === 'number' && typeof b.k === 'number' ? a.k - b.k : String(a.k).localeCompare(String(b.k))
    return s.desc ? -d : d
  })
  return keyed.map((x) => x.row)
}
