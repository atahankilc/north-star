// Cell-by-cell reveal (D-034, D-035): the motion of the "North Star" headline rebuilding on page
// load, used for every component. Content appears in ASCII-grid cells, each at its own random
// moment. The same math runs in CSS (Appear) and in GLSL (3D cards), and both use the backdrop's
// screen grid, so pieces line up with the ASCII field behind them.

import { DUR } from './motionTokens'

// Grid cell in CSS px. The backdrop's cell is 9 device px (cellSize()), so this is one of its cells on a 1x screen and
// 2 × 2 of them on a 2x one: the lines still fall on the backdrop's grid.
export const CELL_PX = 9

// Progress runs a little past 1 so the last cells are surely in.
export const OVERSHOOT = 1.02

export const DURATION_MS = DUR.cells

// Every cell shut: what a cell-by-cell entrance hides an element with before its first cell shows.
export const CELLS_SHUT = 'polygon(0 0, 0 0, 0 0)'

// The path of the cells showing, for a clip-path (D-326: one builder for runCells and the focus's ink). A `cols × rows`
// grid of CELL_PX cells starting at (ox, oy) in a w × h element (≤ 0: its first cell may start before the edge); `on(c,
// r)` says whether a cell shows. Each row's run of showing cells is one rectangle. '' when none shows.
export function cellsPath(w: number, h: number, ox: number, oy: number, cols: number, rows: number, on: (c: number, r: number) => boolean): string {
  let path = ''
  for (let r = 0; r < rows; r++) {
    const y0 = Math.max(0, oy + r * CELL_PX)
    const y1 = Math.min(h, oy + (r + 1) * CELL_PX)
    let run = -1
    for (let c = 0; c <= cols; c++) {
      const shows = c < cols && on(c, r)
      if (shows && run < 0) run = c
      if (!shows && run >= 0) {
        path += `M${Math.max(0, ox + run * CELL_PX)} ${y0}H${Math.min(w, ox + c * CELL_PX)}V${y1}H${Math.max(0, ox + run * CELL_PX)}Z`
        run = -1
      }
    }
  }
  return path
}

// Deterministic per-cell noise, identical to the GLSL version below.
export function cellHash(x: number, y: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

// When (0 → 1) a cell shows up: a random moment per grid cell, no direction.
export function cellTime(gx: number, gy: number) {
  return cellHash(gx, gy)
}
