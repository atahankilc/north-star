// Display preferences (D-063, D-417), saved per browser. `background: off` removes the flowing ASCII field behind the
// signed-in pages (the landing always keeps it) and stops its canvas, which saves most of the app's GPU work. How
// bright it is follows the page and the canvas's pieces, not a setting (D-385). `size` is the interface's size, 75–150 %
// (D-417, replacing D-348's hud size): every size token on the screen is multiplied by it, through `--ui-page` on <html>
// (tokens.css; index.html sets it before the first paint).
import { create } from 'zustand'
import { forgetTokens } from '../styles/cssToken'
import { UI_SIZE } from '../ui/foundation/feel'
import { keepLocal, readLocal } from './local'

export type BackgroundPref = 'on' | 'off'

const KEY = 'north-star.background'
const SIZE_KEY = 'north-star.ui-size'
// D-348's old steps, read once so a choice made there carries over.
const OLD_HUD_KEY = 'north-star.hud-size'
const OLD_HUD: Record<string, number> = { small: 90, large: 115 }

const clampSize = (n: number) =>
  Math.min(UI_SIZE.max, Math.max(UI_SIZE.min, Math.round(n / UI_SIZE.step) * UI_SIZE.step))

function readSize(): number {
  const v = Number(readLocal(SIZE_KEY))
  if (Number.isFinite(v) && v > 0) return clampSize(v)
  return OLD_HUD[readLocal(OLD_HUD_KEY) ?? ''] ?? UI_SIZE.normal
}

function applySize(size: number) {
  const root = document.documentElement
  if (size === UI_SIZE.normal) root.style.removeProperty('--ui-page')
  else root.style.setProperty('--ui-page', String(size / 100))
  forgetTokens()
}

type DisplayState = {
  background: BackgroundPref
  size: number
  setBackground: (pref: BackgroundPref) => void
  setSize: (percent: number) => void
}

const initialSize = readSize()
applySize(initialSize)

export const useDisplay = create<DisplayState>((set) => ({
  background: readLocal(KEY) === 'off' ? 'off' : 'on',
  size: initialSize,
  setBackground: (background) => {
    keepLocal(KEY, background)
    set({ background })
  },
  setSize: (percent) => {
    const size = clampSize(percent)
    keepLocal(SIZE_KEY, String(size))
    applySize(size)
    set({ size })
  },
}))
