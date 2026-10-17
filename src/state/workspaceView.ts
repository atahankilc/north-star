// What the current workspace shows: type and customer filters, and which `+` was used last.
// Remembered per workspace in this browser (spec: docs/specs/board.md §3).
import { create } from 'zustand'
import { BOARD_TYPES, type BoardType } from '../data/model'

// What a double-click on the board makes: a card, or text (D-050).
export type NewThing = BoardType | 'text'

type Filters = {
  types: BoardType[]
  // Customer ids for the `for:` filter; empty = any customer.
  forIds: string[]
  // Tags for the `tag:` filter (D-056); empty = any tag.
  tags: string[]
  // Double-click on the board creates one of these.
  lastType: NewThing
}

const DEFAULTS: Filters = { types: [...BOARD_TYPES], forIds: [], tags: [], lastType: 'idea' }

type State = Filters & {
  wid: string | null
  load: (wid: string) => void
  toggleType: (type: BoardType) => void
  toggleFor: (customerId: string) => void
  clearFor: () => void
  toggleTag: (tag: string) => void
  clearTags: () => void
  setLastType: (type: NewThing) => void
  // Undo whatever filter hides this item, so a link can always land on it.
  reveal: (item: { type: BoardType }) => void
}

const key = (wid: string) => `north-star.view.${wid}`

function read(wid: string): Filters {
  try {
    const raw = localStorage.getItem(key(wid))
    if (!raw) return DEFAULTS
    const saved = JSON.parse(raw) as Partial<Filters>
    return {
      types: (saved.types ?? DEFAULTS.types).filter((t) => BOARD_TYPES.includes(t)),
      forIds: saved.forIds ?? [],
      tags: saved.tags ?? [],
      lastType: saved.lastType ?? DEFAULTS.lastType,
    }
  } catch {
    return DEFAULTS
  }
}

export const useWsView = create<State>((set, get) => {
  const save = (patch: Partial<Filters>) => {
    set(patch)
    const { wid, types, forIds, tags, lastType } = get()
    if (!wid) return
    try {
      localStorage.setItem(key(wid), JSON.stringify({ types, forIds, tags, lastType }))
    } catch {
      // Private mode or blocked storage: filters just won't be remembered.
    }
  }

  return {
    ...DEFAULTS,
    wid: null,
    load: (wid) => {
      if (get().wid !== wid) set({ wid, ...read(wid) })
    },
    toggleType: (type) => {
      const types = get().types
      save({ types: types.includes(type) ? types.filter((t) => t !== type) : BOARD_TYPES.filter((t) => t === type || types.includes(t)) })
    },
    toggleFor: (id) => {
      const forIds = get().forIds
      save({ forIds: forIds.includes(id) ? forIds.filter((f) => f !== id) : [...forIds, id] })
    },
    clearFor: () => save({ forIds: [] }),
    toggleTag: (tag) => {
      const tags = get().tags
      save({ tags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag] })
    },
    clearTags: () => save({ tags: [] }),
    setLastType: (lastType) => save({ lastType }),
    reveal: (item) => {
      const { types } = get()
      save({
        types: types.includes(item.type) ? types : BOARD_TYPES.filter((t) => t === item.type || types.includes(t)),
        forIds: [],
        tags: [],
      })
    },
  }
})
