// A document on its own (D-232): a piece on the canvas showing one document's content directly, in a window like a
// table's (D-208): its title and text at reading size from the top-left, the text as wide as the window, cut at its
// bottom with a fade. By its size on the screen, as cards are (D-153): the whole of it, then its title alone, then grey
// bars, and the text isn't even read from the database until it's near enough to read. In focus it's live: the wheel
// scrolls it (ctrl or a pinch zooms), links work, an outline of its headings on the left takes you to each.
//
// Also here: the document open beside the documents list in its focus (DocReader), and the question asked before a
// private document is put on the canvas, where everyone sees it (DocPlace).
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { create } from 'zustand'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { downloadDocument, shareDocument, useDocBody } from '../../data/documents'
import { placeDocument, pieceRef } from '../../data/pieces'
import { useAuth } from '../../data/auth'
import { glide, setSplit, stopGlide, useCanvasView, type Bounds, type PlaneCam, type ScreenRect } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import { useWs } from './context'
import { DocContent, KindMark } from './DocContent'
import { useDocUi } from './Documents'
import { DockAction, FocusDock } from './FocusDock'
import { useOpenSize } from './shownBox'
import styles from './DocumentPiece.module.css'
import beside from './Beside.module.css'

// The margin round its text, in its px.
const PAD = 36
// Its text's width in a window of width `w`: the window's, less the margins.
export const docWidth = (w: number) => Math.max(240, w - 2 - 2 * PAD)
// How tall each document piece's text came out, measured as it's drawn: what fit frames (its first screen).
const useHeights = create<Record<string, number>>(() => ({}))
const FIRST_SCREEN = 640

export function documentBounds(piece: WithId<Piece>): Bounds {
  const h = useHeights.getState()[piece.id] ?? FIRST_SCREEN
  return { x: 0, y: 0, w: piece.w - 2, h: Math.min(h, FIRST_SCREEN) }
}

// How much of it shows, by the size of its text on the screen (15 px at 1).
type Level = 'full' | 'compact' | 'far'
const levelAt = (zoom: number): Level => (zoom * 15 < 4.5 ? 'far' : zoom * 15 < 8 ? 'compact' : 'full')

// `onCanvas`: opened onto the canvas (D-234): the whole of it at reading size, live there (links, text), its size measured
// for its drawn box; never cut, never shrunk to its title (it would jump in size as you zoom).
type Props = { piece: WithId<Piece>; view: PlaneCam; live: boolean; onCanvas?: boolean }

