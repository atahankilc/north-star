// S7's matrix and table ops on the fixture, pure: create_piece with a typed matrix / table, update_matrix, update_table,
// axis_add / axis_remove / axis_update, update_cell by names (ambiguous names list the candidates), criteria taken off a
// feature with their scores, and the model's name resolving. Wrappers and undo: tests/unit/wrappers.test.ts.
import { describe, expect, it } from 'vitest'
import { counterIds } from '../../src/ops/newId'
import { validate } from '../../src/ops/validate'
import { project } from '../../src/ops/project'
import { DELETE, OpsRefused, type OpCtx, type Plan } from '../../src/ops/types'
import { createPiece } from '../../src/ops/pieces'
import { updateCard } from '../../src/ops/cards'
import { updateMatrix } from '../../src/ops/matrix'
import { updateTable } from '../../src/ops/table'
import { axisAdd, axisRemove, axisUpdate, updateCell } from '../../src/ops/lens'
import { buildBatch } from '../../src/ops/registry'
import { axisEntries, editorChange, findEntry, oneChange } from '../../src/model/lens'
import { entriesOf, type MatrixSetup } from '../../src/model/matrix'
import type { TableSetup } from '../../src/model/table'
import type { WorkspaceCtx } from '../../src/state/wsStore'
import { ALICE, CAROL, ID, LENS, T, lensWs } from './fixtures/ws'

const NOW = T + 1000
const ctxOf = (ws: WorkspaceCtx = lensWs()): OpCtx => ({ ws, actor: ALICE, now: NOW, newId: counterIds('new') })
function run(ctx: OpCtx, plans: Plan[]) {
  expect(validate(plans, ctx.ws, ctx.actor)).toEqual({ ok: true })
  return project(ctx.ws, plans)
}
const refused = (f: () => unknown, re: RegExp) => {
  try {
    f()
  } catch (e) {
    expect(e).toBeInstanceOf(OpsRefused)
    const err = (e as OpsRefused).errors[0]
    expect(err.message).toMatch(re)
    expect(err.fix.length).toBeGreaterThan(5)
    return err
  }
  throw new Error('did not refuse')
}
const matrixOf = (ws: WorkspaceCtx, id = ID.matrix) => ws.pieces.find((p) => p.id === id)!.matrix as MatrixSetup
const tableOf = (ws: WorkspaceCtx) => ws.pieces.find((p) => p.id === LENS.table)!.table as TableSetup
const cell = (ws: WorkspaceCtx, m: string, r: string, c: string) => ws.cells.find((x) => x.matrixId === m && x.row === r && x.col === c)

describe('model: rows and columns by name', () => {
  it('axisEntries unfolds every feature (shown open or not); findEntry by key, item id, title, `Card › criterion`; ambiguous lists both', () => {
    const ws = lensWs()
    const m = matrixOf(ws)
    expect(entriesOf(m.cols, ws.cards).map((e) => e.key)).toEqual([ID.loyalty, ID.qr])
    expect(axisEntries(m.cols, ws.cards).map((e) => e.key)).toEqual([ID.loyalty, ID.qr, `${ID.qr}~c1`])
    expect('it' in findEntry(m.cols, ws.cards, 'QR table ordering › works offline') && findEntry(m.cols, ws.cards, 'qr table ordering > WORKS OFFLINE').it).toMatchObject({ key: `${ID.qr}~c1` })
    expect(findEntry(m.cols, ws.cards, 'works offline')).toMatchObject({ it: { key: `${ID.qr}~c1` } })
    expect(findEntry(m.rows, ws.cards, LENS.square)).toMatchObject({ it: { key: LENS.square, name: 'Square' } })
    const many = findEntry(m.rows, ws.cards, 'orderly')
    expect('many' in many && many.many.map((e) => e.key).sort()).toEqual([ID.orderly, LENS.orderly2].sort())
  })

  it('oneChange: add at the end, remove, swap, edit; anything else null', () => {
    const a = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 3 }]
    const same = (x: { v: number }, y: { v: number }) => x.v === y.v
    expect(oneChange(a, [...a, { id: 'd', v: 4 }], same)).toEqual({ add: { id: 'd', v: 4 } })
    expect(oneChange(a, [a[0], a[2]], same)).toEqual({ remove: a[1] })
    expect(oneChange(a, [a[1], a[0], a[2]], same)).toEqual({ move: a[0], by: 1 })
    expect(oneChange(a, [a[0], { id: 'b', v: 9 }, a[2]], same)).toEqual({ edit: { id: 'b', v: 9 }, was: a[1] })
    expect(oneChange(a, [a[2], a[1], a[0]], same)).toBeNull()
    // A removal only when the rest is the same.
    expect(oneChange(a, [a[0], { id: 'c', v: 9 }], same)).toBeNull()
  })

  it('editorChange: a stale list (missing what someone added since) with one edit is that edit, never a removal', () => {
    const now = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'x', v: 7 }]
    const same = (p: { v: number }, q: { v: number }) => p.v === q.v
    expect(editorChange(now, [now[0], { id: 'b', v: 5 }], same)).toEqual({ edit: { id: 'b', v: 5 }, was: now[1] })
    expect(editorChange(now, [now[0], now[1], { id: 'y', v: 3 }], same)).toEqual({ add: { id: 'y', v: 3 } })
    expect(editorChange(now, [now[0], now[2]], same)).toEqual({ same: true })
  })
})

