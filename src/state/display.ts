// Display preferences (D-063, D-348), saved per browser. `background: off` removes the flowing ASCII field behind the
// signed-in pages (the landing always keeps it) and stops its canvas, which saves most of the app's GPU work.
// `strength` makes that field softer or stronger on the signed-in pages (the landing keeps its own). `hud` sizes the
// HUD's tools, squares and breadcrumb, through `data-hud` on <html> (tokens.css; index.html sets it before the first paint).
import { create } from 'zustand'

export type BackgroundPref = 'on' | 'off'
export type StrengthPref = 'soft' | 'normal' | 'strong'
export type HudSizePref = 'small' | 'normal' | 'large'

const KEY = 'north-star.background'
const STRENGTH_KEY = 'north-star.backdrop-strength'
const HUD_KEY = 'north-star.hud-size'

// How bright the field is drawn for each step, times the page's own dim (D-346). Strong lifts the faint glyphs that
// some screens crush to black (Q-033, closed by this setting).
export const STRENGTH_FACTOR: Record<StrengthPref, number> = { soft: 0.7, normal: 1, strong: 1.35 } // tokens-ok: brightness factors, not sizes or colours

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    if (v && (allowed as readonly string[]).includes(v)) return v as T
  } catch {
    // Storage blocked: keep the default.
  }
  return fallback
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not persisted; still applies for this session.
  }
}

function applyHud(size: HudSizePref) {
  const root = document.documentElement
  if (size === 'normal') delete root.dataset.hud
  else root.dataset.hud = size
}

type DisplayState = {
  background: BackgroundPref
  strength: StrengthPref
  hud: HudSizePref
  setBackground: (pref: BackgroundPref) => void
  setStrength: (pref: StrengthPref) => void
  setHud: (pref: HudSizePref) => void
}

const initialHud = read<HudSizePref>(HUD_KEY, ['small', 'normal', 'large'], 'normal')
applyHud(initialHud)

export const useDisplay = create<DisplayState>((set) => ({
  background: read<BackgroundPref>(KEY, ['on', 'off'], 'on'),
  strength: read<StrengthPref>(STRENGTH_KEY, ['soft', 'normal', 'strong'], 'normal'),
  hud: initialHud,
  setBackground: (background) => {
    save(KEY, background)
    set({ background })
  },
  setStrength: (strength) => {
    save(STRENGTH_KEY, strength)
    set({ strength })
  },
  setHud: (hud) => {
    save(HUD_KEY, hud)
    applyHud(hud)
    set({ hud })
  },
}))
