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
