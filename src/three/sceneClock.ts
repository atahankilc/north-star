// Shared state for every canvas that draws the ambient backdrop. The loading curtain draws a
// second copy on top of the page; both must render the identical frame, so nothing here may
// depend on per-canvas state (own clocks, pointer position, etc.).
import { isReducedMotion } from '../state/motion'

// The field drifts slowly, so it only needs a new frame this often (D-063). Time moves in these steps, so every
// canvas that draws the backdrop shows the same frame, and the backdrop only re-renders when the step changes.
export const BACKDROP_FPS = 30
const step = (t: number) => Math.floor(t * BACKDROP_FPS) / BACKDROP_FPS

let base = performance.now()
let frozenAt: number | null = null

// Seconds of animation so far. Pauses (and later resumes seamlessly) under reduced motion.
export function sceneTime(): number {
  const now = performance.now()
  if (isReducedMotion()) {
    frozenAt ??= (now - base) / 1000
    return step(frozenAt)
  }
  if (frozenAt !== null) {
    base = now - frozenAt * 1000
    frozenAt = null
  }
  return step((now - base) / 1000)
}

// Backdrop brightness (1 = full, lower on the board so cards stay legible). Eased by the backdrop
// each frame and read by the curtain copy, so both stay in step during the transition.
export const backdropDim = { target: 1, current: 1 }

// Dev-only handle for inspecting the clock from automation.
if (import.meta.env.DEV) {
  ;(window as unknown as { __sceneTime: typeof sceneTime }).__sceneTime = sceneTime
}
