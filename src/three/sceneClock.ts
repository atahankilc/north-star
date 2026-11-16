// Shared state for every canvas that draws the ambient backdrop. The loading curtain draws a
// second copy on top of the page; both must render the identical frame, so nothing here may
// depend on per-canvas state (own clocks, pointer position, etc.).
import { isReducedMotion } from '../state/motion'
import { DUR, easeInOut, lerp } from '../ui/foundation/motionTokens'

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

// Backdrop brightness (1 = full, 0 = gone), read by the backdrop and by the curtain's copy, so both stay in step. It
// fades by time, not by frames (D-385): from where it is to the new target over DUR.backdropFade, eased in and out; at
// once under reduced motion. `stepBackdropDim()` moves it to now (a function of the time alone, so the backdrop and the
// curtain may both call it every frame and agree).
export const backdropDim = { target: 1, current: 1, from: 1, startedAt: 0 }

export function setBackdropTarget(target: number) {
  if (target === backdropDim.target) return
  backdropDim.from = backdropDim.current
  backdropDim.target = target
  backdropDim.startedAt = performance.now()
}

export function stepBackdropDim(now = performance.now()): number {
  const d = backdropDim
  const p = isReducedMotion() ? 1 : Math.min(1, (now - d.startedAt) / DUR.backdropFade)
  d.current = lerp(d.from, d.target, easeInOut(p))
  return d.current
}

export const backdropSettled = () => backdropDim.current === backdropDim.target

// How much of the field a canvas shows (D-385): full on the landing, the workspaces page and an empty canvas; about
// half with one piece on it; none from two pieces on, and then nothing of it runs at all (Backdrop unmounts).
export const BACKDROP_DIM_ONE_PIECE = 0.5 // tokens-ok: a brightness factor, not a size or colour

export function backdropLevel(pieces: number | null): number {
  if (!pieces) return 1
  return pieces === 1 ? BACKDROP_DIM_ONE_PIECE : 0
}

// Dev-only handle for inspecting the clock from automation.
if (import.meta.env.DEV) {
  ;(window as unknown as { __sceneTime: typeof sceneTime }).__sceneTime = sceneTime
}
