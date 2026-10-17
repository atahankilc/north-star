// Shared state for every canvas that draws the ambient backdrop. The loading curtain draws a
// second copy on top of the page; both must render the identical frame, so nothing here may
// depend on per-canvas state (own clocks, pointer position, etc.).
import { isReducedMotion } from '../state/motion'

// How fast the backdrop moves (1 = full speed, slower in a workspace so it stays out of the way). Eased here.
export const backdropPace = { target: 1, current: 1 }

let elapsed = 0
let last = performance.now()

// Seconds of animation so far, run at the backdrop's pace. Pauses (and later resumes seamlessly) under reduced motion.
export function sceneTime(): number {
  const now = performance.now()
  const dt = Math.min(0.25, (now - last) / 1000)
  last = now
  if (isReducedMotion()) return elapsed
  backdropPace.current += (backdropPace.target - backdropPace.current) * (1 - Math.exp(-2 * dt))
  elapsed += dt * backdropPace.current
  return elapsed
}

// Backdrop brightness (1 = full, lower on the board so cards stay legible). Eased by the backdrop
// each frame and read by the curtain copy, so both stay in step during the transition.
export const backdropDim = { target: 1, current: 1 }

// Dev-only handle for inspecting the clock from automation.
if (import.meta.env.DEV) {
  ;(window as unknown as { __sceneTime: typeof sceneTime }).__sceneTime = sceneTime
}
