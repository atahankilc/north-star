// A table (D-209): a piece on the canvas (`kind: 'table'`), the first lens. Its rows come from a source (source.ts: rules
// any card must meet, then cards and typed names added by hand); its columns are the cards' own fields (type, plane,
// status, tags…, read-only for now, as D-205 shows them) and columns of its own, each with its own kind of value: a
// scale of steps, a number (with a unit), a short text, or a check. The first column is always the row's name: a card's
// live title, or the typed name.
//
// The setup lives on the piece (`table`); the own columns' values in `cells/{tableId}_{row}_{col}` like a matrix's
// (D-204, `matrixId` holding the table's id), so deleting the table or a column takes them along.
//
// The pure part is src/model/table.ts (S7), re-exported here. Every write is an op (S7, D-312: src/ops/table.ts'
// update_table, src/ops/lens.ts' axis_add / axis_remove / axis_update) behind the same signature: the setup and cells
// passed are read from the workspace instead (R5). The setup's whole-list writes (`rows`, `cols`) go through the
// fine-grained ops when the editor's list is one change from what's there now, columns or rows someone else added
// since left aside (model/lens.ts' editorChange: a column added, edited or moved; a row added), so their column, its
// cells and your edit all stay. Anything else is written whole, as before (a concurrent edit can still be lost then).
import type { Card } from './cards'
import { applyUi, runUi, sayRefused, uiCtx } from '../ops/firestore'
import { updateTable } from '../ops/table'
import { axisAdd, axisRemove, axisUpdate } from '../ops/lens'
import { editorChange } from '../model/lens'
import type { Cell } from '../model/matrix'
import type { Row, Source, SourceItem } from '../model/source'
import { NAME_COL, type Column, type TableSetup } from '../model/table'
import type { OpCtx, Plan } from '../ops/types'

export * from '../model/table'

// ---- Writes. Each is one undo step; typing in a field merges into one.

export function setTable(wid: string, id: string, setup: TableSetup, name?: string) {
  return runUi(wid, (ctx) => [updateTable(ctx, { id, setup, ui: true, ...(name ? { name } : {}) })], { label: 'set up a table' })
}

const LABEL = 'change a table'
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const tableIn = (ctx: OpCtx, id: string) => ctx.ws.pieces.find((p) => p.id === id)?.table as TableSetup | undefined

// One whole part as the setup's editors give it, through a fine-grained op when it's one change from what's there.
function partPlan<K extends keyof TableSetup>(ctx: OpCtx, id: string, part: K, value: TableSetup[K] | undefined): Plan {
  const t = tableIn(ctx, id)
  if (t && part === 'cols' && Array.isArray(value)) {
    const ch = editorChange(t.cols, value as Column[], same)
    if (ch && 'add' in ch) return axisAdd(ctx, { id, axis: 'cols', column: ch.add, label: LABEL })
    if (ch && 'move' in ch) return axisUpdate(ctx, { id, axis: 'cols', entry: ch.move.id, move: 'right', label: LABEL })
    if (ch && 'edit' in ch) {
      const change = Object.fromEntries([...new Set([...Object.keys(ch.was), ...Object.keys(ch.edit)])].filter((k) => !same((ch.was as Record<string, unknown>)[k], (ch.edit as Record<string, unknown>)[k])).map((k) => [k, (ch.edit as Record<string, unknown>)[k]]))
      return axisUpdate(ctx, { id, axis: 'cols', entry: ch.edit.id, change, label: LABEL })
    }
  }
  if (t && part === 'rows' && value) {
    const next = value as Source
    const ch = same({ ...t.rows, items: [] }, { ...next, items: [] }) ? editorChange<SourceItem>(t.rows.items, next.items, same) : null
    if (ch && 'add' in ch) return axisAdd(ctx, { id, axis: 'rows', ...(ch.add.cardId ? { card: ch.add.cardId } : { name: ch.add.name ?? '' }), label: LABEL })
  }
  return updateTable(ctx, { id, parts: { [part]: value }, ui: true })
}

