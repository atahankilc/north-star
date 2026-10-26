// A kanban's rows (D-258): lanes across its columns, each from one value of a field; dropping into a lane sets that
// value. Built as "rows by a field" (docs/specs/priorities.md): a field says which lane an item is in, which lanes there
// are, and what dropping into one writes. Tasks have two, who it's given to and the card it's for; cards (priorities,
// P2) will add theirs the same way.
import type { AnyType, Card } from '../../data/cards'
import type { KanbanRows, Task, TaskFields } from '../../data/tasks'
import { TYPE_ACCENT } from './PlaneCards'

export type Lane = {
  key: string
  label: string
  // Its mark: a member's two letters, or a card type's colour.
  initials?: string
  tone?: string
  kind?: string
  // Whether dropping into it changes anything (a card that's gone can't be given).
  drop: boolean
}

export type RowField<T, F> = {
  name: string
  laneOf: (item: T) => string
  lanes: (items: T[]) => Lane[]
  // What dropping into a lane writes; null: nothing to write.
  set: (lane: string) => F | null
}

export const NOBODY = 'nobody'
export const NO_CARD = 'none'
export const GONE = 'gone'

type People = { me?: { id: string; name: string }; names: Map<string, string> }

const initialsOf = (name?: string) => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase()
}

// Who it's given to: you first (always there, to give yourself one), the others by name, then nobody.
export function byAssignee({ me, names }: People): RowField<Task, TaskFields> {
  const nameOf = (uid: string, t?: Task) => names.get(uid) ?? t?.assigneeName ?? 'someone'
  return {
    name: 'given to',
    laneOf: (t) => t.assignee ?? NOBODY,
    lanes: (tasks) => {
      const seen = new Map<string, string>()
      for (const t of tasks) if (t.assignee && t.assignee !== me?.id) seen.set(t.assignee, nameOf(t.assignee, t))
      const others = [...seen].sort((a, b) => a[1].localeCompare(b[1]))
      return [
        ...(me ? [{ key: me.id, label: me.name ? `${me.name} · me` : 'me', initials: me.name ? initialsOf(me.name) : 'ME', drop: true }] : []),
        ...others.map(([id, name]) => ({ key: id, label: name, initials: initialsOf(name), drop: true })),
        { key: NOBODY, label: 'nobody', drop: true },
      ]
    },
    set: (lane) => (lane === NOBODY ? { assignee: undefined, assigneeName: undefined } : { assignee: lane, assigneeName: (lane === me?.id ? me.name : names.get(lane)) || undefined }),
  }
}

const ORDER: AnyType[] = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package']

// The card it's for: the cards its tasks point at, in chain order then by title, then no card; tasks whose card is gone
// in a lane of their own, which takes nothing.
export function byCard(cards: Card[]): RowField<Task, TaskFields> {
  const byId = new Map(cards.map((c) => [c.id, c]))
  return {
    name: 'for',
    laneOf: (t) => (!t.cardId ? NO_CARD : byId.has(t.cardId) ? t.cardId : GONE),
    lanes: (tasks) => {
      const used = [...new Set(tasks.flatMap((t) => (t.cardId && byId.has(t.cardId) ? [t.cardId] : [])))].map((id) => byId.get(id)!)
      used.sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || (a.title || '').localeCompare(b.title || ''))
      const gone = tasks.some((t) => t.cardId && !byId.has(t.cardId))
      return [
        ...used.map((c) => ({ key: c.id, label: c.title || 'untitled', tone: TYPE_ACCENT[c.type], kind: c.type, drop: true })),
        { key: NO_CARD, label: 'no card', drop: true },
        ...(gone ? [{ key: GONE, label: 'its card is gone', drop: false }] : []),
      ]
    },
    set: (lane) => {
      if (lane === GONE) return null
      if (lane === NO_CARD) return { cardId: undefined, cardType: undefined }
      const c = byId.get(lane)
      return c ? { cardId: c.id, cardType: c.type } : null
    },
  }
}

export function taskRows(rows: KanbanRows | undefined, cards: Card[], people: People): RowField<Task, TaskFields> | null {
  return rows === 'assignee' ? byAssignee(people) : rows === 'card' ? byCard(cards) : null
}

// Which lanes are folded, per kanban, in this browser.
const KEY = (piece: string) => `north-star:kanban-folds:${piece}`
export function loadFolds(piece: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY(piece)) ?? '[]') as string[]
  } catch {
    return []
  }
}
export function saveFolds(piece: string, folds: string[]) {
  try {
    if (folds.length) localStorage.setItem(KEY(piece), JSON.stringify(folds))
    else localStorage.removeItem(KEY(piece))
  } catch {
    // This tab only.
  }
}
