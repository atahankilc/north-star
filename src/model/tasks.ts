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
