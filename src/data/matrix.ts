// A matrix (D-204): a piece on the canvas (`kind: 'matrix'`) that crosses two lists and fills the cells between them.
// Generic on purpose: the old features × competitors matrix (D-133, D-136) is one setup of it, not the only one.
//
// Each axis (rows, columns) is a list: every card of one type (on any plane, or one plane's), new ones joining by
// themselves, and entries added by hand, each a card or just a typed name. A card's row reads its live title.
// The cells hold one kind of value for the whole matrix: a scale of named steps (○ ◐ ● ★, ✓ ✕, 1–5…, editable), a
// number or a short text; each cell may also carry a note, and, when the matrix allows them, `not relevant` (—, left out
// of the readings) and how sure it is (~ inferred, ? a guess). The totals sum up each row and column (D-212).
//
// The setup lives on the piece (`matrix`); the cells in `cells/{matrixId}_{row}_{col}`, so a cell can't be made twice.
// A row or column is keyed by its card's id, or by its typed entry's own id.
//
// An axis may unfold its cards into what they're made of (D-249): a feature into what it's judged on (its `criteria`,
// D-133). Each is a row (or column) of its own under the card, `card~criterion`, its cells ordinary cells; the card's
// own cells then read from them (rollUp), folded as one small square each. Shown open or folded per card, shared.
//
// The pure part (types, templates, entries, readings) is src/model/matrix.ts (S7), re-exported here. Every write is an
// op (S7, D-312: src/ops/matrix.ts' update_matrix, src/ops/lens.ts' axis_add / axis_remove / axis_update /
// update_cell) behind the same signature: the setup and cells passed are read from the workspace instead (R5) and kept
// for the callers; labels, undo keys and typing merges as before.
import { collection, doc } from 'firebase/firestore'
import type { Card } from './cards'
import { db } from './firebase'
import { applyUi, runUi, sayRefused, uiCtx } from '../ops/firestore'
import { updateMatrix } from '../ops/matrix'
import { axisAdd, axisRemove, axisUpdate, updateCell } from '../ops/lens'
import { editorChange } from '../model/lens'
import type { AxisItem, Cell, Entry, MatrixSetup } from '../model/matrix'
import type { Tone } from '../model/shapes'

export * from '../model/matrix'

export const TONE_VAR: Record<Tone, string> = {
  dim: 'var(--fg-dim)',
  fg: 'var(--fg)',
  cyan: 'var(--accent-cyan)',
  yellow: 'var(--accent-yellow)',
  magenta: 'var(--accent-magenta)',
  green: 'var(--accent-green)',
  blue: 'var(--accent-blue)',
}

const cellsCol = (wid: string) => collection(db(), 'workspaces', wid, 'cells')
export const cellRef = (wid: string, id: string) => doc(cellsCol(wid), id)

// ---- Writes. Each is one undo step; typing in a field merges into one.

// A card on an unfolding axis shown open or folded (D-249), for everyone.
export function setOpen(wid: string, id: string, _setup: MatrixSetup, which: 'rows' | 'cols', keys: string[], open: boolean) {
  return runUi(wid, (ctx) => [updateMatrix(ctx, { id, [which]: open ? { open: keys } : { fold: keys } })], { label: 'change a matrix' })
}

// The whole setup at once (a template).
export function setSetup(wid: string, id: string, setup: MatrixSetup, name?: string) {
  return runUi(wid, (ctx) => [updateMatrix(ctx, { id, setup, ui: true, ...(name ? { name } : {}) })], { label: 'set up a matrix' })
}

const sameItem = (a: AxisItem, b: AxisItem) => a.name === b.name && a.cardId === b.cardId && a.cardType === b.cardType
const sameAxisBut = (a: object, b: object) => JSON.stringify({ ...a, items: [] }) === JSON.stringify({ ...b, items: [] })

