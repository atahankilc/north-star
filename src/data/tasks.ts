// A kanban (D-251): a piece on the canvas (`kind: 'kanban'`) holding the team's tasks in columns. Its columns live on
// the piece (`kanban`: `todo · doing · done` to start, renamed, added, moved, taken away); the tasks are their own docs
// in `tasks/{id}`, each in one column of one kanban (`pieceId`, `col`), in order (`order`, a number between its
// neighbours'). A task may be given to a member (`assignee`, their name kept beside it so the card needs no lookup),
// have a due day (`due`, `YYYY-MM-DD`) and a first day before it (`start`, D-304: from it to `due` on a timeline),
// point at a card (`cardId`, `cardType`) and carry a checklist (`checks`).
// A task for a customer, problem or idea that's finished may log what it taught on that card (D-254): `learned` is the
// evidence it wrote, or `skip` once that was declined.
// A kanban may hold cards instead (D-268, docs/specs/priorities.md): `holds: 'cards'`, which cards from a `source` (the
// table's rules, D-209), its columns a field's values (`colField`; src/views/workspace/kanbanCards.ts); its own `cols`
// stay, unused, for if it holds tasks again.
// Shapes mirror firestore.rules' validKanban and validTask; change both together.
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { isOnPlane, type AnyType, type Card } from './cards'
import type { Evidence } from './evidence'
import { db, firebase } from './firebase'
import { absent, tracked } from './history'
import { newId } from './matrix'
import type { Piece } from './model'
import { pieceRef } from './pieces'
import type { Source } from './source'

export type KanbanCol = {
  id: string
  name: string
  // Its tasks are finished: their due day no longer warns, their titles go quiet.
  done?: boolean
  // How many tasks it should hold at most (D-256): over it, its head goes magenta.
  limit?: number
}
export type KanbanSetup = {
  cols: KanbanCol[]
  // Once let a deck stuck to a plane show every task (D-255); ignored since D-303, kept so old data reads.
  everyPlane?: boolean
  // Its rows (D-258): none, or lanes by who a task is given to or by the card it's for (src/views/workspace/rows.ts).
  rows?: KanbanRows
  // What it holds (D-268): tasks (unset) or cards; for cards, which (a source) and the field its columns come from.
  holds?: 'cards'
  source?: Source
  colField?: CardField
  // Its rows (D-269, holding cards): none or another field; and names for its boxes (a column × a row).
  rowField?: CardField
  names?: BoxName[]
}
// A box's name (D-269): small in its corner; `good` washes the box green, `bad` sets its name in magenta.
export type BoxName = { col: string; row: string; name: string; tone?: 'good' | 'bad' }
export const BOX_NAMES_MAX = 40
export const BOX_NAME_MAX = 40
// The cards' fields a kanban's columns can come from (D-268): src/model/shapes.ts (S3).
export { CARD_FIELDS } from '../model/shapes'
export type { CardField } from '../model/shapes'
import type { CardField } from '../model/shapes'
// A timeline (D-262): its rows. The kanbans it shows are the one it's linked to, else every kanban (D-289); `kanbans`, a
// list once picked by hand (its `shows ▾`, gone), is still read from old data and exports but never used.
export const TIMELINE_ROWS = ['kanban', 'assignee', 'card'] as const
export type TimelineRows = (typeof TIMELINE_ROWS)[number]
export type TimelineSetup = { kanbans?: string[]; rows?: TimelineRows }

// Which decks a timeline shows (D-289, D-300): always the days of something. Linked to a deck, that deck. Linked to a
// plane, the deck linked to that plane when it has one (the first in reading order; one linked later too: read here,
// nothing written), else every deck, only the tasks for that plane's cards (each deck given the plane, `cardsOnly`: no
// task for no card). Linked to nothing, every deck on its own canvas (D-314; `canvasId`, none = `main`, as canvasOf).
// `only`: the side view's ALL · DAYS, never stored, keeps to the decks on the canvas shown (D-314).
export function timelineKanbans<P extends { id: string; kind: string; stuckTo?: string; x?: number; y?: number; kanban?: { holds?: string }; only?: string[]; canvasId?: string }>(t: P, pieces: P[]): P[] {
  // A deck holding cards has no tasks, so no days (D-314).
  const kanbans = pieces.filter((p) => p.kind === 'kanban' && p.kanban?.holds !== 'cards')
  const host = pieces.find((p) => p.id === t.stuckTo)
  if (!host) return t.only ? kanbans.filter((k) => t.only!.includes(k.id)) : kanbans.filter((k) => (k.canvasId || 'main') === (t.canvasId || 'main'))
  if (host.kind === 'kanban') return [host]
  if (host.kind !== 'plane') return kanbans
  const deck = kanbans.filter((k) => k.stuckTo === host.id).sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0))[0]
  return deck ? [deck] : kanbans.map((k) => ({ ...k, stuckTo: host.id, cardsOnly: true }))
}

