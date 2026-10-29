// Whether the agent is driving the view (S9, R11): true while any call of the UI facade (src/agent/ui.ts) runs and for
// a short while after the last one settles, so what the view does in answer (a focus arriving, a panel opening) isn't
// taken for the person's own doing; onboarding reads it to skip lessons the agent set off. Module state, no React, no
// imports: anything may read it.
export const SETTLE_MS = 500

let running = 0
let settled = -Infinity

export function agentDriving(now = Date.now()): boolean {
  return running > 0 || now - settled < SETTLE_MS
}

// Runs `f` as the agent's: counted while it runs (sync or async), the settle time starting when it ends either way.
export function driving<T>(f: () => T): T {
  running++
  const done = () => {
    running--
    settled = Date.now()
  }
  let out: T
  try {
    out = f()
  } catch (e) {
    done()
    throw e
  }
  if (out instanceof Promise) return out.finally(done) as T
  done()
  return out
}

// One call at a time (S9 review): each facade call waits for the one before it to settle (a failed one doesn't stop the
// next), and counts as driving from the moment it's asked, so agentDriving() stays true across the queue.
let tail: Promise<unknown> = Promise.resolve()
export function queued<T>(f: () => Promise<T>): Promise<T> {
  return driving(() => {
    const p = tail.then(() => f())
    tail = p.catch(() => undefined)
    return p
  })
}
