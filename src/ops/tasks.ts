// Task ops (S8, D-312; docs/specs/agent-actions.md §13, §14): create_task, update_task, move_task, and delete's tasks.
// Pure builders `(ctx, args) => Plan`, the writes data/tasks.ts made before it wrapped them. Where a task goes in its
// column (before or after another, else at the end) is worked out here from the snapshot (R7: Kanban.tsx, TaskPanel.tsx,
// CardTasks.tsx and Timeline.tsx each did it), and so is who gave it (`givenAt`/`givenBy`, D-261: the actor).
//
// The model sees `deck`; the data keeps `kanban` (D-301): a deck is named by id or name, a column by id or name.
import { candidates, findNamed } from '../model/lens'
import { isDay, ordersBetween, tasksIn } from '../model/tasks'
import type { Piece } from '../data/model'
import type { Check, KanbanCol, KanbanSetup, Task, TaskPriority } from '../data/tasks'
import { DELETE, type OpCtx, type Plan, type Write } from './types'
import { cardIn, find, handleOf, refuse } from './util'

type P = Piece & { id: string }

// firestore.rules allows these (data/tasks.ts' limits; kept here so the ops stay pure).
export const TASK_TITLE_MAX = 200
export const CHECKS_MAX = 50
export const CHECK_MAX = 200
export const LABELS_MAX = 20
export const LABEL_MAX = 40
export const NOTES_MAX = 20000
export const PRIORITIES = ['P1', 'P2', 'P3'] as const

// ---- Finding decks, columns and tasks (refusing with the candidates)

const deckLine = (p: P) => `${p.name || '(unnamed deck)'} [${p.id}]`

// A deck by id or name; `tasks`: one that holds tasks (a deck holding cards has none).
export function deckIn(ctx: OpCtx, op: string, ref: unknown, tasks = false): P {
  const decks = (ctx.ws.pieces as P[]).filter((p) => p.kind === 'kanban')
  if (typeof ref !== 'string' || !ref.trim()) refuse(op, 'which deck?', `give a deck by id or name: ${candidates(decks.map(deckLine))}`)
  const f = findNamed(decks, ref, (p) => [p.id], (p) => [p.name ?? ''])
  if (!('it' in f)) {
    const other = ctx.ws.pieces.find((p) => p.id === ref)
    if (other) refuse(op, `${ref} is a ${other.kind === 'plane' || !other.kind ? 'plane' : other.kind}, not a deck`, `name a deck: ${candidates(decks.map(deckLine))}`)
    refuse(op, 'many' in f ? `"${ref}" names more than one deck` : `there is no deck ${ref}`, `name one of: ${candidates(('many' in f ? f.many : decks).map(deckLine))}`)
  }
  const d = f.it
  if (tasks && d.kanban?.holds === 'cards')
    refuse(op, `the deck ${d.name || d.id} holds cards, not tasks`, "put the task on a deck that holds tasks, or switch this one back (update_deck holds: 'tasks')")
  return d
}

export const colsOf = (d: P): KanbanCol[] => (d.kanban as KanbanSetup | undefined)?.cols ?? []

// A column of a deck by id or name.
export function columnIn(op: string, d: P, ref: unknown): KanbanCol {
  const cols = colsOf(d)
  const line = (c: KanbanCol) => `${c.name} [${c.id}]`
  if (typeof ref !== 'string' || !ref.trim()) refuse(op, 'which column?', `name one of the deck's columns: ${candidates(cols.map(line))}`)
  const f = findNamed(cols, ref, (c) => [c.id], (c) => [c.name])
  if ('it' in f) return f.it
  refuse(op, 'many' in f ? `"${ref}" names more than one column` : `the deck ${d.name || d.id} has no column ${ref}`, `name one of: ${candidates(('many' in f ? f.many : cols).map(line))}`)
}

export const taskIn = (ctx: OpCtx, op: string, id: unknown): Task => find(ctx.ws.tasks, op, id, 'task')

