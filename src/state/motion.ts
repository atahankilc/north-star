// Motion preference: full motion (default, D-063), reduced, or follow the OS.
// Saved per browser. Everything that animates reads `reduced` from here, never the media query directly.
import { create } from 'zustand'
import { keepLocal, readLocal } from './local'

export type MotionPref = 'system' | 'full' | 'reduced'

const KEY = 'north-star.motion'
const media = window.matchMedia('(prefers-reduced-motion: reduce)')

function load(): MotionPref {
  const v = readLocal(KEY)
  if (v === 'system' || v === 'full' || v === 'reduced') return v
  // Full unless you choose otherwise: the OS setting only counts once you pick `system`.
  return 'full'
}

const resolve = (pref: MotionPref, systemReduced: boolean) => pref === 'reduced' || (pref === 'system' && systemReduced)

type MotionState = {
  pref: MotionPref
  systemReduced: boolean
  reduced: boolean
  setPref: (pref: MotionPref) => void
}

const initial = load()

export const useMotion = create<MotionState>((set, get) => ({
  pref: initial,
  systemReduced: media.matches,
  reduced: resolve(initial, media.matches),
  setPref: (pref) => {
    keepLocal(KEY, pref)
    set({ pref, reduced: resolve(pref, get().systemReduced) })
  },
}))

media.addEventListener('change', () =>
  useMotion.setState((s) => ({ systemReduced: media.matches, reduced: resolve(s.pref, media.matches) })),
)

export const isReducedMotion = () => useMotion.getState().reduced

// CSS hook: html[data-motion='reduced'] switches off CSS transitions (global.css).
const reflect = (reduced: boolean) => (document.documentElement.dataset.motion = reduced ? 'reduced' : 'full')
reflect(useMotion.getState().reduced)
useMotion.subscribe((s) => reflect(s.reduced))
