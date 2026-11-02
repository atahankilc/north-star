// How the app feels to handle (D-325): the numbers behind a press, a drag, a wheel zoom and a stick, in one place so every
// view and the onboarding read the same ones. Durations and easings are in motionTokens.ts (D-326); sizes in tokens.css
// and model/world.ts.

// A press that moved this far (screen px) is a drag: a pan, a piece, a card, a cell, a task, a box (D-150, D-217).
export const DRAG_PX = 5

// The zoom's range, on the canvas, in a focus and beside it (D-186).
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 4

// One wheel step's zoom: a pinch (ctrl, a trackpad) moves faster than a mouse wheel.
const WHEEL = 0.0015
const PINCH = 0.01
export const wheelStep = (zoom: number, e: { deltaY: number; ctrlKey: boolean }) =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * Math.exp(-e.deltaY * (e.ctrlKey ? PINCH : WHEEL))))

// Sticking's reach (48 screen px, D-210) is STICK_REACH in model/pieceMoves.ts: the agent's ops read it too.

// Typing on the canvas is kept as it's typed: a pause this long (ms) writes what's there (the user lost ten minutes of
// writing to an Escape, 2026-11-01).
export const AUTOSAVE_MS = 500

// Untouched this long (ms), someone is shown as away to the others (D-331); a hidden tab is away at once.
export const AWAY_AFTER_MS = 5 * 60_000

// A console past this share of the width it hangs on takes the whole edge and wraps, never shrinking or hiding a tool
// (D-347, the user: "belki console yer yoksa tam alan kaplayabilir").
export const CONSOLE_FILL = 0.7

// A Select's list gets the prompt's `>` line past this many options; a shorter one jumps by a first letter (D-093, D-350).
export const SELECT_FIND_PAST = 7
