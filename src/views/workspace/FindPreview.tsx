// The finder's preview (D-236): what the screen will show once you've gone to the picked match, drawn small. The same
// pieces draw it as they do there (a table, matrix or list as its focus has it, at the view it lands on; a plane's
// cards and text; a document scrolled to the match), still (nothing in it live), each match lit and the picked one
// solid; on the canvas, a copy of the canvas as it is, at the camera go to will take it to.
import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { cardsOn } from '../../data/places'
import { CANVAS } from '../../data/labels'
import { kindOfPiece } from '../../data/pieces'
import { useAuth } from '../../data/auth'
import { useDocBody } from '../../data/documents'
import { useCanvasView, type PlaneCam } from '../../state/canvasView'
import { useWs } from './context'
import { docScrolledTo, paintIn, unpaint, watch } from './find'
import type { Dest } from './findIndex'
import { aim } from './goTo'
import { TableView } from './Table'
import { MatrixView } from './Matrix'
import { KanbanView } from './Kanban'
import { DocumentsView, documentsBounds, documentsOf, listed, pinnedView, readerLeft, useDocUi } from './Documents'
import { DocumentPieceView, documentHome } from './DocumentPiece'
import { DocContent } from './DocContent'
import { PlaneCards } from './PlaneCards'
import { Still } from './still'
import styles from './FindPreview.module.css'
import paper from './DocumentPiece.module.css'
import beside from './Beside.module.css'

// `zoom`: how much closer than going there would show it, round the picked match (the wheel or the head's [−] [+]).
type Props = { dest: Dest | null; re: RegExp | null; w: number; h: number; zoom: number; onZoom: (z: number) => void }

