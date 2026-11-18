// What's held on a deck or a timeline (D-251, D-262, D-361): the drag's state and the board's maths, once. The board is
// drawn in its own px, scaled on screen by the canvas's zoom and its view's; `local` is a screen point in those px.
import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { DRAG_PX } from '../../../ui/foundation/feel'
import { pressDrag } from '../../../ui/foundation/dragPointer'
import { CARRIED } from '../../../ui/primitives/Marks'
import { loadFolds, saveFolds } from '../table/rows'

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

// The one of `els` under a screen point, or the nearest to it (D-403: a deck of tasks and a deck of cards each had it):
// the cell a held sheet would land in.
export function nearestTo<E extends Element>(els: E[], x: number, y: number): E | null {
  if (!els.length) return null
  const dist = (c: E) => {
    const r = c.getBoundingClientRect()
    const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0
    const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0
    return Math.hypot(dx, dy)
  }
  return els.reduce((a, b) => (dist(b) < dist(a) ? b : a))
}

// A held sheet's ghost under the pointer (D-270): where it's held, its width, carried at 0.8 round the point held.
export const ghostStyle = (d: Held): CSSProperties => ({ left: d.at[0] - d.grab[0], top: d.at[1] - d.grab[1], width: d.size[0], scale: `${CARRIED}`, transformOrigin: `${d.grab[0]}px ${d.grab[1]}px` })

// A deck's folded lanes (or rows), kept in this browser: which are folded, and folding or unfolding one.
export function useFolds(piece: string) {
  const [folds, setFolds] = useState(() => loadFolds(piece))
  const fold = (lane: string) => {
    const next = folds.includes(lane) ? folds.filter((x) => x !== lane) : [...folds, lane]
    setFolds(next)
    saveFolds(piece, next)
  }
  return { folds, fold }
}