// A deck's timeline (D-300): the one whose days are this deck's, linked to it or to its plane.
export function timelineOf<P extends { id: string; kind: string; stuckTo?: string; x?: number; y?: number; kanban?: { holds?: string } }>(deck: string, pieces: P[]): P | undefined {
  const it = pieces.find((p) => p.id === deck)
  // The deck itself back, not every deck given a plane (a plane with no deck's).
  return it && pieces.find((p) => {
    if (p.kind !== 'timeline' || !p.stuckTo) return false
    const shows = timelineKanbans(p, pieces)
    return shows.length === 1 && shows[0] === it
  })
}

// Its setup, merged (shared): one undo step.
export function setTimeline(wid: string, pieceId: string, patch: TimelineSetup, what: string) {
  const ref = pieceRef(wid, pieceId)
  const data: Record<string, unknown> = { updatedAt: Date.now() }
  for (const [k, v] of Object.entries(patch)) data[`timeline.${k}`] = v === undefined || (Array.isArray(v) && !v.length) ? deleteField() : v
  return tracked(what, [ref], () => updateDoc(ref, data))
}

export const KANBAN_ROWS = ['assignee', 'card'] as const
export type KanbanRows = (typeof KANBAN_ROWS)[number]

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
  // Its first day (D-304), at most its due day; none on a task that only has a due day.
  start?: string
  due?: string
  cardId?: string
  cardType?: AnyType
  checks?: Check[]
  // The evidence it logged on its card once finished, or `skip` (D-254).
  learned?: string
  // `#labels`, as cards' tags (D-056), and how urgent it is (D-256).
  labels?: string[]
  priority?: TaskPriority
  // When it was given to `assignee`, and by whom (D-261): given to you by someone else since you last looked, it's new.
  givenAt?: number
  givenBy?: string
  // Who made it.
  uid: string
  createdAt: number
  updatedAt: number
}
export type TaskFields = Partial<Pick<Task, 'title' | 'notes' | 'assignee' | 'assigneeName' | 'start' | 'due' | 'cardId' | 'cardType' | 'checks' | 'learned' | 'labels' | 'priority'>>
export const TASK_PRIORITIES = ['P1', 'P2', 'P3'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

// firestore.rules allows these.
export const KANBAN_COLS_MAX = 12
export const COL_NAME_MAX = 40
export const TASK_TITLE_MAX = 200
export const CHECKS_MAX = 50
export const CHECK_MAX = 200
export const LABELS_MAX = 20
export const LABEL_MAX = 40
export const LIMIT_MAX = 99

export const emptyKanban = (): KanbanSetup => ({
  cols: [
    { id: newId(), name: 'todo' },
    { id: newId(), name: 'doing' },
    { id: newId(), name: 'done', done: true },
  ],
})

const col = (wid: string) => collection(db(), 'workspaces', wid, 'tasks')
export const taskRef = (wid: string, id: string) => doc(col(wid), id)

// tasksIn, orderBetween, today, overdue live in src/model/tasks.ts, without Firebase (S3).
export { tasksIn, orderBetween, today, overdue } from '../model/tasks'
import { tasksIn } from '../model/tasks'

// Given to someone (D-261): when, and by whom; given to nobody, neither. Added to any write that sets `assignee`.
function given(fields: TaskFields): Record<string, unknown> {
  if (!('assignee' in fields)) return {}
  if (fields.assignee === undefined) return { givenAt: deleteField(), givenBy: deleteField() }
  return { givenAt: Date.now(), givenBy: firebase?.auth.currentUser?.uid ?? '' }
}

// A new task at the end of a column, its title typed (and from a card's panel, the card it's for): one undo step;
// returns its id.
export function addTask(wid: string, pieceId: string, column: string, order: number, title: string, uid: string, fields: Pick<TaskFields, 'cardId' | 'cardType' | 'assignee' | 'assigneeName' | 'start' | 'due'> = {}) {
  const ref = doc(col(wid))
  const now = Date.now()
  const data = { pieceId, col: column, order, title: title.trim().slice(0, TASK_TITLE_MAX), ...fields, ...(fields.assignee ? { givenAt: now, givenBy: uid } : {}), uid, createdAt: now, updatedAt: now }
  void tracked('add a task', [ref], () => setDoc(ref, data), { before: absent([ref]) })
  return ref.id
}

// Its fields, merged; `undefined` takes one away. Typing in one field merges into one undo step.
export function updateTask(wid: string, task: Pick<Task, 'id'>, fields: TaskFields, what = 'edit a task') {
  const ref = taskRef(wid, task.id)
  const data: Record<string, unknown> = { updatedAt: Date.now(), ...given(fields) }
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

// Several tasks at once (D-258), each one undo step for all of them: moved (a column, an order, and a lane's fields), their
// fields set, taken away.
export type TaskMove = { id: string; col: string; order: number; fields?: TaskFields; pieceId?: string }
const fieldsOf = (fields: TaskFields = {}) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === undefined ? deleteField() : v]))
export function moveTasks(wid: string, moves: TaskMove[], what = `move ${moves.length} tasks`) {
  const refs = moves.map((m) => taskRef(wid, m.id))
  const now = Date.now()
  return tracked(what, refs, async () => {
    const batch = writeBatch(db())
    moves.forEach((m, i) => batch.update(refs[i], { col: m.col, order: m.order, ...fieldsOf(m.fields), ...given(m.fields ?? {}), updatedAt: now }))
    await batch.commit()
  })
}
export function updateTasks(wid: string, ids: string[], fields: TaskFields, what: string) {
  const refs = ids.map((id) => taskRef(wid, id))
  const now = Date.now()
  return tracked(what, refs, async () => {
    const batch = writeBatch(db())
    for (const r of refs) batch.update(r, { ...fieldsOf(fields), ...given(fields), updatedAt: now })
    await batch.commit()
  })
}
export function deleteTasks(wid: string, ids: string[]) {
  const refs = ids.map((id) => taskRef(wid, id))
  return tracked(ids.length > 1 ? `delete ${ids.length} tasks` : 'delete a task', refs, async () => {
    const batch = writeBatch(db())
    for (const r of refs) batch.delete(r)
    await batch.commit()
  })
}

