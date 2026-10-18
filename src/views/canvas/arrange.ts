// Lining up a selection (D-124): its left edges, centres, right edges (top, middle, bottom) in one line, or spaced out
// evenly between the outermost two; and nudging it with the arrow keys. Sizes as the alignment guides see them
// (guides.ts): cards by their box, text by its centre. Each is one undo step; a run of nudges merges into one.
import { placeMany, type Piece } from '../../data/selection'
import { useCanvas } from '../../state/canvasStore'
import { pieceOf } from './groupDrag'
import { halfOf } from './guides'
import { SNAP_STEP } from './snap'

export type Align = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom'

type Box = Piece & { c: [number, number]; h: [number, number] }
type Place = Piece & { to: [number, number] }

// Where the last nudge sent each piece from and to: a held arrow key repeats faster than the board catches up, so
// while a piece still shows where that nudge found it, the next one starts from where it was sent.
let ahead = new Map<string, { from: [number, number]; to: [number, number] }>()
const same = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6

function boxes(): Box[] {
  return useCanvas.getState().selection.flatMap((id) => {
    const p = pieceOf(id)
    if (!p) return []
    const was = ahead.get(id)
    const c: [number, number] = was && same(was.from, [p.x, p.y]) ? was.to : [p.x, p.y]
    return [{ kind: p.kind, id: p.id, c, h: halfOf(p.kind, p.id) }]
  })
}

// Only what actually moves is written.
const moved = (b: Box, to: [number, number]) => !same(b.c, to)

function place(wid: string, label: string, list: [Box, [number, number]][], key?: string) {
  const places: Place[] = list.filter(([b, to]) => moved(b, to)).map(([b, to]) => ({ kind: b.kind, id: b.id, to }))
  if (places.length) void placeMany(wid, label, places, key)
  return places
}

export function align(wid: string, how: Align) {
  const all = boxes()
  if (all.length < 2) return
  const axis = how === 'left' || how === 'centre' || how === 'right' ? 0 : 1
  const lo = Math.min(...all.map((b) => b.c[axis] - b.h[axis]))
  const hi = Math.max(...all.map((b) => b.c[axis] + b.h[axis]))
  // The board's y grows upwards: top is the high side.
  const side = how === 'left' || how === 'bottom' ? -1 : how === 'right' || how === 'top' ? 1 : 0
  const at = (b: Box) => (side < 0 ? lo + b.h[axis] : side > 0 ? hi - b.h[axis] : (lo + hi) / 2)
  place(
    wid,
    `align ${all.length} things`,
    all.map((b) => [b, axis === 0 ? [at(b), b.c[1]] : [b.c[0], at(b)]]),
  )
}

// The same gap between neighbours along `axis`, the outermost two staying where they are.
export function space(wid: string, axis: 0 | 1) {
  const all = boxes().sort((a, b) => a.c[axis] - b.c[axis])
  if (all.length < 3) return
  const first = all[0]
  const last = all[all.length - 1]
  const span = last.c[axis] + last.h[axis] - (first.c[axis] - first.h[axis])
  const gap = (span - all.reduce((sum, b) => sum + 2 * b.h[axis], 0)) / (all.length - 1)
  let edge = first.c[axis] - first.h[axis]
  const list = all.map((b): [Box, [number, number]] => {
    const c = edge + b.h[axis]
    edge = c + b.h[axis] + gap
    return [b, axis === 0 ? [c, b.c[1]] : [b.c[0], c]]
  })
  place(wid, `space out ${all.length} things`, list)
}

// One grid step (the snap step, D-112) per press; with shift, a whole unit of the `+` grid.
export function nudge(wid: string, dir: [number, number], big: boolean) {
  const all = boxes()
  if (!all.length) return
  const step = big ? 1 : SNAP_STEP
  const list = all.map((b): [Box, [number, number]] => [b, [b.c[0] + dir[0] * step, b.c[1] + dir[1] * step]])
  const key = `nudge:${all.map((b) => b.id).sort().join(',')}`
  place(wid, `move ${all.length} thing${all.length === 1 ? '' : 's'}`, list, key)
  ahead = new Map(list.map(([b, to]) => [b.id, { from: [pieceOf(b.id)!.x, pieceOf(b.id)!.y], to }]))
}
