// A matrix's and a table's entries and cells as ops (S7, D-312; docs/specs/agent-actions.md §11, §12 and its "Notes for
// S3–S8": one axis_add / axis_remove / axis_update for matrix rows and columns, table rows and table columns; one
// update_cell for both). Rows and columns are named by key, a card's title, a typed name, a criterion
// (`Card › criterion`) or a column's name (src/model/lens.ts); unclear → refused with the candidates. Every change is
// worked out from the snapshot (R5, R7): the cells an entry takes with it, a hidden card brought back, a column's sort.
import { SUB, cellKey, subKey, type Axis, type AxisItem, type Cell, type Entry, type MatrixSetup } from '../model/matrix'
import { CHECKED, COL_NAME_MAX, MAX_COLS, NAME_COL, colName, DEFAULT_STEPS, type Column, type TableSetup } from '../model/table'
import { MAX_ITEMS, type Row, type Source } from '../model/source'
import { COL_W, CONFIDENCES } from '../model/shapes'
import { axisEntries, candidates, colLine, entryLine, findEntry, findRow, hiddenCard, rowLine, tableRows } from '../model/lens'
import type { Piece } from '../data/model'
import { DELETE, type OpCtx, type Plan, type Write } from './types'
import { handleOf, refuse } from './util'
import { lensIn, shortId, stepsFrom, type StepSpec } from './matrix'
import { colIn, columnFrom, type ColumnSpec } from './table'

type P = Piece & { id: string }
type Which = 'rows' | 'cols'

const side = (w: Which) => (w === 'rows' ? 'row' : 'column')
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const cellId = (c: Cell) => (c as Cell & { id?: string }).id ?? cellKey(c.matrixId, c.row, c.col)
const whichOf = (op: string, v: unknown): Which => (v === 'rows' || v === 'cols' ? v : refuse(op, `axis is rows or cols, not ${String(v)}`, 'say axis: rows or axis: cols'))

function plan(op: string, label: string, p: P, writes: Write[], ids: Record<string, string> = {}): Plan {
  return { op, label, writes, ids, meta: { kind: p.kind } }
}

// ---- Finding entries (refusing with the candidates)

function matrixEntry(ctx: OpCtx, op: string, p: P, which: Which, ref: unknown): Entry {
  const a = p.matrix![which]
  if (typeof ref !== 'string' || !ref) refuse(op, `which ${side(which)}?`, `give its key or name`)
  const f = findEntry(a, ctx.ws.cards, ref)
  if ('it' in f) return f.it
  const hidden = hiddenCard(a, ctx.ws.cards, ref)
  if (hidden) refuse(op, `"${hidden.title}" is taken out of the matrix's ${which}`, `bring it back first: axis_add with card ${hidden.id}`)
  const list = ('many' in f ? f.many : f.list).map((e) => entryLine(e, f.list))
  refuse(op, 'many' in f ? `"${ref}" names more than one ${side(which)}` : `the matrix has no ${side(which)} ${ref}`, `use the key in [ ] of one of: ${candidates(list)}`)
}

function tableRow(ctx: OpCtx, op: string, p: P, ref: unknown): Row {
  const t = p.table!
  if (typeof ref !== 'string' || !ref) refuse(op, 'which row?', 'give its key or name')
  const f = findRow(t, ctx.ws.cards, ref)
  if ('it' in f) return f.it
  if (t.rows.hide?.includes(ref) || ctx.ws.cards.some((c) => t.rows.hide?.includes(c.id) && c.title.trim().toLowerCase() === ref.trim().toLowerCase()))
    refuse(op, `that card is taken out of the table`, 'bring it back first: axis_add with the card')
  const list = ('many' in f ? f.many : f.list).map(rowLine)
  refuse(op, 'many' in f ? `"${ref}" names more than one row` : `the table has no row ${ref}`, `use the key in [ ] of one of: ${candidates(list)}`)
}

// ---- axis_add

export type AxisAddArgs = {
  id: string
  axis: Which
  // A card (a hidden one of the type comes back), a typed name, or (a table's columns) a column.
  card?: string
  name?: string
  column?: ColumnSpec
  handle?: string
  label?: string
}

