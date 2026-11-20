// A drag from a press to its release (D-359): every edge or line that's dragged (a panel's width, a dock's height, the
// split beside a plane) listened to the same three events and took them away again by hand.
import type { PointerEvent as ReactPointerEvent } from 'react'
import { DRAG_PX, clampZoom, zoomAt } from './feel'
import { holdKeys } from './focus'

// From a press on `e.currentTarget`: `move` hears every step, `end` the release (or a cancel). Only the main button.
// The pointer is captured, so the drag goes on outside the element and over iframes.
export function dragPointer(e: ReactPointerEvent<Element>, move: (ev: PointerEvent) => void, end?: (ev: PointerEvent) => void) {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  const el = e.currentTarget
  el.setPointerCapture?.(e.pointerId)
  const up = (ev: PointerEvent) => {
    el.removeEventListener('pointermove', move as EventListener)
    el.removeEventListener('pointerup', up as EventListener)
    el.removeEventListener('pointercancel', up as EventListener)
    end?.(ev)
  }
  el.addEventListener('pointermove', move as EventListener)
  el.addEventListener('pointerup', up as EventListener)
  el.addEventListener('pointercancel', up as EventListener)
}

// A drag heard on the window, not captured (D-361): a press that doesn't move stays a click on what's under it (a
// piece, a card's link handle, a box drawn on a plane, a move, a text's width). `move` hears every step, `end` the
// release or a cancel (both take the listeners away). Whether it's moved far enough to count is the caller's (DRAG_PX).
export function pressDrag(move: (ev: PointerEvent) => void, end?: (ev: PointerEvent) => void) {
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    end?.(ev)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

// A box drawn from a press (D-394): alt+drag on a plane or on a deck. `at` gives a pointer's place in the caller's own
// px; `draw` hears the box as it grows, and `null` once it's over; `done` hears it when the pointer lets go. Escape
// while drawing drops the box (it would reach the canvas and leave the focus), so does a cancel, and a box under
// BOX_MIN across is a click, not a box: none of them selects anything.
export type DragBox = { x0: number; y0: number; x1: number; y1: number }
const BOX_MIN = 3
type At = { clientX: number; clientY: number }
export function boxDrag(e: At, at: (ev: At) => readonly [number, number], draw: (box: DragBox | null) => void, done: (box: { l: number; t: number; r: number; b: number }) => void) {
  const [x0, y0] = at(e)
  let last: DragBox = { x0, y0, x1: x0, y1: y0 }
  draw(last)
  let dropped = false
  const esc = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') return
    ev.preventDefault()
    ev.stopImmediatePropagation()
    dropped = true
    draw(null)
  }
  // The keys are the box's while it's drawn: a view's own Escape (let go of what's picked) asks keysTaken and waits.
  const free = holdKeys()
  window.addEventListener('keydown', esc, true)
  pressDrag(
    (ev) => {
      if (dropped) return
      const [x1, y1] = at(ev)
      last = { x0, y0, x1, y1 }
      draw(last)
    },
    (ev) => {
      window.removeEventListener('keydown', esc, true)
      free()
      draw(null)
      if (dropped || ev.type === 'pointercancel') return
      const [l, t, r, b] = [Math.min(last.x0, last.x1), Math.min(last.y0, last.y1), Math.max(last.x0, last.x1), Math.max(last.y0, last.y1)]
      if (r - l < BOX_MIN && b - t < BOX_MIN) return
      done({ l, t, r, b })
    },
  )
}

// A pan from a press on a view's empty space (D-186, D-217, D-361): the canvas, a plane in focus, a pane beside it.
// `move` hears how far the pointer has gone since the press (screen px); `end` whether it moved past DRAG_PX (a click
// lets go of the selection, a pan doesn't). `lazy`: a press on a cell is the cell's until it moves DRAG_PX (a click still
// selects it, a drag pans); otherwise the pan starts at once. While panning the view is `data-panning` (its cursor) and
// holds the pointer, so the pan goes on over anything.
// `pinch` (touch, the 2026-11-20 pass: a phone couldn't zoom at all): a second finger on the same view turns the pan
// into a pinch. It hears where the two fingers' middle started (client px) and gives back what hears each step: how
// much their spread has grown (`k`) and how far their middle has moved. Lifting either finger ends it.
type Pinch = (at: [number, number]) => (k: number, by: [number, number]) => void
const second = new WeakMap<Element, (e: ReactPointerEvent<Element>) => void>()
export function panPointer(e: ReactPointerEvent<HTMLElement>, o: { lazy?: boolean; move: (dx: number, dy: number) => void; end?: (moved: boolean) => void; pinch?: Pinch }) {
  const el = e.currentTarget
  // A second finger while a pan holds this view: the pan's.
  const join = second.get(el)
  if (join && e.pointerType === 'touch') return join(e)
  const [sx, sy] = [e.clientX, e.clientY]
  const id = e.pointerId
  let panning = false
  let moved = false
  // While pinching: both fingers' places now, where they started, and the step's hearer.
  let two: { pts: Map<number, [number, number]>; d0: number; m0: [number, number]; step: ReturnType<Pinch> } | null = null
  const begin = () => {
    panning = true
    el.setPointerCapture(id)
    el.dataset.panning = 'true'
  }
  if (!o.lazy) begin()
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const move = (ev: PointerEvent) => {
    if (two) {
      if (!two.pts.has(ev.pointerId)) return
      two.pts.set(ev.pointerId, [ev.clientX, ev.clientY])
      const [a, b] = [...two.pts.values()]
      const m = mid(a, b)
      two.step(Math.hypot(a[0] - b[0], a[1] - b[1]) / two.d0, [m[0] - two.m0[0], m[1] - two.m0[1]])
      return
    }
    if (ev.pointerId !== id) return
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) >= DRAG_PX) moved = true
    if (!panning) {
      if (!moved) return
      begin()
    }
    o.move(ev.clientX - sx, ev.clientY - sy)
  }
  let last: [number, number] = [sx, sy]
  const track = (ev: PointerEvent) => ev.pointerId === id && (last = [ev.clientX, ev.clientY])
  if (o.pinch && e.pointerType === 'touch')
    second.set(el, (e2) => {
      if (two || !o.pinch) return
      e2.stopPropagation()
      if (!panning) begin()
      el.setPointerCapture(e2.pointerId)
      const b: [number, number] = [e2.clientX, e2.clientY]
      const m0 = mid(last, b)
      two = { pts: new Map([[id, last], [e2.pointerId, b]]), d0: Math.max(1, Math.hypot(last[0] - b[0], last[1] - b[1])), m0, step: o.pinch(m0) }
      moved = true
    })
  const up = () => {
    second.delete(el)
    delete el.dataset.panning
    el.removeEventListener('pointermove', track)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
    o.end?.(moved)
  }
  el.addEventListener('pointermove', track)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}

// A pinch on a view kept as an offset from its top-left and a zoom (a plane in focus, a pane beside it): round the
// fingers' middle, moving with it. `get` is the view when the pinch starts.
export function pinchView<V extends { ox: number; oy: number; zoom: number }>(el: Element, get: () => V, set: (v: V) => void): Pinch {
  return (at) => {
    const start = get()
    const r = el.getBoundingClientRect()
    const p: [number, number] = [at[0] - r.left, at[1] - r.top]
    return (k, by) => {
      const zoom = clampZoom(start.zoom * k)
      const [ox, oy] = zoomAt(start.zoom, zoom, p, [start.ox, start.oy])
      set({ ...start, zoom, ox: ox + by[0], oy: oy + by[1] })
    }
  }
}
