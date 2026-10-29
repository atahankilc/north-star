// Layouts by meaning (S9, D-312, R10; docs/specs/agent.md §2 point 4, §4.4): the model never picks coordinates, it says
// how things go together (a grid, a row, a column, clusters, lined up, spaced out, beside something) and where (near a
// thing, in a section, the nearest clear area, or where they are); this works out the spots. Pure geometry on boxes in
// one space's px (a plane's, or a canvas's): src/ops/arrange.ts gathers the boxes from the workspace (what each thing
// carries, what stays) and turns the result into arrange's moves. 1.0's src/archive/ai/arrange.ts was the reference
// (git show 493bf87); the data model changed, so this is smaller: blocks of boxes, no link-ordering.
//
// Rules every layout keeps: spots on the 25 px grid; at least one grid step between what moves and what stays (two
// between the things laid out); no overlap with anything that stays (a section's frame may hold things wholly, never
// cut through them); a block that would land on something is pushed to the nearest clear spot, and failing that under
// everything there.
import { GRID, snap } from './grid'

export type Box = { x: number; y: number; w: number; h: number }
export type Boxed = Box & { id: string }

// Beside a thing is a `where` (`{ near }`), not a layout: any block goes there.
export const BLOCK_LAYOUTS = ['grid', 'row', 'column', 'cluster'] as const
export const ALIGNS = ['align-left', 'align-centre', 'align-right', 'align-top', 'align-middle', 'align-bottom'] as const
export const SPREADS = ['spread-x', 'spread-y'] as const
export const LAYOUTS = [...BLOCK_LAYOUTS, ...ALIGNS, ...SPREADS] as const
export type Layout = (typeof LAYOUTS)[number]
export type Align = (typeof ALIGNS)[number]
export type Side = 'right' | 'below' | 'left' | 'above'
export const SIDES: Side[] = ['right', 'below', 'left', 'above']

// Between the things laid out; between groups of a cluster; between what moves and what stays.
export const GAP = 2 * GRID
export const GROUP_GAP = 4 * GRID
export const CLEAR = GRID
// How wide to tall a grid (and a cluster's group) is packed.
const ASPECT = 1.6

const up = (v: number) => Math.ceil(v / GRID - 1e-6) * GRID
const down = (v: number) => Math.floor(v / GRID + 1e-6) * GRID

// ---- The panel's line up and space out (CardPanel.tsx' ManyInside `moveTo`/`spread`, the same maths; the panel keeps
// its own copy until it calls the ops). Each box's top-left goes to the spot given, snapped.

export function alignTo(items: Boxed[], how: Align): Map<string, { x: number; y: number }> {
  const [l, t] = [Math.min(...items.map((c) => c.x)), Math.min(...items.map((c) => c.y))]
  const [r, b] = [Math.max(...items.map((c) => c.x + c.w)), Math.max(...items.map((c) => c.y + c.h))]
  const to: Record<Align, (c: Boxed) => [number, number]> = {
    'align-left': (c) => [l, c.y],
    'align-centre': (c) => [(l + r) / 2 - c.w / 2, c.y],
    'align-right': (c) => [r - c.w, c.y],
    'align-top': (c) => [c.x, t],
    'align-middle': (c) => [c.x, (t + b) / 2 - c.h / 2],
    'align-bottom': (c) => [c.x, b - c.h],
  }
  return new Map(items.map((c) => {
    const [x, y] = to[how](c).map(snap)
    return [c.id, { x, y }]
  }))
}

// Evenly from the first to the last, in their order along that way.
export function spreadTo(items: Boxed[], axis: 'x' | 'y'): Map<string, { x: number; y: number }> {
  const sorted = [...items].sort((p, q) => (axis === 'y' ? p.y - q.y : p.x - q.x))
  const [a, z] = axis === 'y' ? [sorted[0].y, sorted[sorted.length - 1].y] : [sorted[0].x, sorted[sorted.length - 1].x]
  const at = new Map(sorted.map((c, i) => [c.id, sorted.length > 1 ? a + ((z - a) * i) / (sorted.length - 1) : a]))
  return new Map(items.map((c) => [c.id, axis === 'y' ? { x: snap(c.x), y: snap(at.get(c.id)!) } : { x: snap(at.get(c.id)!), y: snap(c.y) }]))
}

// ---- Blocks: where each box goes, relative to the block's top-left (0, 0), every spot on the grid.

// How many columns a grid of these has: about ASPECT wide to tall, within `maxW` when given (at least one).
export function gridCols(sizes: { w: number; h: number }[], maxW?: number, aspect = ASPECT): number {
  const n = sizes.length
  if (n <= 1) return 1
  const cw = Math.max(...sizes.map((s) => up(s.w))) + GAP
  const ch = Math.max(...sizes.map((s) => up(s.h))) + GAP
  let cols = Math.max(1, Math.min(n, Math.round(Math.sqrt((n * aspect * ch) / cw))))
  if (maxW !== undefined) while (cols > 1 && cols * cw - GAP > maxW) cols--
  return cols
}

