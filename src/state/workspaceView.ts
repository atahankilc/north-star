// What the current workspace shows: domain tab, type and customer filters, and which `+` was used last.
// Remembered per workspace in this browser (spec: docs/specs/domains.md §3).
import { create } from 'zustand'
import { BOARD_TYPES, type BoardType } from '../data/model'

export const ALL = 'all'

type Filters = {
  // A domain id, or ALL.
  domain: string
  types: BoardType[]
  // Customer ids for the `for:` filter; empty = any customer.
  forIds: string[]
  // Double-click on the board creates one of these.
  lastType: BoardType
}

const DEFAULTS: Filters = { domain: ALL, types: [...BOARD_TYPES], forIds: [], lastType: 'idea' }

type State = Filters & {
  wid: string | null
  load: (wid: string) => void
  setDomain: (domain: string) => void
  toggleType: (type: BoardType) => void
  toggleFor: (customerId: string) => void
  clearFor: () => void
  setLastType: (type: BoardType) => void
  // Undo whatever filter hides this item, so a link can always land on it.
  reveal: (item: { type: BoardType; domainIds: string[] }) => void
}

const key = (wid: string) => `north-star.view.${wid}`

function read(wid: string): Filters {
  try {
    const raw = localStorage.getItem(key(wid))
    if (!raw) return DEFAULTS
    const saved = JSON.parse(raw) as Partial<Filters>
    return {
      ...DEFAULTS,
      ...saved,
      types: (saved.types ?? DEFAULTS.types).filter((t) => BOARD_TYPES.includes(t)),
    }
  } catch {
    return DEFAULTS
  }
}

export const useWsView = create<State>((set, get) => {
  const save = (patch: Partial<Filters>) => {
    set(patch)
    const { wid, domain, types, forIds, lastType } = get()
    if (!wid) return
    try {
      localStorage.setItem(key(wid), JSON.stringify({ domain, types, forIds, lastType }))
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
    setDomain: (domain) => save({ domain }),
    toggleType: (type) => {
      const types = get().types
      save({ types: types.includes(type) ? types.filter((t) => t !== type) : BOARD_TYPES.filter((t) => t === type || types.includes(t)) })
    },
    toggleFor: (id) => {
      const forIds = get().forIds
      save({ forIds: forIds.includes(id) ? forIds.filter((f) => f !== id) : [...forIds, id] })
    },
    clearFor: () => save({ forIds: [] }),
    setLastType: (lastType) => save({ lastType }),
    reveal: (item) => {
      const { domain, types } = get()
      save({
        domain: domain === ALL || item.domainIds.includes(domain) ? domain : ALL,
        types: types.includes(item.type) ? types : BOARD_TYPES.filter((t) => t === item.type || types.includes(t)),
        forIds: [],
      })
    },
  }
})
