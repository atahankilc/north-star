// Tasks' order and days, without Firebase (S3, D-312); data/tasks.ts re-exports them.
import type { Task } from '../data/tasks'

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
