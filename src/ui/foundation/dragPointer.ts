// A drag from a press to its release (D-359): every edge or line that's dragged (a panel's width, a dock's height, the
// split beside a plane) listened to the same three events and took them away again by hand.
import type { PointerEvent as ReactPointerEvent } from 'react'
import { DRAG_PX } from './feel'

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