export function DocumentPieceView({ piece, view, live, onCanvas = false }: Props) {
  const { wid, documents } = useWs()
  const { user } = useAuth()
  const d = documents.find((x) => x.id === piece.docId) ?? null
  const level = useCanvasView((s) => (onCanvas ? 'full' : levelAt((live ? (s.planeCam?.zoom ?? 1) : (s.cams[wid]?.zoom ?? 1)) * view.zoom)))
  const body = useDocBody(wid, d, level === 'full')
  const layer = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const width = docWidth(piece.w)

  // Its height, for fit and the scroll's ends.
  useLayoutEffect(() => {
    const el = content.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      useHeights.setState({ [piece.id]: el.offsetHeight })
      if (!onCanvas) return
      const next = { w: el.offsetWidth, h: el.offsetHeight }
      const was = useOpenSize.getState()[piece.id]
      if (!was || was.w !== next.w || was.h !== next.h) useOpenSize.setState({ [piece.id]: next })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [piece.id, level, onCanvas])

  // In focus the wheel scrolls it, kept from the plane's zoom (ctrl or a pinch still zooms).
  useEffect(() => {
    const el = layer.current
    if (!el || !live || onCanvas) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return
      e.stopPropagation()
      e.preventDefault()
      const c = useCanvasView.getState().planeCam
      if (!c) return
      stopGlide()
      useCanvasView.setState({ planeCam: scrolled(c, e.deltaX, e.deltaY, piece.id) })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [live, piece.id, onCanvas])

  const style: CSSProperties = { transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }
  return (
    <div ref={layer} className={styles.layer} data-live={live || undefined} data-cut={(!live && !onCanvas) || undefined} data-on-canvas={onCanvas || undefined}>
      <div className={styles.world} style={style}>
        {!d ? (
          <p className={styles.gone} style={{ width, margin: PAD }}>
            This document is gone, or only its author sees it now.
          </p>
        ) : level === 'full' ? (
          // On the canvas a press on it is its own until it moves 5 px (D-217's rule): a link's click still lands.
          <div ref={content} className={styles.content} style={{ width, padding: PAD }} data-cell={(onCanvas && live) || undefined}>
            <DocContent d={d} body={body.data} loading={body.isLoading} me={user?.id} links={live} />
          </div>
        ) : level === 'compact' ? (
          <div ref={content} className={styles.compact} style={{ width: piece.w - 2, height: piece.h - 2 }}>
            <KindMark kind={d.kind} />
            <span className={styles.compactTitle}>{d.title}</span>
          </div>
        ) : (
          <div ref={content} className={styles.far} style={{ width, padding: PAD }} aria-hidden>
            {[80, 55, 100, 90, 70].map((w, i) => (
              <i key={i} style={{ width: `${w}%`, height: i === 0 ? 40 : 16 }} />
            ))}
          </div>
        )}
      </div>
      {live && !onCanvas && d && level === 'full' && <Outline pieceId={piece.id} content={content} />}
    </div>
  )
}

// The view scrolled by the wheel, kept between its first line near the top and its last near the bottom.
function scrolled(c: PlaneCam, dx: number, dy: number, id: string): PlaneCam {
  const h = (useHeights.getState()[id] ?? 0) * c.zoom
  const screen = useCanvasView.getState().size.h
  const top = 96
  const lowest = Math.min(top, screen - 120 - h)
  return { ...c, ox: c.ox - dx, oy: Math.max(lowest, Math.min(top, c.oy - dy)) }
}

type Mark = { text: string; y: number; level: number }

// Its headings on the left of the screen in focus (D-232): the one you're reading lit; a click glides there.
function Outline({ pieceId, content }: { pieceId: string; content: React.RefObject<HTMLDivElement | null> }) {
  const [marks, setMarks] = useState<Mark[]>([])
  const cam = useCanvasView((s) => s.planeCam)
  const height = useHeights((s) => s[pieceId])
  useEffect(() => {
    const el = content.current
    if (!el) return
    const found = [...el.querySelectorAll<HTMLElement>('[data-heading]')]
      .filter((h) => h.dataset.heading !== 'title' && /^H[1-3]$/.test(h.tagName))
      .map((h) => ({ text: h.textContent ?? '', y: h.offsetTop, level: Number(h.tagName[1]) }))
    setMarks(found.slice(0, 60))
  }, [content, height])
  if (marks.length < 2 || !cam) return null
  const at = (m: Mark) => m.y * cam.zoom + cam.oy
  const reading = marks.reduce((cur, m, i) => (at(m) <= 140 ? i : cur), -1)
  const go = (m: Mark) => {
    const c = useCanvasView.getState().planeCam
    if (!c) return
    stopGlide()
    const to = { ...c, oy: 96 - m.y * c.zoom }
    if (isReducedMotion()) useCanvasView.setState({ planeCam: to })
    else glide(c, to, 420, (v) => useCanvasView.setState({ planeCam: v }))
  }
  const top = Math.min(...marks.map((m) => m.level))
  return (
    <nav className={styles.outline} aria-label="Outline" onPointerDown={(e) => e.stopPropagation()}>
      <span className={styles.outlineHead}>outline</span>
      {marks.map((m, i) => (
        <button key={i} className={styles.outlineItem} data-on={i === reading || undefined} style={{ paddingLeft: `${(m.level - top) * 12 + 12}px` }} onClick={() => go(m)}>
          {m.text}
        </button>
      ))}
    </nav>
  )
}

// ---- Beside the list (D-232): in the documents list's focus, a click on a document opens it on the right of the
// screen, which splits as for what's beside a plane (D-211): the list keeps the left, the document reads on the right,
// scrolling as a page does; the line between drags.

export function DocReader({ list }: { list: WithId<Piece> }) {
  const { wid, documents, workspace } = useWs()
  const { user } = useAuth()
  const id = useDocUi((s) => s.reader)
  const d = documents.find((x) => x.id === id) ?? null
  const body = useDocBody(wid, d)
  const size = useCanvasView((s) => s.size)
  const split = useCanvasView((s) => s.split)
  const left = Math.round(size.w * split)
  const el = useRef<HTMLDivElement>(null)
  const editor = !!user && ['owner', 'editor'].includes(workspace.roles[user.id] ?? '')

  // Gone (deleted, unshared) closes it.
  useEffect(() => {
    if (id && !d) useDocUi.setState({ reader: null })
  }, [id, d])
  // The wheel scrolls it as a page, kept from the list's view.
  useEffect(() => {
    const node = el.current
    if (!node) return
    const stop = (e: WheelEvent) => e.stopPropagation()
    node.addEventListener('wheel', stop, { passive: true })
    return () => node.removeEventListener('wheel', stop)
  }, [d])
  if (!d) return null
  const mine = d.uid === user?.id

  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const node = e.currentTarget
    node.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => setSplit(ev.clientX / Math.max(1, size.w))
    const up = () => {
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', up)
    }
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', up)
  }

  return (
    <>
      <div className={`${beside.pane} ${styles.reader}`} style={{ left, top: 0, width: size.w - left, height: size.h }} onPointerDown={(e) => e.stopPropagation()} aria-label={`${d.title}, beside the list`}>
        <div ref={el} className={styles.readerScroll} data-scrolls>
          <div className={styles.readerColumn}>
            <DocContent d={d} body={body.data} loading={body.isLoading} me={user?.id} links />
          </div>
        </div>
        <FocusDock
          label="document beside"
          name={
            <>
              <span className={beside.kind}>document</span> · {d.title.length > 28 ? `${d.title.slice(0, 27)}…` : d.title}
            </>
          }
        >
          {mine && <DockAction label={d.shared ? 'unshare' : 'share'} title={d.shared ? 'only you see it again' : 'everyone in the workspace sees it'} onClick={() => void shareDocument(wid, d.id, !d.shared)} />}
          {editor && <DockAction label="place ↗" title="put it on the canvas on its own, beside the list" onClick={() => useDocUi.setState({ placing: { docId: d.id, near: list.id } })} />}
          <DockAction label="download" title="save it as a .md file" onClick={() => void downloadDocument(wid, d)} />
          <DockAction label="close" main keyHint="esc" title="close it" onClick={() => useDocUi.setState({ reader: null })} />
        </FocusDock>
      </div>
      <div className={beside.divider} style={{ left }} onPointerDown={drag} role="separator" aria-orientation="vertical" aria-label="List and document" />
    </>
  )
}

// ---- Placing (D-232): a document on its own on the canvas. A shared one goes at once; your own private one asks
// first, since everyone sees the canvas: the piece waits dashed where it was let go, the question inside it; cancel
// takes it away. Asked from a focus, the question stands in the middle of the screen and the piece goes beside the list.

type PlaceProps = {
  // Where a canvas point is on the screen (none in focus).
  toScreen: ((x: number, y: number) => [number, number] | null) | null
  zoom: number
  others: (Bounds & { id: string })[]
  members: { total: number; editors: number; viewers: number }
}

export function DocPlace({ toScreen, zoom, others, members }: PlaceProps) {
  const { wid, documents } = useWs()
  const placing = useDocUi((s) => s.placing)
  const d = placing ? (documents.find((x) => x.id === placing.docId) ?? null) : null
  const go = useRef<HTMLButtonElement>(null)
  const size = useCanvasView((s) => s.size)
  const cancel = () => useDocUi.setState({ placing: null })
  const place = () => {
    if (!placing || !d) return cancel()
    const near = placing.near ? others.find((o) => o.id === placing.near) : undefined
    const at: [number, number] = placing.at ?? (near ? [near.x + near.w + 300, near.y + 250] : [0, 0])
    cancel()
    void placeDocument(wid, d, at, others, !d.shared)
  }
  const placeRef = useRef(place)
  placeRef.current = place
  // A shared one needs no question.
  useEffect(() => {
    if (d?.shared) placeRef.current()
  }, [d?.shared, placing])
  useEffect(() => {
    if (!placing || !d || d.shared) return
    go.current?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        cancel()
      }
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [placing, d])
  if (!placing || !d || d.shared) return null
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)))
  const w = 650 * zoom
  const h = 500 * zoom
  const spot = placing.at && toScreen ? toScreen(placing.at[0] - 325, placing.at[1] - 250) : null
  const rect: ScreenRect | null = spot ? { x: spot[0], y: spot[1], w, h, zoom } : null
  const people = `${members.total} ${members.total === 1 ? 'person' : 'people'}${members.editors || members.viewers ? ` (${[members.editors && `${members.editors} editor${members.editors === 1 ? '' : 's'}`, members.viewers && `${members.viewers} viewer${members.viewers === 1 ? '' : 's'}`].filter(Boolean).join(', ')})` : ''}`
  return (
    <div className={styles.placeLayer} onPointerDown={(e) => e.stopPropagation()}>
      {rect && (
        <div className={styles.ghost} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} aria-hidden>
          <span className={styles.ghostName}>◐ {d.title}</span>
        </div>
      )}
      <div
        className={styles.ask}
        role="dialog"
        aria-label="Share it with everyone?"
        // Inside the ghost, kept on the screen.
        style={rect ? { left: clamp(rect.x + rect.w / 2, 240, size.w - 240), top: clamp(rect.y + rect.h / 2, 160, size.h - 160) } : { left: '50%', top: '50%' }}
      >
        <span className={styles.tape} aria-hidden />
        <p className={styles.askKicker}>only you see this</p>
        <p className={styles.askTitle}>Show "{d.title.length > 60 ? `${d.title.slice(0, 59)}…` : d.title}" to everyone?</p>
        <p className={styles.askLines}>Putting it on the canvas shares it with the workspace: {people}. You can unshare it later from the documents list.</p>
        <p className={styles.askActions}>
          <button className={styles.askTool} onClick={cancel}>
            cancel
          </button>
          <span className={styles.askKey}>esc</span>
          <button ref={go} className={styles.askTool} data-go onClick={place}>
            share and place
          </button>
          <span className={styles.askKey}>↵</span>
        </p>
      </div>
    </div>
  )
}

// The pieces showing a document, for deleting it with them.
export const piecesOfDoc = (wid: string, pieces: WithId<Piece>[], id: string) => pieces.filter((p) => p.docId === id).map((p) => pieceRef(wid, p.id))

// Who's in the workspace, for the question.
export function membersOf(roles: Record<string, string>) {
  const r = Object.values(roles)
  return { total: r.length, editors: r.filter((x) => x === 'editor').length, viewers: r.filter((x) => x === 'viewer').length }
}

