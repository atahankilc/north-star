// The tasks side view (D-300): open or not, which tab (a deck's id, `mine` or `days`), and per deck its board or its
// days. Yours, kept per workspace in this browser; not in the address (it's not a place).
import { create } from 'zustand'

export type SideTab = 'mine' | 'days' | string
export type DeckView = 'board' | 'days'
type State = { wid: string | null; open: boolean; tab: SideTab; views: Record<string, DeckView> }

const KEY = (wid: string) => `north-star:tasks-side:${wid}`

export const useTasksSide = create<State>(() => ({ wid: null, open: false, tab: 'mine', views: {} }))

// Read once a workspace opens; written back on every change.
export function loadTasksSide(wid: string) {
  if (useTasksSide.getState().wid === wid) return
  let saved: Partial<State> = {}
  try {
    saved = JSON.parse(localStorage.getItem(KEY(wid)) ?? '{}') as Partial<State>
  } catch {
    /* nothing kept */
  }
  useTasksSide.setState({ wid, open: !!saved.open, tab: typeof saved.tab === 'string' ? saved.tab : 'mine', views: saved.views ?? {} })
}

useTasksSide.subscribe((s) => {
  if (!s.wid) return
  try {
    localStorage.setItem(KEY(s.wid), JSON.stringify({ open: s.open, tab: s.tab, views: s.views }))
  } catch {
    /* private mode: kept for this visit */
  }
})

// `☐` by your square and `t`: open (on `tab` when given) or close.
export function toggleTasksSide(tab?: SideTab) {
  const s = useTasksSide.getState()
  if (s.open && (!tab || tab === s.tab)) return useTasksSide.setState({ open: false })
  useTasksSide.setState({ open: true, ...(tab ? { tab } : {}) })
}

export const closeTasksSide = () => useTasksSide.setState({ open: false })
