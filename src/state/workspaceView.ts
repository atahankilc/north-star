// What the current workspace shows: type, customer and tag filters.
// Remembered per workspace in this browser (spec: docs/specs/board.md §3).
import { create } from 'zustand'
import { BOARD_TYPES, type BoardType } from '../data/model'

// What the + menu makes: a card, text (D-050), or a section (D-130).
export type NewThing = BoardType | 'text' | 'section'

type Filters = {
  types: BoardType[]
  // Customer ids for the `for:` filter; empty = any customer.
  forIds: string[]
  // Tags for the `tag:` filter (D-056); empty = any tag.
  tags: string[]
  // Link groups hidden on the board (D-108, linkKinds.ts); empty = every link shows. Customer tags and `relates` start hidden
  // (D-128), and competitors' `competes` lines (D-135).
  hiddenLinks: string[]
}

// Link groups hidden until shown (D-128, D-135).
export const QUIET_LINKS = ['plain', 'for', 'competes']

const DEFAULTS: Filters = { types: [...BOARD_TYPES], forIds: [], tags: [], hiddenLinks: QUIET_LINKS }
// Bumped when a new link group starts hidden, so filters saved before it hide it too.
const LINKS_VERSION = 4

type State = Filters & {
  wid: string | null
  load: (wid: string) => void
  toggleType: (type: BoardType) => void
  toggleFor: (customerId: string) => void
  clearFor: () => void
  toggleTag: (tag: string) => void
  clearTags: () => void
  toggleLinks: (group: string) => void
  showAllLinks: () => void
  // Undo whatever filter hides this item, so a link can always land on it.
  reveal: (item: { type: BoardType }) => void
}

const key = (wid: string) => `north-star.view.${wid}`

// The groups each version started hiding; a filter saved before them hides them once, then the choice is remembered.
const HIDDEN_SINCE: [number, string][] = [
  [2, 'for'],
  [3, 'plain'],
  [4, 'competes'],
]
const hideNew = (hidden: string[], v: number) => [
  ...hidden,
  ...HIDDEN_SINCE.filter(([since, g]) => v < since && !hidden.includes(g)).map(([, g]) => g),
]

function read(wid: string): Filters {
  try {
    const raw = localStorage.getItem(key(wid))
    if (!raw) return DEFAULTS
    const saved = JSON.parse(raw) as Partial<Filters> & { linksV?: number }
    const hiddenLinks = saved.hiddenLinks ?? DEFAULTS.hiddenLinks
    return {
      types: (saved.types ?? DEFAULTS.types).filter((t) => BOARD_TYPES.includes(t)),
      forIds: saved.forIds ?? [],
      tags: saved.tags ?? [],
      hiddenLinks: hideNew(hiddenLinks, saved.linksV ?? 1),
    }
  } catch {
    return DEFAULTS
  }
}

export const useWsView = create<State>((set, get) => {
  const save = (patch: Partial<Filters>) => {
    set(patch)
    const { wid, types, forIds, tags, hiddenLinks } = get()
    if (!wid) return
    try {
      localStorage.setItem(key(wid), JSON.stringify({ types, forIds, tags, hiddenLinks, linksV: LINKS_VERSION }))
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
    toggleLinks: (group) => {
      const hidden = get().hiddenLinks
      save({ hiddenLinks: hidden.includes(group) ? hidden.filter((g) => g !== group) : [...hidden, group] })
    },
    showAllLinks: () => save({ hiddenLinks: [] }),
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
