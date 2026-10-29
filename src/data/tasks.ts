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
// Every write is an op (S8, D-312: src/ops/tasks.ts' create_task / update_task / move_task, src/ops/deck.ts' update_deck,
// the column ops and update_timeline, delete, create_evidence from_task) behind the same signature: lists passed in
// (columns, tasks) are read from the workspace instead (R5), orders and moves the UI worked out are passed through.
import { isOnPlane, type AnyType, type Card } from './cards'
import type { Evidence } from './evidence'
import { newId } from './matrix'
import type { Piece } from './model'
import type { Source } from './source'
import { applyUi, runUi, sayRefused, uiCtx } from '../ops/firestore'
import { createTask, moveTask as moveTaskOp, updateTask as updateTaskOp, type TaskInput } from '../ops/tasks'
import { createDeckColumn, deleteColumnPlan, moveDeckColumn, updateDeck, updateDeckColumn, updateTimeline } from '../ops/deck'
import { createEvidence } from '../ops/evidence'
import { deleteAny } from '../ops/delete'
import { editorChange } from '../model/lens'
import type { OpCtx, Plan } from '../ops/types'

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
  return runUi(wid, (ctx) => [updateTimeline(ctx, { id: pieceId, setup: patch, label: what })], { label: what })
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

// tasksIn, orderBetween, today, overdue live in src/model/tasks.ts, without Firebase (S3).
export { tasksIn, orderBetween, today, overdue } from '../model/tasks'

// The UI's fields as the ops say them: a card by `card` (its type comes with it), `undefined` taking one away.
function inputOf(fields: TaskFields = {}): TaskInput {
  const { cardId, cardType: _t, ...rest } = fields
  return { ...rest, ...('cardId' in fields ? { card: cardId ?? null } : {}) } as TaskInput
}

// A new task at the end of a column, its title typed (and from a card's panel, the card it's for): one undo step;
// returns its id at once ('' when nothing was made). `uid` is the signed-in person (the op's actor).
export function addTask(wid: string, pieceId: string, column: string, order: number, title: string, _uid: string, fields: Pick<TaskFields, 'cardId' | 'cardType' | 'assignee' | 'assigneeName' | 'start' | 'due'> = {}) {
  const ctx = uiCtx(wid)
  if (!ctx) return ''
  try {
    const plan = createTask(ctx, { deck: pieceId, column, order, title, ...inputOf(fields) })
    void applyUi(wid, ctx, [plan], { label: 'add a task' })
    return plan.ids.$new
  } catch (e) {
    sayRefused(e, 'add a task')
    return ''
  }
}

// Its fields, merged; `undefined` takes one away. Typing in one field merges into one undo step.
export function updateTask(wid: string, task: Pick<Task, 'id'>, fields: TaskFields, what = 'edit a task') {
  const keys = Object.keys(fields).sort().join(',')
  return runUi(wid, (ctx) => [updateTaskOp(ctx, { task: task.id, ...inputOf(fields), label: what })], { label: what, key: `task:${task.id}:${keys}` })
}

// Dropped in a column (its own or another), at `order`: one undo step.
export function moveTask(wid: string, task: Pick<Task, 'id'>, column: string, order: number) {
  return runUi(wid, (ctx) => [moveTaskOp(ctx, { moves: [{ id: task.id, col: column, order }], label: 'move a task' })], { label: 'move a task' })
}

export function deleteTask(wid: string, task: Pick<Task, 'id'>) {
  return deleteTasks(wid, [task.id])
}

// Several tasks at once (D-258), each one undo step for all of them: moved (a column, an order, and a lane's fields), their
// fields set, taken away.
export type TaskMove = { id: string; col: string; order: number; fields?: TaskFields; pieceId?: string }
export function moveTasks(wid: string, moves: TaskMove[], what = `move ${moves.length} tasks`) {
  return runUi(wid, (ctx) => [moveTaskOp(ctx, { moves: moves.map((m) => ({ ...m, fields: m.fields && inputOf(m.fields) })), label: what })], { label: what })
}
export function updateTasks(wid: string, ids: string[], fields: TaskFields, what: string) {
  return runUi(wid, (ctx) => [updateTaskOp(ctx, { tasks: ids, ...inputOf(fields), label: what })], { label: what })
}
export function deleteTasks(wid: string, ids: string[]) {
  const label = ids.length > 1 ? `delete ${ids.length} tasks` : 'delete a task'
  // Those a collaborator took away a moment ago are left out, as before.
  return runUi(wid, (ctx) => {
    const there = ids.filter((id) => ctx.ws.tasks.some((t) => t.id === id))
    return there.length ? [{ ...deleteAny(ctx, { ids: there }), label }] : []
  }, { label })
}

// Its rows (D-258): shared, one undo step.
export function setKanbanRows(wid: string, pieceId: string, rows: KanbanRows | undefined) {
  const label = rows ? `lanes by ${rows === 'assignee' ? 'who' : 'card'}` : 'no lanes'
  return runUi(wid, (ctx) => [updateDeck(ctx, { id: pieceId, lanes: rows ?? null, label })], { label })
}

