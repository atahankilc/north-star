// Snapping to the board's grid while dragging (D-112, D-148). The `+` marks are the snap points: one step, GRID_STEP,
// and a dragged box lands with its top-left corner on a mark. Cards are 4 × 2 steps (2.5 × 1.25), so all four corners
// of a snapped card sit on marks. On by default, switched beside the `+` (or `g`), remembered in this browser; holding
// alt while dragging moves freely for that drag.
import { create } from 'zustand'

// Between two `+` marks, in board units.
export const GRID_STEP = 0.625

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

const round = (v: number) => Math.round(v / GRID_STEP) * GRID_STEP

// Where a piece dragged to `p` lands: on the grid while snapping is on and alt isn't held. With `half`, the box's
// top-left corner goes on a mark rather than its centre.
export function snapPoint(p: [number, number], free: boolean, half: [number, number] = [0, 0]): [number, number] {
  if (free || !useSnap.getState().on) return p
  return [round(p[0] - half[0]) + half[0], round(p[1] + half[1]) - half[1]]
}
