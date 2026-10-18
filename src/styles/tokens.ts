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

// Everything the board and the backdrop draw in WebGL, per theme (D-069). Mirror tokens.css.
export type Palette = {
  bg: string
  fg: string
  fgDim: string
  magenta: string
  cyan: string
  yellow: string
  blue: string
  green: string
  // A proposal's preview (D-096): new, edited, moved, deleted.
  diff: { new: string; edited: string; moved: string; deleted: string }
  // Links by what they say (linkKinds.ts); `plain` is the old neutral line.
  link: { solves: string; clashes: string; draws: string; plain: string }
  ember: string // welcome sunrise (D-072), WebGL only
  dawn: string
  night: string // the welcome's sky in light theme (D-072); dark never uses it
  dusk: string // the light blue the night falls through on its way in and out
  card: string
  cardBehind: string
  chip: string
  hairline: string
  hover: string
  edge: string
  edgeFaint: string
  edgeLabel: string
  grid: number
}

export const palettes: Record<Theme, Palette> = {
  dark: {
    ...colors,
    diff: { new: '#a6ff3d', edited: '#ff9f1c', moved: '#3d7bff', deleted: '#ff4545' },
    link: { solves: '#a78bfa', clashes: '#ff8f7a', draws: '#c9b48a', plain: '#7a7a7a' },
    ember: '#ff4a26',
    dawn: '#ff9a2e',
    night: '#000000',
    dusk: '#000000',
    card: '#121212',
    cardBehind: '#0e0e0e',
    chip: '#161616',
    hairline: '#2a2a2a',
    hover: '#5a5a5a',
    edge: '#6a6a6a',
    edgeFaint: '#3a3a3a',
    edgeLabel: '#8a8a8a',
    grid: 0.3,
  },
  light: {
    bg: '#f5f5f5',
    fg: '#161616',
    fgDim: '#6b6b6b',
    magenta: '#db1a7a',
    cyan: '#0a979c',
    yellow: '#a87d00',
    blue: '#2a5fe0',
    green: '#0f9a4b',
    diff: { new: '#4f9400', edited: '#c56a00', moved: '#2a5fe0', deleted: '#d42a2a' },
    link: { solves: '#6d4fd6', clashes: '#c4513a', draws: '#8a7344', plain: '#7a7a7a' },
    // Same as dark: the ASCII pass prints brightness as ink and darkens the hue itself, so darker values would barely show.
    ember: '#ff4a26',
    dawn: '#ff9a2e',
    night: '#0c1736',
    dusk: '#9fb3e3',
    card: '#ffffff',
    cardBehind: '#e9e9e9',
    chip: '#fafafa',
    hairline: '#d9d9d9',
    hover: '#9a9a9a',
    edge: '#8a8a8a',
    edgeFaint: '#c6c6c6',
    edgeLabel: '#5e5e5e',
    grid: 0.72,
  },
}

export const fonts = {
  mono: 'Geist Mono Variable',
  display: 'Geist Variable',
}
