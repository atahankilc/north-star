// JS mirror of tokens.css for three.js materials and shaders, held to it by tests/unit/sameLists.test.ts (D-391).
export const colors = {
  bg: '#000000',
  fgDim: '#8a8a8a',
  fg: '#ededed',
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

// What WebGL draws, per theme (D-069, D-321): the backdrop's page and its accents; the
// accents are also how a presence colour shows in the theme (themeAccent). Read it through usePalette()
// (src/state/theme.ts). Everything else is DOM and comes from tokens.css; mirror a change there.
export type Palette = {
  bg: string
  magenta: string
  cyan: string
  yellow: string
  blue: string
  green: string
}

export const palettes: Record<Theme, Palette> = {
  dark: {
    bg: colors.bg,
    magenta: colors.magenta,
    cyan: colors.cyan,
    yellow: colors.yellow,
    blue: colors.blue,
    green: colors.green,
  },
  light: {
    bg: '#f3f3f3',
    magenta: '#e00070',
    cyan: '#0095ad',
    yellow: '#b47500',
    blue: '#1955ff',
    green: '#009a43',
  },
}

export const fonts = {
  mono: 'JetBrains Mono Variable',
  display: 'Inter Variable',
}
