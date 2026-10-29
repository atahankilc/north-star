// What a kanban shows (D-256), the plane filter's way (D-233): kept only while it's open (its focus, its pane beside a
// plane, the tasks side view, a timeline over it), in this tab (D-308). GIVEN TO keeps tasks
// given to you, to a member, or to nobody; DUE keeps tasks past their day (not finished), due today, this week (to
// Sunday), or with no day; FOR keeps tasks for a type of card, a card, or no card; LABEL keeps tasks with one of the
// labels. Within one, any of the picks; across them, all. Nothing picked, everything.
import type { AnyType } from './cards'
import { today } from './tasks'
import type { Task } from '../data/tasks'

export type DueKey = 'past' | 'today' | 'week' | 'none'
// `who`: 'me', 'nobody' or a member's uid; `for`: 'type:<card type>', a card's id, or 'none'.
export type KanbanFilter = { who: string[]; due: DueKey[]; for: string[]; labels: string[] }
export const NO_FILTER: KanbanFilter = { who: [], due: [], for: [], labels: [] }

// How many filters narrow it.
export const narrowing = (f: KanbanFilter) => [f.who, f.due, f.for, f.labels].filter((x) => x.length).length

// The last day of this week (Sunday), as a due day is written.
function weekEnd(now = new Date()) {
  const d = new Date(now)
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  return today(d)
}

// Whether a task passes; `finished`: its column is the finished one; `me`: your uid.
export function passes(t: Task, f: KanbanFilter, finished: boolean, me: string | undefined, typeOf: (cardId: string) => AnyType | undefined) {
  if (f.who.length && !f.who.some((w) => (w === 'nobody' ? !t.assignee : w === 'me' ? !!me && t.assignee === me : t.assignee === w))) return false
  if (f.due.length) {
    const day = today()
    const ok = f.due.some((d) =>
      d === 'none' ? !t.due : d === 'past' ? !!t.due && !finished && t.due < day : d === 'today' ? t.due === day : !!t.due && t.due >= day && t.due <= weekEnd(),
    )
    if (!ok) return false
  }
  if (f.for.length) {
    const type = t.cardId ? (typeOf(t.cardId) ?? t.cardType) : undefined
    const ok = f.for.some((x) => (x === 'none' ? !t.cardId : x.startsWith('type:') ? type === x.slice(5) : t.cardId === x))
    if (!ok) return false
  }
  if (f.labels.length && !f.labels.some((l) => t.labels?.includes(l))) return false
  return true
}
