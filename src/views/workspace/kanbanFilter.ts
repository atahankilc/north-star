// What a kanban shows (D-256), the plane filter's way (D-233): kept only while it's open (its focus, its pane beside a
// plane, the tasks side view, a timeline over it), in this tab (D-308). GIVEN TO keeps tasks
// given to you, to a member, or to nobody; DUE keeps tasks past their day (not finished), due today, this week (to
// Sunday), or with no day; FOR keeps tasks for a type of card, a card, or no card; LABEL keeps tasks with one of the
// labels. Within one, any of the picks; across them, all. Nothing picked, everything.
import { useEffect } from 'react'
import { create } from 'zustand'
import type { AnyType } from '../../data/cards'
import { today, type Task } from '../../data/tasks'

export type DueKey = 'past' | 'today' | 'week' | 'none'
// `who`: 'me', 'nobody' or a member's uid; `for`: 'type:<card type>', a card's id, or 'none'.
export type KanbanFilter = { who: string[]; due: DueKey[]; for: string[]; labels: string[] }
export const NO_FILTER: KanbanFilter = { who: [], due: [], for: [], labels: [] }

const useStore = create<{ byPiece: Record<string, KanbanFilter> }>(() => ({ byPiece: {} }))

// Filters were once kept in the browser (D-256): what's left of them goes.
try {
  for (const k of Object.keys(localStorage)) if (k.startsWith('north-star:kanban-filter:')) localStorage.removeItem(k)
} catch {
  // Private windows: nothing kept.
}

export function useKanbanFilter(piece: string): KanbanFilter {
  return useStore((s) => s.byPiece[piece]) ?? NO_FILTER
}

export function setKanbanFilter(piece: string, f: KanbanFilter) {
  useStore.setState((s) => ({ byPiece: { ...s.byPiece, [piece]: f } }))
}

// Held while one of its docks is there; once none is, the filter goes (D-308). Let go a moment later, so a remount
// (dev's double mount, one dock for another) keeps it.
const held = new Map<string, number>()
export function useHoldKanbanFilter(piece: string) {
  useEffect(() => {
    held.set(piece, (held.get(piece) ?? 0) + 1)
    return () => {
      held.set(piece, (held.get(piece) ?? 1) - 1)
      setTimeout(() => {
        if (held.get(piece)) return
        held.delete(piece)
        useStore.setState((s) => {
          const { [piece]: _, ...rest } = s.byPiece
          return { byPiece: rest }
        })
      })
    }
  }, [piece])
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
