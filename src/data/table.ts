// A table (D-209): a piece on the canvas (`kind: 'table'`), the first lens. Its rows come from a source (source.ts: rules
// any card must meet, then cards and typed names added by hand); its columns are the cards' own fields (type, plane,
// status, tags…, read-only for now, as D-205 shows them) and columns of its own, each with its own kind of value: a
// scale of steps, a number (with a unit), a short text, or a check. The first column is always the row's name: a card's
// live title, or the typed name.
//
// The setup lives on the piece (`table`); the own columns' values in `cells/{tableId}_{row}_{col}` like a matrix's
// (D-204, `matrixId` holding the table's id), so deleting the table or a column takes them along.
import { deleteField, updateDoc, writeBatch } from 'firebase/firestore'
import type { Card } from './cards'
import { db } from './firebase'
import { tracked } from './history'
import { cellKey, cellRef, newId, SCALES, type Cell, type Step } from './matrix'
import { pieceRef } from './pieces'
import type { Row, Rule, Source } from './source'

// A card's own fields, shown as they are.
export const FIELDS = ['type', 'plane', 'status', 'tags', 'regions', 'priority', 'impact', 'effort', 'evidence'] as const
export type Field = (typeof FIELDS)[number]

export const OWN_KINDS = ['scale', 'number', 'text', 'check'] as const
export type OwnKind = (typeof OWN_KINDS)[number]

