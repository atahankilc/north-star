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
import { canvasCenter, glide, stopGlide, useCanvasView, type Bounds, type PlaneCam, type ScreenRect } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import { useWs } from './context'
import { DocContent, KindMark } from './DocContent'
import { closeDoc, documentsBounds, documentsOf, listed, readerLeft, useDocUi } from './Documents'
import { DockAction, FocusDock } from './FocusDock'
import { isOpen, useOpenSize } from './shownBox'
import styles from './DocumentPiece.module.css'
import beside from './Beside.module.css'

// The margin round its text, in its px.
const PAD = 36
// Its text's width in a window of width `w`: the window's, less the margins.
export const docWidth = (w: number) => Math.max(240, w - 2 - 2 * PAD)
// How tall each document piece's text came out, measured as it's drawn: what fit frames (its first screen).
const useHeights = create<Record<string, number>>(() => ({}))
const FIRST_SCREEN = 640
// Under a cut unframed document: room for its `[continue reading ↗]`.
const MORE_H = 56

// Where a document's focus sits (D-232): at 100 %, its column in the middle of the screen, its top near the top.
export function documentHome(piece: WithId<Piece>, screenW: number): PlaneCam {
  return { zoom: 1, ox: Math.round((screenW - (piece.w - 2)) / 2), oy: 56 }
}

// Zoom steps for reading (D-232): 50 % to 200 %.
const ZOOMS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]
const stepZoom = (z: number, dir: 1 | -1) => (dir > 0 ? (ZOOMS.find((s) => s > z + 0.001) ?? ZOOMS[ZOOMS.length - 1]) : ([...ZOOMS].reverse().find((s) => s < z - 0.001) ?? ZOOMS[0]))

// `[−] 100% [+]`: a click on the number goes back to 100 %. On a document's own focus it zooms its view round the
// middle of the screen; beside the list (`reader`: that document's id), the page's text.
export function DocZoom({ reader }: { reader?: string }) {
  const z = useCanvasView((s) => (reader ? 1 : (s.planeCam?.zoom ?? 1)))
  const rz = useDocUi((s) => (reader ? (s.readerZooms[reader] ?? 1) : 1))
  const zoom = reader ? rz : z
  const set = (to: number) => {
    if (reader) return setReaderZoom(reader, to)
    const { planeCam: c, size } = useCanvasView.getState()
    if (!c) return
    const [px, py] = [size.w / 2, size.h / 2]
    const k = to / c.zoom
    stopGlide()
    useCanvasView.setState({ planeCam: { zoom: to, ox: px - (px - c.ox) * k, oy: py - (py - c.oy) * k } })
  }
  return (
    <span className={styles.zoom} role="group" aria-label="Zoom">
      <DockAction label="−" title="zoom out" onClick={() => set(stepZoom(zoom, -1))} />
      <button className={styles.zoomAt} title="back to 100 %" onClick={() => set(1)}>
        {Math.round(zoom * 100)}%
      </button>
      <DockAction label="+" title="zoom in" onClick={() => set(stepZoom(zoom, 1))} />
    </span>
  )
}

export function documentBounds(piece: WithId<Piece>): Bounds {
  const h = useHeights.getState()[piece.id] ?? FIRST_SCREEN
  return { x: 0, y: 0, w: piece.w - 2, h: Math.min(h, FIRST_SCREEN) }
}

// How much of it shows, by the size of its text on the screen (15 px at 1).
type Level = 'full' | 'compact' | 'far'
const levelAt = (zoom: number): Level => (zoom * 15 < 4.5 ? 'far' : zoom * 15 < 8 ? 'compact' : 'full')

// `onCanvas`: opened onto the canvas (D-234): the whole of it at reading size, live there (links, text), its size measured
// for its drawn box; never cut, never shrunk to its title (it would jump in size as you zoom).
// Unframed (D-234), at most this much of it is drawn on the canvas: a very long one as a single layer turned the whole
// screen black in Chrome once zoomed in and panned along it (its GPU gave up on the layer, until a reload). Past this,
// a fade and `[continue reading ↗]` (`onMore`), which reads it in focus.
const OPEN_MAX = 6000

type Props = { piece: WithId<Piece>; view: PlaneCam; live: boolean; onCanvas?: boolean; onMore?: () => void }

