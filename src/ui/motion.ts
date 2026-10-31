// Motion's foundation in TS (D-326; docs/foundation-audit-2026-10-31.md §3): the durations and easings CSS has as tokens
// (motionTokens.ts, re-exported here) and the one way to run a tween.
//
// Everything that moves by script goes through `tween()` (or `glideValues()` on top of it): one requestAnimationFrame
// loop, reduced motion inside it (the end state at once, D-063), a stop function back.
import { isReducedMotion } from '../state/motion'

export * from './motionTokens'
import { easeInOut, lerp, type Ease } from './motionTokens'

// Runs `frame(k)` every frame for `ms`, k from 0 to 1 through `ease` (in-out by default), then `onDone`. Reduced
// motion: `frame(1)` and `onDone` at once. The function back stops it where it is (no `onDone`).
export function tween(ms: number, frame: (k: number) => void, opts: { ease?: Ease; onDone?: () => void } = {}): () => void {
  const ease = opts.ease ?? easeInOut
  if (isReducedMotion() || ms <= 0) {
    frame(1)
    opts.onDone?.()
    return () => {}
  }
  const t0 = performance.now()
  let raf = 0
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / ms)
    frame(ease(p))
    if (p < 1) raf = requestAnimationFrame(step)
    else opts.onDone?.()
  }
  raf = requestAnimationFrame(step)
  return () => cancelAnimationFrame(raf)
}

// Numbers travelling from `from` to `to` together (a camera, a strip's first day), each frame's values to `apply`.
export function glideValues<T extends Record<string, number>>(from: T, to: T, ms: number, apply: (v: T) => void, opts: { ease?: Ease; onDone?: () => void } = {}) {
  const keys = Object.keys(to) as (keyof T)[]
  return tween(ms, (k) => apply(Object.fromEntries(keys.map((key) => [key, lerp(from[key], to[key], k)])) as T), opts)
}
