// Display preferences (D-063), saved per browser. `background: off` removes the flowing ASCII field behind the
// signed-in pages (the landing always keeps it) and stops its canvas, which saves most of the app's GPU work.
import { create } from 'zustand'

export type BackgroundPref = 'on' | 'off'

const KEY = 'north-star.background'

function load(): BackgroundPref {
  try {
    if (localStorage.getItem(KEY) === 'off') return 'off'
  } catch {
    // Storage blocked: keep the default.
  }
  return 'on'
}

type DisplayState = {
  background: BackgroundPref
  setBackground: (pref: BackgroundPref) => void
}

export const useDisplay = create<DisplayState>((set) => ({
  background: load(),
  setBackground: (background) => {
    try {
      localStorage.setItem(KEY, background)
    } catch {
      // Not persisted; still applies for this session.
    }
    set({ background })
  },
}))
