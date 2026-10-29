// Colour theme (D-069): dark by default, light on request, or following the system. Saved per browser.
// Sets `data-theme` on <html> (tokens.css switches on it) and gives WebGL code the matching palette.
import { create } from 'zustand'
import { accents, palettes, type Palette, type Theme } from '../styles/tokens'

export type ThemePref = Theme | 'system'

const KEY = 'north-star.theme'
const query = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: light)') : null

function load(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'system') return v
  } catch {
    // Storage blocked: keep the default.
  }
  return 'dark'
}

function resolve(pref: ThemePref): Theme {
  return pref === 'system' ? (query?.matches ? 'light' : 'dark') : pref
}

function apply(theme: Theme) {
  const root = document.documentElement
  root.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palettes[theme].bg)
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme)
}

type ThemeState = {
  pref: ThemePref
  theme: Theme
  setPref: (pref: ThemePref) => void
}

const initial = load()

export const useTheme = create<ThemeState>((set) => ({
  pref: initial,
  theme: resolve(initial),
  setPref: (pref) => {
    try {
      localStorage.setItem(KEY, pref)
    } catch {
      // Not persisted; still applies for this session.
    }
    set({ pref, theme: resolve(pref) })
  },
}))

apply(useTheme.getState().theme)
useTheme.subscribe((s, prev) => {
  if (s.theme !== prev.theme) apply(s.theme)
})
query?.addEventListener('change', () => {
  const { pref, theme } = useTheme.getState()
  const next = resolve(pref)
  if (next !== theme) useTheme.setState({ theme: next })
})

// WebGL's colours in the theme shown (D-321); the DOM's come from tokens.css.
export function usePalette(): Palette {
  return palettes[useTheme((s) => s.theme)]
}

const ACCENT_KEYS = ['magenta', 'cyan', 'yellow', 'blue', 'green'] as const

// A presence colour (always a dark-theme accent) in the current theme's shade; other colours pass through.
export function themeAccent(hex: string, theme: Theme = useTheme.getState().theme): string {
  const i = accents.indexOf(hex as (typeof accents)[number])
  return i < 0 ? hex : palettes[theme][ACCENT_KEYS[i]]
}

export function useThemeAccent() {
  const theme = useTheme((s) => s.theme)
  return (hex: string) => themeAccent(hex, theme)
}
