// Alignment guides on a focused plane (D-231; the old board's D-112, D-117, D-148): while something is dragged, a
// magenta line wherever its left, middle or right (top, middle, bottom) lines up with another card's or text's. With
// snapping on (the default) positions keep to the grid and the lines only show; off (`g`, or alt held), what's dragged
// is pulled onto a line within 6 screen px. `a` turns the guides off and on; both kept in this browser.
import { create } from 'zustand'

export type Box = { x: number; y: number; w: number; h: number }
// A guide: along x (a vertical line at `at`, from `from` to `to` down) or along y.
export type Guide = { axis: 'x' | 'y'; at: number; from: number; to: number }

const PULL_PX = 6

const saved = (key: string) => {
  try {
    return localStorage.getItem(key) !== 'off'
  } catch {
    return true
  }
}
const keep = (key: string, on: boolean) => {
  try {
    localStorage.setItem(key, on ? 'on' : 'off')
  } catch {
    // Private windows: the setting lasts this tab.
  }
}

type Guides = { snap: boolean; guides: boolean; shown: Guide[] }
export const useGuides = create<Guides>(() => ({ snap: saved('north-star:snap'), guides: saved('north-star:guides'), shown: [] }))

export function toggleSnap() {
  const snap = !useGuides.getState().snap
  useGuides.setState({ snap })
  keep('north-star:snap', snap)
  return snap
}
export function toggleGuides() {
  const guides = !useGuides.getState().guides
  useGuides.setState({ guides, shown: [] })
  keep('north-star:guides', guides)
  return guides
}

// Where the dragged box (already placed: snapped, or free) should go and the guides it makes, against the others.
// `pull`: move it onto the nearest line within 6 screen px on each axis; otherwise only lines it already sits on.
export function guide(box: Box, others: Box[], zoom: number, pull: boolean): { dx: number; dy: number; lines: Guide[] } {
  if (!useGuides.getState().guides || !others.length) return { dx: 0, dy: 0, lines: [] }
  const reach = pull ? PULL_PX / zoom : 0.5
  const pick = (axis: 'x' | 'y') => {
    const [p, s] = axis === 'x' ? ['x', 'w'] as const : ['y', 'h'] as const
    const mine = [box[p], box[p] + box[s] / 2, box[p] + box[s]]
    let best: { d: number; at: number } | null = null
    for (const o of others) for (const t of [o[p], o[p] + o[s] / 2, o[p] + o[s]]) for (const m of mine) {
      const d = t - m
      if (Math.abs(d) <= reach && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: t }
    }
    return best
  }
  const bx = pick('x')
  const by = pick('y')
  const dx = pull && bx ? bx.d : 0
  const dy = pull && by ? by.d : 0
  const moved = { x: box.x + dx, y: box.y + dy, w: box.w, h: box.h }
  const lines: Guide[] = []
  // Every other box it lines up with on that line, the guide running from the farthest to the farthest.
  for (const [axis, b] of [['x', bx], ['y', by]] as const) {
    if (!b) continue
    const [p, s, q, r] = axis === 'x' ? (['x', 'w', 'y', 'h'] as const) : (['y', 'h', 'x', 'w'] as const)
    const on = (o: Box) => [o[p], o[p] + o[s] / 2, o[p] + o[s]].some((t) => Math.abs(t - b.at) < 0.5)
    const along = [moved, ...others.filter(on)]
    lines.push({ axis, at: b.at, from: Math.min(...along.map((o) => o[q])) - 12, to: Math.max(...along.map((o) => o[q] + o[r])) + 12 })
  }
  return { dx, dy, lines }
}

export const showGuides = (lines: Guide[]) => useGuides.setState({ shown: lines })
export const clearGuides = () => useGuides.getState().shown.length && useGuides.setState({ shown: [] })
