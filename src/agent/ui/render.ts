// The browser's `render` for the agent's `look` (D-327 phase 2): an SVG drawn on a canvas, read back as a PNG (base64).
// Nothing leaves the browser here; the PNG goes to the model with the tool's result, and nowhere else.
// An SVG drawn as an image can't see the page's web fonts, so Geist goes inside it: the app's own files (latin and
// latin-ext), as data URLs, fetched once. Two family names, not one split by unicode-range: Chrome loads a ranged face
// only once a letter needs it, after the image is drawn, and then draws no text at all (ğ, ş, İ in a title).
import latin from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url'
import latinExt from '@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2?url'
import type { ImagePart } from '../contract'
import { PICTURE_FONT } from '../picture'

const FACES = [
  { family: PICTURE_FONT, url: latin },
  { family: `${PICTURE_FONT} Ext`, url: latinExt },
]

const dataUrl = (blob: Blob) =>
  new Promise<string>((done, fail) => {
    const r = new FileReader()
    r.onload = () => done(String(r.result))
    r.onerror = () => fail(r.error)
    r.readAsDataURL(blob)
  })

const svgImage = async (svg: string) => {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

const PROBE_PX = 40 // tokens-ok: the probe's own canvas, never shown
const PROBE_MS = 1500 // tokens-ok: how long the first picture waits for Geist at most

// Chrome decodes an image's embedded font after the image itself (~40 ms) and draws no text until then; once one image
// has shown it, the next ones draw at once. So the first picture waits for a probe's letters (both faces) to appear.
async function warm(defs: string) {
  const probe = await svgImage(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PROBE_PX}" height="${PROBE_PX}">${defs}<text x="0" y="${PROBE_PX / 2}" fill="#fff" font-size="${PROBE_PX / 2}">Ağ</text></svg>`, // tokens-ok: the probe's ink, never shown
  )
  const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!g) return
  const start = performance.now()
  while (performance.now() - start < PROBE_MS) {
    g.clearRect(0, 0, PROBE_PX, PROBE_PX)
    g.drawImage(probe, 0, 0)
    if (g.getImageData(0, 0, PROBE_PX, PROBE_PX).data.some((v, i) => i % 4 === 3 && v > 0)) return
    await new Promise((r) => setTimeout(r, 10)) // tokens-ok: a poll step
  }
}

// The `<defs>` with Geist's faces, the drawing in both (CSS beats the SVG's own font-family), ready to draw; empty when
// a file can't be fetched, and the picture falls back to sans-serif.
let style: Promise<string> | null = null
const fontStyle = () =>
  (style ??= Promise.all(
    FACES.map(async (f) => {
      const src = await dataUrl(await (await fetch(f.url)).blob())
      return `@font-face{font-family:'${f.family}';font-weight:100 900;src:url(${src}) format('woff2')}`
    }),
  ).then(
    async (faces) => {
      const defs = `<defs><style>${faces.join('')}svg{font-family:${FACES.map((f) => `'${f.family}'`).join(',')},sans-serif}</style></defs>`
      await warm(defs).catch(() => {})
      return defs
    },
    () => ((style = null), ''),
  ))

export async function svgToPng(svg: string, size: { w: number; h: number }): Promise<ImagePart | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null
  try {
    const defs = await fontStyle()
    const img = await svgImage(svg.replace(/^<svg[^>]*>/, (open) => open + defs))
    const canvas = document.createElement('canvas')
    canvas.width = size.w
    canvas.height = size.h
    const g = canvas.getContext('2d')
    if (!g) return null
    g.drawImage(img, 0, 0, size.w, size.h)
    const data = canvas.toDataURL('image/png').split(',')[1]
    return data ? { mediaType: 'image/png', data } : null
  } catch {
    return null
  }
}
