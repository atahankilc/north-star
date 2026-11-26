// `look`'s pictures on the server (D-327, D-434): resvg, in Inter (static TTFs beside the build), as the evals draw them.
// Loaded only when a picture is asked for; where it can't load, the tool answers in words.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ImagePart } from '../../../src/agent/contract'
import { PICTURE_FONT } from '../../../src/agent/picture'

const FONTS = ['Inter-Regular.ttf', 'Inter-Bold.ttf'].map((f) => fileURLToPath(new URL(`./fonts/${f}`, import.meta.url)))

let resvg: Promise<typeof import('@resvg/resvg-js') | null> | null = null

export async function serverRender(svg: string, size: { w: number; h: number }): Promise<ImagePart | null> {
  resvg ??= import('@resvg/resvg-js').catch(() => null)
  const m = await resvg
  if (!m) return null
  try {
    const fontFiles = FONTS.filter((f) => existsSync(f))
    const png = new m.Resvg(svg, { fitTo: { mode: 'width', value: size.w }, font: { fontFiles, loadSystemFonts: !fontFiles.length, defaultFontFamily: PICTURE_FONT, sansSerifFamily: PICTURE_FONT } }).render().asPng()
    return { mediaType: 'image/png', data: Buffer.from(png).toString('base64') }
  } catch {
    return null
  }
}
