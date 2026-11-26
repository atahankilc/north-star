// pdf.js (D-425): read a PDF's pages and draw them, for a PDF document's facts before it goes up (fileFacts.ts) and its
// pages in the reader (DocContent's PdfPages). Loaded the first time a PDF is met, with its worker beside it: nothing of
// it is in the app's first load.
import type * as Pdfjs from 'pdfjs-dist'

let lib: Promise<typeof Pdfjs> | null = null
function pdfLib(): Promise<typeof Pdfjs> {
  return (lib ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([m, worker]) => {
    m.GlobalWorkerOptions.workerSrc = worker.default
    return m
  }))
}

export async function openPdf(data: ArrayBuffer | Uint8Array) {
  const m = await pdfLib()
  return m.getDocument({ data: data instanceof Uint8Array ? data : new Uint8Array(data) }).promise
}

// A page's height for its width, read without drawing it (where it goes is kept before it's drawn).
export async function pageRatio(pdf: Pdfjs.PDFDocumentProxy, n: number) {
  const one = (await pdf.getPage(n)).getViewport({ scale: 1 })
  return one.height / one.width
}

// One page drawn `width` css px wide (sharp on this screen) onto a new canvas.
export async function drawPage(pdf: Pdfjs.PDFDocumentProxy, n: number, width: number, canvas = document.createElement('canvas')) {
  const page = await pdf.getPage(n)
  const one = page.getViewport({ scale: 1 })
  const dpr = window.devicePixelRatio || 1
  const view = page.getViewport({ scale: (width / one.width) * dpr })
  canvas.width = Math.round(view.width)
  canvas.height = Math.round(view.height)
  await page.render({ canvas, viewport: view }).promise
  return { canvas, ratio: one.height / one.width }
}
