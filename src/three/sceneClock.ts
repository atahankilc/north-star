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

// The welcome intro (D-072): night sky filling with stars → one bright star → the usual flow, in the first INTRO_SECONDS of the
// scene clock. Skipped when the app starts under reduced motion (the frozen clock would hold an empty sky).
export const INTRO_SECONDS = 10
let introSkipped: boolean | null = null

// Seconds into the intro; INTRO_SECONDS or more means it's over.
export function introTime(): number {
  introSkipped ??= isReducedMotion()
  return introSkipped ? INTRO_SECONDS : Math.min(sceneTime(), INTRO_SECONDS)
}

// Light theme only (D-072): how dark-blue the sky is during the welcome. Paper → night over the first second, back to
// paper while the sky melts into the flow (the same 6.2–9.8 s as the shader's crossfade).
export function introNight(t = introTime()): number {
  const ease = (a: number, b: number, x: number) => {
    const k = Math.min(Math.max((x - a) / (b - a), 0), 1)
    return k * k * (3 - 2 * k)
  }
  return ease(0, 1.2, t) * (1 - ease(6.2, 9.8, t))
}

// Backdrop brightness (1 = full, lower on the board so cards stay legible). Eased by the backdrop
// each frame and read by the curtain copy, so both stay in step during the transition.
export const backdropDim = { target: 1, current: 1 }

// Dev-only handle for inspecting the clock from automation.
if (import.meta.env.DEV) {
  ;(window as unknown as { __sceneTime: typeof sceneTime }).__sceneTime = sceneTime
}
