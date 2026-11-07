// Display preferences (D-063, D-348), saved per browser. `background: off` removes the flowing ASCII field behind the
// signed-in pages (the landing always keeps it) and stops its canvas, which saves most of the app's GPU work. How
// bright it is follows the page and the canvas's pieces, not a setting (D-385). `hud` sizes the HUD's tools, squares
// and breadcrumb, through `data-hud` on <html> (tokens.css; index.html sets it before the first paint).
import { create } from 'zustand'
import { keepLocal, readLocal } from './local'

export type BackgroundPref = 'on' | 'off'
export type HudSizePref = 'small' | 'normal' | 'large'

const KEY = 'north-star.background'
const HUD_KEY = 'north-star.hud-size'

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const v = readLocal(key)
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

const save = (key: string, value: string) => keepLocal(key, value)

function applyHud(size: HudSizePref) {
  const root = document.documentElement
  if (size === 'normal') delete root.dataset.hud
  else root.dataset.hud = size
}

type DisplayState = {
  background: BackgroundPref
  hud: HudSizePref
  setBackground: (pref: BackgroundPref) => void
  setHud: (pref: HudSizePref) => void
}

const initialHud = read<HudSizePref>(HUD_KEY, ['small', 'normal', 'large'], 'normal')
applyHud(initialHud)

export const useDisplay = create<DisplayState>((set) => ({
  background: read<BackgroundPref>(KEY, ['on', 'off'], 'on'),
  hud: initialHud,
  setBackground: (background) => {
    save(KEY, background)
    set({ background })
  },
  setHud: (hud) => {
    save(HUD_KEY, hud)
    applyHud(hud)
    set({ hud })
  },
}))