export function DocumentPieceView({ piece, view, live, onCanvas = false, onMore }: Props) {
  const { wid, documents } = useWs()
  const { user } = useAuth()
  const d = documents.find((x) => x.id === piece.docId) ?? null
  const level = useCanvasView((s) => (onCanvas ? 'full' : levelAt((live ? (s.planeCam?.zoom ?? 1) : (s.cams[wid]?.zoom ?? 1)) * view.zoom)))
  const body = useDocBody(wid, d, level === 'full')
  const layer = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  // Unframed: what's drawn of it, cut at OPEN_MAX; its size is the drawn box's (shownBox.ts).
  const clip = useRef<HTMLDivElement>(null)
  const [cut, setCut] = useState(false)
  const width = docWidth(piece.w)

  // Its height, for fit and the scroll's ends.
  useLayoutEffect(() => {
    const el = content.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      useHeights.setState({ [piece.id]: el.offsetHeight })
      if (!onCanvas) return
      setCut(el.offsetHeight > OPEN_MAX)
      const shown = clip.current ?? el
      const next = { w: shown.offsetWidth, h: Math.min(el.offsetHeight, OPEN_MAX) + (el.offsetHeight > OPEN_MAX ? MORE_H : 0) }
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
          <div ref={clip} className={onCanvas ? styles.openClip : undefined} style={onCanvas ? { maxHeight: OPEN_MAX } : undefined} data-cut={(onCanvas && cut) || undefined}>
            <div ref={content} className={styles.content} style={{ width, padding: PAD }} data-cell={(onCanvas && live) || undefined}>
              <DocContent d={d} body={body.data} loading={body.isLoading} me={user?.id} links={live} />
            </div>
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
        {onCanvas && cut && d && level === 'full' && (
          <div className={styles.openMore} style={{ width: width + 2 * PAD, height: MORE_H }}>
            <button className={styles.openMoreButton} data-live onPointerDown={(e) => e.stopPropagation()} onClick={onMore} title="read the rest in focus">
              continue reading ↗
            </button>
          </div>
        )}
      </div>
      {live && !onCanvas && d && level === 'full' && <Outline pieceId={piece.id} content={content} ready={!!body.data} />}
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
// `ready`: its text is in (found again once it loads: the height may be the same as the canvas copy's).
function Outline({ pieceId, content, ready }: { pieceId: string; content: React.RefObject<HTMLDivElement | null>; ready: boolean }) {
  const [marks, setMarks] = useState<Mark[]>([])
  const cam = useCanvasView((s) => s.planeCam)
  const height = useHeights((s) => s[pieceId])
  useEffect(() => {
    const el = content.current
    if (!el) return
    const found = [...el.querySelectorAll<HTMLElement>('[data-heading]')]
      .filter((h) => h.dataset.heading !== 'title' && /^H[1-3]$/.test(h.tagName))
      .map((h) => ({ text: (h.textContent ?? '').trim().replace(/^(\d{2})(?=\S)/, '$1 '), y: h.offsetTop, level: Number(h.tagName[1]) }))
    setMarks(found.slice(0, 60))
  }, [content, height, ready])
  if (marks.length < 2 || !cam) return null
  const at = (m: Mark) => m.y * cam.zoom + cam.oy
  // The one being read: the last whose top has passed near the top of the screen; the first before any has.
  const reading = marks.reduce((cur, m, i) => (at(m) <= 140 ? i : cur), 0)
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
    // As beside the list ("on this page", on the right): one look for both (D-232).
    <nav className={styles.focusOutline} aria-label="On this page" onPointerDown={(e) => e.stopPropagation()}>
      <span className={styles.outlineHead}>on this page</span>
      {marks.map((m, i) => (
        <button key={i} className={styles.outlineItem} data-on={i === reading || undefined} style={{ paddingLeft: `${(m.level - top) * 12}px` }} title={m.text} onClick={() => go(m)}>
          {m.text}
        </button>
      ))}
    </nav>
  )
}

// ---- Beside the list (D-232): in the documents list's focus, a click on a document opens it on the right of the
// screen, which splits as for what's beside a plane (D-211): the list keeps the left, the document reads on the right,
// scrolling as a page does; the line between drags.

export function DocReaders({ list }: { list: WithId<Piece> }) {
  const { documents } = useWs()
  const { user } = useAuth()
  const ids = useDocUi((s) => s.readers)
  const hidden = useDocUi((s) => s.listHidden)
  const size = useCanvasView((s) => s.size)
  // Right of the list, pinned top-left at its own size (or fitted to where the line was dragged); the whole screen
  // (right of the side nav) with the list put away.
  const at = useDocUi((s) => s.readerAt)
  const count = listed(documents, documentsOf(list), user?.id).length
  const left = readerLeft(documentsBounds(list, count), size.w, at, hidden)
  const open = ids.filter((id) => documents.some((d) => d.id === id))
  // Gone (deleted, unshared) closes.
  useEffect(() => {
    if (open.length !== ids.length) useDocUi.setState({ readers: open })
  }, [open.length, ids.length]) // eslint-disable-line react-hooks/exhaustive-deps
  // Side by side, each its share of the width (the lines between them drag, D-232).
  const weights = useDocUi((s) => s.readerWeights)
  if (!open.length) return null
  const room = size.w - left
  const wt = open.map((id) => weights[id] ?? 1)
  const total = wt.reduce((a, b) => a + b, 0)
  const lefts = wt.reduce<number[]>((acc, x, i) => [...acc, acc[i] + (x / total) * room], [left])

  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const node = e.currentTarget
    node.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => useDocUi.setState({ readerAt: ev.clientX })
    const up = () => {
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', up)
    }
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', up)
  }

  // The line after document `i`: moves the width between it and the next, each kept at least PANE_MIN wide.
  const dragBetween = (i: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const node = e.currentTarget
    node.setPointerCapture(e.pointerId)
    const [x0, x1] = [lefts[i], lefts[i + 2]]
    const pair = wt[i] + wt[i + 1]
    const move = (ev: PointerEvent) => {
      const at = Math.min(x1 - PANE_MIN, Math.max(x0 + PANE_MIN, ev.clientX))
      const a = (pair * (at - x0)) / (x1 - x0)
      useDocUi.setState((s) => ({ readerWeights: { ...s.readerWeights, [open[i]]: a, [open[i + 1]]: pair - a } }))
    }
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
      {open.map((id, i) => (
        <DocPane key={id} id={id} list={list} box={{ x: Math.round(lefts[i]), y: 0, w: Math.round(lefts[i + 1] - lefts[i]), h: size.h }} last={i === open.length - 1} first={i === 0} />
      ))}
      {!hidden && <div className={beside.divider} style={{ left }} onPointerDown={drag} role="separator" aria-orientation="vertical" aria-label="List and documents" />}
      {open.slice(0, -1).map((id, i) => (
        <div
          key={`between-${id}`}
          className={beside.divider}
          style={{ left: Math.round(lefts[i + 1]) }}
          onPointerDown={dragBetween(i)}
          // A double-click shares the width evenly again.
          onDoubleClick={() => useDocUi.setState({ readerWeights: {} })}
          role="separator"
          aria-orientation="vertical"
          aria-label="Between two documents"
        />
      ))}
    </>
  )
}

// One document open beside the list: a page that scrolls, its sections, its own zoom and dock.
// A narrow one (side by side) says each action with a mark, its words in the tip.
const NARROW = 560
// How narrow one may be dragged.
const PANE_MIN = 280

function DocPane({ id, list, box, last, first }: { id: string; list: WithId<Piece>; box: Bounds; last: boolean; first: boolean }) {
  const { wid, documents, workspace } = useWs()
  const { user } = useAuth()
  const d = documents.find((x) => x.id === id)!
  const body = useDocBody(wid, d)
  const zoom = useDocUi((s) => s.readerZooms[id] ?? 1)
  const hidden = useDocUi((s) => s.listHidden)
  const el = useRef<HTMLDivElement>(null)
  const editor = !!user && ['owner', 'editor'].includes(workspace.roles[user.id] ?? '')
  const mine = d.uid === user?.id
  const mayDelete = mine || (d.shared && workspace.roles[user?.id ?? ''] === 'owner')
  const narrow = box.w < NARROW
  // Escape with the list put away (D-232): back to the list when it's framed, to the canvas when it's unframed.
  const framed = !isOpen(list)

  // The wheel scrolls it as a page, kept from the list's view; ctrl (or a pinch) zooms its text.
  useEffect(() => {
    const node = el.current
    if (!node) return
    const onWheel = (e: WheelEvent) => {
      e.stopPropagation()
      if (!e.ctrlKey) return
      e.preventDefault()
      const z = useDocUi.getState().readerZooms[id] ?? 1
      setReaderZoom(id, Math.round(z * Math.exp(-e.deltaY * 0.01) * 100) / 100)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [id])

  return (
    <div className={`${beside.pane} ${styles.reader}`} data-alone={(hidden && first) || undefined} style={{ left: box.x, top: 0, width: box.w, height: box.h }} onPointerDown={(e) => e.stopPropagation()} aria-label={`${d.title}, beside the list`}>
      <div ref={el} className={styles.readerScroll} data-scrolls>
        <div className={styles.readerBody}>
          <div className={styles.readerColumn} style={{ zoom }}>
            <DocContent d={d} body={body.data} loading={body.isLoading} me={user?.id} links />
          </div>
          <PageOutline scroller={el} at={`${d.id}:${body.data ? 1 : 0}:${zoom}`} />
        </div>
      </div>
      {/* Its title is on the page already: the dock only says what it is, so it fits a narrow part. */}
      <FocusDock label="document beside" name={narrow ? undefined : <span className={beside.kind}>document</span>}>
        {/* The list put away: its button here, in the first one's dock (D-232). */}
        {hidden && first && <DockAction label={narrow ? '≡' : '≡ list'} keyHint={framed && last && !narrow ? 'esc' : undefined} title="show the documents list beside them" onClick={() => useDocUi.setState({ listHidden: false })} />}
        {mine && <DockAction label={narrow ? '◐' : d.shared ? 'unshare' : 'share'} title={d.shared ? 'unshare: only you see it again' : 'share: everyone in the workspace sees it'} onClick={() => void shareDocument(wid, d.id, !d.shared)} />}
        {editor && <DockAction label={narrow ? '↗' : 'place ↗'} title="place: put it on the canvas on its own, beside the list" onClick={() => useDocUi.setState({ placing: { docId: d.id, near: list.id } })} />}
        <DockAction label={narrow ? '↓' : 'download'} title="download: save it as a .md file" onClick={() => void downloadDocument(wid, d)} />
        {mayDelete && <DockAction label={narrow ? '⌫' : 'delete'} title="delete the document (asks first)" onClick={() => useDocUi.setState({ deleting: d.id })} />}
        <DocZoom reader={id} />
        {/* With the list put away Escape goes straight to the canvas: no `esc` on a close then. */}
        <DockAction label={narrow ? '×' : 'close'} main keyHint={last && (!hidden || !framed) && !narrow ? 'esc' : undefined} title="close it" onClick={() => closeDoc(id)} />
      </FocusDock>
    </div>
  )
}

const setReaderZoom = (id: string, z: number) => useDocUi.setState((s) => ({ readerZooms: { ...s.readerZooms, [id]: Math.min(2, Math.max(0.5, z)) } }))

// "On this page" beside a document open by the list (as the old reports reader had, D-102): its sections, the one you're
// reading lit as you scroll, a click scrolls there. Found in the page itself (headings, a report's questions and blocks).
function PageOutline({ scroller, at }: { scroller: React.RefObject<HTMLDivElement | null>; at: string }) {
  const [parts, setParts] = useState<{ text: string; level: number; el: HTMLElement }[]>([])
  const [now, setNow] = useState(0)
  useEffect(() => {
    const box = scroller.current
    if (!box) return
    const found = [...box.querySelectorAll<HTMLElement>('[data-heading]')]
      .filter((h) => h.dataset.heading !== 'title' && /^H[1-3]$/.test(h.tagName))
      // A report's question carries its number in a span of its own: `01 How…`, not `01How…`.
      .map((h) => ({ text: (h.textContent ?? '').trim().replace(/^(\d{2})(?=\S)/, '$1 '), level: Number(h.tagName[1]), el: h }))
    setParts(found.slice(0, 60))
    const spy = () => {
      const top = box.getBoundingClientRect().top + 96
      let i = 0
      found.forEach((p, j) => {
        if (p.el.getBoundingClientRect().top <= top) i = j
      })
      if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4) i = found.length - 1
      setNow(i)
    }
    spy()
    box.addEventListener('scroll', spy, { passive: true })
    return () => box.removeEventListener('scroll', spy)
  }, [scroller, at])
  if (parts.length < 2) return null
  const top = Math.min(...parts.map((p) => p.level))
  return (
    <nav className={styles.pageOutline} aria-label="On this page">
      <span className={styles.outlineHead}>on this page</span>
      {parts.map((p, i) => (
        <button
          key={i}
          className={styles.outlineItem}
          data-on={i === now || undefined}
          style={{ paddingLeft: `${(p.level - top) * 12}px` }}
          onClick={() => p.el.scrollIntoView({ block: 'start', behavior: isReducedMotion() ? 'auto' : 'smooth' })}
          title={p.text}
        >
          {p.text}
        </button>
      ))}
    </nav>
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
  // Placed: the canvas shows it, in edit mode, to be moved where you want it.
  onPlaced: (pieceId: string) => void
}

export function DocPlace({ toScreen, zoom, others, members, onPlaced }: PlaceProps) {
  const { wid, documents } = useWs()
  const placing = useDocUi((s) => s.placing)
  const d = placing ? (documents.find((x) => x.id === placing.docId) ?? null) : null
  const go = useRef<HTMLButtonElement>(null)
  const size = useCanvasView((s) => s.size)
  const cancel = () => useDocUi.setState({ placing: null })
  const place = () => {
    if (!placing || !d) return cancel()
    // Where it was let go, or (a click on place) where you're looking on the canvas: the nearest clear spot there.
    const at: [number, number] = placing.at ?? canvasCenter(wid)
    cancel()
    void placeDocument(wid, d, at, others, !d.shared).then(onPlaced)
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

