// What the current workspace shows: type, customer, tag and region filters.
// Remembered per workspace in this browser (spec: docs/specs/board.md §3).
import { create } from 'zustand'
import { BOARD_TYPES, type BoardType } from '../data/model'

// What the + menu makes: a card, text (D-050), or a section (D-130).
export type NewThing = BoardType | 'text' | 'paragraph' | 'sticky' | 'section'

type Filters = {
  types: BoardType[]
  // Customer ids for the `for:` filter; empty = any customer.
  forIds: string[]
  // Tags for the `tag:` filter (D-056); empty = any tag.
  tags: string[]
  // Regions for the `region:` filter (D-145): only competitors operating there; empty = anywhere.
  regions: string[]
  // Link groups hidden on the board (D-108, linkKinds.ts); empty = every link shows. Customer tags and `relates` start hidden
  // (D-128), and competitors' `competes` lines (D-135).
  hiddenLinks: string[]
  // Flow, Table, Matrix and Priorities show only the cards on this plane (D-143); `all` = every card. The board sets it
  // to the plane it has open.
  plane: string
}

// Link groups hidden until shown (D-128, D-135).
export const QUIET_LINKS = ['plain', 'for', 'competes']

const DEFAULTS: Filters = { types: [...BOARD_TYPES], forIds: [], tags: [], regions: [], hiddenLinks: QUIET_LINKS, plane: 'all' }
// Bumped when a new link group starts hidden, so filters saved before it hide it too.
const LINKS_VERSION = 5
// Bumped when a new card type arrives, so filters saved before it show it (D-141).
const TYPES_VERSION = 2

type State = Filters & {
  wid: string | null
  load: (wid: string) => void
  toggleType: (type: BoardType) => void
  toggleFor: (customerId: string) => void
  clearFor: () => void
  toggleTag: (tag: string) => void
  clearTags: () => void
  toggleRegion: (region: string) => void
  clearRegions: () => void
  toggleLinks: (group: string) => void
  showAllLinks: () => void
  setPlane: (plane: string) => void
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
    const saved = JSON.parse(raw) as Partial<Filters> & { linksV?: number; typesV?: number }
    // Packages (D-141) came after: a filter saved before them shows them once, then the choice is remembered.
    const types = saved.types && (saved.typesV ?? 1) < TYPES_VERSION ? [...saved.types, 'package' as const] : saved.types
    let hiddenLinks = saved.hiddenLinks ?? DEFAULTS.hiddenLinks
    // `part of` and `depends on` left the `solves` and `draws` groups (version 5): a filter that hid the old group hides them too.
    for (const [from, to] of [['solves', 'part'], ['draws', 'depends']])
      if ((saved.linksV ?? 1) < 5 && hiddenLinks.includes(from) && !hiddenLinks.includes(to)) hiddenLinks = [...hiddenLinks, to]
    return {
      types: (types ?? DEFAULTS.types).filter((t) => BOARD_TYPES.includes(t)),
      forIds: saved.forIds ?? [],
      tags: saved.tags ?? [],
      regions: saved.regions ?? [],
      hiddenLinks: hideNew(hiddenLinks, saved.linksV ?? 1),
      plane: typeof saved.plane === 'string' ? saved.plane : 'all',
    }
  } catch {
    return DEFAULTS
  }
}

export const useWsView = create<State>((set, get) => {
  const save = (patch: Partial<Filters>) => {
    set(patch)
    const { wid, types, forIds, tags, regions, hiddenLinks, plane } = get()
    if (!wid) return
    try {
      localStorage.setItem(key(wid), JSON.stringify({ types, forIds, tags, regions, hiddenLinks, plane, linksV: LINKS_VERSION, typesV: TYPES_VERSION }))
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
    toggleRegion: (region) => {
      const regions = get().regions
      save({ regions: regions.includes(region) ? regions.filter((r) => r !== region) : [...regions, region] })
    },
    clearRegions: () => save({ regions: [] }),
    toggleLinks: (group) => {
      const hidden = get().hiddenLinks
      save({ hiddenLinks: hidden.includes(group) ? hidden.filter((g) => g !== group) : [...hidden, group] })
    },
    showAllLinks: () => save({ hiddenLinks: [] }),
    setPlane: (plane) => {
      if (get().plane !== plane) save({ plane })
    },
    reveal: (item) => {
      const { types } = get()
      save({
        types: types.includes(item.type) ? types : BOARD_TYPES.filter((t) => t === item.type || types.includes(t)),
        forIds: [],
        tags: [],
        regions: [],
      })
    },
  }
})
