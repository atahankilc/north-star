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
import type { Rule, Source } from './source'

export { FIELDS, OWN_KINDS, COL_W } from './shapes'
export type { Field, OwnKind } from './shapes'
import type { Field, OwnKind } from './shapes'

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
export const COL_NAME_MAX = 40
export const CHECKED = 'yes'
export const NAME_COL = 'name'

// The page sizes the dock offers (D-213).
export const PAGE_SIZES = [10, 25, 50, 100]

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