describe('create_piece with a typed matrix or table', () => {
  it('a matrix from a template with typed axes and options: stored as the setup; validates', () => {
    const ctx = ctxOf()
    const plan = createPiece(ctx, { kind: 'matrix', canvas: 'main', name: 'Pains', matrix: { template: 'pain', rows: { type: 'problem', plane: 'Customers' }, cols: { names: ['Anna', 'Bob'], noun: 'people' }, scale: 'five', confidence: true, totals_at: 'both' } })
    const ws = run(ctx, [plan])
    const m = matrixOf(ws, plan.ids.$new)
    expect(m.rows).toEqual({ type: 'problem', plane: ID.planeA, items: [] })
    expect(m.cols.items.map((i) => i.name)).toEqual(['Anna', 'Bob'])
    expect(m.cols.noun).toBe('people')
    expect(m.steps.map((s) => s.label)).toEqual(['one', 'two', 'three', 'four', 'five'])
    expect(m).toMatchObject({ cell: 'scale', notRelevant: true, confidence: true, reading: true, totalsAt: 'both' })
  })

  it('a matrix with its own steps and number cells; refused: unknown template, unfold off features, empty axis, setup and matrix both', () => {
    const ctx = ctxOf()
    const p = createPiece(ctx, { kind: 'matrix', canvas: 'main', matrix: { rows: { type: 'feature', unfold: true }, cols: { cards: [ID.orderly, ID.anna] }, steps: ['bad', 'ok', { label: 'great', glyph: '★', tone: 'green' }] } })
    const m = matrixOf(run(ctx, [p]), p.ids.$new)
    expect(m.rows.unfold).toBe('criteria')
    expect(m.cols.items.map((i) => i.cardId)).toEqual([ID.orderly, ID.anna])
    expect(m.steps).toEqual([
      { id: 'bad', glyph: '1', label: 'bad', tone: 'dim' },
      { id: 'ok', glyph: '2', label: 'ok', tone: 'yellow' },
      { id: 'great', glyph: '★', label: 'great', tone: 'green' },
    ])
    // A hand-listed card its type brings is skipped only when the type really brings it (its plane).
    const onB = createPiece(ctx, { kind: 'matrix', canvas: 'main', matrix: { rows: { type: 'customer', plane: 'Market', cards: [ID.anna, ID.barista] }, cols: { names: ['x'] } } })
    expect(matrixOf(run(ctx, [onB]), onB.ids.$new).rows.items.map((i) => i.cardId)).toEqual([ID.barista])
    refused(() => createPiece(ctx, { kind: 'matrix', canvas: 'main', matrix: { template: 'nope' } }), /no matrix template nope/)
    refused(() => createPiece(ctx, { kind: 'matrix', canvas: 'main', matrix: { rows: { type: 'idea', unfold: true } } }), /only features unfold/)
    refused(() => createPiece(ctx, { kind: 'matrix', canvas: 'main', matrix: { rows: {} } }), /rows would be empty/)
    refused(() => createPiece(ctx, { kind: 'matrix', canvas: 'main', matrix: {}, setup: {} }), /setup and matrix/)
    refused(() => createPiece(ctx, { kind: 'plane', canvas: 'main', matrix: {} }), /has no matrix setup/)
  })

  it('a table: rules by plane name, cards and names by hand, columns, sort by name; names only → a list of names', () => {
    const ctx = ctxOf()
    const p = createPiece(ctx, {
      kind: 'table',
      canvas: 'main',
      table: { rules: [{ field: 'plane', values: ['Market'] }, { field: 'type', not: true, values: ['competitor'] }], cards: [ID.anna], names: ['later'], columns: [{ field: 'priority' }, { name: 'score', kind: 'scale', steps: 'five' }, { name: 'hours', kind: 'number', unit: 'h' }], sort: { col: 'hours', desc: true }, page_size: 25 },
    })
    const t = run(ctx, [p]).pieces.find((x) => x.id === p.ids.$new)!.table as TableSetup
    expect(t.rows.rules).toEqual([{ field: 'plane', values: [ID.planeB] }, { field: 'type', not: true, values: ['competitor'] }])
    expect(t.rows.items.map((i) => i.cardId ?? i.name)).toEqual([ID.anna, 'later'])
    expect(t.cols.map((c) => c.field ?? c.kind)).toEqual(['priority', 'scale', 'number'])
    expect(t.sort).toEqual({ col: t.cols[2].id, desc: true })
    expect(t.pageSize).toBe(25)
    expect(t.manual).toBeUndefined()
    const n = createPiece(ctx, { kind: 'table', canvas: 'main', table: { names: ['a', 'b'] } })
    expect(((n.writes[0].set as { table: TableSetup }).table).manual).toBe(true)
    refused(() => createPiece(ctx, { kind: 'table', canvas: 'main', table: { rules: [{ field: 'plane', values: ['Nowhere'] }] } }), /no plane Nowhere/)
    refused(() => createPiece(ctx, { kind: 'table', canvas: 'main', table: { columns: [{ name: 'x' }] } }), /needs a kind/)
    refused(() => createPiece(ctx, { kind: 'table', canvas: 'main', table: { cards: [ID.pkg] } }), /package can't be a row/)
    refused(() => createPiece(ctx, { kind: 'table', canvas: 'main', table: { rules: [{ field: 'status', values: ['done'] }] } }), /isn't a status/)
  })

  it('through a batch: a table made, then a row and a column added and a cell filled by names', () => {
    const ctx = ctxOf()
    const plans = buildBatch(ctx, [
      { op: 'create_piece', args: { kind: 'table', canvas: 'main', table: { template: 'blank' }, handle: '$t' } },
      { op: 'axis_add', args: { id: '$t', axis: 'rows', name: 'Berlin' } },
      { op: 'axis_add', args: { id: '$t', axis: 'cols', column: { name: 'visits', kind: 'number' } } },
      { op: 'update_cell', args: { id: '$t', row: 'Berlin', col: 'visits', value: '12' } },
    ])
    const ws = run(ctx, plans)
    const t = plans[0].ids.$t
    expect(ws.cells.find((c) => c.matrixId === t)).toMatchObject({ row: plans[1].ids.$2, col: plans[2].ids.$3, value: 12 })
  })
})

describe('update_matrix / update_table', () => {
  it('update_matrix: options, an axis plane by name, cards shown open; nulls take away; template starts over', () => {
    const ctx = ctxOf()
    const p = updateMatrix(ctx, { id: ID.matrix, cell: 'number', unit: '€', not_relevant: null, totals: true, totals_at: 'head', rows: { plane: 'Market' }, cols: { open: [ID.qr] } })
    expect(p.writes[0].patch).toMatchObject({ 'matrix.cell': 'number', 'matrix.unit': '€', 'matrix.notRelevant': DELETE, 'matrix.reading': true, 'matrix.totalsAt': DELETE, 'matrix.rows.plane': ID.planeB, 'matrix.cols.open': [ID.qr] })
    const m = matrixOf(run(ctx, [p]))
    expect(m).toMatchObject({ cell: 'number', unit: '€', reading: true })
    expect(m.notRelevant).toBeUndefined()
    const t = updateMatrix(ctx, { id: ID.matrix, template: 'compare' })
    expect(matrixOf(run(ctx, [t])).rows).toMatchObject({ type: 'feature', unfold: 'criteria' })
    expect(t.label).toBe('set up a matrix')
    refused(() => updateMatrix(ctx, { id: ID.matrix, rows: { unfold: true } }), /only features unfold/)
    refused(() => updateMatrix(ctx, { id: LENS.table, cell: 'text' }), /isn't a matrix/)
    refused(() => updateMatrix(ctx, { id: ID.matrix, scale: 'nine' }), /no scale nine/)
    refused(() => updateMatrix(ctx, { id: ID.matrix, parts: { cell: 'text' } }), /app's own/)
    refused(() => updateMatrix(ctx, { id: ID.matrix, cols: { open: [ID.anna] } }), /isn't a feature on the matrix's cols/)
    refused(() => updateMatrix(ctx, { id: ID.matrix, cols: { fold: ['nothing'] } }), /isn't a feature/)
    refused(() => updateTable(ctx, { id: LENS.table, setup: { rows: { rules: [], items: [] }, cols: [] } }), /app's own/)
  })

  it('update_table: rules replaced (a sticky plane rule stays), sort by a column name, page size, null clears', () => {
    const ws = lensWs()
    const t0 = tableOf(ws)
    t0.rows.rules.unshift({ field: 'plane', values: [ID.planeB], auto: true })
    const ctx = ctxOf(ws)
    const p = updateTable(ctx, { id: LENS.table, rules: [{ field: 'tag', values: ['smb'] }], sort: { col: 'risk', desc: true }, page_size: 10 })
    const t = tableOf(run(ctx, [p]))
    expect(t.rows.rules).toEqual([{ field: 'plane', values: [ID.planeB], auto: true }, { field: 'tag', values: ['smb'] }])
    expect(t.sort).toEqual({ col: LENS.risk, desc: true })
    expect(t.pageSize).toBe(10)
    expect(tableOf(run(ctx, [updateTable(ctx, { id: LENS.table, sort: null, page_size: null })]))).not.toHaveProperty('sort')
    // The editors' whole parts, with an emptied list the rules leave out: written without it.
    const whole = updateTable(ctx, { id: LENS.table, parts: { rows: { ...t0.rows, hide: [] } }, ui: true })
    expect(tableOf(run(ctx, [whole])).rows).not.toHaveProperty('hide')
    refused(() => updateTable(ctx, { id: LENS.table, sort: { col: 'nothing' } }), /no column nothing/)
    refused(() => updateTable(ctx, { id: LENS.table, page_size: 0 }), /page_size/)
  })
})

describe('axis_add / axis_remove / axis_update', () => {
  it('matrix: a typed name and a card added; a hidden card comes back; a duplicate refused', () => {
    const ws = lensWs()
    const m0 = matrixOf(ws)
    m0.rows.hide = [ID.orderly]
    const ctx = ctxOf(ws)
    const named = axisAdd(ctx, { id: ID.matrix, axis: 'rows', name: 'Toast' })
    expect(matrixOf(run(ctx, [named])).rows.items.at(-1)).toEqual({ id: named.ids.$new, name: 'Toast' })
    const card = axisAdd(ctx, { id: ID.matrix, axis: 'cols', card: ID.anna })
    expect(matrixOf(run(ctx, [card])).cols.items.at(-1)).toMatchObject({ cardId: ID.anna, cardType: 'customer' })
    const back = axisAdd(ctx, { id: ID.matrix, axis: 'rows', card: ID.orderly })
    expect(back.writes[0].patch).toMatchObject({ 'matrix.rows.hide': DELETE })
    refused(() => axisAdd(ctx, { id: ID.matrix, axis: 'cols', card: ID.qr }), /is a column already/)
    refused(() => axisAdd(ctx, { id: ID.matrix, axis: 'rows', name: 'x', card: ID.qr }), /add one thing/)
  })

  it('matrix: hiding a card keeps its cells; a typed row goes with its cells; a criterion refused (update_card)', () => {
    const ctx = ctxOf()
    const hide = axisRemove(ctx, { id: ID.matrix, axis: 'rows', entry: ID.orderly })
    expect(hide.writes).toEqual([{ coll: 'pieces', id: ID.matrix, patch: { 'matrix.rows.hide': [ID.orderly], updatedAt: NOW } }])
    const typed = axisRemove(ctx, { id: ID.matrix, axis: 'rows', entry: 'Square' })
    const ws = run(ctx, [typed])
    expect(matrixOf(ws).rows.items).toEqual([])
    expect(cell(ws, ID.matrix, LENS.square, ID.qr)).toBeUndefined()
    expect(typed.label).toBe('take out a row')
    refused(() => axisRemove(ctx, { id: ID.matrix, axis: 'cols', entry: 'works offline' }), /judged on/)
    const amb = refused(() => axisRemove(ctx, { id: ID.matrix, axis: 'rows', entry: 'Orderly' }), /more than one row/)
    expect(amb.fix).toContain(ID.orderly)
    expect(amb.fix).toContain(LENS.orderly2)
  })

  it('table: rows and columns; a column taken out takes its cells and the sort; widths, moves, renames', () => {
    const ctx = ctxOf()
    const col = axisRemove(ctx, { id: LENS.table, axis: 'cols', entry: 'cost' })
    let ws = run(ctx, [col])
    expect(tableOf(ws).cols.map((c) => c.id)).toEqual([LENS.status, LENS.done, LENS.risk])
    expect(tableOf(ws).sort).toBeUndefined()
    expect(ws.cells.filter((c) => c.col === LENS.cost)).toEqual([])
    const row = axisRemove(ctx, { id: LENS.table, axis: 'rows', entry: 'Ops work' })
    ws = run(ctx, [row])
    expect(ws.cells.filter((c) => c.row === LENS.backlog)).toEqual([])
    const hide = axisRemove(ctx, { id: LENS.table, axis: 'rows', entry: 'Loyalty stamps' })
    expect(tableOf(run(ctx, [hide])).rows.hide).toEqual([ID.loyalty])
    const w = axisUpdate(ctx, { id: LENS.table, axis: 'cols', entry: 'risk', width: 9999, move: 'left', name: 'danger' })
    const t = tableOf(run(ctx, [w]))
    expect(t.cols.map((c) => c.id)).toEqual([LENS.status, LENS.cost, LENS.risk, LENS.done])
    expect(t.cols[2]).toMatchObject({ name: 'danger', width: 640 })
    expect(tableOf(run(ctx, [axisUpdate(ctx, { id: LENS.table, axis: 'cols', entry: 'name', width: 10 })])).nameWidth).toBe(48)
    expect(tableOf(run(ctx, [axisUpdate(ctx, { id: LENS.table, axis: 'rows', entry: LENS.backlog, name: 'Ops' })])).rows.items[0].name).toBe('Ops')
    refused(() => axisUpdate(ctx, { id: LENS.table, axis: 'cols', entry: 'status', kind: 'number' }), /card field column has no kind/)
    refused(() => axisUpdate(ctx, { id: LENS.table, axis: 'cols', entry: LENS.status, move: 'left' }), /already the first/)
    refused(() => axisUpdate(ctx, { id: LENS.table, axis: 'rows', entry: 'QR table ordering', name: 'x' }), /is a card/)
    refused(() => axisRemove(ctx, { id: LENS.table, axis: 'cols', entry: 'name' }), /name column/)
  })
})

describe('update_cell', () => {
  it('a matrix cell by names: a step by label, number or glyph; a set with merge; a note; doesn\'t apply', () => {
    const ctx = ctxOf()
    const p = updateCell(ctx, { id: ID.matrix, row: 'Square', col: 'Loyalty stamps', value: 'Full', note: 'stamps in app' })
    expect(p.writes).toEqual([{ coll: 'cells', id: `${ID.matrix}_${LENS.square}_${ID.loyalty}`, merge: true, set: { matrixId: ID.matrix, row: LENS.square, col: ID.loyalty, updatedAt: NOW, value: 'full', notes: 'stamps in app' } }])
    expect(p.meta).toEqual({ kind: 'matrix' })
    let ws = run(ctx, [p])
    expect(cell(ws, ID.matrix, LENS.square, ID.loyalty)).toMatchObject({ value: 'full', notes: 'stamps in app' })
    ws = run(ctx, [updateCell(ctx, { id: ID.matrix, row: LENS.square, col: ID.qr, value: 2 })])
    // A merge keeps the note.
    expect(cell(ws, ID.matrix, LENS.square, ID.qr)).toMatchObject({ value: 'partial', notes: 'no QR' })
    ws = run(ctx, [updateCell(ctx, { id: ID.matrix, row: LENS.square, col: 'QR table ordering › works offline', value: '●', not_relevant: true })])
    expect(cell(ws, ID.matrix, LENS.square, `${ID.qr}~c1`)).toMatchObject({ value: 'full', notRelevant: true })
    ws = run(ctx, [updateCell(ctx, { id: ID.matrix, row: LENS.square, col: ID.qr, value: null, note: null })])
    expect(cell(ws, ID.matrix, LENS.square, ID.qr)).toMatchObject({ matrixId: ID.matrix, row: LENS.square, col: ID.qr, updatedAt: NOW })
    expect(cell(ws, ID.matrix, LENS.square, ID.qr)).not.toHaveProperty('value')
    expect(cell(ws, ID.matrix, LENS.square, ID.qr)).not.toHaveProperty('notes')
    ws = run(ctx, [updateCell(ctx, { id: ID.matrix, row: LENS.square, col: ID.qr, clear: true })])
    expect(cell(ws, ID.matrix, LENS.square, ID.qr)).toBeUndefined()
  })

  it('refused with a fix: ambiguous name (candidates), a step out of range, a hidden entry, guesses not allowed, a read-only column', () => {
    const ws = lensWs()
    matrixOf(ws).rows.hide = [ID.orderly]
    const ctx = ctxOf(ws)
    const amb = refused(() => updateCell(ctxOf(), { id: ID.matrix, row: 'Orderly', col: ID.qr, value: 'full' }), /"Orderly" names more than one row/)
    expect(amb.fix).toMatch(new RegExp(`Orderly \\[${ID.orderly}\\].*Orderly \\[${LENS.orderly2}\\]`))
    const range = refused(() => updateCell(ctx, { id: ID.matrix, row: 'Square', col: ID.qr, value: 5 }), /out of range: the scale has 3 steps/)
    expect(range.fix).toMatch(/1 none, 2 partial, 3 full/)
    refused(() => updateCell(ctx, { id: ID.matrix, row: 'Square', col: ID.qr, value: 'great' }), /isn't one of the scale's steps/)
    const hidden = refused(() => updateCell(ctx, { id: ID.matrix, row: ID.orderly, col: ID.qr, value: 'full' }), /taken out of the matrix's rows/)
    expect(hidden.fix).toMatch(/axis_add/)
    refused(() => updateCell(ctx, { id: ID.matrix, row: 'Square', col: ID.qr, confidence: 'guess' }), /doesn't mark guesses/)
    refused(() => updateCell(ctx, { id: ID.matrix, row: 'Square', col: 'Nope', value: 'full' }), /no column Nope/)
    refused(() => updateCell(ctx, { id: LENS.table, row: 'QR table ordering', col: 'status', value: 'x' }), /read-only/)
    refused(() => updateCell(ctx, { id: LENS.table, row: 'QR table ordering', col: 'cost', value: 'lots' }), /isn't a number/)
    const thousands = refused(() => updateCell(ctx, { id: LENS.table, row: 'QR table ordering', col: 'cost', value: '1,234' }), /could be 1234 or 1.234/)
    expect(thousands.fix).toBe('give 1234 or 1.234')
    // Orderly's QR cell reads from QR's criteria, one of them scored: refused, the note still allowed.
    const rolled = refused(() => updateCell(ctxOf(), { id: ID.matrix, row: ID.orderly, col: 'QR table ordering', value: 'full' }), /reads from what it's judged on/)
    expect(rolled.fix).toMatch(/QR table ordering › criterion.*works offline/)
    expect(updateCell(ctxOf(), { id: ID.matrix, row: ID.orderly, col: ID.qr, note: 'see criteria' }).writes).toHaveLength(1)
  })

  it('a table cell: a check, a number from text, a step; unchecking takes the value away', () => {
    const ctx = ctxOf()
    let ws = run(ctx, [updateCell(ctx, { id: LENS.table, row: 'QR table ordering', col: 'done', value: true })])
    expect(cell(ws, LENS.table, ID.qr, LENS.done)?.value).toBe('yes')
    ws = run(ctx, [updateCell(ctx, { id: LENS.table, row: 'Ops work', col: 'done', value: false })])
    expect(cell(ws, LENS.table, LENS.backlog, LENS.done)?.value).toBeUndefined()
    ws = run(ctx, [updateCell(ctx, { id: LENS.table, row: 'Loyalty stamps', col: 'cost', value: '1,5' }), updateCell(ctx, { id: LENS.table, row: 'Loyalty stamps', col: 'risk', value: 'High' })])
    expect(cell(ws, LENS.table, ID.loyalty, LENS.cost)?.value).toBe(1.5)
    expect(cell(ws, LENS.table, ID.loyalty, LENS.risk)?.value).toBe('high')
  })

  it('viewers are refused by validate', () => {
    const ctx = ctxOf()
    const v = validate([updateCell(ctx, { id: ID.matrix, row: 'Square', col: ID.qr, value: 'full' })], ctx.ws, CAROL)
    expect(v.ok).toBe(false)
  })
})

describe('criteria (D-133, D-249)', () => {
  it('taking a criterion off a feature deletes its matrix cells and old comparison scores; adding one writes only the card', () => {
    const ctx = ctxOf()
    const add = updateCard(ctx, { card: ID.qr, fields: { criteria: [{ id: 'c1', text: 'works offline' }, { id: 'c2', text: 'tips' }] } })
    expect(add.writes.map((w) => w.coll)).toEqual(['features'])
    const drop = updateCard(ctx, { card: ID.qr, fields: { criteria: null } })
    expect(drop.writes).toEqual([
      { coll: 'features', id: ID.qr, patch: { criteria: DELETE, updatedAt: NOW } },
      { coll: 'cells', id: `${ID.matrix}_${ID.orderly}_${ID.qr}~c1`, del: true },
      { coll: 'comparisons', id: `${ID.qr}_${ID.orderly}`, patch: { criteria: DELETE } },
    ])
    const ws = run(ctx, [drop])
    expect(ws.cells.some((c) => c.col.includes('~c1'))).toBe(false)
    expect(ws.comparisons[0].criteria).toBeUndefined()
    // One of two criteria: only its score goes from the comparison.
    const ws2 = lensWs()
    const qr = ws2.cards.find((c) => c.id === ID.qr)!
    qr.criteria = [...(qr.criteria ?? []), { id: 'c2', text: 'tips' }]
    ws2.comparisons[0].criteria = { c1: 'part', c2: 'met' }
    const ctx2 = ctxOf(ws2)
    const one = updateCard(ctx2, { card: ID.qr, fields: { criteria: [{ id: 'c2', text: 'tips' }] } })
    expect(one.writes.at(-1)).toEqual({ coll: 'comparisons', id: `${ID.qr}_${ID.orderly}`, patch: { 'criteria.c1': DELETE } })
    expect(run(ctx2, [one]).comparisons[0].criteria).toEqual({ c2: 'met' })
    // The matrix's other cells stay.
    expect(cell(ws, ID.matrix, ID.orderly, ID.qr)).toBeDefined()
  })
})
