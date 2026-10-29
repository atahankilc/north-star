// The demo realm's clock, its typed face (D-315, docs/specs/onboarding.md §6.2 "Clock"). The clock itself is a plain
// script in demo.html, so it's in place before any module runs (the build hoists a module's library imports above its own
// code, so a module couldn't be first): performance.now, requestAnimationFrame and the timers there run on a virtual
// clock that moves only when the director steps it; Date reads a fixed day plus the scene's time; Math.random is seeded
// again as each scene starts. Here: what the director uses of it, and the parts that may load later (CSS animations held
// with the clock, a real macrotask for React to draw in).

type DemoClock = {
  real: { now: () => number; raf: (cb: FrameRequestCallback) => number; caf: (id: number) => void; setTimeout: (fn: () => void, ms: number) => number; Date: DateConstructor }
  day: number
  step: (dt: number) => void
  restart: () => void
  sceneTime: () => number
}
const clock = (window as unknown as { __demoClock?: DemoClock }).__demoClock
if (!clock) throw new Error('the demo clock (demo.html) is missing')

export const realClock = clock.real
// The made-up "now" every scene is set at (the Pazar fixture's day): Tuesday 20 October 2026, 10:30 in Berlin.
export const DEMO_DAY = clock.day
// The scene starts (again): its time 0 is now, the random numbers from the start.
export const restart = clock.restart
// The scene's time, ms.
export const sceneTime = clock.sceneTime
// Moves the clock on by `dt` ms: the timers that came due in order, then one frame for everything waiting on one.
export const step = clock.step

// CSS animations held with the clock: paused, moved along by hand. `held` false gives them back to the browser.
const managed = new Set<Animation>()
export function stepAnimations(dt: number) {
  for (const a of document.getAnimations()) {
    if (!managed.has(a)) {
      managed.add(a)
      a.pause()
    }
    a.currentTime = Number(a.currentTime ?? 0) + dt
  }
}
export function releaseAnimations() {
  for (const a of managed) if (a.playState === 'paused') a.play()
  managed.clear()
}
// Every running CSS animation to its end (a scene starting over: nothing carried in from before).
export function finishAnimations() {
  for (const a of document.getAnimations()) {
    try {
      a.finish()
    } catch {
      a.cancel()
    }
  }
  managed.clear()
}

// A real macrotask, for React to draw what a step changed (its scheduler posts messages, never timers).
const channel = new MessageChannel()
const waiting: (() => void)[] = []
channel.port1.onmessage = () => waiting.shift()?.()
export const yieldTask = () =>
  new Promise<void>((r) => {
    waiting.push(r)
    channel.port2.postMessage(0)
  })
