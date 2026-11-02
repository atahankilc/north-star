// A plane in focus (D-184, D-185): it becomes the view. `?focus=<id>` on the canvas's path, so back leaves and a reload
// stays. Going in, from the console's `[focus]`, the plane spreads out over the screen like ink: cell by cell on the 9 px
// grid (D-034's cells), nearest the plane first with a ragged edge, until it has swallowed the screen. Its own view glides
// to fit what it holds as the ink spreads (D-297), its `+` marks with it, as it glides home while the ink draws back.
// Coming back (`[unfocus]`, Escape) the ink draws back into wherever the plane is now. Reduced motion: it's just there,
// or just gone. In focus the wheel and drags are the plane's (D-186): they move its own view (`planeCam`), and going back
// it glides home to how it sat on the canvas while the ink draws in.
// A matrix (`bare`) isn't a plane: no marks, no ink. Its table stays whole and glides from where it sits to the middle of
// the screen while the page fills in behind it cell by cell in random order (D-034's cells), and back the same way. A
// framed one is cut by its window's edge on the canvas: that cut opens out to the screen as it glides in and closes
// round it again as it glides back, so a long table never shows past its window on the way.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import type { WithId } from '../../../data/hooks'
import type { Piece } from '../../../data/model'
import { GRID } from '../../../data/pieces'
import { glide, stopGlide, useCanvasView, type PlaneCam, type ScreenRect } from '../../../state/canvasView'
import { stopFollowing } from './collab'
import { isReducedMotion } from '../../../state/motion'
import { isOpen } from './shownBox'
import { CELL_PX, cellHash, cellsPath } from '../../../ui/foundation/cellReveal'
import styles from './CanvasView.module.css'
import { DUR, tween } from '../../../ui/foundation/motion'
import { wheelStep, zoomAt } from '../../../ui/foundation/feel'
import { panPointer } from '../../../ui/foundation/dragPointer'

const IN_MS = DUR.focusIn
const OUT_MS = DUR.focusOut
// A matrix's way in and out: the table's glide (fitPlane's) and its page's cells together.
const BARE_MS = DUR.glide
// How much the cells' order is left to chance: the rest is their distance from the plane.
const RAGGED = 0.18




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
  // When going in starts (with the ink): its view starts gliding to where it's going (D-297).
  onSpread?: () => void
  children?: ReactNode
}