export type Column = {
  id: string
  // A card's field; or, without one, a column of its own.
  field?: Field
  name?: string
  kind?: OwnKind
  // A scale's steps, low to high (kept when the kind changes, so changing back finds them).
  steps?: Step[]
  unit?: string
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

const own = (name: string, kind: OwnKind, extra: Partial<Column> = {}): Column => ({ id: newId(), name, kind, ...extra })
const field = (f: Field): Column => ({ id: newId(), field: f })
const rule = (r: Rule) => r

// Setups to start from; the setup changes any of it after.
export const TEMPLATES: { key: string; name: string; hint: string; setup: () => TableSetup }[] = [
  {
    key: 'cards',
    name: 'every card',
    hint: 'every card, its type, plane and status',
    setup: () => ({ rows: { rules: [], items: [] }, cols: [field('type'), field('plane'), field('status'), field('tags')] }),
  },
  {
    key: 'features',
    name: 'features',
    hint: 'features by priority, impact and effort',
    setup: () => ({
      rows: { rules: [rule({ field: 'type', values: ['feature'] })], items: [] },
      cols: [field('status'), field('priority'), field('impact'), field('effort'), own('cost', 'number')],
    }),
  },
  {
    key: 'competitors',
    name: 'competitors',
    hint: 'competitors by region, price and threat',
    setup: () => ({
      rows: { rules: [rule({ field: 'type', values: ['competitor'] })], items: [] },
      cols: [field('regions'), field('tags'), own('price', 'text'), own('threat', 'scale', { steps: SCALES[2].steps })],
    }),
  },
  {
    key: 'blank',
    name: 'blank',
    hint: 'rows you name, columns you make',
    setup: () => ({
      rows: { rules: [], items: [{ id: newId(), name: 'row 1' }, { id: newId(), name: 'row 2' }] },
      manual: true,
      cols: [own('notes', 'text'), own('done', 'check')],
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

// ---- Writes. Each is one undo step; typing in a field merges into one.

export function setTable(wid: string, id: string, setup: TableSetup, name?: string) {
  const ref = pieceRef(wid, id)
  return tracked('set up a table', [ref], () => updateDoc(ref, { table: clean(setup), ...(name ? { name } : {}), updatedAt: Date.now() }))
}

export function setTablePart<K extends keyof TableSetup>(wid: string, id: string, part: K, value: TableSetup[K] | undefined, key?: string) {
  const ref = pieceRef(wid, id)
  return tracked(
    'change a table',
    [ref],
    () => updateDoc(ref, { [`table.${part}`]: value === undefined ? deleteField() : clean(value), updatedAt: Date.now() }),
    key ? { key: `table:${id}:${key}` } : {},
  )
}

export const setRows = (wid: string, id: string, rows: Source, key?: string) => setTablePart(wid, id, 'rows', rows, key)

// A typed row at the end; its id, to type its name in.
export async function addNamedRow(wid: string, id: string, setup: TableSetup, name = '') {
  const item = { id: newId(), name }
  await setRows(wid, id, { ...setup.rows, items: [...setup.rows.items, item] })
  return item.id
}

export function addCardRow(wid: string, id: string, setup: TableSetup, card: Card) {
  const s = setup.rows
  // A card the rules bring but taken out comes back instead.
  if (s.hide?.includes(card.id)) return setRows(wid, id, { ...s, hide: s.hide.filter((h) => h !== card.id) })
  return setRows(wid, id, { ...s, items: [...s.items, { id: newId(), cardType: card.type, cardId: card.id }] })
}

export function renameRow(wid: string, id: string, setup: TableSetup, itemId: string, name: string) {
  const items = setup.rows.items.map((i) => (i.id === itemId ? { ...i, name: name.slice(0, 200) } : i))
  return setRows(wid, id, { ...setup.rows, items }, `name:${itemId}`)
}

// A row taken out: one added by hand goes with its cells; a card the rules bring is hidden (its cells kept).
export function removeRow(wid: string, id: string, setup: TableSetup, row: Row, cells: Cell[]) {
  const s = setup.rows
  const next: Source = row.auto ? { ...s, hide: [...(s.hide ?? []), row.key] } : { ...s, items: s.items.filter((i) => i !== row.item) }
  const gone = row.auto ? [] : cells.filter((c) => c.matrixId === id && c.row === row.key)
  return withCells(wid, id, 'take out a row', { 'table.rows': clean(next) }, gone)
}

export function addColumn(wid: string, id: string, setup: TableSetup, col: Omit<Column, 'id'>) {
  return setTablePart(wid, id, 'cols', [...setup.cols, { id: newId(), ...col }])
}

export function editColumn(wid: string, id: string, setup: TableSetup, colId: string, change: Partial<Column>, key?: string) {
  const cols = setup.cols.map((c) => (c.id === colId ? { ...c, ...change } : c))
  return setTablePart(wid, id, 'cols', cols, key ? `col:${colId}:${key}` : undefined)
}

export function moveColumn(wid: string, id: string, setup: TableSetup, colId: string, by: -1 | 1) {
  const i = setup.cols.findIndex((c) => c.id === colId)
  const j = i + by
  if (i < 0 || j < 0 || j >= setup.cols.length) return
  const cols = [...setup.cols]
  ;[cols[i], cols[j]] = [cols[j], cols[i]]
  return setTablePart(wid, id, 'cols', cols)
}

// A column taken out, with its cells.
export function removeColumn(wid: string, id: string, setup: TableSetup, colId: string, cells: Cell[]) {
  const gone = cells.filter((c) => c.matrixId === id && c.col === colId)
  const change: Record<string, unknown> = { 'table.cols': clean(setup.cols.filter((c) => c.id !== colId)) }
  if (setup.sort?.col === colId) change['table.sort'] = deleteField()
  return withCells(wid, id, 'take out a column', change, gone)
}

// The setup changed and some cells deleted, together.
function withCells(wid: string, id: string, what: string, change: Record<string, unknown>, gone: Cell[]) {
  const ref = pieceRef(wid, id)
  const refs = [ref, ...gone.map((c) => cellRef(wid, cellKey(c.matrixId, c.row, c.col)))]
  return tracked(what, refs, async () => {
    for (let i = 0; i < refs.length; i += 450) {
      const batch = writeBatch(db())
      if (i === 0) batch.update(ref, { ...change, updatedAt: Date.now() })
      refs.slice(Math.max(1, i), i + 450).forEach((r) => batch.delete(r))
      await batch.commit()
    }
  })
}

// Firestore takes no `undefined`: fields left unset are dropped.
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}
