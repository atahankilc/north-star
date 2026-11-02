// Tasks' order and days, without Firebase (S3, D-312); data/tasks.ts re-exports them.
import type { KanbanSetup, Task } from '../data/tasks'
import { isOnPlane, type Card } from './cards'
import { canvasOf } from './canvases'

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

// A due day as a task says it: `today`, `tomorrow`, `yesterday`, else `28 oct` (the year only when it isn't this one)
// (D-358: one home for the task's words, read by the deck, the timeline and the panels).
export function dueText(due: string, now = today()) {
  const day = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
  const diff = Math.round((day(due) - day(now)) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  const d = new Date(day(due))
  const month = d.toLocaleString('en', { month: 'short', timeZone: 'UTC' }).toLowerCase()
  return `${d.getUTCDate()} ${month}${due.slice(0, 4) === now.slice(0, 4) ? '' : ` ${due.slice(0, 4)}`}`
}

// Two letters for a member's square: their initials, or the first two letters of a one-word name.
export function initials(name?: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase()
}

// The most steps a checklist shows as cells; past that, the count alone.
export const CHECK_CELLS_MAX = 8
// A checklist as small cells, done ones filled (none past CHECK_CELLS_MAX).
export const checkCells = (done: number, all: number) => (all > CHECK_CELLS_MAX ? '' : '▮'.repeat(done) + '▯'.repeat(all - done))

// Orders for `n` tasks put between two (either may be missing), spread evenly, in the order given (Kanban.tsx's drop, S8).
export function ordersBetween(lo: number | undefined, hi: number | undefined, n: number): number[] {
  return Array.from({ length: n }, (_, i) =>
    lo === undefined && hi === undefined ? i + 1 : lo === undefined ? hi! - (n - i) : hi === undefined ? lo + i + 1 : lo + ((hi - lo) * (i + 1)) / (n + 1),
  )
}

// A day as tasks write it (`YYYY-MM-DD`), and one that's on the calendar.
export function isDay(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

// Decks, timelines and what they show, pure (D-361: the agent's read layer had its own copy, drifted); data/tasks.ts
// re-exports them.
// Which decks a timeline shows (D-289, D-300): always the days of something. Linked to a deck, that deck. Linked to a
// plane, the deck linked to that plane when it has one (the first in reading order; one linked later too: read here,
// nothing written), else every deck, only the tasks for that plane's cards (each deck given the plane, `cardsOnly`: no
// task for no card). Linked to nothing, every deck on its own canvas (D-314; canvasOf).
// `only`: the side view's ALL · DAYS, never stored, keeps to the decks on the canvas shown (D-314).
export function timelineKanbans<P extends { id: string; kind: string; stuckTo?: string; x?: number; y?: number; kanban?: { holds?: string }; only?: string[]; canvasId?: string }>(t: P, pieces: P[]): P[] {
  // A deck holding cards has no tasks, so no days (D-314).
  const kanbans = pieces.filter((p) => p.kind === 'kanban' && p.kanban?.holds !== 'cards')
  const host = pieces.find((p) => p.id === t.stuckTo)
  if (!host) return t.only ? kanbans.filter((k) => t.only!.includes(k.id)) : kanbans.filter((k) => canvasOf(k) === canvasOf(t))
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

// What a kanban shows (D-255): stuck to a plane, the tasks for that plane's cards and those for no card (or for one
// that's gone), until it's unlinked (D-303); otherwise all of them.
// A card brought to that plane from another counts as its (D-281).
export function shownTasks(tasks: Task[], piece: { stuckTo?: string; kanban?: KanbanSetup | unknown; cardsOnly?: boolean }, cards: Pick<Card, 'id' | 'pieceId' | 'planes'>[]) {
  const plane = piece.stuckTo
  if (!plane) return tasks
  const byId = new Map(cards.map((c) => [c.id, c]))
  return tasks.filter((t) => {
    const c = t.cardId ? byId.get(t.cardId) : undefined
    return c ? isOnPlane(c, plane) : !piece.cardsOnly
  })
}

// The finished columns of every deck, as `deck|column` (D-361: it had been built five ways).
type DeckLike = { id: string; kanban?: KanbanSetup | unknown }
export const doneCols = (pieces: DeckLike[]) =>
  new Set(pieces.flatMap((p) => ((p.kanban as KanbanSetup | undefined)?.cols ?? []).filter((c) => c.done).map((c) => `${p.id}|${c.id}`)))
export const isFinished = (t: Pick<Task, 'pieceId' | 'col'>, done: Set<string>) => done.has(`${t.pieceId}|${t.col}`)

// Whether a task is in its kanban's finished column.
export function finished(t: Pick<Task, 'pieceId' | 'col'>, pieces: DeckLike[]) {
  const p = pieces.find((x) => x.id === t.pieceId)
  return !!(p?.kanban as KanbanSetup | undefined)?.cols.find((c) => c.id === t.col)?.done
}

// Each card's tasks (D-254): how many, how many finished; the card's facts line says `☐ 2/5`.
export function taskTally(tasks: Task[], pieces: DeckLike[]) {
  const done = doneCols(pieces)
  const out = new Map<string, { done: number; all: number }>()
  for (const t of tasks) {
    if (!t.cardId) continue
    const n = out.get(t.cardId) ?? { done: 0, all: 0 }
    n.all++
    if (isFinished(t, done)) n.done++
    out.set(t.cardId, n)
  }
  return out
}

// A card still being tested (D-254): a customer, problem or idea with no status yet, `hypothesis` or `testing`. Its
// panel offers `+ test it`; a finished task for it offers to log what it taught.
export const untested = (c: Pick<Card, 'type' | 'validation'> | undefined) =>
  !!c && (c.type === 'customer' || c.type === 'problem' || c.type === 'idea') && (!c.validation || c.validation === 'hypothesis' || c.validation === 'testing')

