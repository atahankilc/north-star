// A plane in focus (D-184, D-185): it becomes the view. `?focus=<id>` on the canvas's path, so back leaves and a reload
// stays. Going in, from the console's `[focus]`, the plane spreads out over the screen like ink: cell by cell on the 9 px
// grid (D-034's cells), nearest the plane first with a ragged edge, until it has swallowed the screen. Nothing zooms and
// its `+` marks never move: the layer carries them on the plane's own grid at the canvas's zoom, and only its cut grows.
// Coming back (`[unfocus]`, Escape) the ink draws back into wherever the plane is now. Reduced motion: it's just there,
// or just gone. In focus the wheel and drags are the plane's (D-186): they move its own view (`planeCam`), and going back
// it glides home to how it sat on the canvas while the ink draws in.
// A matrix (`bare`) isn't a plane: no marks, no ink. Its table stays whole and glides from where it sits to the middle of
// the screen while the page fills in behind it cell by cell in random order (D-034's cells), and back the same way.
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { GRID } from '../../data/pieces'
import { glide, stopGlide, useCanvasView, type PlaneCam, type ScreenRect } from '../../state/canvasView'
import { stopFollowing } from './collab'
import { isReducedMotion } from '../../state/motion'
import { CELL_PX, cellHash } from '../../ui/cellReveal'
import styles from './CanvasView.module.css'

const IN_MS = 820
const OUT_MS = 700
// A matrix's way in and out: the table's glide (fitPlane's) and its page's cells together.
const BARE_MS = 420
// How much the cells' order is left to chance: the rest is their distance from the plane.
const RAGGED = 0.18

const ZOOM_MIN = 0.1
const ZOOM_MAX = 4

const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

type Props = {
  piece: WithId<Piece>
  // Where the plane is on screen: the ink spreads from (and draws back into) it.
  at: ScreenRect
  // Its own view as it sits on the canvas (its cards fitted in it, D-187): where focus starts and goes back to.
  home: PlaneCam
  // Spread in from `at` (the console's `[focus]`); false = no way in to show (a reload, a link): it's just there.
  spread: boolean
  leaving: boolean
  lens: RefObject<HTMLDivElement | null>
  onArrived: () => void
  onLeft: () => void
  // A matrix: no marks, the page built cell by cell behind its table instead of the ink.
  bare?: boolean
  // When going in starts (with the ink): a matrix's table starts gliding to the middle.
  onSpread?: () => void
  children?: ReactNode
}

export function FocusedPlane({ piece, at, home, spread, leaving, lens, onArrived, onLeft, bare = false, onSpread, children }: Props) {
  const layer = useRef<HTMLDivElement>(null)
  // What the ink cuts: the layer itself, or a matrix's page behind its table.
  const page = useRef<HTMLDivElement>(null)
  const reduced = isReducedMotion()
  const cam = useCanvasView((s) => s.planeCam) ?? home
  useLayoutEffect(() => {
    useCanvasView.setState({ planeCam: home, planeHome: home })
    return () => {
      stopGlide()
      useCanvasView.setState({ planeCam: null, planeHome: null })
    }
    // On mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // The canvas under it can move (a resize re-centres it): home follows.
  useEffect(() => {
    useCanvasView.setState({ planeHome: home })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home.ox, home.oy, home.zoom])

  // The wheel zooms the plane's own view round the pointer; a listener of our own, since React's are passive.
  useEffect(() => {
    const el = layer.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('section[aria-label=Threads], [role=dialog], [role=menu]')) return
      e.preventDefault()
      const { planeCam: c, focusLeaving } = useCanvasView.getState()
      if (!c || focusLeaving) return
      stopGlide()
      const r = el.getBoundingClientRect()
      const px = e.clientX - r.left
      const py = e.clientY - r.top
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, c.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))))
      const k = zoom / c.zoom
      useCanvasView.setState({ planeCam: { zoom, ox: px - (px - c.ox) * k, oy: py - (py - c.oy) * k } })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // A drag anywhere on it (not its console) pans the plane's own view.
  const pan = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const { planeCam: start, focusLeaving } = useCanvasView.getState()
    if ((e.button !== 0 && e.button !== 1) || !start || focusLeaving) return
    // A press on the plane itself lets go of a card (D-187).
    useCanvasView.setState({ cardSelected: null, labelSelected: null, linkSelected: null })
    stopGlide()
    stopFollowing()
    const el = e.currentTarget
    const [sx, sy] = [e.clientX, e.clientY]
    el.setPointerCapture(e.pointerId)
    el.dataset.panning = 'true'
    const move = (ev: PointerEvent) => useCanvasView.setState({ planeCam: { ...start, ox: start.ox + ev.clientX - sx, oy: start.oy + ev.clientY - sy } })
    const up = () => {
      delete el.dataset.panning
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  // Going in. The canvas behind is hidden once the plane is the view, and shows again as it goes.
  useLayoutEffect(() => {
    const l = lens.current
    const el = bare ? page.current : layer.current
    if (!l || !el) return
    if (!spread || reduced) {
      l.style.visibility = 'hidden'
      onArrived()
      return () => void (l.style.visibility = '')
    }
    onSpread?.()
    const stop = ink(el, at, 'in', bare ? BARE_MS : IN_MS, bare ? 1 : RAGGED, () => {
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
    const el = bare ? page.current : layer.current
    if (!leaving) return
    if (!l || !el || reduced) return onLeft()
    l.style.visibility = ''
    // Its own view goes home while the ink draws back, so its marks end where the plane's are.
    const { planeCam: c } = useCanvasView.getState()
    if (c) glide(c, home, bare ? BARE_MS : OUT_MS * 0.8, (v) => useCanvasView.setState({ planeCam: v }))
    return ink(el, at, 'out', bare ? BARE_MS : OUT_MS, bare ? 1 : RAGGED, onLeft)
    // When it starts leaving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])

  // The plane's own marks on its own view: every GRID plane px, from its (0, 0).
  const step = GRID * cam.zoom
  const marks = { '--mark': `${step}px`, '--mx': `${cam.ox - step / 2}px`, '--my': `${cam.oy - step / 2}px` } as CSSProperties
  return (
    <div ref={layer} className={styles.focused} style={bare ? undefined : marks} data-bare={bare || undefined} data-reduced={reduced || undefined} onPointerDown={pan} aria-label={piece.name || 'plane'}>
      {bare && <div ref={page} className={styles.page} aria-hidden />}
      {children}
    </div>
  )
}

// The ink: the layer cut to the cells it has reached. A cell's moment is its distance from the plane (0 inside it), plus
// a little chance (`ragged`, 1 = chance alone); going out runs it backwards. Cells sit on the layer's own 9 px grid.
function ink(el: HTMLElement, at: ScreenRect, way: 'in' | 'out', ms: number, ragged: number, done: () => void) {
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
      when[y * cols + x] = dx === 0 && dy === 0 ? -1 : (Math.hypot(dx, dy) / far) * (1 - ragged) + cellHash(x, y) * ragged
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
