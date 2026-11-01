// The browser's `render` for the agent's `look` (D-327 phase 2): an SVG drawn on a canvas, read back as a PNG (base64).
// Nothing leaves the browser here; the PNG goes to the model with the tool's result, and nowhere else.
import type { ImagePart } from '../contract'

export async function svgToPng(svg: string, size: { w: number; h: number }): Promise<ImagePart | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
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
  } finally {
    URL.revokeObjectURL(url)
  }
}
