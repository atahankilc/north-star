// A plane in focus (D-184, D-185): it becomes the view. `?focus=<id>` on the canvas's path, so back leaves and a reload
// stays. Going in, from the console's `[focus]`, the plane spreads out over the screen like ink: cell by cell on the 9 px
// grid (D-034's cells), nearest the plane first with a ragged edge, until it has swallowed the screen. Nothing zooms and
// its `+` marks never move: the layer carries them on the plane's own grid at the canvas's zoom, and only its cut grows.
// Coming back (`[unfocus]`, Escape) the ink draws back into wherever the plane is now. Reduced motion: it's just there,
// or just gone.
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { GRID } from '../../data/pieces'
import type { ScreenRect } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import { CELL_PX, cellHash } from '../../ui/cellReveal'
import styles from './CanvasView.module.css'

const IN_MS = 820
const OUT_MS = 700
// How much the cells' order is left to chance: the rest is their distance from the plane.
const RAGGED = 0.18

const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

type Props = {
  piece: WithId<Piece>
  // Where the plane is on screen: its marks' grid comes from here, and the ink spreads from (and draws back into) it.
  at: ScreenRect
  // Spread in from `at` (the console's `[focus]`); false = no way in to show (a reload, a link): it's just there.
  spread: boolean
  leaving: boolean
  lens: RefObject<HTMLDivElement | null>
  onArrived: () => void
  onLeft: () => void
  children?: ReactNode
}

export function FocusedPlane({ piece, at, spread, leaving, lens, onArrived, onLeft, children }: Props) {
  const layer = useRef<HTMLDivElement>(null)
  const reduced = isReducedMotion()

  // Going in. The canvas behind is hidden once the plane is the view, and shows again as it goes.
  useLayoutEffect(() => {
    const l = lens.current
    const el = layer.current
    if (!l || !el) return
    if (!spread || reduced) {
      l.style.visibility = 'hidden'
      onArrived()
      return () => void (l.style.visibility = '')
    }
    const stop = ink(el, at, 'in', IN_MS, () => {
      l.style.visibility = 'hidden'
      onArrived()
    })
    return () => {
      stop()
      l.style.visibility = ''
    }
    // On mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Coming back.
  useEffect(() => {
    const l = lens.current
    const el = layer.current
    if (!leaving) return
    if (!l || !el || reduced) return onLeft()
    l.style.visibility = ''
    return ink(el, at, 'out', OUT_MS, onLeft)
    // When it starts leaving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])

  // The plane's own marks, wherever it is: its grid starts inside its 1 px edge and runs every GRID × zoom.
  const step = GRID * at.zoom
  const marks = { '--mark': `${step}px`, '--mx': `${at.x + at.zoom - step / 2}px`, '--my': `${at.y + at.zoom - step / 2}px` } as CSSProperties
  return (
    <div ref={layer} className={styles.focused} style={marks} data-reduced={reduced || undefined} onPointerDown={(e) => e.stopPropagation()} aria-label={piece.name || 'plane'}>
      {children}
    </div>
  )
}

// The ink: the layer cut to the cells it has reached. A cell's moment is its distance from the plane (0 inside it), plus
// a little chance; going out runs it backwards. Cells sit on the layer's own 9 px grid.
function ink(el: HTMLElement, at: ScreenRect, way: 'in' | 'out', ms: number, done: () => void) {
  const w = el.clientWidth
  const h = el.clientHeight
  const cols = Math.ceil(w / CELL_PX)
  const rows = Math.ceil(h / CELL_PX)
  const [l, t, r, b] = [at.x, at.y, at.x + at.w, at.y + at.h]
  const far = Math.hypot(Math.max(l, w - r, 1), Math.max(t, h - b, 1))
  // Each cell's moment, worked out once.
  const when = new Float32Array(cols * rows)
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const cx = x * CELL_PX + CELL_PX / 2
      const cy = y * CELL_PX + CELL_PX / 2
      const dx = Math.max(l - cx, 0, cx - r)
      const dy = Math.max(t - cy, 0, cy - b)
      when[y * cols + x] = dx === 0 && dy === 0 ? -1 : (Math.hypot(dx, dy) / far) * (1 - RAGGED) + cellHash(x, y) * RAGGED
    }
  const cut = (k: number) => {
    let path = ''
    for (let y = 0; y < rows; y++) {
      let run = -1
      for (let x = 0; x <= cols; x++) {
        const on = x < cols && when[y * cols + x] <= k
        if (on && run < 0) run = x
        if (!on && run >= 0) {
          path += `M${run * CELL_PX} ${y * CELL_PX}H${Math.min(w, x * CELL_PX)}V${Math.min(h, (y + 1) * CELL_PX)}H${run * CELL_PX}Z`
          run = -1
        }
      }
    }
    el.style.clipPath = path ? `path('${path}')` : 'inset(50%)'
  }
  const t0 = performance.now()
  let raf = 0
  const frame = (now: number) => {
    const p = Math.min(1, (now - t0) / ms)
    cut(inOut(way === 'in' ? p : 1 - p))
    if (p < 1) raf = requestAnimationFrame(frame)
    else {
      // Arrived: the whole screen, held by its CSS from here (resizes and all).
      if (way === 'in') el.style.clipPath = ''
      done()
    }
  }
  cut(way === 'in' ? 0 : 1)
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}