// A deck's tasks (each deck's columns have their own ids: two decks may both have a `todo`).
export const tasksOf = (ctx: OpCtx, deck: string) => ctx.ws.tasks.filter((t) => t.pieceId === deck)

// Orders for `n` tasks put in `col` of `deck`, before or after a task there, else at the end; `skip`: the tasks being
// moved (not their own neighbours).
export function ordersIn(ctx: OpCtx, op: string, deck: string, col: string, n: number, where: { before?: string; after?: string }, skip: string[] = []): number[] {
  if (where.before !== undefined && where.after !== undefined) refuse(op, 'before and after both say where', 'give one of them')
  const list = tasksIn(tasksOf(ctx, deck).filter((t) => !skip.includes(t.id)), col)
  const ref = where.before ?? where.after
  if (ref === undefined) return ordersBetween(list.at(-1)?.order, undefined, n)
  const i = list.findIndex((t) => t.id === ref)
  if (i < 0) {
    if (skip.includes(String(ref))) refuse(op, `${ref} is one of the tasks being moved`, 'put them before or after another task')
    refuse(op, `there is no task ${String(ref)} in that column`, list.length ? `use one of: ${candidates(list.map((t) => `${t.title} [${t.id}]`))}` : 'leave before/after out: the column is empty')
  }
  return where.before !== undefined ? ordersBetween(list[i - 1]?.order, list[i].order, n) : ordersBetween(list[i].order, list[i + 1]?.order, n)
}

// ---- Fields, checked (shared by create_task and update_task)

export type TaskInput = {
  title?: string
  notes?: string | null
  // A member's uid; null: given to nobody.
  assignee?: string | null
  assigneeName?: string | null
  start?: string | null
  due?: string | null
  // A card by id (its type comes with it); null lets go.
  card?: string | null
  priority?: TaskPriority | null
  labels?: string[] | null
  // Steps: their text (new ids), or { id?, text, done? } (the UI's whole list, ids kept).
  checks?: (string | Partial<Check>)[] | null
  // `skip` (not logged); an evidence id (create_evidence's from_task writes that); null takes it away.
  learned?: string | null
}

const gone = (v: unknown) => v === null || v === undefined
const checkId = (ctx: OpCtx, v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : ctx.newId().slice(-6))

