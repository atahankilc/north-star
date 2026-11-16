// A drag from a press to its release (D-359): every edge or line that's dragged (a panel's width, a dock's height, the
// split beside a plane) listened to the same three events and took them away again by hand.
import type { PointerEvent as ReactPointerEvent } from 'react'
import { DRAG_PX } from './feel'
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
export function panPointer(e: ReactPointerEvent<HTMLElement>, o: { lazy?: boolean; move: (dx: number, dy: number) => void; end?: (moved: boolean) => void }) {
  const el = e.currentTarget
  const [sx, sy] = [e.clientX, e.clientY]
  const id = e.pointerId
  let panning = false
  let moved = false
  const begin = () => {
    panning = true
    el.setPointerCapture(id)
    el.dataset.panning = 'true'
  }
  if (!o.lazy) begin()
  const move = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) >= DRAG_PX) moved = true
    if (!panning) {
      if (!moved) return
      begin()
    }
    o.move(ev.clientX - sx, ev.clientY - sy)
  }
  const up = () => {
    delete el.dataset.panning
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
    o.end?.(moved)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}
