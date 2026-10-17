// Loading curtain (D-025). While anything holds it, the page is hidden behind an exact copy of
// the flowing backdrop (same clock, same dim), so you only see the background, plus a small
// status in the bottom-right corner. When ready, the copy dissolves cell by cell in random order
// and the page "rebuilds" out of the background without it ever restarting.
import { Canvas } from '@react-three/fiber'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useCurtain } from '../state/curtain'
import type { AsciiEffect, MaskMode } from '../three/AsciiEffect'
import { BACKDROP_CAMERA, BackdropScene } from '../three/Backdrop'
import { isReducedMotion } from '../state/motion'
import { backdropDim } from '../three/sceneClock'
import styles from './Curtain.module.css'

const SHOW_AFTER_MS = 250 // after the first load, ignore loads shorter than this
const SETTLE_MS = 150 // stay up until nothing has held the curtain for this long
const MIN_BOOT_MS = 900
const MIN_SHOWN_MS = 400
const SWEEP_MS = 400 // time for every cell to flip

type Phase = 'covering' | 'covered' | 'revealing'

// The sweep runs inside the render loop so it stays in lockstep with the frames it masks.
type Sweep = { phase: Phase; startedAt: number }

export function Curtain() {
  const holds = useCurtain((s) => s.holds)
  const setRevealed = useCurtain((s) => s.setRevealed)
  const busy = Object.keys(holds).length > 0
  const status = Object.values(holds)[0]

  const [mounted, setMounted] = useState(true)
  const sweep = useRef<Sweep>({ phase: 'covered', startedAt: 0 })
  // Dev-only: lets automation pin the sweep to an exact progress.
  if (import.meta.env.DEV) (window as unknown as { __sweep: typeof sweep }).__sweep = sweep
  const booting = useRef(true)
  const shownAt = useRef(performance.now())
  const [revealing, setRevealing] = useState(false)
  // Until its first frame, the WebGL cover is transparent. On first load it starts solid black
  // (nothing is drawn yet anyway) so the page can't flash through while shaders compile.
  const cover = useRef<HTMLDivElement>(null)
  const drawn = useRef(false)

  useEffect(() => {
    if (mounted && !revealing && !busy) {
      const min = booting.current ? MIN_BOOT_MS : MIN_SHOWN_MS
      const wait = Math.max(SETTLE_MS, min - (performance.now() - shownAt.current))
      const t = window.setTimeout(() => {
        booting.current = false
        sweep.current = { phase: 'revealing', startedAt: performance.now() }
        setRevealing(true)
        // Entrance animations start now, so they play as the page rebuilds.
        setRevealed(true)
      }, wait)
      return () => window.clearTimeout(t)
    }
    if (!mounted && busy) {
      const t = window.setTimeout(() => {
        shownAt.current = performance.now()
        sweep.current = { phase: 'covering', startedAt: performance.now() }
        drawn.current = false
        setRevealing(false)
        setMounted(true)
        setRevealed(false)
      }, SHOW_AFTER_MS)
      return () => window.clearTimeout(t)
    }
  }, [mounted, revealing, busy, setRevealed])

  const onFrame = (effect: AsciiEffect) => {
    if (!drawn.current && cover.current) {
      drawn.current = true
      cover.current.style.background = 'transparent'
    }
    effect.setDim(backdropDim.current)
    const s = sweep.current
    const duration = isReducedMotion() ? 1 : SWEEP_MS
    const p = Math.min(1, (performance.now() - s.startedAt) / duration)
    let mode: MaskMode = s.phase
    if (s.phase === 'covering' && p >= 1) mode = 'covered'
    // Sweep slightly past 1 so the jittered last cells clear too.
    effect.setMask(mode, p * 1.05)
    if (s.phase === 'revealing' && p >= 1) {
      // Unmount on the next tick, outside the render loop.
      window.setTimeout(() => {
        setMounted(false)
        setRevealing(false)
      })
    }
  }

  return (
    <>
      {mounted && (
        <div
          ref={cover}
          className={styles.cover}
          style={{ pointerEvents: revealing ? 'none' : 'auto', background: booting.current ? 'var(--bg)' : 'transparent' }}
          aria-hidden
        >
          <Canvas dpr={[1, 2]} camera={BACKDROP_CAMERA} gl={{ antialias: false, alpha: true, premultipliedAlpha: true }}>
            <BackdropScene onFrame={onFrame} />
          </Canvas>
        </div>
      )}
      <AnimatePresence>
        {mounted && !revealing && (
          <motion.div
            key="status"
            className={styles.status}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { delay: booting.current ? 0.3 : 0.1 } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          >
            <Spinner />
            <span>{status ?? 'ready'}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Quarter-block glyph spinning in place: ▖ ▘ ▝ ▗
const FRAMES = '▖▘▝▗'

function Spinner() {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (isReducedMotion()) return
    const id = window.setInterval(() => setI((n) => (n + 1) % FRAMES.length), 120)
    return () => window.clearInterval(id)
  }, [])
  return (
    <span className={styles.spinner} aria-hidden>
      {FRAMES[i]}
    </span>
  )
}
