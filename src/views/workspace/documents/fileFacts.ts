// What an image or a PDF says about itself before it goes up (D-425): its size in px, its pages, and a small picture
// for the list's sheets and rows (a thumbnail, webp). Worked out in the browser; a file it can't read goes up without
// them (its sheet shows its kind instead).
import type { FileFacts } from '../../../data/documents'
import { openPdf, drawPage } from './pdf'

const THUMB_W = 480 // tokens-ok: a thumbnail's width in image px, enough for a sheet on a sharp screen

const toBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.82))

function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  return new Promise((ok, no) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => no(new Error('not an image'))
    img.src = url
  }).finally(() => URL.revokeObjectURL(url)) as Promise<HTMLImageElement>
}

async function imageFacts(file: File): Promise<FileFacts> {
  const img = await loadImage(file)
  const [w, h] = [img.naturalWidth, img.naturalHeight]
  if (!w || !h) return {}
  const k = Math.min(1, THUMB_W / w)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * k))
  canvas.height = Math.max(1, Math.round(h * k))
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
  const thumb = await toBlob(canvas)
  return { width: w, height: h, ...(thumb && { thumb }) }
}

async function pdfFacts(file: File): Promise<FileFacts> {
  const pdf = await openPdf(await file.arrayBuffer())
  try {
    const { canvas } = await drawPage(pdf, 1, THUMB_W / (window.devicePixelRatio || 1))
    const thumb = await toBlob(canvas)
    return { pages: pdf.numPages, ...(thumb && { thumb }) }
  } finally {
    void pdf.loadingTask.destroy()
  }
}

export async function fileFacts(file: File, type: string): Promise<FileFacts> {
  try {
    return type === 'application/pdf' ? await pdfFacts(file) : await imageFacts(file)
  } catch {
    return {}
  }
}