export function axisAdd(ctx: OpCtx, args: AxisAddArgs): Plan {
  const op = 'axis_add'
  const p = lensIn(ctx, op, args.id)
  const which = whichOf(op, args.axis)
  const given = [args.card !== undefined, args.name !== undefined, args.column !== undefined].filter(Boolean).length
  if (given !== 1) refuse(op, 'add one thing: a card, a name or a column', 'give one of card, name or column')
  const now = ctx.now
  const label = args.label ?? `change a ${p.kind}`
  if (p.kind === 'table' && which === 'cols') {
    if (args.column === undefined) refuse(op, "a table's columns are columns, not cards or names", 'give column: { field } or { name, kind }')
    const t = p.table!
    if (t.cols.length >= MAX_COLS) refuse(op, `a table has at most ${MAX_COLS} columns`, 'take one out first')
    const col = columnFrom(ctx, op, args.column)
    if (t.cols.some((c) => c.id === col.id)) refuse(op, `there is a column ${col.id} already`, 'leave id out')
    return plan(op, label, p, [{ coll: 'pieces', id: p.id, patch: { 'table.cols': [...clone(t.cols), col], updatedAt: now } }], { [handleOf(args)]: col.id })
  }
  if (args.column !== undefined) refuse(op, `only a table's columns are columns`, 'give a card or a name')
  // A matrix axis or a table's rows: the same shape (type/rules, hide, items).
  const isMatrix = p.kind === 'matrix'
  const src: Axis | Source = isMatrix ? p.matrix![which] : p.table!.rows
  const path = isMatrix ? `matrix.${which}` : 'table.rows'
  if (!isMatrix && which !== 'rows') refuse(op, 'tables add rows or columns', 'say axis: rows or cols')
  const items = src.items ?? []
  if (args.card !== undefined) {
    const card = ctx.ws.cards.find((c) => c.id === args.card)
    if (!card) refuse(op, `there is no card ${String(args.card)}`, 'use the id of an existing card (search for it)')
    if (card.type === 'package') refuse(op, "a package can't be a row or column", 'add its cards instead')
    // A card taken out comes back instead (a matrix: one its type brings; a table: one its rules bring).
    if (src.hide?.includes(card.id) && (!isMatrix || (src as Axis).type === card.type)) {
      const hide = src.hide.filter((h) => h !== card.id)
      return plan(op, label, p, [{ coll: 'pieces', id: p.id, patch: { [`${path}.hide`]: hide.length ? hide : DELETE, updatedAt: now } }])
    }
    const shown = isMatrix ? findEntry(src as Axis, ctx.ws.cards, card.id) : findRow(p.table!, ctx.ws.cards, card.id)
    if ('it' in shown && (shown.it as { key: string }).key === card.id) refuse(op, `"${card.title}" is a ${side(which)} already`, 'leave it, or add another card')
    if (items.length >= MAX_ITEMS) refuse(op, `at most ${MAX_ITEMS} added by hand`, isMatrix ? 'use a type instead' : 'use rules instead')
    const item: AxisItem = { id: shortId(ctx), cardType: card.type, cardId: card.id }
    return plan(op, label, p, [{ coll: 'pieces', id: p.id, patch: { [`${path}.items`]: [...clone(items), item], updatedAt: now } }], { [handleOf(args)]: item.id })
  }
  if (typeof args.name !== 'string') refuse(op, 'name is text', 'give the name as a string')
  if (items.length >= MAX_ITEMS) refuse(op, `at most ${MAX_ITEMS} added by hand`, 'take some out first')
  const item: AxisItem = { id: shortId(ctx), name: args.name.slice(0, 200) }
  return plan(op, label, p, [{ coll: 'pieces', id: p.id, patch: { [`${path}.items`]: [...clone(items), item], updatedAt: now } }], { [handleOf(args)]: item.id })
}

// ---- axis_remove

export type AxisRemoveArgs = { id: string; axis: Which; entry: string; label?: string }

// The cells of `piece` on that row (or column), with what it unfolded into.
function cellsOf(ctx: OpCtx, piece: string, which: Which, key: string, withSubs: boolean): Write[] {
  const of = (k: string) => k === key || (withSubs && k.startsWith(key + SUB))
  return ctx.ws.cells.filter((c) => c.matrixId === piece && of(which === 'rows' ? c.row : c.col)).map((c) => ({ coll: 'cells' as const, id: cellId(c), del: true as const }))
}