const sameCol = (a: KanbanCol, b: KanbanCol) => a.name === b.name && !!a.done === !!b.done && (a.limit ?? 0) === (b.limit ?? 0)

// The columns as the deck's editor gives them, through the one column op when it's one change from what's there now
// (someone else's new column left aside), else written whole.
function colsPlan(ctx: OpCtx, pieceId: string, cols: KanbanCol[], what: string): Plan[] {
  const d = ctx.ws.pieces.find((p) => p.id === pieceId)
  const now = (d?.kanban as KanbanSetup | undefined)?.cols
  // A column the editor holds that's gone now (a collaborator took it away) makes the list stale: written whole, as
  // before (an add is only the columns there now plus one at the end).
  const known = new Set(now?.map((c) => c.id))
  const missing = cols.filter((c) => !known.has(c.id))
  const isAdd = !!now && missing.length === 1 && cols.length === now.length + 1 && cols.at(-1)!.id === missing[0].id && now.every((c, i) => cols[i].id === c.id && sameCol(c, cols[i]))
  const ch = now && (!missing.length || isAdd) ? editorChange(now, cols, sameCol) : null
  if (ch && 'same' in ch) return []
  if (ch && 'add' in ch) return [createDeckColumn(ctx, { deck: pieceId, id: ch.add.id, name: ch.add.name, ...(ch.add.limit ? { limit: ch.add.limit } : {}), ...(ch.add.done ? { done: true } : {}), label: what })]
  if (ch && 'move' in ch) return [moveDeckColumn(ctx, { deck: pieceId, column: ch.move.id, by: 'right', label: what })]
  if (ch && 'edit' in ch) {
    const { edit: e, was: w } = ch
    return [
      updateDeckColumn(ctx, {
        deck: pieceId,
        column: e.id,
        ...(e.name !== w.name ? { name: e.name } : {}),
        ...((e.limit ?? 0) !== (w.limit ?? 0) ? { limit: e.limit || null } : {}),
        ...(!!e.done !== !!w.done ? { done: !!e.done } : {}),
        label: what,
      }),
    ]
  }
  return [updateDeck(ctx, { id: pieceId, setup: { cols }, label: what })]
}

// Its columns, all at once (renamed, added, moved, marked done): one undo step; a name typed merges.
export function setKanbanCols(wid: string, pieceId: string, cols: KanbanCol[], what = 'change a deck', key?: string) {
  return runUi(wid, (ctx) => colsPlan(ctx, pieceId, cols, what), { label: what, ...(key ? { key } : {}) })
}

// What it holds and, for cards, which and by what (D-268), merged (shared): one undo step. Setting a field to undefined
// takes it away.
export function setKanbanSetup(wid: string, pieceId: string, patch: Partial<Pick<KanbanSetup, 'holds' | 'source' | 'colField' | 'rowField' | 'names'>>, what = 'change a deck', key?: string) {
  return runUi(wid, (ctx) => [updateDeck(ctx, { id: pieceId, setup: patch, label: what })], { label: what, ...(key ? { key } : {}) })
}

// A kanban's tasks moved to another (D-300), and the one they leave set to hold cards (`patch`) when it's switching:
// one undo step, so switching a kanban with tasks on it to cards never leaves them hidden on it.
export function moveTasksAway(wid: string, moves: TaskMove[], pieceId: string, patch: Partial<Pick<KanbanSetup, 'holds' | 'source' | 'colField'>> | null, what: string) {
  return runUi(
    wid,
    (ctx) => [updateDeck(ctx, { id: pieceId, ...(patch ? { setup: patch } : {}), moves: moves.map((m) => ({ id: m.id, pieceId: m.pieceId ?? pieceId, col: m.col, order: m.order })), label: what })],
    { label: what },
  )
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
// column never goes. The columns and tasks are read from the workspace (the lists passed are kept for the signature).
export function deleteColumn(wid: string, pieceId: string, _cols: KanbanCol[], column: string, _tasks: Task[]) {
  return runUi(
    wid,
    (ctx) => {
      const d = ctx.ws.pieces.find((p) => p.id === pieceId) as (Piece & { id: string }) | undefined
      const c = (d?.kanban as KanbanSetup | undefined)?.cols.find((x) => x.id === column)
      if (!d || !c || (d.kanban as KanbanSetup).cols.length < 2) return []
      return [deleteColumnPlan(ctx, d, c)]
    },
    { label: 'delete a column' },
  )
}

// Its checklist, changed as a whole: one undo step (typing in one row merges).
export function setChecks(wid: string, task: Pick<Task, 'id'>, checks: Check[], key?: string) {
  return runUi(wid, (ctx) => [updateTaskOp(ctx, { task: task.id, checks, label: 'change a checklist' })], { label: 'change a checklist', ...(key ? { key } : {}) })
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
  const { nodeId, nodeType: _t, ...input } = fields
  return runUi(wid, (ctx) => [createEvidence(ctx, { ...input, card: nodeId, from_task: task.id })], { label: 'log what a task taught' })
}
