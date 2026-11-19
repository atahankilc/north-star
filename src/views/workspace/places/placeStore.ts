// The places (D-412, docs/specs/shell.md): Talk, Tasks and Docs. One open at a time, first beside the canvas (a column
// on the left ground, as a right panel lies on the right), and with `full` as the page, in the canvas's place in the
// main sheet. Talk is the threads' own store (useThreadView, D-197): it's open while the threads' list or a
// conversation is, however it was opened (the HUD's button, a chip on the canvas, the finder).
import { create } from 'zustand'
import { PANEL_W } from '../../../ui/foundation/feel'
import { tokenPx } from '../../../styles/cssToken'
import { useThreadView, toggleInbox } from '../threads/threadView'

export type Place = 'talk' | 'tasks' | 'docs'
export const PLACE_NAME: Record<Place, string> = { talk: 'Talk', tasks: 'Tasks', docs: 'Docs' }

type State = {
  open: Place | null
  // The open place is the page, not a column beside the canvas.
  page: boolean
  // A column's width, dragged at its right edge (null: the right panel's, `--panel-w`); this tab's.
  width: number | null
  // What Tasks shows (its tab: a deck's id, `mine`, `all`; with a deck's days beside it on the page); null: its own pick.
  // `linked`: opened from a plane's dock (D-300 → D-419): that plane's deck, `⇆ linked to` it, only its cards' tasks.
  tasks: { tab: string; days: boolean; linked?: string | null } | null
}

export const usePlace = create<State>(() => ({ open: null, page: false, width: null, tasks: null }))

const talking = (s: { inbox: boolean; openId: string | null; draft: unknown }) => s.inbox || !!s.openId || !!s.draft

// A conversation opened from a chip, or the list from anywhere, opens Talk beside the canvas; the last of them closed
// closes Talk.
useThreadView.subscribe((s, was) => {
  const on = talking(s)
  if (on === talking(was)) return
  const p = usePlace.getState()
  if (on && p.open !== 'talk') usePlace.setState({ open: 'talk', page: false })
  if (!on && p.open === 'talk') usePlace.setState({ open: null, page: false })
})

export function closePlace() {
  const was = usePlace.getState().open
  usePlace.setState({ open: null, page: false })
  if (was === 'talk') toggleInbox(false)
}

// The HUD's buttons: open a place (as the page if one is the page now), or close it if it's the one open.
export function openPlace(place: Place) {
  const { open, page } = usePlace.getState()
  if (open === place) return closePlace()
  if (open === 'talk') toggleInbox(false)
  usePlace.setState({ open: place, page })
  if (place === 'talk') toggleInbox(true)
}

export const setPage = (page: boolean) => usePlace.setState({ page })

// Tasks opened on a deck (D-419: a task's `show on board` / `show on days`, in place of the old side view): the board
// beside the canvas, its days as the page (where the days stand beside the board).
export function openTasks(tab: string, days = false, linked: string | null = null) {
  if (usePlace.getState().open === 'talk') toggleInbox(false)
  usePlace.setState((s) => ({
    open: 'tasks',
    // A deck's days as the page, unless it's a plane's (that stays beside the plane, the days in the column).
    page: (days && !linked) || (s.open === 'tasks' && s.page),
    tasks: { tab, days, linked },
    // From a plane, room for its deck's columns beside it.
    width: linked ? linkedWidth(s.width) : s.width,
  }))
}

// A plane's linked deck or days (its dock's `⇆`): opens Tasks there, linked; pressed again, closes it.
export function toggleTasksFrom(plane: string, tab: string, days = false) {
  const s = usePlace.getState()
  if (s.open === 'tasks' && s.tasks?.linked === plane && s.tasks.tab === tab) return closePlace()
  openTasks(tab, days && tab === 'all' ? false : days, plane)
}
const LINKED_SHARE = 0.45 // tokens-ok: a share of the window, not a size
// Wide enough for a deck's columns, never so wide the plane beside it has too little left once a task's panel opens on
// the right (the 2026-11-19 pass: the plane was a strip with its dock cut).
const PLANE_LEAST = 520 // tokens-ok: the least a plane in focus keeps beside Tasks, in px
function linkedWidth(now: number | null) {
  const room = window.innerWidth - tokenPx('--panel-w') - PLANE_LEAST
  const want = Math.max(now ?? 0, Math.min(window.innerWidth * LINKED_SHARE, room))
  return Math.round(Math.min(PANEL_W.max, Math.max(PANEL_W.min, want)))
}

// A column's right edge dragged to `right` (screen x), from the rail's edge `from`.
export const dragWidth = (from: number, right: number) => usePlace.setState({ width: Math.round(Math.min(PANEL_W.max, Math.max(PANEL_W.min, right - from))) })
