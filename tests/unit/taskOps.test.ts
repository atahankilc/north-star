// S8's task, deck and timeline ops on the fixture, pure: create_task / update_task / move_task (orders between
// neighbours, lanes, another deck), delete for tasks and columns (a column's tasks go to the one before), update_deck
// (D-300: switching to cards with tasks moves them first), the column ops, create_piece's typed deck, update_timeline,
// create_evidence from_task, and cleanTask keeping a task's first day. Wrappers and undo: tests/unit/wrappers.test.ts.
import { describe, expect, it } from 'vitest'
import { counterIds } from '../../src/ops/newId'
import { validate } from '../../src/ops/validate'
import { project } from '../../src/ops/project'
import { DELETE, OpsRefused, type OpCtx, type Plan } from '../../src/ops/types'
import { createTask, moveTask, updateTask } from '../../src/ops/tasks'
import { createDeckColumn, moveDeckColumn, updateDeck, updateDeckColumn, updateTimeline } from '../../src/ops/deck'
import { createPiece } from '../../src/ops/pieces'
import { createEvidence } from '../../src/ops/evidence'
import { deleteAny } from '../../src/ops/delete'
import { build, buildBatch } from '../../src/ops/registry'
import { cleanTask } from '../../src/model/clean'
import { isDay, ordersBetween } from '../../src/model/tasks'
import type { KanbanSetup } from '../../src/data/tasks'
import type { WorkspaceCtx } from '../../src/state/wsStore'
import { ALICE, CAROL, ID, T, TASKS, taskDocs, tasksWs, wsFrom } from './fixtures/ws'

const NOW = T + 1000
const ctxOf = (ws: WorkspaceCtx = tasksWs()): OpCtx => ({ ws, actor: ALICE, now: NOW, newId: counterIds('new') })
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
const task = (ws: WorkspaceCtx, id: string) => ws.tasks.find((t) => t.id === id)!
const deckOf = (ws: WorkspaceCtx, id: string) => ws.pieces.find((p) => p.id === id)!.kanban as KanbanSetup

describe('model: orders and days', () => {
  it('ordersBetween spreads n tasks between neighbours, before the first, after the last, in an empty column', () => {
    expect(ordersBetween(1, 2, 1)).toEqual([1.5])
    expect(ordersBetween(1, 2, 3)).toEqual([1.25, 1.5, 1.75])
    expect(ordersBetween(undefined, 1, 2)).toEqual([-1, 0])
    expect(ordersBetween(4, undefined, 2)).toEqual([5, 6])
    expect(ordersBetween(undefined, undefined, 2)).toEqual([1, 2])
  })
  it('isDay takes calendar days only', () => {
    expect(isDay('2026-11-05')).toBe(true)
    expect(isDay('2026-13-01')).toBe(false)
    expect(isDay('2026-02-30')).toBe(false)
    expect(isDay('5 Nov')).toBe(false)
  })
  it('cleanTask keeps the first day (D-304), learned only as skip; a bad day is dropped', () => {
    const t = cleanTask({ title: 'x', order: 1, start: '2026-11-01', due: '2026-11-02', learned: 'skip', priority: 'P1', labels: ['a'], checks: [{ id: 'c', text: 'y' }] }, T)!
    expect(t).toMatchObject({ start: '2026-11-01', due: '2026-11-02', learned: 'skip', priority: 'P1', labels: ['a'], checks: [{ id: 'c', text: 'y' }] })
    expect(cleanTask({ title: 'x', order: 1, start: 'soon', learned: 'evid1' }, T)).not.toHaveProperty('start')
    expect(cleanTask({ title: 'x', order: 1, learned: 'evid1' }, T)).not.toHaveProperty('learned')
  })
})

