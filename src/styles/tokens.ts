// JS mirror of tokens.css for three.js materials and shaders.
export const colors = {
  bg: '#000000',
  fgDim: '#6b6b6b',
  fg: '#e8e8e8',
  magenta: '#ff3d9a',
  cyan: '#2de2e6',
  yellow: '#ffd23f',
  blue: '#3d7bff',
  green: '#3dff8a',
} as const

// Presence colours are always these dark-theme values: they identify a person and are compared across clients.
// Draw them through `themeAccent()` (src/state/theme.ts) to get the current theme's version.
export const accents = [colors.magenta, colors.cyan, colors.yellow, colors.blue, colors.green]

export type Theme = 'dark' | 'light'

// What WebGL draws, per theme (D-069, D-321): the backdrop's page and sky, its accents and the welcome's sunrise; the
// accents are also how a presence colour shows in the theme (themeAccent). Read it through usePalette()
// (src/state/theme.ts). Everything else is DOM and comes from tokens.css; mirror a change there.
export type Palette = {
  bg: string
  magenta: string
  cyan: string
  yellow: string
  blue: string
  green: string
  ember: string // welcome sunrise (D-072), WebGL only
  dawn: string
  night: string // the welcome's sky in light theme (D-072); dark never uses it
  dusk: string // the light blue the night falls through on its way in and out
}

export const palettes: Record<Theme, Palette> = {
  dark: {
    bg: colors.bg,
    magenta: colors.magenta,
    cyan: colors.cyan,
    yellow: colors.yellow,
    blue: colors.blue,
    green: colors.green,
    ember: '#ff4a26',
    dawn: '#ff9a2e',
    night: '#000000',
    dusk: '#000000',
  },
  light: {
    bg: '#f5f5f5',
    magenta: '#db1a7a',
    cyan: '#0a979c',
    yellow: '#a87d00',
    blue: '#2a5fe0',
    green: '#0f9a4b',
    // Same as dark: the ASCII pass prints brightness as ink and darkens the hue itself, so darker values would barely show.
    ember: '#ff4a26',
    dawn: '#ff9a2e',
    night: '#0c1736',
    dusk: '#9fb3e3',
  },
}

export const fonts = {
  mono: 'Geist Mono Variable',
  display: 'Geist Variable',
}