export function setTablePart<K extends keyof TableSetup>(wid: string, id: string, part: K, value: TableSetup[K] | undefined, key?: string) {
  return runUi(wid, (ctx) => [partPlan(ctx, id, part, value)], { label: LABEL, ...(key ? { key: `table:${id}:${key}` } : {}) })
}

export const setRows = (wid: string, id: string, rows: Source, key?: string) => setTablePart(wid, id, 'rows', rows, key)

// A typed row at the end; its id, to type its name in ('' when nothing was made).
export async function addNamedRow(wid: string, id: string, _setup: TableSetup, name = '') {
  const ctx = uiCtx(wid)
  if (!ctx) return ''
  let plan
  try {
    plan = axisAdd(ctx, { id, axis: 'rows', name, label: LABEL })
  } catch (e) {
    sayRefused(e, LABEL)
    return ''
  }
  const done = await applyUi(wid, ctx, [plan], { label: LABEL })
  if (!done) return ''
  await done.written
  return plan.ids.$new
}

export function addCardRow(wid: string, id: string, _setup: TableSetup, card: Card) {
  return runUi(wid, (ctx) => [axisAdd(ctx, { id, axis: 'rows', card: card.id, label: LABEL })], { label: LABEL })
}

export function renameRow(wid: string, id: string, _setup: TableSetup, itemId: string, name: string) {
  return runUi(wid, (ctx) => [axisUpdate(ctx, { id, axis: 'rows', entry: itemId, name, label: LABEL })], { label: LABEL, key: `table:${id}:name:${itemId}` })
}

// A row taken out: one added by hand goes with its cells; a card the rules bring is hidden (its cells kept).
export function removeRow(wid: string, id: string, _setup: TableSetup, row: Row, _cells: Cell[]) {
  return runUi(wid, (ctx) => [axisRemove(ctx, { id, axis: 'rows', entry: row.auto ? row.key : (row.item?.id ?? row.key) })], { label: 'take out a row' })
}

export function addColumn(wid: string, id: string, _setup: TableSetup, col: Omit<Column, 'id'>) {
  return runUi(wid, (ctx) => [axisAdd(ctx, { id, axis: 'cols', column: col, label: LABEL })], { label: LABEL })
}

export function editColumn(wid: string, id: string, _setup: TableSetup, colId: string, change: Partial<Column>, key?: string) {
  return runUi(wid, (ctx) => [axisUpdate(ctx, { id, axis: 'cols', entry: colId, change, label: LABEL })], { label: LABEL, ...(key ? { key: `table:${id}:col:${colId}:${key}` } : {}) })
}

// A column's width (or the name column's, NAME_COL) dragged to `w`; undefined goes back to its own.
export function setColumnWidth(wid: string, id: string, _setup: TableSetup, colId: string, w: number | undefined) {
  return runUi(wid, (ctx) => [axisUpdate(ctx, { id, axis: 'cols', entry: colId === NAME_COL ? NAME_COL : colId, width: w ?? null, label: LABEL })], { label: LABEL })
}

export function moveColumn(wid: string, id: string, setup: TableSetup, colId: string, by: -1 | 1) {
  const i = setup.cols.findIndex((c) => c.id === colId)
  const j = i + by
  if (i < 0 || j < 0 || j >= setup.cols.length) return
  return runUi(wid, (ctx) => [axisUpdate(ctx, { id, axis: 'cols', entry: colId, move: by < 0 ? 'left' : 'right', label: LABEL })], { label: LABEL })
}

// A column taken out, with its cells.
export function removeColumn(wid: string, id: string, _setup: TableSetup, colId: string, _cells: Cell[]) {
  return runUi(wid, (ctx) => [axisRemove(ctx, { id, axis: 'cols', entry: colId })], { label: 'take out a column' })
}