describe('create_task', () => {
  it('on a deck by name, in a column by name, at its end, with every field; given by the actor, the name as other tasks show it', () => {
    const ctx = ctxOf()
    const p = createTask(ctx, {
      deck: 'ops',
      column: 'Review',
      title: '  Ship the invoice export ',
      assignee: 'u-bob',
      start: '2026-11-02',
      due: '2026-11-04',
      card: ID.qr,
      priority: 'P1',
      labels: ['#billing', 'billing', 'ops'],
      checks: ['csv', { text: 'pdf', done: true }],
      notes: 'From the café call',
    })
    expect(p.meta?.kind).toBe('task')
    const ws = run(ctx, [p])
    const t = task(ws, p.ids.$new)
    expect(t).toMatchObject({ pieceId: TASKS.ops, col: 'review', order: 2, title: 'Ship the invoice export', assignee: 'u-bob', assigneeName: 'Bob', givenAt: NOW, givenBy: 'u-alice', start: '2026-11-02', due: '2026-11-04', cardId: ID.qr, cardType: 'feature', priority: 'P1', labels: ['billing', 'ops'], notes: 'From the café call', uid: 'u-alice' })
    expect(t.checks!.map((c) => [c.text, !!c.done])).toEqual([['csv', false], ['pdf', true]])
    expect(new Set(t.checks!.map((c) => c.id)).size).toBe(2)
  })

  it('the first column when left out; before or after a task: the order between its neighbours', () => {
    const ctx = ctxOf()
    const end = createTask(ctx, { deck: ID.deck, title: 'a' })
    expect(end.writes[0].set).toMatchObject({ col: 'todo', order: 3 })
    expect(createTask(ctx, { deck: ID.deck, title: 'b', before: TASKS.task3 }).writes[0].set!.order).toBe(1.5)
    expect(createTask(ctx, { deck: ID.deck, title: 'c', after: ID.task1 }).writes[0].set!.order).toBe(1.5)
    expect(createTask(ctx, { deck: ID.deck, title: 'd', before: ID.task1 }).writes[0].set!.order).toBe(0)
    expect(createTask(ctx, { deck: ID.deck, title: 'e', column: 'doing', after: ID.task2 }).writes[0].set!.order).toBe(2)
    // No assignee: no givenAt.
    expect(end.writes[0].set).not.toHaveProperty('givenAt')
  })

  it('refuses with a fix: a deck holding cards, an unknown column (its columns listed), a bad day, first day after due, a non-member, no title, an ambiguous deck name (both listed)', () => {
    const ctx = ctxOf()
    refused(() => createTask(ctx, { deck: TASKS.cardsDeck, title: 'x' }), /holds cards, not tasks/)
    const col = refused(() => createTask(ctx, { deck: ID.deck, column: 'blocked', title: 'x' }), /no column blocked/)
    expect(col.fix).toMatch(/todo \[todo\].*doing \[doing\].*done \[done\]/)
    refused(() => createTask(ctx, { deck: ID.deck, title: 'x', due: '2026-13-01' }), /due 2026-13-01 isn't a day/)
    refused(() => createTask(ctx, { deck: ID.deck, title: 'x', start: '2026-11-05', due: '2026-11-01' }), /first day 2026-11-05 is after its due day/)
    const who = refused(() => createTask(ctx, { deck: ID.deck, title: 'x', assignee: 'u-dave' }), /isn't a member/)
    expect(who.fix).toContain('Bob [u-bob]')
    refused(() => createTask(ctx, { deck: ID.deck, title: '  ' }), /needs a title/)
    refused(() => createTask(ctx, { deck: ID.deck, title: 'x', before: ID.task2 }), /no task .* in that column/)
    const many = refused(() => createTask(ctx, { deck: 'build', title: 'x' }), /"build" names more than one deck/)
    expect(many.fix).toContain(ID.deck)
    expect(many.fix).toContain(TASKS.cardsDeck)
    refused(() => createTask(ctx, { deck: ID.planeA, title: 'x' }), /is a plane, not a deck/)
  })

  it('a viewer is refused by validate', () => {
    const ctx = ctxOf()
    const p = createTask(ctx, { deck: ID.deck, title: 'x' })
    expect(validate([p], ctx.ws, CAROL).ok).toBe(false)
  })
})

describe('update_task', () => {
  it('null takes a field away; given to nobody takes the name and the given marks too; a card by id brings its type', () => {
    const ctx = ctxOf()
    let ws = run(ctx, [updateTask(ctx, { task: ID.task2, assignee: null, due: '2026-12-01', card: ID.preorder })])
    const t = task(ws, ID.task2)
    expect(t).not.toHaveProperty('assignee')
    expect(t).not.toHaveProperty('assigneeName')
    expect(t).toMatchObject({ due: '2026-12-01', cardId: ID.preorder, cardType: 'idea' })
    ws = run(ctx, [updateTask(ctx, { task: TASKS.task3, due: null, priority: null, labels: [], checks: null, card: null })])
    const t3 = task(ws, TASKS.task3)
    for (const k of ['due', 'priority', 'labels', 'checks', 'cardId']) expect(t3).not.toHaveProperty(k)
    expect(t3.start).toBe('2026-11-01')
  })

  it('a first day past the due day it keeps moves that along (and the other way); both said and crossed is refused; several tasks at once in one plan', () => {
    const ctx = ctxOf()
    expect(updateTask(ctx, { task: TASKS.task3, start: '2026-11-20' }).writes[0].patch).toMatchObject({ start: '2026-11-20', due: '2026-11-20' })
    expect(updateTask(ctx, { task: TASKS.task3, due: '2026-10-20' }).writes[0].patch).toMatchObject({ start: '2026-10-20', due: '2026-10-20' })
    refused(() => updateTask(ctx, { task: TASKS.task3, start: '2026-11-20', due: '2026-11-19' }), /after its due day 2026-11-19/)
    const p = updateTask(ctx, { tasks: [ID.task1, TASKS.task3], priority: 'P3' })
    expect(p.writes).toHaveLength(2)
    expect(p.label).toBe('edit 2 tasks')
    const ws = run(ctx, [p])
    expect([task(ws, ID.task1).priority, task(ws, TASKS.task3).priority]).toEqual(['P3', 'P3'])
    refused(() => updateTask(ctx, { task: 'nope', title: 'x' }), /no task nope/)
    refused(() => updateTask(ctx, { task: ID.task1 }), /nothing to change/)
  })

  it("learned: 'skip'", () => {
    const ctx = ctxOf()
    expect(task(run(ctx, [updateTask(ctx, { task: ID.task1, learned: 'skip' })]), ID.task1).learned).toBe('skip')
  })
})

describe('move_task', () => {
  it('several tasks to a column after a task: one plan, in the order given, between the neighbours', () => {
    const ctx = ctxOf()
    const p = moveTask(ctx, { tasks: [TASKS.task3, ID.task1], column: 'doing', after: ID.task2 })
    expect(p.label).toBe('move 2 tasks')
    const ws = run(ctx, [p])
    expect([task(ws, TASKS.task3), task(ws, ID.task1)].map((t) => [t.col, t.order])).toEqual([['doing', 2], ['doing', 3]])
    // Before a task: its column taken from it.
    const q = moveTask(ctx, { task: ID.task1, before: ID.task2 })
    expect(q.writes[0].patch).toMatchObject({ col: 'doing', order: 0 })
  })

  it('onto another deck (by name, its column by name), before a task there', () => {
    const ctx = ctxOf()
    const ws = run(ctx, [moveTask(ctx, { task: ID.task1, deck: 'Ops', column: 'review', before: TASKS.task4 })])
    expect(task(ws, ID.task1)).toMatchObject({ pieceId: TASKS.ops, col: 'review', order: 0 })
    refused(() => moveTask(ctx, { task: ID.task1, deck: TASKS.cardsDeck, column: 'todo' }), /holds cards/)
    refused(() => moveTask(ctx, { task: ID.task1, column: 'doing', before: ID.task1 }), /one of the tasks being moved/)
  })

  it('into a lane: by who, the member (and their name); a deck without lanes refuses', () => {
    let ctx = ctxOf()
    refused(() => moveTask(ctx, { task: ID.task1, column: 'doing', lane: 'u-bob' }), /has no lanes/)
    ctx = ctxOf(run(ctx, [updateDeck(ctx, { id: ID.deck, lanes: 'assignee' })]))
    const ws = run(ctx, [moveTask(ctx, { task: ID.task1, column: 'doing', lane: 'u-bob' })])
    expect(task(ws, ID.task1)).toMatchObject({ col: 'doing', assignee: 'u-bob', assigneeName: 'Bob', givenBy: 'u-alice' })
    const back = run(ctx, [moveTask(ctx, { task: ID.task2, column: 'todo', lane: 'none' })])
    expect(task(back, ID.task2)).not.toHaveProperty('assignee')
  })
})

describe('delete: tasks and columns', () => {
  it('a task; several tasks', () => {
    const ctx = ctxOf()
    const p = deleteAny(ctx, { ids: [ID.task1, TASKS.task3] })
    expect(p.label).toBe('delete 2 tasks')
    expect(p.meta?.kind).toBe('task')
    const ws = run(ctx, [p])
    expect(ws.tasks.map((t) => t.id).sort()).toEqual([ID.task2, TASKS.task4])
  })

  it("a column: its tasks go to the end of the one before it (the first column's to the next), in their order; the last column never goes", () => {
    const ctx = ctxOf()
    const p = deleteAny(ctx, { ids: ['doing'] })
    expect(p).toMatchObject({ label: 'delete a column', meta: { kind: 'kanban' } })
    let ws = run(ctx, [p])
    expect(deckOf(ws, ID.deck).cols.map((c) => c.id)).toEqual(['todo', 'done'])
    expect(task(ws, ID.task2)).toMatchObject({ col: 'todo', order: 3 })
    // `todo` is a column on two decks: which one?
    const which = refused(() => deleteAny(ctx, { ids: ['todo'] }), /column on 2 decks/)
    expect(which.fix).toContain(TASKS.ops)
    ws = run(ctx, [deleteAny(ctx, { ids: ['todo'], deck: ID.deck })])
    expect([task(ws, ID.task1), task(ws, TASKS.task3)].map((t) => [t.col, t.order])).toEqual([['doing', 2], ['doing', 3]])
    // Other decks' tasks in a column with the same id stay.
    expect(task(ws, TASKS.task4).col).toBe('review')
    const one = ctxOf(project(ctx.ws, [updateDeck(ctx, { id: TASKS.cardsDeck, holds: 'tasks' })]))
    refused(() => deleteAny(one, { ids: ['k1'] }), /only column/)
  })

  it('a deck with a column of it in the same delete: the deck goes with its tasks, nothing left half-written', () => {
    const ctx = ctxOf()
    const ws = run(ctx, [deleteAny(ctx, { ids: [ID.deck, 'doing'] })])
    expect(ws.pieces.some((p) => p.id === ID.deck)).toBe(false)
    expect(ws.tasks.map((t) => t.id)).toEqual([TASKS.task4])
  })
})

describe('update_deck (D-300) and the column ops', () => {
  it('switching to cards with tasks on it is refused, saying where they can go', () => {
    const ctx = ctxOf()
    const e = refused(() => updateDeck(ctx, { id: ID.deck, holds: 'cards' }), /holds 3 tasks: switched to cards they would be hidden/)
    expect(e.fix).toMatch(/tasks_to: 'new_deck'/)
  })

  it("tasks_to a deck: each into the column of the same name (any case), else its first, after what's there; the deck holds cards (defaults) in the same plan", () => {
    const ctx = ctxOf()
    const p = updateDeck(ctx, { id: ID.deck, holds: 'cards', tasks_to: 'Ops' })
    expect(p.label).toBe('move 3 tasks to Ops, hold cards on a deck')
    const ws = run(ctx, [p])
    expect(deckOf(ws, ID.deck)).toMatchObject({ holds: 'cards', colField: 'status', source: { rules: [{ field: 'type', values: ['feature'] }] } })
    // todo → Todo (1, 2: in their order), doing → no such column → its first, after them.
    expect([ID.task1, TASKS.task3, ID.task2].map((id) => [task(ws, id).pieceId, task(ws, id).col, task(ws, id).order])).toEqual([
      [TASKS.ops, 'todo', 1],
      [TASKS.ops, 'todo', 2],
      [TASKS.ops, 'todo', 3],
    ])
  })

  it("tasks_to 'new_deck': a new deck of tasks next to it with its columns, the tasks keeping their columns and orders", () => {
    const ctx = ctxOf()
    const p = updateDeck(ctx, { id: ID.deck, holds: 'cards', tasks_to: 'new_deck', handle: '$tasks' })
    const id = p.ids.$tasks
    expect(id).toBeTruthy()
    const ws = run(ctx, [p])
    const made = ws.pieces.find((x) => x.id === id)!
    expect(made).toMatchObject({ kind: 'kanban', name: 'Build · tasks' })
    expect(made.kanban!.cols.map((c) => c.id)).toEqual(['todo', 'doing', 'done'])
    expect(made.x).toBeGreaterThanOrEqual(900)
    expect(ws.tasks.filter((t) => t.pieceId === id).map((t) => [t.id, t.col, t.order]).sort()).toEqual([
      [ID.task1, 'todo', 1],
      [ID.task2, 'doing', 1],
      [TASKS.task3, 'todo', 2],
    ].sort())
    refused(() => updateDeck(ctx, { id: TASKS.ops, tasks_to: 'new_deck' }), /holds tasks: its tasks stay/)
  })

  it('lanes, rows, box names; rows and columns from the same field refused; card-only fields on a deck of tasks refused', () => {
    const ctx = ctxOf()
    let ws = run(ctx, [updateDeck(ctx, { id: TASKS.cardsDeck, row_field: 'impact', names: [{ col: 'planned', row: 'high', name: 'next', tone: 'good' }], rules: [{ field: 'plane', values: ['Market'] }] })])
    expect(deckOf(ws, TASKS.cardsDeck)).toMatchObject({ rowField: 'impact', names: [{ col: 'planned', row: 'high', name: 'next', tone: 'good' }], source: { rules: [{ field: 'plane', values: [ID.planeB] }] } })
    ws = run(ctx, [updateDeck(ctx, { id: TASKS.cardsDeck, row_field: null })])
    expect(deckOf(ws, TASKS.cardsDeck)).not.toHaveProperty('rowField')
    refused(() => updateDeck(ctx, { id: TASKS.cardsDeck, row_field: 'status' }), /same field/)
    refused(() => updateDeck(ctx, { id: TASKS.ops, col_field: 'effort' }), /are for a deck holding cards/)
    expect(updateDeck(ctx, { id: TASKS.ops, lanes: 'card' }).writes[0].patch).toMatchObject({ 'kanban.rows': 'card' })
    expect(updateDeck(ctx, { id: TASKS.ops, lanes: null }).writes[0].patch).toMatchObject({ 'kanban.rows': DELETE })
  })

  it('columns: add at the end, rename, limit, finished, move; by name; refusals with fixes', () => {
    const ctx = ctxOf()
    const add = createDeckColumn(ctx, { deck: 'Ops', name: 'blocked', limit: 2 })
    let ws = run(ctx, [add])
    const cols = deckOf(ws, TASKS.ops).cols
    expect(cols.at(-1)).toMatchObject({ name: 'blocked', limit: 2 })
    expect(add.meta?.ids).toEqual([cols.at(-1)!.id])
    ws = run(ctx, [updateDeckColumn(ctx, { deck: TASKS.ops, column: 'Review', name: 'in review', limit: null, done: true })])
    expect(deckOf(ws, TASKS.ops).cols[1]).toEqual({ id: 'review', name: 'in review', done: true })
    ws = run(ctx, [moveDeckColumn(ctx, { deck: TASKS.ops, column: 'shipped', by: 'left' })])
    expect(deckOf(ws, TASKS.ops).cols.map((c) => c.id)).toEqual(['todo', 'shipped', 'review'])
    refused(() => moveDeckColumn(ctx, { deck: TASKS.ops, column: 'todo', by: 'left' }), /first column already/)
    refused(() => updateDeckColumn(ctx, { deck: TASKS.ops, column: 'review', limit: 0 }), /a limit is a number/)
    refused(() => createDeckColumn(ctx, { deck: TASKS.ops, name: ' ' }), /needs a name/)
    // rename finds a column by id (the deck said when two share it).
    const r = build(ctx, 'rename', { id: 'review', name: 'checking' })
    expect(r.op).toBe('rename')
    expect(run(ctx, [r]).pieces.find((x) => x.id === TASKS.ops)!.kanban!.cols[1].name).toBe('checking')
    refused(() => build(ctx, 'rename', { id: 'todo', name: 'x' }), /column on 2 decks/)
  })
})

describe('create_piece with a typed deck, update_timeline, create_evidence from_task', () => {
  it('a deck from a template, from columns with a finished one, holding cards by rules; card fields on tasks refused', () => {
    const ctx = ctxOf()
    const pr = createPiece(ctx, { kind: 'deck', canvas: 'main', deck: { template: 'priorities' } })
    expect(run(ctx, [pr]).pieces.find((p) => p.id === pr.ids.$new)!.kanban).toMatchObject({ holds: 'cards', colField: 'effort', rowField: 'impact' })
    const cols = createPiece(ctx, { kind: 'deck', canvas: 'main', deck: { columns: ['ideas', { name: 'doing', limit: 3 }, 'live'], finished: 'live', lanes: 'assignee' } })
    const k = run(ctx, [cols]).pieces.find((p) => p.id === cols.ids.$new)!.kanban!
    expect(k.cols.map((c) => [c.name, c.limit ?? null, !!c.done])).toEqual([['ideas', null, false], ['doing', 3, false], ['live', null, true]])
    expect(k.rows).toBe('assignee')
    const cards = createPiece(ctx, { kind: 'deck', canvas: 'main', deck: { holds: 'cards', rules: [{ field: 'type', values: ['idea'] }], col_field: 'status' } })
    expect(run(ctx, [cards]).pieces.find((p) => p.id === cards.ids.$new)!.kanban).toMatchObject({ holds: 'cards', colField: 'status', source: { rules: [{ field: 'type', values: ['idea'] }], items: [] } })
    refused(() => createPiece(ctx, { kind: 'deck', canvas: 'main', deck: { rules: [] } }), /are for a deck holding cards/)
    refused(() => createPiece(ctx, { kind: 'deck', canvas: 'main', deck: { template: 'sprints' } }), /no deck template sprints/)
    refused(() => createPiece(ctx, { kind: 'table', canvas: 'main', deck: {} }), /has no deck setup/)
  })

  it("update_timeline: rows by who; by deck stored as none; not a timeline refused", () => {
    const ctx = ctxOf()
    const p = updateTimeline(ctx, { id: TASKS.timeline, rows: 'assignee' })
    expect(p.meta?.kind).toBe('timeline')
    expect(run(ctx, [p]).pieces.find((x) => x.id === TASKS.timeline)!.timeline).toEqual({ rows: 'assignee' })
    expect(updateTimeline(ctx, { id: TASKS.timeline, rows: 'deck' }).writes[0].patch).toMatchObject({ 'timeline.rows': DELETE })
    refused(() => updateTimeline(ctx, { id: ID.deck, rows: 'card' }), /a deck, not a timeline/)
  })

  it('create_evidence from_task: on the task\'s card, the task marked learned, one plan', () => {
    const ctx = ctxOf()
    const p = createEvidence(ctx, { from_task: ID.task1, kind: 'interview', text: 'Sundays are slow', stance: 'supports' })
    expect(p.label).toBe('log what a task taught')
    const ws = run(ctx, [p])
    const ev = ws.evidence.find((e) => e.id === p.ids.$new)!
    expect(ev).toMatchObject({ nodeId: ID.anna, nodeType: 'customer', text: 'Sundays are slow' })
    expect(task(ws, ID.task1).learned).toBe(ev.id)
    refused(() => createEvidence(ctx, { from_task: TASKS.task4, kind: 'interview', text: 'x', stance: 'supports' }), /for no card/)
  })

  it('a batch: a deck, a column, then a task in it by name (the projection sees the earlier ops)', () => {
    const ctx = ctxOf()
    const plans = buildBatch(ctx, [
      { op: 'create_piece', args: { kind: 'deck', canvas: 'main', name: 'Launch', handle: '$d' } },
      { op: 'create_deck_column', args: { deck: '$d', name: 'blocked' } },
      { op: 'create_task', args: { deck: 'Launch', column: 'blocked', title: 'Wait for the printer', due: '2026-11-20' } },
    ])
    const ws = run(ctx, plans)
    const t = ws.tasks.find((x) => x.title === 'Wait for the printer')!
    const d = ws.pieces.find((p) => p.id === plans[0].ids.$d)!
    expect(t.pieceId).toBe(d.id)
    expect(d.kanban!.cols.find((c) => c.id === t.col)!.name).toBe('blocked')
  })
})

describe('assignees: members and those tasks are already given to', () => {
  it("a former member a task is given to (their lane) is accepted, an unknown uid refused", () => {
    const docs = taskDocs()
    const t4 = docs.tasks.find((t) => t.id === TASKS.task4)!
    Object.assign(t4, { assignee: 'u-erin', assigneeName: 'Erin' })
    let ctx = ctxOf(wsFrom(docs))
    ctx = ctxOf(run(ctx, [updateDeck(ctx, { id: ID.deck, lanes: 'assignee' })]))
    const ws = run(ctx, [moveTask(ctx, { task: ID.task1, column: 'doing', lane: 'u-erin' })])
    expect(task(ws, ID.task1)).toMatchObject({ assignee: 'u-erin', assigneeName: 'Erin' })
    expect(createTask(ctx, { deck: ID.deck, title: 'x', assignee: 'u-erin' }).writes[0].set).toMatchObject({ assignee: 'u-erin' })
    const e = refused(() => createTask(ctx, { deck: ID.deck, title: 'x', assignee: 'u-zed' }), /isn't a member/)
    expect(e.fix).toContain('Erin [u-erin]')
  })
})
