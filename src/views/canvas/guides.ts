// Alignment guides while dragging (D-117). A dragged card snaps to the edges and centres of other cards (text to their
// centres) once it's within a few pixels of them, and a thin line shows what it lines up with. Each axis on its own:
// where nothing is close, the grid (D-112) applies as before. On by default, switched beside the `+` (or `a`),
// remembered in this browser; holding alt moves freely, as with the grid. In a group drag the piece you hold aligns.
import type { Camera } from 'three'
import { create } from 'zustand'
import { useCanvas } from '../../state/canvasStore'
import { CARD_H, CARD_W } from './cardLayout'
import { groupIds, pieceOf, piecesOnBoard } from './groupDrag'
import { snapPoint } from './snap'
import { titleHalf, titleId } from './titleBlock'

// How close (in screen pixels) an edge or centre has to come before it's pulled into line.
const PULL_PX = 6
// Lines run this far past the outermost box they join.
const OVERSHOOT = 0.25

const KEY = 'north-star.board-guides'

function load(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    // Storage blocked: keep the default.
    return true
  }
}

// A guide at `at` on one axis: a vertical line (axis x) from y0 to y1, or a horizontal one (axis y) from x0 to x1.
export type Guide = { axis: 'x' | 'y'; at: number; from: number; to: number }

type GuideState = { on: boolean; lines: Guide[]; toggle: () => void }

export const useGuides = create<GuideState>((set, get) => ({
  on: load(),
  lines: [],
  toggle: () => {
    const on = !get().on
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off')
    } catch {
      // Not persisted; still applies for this session.
    }
    set({ on, lines: [] })
  },
}))

export const clearGuides = () => useGuides.getState().lines.length && useGuides.setState({ lines: [] })

// Board units per screen pixel on the board plane, for a perspective camera looking straight down at it.
export function unitsPerPixel(camera: Camera, height: number): number {
  const fov = ((camera as { fov?: number }).fov ?? 40) * (Math.PI / 180)
  return (2 * camera.position.z * Math.tan(fov / 2)) / Math.max(1, height)
}

// Cards are the same size (D-055); text lines up by its centre only, so its size doesn't matter here. The title block
// (D-118) and sections (D-130) are boxes like a card: their edges line up too.
export const halfOf = (kind: string, id: string): [number, number] =>
  id === titleId() ? titleHalf() : (pieceOf(id)?.half ?? (kind === 'label' ? [0, 0] : [CARD_W / 2, CARD_H / 2]))

// The lines of a box on one axis: its low edge, centre and high edge (a label: its centre only).
type Mark = { role: -1 | 0 | 1; v: number }
const marks = (c: number, h: number): Mark[] => (h ? [{ role: -1, v: c - h }, { role: 0, v: c }, { role: 1, v: c + h }] : [{ role: 0, v: c }])
// Centres meet centres; an edge meets either edge (lined up, or one card starting where the other ends).
const meets = (a: Mark, b: Mark) => (a.role === 0) === (b.role === 0)

type Box = { c: [number, number]; h: [number, number] }

// The nearest pull on one axis (0 = x, 1 = y) within `reach`, or null.
function pull(own: Box, others: Box[], axis: 0 | 1, reach: number): number | null {
  let best: number | null = null
  for (const a of marks(own.c[axis], own.h[axis]))
    for (const o of others)
      for (const b of marks(o.c[axis], o.h[axis])) {
        const d = b.v - a.v
        if (meets(a, b) && Math.abs(d) <= reach && (best === null || Math.abs(d) < Math.abs(best))) best = d
      }
  return best
}

// The guides for a box that's in line on `axis`: one line per value it shares with others, across all of them. A card
// in the same column as another shares all three lines; only the centre is drawn then.
function linesOn(own: Box, others: Box[], axis: 0 | 1): Guide[] {
  const across = axis === 0 ? 1 : 0
  const found = new Map<number, { lo: number; hi: number }>()
  const near = (x: number, y: number) => Math.abs(x - y) < 1e-4
  for (const o of others) {
    const shared = marks(own.c[axis], own.h[axis]).flatMap((a) => marks(o.c[axis], o.h[axis]).filter((b) => meets(a, b) && near(a.v, b.v)).map(() => a))
    if (!shared.length) continue
    const centre = shared.find((m) => m.role === 0)
    for (const m of centre ? [centre] : shared) {
      const key = Math.round(m.v * 1e4) / 1e4
      const span = found.get(key) ?? { lo: own.c[across] - own.h[across], hi: own.c[across] + own.h[across] }
      span.lo = Math.min(span.lo, o.c[across] - o.h[across])
      span.hi = Math.max(span.hi, o.c[across] + o.h[across])
      found.set(key, span)
    }
  }
  return [...found].map(([at, s]) => ({ axis: axis === 0 ? 'x' : 'y', at, from: s.lo - OVERSHOOT, to: s.hi + OVERSHOOT }))
}

// Where the piece `id`, dragged to `p`, lands: in line with others where one is close (guides on), on the grid on
// the other axis (grid on), or exactly at `p` with alt held. Updates the guides drawn on the board.
export function placeDragged(id: string, p: [number, number], free: boolean, perPixel: number): [number, number] {
  const grid = snapPoint(p, free)
  const piece = pieceOf(id)
  if (free || !useGuides.getState().on || !piece) {
    clearGuides()
    return grid
  }
  const { selection } = useCanvas.getState()
  // A section's contents (D-130) move with it: nothing to line up with there.
  const moving = groupIds() ?? new Set(selection.includes(id) ? selection : [id])
  const own: Box = { c: p, h: halfOf(piece.kind, piece.id) }
  const others: Box[] = []
  for (const o of piecesOnBoard()) {
    if (!moving.has(o.id)) others.push({ c: [o.x, o.y], h: halfOf(o.kind, o.id) })
  }
  const reach = PULL_PX * perPixel
  const dx = pull(own, others, 0, reach)
  const dy = pull(own, others, 1, reach)
  const at: [number, number] = [dx === null ? grid[0] : p[0] + dx, dy === null ? grid[1] : p[1] + dy]
  const placed: Box = { c: at, h: own.h }
  // Also drawn when the grid alone put it in line with something.
  const lines = [...linesOn(placed, others, 0), ...linesOn(placed, others, 1)]
  const before = useGuides.getState().lines
  if (lines.length || before.length) useGuides.setState({ lines })
  return at
}