// A table: `cols` columns, each as wide as its widest, each row as tall as its tallest, GAP apart. Row by row.
export function gridSpots(sizes: { w: number; h: number }[], cols: number): { spots: { x: number; y: number }[]; w: number; h: number } {
  const n = sizes.length
  if (!n) return { spots: [], w: 0, h: 0 }
  cols = Math.max(1, Math.min(cols, n))
  const rows = Math.ceil(n / cols)
  const colW = Array.from({ length: cols }, (_, c) => Math.max(0, ...sizes.filter((_, i) => i % cols === c).map((s) => up(s.w))))
  const rowH = Array.from({ length: rows }, (_, r) => Math.max(0, ...sizes.slice(r * cols, r * cols + cols).map((s) => up(s.h))))
  const xs = colW.map((_, c) => colW.slice(0, c).reduce((a, w) => a + w + GAP, 0))
  const ys = rowH.map((_, r) => rowH.slice(0, r).reduce((a, h) => a + h + GAP, 0))
  return {
    spots: sizes.map((_, i) => ({ x: xs[i % cols], y: ys[Math.floor(i / cols)] })),
    w: xs[cols - 1] + colW[cols - 1],
    h: ys[rows - 1] + rowH[rows - 1],
  }
}

// A grid filled column by column, `rows` tall (a column wrapping into the next one).
export function columnSpots(sizes: { w: number; h: number }[], rows: number) {
  const n = sizes.length
  rows = Math.max(1, Math.min(rows, n))
  const cols = Math.ceil(n / rows)
  const at = (i: number) => (i % rows) * cols + Math.floor(i / rows)
  const filled = Array.from({ length: rows * cols }, () => ({ w: 0, h: 0 }))
  sizes.forEach((s, i) => (filled[at(i)] = s))
  const g = gridSpots(filled, cols)
  return { spots: sizes.map((_, i) => g.spots[at(i)]), w: g.w, h: g.h }
}

export type Group = { name: string; members: number[]; head?: { w: number; h: number } }

// Clusters: each group a small grid (taller than wide), the groups side by side GROUP_GAP apart, wrapping to a new
// band of groups past `maxW`. A group's heading (when it has one) sits on top of its block, a grid step over it.
export function clusterSpots(sizes: { w: number; h: number }[], groups: Group[], maxW?: number) {
  const spots: { x: number; y: number }[] = sizes.map(() => ({ x: 0, y: 0 }))
  const boxes: (Box & { name: string; head?: { x: number; y: number } })[] = []
  let [x, y, bandH, w] = [0, 0, 0, 0]
  for (const g of groups) {
    const own = g.members.map((i) => sizes[i])
    const grid = gridSpots(own, gridCols(own, maxW, 0.8))
    const headH = g.head ? up(g.head.h) + GRID : 0
    const gw = Math.max(grid.w, g.head ? up(g.head.w) : 0)
    const gh = headH + grid.h
    if (maxW !== undefined && x > 0 && x + gw > maxW) ((x = 0), (y += bandH + GROUP_GAP), (bandH = 0))
    g.members.forEach((i, k) => (spots[i] = { x: x + grid.spots[k].x, y: y + headH + grid.spots[k].y }))
    boxes.push({ name: g.name, x, y, w: gw, h: gh, ...(g.head ? { head: { x, y } } : {}) })
    w = Math.max(w, x + gw)
    bandH = Math.max(bandH, gh)
    x += gw + GROUP_GAP
  }
  return { spots, groups: boxes, w, h: y + bandH }
}

// ---- Staying clear

// Something that stays. `frame`: a section, which may hold a box wholly but not cut through one.
export type Obstacle = Box & { frame?: boolean }

const meets = (a: Box, b: Box, gap: number) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap
export const within = (b: Box, s: Box) => b.x >= s.x && b.y >= s.y && b.x + b.w <= s.x + s.w && b.y + b.h <= s.y + s.h
export const overlap = (a: Box, b: Box) => meets(a, b, 0)

export function boundsOf(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y }
}

// Whether boxes moved by (dx, dy) land on what stays: a grid step clear of each thing, and never across a section's
// edge (inside it wholly, or clear of it).
export function clashes(boxes: Box[], obstacles: Obstacle[], dx = 0, dy = 0): boolean {
  if (!boxes.length) return false
  const b = boundsOf(boxes)
  const near = obstacles.filter((o) => meets({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h }, o, o.frame ? 0 : CLEAR))
  if (!near.length) return false
  for (const raw of boxes) {
    const m = { x: raw.x + dx, y: raw.y + dy, w: raw.w, h: raw.h }
    for (const o of near) {
      if (o.frame) {
        if (overlap(m, o) && !within(m, o)) return true
      } else if (meets(m, o, CLEAR)) return true
    }
  }
  return false
}

