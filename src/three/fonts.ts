// Static .woff files for SDF text in the 3D scene: troika can't read the variable .woff2 the DOM uses.
import geistMedium from '@fontsource/geist/files/geist-latin-500-normal.woff?url'
import geistMono from '@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff?url'

export const fontUrls = {
  display: geistMedium,
  mono: geistMono,
}
