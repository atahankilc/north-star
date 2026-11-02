// What sits over the canvas and isn't it (D-359; was in Window.tsx): a window, a panel, a dock.
import type { MouseEvent, PointerEvent, WheelEvent } from 'react'

// What the canvas would do with a press, a wheel or a double-click never happens through it.
export const stopCanvas = {
  onPointerDown: (e: PointerEvent) => e.stopPropagation(),
  onDoubleClick: (e: MouseEvent) => e.stopPropagation(),
  onWheel: (e: WheelEvent) => e.stopPropagation(),
  onContextMenu: (e: MouseEvent) => e.stopPropagation(),
}

// A press on a scrim (not on what's on it) keeps the focus where it is, in the window (it never drops to <body>).
export const keepFocus = {
  onPointerDownCapture: (e: PointerEvent) => {
    if (e.target === e.currentTarget) e.preventDefault()
  },
  onMouseDown: (e: MouseEvent) => {
    if (e.target === e.currentTarget) e.preventDefault()
  },
}