export function axisRemove(ctx: OpCtx, args: AxisRemoveArgs): Plan {
  const op = 'axis_remove'
  const p = lensIn(ctx, op, args.id)
  const which = whichOf(op, args.axis)
  const now = ctx.now
  const label = args.label ?? `take out a ${side(which)}`
  if (p.kind === 'table' && which === 'cols') {
    const t = p.table!
    const c = colIn(op, t, args.entry)
    if (c === NAME_COL) refuse(op, "the name column can't be taken out", 'take out another column')
    const patch: Record<string, unknown> = { 'table.cols': clone(t.cols.filter((x) => x.id !== c.id)), updatedAt: now }
    if (t.sort?.col === c.id) patch['table.sort'] = DELETE
    return plan(op, label, p, [{ coll: 'pieces', id: p.id, patch }, ...cellsOf(ctx, p.id, 'cols', c.id, false)])
  }
  const isMatrix = p.kind === 'matrix'
  if (!isMatrix && which !== 'rows') refuse(op, 'tables take out rows or columns', 'say axis: rows or cols')
  const src: Axis | Source = isMatrix ? p.matrix![which] : p.table!.rows
  const path = isMatrix ? `matrix.${which}` : 'table.rows'
  // An item added by hand, named by its own id (the setup's list): taken out as such.
  const byItem = src.items.find((i) => i.id === args.entry)
  let auto: boolean
  let key: string
  let item: AxisItem | undefined
  if (byItem) ((auto = false), (item = byItem), (key = byItem.cardId ?? byItem.id))
  else if (isMatrix) {
    const e = matrixEntry(ctx, op, p, which, args.entry)
    if (e.parent) refuse(op, `"${e.name}" is what a feature is judged on`, `take it off the feature: update_card ${e.card?.id} with its criteria without it`)
    ;((auto = e.auto), (item = e.item), (key = e.key))
  } else {
    const r = tableRow(ctx, op, p, args.entry)
    ;((auto = r.auto), (item = r.item), (key = r.key))
  }
  // A card the type (or the rules) bring is hidden, its cells kept for when it comes back.
  if (auto) return plan(op, label, p, [{ coll: 'pieces', id: p.id, patch: { [`${path}.hide`]: [...(src.hide ?? []), key], updatedAt: now } }])
  const items = src.items.filter((i) => i !== item)
  const after = { ...src, items }
  // Its cells go, unless the card still has its row (the type or the rules bring it too).
  const still = isMatrix ? axisEntries(after as Axis, ctx.ws.cards).some((e) => e.key === key) : tableRows({ ...p.table!, rows: after as Source }, ctx.ws.cards).some((r) => r.key === key)
  const gone = still ? [] : cellsOf(ctx, p.id, which, key, isMatrix)
  return plan(op, label, p, [{ coll: 'pieces', id: p.id, patch: { [`${path}.items`]: clone(items), updatedAt: now } }, ...gone])
}

// ---- axis_update: a typed name renamed; a table's column renamed, its kind, unit, steps, width, moved

export type AxisUpdateArgs = {
  id: string
  axis: Which
  entry: string
  name?: string
  kind?: Column['kind']
  unit?: string | null
  steps?: StepSpec[] | string
  width?: number | null
  move?: 'left' | 'right'
  // The UI's column editor: fields as stored.
  change?: Partial<Column>
  label?: string
}