// The task's doc fields for what was said: in a patch, null (or undefined: the UI's) takes a field away; in a new doc
// it's left out. The given day pair is checked against the task's other day (`was`).
function taskFields(ctx: OpCtx, op: string, input: TaskInput, patch: boolean, was?: Task): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const has = (k: keyof TaskInput) => k in input && (patch || !gone(input[k]))
  const clear = (k: string) => patch && (out[k] = DELETE)
  if (has('title')) {
    const t = typeof input.title === 'string' ? input.title.trim().slice(0, TASK_TITLE_MAX) : ''
    if (!t) refuse(op, 'a task needs a title', 'give it a few words')
    out.title = t
  }
  if (has('notes')) {
    if (gone(input.notes) || input.notes === '') clear('notes')
    else if (typeof input.notes !== 'string') refuse(op, 'notes are text', 'give the notes as a string, or null to take them away')
    else out.notes = input.notes.slice(0, NOTES_MAX)
  }
  if (has('assignee')) {
    if (gone(input.assignee)) for (const k of ['assignee', 'assigneeName', 'givenAt', 'givenBy']) clear(k)
    else {
      // A member, or someone a task is already given to (a former member's lane and rows still show them).
      const members = ctx.ws.workspace.memberIds ?? []
      const given = ctx.ws.tasks.flatMap((t) => (t.assignee ? [t.assignee] : []))
      if (typeof input.assignee !== 'string' || !(members.includes(input.assignee) || given.includes(input.assignee))) {
        const nameOf = (uid: string) => ctx.ws.tasks.find((t) => t.assignee === uid && t.assigneeName)?.assigneeName
        const line = (uid: string) => (nameOf(uid) ? `${nameOf(uid)} [${uid}]` : uid)
        refuse(op, `${String(input.assignee)} isn't a member of this workspace`, `give a member's uid: ${candidates([...new Set([...members, ...given])].map(line))}`)
      }
      out.assignee = input.assignee
      // Given to someone (D-261): when, and by whom.
      out.givenAt = ctx.now
      out.givenBy = ctx.actor.uid
      // Their name beside it (so the sheet needs no lookup): as said, else as another task given to them has it.
      if (!('assigneeName' in input)) {
        const name = ctx.ws.tasks.find((t) => t.assignee === input.assignee && t.assigneeName)?.assigneeName
        if (name) out.assigneeName = name
        else clear('assigneeName')
      }
    }
  }
  if (has('assigneeName')) {
    if (gone(input.assigneeName) || input.assigneeName === '') clear('assigneeName')
    else if (typeof input.assigneeName !== 'string') refuse(op, 'assigneeName is text', 'give their name, or leave it out')
    else out.assigneeName = input.assigneeName.slice(0, 200)
  }
  for (const k of ['start', 'due'] as const) {
    if (!has(k)) continue
    if (gone(input[k]) || input[k] === '') clear(k)
    else if (!isDay(input[k])) refuse(op, `${k} ${String(input[k])} isn't a day`, `give ${k} as YYYY-MM-DD (e.g. 2026-11-05), or null to take it away`)
    else out[k] = input[k]
  }
  if ('start' in out || 'due' in out) {
    const start = 'start' in out ? out.start : was?.start
    const due = 'due' in out ? out.due : was?.due
    if (typeof start === 'string' && typeof due === 'string' && start > due) {
      // Both said: they disagree. One said past the other it keeps: that one moves along (TaskPanel's rule).
      if ('start' in out && 'due' in out) refuse(op, `its first day ${start} is after its due day ${due}`, 'give a first day on or before the due day')
      if ('start' in out) out.due = start
      else out.start = due
    }
  }
  if (has('card')) {
    if (gone(input.card)) (clear('cardId'), clear('cardType'))
    else {
      const c = cardIn(ctx, op, input.card)
      out.cardId = c.id
      out.cardType = c.type
    }
  }
  if (has('priority')) {
    if (gone(input.priority)) clear('priority')
    else if (!(PRIORITIES as readonly unknown[]).includes(input.priority)) refuse(op, `${String(input.priority)} isn't a priority`, `use ${PRIORITIES.join(', ')}, or null`)
    else out.priority = input.priority
  }
  if (has('labels')) {
    if (gone(input.labels)) clear('labels')
    else {
      if (!Array.isArray(input.labels) || !input.labels.every((l) => typeof l === 'string')) refuse(op, 'labels are a list of words', 'give labels: ["design", …]')
      const list = [...new Set(input.labels.map((l) => l.trim().replace(/^#/, '').slice(0, LABEL_MAX)).filter(Boolean))]
      if (list.length > LABELS_MAX) refuse(op, `at most ${LABELS_MAX} labels`, 'use fewer labels')
      if (list.length) out.labels = list
      else clear('labels')
    }
  }
  if (has('checks')) {
    if (gone(input.checks)) clear('checks')
    else {
      if (!Array.isArray(input.checks)) refuse(op, 'checks are a list', 'give checks: ["a step", { text, done }]')
      const list = input.checks.slice(0, CHECKS_MAX).map((c) => {
        const x = typeof c === 'string' ? { text: c } : c
        if (!x || typeof x.text !== 'string' || !x.text.trim()) refuse(op, 'a step needs its text', 'give each step as text, or { text, done }')
        return { id: checkId(ctx, x.id), text: x.text.slice(0, CHECK_MAX), ...(x.done ? { done: true } : {}) }
      })
      if (list.length) out.checks = list
      else clear('checks')
    }
  }
  if (has('learned')) {
    if (gone(input.learned)) clear('learned')
    else if (typeof input.learned !== 'string' || !input.learned || input.learned.length > 128) refuse(op, "learned is 'skip' or the evidence it logged", "say learned: 'skip' (not logged), or log it with create_evidence from_task")
    else out.learned = input.learned
  }
  return out
}

// ---- create_task

export type CreateTaskArgs = TaskInput & {
  deck: string
  title: string
  // Its column by id or name; left out, the first.
  column?: string
  // Before or after this task in the column; left out, at the end.
  before?: string
  after?: string
  // The UI's exact order (it worked it out from what it shows); instead of before/after.
  order?: number
  handle?: string
  label?: string
}

export function createTask(ctx: OpCtx, args: CreateTaskArgs): Plan {
  const op = 'create_task'
  const d = deckIn(ctx, op, args.deck, true)
  const cols = colsOf(d)
  if (!cols.length) refuse(op, `the deck ${d.name || d.id} has no columns`, 'add one first (create_deck_column)')
  const col = args.column === undefined ? cols[0] : columnIn(op, d, args.column)
  const { deck: _d, column: _c, before, after, order: exact, handle: _h, label, ...input } = args
  if (exact !== undefined && (typeof exact !== 'number' || !Number.isFinite(exact))) refuse(op, 'order is a number', 'leave it out (before/after say where)')
  const order = exact ?? ordersIn(ctx, op, d.id, col.id, 1, { before, after })[0]
  if (!('title' in input)) refuse(op, 'a task needs a title', 'give it a few words')
  const fields = taskFields(ctx, op, input, false)
  const id = ctx.newId()
  const data = { pieceId: d.id, col: col.id, order, ...fields, uid: ctx.actor.uid, createdAt: ctx.now, updatedAt: ctx.now }
  return { op, label: label ?? 'add a task', writes: [{ coll: 'tasks', id, set: data }], ids: { [handleOf(args)]: id }, meta: { kind: 'task' } }
}

// ---- update_task (one task or several, the same fields)

export type UpdateTaskArgs = TaskInput & {
  task?: string
  tasks?: string[]
  // The UI's undo line.
  label?: string
}

export function updateTask(ctx: OpCtx, args: UpdateTaskArgs): Plan {
  const op = 'update_task'
  const ids = args.tasks ?? (args.task !== undefined ? [args.task] : [])
  if (!Array.isArray(ids) || !ids.length) refuse(op, 'which task?', 'give task (an id), or tasks (a list)')
  const { task: _t, tasks: _ts, label, ...input } = args
  if (!Object.keys(input).length) refuse(op, 'nothing to change', 'give a field: title, notes, assignee, start, due, card, priority, labels, checks or learned')
  const writes: Write[] = ids.map((id) => {
    const t = taskIn(ctx, op, id)
    return { coll: 'tasks', id: t.id, patch: { ...taskFields(ctx, op, input, true, t), updatedAt: ctx.now } }
  })
  return { op, label: label ?? (ids.length > 1 ? `edit ${ids.length} tasks` : 'edit a task'), writes, ids: {}, meta: { kind: 'task' } }
}

// ---- move_task (one or several: one plan, one undo step, as the deck's drag moves them)

// The UI's exact moves (its drop worked out each order and lane field): a column, an order, fields, another deck.
export type TaskMoveSpec = { id: string; col: string; order: number; fields?: TaskInput; pieceId?: string }

export type MoveTaskArgs = {
  task?: string
  tasks?: string[]
  // The column they go to, by id or name (on `deck` when given, else on their own deck).
  column?: string
  // Another deck (by id or name): they leave theirs.
  deck?: string
  // Rows by who or by card (the deck's lanes): the lane they go into, a member's uid or a card's id, `none` for no one.
  lane?: string
  before?: string
  after?: string
  moves?: TaskMoveSpec[]
  label?: string
}

export function moveTask(ctx: OpCtx, args: MoveTaskArgs): Plan {
  const op = 'move_task'
  const n = (k: number) => (k > 1 ? `move ${k} tasks` : 'move a task')
  if (args.moves) {
    const writes: Write[] = args.moves.map((m) => {
      const t = taskIn(ctx, op, m.id)
      const to = m.pieceId ? deckIn(ctx, op, m.pieceId, true) : undefined
      if (typeof m.order !== 'number' || !Number.isFinite(m.order)) refuse(op, 'order is a number', 'give each move an order')
      const col = columnIn(op, to ?? deckIn(ctx, op, t.pieceId), m.col)
      return { coll: 'tasks', id: t.id, patch: { ...(to ? { pieceId: to.id } : {}), col: col.id, order: m.order, ...taskFields(ctx, op, m.fields ?? {}, true, t), updatedAt: ctx.now } }
    })
    return { op, label: args.label ?? n(writes.length), writes, ids: {}, meta: { kind: 'task' } }
  }
  const ids = args.tasks ?? (args.task !== undefined ? [args.task] : [])
  if (!Array.isArray(ids) || !ids.length) refuse(op, 'which task?', 'give task (an id), or tasks (a list, in the order they go)')
  const list = ids.map((id) => taskIn(ctx, op, id))
  const homes = [...new Set(list.map((t) => t.pieceId))]
  if (args.deck === undefined && homes.length > 1) refuse(op, 'the tasks are on different decks', 'give deck: the one they all go to')
  const d = deckIn(ctx, op, args.deck ?? homes[0], true)
  if (args.column === undefined && args.before === undefined && args.after === undefined && args.deck === undefined) refuse(op, 'where to?', 'give column (by id or name), and before or after a task there')
  // Into the column of the task named, else the one said, else (another deck) its first.
  const near = args.before ?? args.after
  const nearTask = near !== undefined ? tasksOf(ctx, d.id).find((t) => t.id === near) : undefined
  const col = args.column !== undefined ? columnIn(op, d, args.column) : nearTask ? columnIn(op, d, nearTask.col) : colsOf(d)[0]
  if (!col) refuse(op, `the deck ${d.name || d.id} has no columns`, 'add one first (create_deck_column)')
  const orders = ordersIn(ctx, op, d.id, col.id, list.length, { before: args.before, after: args.after }, ids)
  const lane = args.lane === undefined ? {} : laneFields(op, d, args.lane)
  const writes: Write[] = list.map((t, i) => ({
    coll: 'tasks',
    id: t.id,
    patch: { ...(t.pieceId !== d.id ? { pieceId: d.id } : {}), col: col.id, order: orders[i], ...taskFields(ctx, op, lane, true, t), updatedAt: ctx.now },
  }))
  return { op, label: args.label ?? n(list.length), writes, ids: {}, meta: { kind: 'task' } }
}

// What going into a lane sets (D-258): by who, the member (`none`: nobody); by card, the card (`none`: no card).
function laneFields(op: string, d: P, lane: string): TaskInput {
  const rows = (d.kanban as KanbanSetup | undefined)?.rows
  if (!rows) refuse(op, `the deck ${d.name || d.id} has no lanes`, "leave lane out, or give it lanes first (update_deck lanes: 'assignee' or 'card')")
  if (rows === 'assignee') return lane === 'none' ? { assignee: null } : { assignee: lane }
  return lane === 'none' ? { card: null } : { card: lane }
}

// ---- delete's tasks (ops/delete.ts sends them here)

export function deleteTasksPlan(ctx: OpCtx, ids: string[], op = 'delete'): Plan {
  const list = ids.map((id) => taskIn(ctx, op, id))
  return { op, label: list.length > 1 ? `delete ${list.length} tasks` : 'delete a task', writes: list.map((t): Write => ({ coll: 'tasks', id: t.id, del: true })), ids: {}, meta: { kind: 'task' } }
}
