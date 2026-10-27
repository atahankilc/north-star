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
  // Bold words in a paragraph (D-156).
  fgStrong: string
  fgDim: string
  magenta: string
  cyan: string
  yellow: string
  blue: string
  green: string
  // A proposal's preview (D-096): new, edited, moved, deleted.
  diff: { new: string; edited: string; moved: string; deleted: string }
  // Links by what they say (linkKinds.ts, D-146), one colour per kind; `plain` is `relates`, the old neutral line.
  link: { solves: string; part: string; competes: string; clashes: string; draws: string; depends: string; plain: string; for: string }
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
  // A piece's surface (D-263): its fill, its head rows, what's held on it, its edge, its `+` marks.
  piece: { fill: string; head: string; card: string; edge: string; mark: string }
}

export const palettes: Record<Theme, Palette> = {
  dark: {
    ...colors,
    fgStrong: '#ffffff',
    diff: { new: '#a6ff3d', edited: '#ff9f1c', moved: '#3d7bff', deleted: '#ff4545' },
    link: { solves: '#a78bfa', part: '#6cb6ff', competes: '#ff9a52', clashes: '#ff5c86', draws: '#e3c77a', depends: '#9cc96a', plain: '#8a8a8a', for: '#d6d6d6' },
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
    piece: { fill: '#121315', head: '#17181b', card: '#1d1e22', edge: '#2f3136', mark: '#3b3e44' },
  },
  light: {
    bg: '#f5f5f5',
    fg: '#161616',
    fgStrong: '#000000',
    fgDim: '#6b6b6b',
    magenta: '#db1a7a',
    cyan: '#0a979c',
    yellow: '#a87d00',
    blue: '#2a5fe0',
    green: '#0f9a4b',
    diff: { new: '#4f9400', edited: '#c56a00', moved: '#2a5fe0', deleted: '#d42a2a' },
    link: { solves: '#6d4fd6', part: '#1f78c8', competes: '#c2600f', clashes: '#c41e4e', draws: '#94741c', depends: '#4c8a1c', plain: '#6e6e6e', for: '#2e2e2e' },
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
    piece: { fill: '#ffffff', head: '#f7f7f8', card: '#ffffff', edge: '#d4d5d8', mark: '#c9cbd0' },
  },
}

export const fonts = {
  mono: 'Geist Mono Variable',
  display: 'Geist Variable',
}
