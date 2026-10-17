// Cell-by-cell reveal (D-034, D-035): the motion of the "North Star" headline rebuilding on page
// load, used for every component. Content appears in ASCII-grid cells, each at its own random
// moment. The same math runs in CSS (Appear) and in GLSL (3D cards), and both use the backdrop's
// screen grid, so pieces line up with the ASCII field behind them.

// Grid cell in CSS px; matches the backdrop's ASCII cell (cellSize() / devicePixelRatio).
export const CELL_PX = 9

// Progress runs a little past 1 so the last cells are surely in.
export const OVERSHOOT = 1.02

export const DURATION_MS = 320

// Deterministic per-cell noise, identical to the GLSL version below.
export function cellHash(x: number, y: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

// When (0 → 1) a cell shows up: a random moment per grid cell, no direction.
export function cellTime(gx: number, gy: number) {
  return cellHash(gx, gy)
}

// GLSL for 3D materials: discard fragments whose screen cell hasn't appeared yet.
export const CELL_REVEAL_UNIFORMS = /* glsl */ `
uniform float uCellProgress; // 0 → OVERSHOOT
uniform float uCellMode;     // 0 off · 1 revealing
uniform float uCellSize;     // cell size in buffer px
`

export const CELL_REVEAL_FRAGMENT = /* glsl */ `
if (uCellMode > 0.5) {
  vec2 cellIdx = floor(gl_FragCoord.xy / uCellSize);
  float t = fract(sin(cellIdx.x * 12.9898 + cellIdx.y * 78.233) * 43758.5453);
  if (t > uCellProgress) discard;
}
`
