// The canvas's grid (D-182): 25 px steps, a plane's `+` marks, where pieces and cards snap.
export const GRID = 25
export const snap = (v: number) => Math.round(v / GRID) * GRID
