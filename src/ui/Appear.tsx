// Entrance / exit for DOM components (D-034, D-035): the element builds up cell by cell in random
// order, the way the "North Star" headline rebuilds on page load, and breaks apart the same way.
// Cells sit on the backdrop's ASCII grid (viewport-aligned), via a clip-path of merged cell runs.
// Wrap the component in <AnimatePresence> to get the exit.
import { usePresence } from 'motion/react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementType,
} from 'react'
import { useRevealed } from '../state/curtain'
import { isReducedMotion } from '../state/motion'
import { CELL_PX, cellTime, DURATION_MS, OVERSHOOT } from './cellReveal'

const HIDDEN = 'polygon(0 0, 0 0, 0 0)'

type Mode = 'enter' | 'exit'

function runCells(el: HTMLElement, mode: Mode, delay: number, duration: number, onDone?: () => void): () => void {
  if (isReducedMotion()) {
    el.style.clipPath = mode === 'enter' ? '' : HIDDEN
    onDone?.()
    return () => {}
  }

  const startAt = performance.now() + delay
  let raf = 0

  const frame = (now: number) => {
    const p = (Math.max(0, now - startAt) / duration) * OVERSHOOT
    const rect = el.getBoundingClientRect()
    const w = rect.width
    const h = rect.height

    if (w > 0 && h > 0) {
      // Viewport-aligned grid: the element's first cell may start before its left/top edge.
      const gx0 = Math.floor(rect.left / CELL_PX)
      const gy0 = Math.floor(rect.top / CELL_PX)
      const ox = gx0 * CELL_PX - rect.left
      const oy = gy0 * CELL_PX - rect.top
      const cols = Math.ceil((w - ox) / CELL_PX)
      const rows = Math.ceil((h - oy) / CELL_PX)

      let path = ''
      for (let r = 0; r < rows; r++) {
        const y0 = Math.max(0, oy + r * CELL_PX)
        const y1 = Math.min(h, oy + (r + 1) * CELL_PX)
        let runStart = -1
        // Merge horizontal runs of visible cells into one rectangle each.
        for (let c = 0; c <= cols; c++) {
          let visible = false
          if (c < cols) {
            const shown = cellTime(gx0 + c, gy0 + r) <= p
            visible = mode === 'enter' ? shown : !shown
          }
          if (visible && runStart < 0) runStart = c
          if (!visible && runStart >= 0) {
            const x0 = Math.max(0, ox + runStart * CELL_PX)
            const x1 = Math.min(w, ox + c * CELL_PX)
            path += `M${x0} ${y0}H${x1}V${y1}H${x0}Z`
            runStart = -1
          }
        }
      }
      el.style.clipPath = path ? `path('${path}')` : HIDDEN
    }

    if (p >= OVERSHOOT) {
      el.style.clipPath = mode === 'enter' ? '' : HIDDEN
      onDone?.()
      return
    }
    raf = requestAnimationFrame(frame)
  }

  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}

type Props<T extends ElementType> = {
  as?: T
  // Stagger lists: ms before this element starts building.
  delay?: number
  duration?: number
} & Omit<ComponentPropsWithoutRef<T>, 'as'>

export function Appear<T extends ElementType = 'div'>({ as, delay = 0, duration = DURATION_MS, ...rest }: Props<T>) {
  const Tag = (as ?? 'div') as ElementType
  const ref = useRef<HTMLElement>(null)
  const [isPresent, safeToRemove] = usePresence()
  // Starts together with the page-load rebuild (and everything else on the page): nothing waits.
  const revealed = useRevealed()
  const stop = useRef<() => void>(() => {})

  // Hidden from the very first paint until its cells start appearing.
  useLayoutEffect(() => {
    if (ref.current && !isReducedMotion()) ref.current.style.clipPath = HIDDEN
  }, [])

  useEffect(() => {
    if (!revealed || !isPresent || !ref.current) return
    stop.current = runCells(ref.current, 'enter', delay, duration)
    return () => stop.current()
    // Only on mount (and once the page is being revealed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed])

  useEffect(() => {
    if (isPresent) return
    stop.current()
    if (!ref.current) return safeToRemove?.()
    stop.current = runCells(ref.current, 'exit', 0, duration * 0.6, () => safeToRemove?.())
    return () => stop.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent])

  return <Tag ref={ref} {...rest} />
}