export function FocusedPlane({ piece, at, home, spread, leaving, lens, onArrived, onLeft, bare = false, onSpread, children }: Props) {
  const layer = useRef<HTMLDivElement>(null)
  // What the ink cuts: the layer itself, or a matrix's page behind its table.
  const page = useRef<HTMLDivElement>(null)
  // A matrix's table and what comes with it, cut to its window on the way in and out (`hold`).
  const held = useRef<HTMLDivElement>(null)
  const reduced = isReducedMotion()
  const cam = useCanvasView((s) => s.planeCam) ?? home
  // Its colours turn with the ink (D-297): the piece's graphite where it sat on the canvas, the page's black in focus,
  // `--bg` easing between them (inside, everything on `--bg` follows) as the ink spreads and as it draws back.
  const [shade, setShade] = useState<'piece' | null>(spread && !reduced ? 'piece' : null)
  useEffect(() => {
    if (leaving) return setShade(reduced ? null : 'piece')
    if (shade !== 'piece') return
    const raf = requestAnimationFrame(() => setShade(null))
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])
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
      const zoom = wheelStep(c.zoom, e)
      const [ox, oy] = zoomAt(c.zoom, zoom, [e.clientX - r.left, e.clientY - r.top], [c.ox, c.oy])
      useCanvasView.setState({ planeCam: { zoom, ox, oy } })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // A drag anywhere on it (not its console) pans the plane's own view.
  const pan = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const { planeCam: start, focusLeaving } = useCanvasView.getState()
    if ((e.button !== 0 && e.button !== 1) || !start || focusLeaving) return
    stopGlide()
    stopFollowing()
    // A press on a matrix's cell (D-217) is the cell's until it moves 5 px: a click still selects it, a drag pans.
    const onCell = !!(e.target as HTMLElement).closest('[data-cell]')
    panPointer(e, {
      lazy: onCell,
      move: (dx, dy) => useCanvasView.setState({ planeCam: { ...start, ox: start.ox + dx, oy: start.oy + dy } }),
      // A click on the plane itself lets go of what's selected (D-187); a pan doesn't, so a panel stays open while you
      // look round the plane (D-230).
      end: (moved) => void (!moved && !onCell && useCanvasView.setState({ cardSelected: null, cardMulti: [], labelSelected: null, linkSelected: null })),
    })
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
    const unhold = bare && held.current && !isOpen(piece) ? hold(held.current, at, home, 'in', BARE_MS) : () => {}
    const stop = ink(el, at, 'in', bare ? BARE_MS : IN_MS, bare ? 1 : RAGGED, () => {
      l.style.visibility = 'hidden'
      onArrived()
    })
    return () => {
      stop()
      unhold()
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
    const unhold = bare && held.current && !isOpen(piece) ? hold(held.current, at, home, 'out', BARE_MS) : () => {}
    const stop = ink(el, at, 'out', bare ? BARE_MS : OUT_MS, bare ? 1 : RAGGED, onLeft)
    return () => {
      stop()
      unhold()
    }
    // When it starts leaving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])

  // The plane's own marks on its own view: every GRID plane px, from its (0, 0).
  const step = GRID * cam.zoom
  const marks = { '--mark': `${step}px`, '--mx': `${cam.ox - step / 2}px`, '--my': `${cam.oy - step / 2}px` } as CSSProperties
  return (
    <div
      ref={layer}
      className={styles.focused}
      data-bare={bare || undefined}
      data-reduced={reduced || undefined}
      data-shade={shade ?? undefined}
      style={{ '--shade-ms': `${bare ? BARE_MS : leaving ? OUT_MS : IN_MS}ms` } as CSSProperties}
      onPointerDown={pan}
      aria-label={piece.name || 'plane'}
    >
      {bare ? <div ref={page} className={styles.page} aria-hidden /> : <div className={styles.focusMarks} style={marks} aria-hidden />}
      {bare ? (
        <div ref={held} className={styles.held}>
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

// A framed matrix's (or table's…) cut: its window's inside carried with its view (where the window's edge would be on
// what it shows now), eased between that and the whole screen: from it going in, to it coming back, where the window
// takes over.
function hold(el: HTMLElement, at: ScreenRect, home: PlaneCam, way: 'in' | 'out', ms: number) {
  const w = el.clientWidth
  const h = el.clientHeight
  // Inside its 1 px edge (homeOf's).
  const [l, t, r, b] = [at.x + at.zoom, at.y + at.zoom, at.x + at.w - at.zoom, at.y + at.h - at.zoom]
  const cut = (k: number) => {
    const c = useCanvasView.getState().planeCam ?? home
    const z = c.zoom / home.zoom
    const [x0, y0] = [c.ox + (l - home.ox) * z, c.oy + (t - home.oy) * z]
    const [x1, y1] = [c.ox + (r - home.ox) * z, c.oy + (b - home.oy) * z]
    el.style.clipPath = `inset(${y0 * k}px ${(w - x1) * k}px ${(h - y1) * k}px ${x0 * k}px)`
  }
  cut(way === 'in' ? 1 : 0)
  // The in-out curve is symmetric, so running it backwards is 1 − k (motion.ts' tween).
  const stop = tween(ms, (k) => cut(way === 'in' ? 1 - k : k), { onDone: () => void (way === 'in' && (el.style.clipPath = '')) })
  return () => {
    stop()
    el.style.clipPath = ''
  }
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
    const path = cellsPath(w, h, 0, 0, cols, rows, (x, y) => when[y * cols + x] <= k)
    el.style.clipPath = path ? `path('${path}')` : 'inset(50%)'
  }
  cut(way === 'in' ? 0 : 1)
  return tween(ms, (k) => cut(way === 'in' ? k : 1 - k), {
    onDone: () => {
      // Arrived: the whole screen, held by its CSS from here (resizes and all).
      if (way === 'in') el.style.clipPath = ''
      done()
    },
  })
}