// Where a block may go: `bounds` (a plane's box from (0, 0)) keeps it inside, a grid step in, when it fits there.
const inside = (b: Box, bounds?: Box) => {
  if (!bounds) return true
  if (b.x < bounds.x + GRID || b.y < bounds.y + GRID) return false
  return b.w > bounds.w - 2 * GRID || b.x + b.w <= bounds.x + bounds.w - GRID
}

// Offsets on the grid, nearest first, out to `reach` px.
const RINGS = new Map<number, [number, number][]>()
function offsets(reach: number, step: number): [number, number][] {
  const key = reach * 1000 + step
  let out = RINGS.get(key)
  if (out) return out
  out = []
  const k = Math.ceil(reach / step)
  for (let i = -k; i <= k; i++) for (let j = -k; j <= k; j++) out.push([i * step, j * step])
  out.sort((a, b) => Math.hypot(...a) - Math.hypot(...b) || a[1] - b[1] || a[0] - b[0])
  RINGS.set(key, out)
  return out
}

// The nearest move (on the grid) that puts the boxes clear of what stays: none when they're clear; else the nearest
// clear spot inside `bounds` first, then anywhere within reach; failing both, straight down under everything there.
export function clearOffset(boxes: Box[], obstacles: Obstacle[], bounds?: Box, reach = 2500): { dx: number; dy: number } {
  if (!boxes.length) return { dx: 0, dy: 0 }
  const b = boundsOf(boxes)
  const ok = (dx: number, dy: number, keep: boolean) => (!keep || inside({ ...b, x: b.x + dx, y: b.y + dy }, bounds)) && !clashes(boxes, obstacles, dx, dy)
  // Where it is, when that's clear (a plane's content may lie past its box: it isn't pulled in).
  if (ok(0, 0, false)) return { dx: 0, dy: 0 }
  const tries = offsets(reach, GAP)
  for (const keep of bounds ? [true, false] : [false]) for (const [dx, dy] of tries) if (ok(dx, dy, keep)) return { dx, dy }
  return under(b, obstacles, bounds)
}

// Under everything there (two grid steps clear), kept inside a plane's left edge.
function under(b: Box, obstacles: Obstacle[], bounds?: Box) {
  const bottom = obstacles.length ? Math.max(...obstacles.map((o) => o.y + o.h)) : b.y
  const dy = Math.max(0, up(bottom + GAP - b.y))
  const dx = bounds && b.x < bounds.x + GRID ? up(bounds.x + GRID - b.x) : 0
  return { dx, dy }
}

// The first clear spot for a block of this size, row by row from a plane's top-left (two grid steps in) within its
// width; on a canvas (no bounds) under everything there, level with the leftmost thing.
export function firstClear(size: { w: number; h: number }, obstacles: Obstacle[], bounds?: Box): { x: number; y: number } {
  const box = (x: number, y: number) => [{ x, y, w: size.w, h: size.h }]
  if (!bounds) {
    if (!obstacles.length) return { x: 0, y: 0 }
    return { x: down(Math.min(...obstacles.map((o) => o.x))), y: up(Math.max(...obstacles.map((o) => o.y + o.h)) + 2 * GAP) }
  }
  const x0 = bounds.x + 2 * GRID
  const right = Math.max(bounds.x + bounds.w - 2 * GRID, x0 + size.w)
  for (let y = bounds.y + 2 * GRID; y < bounds.y + 40000; y += GAP) for (let x = x0; x + size.w <= right; x += GAP) if (!clashes(box(x, y), obstacles)) return { x, y }
  const d = under({ x: x0, y: bounds.y + 2 * GRID, ...size }, obstacles, bounds)
  return { x: x0 + d.dx, y: bounds.y + 2 * GRID + d.dy }
}

// Where a block of this size sits beside `anchor` on `side`: two grid steps clear, its top (or left) level with it.
export function besideSpot(anchor: Box, size: { w: number; h: number }, side: Side): { x: number; y: number } {
  if (side === 'right') return { x: up(anchor.x + anchor.w + GAP), y: snap(anchor.y) }
  if (side === 'left') return { x: down(anchor.x - GAP - size.w), y: snap(anchor.y) }
  if (side === 'below') return { x: snap(anchor.x), y: up(anchor.y + anchor.h + GAP) }
  return { x: snap(anchor.x), y: down(anchor.y - GAP - size.h) }
}

// A section grown to hold `block` (two grid steps clear right and under), never shrunk.
export function grownSection(section: Box, block: Box): Box {
  return {
    ...section,
    w: Math.max(section.w, up(block.x + block.w + 2 * GRID - section.x)),
    h: Math.max(section.h, up(block.y + block.h + 2 * GRID - section.y)),
  }
}

// Inside a section: its inner box, clear of its name strip (three grid steps from the edge its name is in: the top, or
// the left with `side: 'left'`; two from the others).
export function sectionInner(s: Box, side?: 'left'): Box {
  const [l, t] = side === 'left' ? [3 * GRID, 2 * GRID] : [2 * GRID, 3 * GRID]
  return { x: up(s.x + l), y: up(s.y + t), w: s.w - l - 2 * GRID, h: s.h - t - 2 * GRID }
}
