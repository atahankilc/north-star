// A drag from a press to its release (D-359): every edge or line that's dragged (a panel's width, a dock's height, the
// split beside a plane) listened to the same three events and took them away again by hand.
import type { PointerEvent as ReactPointerEvent } from 'react'

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