// Its rows (D-258): shared, one undo step.
export function setKanbanRows(wid: string, pieceId: string, rows: KanbanRows | undefined) {
  const ref = pieceRef(wid, pieceId)
  return tracked(rows ? `lanes by ${rows === 'assignee' ? 'who' : 'card'}` : 'no lanes', [ref], () => updateDoc(ref, { 'kanban.rows': rows ?? deleteField(), updatedAt: Date.now() }))
}

// Its columns, all at once (renamed, added, moved, marked done): one undo step; a name typed merges.
export function setKanbanCols(wid: string, pieceId: string, cols: KanbanCol[], what = 'change a deck', key?: string) {
  const ref = pieceRef(wid, pieceId)
  const clean = cols
    .slice(0, KANBAN_COLS_MAX)
    .map((c) => ({ id: c.id, name: c.name.slice(0, COL_NAME_MAX), ...(c.done ? { done: true } : {}), ...(c.limit ? { limit: Math.min(LIMIT_MAX, Math.max(1, Math.round(c.limit))) } : {}) }))
  return tracked(what, [ref], () => updateDoc(ref, { 'kanban.cols': clean, updatedAt: Date.now() }), key ? { key } : {})
}

// What it holds and, for cards, which and by what (D-268), merged (shared): one undo step. Setting a field to undefined
// takes it away.
export function setKanbanSetup(wid: string, pieceId: string, patch: Partial<Pick<KanbanSetup, 'holds' | 'source' | 'colField' | 'rowField' | 'names'>>, what = 'change a deck', key?: string) {
  const ref = pieceRef(wid, pieceId)
  const data: Record<string, unknown> = { updatedAt: Date.now() }
  for (const [k, v] of Object.entries(patch)) data[`kanban.${k}`] = v === undefined ? deleteField() : JSON.parse(JSON.stringify(v))
  return tracked(what, [ref], () => updateDoc(ref, data), key ? { key } : {})
}

