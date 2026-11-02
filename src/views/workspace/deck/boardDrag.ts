// What's held on a deck or a timeline (D-251, D-262, D-361): the drag's state and the board's maths, once. The board is
// drawn in its own px, scaled on screen by the canvas's zoom and its view's; `local` is a screen point in those px.
import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { DRAG_PX } from '../../../ui/foundation/feel'
import { pressDrag } from '../../../ui/foundation/dragPointer'

export function useBoardDrag<D>(board: RefObject<HTMLElement | null>) {
  const [drag, setDrag] = useState<D | null>(null)
  // Read by the window's listeners, which outlive a render.
  const dragRef = useRef(drag)
  dragRef.current = drag
  const scale = () => {
    const el = board.current
    return el ? el.getBoundingClientRect().width / (el.offsetWidth || 1) : 1
  }
  const local = (x: number, y: number): [number, number] => {
    const r = board.current?.getBoundingClientRect()
    const s = scale()
    return r ? [(x - r.left) / s, (y - r.top) / s] : [0, 0]
  }
  return { drag, setDrag, dragRef, scale, local }
}

// A sheet held on a deck: where the press began (screen), the point held in it and its size (board px), where the
// pointer is (board px), and whether it's moved past DRAG_PX yet.
export type Held = { from: [number, number]; grab: [number, number]; size: [number, number]; at: [number, number]; moving: boolean }

// A press on a sheet: held at once (so it can draw as lifted), moved once the pointer's gone past DRAG_PX; each step
// `step` says what else changes (where it would land); let go (or a cancel), `drop`. The window hears the pointer, since
// the sheet leaves its list while it's held.
export function holdOnBoard<D extends Held>(
  e: ReactPointerEvent<HTMLElement>,
  b: Pick<ReturnType<typeof useBoardDrag<D>>, 'setDrag' | 'dragRef' | 'scale' | 'local'>,
  start: Omit<D, keyof Held>,
  step: (d: D, ev: PointerEvent) => Partial<D>,
  drop: () => void,
) {
  const r = e.currentTarget.getBoundingClientRect()
  const s = b.scale()
  b.setDrag({ ...start, from: [e.clientX, e.clientY], grab: [(e.clientX - r.left) / s, (e.clientY - r.top) / s], size: [r.width / s, r.height / s], at: b.local(e.clientX, e.clientY), moving: false } as D)
  pressDrag(
    (ev) => {
      const d = b.dragRef.current
      if (!d) return
      const moving = d.moving || Math.hypot(ev.clientX - d.from[0], ev.clientY - d.from[1]) > DRAG_PX
      if (moving) b.setDrag({ ...d, ...step(d, ev), at: b.local(ev.clientX, ev.clientY), moving })
    },
    () => drop(),
  )
}