// One part of the setup: an axis, the cells' kind, the steps, an option. An axis whose only change is one entry added
// at the end (entries someone else added since left aside) goes through axis_add, worked out from the workspace, so
// their change isn't overwritten; the rest is written whole, as the editors give it.
export function setPart<K extends keyof MatrixSetup>(wid: string, id: string, part: K, value: MatrixSetup[K] | undefined, key?: string) {
  const opts = { label: 'change a matrix', ...(key ? { key: `matrix:${id}:${key}` } : {}) }
  return runUi(
    wid,
    (ctx) => {
      const now = (ctx.ws.pieces.find((p) => p.id === id)?.matrix as MatrixSetup | undefined)?.[part]
      if ((part === 'rows' || part === 'cols') && value && now) {
        const was = now as MatrixSetup['rows']
        const next = value as MatrixSetup['rows']
        const ch = sameAxisBut(was, next) ? editorChange(was.items, next.items, sameItem) : null
        if (ch && 'add' in ch) {
          const add = ch.add
          const plan = axisAdd(ctx, { id, axis: part, ...(add.cardId ? { card: add.cardId } : { name: add.name ?? '' }), label: 'change a matrix' })
          return [plan]
        }
      }
      return [updateMatrix(ctx, { id, parts: { [part]: value }, ui: true })]
    },
    opts,
  )
}

// A row or column taken out: an entry added by hand goes with its cells; a card the type brings is hidden (its cells kept,
// so bringing it back finds them).
export function removeEntry(wid: string, id: string, _setup: MatrixSetup, which: 'rows' | 'cols', entry: Entry, _cells: Cell[]) {
  return runUi(wid, (ctx) => [axisRemove(ctx, { id, axis: which, entry: entry.auto ? entry.key : (entry.item?.id ?? entry.key) })], { label: `take out a ${which === 'rows' ? 'row' : 'column'}` })
}

// A typed row or column at the end; its id, to type its name in ('' when nothing was made).
export async function addNamed(wid: string, id: string, _setup: MatrixSetup, which: 'rows' | 'cols', name = '') {
  const ctx = uiCtx(wid)
  if (!ctx) return ''
  let plan
  try {
    plan = axisAdd(ctx, { id, axis: which, name, label: 'change a matrix' })
  } catch (e) {
    sayRefused(e, 'change a matrix')
    return ''
  }
  const done = await applyUi(wid, ctx, [plan], { label: 'change a matrix' })
  if (!done) return ''
  await done.written
  return plan.ids.$new
}

export function addCardEntry(wid: string, id: string, _setup: MatrixSetup, which: 'rows' | 'cols', card: Card) {
  return runUi(wid, (ctx) => [axisAdd(ctx, { id, axis: which, card: card.id, label: 'change a matrix' })], { label: 'change a matrix' })
}

export function renameEntry(wid: string, id: string, _setup: MatrixSetup, which: 'rows' | 'cols', itemId: string, name: string) {
  return runUi(wid, (ctx) => [axisUpdate(ctx, { id, axis: which, entry: itemId, name, label: 'change a matrix' })], { label: 'change a matrix', key: `matrix:${id}:name:${itemId}` })
}

// Creates the cell on first edit; `undefined` clears a field. A matrix's or a table's (the piece says which).
export function setCell(wid: string, matrixId: string, row: string, col: string, fields: Partial<Pick<Cell, 'value' | 'notes' | 'notRelevant' | 'confidence'>>) {
  const keys = Object.keys(fields).sort().join(',')
  const typing = 'notes' in fields || typeof fields.value === 'string' || typeof fields.value === 'number'
  const args = {
    id: matrixId,
    row,
    col,
    ...('value' in fields ? { value: fields.value ?? null } : {}),
    ...('notes' in fields ? { note: fields.notes ?? null } : {}),
    ...('notRelevant' in fields ? { not_relevant: fields.notRelevant ?? null } : {}),
    ...('confidence' in fields ? { confidence: fields.confidence ?? null } : {}),
  }
  // A cell's first write puts back nothing on undo.
  return runUi(wid, (ctx) => [updateCell(ctx, args)], { label: 'matrix cell', ...(typing ? { key: `cell:${matrixId}_${row}_${col}:${keys}` } : {}) })
}
