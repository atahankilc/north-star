// The evals' `render` for `look` and the picture judge (D-327 phase 2): an SVG drawn by resvg (a dev dependency) into a
// PNG, in Geist (evals/fonts: the static TTFs, as resvg reads no woff2), the system's fonts after it. Where resvg can't
// load (an unsupported platform), null: the tool answers in words.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import type { ImagePart } from '../src/agent/contract'
import { PICTURE_FONT } from '../src/agent/picture'

const FONTS = ['Geist-Regular.ttf', 'Geist-Bold.ttf'].map((f) => fileURLToPath(new URL(`./fonts/${f}`, import.meta.url)))

let resvg: Promise<typeof import('@resvg/resvg-js') | null> | null = null

// Node's own require: `npm run eval` loads this file through Vite's module runner, whose import can't load resvg's
// native binding (every picture came back null, so `look` answered in words and the picture judge was skipped).
const load = async (): Promise<typeof import('@resvg/resvg-js') | null> => {
  try {
    return createRequire(import.meta.url)('@resvg/resvg-js') as typeof import('@resvg/resvg-js')
  } catch {
    return import('@resvg/resvg-js').catch(() => null)
  }
}

export async function nodeRender(svg: string, size: { w: number; h: number }): Promise<ImagePart | null> {
  resvg ??= load()
  const m = await resvg
  if (!m) return null
  try {
    const png = new m.Resvg(svg, { fitTo: { mode: 'width', value: size.w }, font: { fontFiles: FONTS, loadSystemFonts: true, defaultFontFamily: PICTURE_FONT, sansSerifFamily: PICTURE_FONT } }).render().asPng()
    return { mediaType: 'image/png', data: Buffer.from(png).toString('base64') }
  } catch {
    return null
  }
}
