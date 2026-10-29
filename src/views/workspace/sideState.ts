// The tasks side view (D-300): open or not, which tab (a deck's id, `mine` or `all`: every deck's days), whether the
// deck's days are open as a third column, the plane it was opened from (its linked deck, the strip saying so), whether
// a task's panel fills it, and the widths: the left part's share with the days open and the deck's share of the side
// view. Yours, kept per workspace in this browser; not in the address (it's not a place).
import { create } from 'zustand'

export type SideTab = 'mine' | 'all' | string
type Kept = { open: boolean; tab: SideTab; days: boolean; splitDays: number; inner: number }
type State = Kept & { wid: string | null; linked: string | null; taskFull: boolean }

const KEY = (wid: string) => `north-star:tasks-side:${wid}`
const NONE: Kept = { open: false, tab: 'mine', days: false, splitDays: 1 / 3, inner: 0.55 }
const share = (v: unknown, min: number, max: number, or: number) => (typeof v === 'number' && v >= min && v <= max ? v : or)

export const useTasksSide = create<State>(() => ({ ...NONE, wid: null, linked: null, taskFull: false }))

// Read once a workspace opens; written back on every change.
export function loadTasksSide(wid: string) {
  if (useTasksSide.getState().wid === wid) return
  let saved: Partial<Kept> = {}
  try {
    saved = JSON.parse(localStorage.getItem(KEY(wid)) ?? '{}') as Partial<Kept>
  } catch {
    /* nothing kept */
  }
  useTasksSide.setState({
    wid,
    open: !!saved.open,
    tab: typeof saved.tab === 'string' && saved.tab !== 'days' ? saved.tab : NONE.tab,
    days: !!saved.days,
    splitDays: share(saved.splitDays, 0.15, 0.6, NONE.splitDays),
    inner: share(saved.inner, 0.3, 0.7, NONE.inner),
    linked: null,
    taskFull: false,
  })
}

useTasksSide.subscribe((s) => {
  if (!s.wid) return
  try {
    const kept: Kept = { open: s.open, tab: s.tab, days: s.days, splitDays: s.splitDays, inner: s.inner }
    localStorage.setItem(KEY(s.wid), JSON.stringify(kept))
  } catch {
    /* private mode: kept for this visit */
  }
})

// The side nav's icon and `t`: open (on `tab` when given) or close. Opened this way it's every deck's, not a plane's.
export function toggleTasksSide(tab?: SideTab) {
  const s = useTasksSide.getState()
  if (s.open && (!tab || tab === s.tab)) return useTasksSide.setState({ open: false, linked: null })
  useTasksSide.setState({ open: true, linked: null, ...(tab ? { tab } : {}) })
}

// From a plane's dock (D-300, D-210): its linked deck (with its days, from its timeline), or (a plane with no deck) its
// timeline as every deck's days for its cards; again, it closes.
export function toggleFromPlane(plane: string, tab: SideTab, days = false) {
  const s = useTasksSide.getState()
  if (s.open && s.linked === plane && s.tab === tab && (!days || s.days)) return useTasksSide.setState({ open: false, linked: null })
  useTasksSide.setState({ open: true, linked: plane, tab, ...(days ? { days: true } : {}) })
}

// From a deck's own focus: its days (the deck is on the left already).
export function toggleDaysOf(deck: string) {
  const s = useTasksSide.getState()
  if (s.open && s.tab === deck && s.days) return useTasksSide.setState({ open: false })
  useTasksSide.setState({ open: true, linked: null, tab: deck, days: true })
}

export const closeTasksSide = () => useTasksSide.setState({ open: false, linked: null, taskFull: false })

// Escape (after a task's panel, which hears it first): the days column, then the side view. `deckOnLeft`: the deck shown
// is the one in focus, so the days are all there is.
export function escapeTasksSide(deckOnLeft: boolean) {
  const s = useTasksSide.getState()
  if (s.days && s.tab !== 'mine' && s.tab !== 'all' && !deckOnLeft) return useTasksSide.setState({ days: false })
  closeTasksSide()
}

// What a follower's side view copies (presence `tasks`, D-300): the tab, ` days` with the days open.
export const sideShared = (s: Pick<State, 'open' | 'tab' | 'days'>) => (s.open ? `${s.tab}${s.days ? ' days' : ''}` : null)
