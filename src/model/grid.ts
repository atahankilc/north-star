// The canvas's grid (D-182): 25 px steps, a plane's `+` marks, where pieces and cards snap.
import { WORLD } from './world'

export const GRID = WORLD.grid
export const snap = (v: number) => Math.round(v / GRID) * GRID
