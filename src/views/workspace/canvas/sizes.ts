// How big pieces came out, measured as they're drawn: a leaf module (no imports but zustand and the grid), so what
// measures itself, the kind record and shownBox.ts read the same stores without an import cycle (one crashed the split
// build, D-287).
import { create } from 'zustand'
import { GRID } from '../../../model/grid'

// The margin round an open piece's contents (D-228), and under them, where its console is.
export const OPEN_PAD = GRID
export const OPEN_FOOT = 2 * GRID

// An unframed documents list, document (D-234) or timeline (D-289): its contents aren't known from the data (rows of
// text, a document's length, the days' rows).
export const useOpenSize = create<Record<string, { w: number; h: number }>>(() => ({}))

// Each kanban (its tasks are as tall as their text), framed or not: what fit frames, and its box unframed.
export const useKanbanSizes = create<Record<string, { w: number; h: number }>>(() => ({}))
