// The onboarding's emitter (D-315, docs/specs/onboarding.md §5.5): `learn(event, payload)`, the one-line hook a view
// calls where no store knows what happened (O6), and what every watcher in events.ts sends through. On its own so the
// pages that call it (the workspaces page is in the first chunk) don't load the watchers. The same event with the same
// payload within DEDUPE_MS is dropped (React's double mounts, a store set twice).
import type { LessonEvent } from './lessons'
import type { LearnEvent, Payload } from './queue'

export const DEDUPE_MS = 150

const listeners = new Set<(e: LearnEvent) => void>()
const lastSent = new Map<string, number>()
let clock: () => number = () => Date.now()

export function onLearn(fn: (e: LearnEvent) => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

// `target`: what it was about (`card:<id>`, `plane:<id>`…), where its lesson looks for its anchor first.
export function learn(event: LessonEvent, payload?: Payload, target?: string): void {
  const key = `${event} ${payload ? JSON.stringify(payload) : ''}`
  const now = clock()
  const was = lastSent.get(key)
  if (was !== undefined && now - was < DEDUPE_MS) return
  lastSent.set(key, now)
  if (lastSent.size > 200) for (const [k, t] of lastSent) if (now - t > DEDUPE_MS) lastSent.delete(k)
  const e: LearnEvent = { event, ...(payload ? { payload } : {}), ...(target ? { target } : {}) }
  for (const fn of [...listeners]) {
    try {
      fn(e)
    } catch {
      // A listener's mistake never breaks the app.
    }
  }
}

// The watchers' clock (tests drive it); a new one forgets what was sent.
export function setLearnClock(now: () => number) {
  clock = now
  lastSent.clear()
}
