// Where pieces go on a canvas, without Firebase (S6, D-312; R7): the nearest clear place for a new or moved piece,
// sticking to a plane's edge (D-210, D-215) and what follows a host when it moves or is resized (D-210, D-262, D-298).
// Moved from data/pieces.ts and CanvasView.tsx' press (which keep their own copies' callers through re-exports), so the
// ops and the UI decide these the same way.
import { GRID } from './grid'
import { sticks } from './pieces'
import type { Piece } from '../data/model'

export type Box = { x: number; y: number; w: number; h: number }
const GAP = 3 * GRID
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP

// The nearest clear place for `box` among `others` (asked 2026-10-22: "direkt baktığım yere koysun"): where it is, or
// the nearest clear spot round it within about its own size, in steps of the grid, nearest first; with none clear,
// where it is (on top of what's there).
export function nearClearIn(box: Box, others: Box[]): Pick<Box, 'x' | 'y'> {
  const free = (b: Box) => !others.some((o) => overlaps(b, o))
  if (free(box)) return { x: box.x, y: box.y }
  const step = 4 * GRID
  const reach = Math.ceil(Math.max(box.w, box.h) / step)
  const tries: [number, number][] = []
  for (let i = -reach; i <= reach; i++) for (let j = -reach; j <= reach; j++) if (i || j) tries.push([i * step, j * step])
  tries.sort((a, b) => Math.hypot(...a) - Math.hypot(...b))
  for (const [dx, dy] of tries) {
    const b = { ...box, x: box.x + dx, y: box.y + dy }
    if (free(b)) return { x: b.x, y: b.y }
  }
  return { x: box.x, y: box.y }
}

// ---- Sticking (D-210): a matrix or a table dropped near a plane's edge sits one grid step out from it and is bound to
// it: it moves with the plane, and what it shows is that plane's cards.

export type Side = 'left' | 'right' | 'top' | 'bottom'
export const STICK_GAP = GRID
// How near an edge a drop sticks, in canvas px at zoom 1 (the UI: 48 screen px).
export const STICK_REACH = 48

// The plane whose edge `box` is within `reach` of (canvas px), and where it would sit there; its top (or left) edge
// lines up with the plane's when that's near too.
export function stickTarget(box: Box, planes: (Box & { id: string })[], reach: number): { plane: string; box: Box; side: Side } | null {
  let best: { plane: string; box: Box; side: Side; d: number } | null = null
  const near = (a: number, b: number) => Math.abs(a - b) < reach
  for (const p of planes) {
    const alongY = box.y < p.y + p.h && p.y < box.y + box.h
    const alongX = box.x < p.x + p.w && p.x < box.x + box.w
    const y = near(box.y, p.y) ? p.y : box.y
    const x = near(box.x, p.x) ? p.x : box.x
    const options: { side: Side; d: number; at: [number, number] }[] = []
    if (alongY) {
      options.push({ side: 'right', d: Math.abs(box.x - (p.x + p.w + STICK_GAP)), at: [p.x + p.w + STICK_GAP, y] })
      options.push({ side: 'left', d: Math.abs(box.x + box.w - (p.x - STICK_GAP)), at: [p.x - STICK_GAP - box.w, y] })
    }
    if (alongX) {
      options.push({ side: 'bottom', d: Math.abs(box.y - (p.y + p.h + STICK_GAP)), at: [x, p.y + p.h + STICK_GAP] })
      options.push({ side: 'top', d: Math.abs(box.y + box.h - (p.y - STICK_GAP)), at: [x, p.y - STICK_GAP - box.h] })
    }
    for (const o of options)
      if (o.d < reach && (!best || o.d < best.d)) best = { plane: p.id, side: o.side, d: o.d, box: { ...box, x: o.at[0], y: o.at[1] } }
  }
  return best && { plane: best.plane, box: best.box, side: best.side }
}

// The side of `plane` a piece touches (D-215): one grid step out from that edge and alongside it; null when it's apart.
export function touchSide(box: Box, plane: Box): Side | null {
  const side = sideOf(box, plane)
  const gap = side === 'right' ? box.x - (plane.x + plane.w) : side === 'left' ? plane.x - (box.x + box.w) : side === 'bottom' ? box.y - (plane.y + plane.h) : plane.y - (box.y + box.h)
  const along = side === 'right' || side === 'left' ? box.y < plane.y + plane.h && plane.y < box.y + box.h : box.x < plane.x + plane.w && plane.x < box.x + box.w
  return along && Math.abs(gap - STICK_GAP) <= 1 ? side : null
}

// Which side of `plane` a stuck piece sits on.
export function sideOf(box: Box, plane: Box): Side {
  const gaps: [Side, number][] = [
    ['right', box.x - (plane.x + plane.w)],
    ['left', plane.x - (box.x + box.w)],
    ['bottom', box.y - (plane.y + plane.h)],
    ['top', plane.y - (box.y + box.h)],
  ]
  return gaps.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
}

// Where a piece stuck on `side` goes when its plane becomes `to`: kept on that edge, its place along it moved with the
// plane's matching corner.
export function followTo(box: Box, side: Side, from: Box, to: Box): Box {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (side === 'right') return { ...box, x: to.x + to.w + STICK_GAP, y: box.y + dy }
  if (side === 'left') return { ...box, x: to.x - STICK_GAP - box.w, y: box.y + dy }
  if (side === 'bottom') return { ...box, x: box.x + dx, y: to.y + to.h + STICK_GAP }
  return { ...box, x: box.x + dx, y: to.y - STICK_GAP - box.h }
}

type Shown = Box & { id: string; kind: Piece['kind']; stuckTo?: string }

// What follows a host (a plane, or a deck with its timeline): what's stuck to it, all the way down (D-298: a plane's
// deck's timeline), among the pieces shown on one canvas. CanvasView.tsx' stuckChain does the same for its drag.
export function stuckChain<P extends Shown>(shown: P[], id: string): P[] {
  const out: P[] = []
  const hosts = [id]
  for (let i = 0; i < hosts.length; i++)
    for (const f of shown)
      if (f.stuckTo === hosts[i] && sticks(f) && !hosts.includes(f.id)) (out.push(f), hosts.push(f.id))
  return out
}

// Where each follower of `id` goes when it goes from `from` to `to` (a move or a resize): one touching its host's edge
// stays on that edge (followTo), one apart moves as its host's corner does; each follows the one it's stuck to (this
// piece, or a follower before it). CanvasView.tsx' press works out the same for its drag.
export function followerMoves(shown: Shown[], id: string, from: Box, to: Box): { id: string; from: Box; to: Box }[] {
  const followers = stuckChain(shown, id)
  const fromOf = new Map<string, Box>([[id, from], ...followers.map((f) => [f.id, { x: f.x, y: f.y, w: f.w, h: f.h }] as [string, Box])])
  const tos = new Map<string, Box>([[id, to]])
  return followers.map((f) => {
    const host = f.stuckTo ?? id
    const ff = fromOf.get(f.id)!
    const [hf, ht] = [fromOf.get(host) ?? from, tos.get(host) ?? to]
    const side = touchSide(ff, hf)
    const t = side ? followTo(ff, side, hf, ht) : { ...ff, x: ff.x + ht.x - hf.x, y: ff.y + ht.y - hf.y }
    tos.set(f.id, t)
    return { id: f.id, from: ff, to: t }
  })
}
