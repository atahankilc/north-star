// What of a matrix or a table is on the screen, so only those cells are drawn: a big one (hundreds of rows and columns)
// costs what the screen holds, not what it has. In its own px, snapped out to whole blocks so it changes only when the
// view crosses into a new block, not on every frame of a pan; one block more all round, so a pan shows no gap before
// the next ones come. On the canvas, opened there (D-228), it follows the canvas's camera; elsewhere (focus, a pane
// beside a plane, its window on the canvas) its own view in its layer.
import { useEffect, useState, type RefObject } from 'react'
import { useCanvasView, type PlaneCam } from '../../state/canvasView'

const BLOCK = 512

export type Seen = { x0: number; y0: number; x1: number; y1: number }

const snapOut = (x0: number, y0: number, x1: number, y1: number): Seen => ({
  x0: (Math.floor(x0 / BLOCK) - 1) * BLOCK,
  y0: (Math.floor(y0 / BLOCK) - 1) * BLOCK,
  x1: (Math.ceil(x1 / BLOCK) + 1) * BLOCK,
  y1: (Math.ceil(y1 / BLOCK) + 1) * BLOCK,
})
const keyOf = (s: Seen) => `${s.x0},${s.y0},${s.x1},${s.y1}`
const parse = (k: string): Seen => {
  const [x0, y0, x1, y1] = k.split(',').map(Number)
  return { x0, y0, x1, y1 }
}

// `at`: on the canvas, where its own (0, 0) is in the canvas's px.
export function useSeen(layer: RefObject<HTMLDivElement | null>, view: PlaneCam, wid: string, at: [number, number] | null): Seen {
  // Its layer's size; until it's measured, the screen's (never more than it shows).
  const [room, setRoom] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = layer.current
    if (!el || at) return
    const ro = new ResizeObserver(() => setRoom({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [layer, at === null])
  const onCanvas = useCanvasView((s) => {
    if (!at) return ''
    const c = s.cams[wid]
    if (!c || !s.size.w) return ''
    // The screen in the canvas's px (its middle is the camera's), then in the piece's own.
    const x = (sx: number) => (sx - s.size.w / 2 - c.x) / c.zoom - at[0]
    const y = (sy: number) => (sy - s.size.h / 2 - c.y) / c.zoom - at[1]
    return keyOf(snapOut(x(0), y(0), x(s.size.w), y(s.size.h)))
  })
  const screen = useCanvasView((s) => s.size)
  if (at) return onCanvas ? parse(onCanvas) : { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity }
  const w = room?.w || screen.w
  const h = room?.h || screen.h
  return snapOut(-view.ox / view.zoom, -view.oy / view.zoom, (w - view.ox) / view.zoom, (h - view.oy) / view.zoom)
}

// Which of `n` items, the i-th from `start + i * step` and `size` long, are inside [lo, hi]: [from, to).
export function within(lo: number, hi: number, start: number, step: number, size: number, n: number): [number, number] {
  if (!Number.isFinite(lo) && !Number.isFinite(hi)) return [0, n]
  const from = Math.max(0, Math.floor((lo - start - size) / step) + 1)
  const to = Math.min(n, Math.ceil((hi - start) / step))
  return [Math.min(from, n), Math.max(from, to)]
}