// A kanban's tasks moved to another (D-300), and the one they leave set to hold cards (`patch`) when it's switching:
// one undo step, so switching a kanban with tasks on it to cards never leaves them hidden on it.
export function moveTasksAway(wid: string, moves: TaskMove[], pieceId: string, patch: Partial<Pick<KanbanSetup, 'holds' | 'source' | 'colField'>> | null, what: string) {
  const refs = moves.map((m) => taskRef(wid, m.id))
  const piece = pieceRef(wid, pieceId)
  const now = Date.now()
  return tracked(what, patch ? [...refs, piece] : refs, async () => {
    const batch = writeBatch(db())
    moves.forEach((m, i) => batch.update(refs[i], { pieceId: m.pieceId, col: m.col, order: m.order, updatedAt: now }))
    if (patch) {
      const data: Record<string, unknown> = { updatedAt: now }
      for (const [k, v] of Object.entries(patch)) data[`kanban.${k}`] = v === undefined ? deleteField() : JSON.parse(JSON.stringify(v))
      batch.update(piece, data)
    }
    await batch.commit()
  })
}

// What a kanban shows (D-255): stuck to a plane, the tasks for that plane's cards and those for no card (or for one
// that's gone), until it's unlinked (D-303: an old `everyPlane` is ignored); otherwise all of them.
// A card brought to that plane from another counts as its (D-281).
export function shownTasks(tasks: Task[], piece: { stuckTo?: string; kanban?: KanbanSetup; cardsOnly?: boolean }, cards: Pick<Card, 'id' | 'pieceId' | 'planes'>[]) {
  const plane = piece.stuckTo
  if (!plane) return tasks
  const byId = new Map(cards.map((c) => [c.id, c]))
  return tasks.filter((t) => {
    const c = t.cardId ? byId.get(t.cardId) : undefined
    return c ? isOnPlane(c, plane) : !piece.cardsOnly
  })
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
    batch.update(ref, { 'kanban.cols': cols.filter((c) => c.id !== column), updatedAt: now })
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

// Whether a task is in its kanban's finished column.
export function finished(t: Pick<Task, 'pieceId' | 'col'>, pieces: (Pick<Piece, 'kanban'> & { id: string })[]) {
  const p = pieces.find((x) => x.id === t.pieceId)
  return !!p?.kanban?.cols.find((c) => c.id === t.col)?.done
}

// Each card's tasks (D-254): how many, how many finished; the card's facts line says `☐ 2/5`.
export function taskTally(tasks: Task[], pieces: (Pick<Piece, 'kanban'> & { id: string })[]) {
  const done = new Set(pieces.flatMap((p) => (p.kanban?.cols ?? []).filter((c) => c.done).map((c) => `${p.id}|${c.id}`)))
  const out = new Map<string, { done: number; all: number }>()
  for (const t of tasks) {
    if (!t.cardId) continue
    const n = out.get(t.cardId) ?? { done: 0, all: 0 }
    n.all++
    if (done.has(`${t.pieceId}|${t.col}`)) n.done++
    out.set(t.cardId, n)
  }
  return out
}

// A card still being tested (D-254): a customer, problem or idea with no status yet, `hypothesis` or `testing`. Its
// panel offers `+ test it`; a finished task for it offers to log what it taught.
export const untested = (c: Pick<Card, 'type' | 'validation'> | undefined) =>
  !!c && (c.type === 'customer' || c.type === 'problem' || c.type === 'idea') && (!c.validation || c.validation === 'hypothesis' || c.validation === 'testing')

// What a finished task taught, logged on its card as evidence (D-137), the task marking it done: one undo step.
export function logLearned(wid: string, task: Pick<Task, 'id'>, fields: Omit<Evidence, 'id' | 'createdAt'>) {
  const ev = doc(collection(db(), 'workspaces', wid, 'evidence'))
  const ref = taskRef(wid, task.id)
  const now = Date.now()
  const data: Record<string, unknown> = { ...fields, createdAt: now, updatedAt: now }
  for (const k of Object.keys(data)) if (data[k] === undefined || data[k] === '') delete data[k]
  return tracked('log what a task taught', [ev, ref], async () => {
    const batch = writeBatch(db())
    batch.set(ev, data)
    batch.update(ref, { learned: ev.id, updatedAt: now })
    await batch.commit()
  })
}