export function axisUpdate(ctx: OpCtx, args: AxisUpdateArgs): Plan {
  const op = 'axis_update'
  const p = lensIn(ctx, op, args.id)
  const which = whichOf(op, args.axis)
  const now = ctx.now
  const label = args.label ?? `change a ${p.kind}`
  const colOnly = (['kind', 'unit', 'steps', 'width', 'move', 'change'] as const).filter((k) => args[k] !== undefined)
  if (p.kind === 'table' && which === 'cols') {
    const t = p.table!
    const c = colIn(op, t, args.entry, true)
    if (c === NAME_COL) {
      if (colOnly.some((k) => k !== 'width') || args.name !== undefined) refuse(op, 'the name column only changes its width', 'give width (null: its own)')
      const w = args.width
      if (w !== null && w !== undefined && (typeof w !== 'number' || !Number.isFinite(w))) refuse(op, 'width is a number', `give px (${COL_W.min}–${COL_W.max}) or null`)
      return plan(op, label, p, [{ coll: 'pieces', id: p.id, patch: { 'table.nameWidth': typeof w === 'number' ? Math.round(Math.min(COL_W.max, Math.max(COL_W.min, w))) : DELETE, updatedAt: now } }])
    }
    let cols = clone(t.cols)
    const i = cols.findIndex((x) => x.id === c.id)
    if (args.move !== undefined) {
      if (args.move !== 'left' && args.move !== 'right') refuse(op, 'move is left or right', 'say move: left or right')
      const j = i + (args.move === 'left' ? -1 : 1)
      if (j < 0 || j >= cols.length) refuse(op, `"${colName(c)}" is already the ${args.move === 'left' ? 'first' : 'last'} column`, 'move it the other way')
      ;[cols[i], cols[j]] = [cols[j], cols[i]]
    }
    const next: Record<string, unknown> = { ...cols[cols.findIndex((x) => x.id === c.id)] }
    if (args.change) Object.assign(next, args.change)
    if (args.name !== undefined) {
      if (typeof args.name !== 'string') refuse(op, 'name is text', 'give the name as a string')
      next.name = args.name.trim().slice(0, COL_NAME_MAX) || undefined
      if (!next.name && !next.field) refuse(op, 'a column of its own needs a name', 'give a name')
    }
    if (args.kind !== undefined) {
      if (c.field) refuse(op, 'a card field column has no kind', 'add a column of its own instead')
      if (!['scale', 'number', 'text', 'check'].includes(args.kind)) refuse(op, `${String(args.kind)} isn't a column kind`, 'use scale, number, text or check')
      next.kind = args.kind
      if (args.kind === 'scale' && !next.steps) next.steps = clone(DEFAULT_STEPS)
    }
    if (args.unit !== undefined) next.unit = typeof args.unit === 'string' && args.unit.trim() ? args.unit.trim().slice(0, 20) : undefined
    if (args.steps !== undefined) {
      if ((next.kind ?? c.kind) !== 'scale') refuse(op, 'only a scale column has steps', 'make it kind: scale first')
      next.steps = stepsFrom(op, args.steps)
    }
    if (args.width !== undefined) {
      const w = args.width
      if (w !== null && (typeof w !== 'number' || !Number.isFinite(w))) refuse(op, 'width is a number', `give px (${COL_W.min}–${COL_W.max}) or null`)
      next.width = w === null ? undefined : Math.round(Math.min(COL_W.max, Math.max(COL_W.min, w)))
    }
    cols = cols.map((x) => (x.id === c.id ? (clone(next) as Column) : x))
    return plan(op, label, p, [{ coll: 'pieces', id: p.id, patch: { 'table.cols': cols, updatedAt: now } }])
  }
  if (colOnly.length) refuse(op, `${colOnly.join(', ')}: only a table's columns have those`, 'give name only')
  if (typeof args.name !== 'string') refuse(op, 'name is text', 'give the new name')
  const isMatrix = p.kind === 'matrix'
  if (!isMatrix && which !== 'rows') refuse(op, 'tables have rows and cols', 'say axis: rows or cols')
  const src: Axis | Source = isMatrix ? p.matrix![which] : p.table!.rows
  const path = isMatrix ? `matrix.${which}` : 'table.rows'
  const byItem = src.items.find((i) => i.id === args.entry)
  let item = byItem
  if (!item) {
    const e = isMatrix ? matrixEntry(ctx, op, p, which, args.entry) : tableRow(ctx, op, p, args.entry)
    if ((e as Entry).parent) refuse(op, "a criterion's words are the feature's", `change them with update_card ${e.card?.id} (its criteria)`)
    if (e.card) refuse(op, `"${e.name}" is a card: its row reads its title`, `rename the card: update_card ${e.card.id} with title`)
    item = e.item
  }
  if (!item || item.cardId) refuse(op, 'that row is a card: its row reads its title', 'rename the card with update_card')
  const items = src.items.map((i) => (i.id === item!.id ? { ...i, name: args.name!.slice(0, 200) } : i))
  return plan(op, label, p, [{ coll: 'pieces', id: p.id, patch: { [`${path}.items`]: clone(items), updatedAt: now } }])
}

