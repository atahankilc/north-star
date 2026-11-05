// The box a dragged handle turns `from` into (D-180, D-376): one rule for a piece, a section and a sticky note. `handle`
// names the sides that move ('n', 'se'…), the others stay where they are. `at` lands a moved edge (snapped, or free with
// alt); `min` and `max` hold the size, and an edge stopped by them stops against the side that stays.
export type Box = { x: number; y: number; w: number; h: number }
type Size = { w: number; h: number }

export function resizedBox(from: Box, handle: string, dx: number, dy: number, at: (v: number) => number, min: Size, max: Size = { w: Infinity, h: Infinity }): Box {
  let { x, y, w, h } = from
  const right = from.x + from.w
  const bottom = from.y + from.h
  const held = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  if (handle.includes('e')) w = held(at(right + dx) - from.x, min.w, max.w)
  if (handle.includes('s')) h = held(at(bottom + dy) - from.y, min.h, max.h)
  if (handle.includes('w')) {
    x = held(at(from.x + dx), right - max.w, right - min.w)
    w = right - x
  }
  if (handle.includes('n')) {
    y = held(at(from.y + dy), bottom - max.h, bottom - min.h)
    h = bottom - y
  }
  return { x, y, w, h }
}
