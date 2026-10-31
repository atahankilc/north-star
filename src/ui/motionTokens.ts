// Motion's numbers (D-326): the durations and easings tokens.css has as `--dur-*` and `--ease-*`, for script. Pure (no
// browser, no store), so code that runs in node (the ops layer, the agent, tests) reads them too; src/ui/motion.ts
// re-exports them with the tween. tests/unit/motion.test.ts holds them to tokens.css.

// Milliseconds. Each one with a CSS token is that token's value (the test checks it); `glide` and `exit` are script's
// own until they get one.
export const DUR = {
  press: 70,
  snap: 120,
  quick: 160,
  fast: 200,
  decode: 260,
  spring: 300,
  cells: 320,
  med: 400,
  // A camera or a view travelling to where it's going (fit, go to, a card picked from a list).
  glide: 420,
  slow: 600,
  blink: 1000,
  intro: 10000,
  // A component breaking cell by cell on its way out: 0.6 of its build-up (Appear's exit).
  exit: 192,
  // A piece's console appearing and leaving, cell by cell (D-264).
  consoleIn: 170,
  consoleOut: 90,
  // A plane spreading into focus like ink, and drawing back (D-185, D-297).
  focusIn: 820,
  focusOut: 700,
} as const

// A CSS cubic-bezier as a function of progress, so script eases exactly as the tokens do.
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const at = (a: number, b: number, t: number) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t
  const slope = (a: number, b: number, t: number) => 3 * (1 - 3 * b + 3 * a) * t * t + 2 * (3 * b - 6 * a) * t + 3 * a
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    // Newton's steps for the t whose curve x is `x`, then bisection if the slope is too flat.
    let t = x
    for (let i = 0; i < 8; i++) {
      const s = slope(x1, x2, t)
      if (Math.abs(s) < 1e-6) break
      const e = at(x1, x2, t) - x
      if (Math.abs(e) < 1e-6) return at(y1, y2, t)
      t -= e / s
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 30; i++) {
      const e = at(x1, x2, t) - x
      if (Math.abs(e) < 1e-6) break
      if (e > 0) hi = t
      else lo = t
      t = (lo + hi) / 2
    }
    return at(y1, y2, t)
  }
}

// The tokens' control points (tokens.css `--ease-out`, `--ease-in-out`), and the curves.
export const EASE_POINTS = { out: [0.16, 1, 0.3, 1], inOut: [0.65, 0, 0.35, 1] } as const
export const easeOut = cubicBezier(...EASE_POINTS.out)
// `--ease-in-out` is the cubic in-out curve; its closed form, so a camera glide costs nothing to ease.
export const easeInOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k

export type Ease = (t: number) => number
