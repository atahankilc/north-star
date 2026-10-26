// A kanban (D-251): a piece on the canvas (`kind: 'kanban'`) holding the team's tasks in columns. Its columns live on
// the piece (`kanban`: `todo · doing · done` to start, renamed, added, moved, taken away); the tasks are their own docs
// in `tasks/{id}`, each in one column of one kanban (`pieceId`, `col`), in order (`order`, a number between its
// neighbours'). A task may be given to a member (`assignee`, their name kept beside it so the card needs no lookup),
// have a due day (`due`, `YYYY-MM-DD`), point at a card (`cardId`, `cardType`) and carry a checklist (`checks`).
// Shapes mirror firestore.rules' validKanban and validTask; change both together.
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import type { AnyType } from './cards'
import { db } from './firebase'
import { absent, tracked } from './history'
import { newId } from './matrix'
import { pieceRef } from './pieces'

export type KanbanCol = {
  id: string
  name: string
  // Its tasks are finished: their due day no longer warns, their titles go quiet.
  done?: boolean
}
export type KanbanSetup = { cols: KanbanCol[] }

export type Check = { id: string; text: string; done?: boolean }

export type Task = {
  id: string
  pieceId: string
  col: string
  order: number
  title: string
  notes?: string
  assignee?: string
  assigneeName?: string
  due?: string
  cardId?: string
  cardType?: AnyType
  checks?: Check[]
  // Who made it.
  uid: string
  createdAt: number
  updatedAt: number
}
export type TaskFields = Partial<Pick<Task, 'title' | 'notes' | 'assignee' | 'assigneeName' | 'due' | 'cardId' | 'cardType' | 'checks'>>

// firestore.rules allows these.
export const KANBAN_COLS_MAX = 12
export const COL_NAME_MAX = 40
export const TASK_TITLE_MAX = 200
export const CHECKS_MAX = 50
export const CHECK_MAX = 200

export const emptyKanban = (): KanbanSetup => ({
  cols: [
    { id: newId(), name: 'todo' },
    { id: newId(), name: 'doing' },
    { id: newId(), name: 'done', done: true },
  ],
})

const col = (wid: string) => collection(db(), 'workspaces', wid, 'tasks')
export const taskRef = (wid: string, id: string) => doc(col(wid), id)

// A column's tasks, in order.
export const tasksIn = (tasks: Task[], column: string) => tasks.filter((t) => t.col === column).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)

// The order that puts a task between two others (either may be missing: the start or the end of a column).
export function orderBetween(before?: number, after?: number) {
  if (before === undefined && after === undefined) return 1
  if (before === undefined) return after! - 1
  if (after === undefined) return before + 1
  return (before + after) / 2
}

// Today, as a due day is written: the browser's own day.
export function today(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}
// Past its due day and not finished.
export const overdue = (t: Pick<Task, 'due'>, finished: boolean) => !!t.due && !finished && t.due < today()

// A new task at the end of a column, its title typed: one undo step; returns its id.
export function addTask(wid: string, pieceId: string, column: string, order: number, title: string, uid: string) {
  const ref = doc(col(wid))
  const now = Date.now()
  const data = { pieceId, col: column, order, title: title.trim().slice(0, TASK_TITLE_MAX), uid, createdAt: now, updatedAt: now }
  void tracked('add a task', [ref], () => setDoc(ref, data), { before: absent([ref]) })
  return ref.id
}

// Its fields, merged; `undefined` takes one away. Typing in one field merges into one undo step.
export function updateTask(wid: string, task: Pick<Task, 'id'>, fields: TaskFields, what = 'edit a task') {
  const ref = taskRef(wid, task.id)
  const data: Record<string, unknown> = { updatedAt: Date.now() }
  for (const [k, v] of Object.entries(fields)) data[k] = v === undefined ? deleteField() : v
  const keys = Object.keys(fields).sort().join(',')
  return tracked(what, [ref], () => updateDoc(ref, data), { key: `task:${task.id}:${keys}` })
}

// Dropped in a column (its own or another), at `order`: one undo step.
export function moveTask(wid: string, task: Pick<Task, 'id'>, column: string, order: number) {
  const ref = taskRef(wid, task.id)
  return tracked('move a task', [ref], () => updateDoc(ref, { col: column, order, updatedAt: Date.now() }))
}

export function deleteTask(wid: string, task: Pick<Task, 'id'>) {
  const ref = taskRef(wid, task.id)
  return tracked('delete a task', [ref], () => deleteDoc(ref))
}

// Its columns, all at once (renamed, added, moved, marked done): one undo step; a name typed merges.
export function setKanbanCols(wid: string, pieceId: string, cols: KanbanCol[], what = 'change a kanban', key?: string) {
  const ref = pieceRef(wid, pieceId)
  const clean = cols.slice(0, KANBAN_COLS_MAX).map((c) => ({ id: c.id, name: c.name.slice(0, COL_NAME_MAX), ...(c.done ? { done: true } : {}) }))
  return tracked(what, [ref], () => updateDoc(ref, { kanban: { cols: clean }, updatedAt: Date.now() }), key ? { key } : {})
}

// A column taken away: its tasks go to the end of the one before it (or after, for the first): one undo step. The last
// column never goes.
export function deleteColumn(wid: string, pieceId: string, cols: KanbanCol[], column: string, tasks: Task[]) {
  const i = cols.findIndex((c) => c.id === column)
  if (i < 0 || cols.length < 2) return Promise.resolve()
  const to = cols[i > 0 ? i - 1 : 1].id
  const moving = tasksIn(tasks, column)
  const last = tasksIn(tasks, to).at(-1)?.order ?? 0
  const ref = pieceRef(wid, pieceId)
  const refs = moving.map((t) => taskRef(wid, t.id))
  return tracked('delete a column', [ref, ...refs], async () => {
    const batch = writeBatch(db())
    const now = Date.now()
    batch.update(ref, { kanban: { cols: cols.filter((c) => c.id !== column) }, updatedAt: now })
    moving.forEach((_t, k) => batch.update(refs[k], { col: to, order: last + k + 1, updatedAt: now }))
    await batch.commit()
  })
}

// Its checklist, changed as a whole: one undo step (typing in one row merges).
export function setChecks(wid: string, task: Pick<Task, 'id'>, checks: Check[], key?: string) {
  const ref = taskRef(wid, task.id)
  const clean = checks.slice(0, CHECKS_MAX).map((c) => ({ id: c.id, text: c.text.slice(0, CHECK_MAX), ...(c.done ? { done: true } : {}) }))
  return tracked('change a checklist', [ref], () => updateDoc(ref, { checks: clean.length ? clean : deleteField(), updatedAt: Date.now() }), key ? { key } : {})
}

export const newCheck = (text: string): Check => ({ id: newId(), text: text.slice(0, CHECK_MAX) })