// ---- update_cell

export type UpdateCellArgs = {
  id: string
  row: string
  col: string
  // A matrix: a step (its label, glyph, id or place 1…), a number or a text, as its cells say; a table's own column as
  // its kind says (check: true/false). null clears it.
  value?: string | number | boolean | null
  note?: string | null
  not_relevant?: boolean | null
  confidence?: (typeof CONFIDENCES)[number] | null
  // Everything in the cell taken away.
  clear?: boolean
}

type Steps = { id: string; glyph: string; label: string }[]
function stepValue(op: string, steps: Steps, v: unknown): string {
  const list = steps.map((s, i) => `${i + 1} ${s.label}`).join(', ')
  if (typeof v === 'number') {
    if (!Number.isInteger(v) || v < 1 || v > steps.length) refuse(op, `${v} is out of range: the scale has ${steps.length} steps`, `give 1–${steps.length} or a step's label: ${list}`)
    return steps[v - 1].id
  }
  if (typeof v === 'string') {
    const n = v.trim().toLowerCase()
    const s = steps.find((x) => x.id === v) ?? steps.find((x) => x.label.toLowerCase() === n) ?? steps.find((x) => x.glyph === v.trim())
    if (s) return s.id
    if (/^\d+$/.test(n)) return stepValue(op, steps, Number(n))
  }
  refuse(op, `${JSON.stringify(v)} isn't one of the scale's steps`, `give one of: ${list}`)
}

function numberValue(op: string, v: unknown): number {
  // `1,234` could be a thousand or a fraction: asked, not guessed (`1,5` is 1.5).
  if (typeof v === 'string' && /^\s*-?\d{1,3}(,\d{3})+\s*$/.test(v)) refuse(op, `"${v.trim()}" could be ${v.trim().replace(/,/g, '')} or ${v.trim().replace(',', '.')}`, `give ${v.trim().replace(/,/g, '')} or ${v.trim().replace(',', '.')}`)
  const n = typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) refuse(op, `${JSON.stringify(v)} isn't a number`, 'give a number (the unit is the matrix\'s or column\'s)')
  return n
}

function textValue(op: string, v: unknown): string {
  if (typeof v !== 'string') refuse(op, `${JSON.stringify(v)} isn't text`, 'give the words as a string')
  return v.slice(0, 200)
}