// Memoised: the finder draws again on every key, the preview only when what it shows changes.
export const FindPreview = memo(function FindPreview({ dest, re, w, h, zoom, onZoom }: Props) {
  const box = { w, h }
  const size = useCanvasView((s) => s.size)
  const room = useRef<HTMLDivElement>(null)
  const screen = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLDivElement>(null)
  const k = Math.min(box.w / Math.max(1, size.w), box.h / Math.max(1, size.h))
  const key = dest ? destKey(dest) : ''
  // The picked match's middle on the (unshrunk) screen: what the zoom closes in on. Found once a match.
  const [focal, setFocal] = useState<{ key: string; x: number; y: number } | null>(null)
  const scale = useRef(k * zoom)
  scale.current = k * zoom
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  // Where the picked match is now (its solid highlight, or its lit box): measured after it's painted, and again
  // once a document's page has scrolled to it.
  const refocus = useRef(() => {})
  refocus.current = () => {
    const el = screen.current
    const hl = typeof CSS !== 'undefined' && 'highlights' in CSS ? CSS.highlights.get('find-at') : undefined
    const r = hl ? ([...hl][0] as Range | undefined) : undefined
    const at = r?.getBoundingClientRect() ?? el?.querySelector('[data-found="at"]')?.getBoundingClientRect()
    const origin = lens.current?.getBoundingClientRect()
    if (!at || !origin || !at.width) return
    const p = local(at, origin, scale.current)
    setFocal((f) => (f?.key === key && Math.abs(f.x - p.x) < 0.5 && Math.abs(f.y - p.y) < 0.5 ? f : { key, ...p }))
  }

  // Lit as it'll be there: every match, the picked one solid (its element, or the k-th on a page).
  useLayoutEffect(() => {
    const el = screen.current
    if (!el || !dest || !re) return unpaint()
    const t = dest.target
    const again = () => {
      paintIn(el, re, t?.key ? { el: el.querySelector(t.kind === 'lens' ? `[data-find="${t.key}"]` : `[data-target="${t.key}"]`), k: t.k } : t ? { k: t.k } : null)
      // Measured only while zoomed in (a measure lays the whole preview out again).
      if (zoomRef.current !== 1) refocus.current()
    }
    again()
    const stop = watch(el, again)
    return () => {
      stop()
      unpaint()
    }
  }, [key, re])

  // Zooming in from 100 %: where to close in on.
  useEffect(() => {
    if (zoom !== 1) refocus.current()
  }, [zoom !== 1, key])
  useEffect(() => {
    const el = room.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // A pinch (ctrl) sends small steps, a wheel big ones.
      onZoomRef.current(zoomRef.current * Math.exp(-e.deltaY * (e.ctrlKey ? 0.025 : 0.008)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  const onZoomRef = useRef(onZoom)
  onZoomRef.current = onZoom

  const f = focal?.key === key ? focal : null
  return (
    <div ref={room} className={styles.room} style={{ height: box.h }}>
      <div className={styles.frame} style={{ width: size.w * k, height: size.h * k }}>
        {/* At the screen's own size, shrunk: what's in it lays out as it will there. Never live: nothing takes a click. */}
        <div ref={screen} className={styles.screen} style={{ width: size.w, height: size.h, transform: `scale(${k})` }} inert>
          <div ref={lens} className={styles.lens} style={{ transform: `scale(${zoom})`, transformOrigin: f ? `${f.x}px ${f.y}px` : '50% 50%' }}>
            <Still.Provider value>{dest && <Shown key={key} dest={dest} lens={lens} scale={scale} refocus={refocus} />}</Still.Provider>
          </div>
        </div>
      </div>
    </div>
  )
})

// A place on the screen, from where it's drawn: the zoomed layer's top-left is its own (0, 0), at `scale`.
const local = (r: DOMRect, origin: DOMRect, scale: number) => ({ x: (r.left + r.width / 2 - origin.left) / scale, y: (r.top + r.height / 2 - origin.top) / scale })

const destKey = (d: Dest) => (d.kind === 'place' ? `place:${d.place.space}:${d.place.id}` : `${d.kind}:${d.target.space}:${d.target.key ?? ''}:${d.target.k}`)

type Measure = { lens: React.RefObject<HTMLDivElement | null>; scale: React.RefObject<number>; refocus: React.RefObject<() => void> }

function Shown({ dest, lens, scale, refocus }: { dest: Dest } & Measure) {
  const { cards, labels, places, canvases } = useWs()
  if (dest.kind === 'place') {
    const { zoom, at, to } = aim(dest.place)
    const view: PlaneCam = { zoom, ox: to[0] - at[0] * zoom, oy: to[1] - at[1] * zoom }
    // Another canvas isn't on the page to copy (D-302): where it is, until you're there.
    if (dest.place.space === CANVAS && dest.canvas) return <p className={styles.elsewhere}>{dest.place.label} · on {canvases.find((c) => c.id === dest.canvas)?.name ?? 'another canvas'}</p>
    if (dest.place.space === CANVAS) return <CanvasCopy view={view} />
    // Its `+` marks, as its focus draws them (FocusedPlane): every 25 px of the plane, under its cards.
    const step = 25 * view.zoom
    const marks = { '--mark': `${step}px`, '--mx': `${view.ox - step / 2}px`, '--my': `${view.oy - step / 2}px` } as CSSProperties
    return (
      <div className={styles.plane} data-marks style={marks}>
        <PlaneCards cards={cardsOn(cards, places, dest.place.space)} labels={labels.filter((l) => l.pieceId === dest.place.space)} view={view} live={false} editor={false} />
      </div>
    )
  }
  if (dest.kind === 'lens') {
    const view = dest.target.view!
    const kind = kindOfPiece(dest.piece)
    return (
      <div className={styles.plane}>
        {kind === 'table' ? (
          <TableView piece={dest.piece} view={view} live={false} editor={false} page={dest.page} />
        ) : kind === 'matrix' ? (
          <MatrixView piece={dest.piece} view={view} live={false} editor={false} />
        ) : kind === 'kanban' ? (
          <KanbanView piece={dest.piece} view={view} live={false} editor={false} />
        ) : (
          <DocumentsView piece={dest.piece} view={view} live={false} editor={false} page={dest.page} />
        )}
      </div>
    )
  }
  if (dest.kind === 'doc') return <DocPage dest={dest} lens={lens} scale={scale} refocus={refocus} />
  return <ReaderPage dest={dest} lens={lens} scale={scale} refocus={refocus} />
}

// The canvas as it is now, copied, under the camera go to takes it to: the same pieces and text where they are.
function CanvasCopy({ view }: { view: PlaneCam }) {
  const host = useRef<HTMLDivElement>(null)
  // Copied a frame later, so the finder answers first (a big canvas takes a moment).
  useEffect(() => {
    const el = host.current
    const world = document.querySelector<HTMLElement>('[data-canvas-world]')
    if (!el || !world) return
    const raf = requestAnimationFrame(() => {
      const copy = world.cloneNode(true) as HTMLElement
      copy.removeAttribute('data-canvas-world')
      copy.style.transform = `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})`
      // What holds its size on the screen (a piece's name, D-223) reads the canvas's zoom: this one's.
      copy.querySelectorAll<HTMLElement>('[style*="--z"]').forEach((n) => n.style.setProperty('--z', String(view.zoom)))
      el.replaceChildren(copy)
    })
    return () => {
      cancelAnimationFrame(raf)
      el.replaceChildren()
    }
  }, [view.ox, view.oy, view.zoom])
  return <div ref={host} className={styles.canvas} />
}

// A document in its focus: at 100 %, its top near the top, scrolled so the match is where going there puts it.
function DocPage({ dest, lens, scale, refocus }: { dest: Extract<Dest, { kind: 'doc' }> } & Measure) {
  const size = useCanvasView((s) => s.size)
  const [view, setView] = useState<PlaneCam>(() => documentHome(dest.piece, size.w))
  useScrolledTo(lens, scale, refocus, dest.target.k, (top, bottom, h) => setView((v) => ({ ...v, oy: docScrolledTo(v.oy, top, bottom, h) })))
  return (
    <div className={styles.plane}>
      <DocumentPieceView piece={dest.piece} view={view} live={false} />
    </div>
  )
}

// A document open beside its list: the list pinned on the left, the document on the right scrolled to the match.
function ReaderPage({ dest, lens, scale, refocus }: { dest: Extract<Dest, { kind: 'reader' }> } & Measure) {
  const { wid, documents } = useWs()
  const { user } = useAuth()
  const size = useCanvasView((s) => s.size)
  const content = documentsBounds(dest.list, listed(documents, documentsOf(dest.list), user?.id).length)
  const left = readerLeft(content, size.w, null)
  const body = useDocBody(wid, dest.doc)
  const pane = useRef<HTMLDivElement>(null)
  const zoom = useDocUi((s) => s.readerZooms[dest.doc.id] ?? 1)
  useScrolledTo(lens, scale, refocus, dest.target.k, (top, _bottom, h) => {
    const el = pane.current
    if (el && (top < 76 || top > h - 64)) el.scrollTop += top - h * 0.4
  })
  const paneStyle: CSSProperties = { left, top: 0, width: size.w - left, height: size.h }
  // As DocPane draws it beside the list.
  return (
    <div className={styles.plane}>
      <DocumentsView piece={dest.list} view={pinnedView(content, left)} live={false} editor={false} />
      <div className={`${beside.pane} ${paper.reader}`} style={paneStyle}>
        <div ref={pane} className={paper.readerScroll}>
          <div className={paper.readerBody}>
            <div className={paper.readerColumn} style={{ zoom }}>
              <DocContent d={dest.doc} body={body.data} loading={body.isLoading} me={user?.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Once the k-th match is drawn, where it is on the (unshrunk, unzoomed) screen: `move` brings it into view, once.
function useScrolledTo(lens: React.RefObject<HTMLDivElement | null>, scale: React.RefObject<number>, refocus: React.RefObject<() => void>, n: number, move: (top: number, bottom: number, h: number) => void) {
  const done = useRef(false)
  const size = useCanvasView((s) => s.size)
  useLayoutEffect(() => {
    const el = lens.current
    if (!el) return
    const look = () => {
      if (done.current) return
      const hl = typeof CSS !== 'undefined' && 'highlights' in CSS ? CSS.highlights.get('find-at') : undefined
      const r = hl ? ([...hl][0] as Range | undefined) : undefined
      if (!r) return
      done.current = true
      const box = el.getBoundingClientRect()
      const at = r.getBoundingClientRect()
      const s = scale.current ?? 1
      move((at.top - box.top) / s, (at.bottom - box.top) / s, size.h)
      // Where it's gone to: what the zoom closes in on.
      requestAnimationFrame(() => refocus.current?.())
    }
    // After the painting (a frame later, once the text's in).
    let raf = requestAnimationFrame(function tick() {
      look()
      if (!done.current) raf = requestAnimationFrame(tick)
    })
    const stop = setTimeout(() => cancelAnimationFrame(raf), 2000)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(stop)
    }
    // Once a match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])
}
