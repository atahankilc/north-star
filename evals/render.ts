// The evals' `render` for `look` and the picture judge (D-327 phase 2): an SVG drawn by resvg (a dev dependency) into a
// PNG, with the system's fonts. Where resvg can't load (an unsupported platform), null: the tool answers in words.
import type { ImagePart } from '../src/agent/contract'

let resvg: Promise<typeof import('@resvg/resvg-js') | null> | null = null

export async function nodeRender(svg: string, size: { w: number; h: number }): Promise<ImagePart | null> {
  resvg ??= import('@resvg/resvg-js').catch(() => null)
  const m = await resvg
  if (!m) return null
  try {
    const png = new m.Resvg(svg, { fitTo: { mode: 'width', value: size.w }, font: { loadSystemFonts: true } }).render().asPng()
    return { mediaType: 'image/png', data: Buffer.from(png).toString('base64') }
  } catch {
    return null
  }
}