export function updateCell(ctx: OpCtx, args: UpdateCellArgs): Plan {
  const op = 'update_cell'
  const p = lensIn(ctx, op, args.id)
  let row: string
  let col: string
  let value: (v: unknown) => unknown
  const m: MatrixSetup | undefined = p.matrix
  if (p.kind === 'matrix') {
    const re = matrixEntry(ctx, op, p, 'rows', args.row)
    const ce = matrixEntry(ctx, op, p, 'cols', args.col)
    row = re.key
    col = ce.key
    // A feature's own cell reads from its criteria once any is scored (model/matrix.ts' cellView): a value there isn't
    // shown.
    if (args.value !== undefined && args.value !== null && (re.subs || ce.subs)) {
      const subs = re.subs ?? ce.subs!
      const scored = ctx.ws.cells.some((c) => c.matrixId === p.id && c.value !== undefined && (re.subs ? subs.includes(c.row) && c.col === col : subs.includes(c.col) && c.row === row))
      const head = re.subs ? re : ce
      if (scored) refuse(op, `"${head.name}"'s cell reads from what it's judged on, which is scored`, `score its criteria instead: \`${head.name} › criterion\` (${(head.card?.criteria ?? []).map((x) => x.text).join(', ')})`)
    }
    value = (v) => (m!.cell === 'scale' ? stepValue(op, m!.steps, v) : m!.cell === 'number' ? numberValue(op, v) : textValue(op, v))
  } else {
    const t: TableSetup = p.table!
    row = tableRow(ctx, op, p, args.row).key
    const c = colIn(op, t, args.col)
    if (c === NAME_COL) refuse(op, "the name column is the row's name", "rename it with axis_update (a card's title: update_card)")
    if (c.field) refuse(op, `"${colName(c)}" shows the cards' ${c.field}: read-only here`, `change the card instead (update_card), or write in a column of the table's own: ${candidates(t.cols.filter((x) => !x.field).map(colLine))}`)
    col = c.id
    value = (v) => {
      if (c.kind === 'check') {
        if (v === true || v === CHECKED || v === 'true') return CHECKED
        if (v === false || v === 'false' || v === 'no') return DELETE
        refuse(op, `a check is true or false, not ${JSON.stringify(v)}`, 'give true or false')
      }
      if (c.kind === 'scale') return stepValue(op, c.steps ?? DEFAULT_STEPS, v)
      if (c.kind === 'number') return numberValue(op, v)
      return textValue(op, v)
    }
  }
  const id = cellKey(p.id, row, col)
  const had = ctx.ws.cells.some((c) => cellId(c) === id)
  const label = 'matrix cell'
  if (args.clear) {
    if ((['value', 'note', 'not_relevant', 'confidence'] as const).some((k) => args[k] !== undefined)) refuse(op, 'clear takes everything away', 'give clear alone, or the fields without it')
    return plan(op, label, p, had ? [{ coll: 'cells', id, del: true }] : [])
  }
  const data: Record<string, unknown> = { matrixId: p.id, row, col, updatedAt: ctx.now }
  if (args.value !== undefined) data.value = args.value === null || args.value === '' ? DELETE : value(args.value)
  if (args.note !== undefined) {
    if (args.note !== null && typeof args.note !== 'string') refuse(op, 'a note is text', 'give the note as a string, or null to take it away')
    data.notes = args.note ? args.note.slice(0, 20000) : DELETE
  }
  if (args.not_relevant !== undefined) {
    if (args.not_relevant && p.kind === 'matrix' && !m!.notRelevant) refuse(op, `this matrix doesn't allow "doesn't apply" (—)`, 'allow it first: update_matrix with not_relevant: true')
    if (p.kind === 'table' && args.not_relevant) refuse(op, "a table's cells have no \"doesn't apply\"", 'leave not_relevant out')
    data.notRelevant = args.not_relevant ? true : DELETE
  }
  if (args.confidence !== undefined) {
    if (args.confidence !== null && !(CONFIDENCES as readonly unknown[]).includes(args.confidence)) refuse(op, `${String(args.confidence)} isn't how sure`, `use one of ${CONFIDENCES.join(', ')}, or null`)
    if (args.confidence && p.kind === 'matrix' && !m!.confidence) refuse(op, "this matrix doesn't mark guesses", 'allow it first: update_matrix with confidence: true')
    if (p.kind === 'table' && args.confidence) refuse(op, "a table's cells don't mark guesses", 'leave confidence out')
    data.confidence = args.confidence ?? DELETE
  }
  if (Object.keys(data).length === 4) refuse(op, 'nothing to change in the cell', 'give value, note, not_relevant, confidence or clear')
  // A first write's DELETEs are nothing to take away: left out (a set with merge still takes them).
  return plan(op, label, p, [{ coll: 'cells', id, set: data, merge: true }])
}

// ---- Criteria (D-133, D-249): what a feature is judged on, taken off with its scores

// The writes that go with taking criteria `gone` off feature `card`: their matrix cells (every matrix, any axis) and the
// scores left on the old comparisons.
export function criterionCascade(ctx: OpCtx, card: string, gone: string[]): Write[] {
  if (!gone.length) return []
  const keys = new Set(gone.map((g) => subKey(card, g)))
  const cells: Write[] = ctx.ws.cells.filter((c) => keys.has(c.row) || keys.has(c.col)).map((c) => ({ coll: 'cells', id: cellId(c), del: true }))
  const scored: Write[] = ctx.ws.comparisons
    .filter((c) => c.featureId === card && c.criteria && gone.some((g) => g in c.criteria!))
    // Every score gone: the map goes too (an empty one isn't a comparison's, clean.ts).
    .map((c) => ({
      coll: 'comparisons',
      id: c.id,
      patch: Object.keys(c.criteria!).every((k) => gone.includes(k)) ? { criteria: DELETE } : Object.fromEntries(gone.filter((g) => g in c.criteria!).map((g) => [`criteria.${g}`, DELETE])),
    }))
  return [...cells, ...scored]
}
