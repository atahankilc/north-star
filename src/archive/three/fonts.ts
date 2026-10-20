// Static .woff files for SDF text in the 3D scene: troika can't read the variable .woff2 the DOM uses.
import geistMedium from '@fontsource/geist/files/geist-latin-500-normal.woff?url'
import geistMediumItalic from '@fontsource/geist/files/geist-latin-500-italic.woff?url'
import geistBold from '@fontsource/geist/files/geist-latin-700-normal.woff?url'
import geistBoldItalic from '@fontsource/geist/files/geist-latin-700-italic.woff?url'
import geistMono from '@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff?url'
import geistMonoItalic from '@fontsource/geist-mono/files/geist-mono-latin-400-italic.woff?url'
import geistMonoBold from '@fontsource/geist-mono/files/geist-mono-latin-700-normal.woff?url'
import geistMonoBoldItalic from '@fontsource/geist-mono/files/geist-mono-latin-700-italic.woff?url'

export const fontUrls = {
  display: geistMedium,
  mono: geistMono,
}

// Text written on the board can be bold and italic (D-130): the real faces, loaded only when something uses them.
const FACES = {
  display: [geistMedium, geistMediumItalic, geistBold, geistBoldItalic],
  mono: [geistMono, geistMonoItalic, geistMonoBold, geistMonoBoldItalic],
}
// Every face text on the board can use, so they can all be loaded before it's drawn.
export const ALL_FACES = [...FACES.display, ...FACES.mono]
export const faceUrl = (family: 'display' | 'mono', bold = false, italic = false) => FACES[family][(bold ? 2 : 0) + (italic ? 1 : 0)]
