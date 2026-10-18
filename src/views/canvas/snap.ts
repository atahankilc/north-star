// Snapping to the board's grid while dragging (D-112). A dragged card or label lands with its centre on the nearest
// grid point, so cards line up in rows and columns; the step is small, so any layout is still possible. Cards are all
// the same size (D-055), so centres on the grid means edges in line too. On by default, switched beside the `+`
// (or `g`), remembered in this browser; holding alt while dragging moves freely for that drag.
import { create } from 'zustand'

// A quarter of the `+` grid's one-unit spacing.
export const SNAP_STEP = 0.25

const KEY = 'north-star.board-snap'

function load(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    // Storage blocked: keep the default.
    return true
  }
}

type SnapState = { on: boolean; toggle: () => void }

export const useSnap = create<SnapState>((set, get) => ({
  on: load(),
  toggle: () => {
    const on = !get().on
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off')
    } catch {
      // Not persisted; still applies for this session.
    }
    set({ on })
  },
}))

const round = (v: number) => Math.round(v / SNAP_STEP) * SNAP_STEP

// Where a piece dragged to `p` lands: on the grid while snapping is on and alt isn't held.
export function snapPoint(p: [number, number], free: boolean): [number, number] {
  if (free || !useSnap.getState().on) return p
  return [round(p[0]), round(p[1])]
}
