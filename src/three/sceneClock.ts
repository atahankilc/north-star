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

// Light theme only (D-072): the welcome's dark-blue sky, on the landing only (signed out; signed-in pages see the intro on paper).
// Landing starts it when the page is revealed, so it sweeps in with every other entrance; it sweeps out from NIGHT_OUT_AT, once
// the stars have gone and the flow has mostly taken over. Both ways eight tones cross the screen diagonally (AsciiEffect).
export const NIGHT_OUT_AT = 8.4
export const NIGHT_IN = 0.8
export const NIGHT_OUT = 0.8
const NIGHT_SPREAD = 1.4 // from the first tone's sweep to the last's, in screen diagonals; AsciiEffect's shader uses the same
let nightFrom: number | null = null

export function startNight() {
  if (nightFrom === null && introTime() < NIGHT_OUT_AT) nightFrom = introTime()
}
export function stopNight() {
  nightFrom = null
}

// Progress (0–1) of the sweep in and the sweep out.
export function introNight(t = introTime()): { sweepIn: number; sweepOut: number } {
  if (nightFrom === null) return { sweepIn: 0, sweepOut: 0 }
  const clamp = (x: number) => Math.min(Math.max(x, 0), 1)
  return { sweepIn: clamp((t - nightFrom) / NIGHT_IN), sweepOut: clamp((t - NIGHT_OUT_AT) / NIGHT_OUT) }
}

// When (0–1 of a sweep) the spot at this diagonal position (0 bottom left, 1 top right) is half way through its tones.
export function nightHalfway(position: number): number {
  return (position + NIGHT_SPREAD / 2) / (1 + NIGHT_SPREAD)
}

// Backdrop brightness (1 = full, lower on the board so cards stay legible). Eased by the backdrop
// each frame and read by the curtain copy, so both stay in step during the transition.
export const backdropDim = { target: 1, current: 1 }

// Dev-only handle for inspecting the clock from automation.
if (import.meta.env.DEV) {
  ;(window as unknown as { __sceneTime: typeof sceneTime }).__sceneTime = sceneTime
}
