// What a kanban shows (D-256), the plane filter's way (D-233): kept per kanban in this browser. GIVEN TO keeps tasks
// given to you, to a member, or to nobody; DUE keeps tasks past their day (not finished), due today, this week (to
// Sunday), or with no day; FOR keeps tasks for a type of card, a card, or no card; LABEL keeps tasks with one of the
// labels. Within one, any of the picks; across them, all. Nothing picked, everything.
import { create } from 'zustand'
import type { AnyType } from '../../data/cards'
import { today, type Task } from '../../data/tasks'

export type DueKey = 'past' | 'today' | 'week' | 'none'
// `who`: 'me', 'nobody' or a member's uid; `for`: 'type:<card type>', a card's id, or 'none'.
export type KanbanFilter = { who: string[]; due: DueKey[]; for: string[]; labels: string[] }
export const NO_FILTER: KanbanFilter = { who: [], due: [], for: [], labels: [] }

const KEY = (piece: string) => `north-star:kanban-filter:${piece}`
function load(piece: string): KanbanFilter {
  try {
    const v = localStorage.getItem(KEY(piece))
    return v ? { ...NO_FILTER, ...(JSON.parse(v) as Partial<KanbanFilter>) } : NO_FILTER
  } catch {
    return NO_FILTER
  }
}

const useStore = create<{ byPiece: Record<string, KanbanFilter> }>(() => ({ byPiece: {} }))

// What's been set in this tab, else what this browser kept (read once).
const cache = new Map<string, KanbanFilter>()
export function useKanbanFilter(piece: string): KanbanFilter {
  const set = useStore((s) => s.byPiece[piece])
  if (set) return set
  if (!cache.has(piece)) cache.set(piece, load(piece))
  return cache.get(piece)!
}

export function setKanbanFilter(piece: string, f: KanbanFilter) {
  useStore.setState((s) => ({ byPiece: { ...s.byPiece, [piece]: f } }))
  try {
    if (narrowing(f)) localStorage.setItem(KEY(piece), JSON.stringify(f))
    else localStorage.removeItem(KEY(piece))
  } catch {
    // Kept for this tab only.
  }
}

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
