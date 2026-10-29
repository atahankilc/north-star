// Which look each coach frame is drawn in (D-315, Q-028): every option of docs/specs/onboarding-preview/ is built, the
// recommended one the default, until the user picks; then the others are deleted with this file. Dev only: production
// always gets the defaults, and the switch (`?look=welcome:b,lesson:c` or `window.__onboardingLook`) isn't in its build.
import { useSyncExternalStore } from 'react'

export type Frame = 'welcome' | 'lesson' | 'kind' | 'guide'
export type Look = 'a' | 'b' | 'c'
export type Looks = Record<Frame, Look>

export const DEFAULT_LOOKS: Looks = { welcome: 'a', lesson: 'a', kind: 'a', guide: 'a' }

const FRAMES = Object.keys(DEFAULT_LOOKS) as Frame[]
const isLook = (x: unknown): x is Look => x === 'a' || x === 'b' || x === 'c'

// `welcome:b,lesson:c` → the looks it names, the rest left as they were.
export function parseLooks(s: string, base: Looks = DEFAULT_LOOKS): Looks {
  const out = { ...base }
  for (const part of s.split(',')) {
    const [f, l] = part.split(':').map((x) => x.trim())
    if (FRAMES.includes(f as Frame) && isLook(l)) out[f as Frame] = l
  }
  return out
}

let looks: Looks = DEFAULT_LOOKS
const listeners = new Set<() => void>()
const set = (next: Looks) => {
  looks = next
  listeners.forEach((fn) => fn())
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const q = new URLSearchParams(window.location.search).get('look')
  if (q) looks = parseLooks(q)
  // `window.__onboardingLook = { welcome: 'b' }` switches live; reading it gives the looks in use.
  Object.defineProperty(window, '__onboardingLook', {
    configurable: true,
    get: () => looks,
    set: (v: Partial<Looks>) => set(parseLooks(Object.entries(v ?? {}).map(([f, l]) => `${f}:${l}`).join(','), looks)),
  })
}

export const getLook = (f: Frame): Look => looks[f]

export function useLook(f: Frame): Look {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => looks[f],
  )
}
