// The places (D-412, docs/specs/shell.md): Talk, Tasks and Docs. One open at a time, first beside the canvas (a column
// on the left ground, as a right panel lies on the right), and with `full` as the page, in the canvas's place in the
// main sheet. Talk is the threads' own store (useThreadView, D-197): it's open while the threads' list or a
// conversation is, however it was opened (the HUD's button, a chip on the canvas, the finder).
import { create } from 'zustand'
import { PANEL_W } from '../../../ui/foundation/feel'
import { useThreadView, toggleInbox } from '../threads/Threads'

export type Place = 'talk' | 'tasks' | 'docs'
export const PLACE_NAME: Record<Place, string> = { talk: 'Talk', tasks: 'Tasks', docs: 'Docs' }

type State = {
  open: Place | null
  // The open place is the page, not a column beside the canvas.
  page: boolean
  // A column's width, dragged at its right edge (null: the right panel's, `--panel-w`); this tab's.
  width: number | null
  // What Tasks shows (its tab: a deck's id, `mine`, `all`; with a deck's days beside it on the page); null: its own pick.
  tasks: { tab: string; days: boolean } | null
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
export function openTasks(tab: string, days = false) {
  if (usePlace.getState().open === 'talk') toggleInbox(false)
  usePlace.setState((s) => ({ open: 'tasks', page: days || (s.open === 'tasks' && s.page), tasks: { tab, days } }))
}

// A column's right edge dragged to `right` (screen x), from the rail's edge `from`.
export const dragWidth = (from: number, right: number) => usePlace.setState({ width: Math.round(Math.min(PANEL_W.max, Math.max(PANEL_W.min, right - from))) })
