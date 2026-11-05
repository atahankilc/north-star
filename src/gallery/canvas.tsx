// Pieces in the gallery (D-324, gallery.md §4, G2): the real CanvasView over Pazar (src/demo/fixtures/pazar.ts), as the
// demo's CanvasScreen mounts it but without the HUD, narrowed to the pieces a state is about, then put in the state
// asked for (in focus, in edit mode, selected, a card or link picked) the way a person's clicks would leave the stores.
import { createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Markdown } from '../ui/primitives/Markdown'
import { DOC_TEXTS } from '../demo/fixtures/o12'
import { CanvasView } from '../views/workspace/canvas/CanvasView'
import { MAIN, setCanvasHere } from '../data/canvases'
import { useCanvasView } from '../state/canvasView'
import { pazar, workspace, WID, P } from '../demo/fixtures/pazar'
import type { WorkspaceCtx } from '../state/wsStore'
import type { GalleryCtx, StateSpec } from './example'
import layout from '../views/workspace/canvas/WorkspaceLayout.module.css'

export { P }
export const PAZAR: Omit<WorkspaceCtx, 'canvas'> = { ...pazar, wid: WID, workspace }
type Ws = Omit<WorkspaceCtx, 'canvas'>

export function Canvas({ children }: { children?: ReactNode }) {
  setCanvasHere(MAIN)
  return (
    <div className={layout.app} data-app>
      <CanvasView key={MAIN} />
      {children}
    </div>
  )
}

export type OnCanvas = {
  // Only these pieces on the canvas (their cards, text and tasks stay in the workspace); default every piece.
  only?: string[]
  // Unframed (laid on the canvas, D-228): these pieces get `open: true`.
  open?: string[]
  // The workspace changed before it's drawn (more text, a link, a task…).
  change?: (ws: Ws) => Ws
  // In focus (`?focus=`), waited for until it has arrived.
  focus?: string
  // In edit mode, and the piece selected on the canvas.
  edit?: string[]
  selected?: string
  // In a plane: a card picked (its panel open), several picked, a link picked, text picked.
  card?: string
  cards?: string[]
  link?: string
  label?: string
  // The canvas this far out or in, round the screen's middle.
  zoom?: number
  // More, once it's all there.
  then?: (c: GalleryCtx) => void | Promise<void>
  note?: string
}

const until = async (ok: () => boolean, ms = 3000) => {
  const t = performance.now()
  while (!ok() && performance.now() - t < ms) await new Promise((r) => setTimeout(r, 30))
}

export function onCanvas(o: OnCanvas = {}): StateSpec {
  const base = o.change ? o.change(PAZAR) : PAZAR
  const fixture: Ws = {
    ...base,
    pieces: base.pieces.filter((p) => !o.only || o.only.includes(p.id)).map((p) => (o.open?.includes(p.id) ? { ...p, open: true } : p)),
  }
  return {
    size: 'full',
    fixture,
    route: o.focus ? `/workspaces/${WID}?focus=${o.focus}` : undefined,
    note: o.note,
    render: () => <Canvas />,
    setup: async (c) => {
      filling?.disconnect()
      await until(() => !!useCanvasView.getState().cams[WID])
      if (o.focus) await until(() => useCanvasView.getState().focusArrived)
      const s: Partial<ReturnType<typeof useCanvasView.getState>> = {}
      if (o.edit) s.editing = o.edit
      if (o.selected) s.selected = o.selected
      if (o.card) s.cardSelected = o.card
      if (o.cards) s.cardMulti = o.cards
      if (o.link) s.linkSelected = o.link
      if (o.label) s.labelSelected = o.label
      if (o.zoom) {
        const { cams } = useCanvasView.getState()
        const cam = cams[WID]
        const by = o.zoom / cam.zoom
        s.cams = { ...cams, [WID]: { x: cam.x * by, y: cam.y * by, zoom: o.zoom } }
      }
      useCanvasView.setState(s)
      await o.then?.(c)
    },
  }
}

// A document's text where its content goes (DocContent's article, under its h1), as the demo does (o12.ts' docText):
// the gallery has no Firestore to load it from.
let filling: MutationObserver | null = null
export function docTexts(texts: Record<string, string> = DOC_TEXTS) {
  const fill = () => {
    for (const art of document.querySelectorAll('article')) {
      const text = texts[art.querySelector('h1')?.textContent?.trim() ?? '']
      if (!text || art.querySelector(':scope > [data-gallery-body]')) continue
      const box = document.createElement('div')
      box.dataset.galleryBody = ''
      art.appendChild(box)
      const root = createRoot(box)
      flushSync(() => root.render(createElement(Markdown, { text })))
    }
  }
  filling?.disconnect()
  fill()
  filling = new MutationObserver(fill)
  filling.observe(document.body, { childList: true, subtree: true })
}
