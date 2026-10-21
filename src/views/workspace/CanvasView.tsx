// /workspaces/:wid: the workspace's canvas (D-174, D-176). An infinite space over the flowing backdrop, with no grid
// marks. Planes are placed on it from the side nav's `+`, at the middle of the screen; tables and the rest come later.
// Drag to pan, the wheel zooms round the pointer: always the canvas, over a plane too (D-186), until a plane is in focus,
// when they're the plane's (FocusedPlane). A plane is moved, resized and renamed only in edit mode (D-180), switched on
// and off from its console; in edit mode it takes the drag, it's selected, and Delete takes it away. Escape or a click on
// empty space lets go of the selection. `0` (or the side nav's fit) frames everything, or in focus the plane's contents.
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../data/auth'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { deletePiece, pieceRef, KIND_NAME, isBare, kindOfPiece, PIECE_MIN, PIECE_NAME_MAX, placePiece, renamePiece, snap, type Box } from '../../data/pieces'
import { HazardConfirm } from '../../ui/HazardConfirm'
import { canEditIn } from '../../data/workspaces'
import { camOf, fitCanvas, fitInto, fitPlane, setCam, setEditing, useCanvasView, type Bounds, type Cam, type PlaneCam, type ScreenRect } from '../../state/canvasView'
import { useWs } from './context'
import { FocusedPlane } from './FocusedPlane'
import { closeThread, CommentIcon, myUid, openThread, startComment, ThreadChip, threadOn, toggleInbox, toggleThreadPins, useThreadView } from './Threads'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { isNew, useReads } from '../../data/threads'
import { ThreadInbox } from './ThreadInbox'
import { CARD } from '../../data/cards'
import { glide } from '../../state/canvasView'
import { isOwnerOf } from '../../data/workspaces'
import type { Thread } from '../../data/model'
import { Follow, PeerCursors, PeerRing, stopFollowing, useCursorReport, usePresenceReport } from './collab'
import { DrawSection } from './DrawSection'
import { labelBox, TextItems } from './TextItems'
import { spaceBounds } from './spaceBounds'
import { CANVAS, deleteLabel, type Label } from '../../data/labels'
import { PlaneCards } from './PlaneCards'
import { DockAction, FocusDock } from './FocusDock'
import { deleteCard, type Card } from '../../data/cards'
import { deleteEdge } from '../../data/edges'
import { GRID } from '../../data/grid'
import { goToPlace, useGoTo, type Place } from './goTo'
import { matrixBounds, MatrixView, useMatrixUi } from './Matrix'
import { MatrixSetupPanel } from './MatrixSetup'
import { tableBounds, TableView, useTableUi } from './Table'
import { TableSetupPanel } from './TableSetup'
import styles from './CanvasView.module.css'

// What the wheel scrolls rather than zooms: the threads panel, an open thread, a menu.
export const SCROLLS_ITSELF = 'section[aria-label=Threads], [role=dialog], [role=menu]'

const ZOOM_MIN = 0.1
const ZOOM_MAX = 4
const DRAG_PX = 5
// The catch round 100%: a wheel zoom within 3% of it stays at exactly 1, where the canvas is drawn at its own pixels.
const ZOOM_CATCH = 0.03
// The wheel's own zoom per workspace, which the catch holds the camera at 1 against.
const wheelZoom = new Map<string, number>()

// The canvas moves by whole device pixels: a pan or a zoom leaves the camera between pixels, and drawn there every edge
// and letter is smeared over two of them.
const onPixel = (v: number) => {
  const dpr = window.devicePixelRatio || 1
  return Math.round(v * dpr) / dpr
}

export function CanvasView() {
  const { wid, workspace, pieces, cards, labels, threads, cells, edges } = useWs()
  const { user } = useAuth()
  const editor = canEditIn(workspace, user?.id)
  const cam = useCanvasView((s) => s.cams[wid]) ?? camOf(wid)
  const size = useCanvasView((s) => s.size)
  const selected = useCanvasView((s) => s.selected)
  const editing = useCanvasView((s) => s.editing)
  const confirmingId = useCanvasView((s) => s.confirming)
  const confirming = pieces.find((p) => p.id === confirmingId) ?? null
  const root = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLDivElement>(null)
  // The plane in focus (D-184), in the address so back leaves it and a reload stays in it.
  const [params, setParams] = useSearchParams()
  const focusId = params.get('focus')
  const focused = focusId ? (pieces.find((p) => p.id === focusId) ?? null) : null
  const focusedBare = Boolean(focused && isBare(focused))
  const focusSpread = useCanvasView((s) => s.focusSpread)
  const focusArrived = useCanvasView((s) => s.focusArrived)
  const focusLeaving = useCanvasView((s) => s.focusLeaving)
  const focusedRef = useRef(false)
  focusedRef.current = Boolean(focused)
  const unfocusRef = useRef(() => {})
  const piecesRef = useRef(pieces)
  piecesRef.current = pieces
  const cardsOf = (id: string) => cards.filter((c) => c.pieceId === id)
  const labelsOf = (id: string) => labels.filter((l) => l.pieceId === id)
  const canvasLabels = labelsOf(CANVAS)
  const focusedCards = focused ? cardsOf(focused.id) : []
  const focusedLabels = focused ? labelsOf(focused.id) : []
  const focusedMatrix = focused && kindOfPiece(focused) === 'matrix'
  const focusedTable = focused && kindOfPiece(focused) === 'table'
  const matrixSetup = useMatrixUi((s) => s.setup)
  const tableSetup = useTableUi((s) => s.setup)
  // What's in a piece, in its own px: a plane's cards and text, a matrix's table (D-204) or a table's (D-209).
  const contentOf = (p: WithId<Piece>) => {
    const kind = kindOfPiece(p)
    return kind === 'matrix' ? matrixBounds(p, cards) : kind === 'table' ? tableBounds(p, cards) : spaceBounds(cardsOf(p.id), labelsOf(p.id))
  }
  // What fit frames (D-186, D-188): the focused plane's cards and text, or the canvas's planes and text.
  const fitRef = useRef((_instant?: boolean) => {})
  fitRef.current = (instant = false) => {
    if (focused) fitPlane(contentOf(focused), instant)
    else fitCanvas(wid, [...pieces, ...canvasLabels.map(labelBox)])
  }
  // Go to (D-196): the side nav's list asks through `useGoTo`; no keys (D-201).
  // A place in the space you're in glides there; one in a plane, from outside it, waits for the plane to come into focus.
  const goPlaceRef = useRef((_: Place) => {})
  goPlaceRef.current = (place: Place) => {
    stopFollowing()
    const here = focusId ?? CANVAS
    if (place.space === here) {
      if (focusId && !useCanvasView.getState().focusArrived) return
      return goToPlace(wid, place, Boolean(focusId))
    }
    if (place.space === CANVAS) return
    useGoTo.setState({ pending: place })
    focusTo(place.space)
  }
  const asked = useGoTo((s) => s.asked)
  useEffect(() => {
    if (!asked) return
    useGoTo.setState({ asked: null })
    goPlaceRef.current(asked)
  }, [asked])
  const allLabelsRef = useRef(labels)
  allLabelsRef.current = labels
  const edgesRef = useRef(edges)
  edgesRef.current = edges
  const focusedCardsRef = useRef(focusedCards)
  focusedCardsRef.current = focusedCards
  const drawing = useCanvasView((s) => s.drawing)
  // What a canvas section carries besides text: the planes inside it.
  const pieceCarry = pieces.map((p) => ({ id: p.id, ref: pieceRef(wid, p.id), x: p.x, y: p.y, w: p.w, h: p.h }))
  // A point on screen (client px) in a space's px: the canvas's, or the focused plane's own view.
  const canvasToSpace = (cx: number, cy: number): [number, number] => {
    const r = root.current!.getBoundingClientRect()
    const c = camOf(wid)
    return [(cx - r.left - onPixel(r.width / 2 + c.x)) / c.zoom, (cy - r.top - onPixel(r.height / 2 + c.y)) / c.zoom]
  }
  const planeToSpace = (cx: number, cy: number): [number, number] => {
    const r = root.current!.getBoundingClientRect()
    const c = useCanvasView.getState().planeCam!
    return [(cx - r.left - c.ox) / c.zoom, (cy - r.top - c.oy) / c.zoom]
  }
  // Working together (D-191): the space you're in, your pointer in it, and everyone else's.
  const space = focusId ?? CANVAS
  usePresenceReport(space)
  useCursorReport(root, (cx, cy) => (focusId ? (useCanvasView.getState().planeCam && useCanvasView.getState().focusArrived ? planeToSpace(cx, cy) : null) : canvasToSpace(cx, cy)))
  const toScreen = (x: number, y: number): [number, number] | null => {
    if (focusId) {
      const c = useCanvasView.getState().planeCam
      return c && useCanvasView.getState().focusArrived ? [c.ox + x * c.zoom, c.oy + y * c.zoom] : null
    }
    const c = camOf(wid)
    const { w, h } = useCanvasView.getState().size
    return [onPixel(w / 2 + c.x) + x * c.zoom, onPixel(h / 2 + c.y) + y * c.zoom]
  }
  // Following someone into a plane, or back out (D-191).
  const focusTo = (planeId: string | null) => {
    if (planeId === null) return unfocus()
    const p = pieces.find((x) => x.id === planeId)
    if (!p) return
    // From another plane straight to theirs: no ink (it would spread from a plane that isn't on screen).
    if (focusId) {
      useCanvasView.setState({ focusSpread: false, focusArrived: false, focusLeaving: false, cardSelected: null, labelSelected: null })
      setParams({ focus: planeId })
    } else focus(p)
  }

  // Comment threads (D-192, D-193): where each one's chip is (a component's bottom-right corner), in its space's px;
  // what it's on, in words.
  const pinOf = (t: Pick<Thread, 'on' | 'targetId' | 'x' | 'y'>): { at: [number, number]; gone: boolean } => {
    if (t.on === 'card') {
      const c = cards.find((x) => x.id === t.targetId)
      return c ? { at: [c.x + CARD.w, c.y + CARD.h], gone: false } : { at: [t.x, t.y], gone: true }
    }
    if (t.on === 'label') {
      const l = labels.find((x) => x.id === t.targetId)
      if (!l) return { at: [t.x, t.y], gone: true }
      const b = labelBox(l)
      return { at: [b.x + b.w, b.y + b.h], gone: false }
    }
    if (t.on === 'plane') {
      const p = pieces.find((x) => x.id === t.targetId)
      return p ? { at: [p.x + p.w, p.y + p.h], gone: false } : { at: [t.x, t.y], gone: true }
    }
    // A link (D-207): the middle between its cards' centres.
    if (t.on === 'link') {
      const e = edges.find((x) => x.id === t.targetId)
      const [a, b] = [cards.find((c) => c.id === e?.fromId), cards.find((c) => c.id === e?.toId)]
      return a && b ? { at: [(a.x + b.x + CARD.w) / 2, (a.y + b.y + CARD.h) / 2], gone: false } : { at: [t.x, t.y], gone: true }
    }
    return { at: [t.x, t.y], gone: false }
  }
  const spaceName = (sp: string) => {
    const p = pieces.find((x) => x.id === sp)
    return sp === CANVAS ? 'the canvas' : p?.name || `a ${p ? KIND_NAME[kindOfPiece(p)] : 'plane'}`
  }
  const titleOf = (t: Pick<Thread, 'on' | 'targetId' | 'planeId'>) => {
    if (t.on === 'card') {
      const c = cards.find((x) => x.id === t.targetId)
      return c ? `${c.type} ${c.title ? `"${c.title}"` : ''}`.trim() : 'a deleted card'
    }
    if (t.on === 'label') {
      const l = labels.find((x) => x.id === t.targetId)
      return l ? `${l.kind ?? (l.size === 'note' ? 'paragraph' : 'heading')} ${l.text ? `"${l.text.slice(0, 40)}"` : ''}`.trim() : 'deleted text'
    }
    if (t.on === 'plane') {
      const p = pieces.find((x) => x.id === t.targetId)
      return `${p ? KIND_NAME[kindOfPiece(p)] : 'plane'} ${p?.name ? `"${p.name}"` : ''}`.trim()
    }
    if (t.on === 'link') {
      const e = edges.find((x) => x.id === t.targetId)
      const name = (id?: string) => cards.find((c) => c.id === id)?.title || 'untitled'
      return e ? `link "${name(e.fromId)}" → "${name(e.toId)}"` : 'a deleted link'
    }
    return `a spot on ${spaceName(t.planeId ?? CANVAS)}`
  }
  // Right-click (D-193): a menu on a plane, a card, a piece of text or a link (D-207); only `comment` for now. Elsewhere, nothing.
  const [menu, setMenu] = useState<{ at: [number, number]; items: MenuItem[] } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const rightClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, [role=dialog], [aria-label=Threads]')) return
    e.preventDefault()
    if (focusId && !useCanvasView.getState().focusArrived) return
    const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-target]')?.dataset.target
    if (!hit) return setMenu(null)
    const [on, targetId] = hit.split(':') as ['card' | 'label' | 'plane' | 'link', string]
    // A plane on the canvas is in the canvas; a card or text, in the space it's written in.
    const where = on === 'plane' ? CANVAS : space
    const r = root.current!.getBoundingClientRect()
    setMenu({
      at: [e.clientX - r.left, e.clientY - r.top],
      items: [
        {
          label: 'comment',
          hint: threadOn(threads, targetId) ? 'open' : undefined,
          // Its conversation if it has one; a new one otherwise.
          onSelect: () => {
            const open = threadOn(threads, targetId)
            if (open) return openThread(open.id)
            const { at } = pinOf({ on, targetId, x: 0, y: 0 })
            startComment({ on, targetId, planeId: where, at: [Math.round(at[0]), Math.round(at[1])] })
          },
        },
      ],
    })
  }
  // From the threads panel: to its space, the pin in the middle, open.
  const goTo = (t: WithId<Thread>) => {
    const sp = t.planeId ?? CANVAS
    openThread(t.id)
    if (sp !== space) return focusTo(sp === CANVAS ? null : sp)
    const [x, y] = pinOf(t).at
    const { size, planeCam } = useCanvasView.getState()
    if (focusId && planeCam) glide(planeCam, { ...planeCam, ox: size.w / 2 - x * planeCam.zoom, oy: size.h / 2 - y * planeCam.zoom }, 420, (c) => useCanvasView.setState({ planeCam: c }))
    else if (!focusId) {
      const c = camOf(wid)
      glide(c, { ...c, x: -x * c.zoom, y: -y * c.zoom }, 420, (v) => setCam(wid, v))
    }
  }
  const openId = useThreadView((s) => s.openId)
  const openThreadDoc = threads.find((t) => t.id === openId) ?? null
  // A thread left open on a thread that's gone (deleted by someone) closes.
  useEffect(() => {
    if (openId && !openThreadDoc) closeThread()
  }, [openId, openThreadDoc])
  // Where a plane is on screen now.
  const screenRect = (p: Piece): ScreenRect => {
    const c = camOf(wid)
    const { w, h } = useCanvasView.getState().size
    return { x: onPixel(w / 2 + c.x) + p.x * c.zoom, y: onPixel(h / 2 + c.y) + p.y * c.zoom, w: p.w * c.zoom, h: p.h * c.zoom, zoom: c.zoom }
  }
  const focus = (p: WithId<Piece>) => {
    useCanvasView.setState({ focusSpread: true, focusArrived: false, focusLeaving: false, selected: null })
    setParams({ focus: p.id })
  }
  const unfocus = () => {
    if (!focused || useCanvasView.getState().focusLeaving) return
    useCanvasView.setState({ focusLeaving: true })
  }
  unfocusRef.current = unfocus
  const left = () => {
    useCanvasView.setState({ focusSpread: false, focusArrived: false, focusLeaving: false, cardSelected: null, cardEditing: null, linkSelected: null, linking: null })
    setParams({}, { replace: true })
  }
  // Left by the back button, or a plane deleted (by someone else) while in focus: nothing to animate.
  useEffect(() => {
    if (!focusId) useCanvasView.setState({ focusSpread: false, focusArrived: false, focusLeaving: false, cardSelected: null, cardEditing: null, linkSelected: null, linking: null })
  }, [focusId])
  useEffect(() => {
    if (focusId && !focused && pieces.length > 0) setParams({}, { replace: true })
  }, [focusId, focused, pieces.length, setParams])

  // Once in focus: on to the place go to picked (D-196), or its contents fitted to the screen (D-186, D-187); at once
  // when it came without the ink.
  const arriveRef = useRef(false)
  const arrive = () => {
    if (!focused) return
    const { pending } = useGoTo.getState()
    useGoTo.setState({ pending: null })
    const instant = !useCanvasView.getState().focusSpread
    if (instant) useCanvasView.setState((s) => ({ planeCam: s.planeHome }))
    if (pending?.space === focused.id) goToPlace(wid, pending, true)
    else fitRef.current(instant)
  }
  const arriveLate = useRef(arrive)
  arriveLate.current = arrive
  useEffect(() => {
    if (size.w === 0 || !arriveRef.current) return
    arriveRef.current = false
    arriveLate.current()
  }, [size.w])

  // The screen box, for the middle of the screen and zooming round the pointer.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const ro = new ResizeObserver(() => useCanvasView.setState({ size: { w: el.clientWidth, h: el.clientHeight } }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Opening a workspace, the first time in this tab, frames everything on its canvas at once (D-202), as fit does;
  // coming back finds the canvas where it was left.
  useEffect(() => {
    if (size.w === 0 || useCanvasView.getState().cams[wid]) return
    fitCanvas(wid, [...pieces, ...canvasLabels.map(labelBox)], true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wid, size.w])

  // Wheel zoom round the pointer; a listener of our own, since React's wheel handlers are passive.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      // Over the threads panel, an open thread or a menu, the wheel scrolls them (D-197).
      if ((e.target as HTMLElement).closest(SCROLLS_ITSELF)) return
      e.preventDefault()
      // A plane in focus is the view: the canvas behind it stays where it was.
      if (focusedRef.current) return
      const c = camOf(wid)
      const r = el.getBoundingClientRect()
      // The pointer from the screen's middle, which the camera is measured from.
      const px = e.clientX - r.left - r.width / 2
      const py = e.clientY - r.top - r.height / 2
      // The wheel moves a zoom of its own; inside the catch the camera stays at exactly 1. Anything else that set the
      // camera's zoom starts the wheel from there.
      const prev = wheelZoom.get(wid)
      const from = prev !== undefined && (c.zoom === 1 ? Math.abs(prev - 1) < ZOOM_CATCH : prev === c.zoom) ? prev : c.zoom
      const raw = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, from * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))))
      wheelZoom.set(wid, raw)
      const zoom = Math.abs(raw - 1) < ZOOM_CATCH ? 1 : raw
      if (zoom === c.zoom) return
      const k = zoom / c.zoom
      setCam(wid, { zoom, x: px - (px - c.x) * k, y: py - (py - c.y) * k })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [wid])

  // Delete (in edit mode) and Escape for the selected plane, unless typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, [contenteditable], dialog')) return
      // An open thread or the threads panel hears Escape first (D-192); `c` shows or hides the pins.
      const tv = useThreadView.getState()
      if (e.key === 'Escape' && (tv.openId || tv.draft || tv.inbox)) return
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) return toggleThreadPins()
      // Fit (D-186): the canvas's planes, or in focus the plane's contents.
      if (e.key === '0' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        fitRef.current()
        return
      }
      // Text anywhere (D-188): Delete takes the selected one away, Escape lets go of it (or stops drawing a section).
      const { labelSelected, drawing } = useCanvasView.getState()
      if (drawing && e.key === 'Escape') return useCanvasView.setState({ drawing: null })
      const label = allLabelsRef.current.find((l) => l.id === labelSelected)
      if (label) {
        if (e.key === 'Escape') return useCanvasView.setState({ labelSelected: null })
        if ((e.key === 'Delete' || e.key === 'Backspace') && editor) {
          e.preventDefault()
          useCanvasView.setState({ labelSelected: null })
          return void deleteLabel(wid, label)
        }
      }
      // In focus: Delete takes the selected card away (D-187); Escape lets go of it, or goes back to the canvas.
      if (focusedRef.current) {
        // A selected link (D-207): Escape lets go of it, Delete removes it.
        const { linkSelected } = useCanvasView.getState()
        if (linkSelected) {
          if (e.key === 'Escape') return useCanvasView.setState({ linkSelected: null })
          if ((e.key === 'Delete' || e.key === 'Backspace') && editor) {
            e.preventDefault()
            useCanvasView.setState({ linkSelected: null })
            return void deleteEdge(wid, linkSelected)
          }
        }
        const { cardSelected } = useCanvasView.getState()
        const card = focusedCardsRef.current.find((c) => c.id === cardSelected)
        if (e.key === 'Escape') {
          // A card, or a matrix's cell (D-204), lets go first; then the setup closes; then focus goes.
          if (cardSelected) useCanvasView.setState({ cardSelected: null })
          else if (useMatrixUi.getState().setup) useMatrixUi.setState({ setup: false })
          else if (useTableUi.getState().setup) useTableUi.setState({ setup: false })
          else unfocusRef.current()
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && card && editor) {
          e.preventDefault()
          useCanvasView.setState({ cardSelected: null })
          void deleteCard(wid, card, edgesRef.current)
        }
        return
      }
      const id = useCanvasView.getState().selected
      if (!id) return
      if (e.key === 'Escape') useCanvasView.setState({ selected: null })
      if ((e.key === 'Delete' || e.key === 'Backspace') && editor && useCanvasView.getState().editing.includes(id)) {
        e.preventDefault()
        useCanvasView.setState({ confirming: id })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wid, editor])

  // A selection from another workspace, or one deleted (by someone else, or undone), lets go.
  useEffect(() => {
    if (selected && !pieces.some((p) => p.id === selected)) useCanvasView.setState({ selected: null })
  }, [selected, pieces])

  // A double-click on a plane takes it into focus, as its console's `[focus]` does (D-198). Not in edit mode, and not
  // through text, a chip or a button on it. Found by the point: the pan's pointer capture sends the click to the canvas.
  const doubleClick = (e: React.MouseEvent) => {
    if (focusedRef.current) return
    const hit = document.elementFromPoint(e.clientX, e.clientY)
    if (!hit || hit.closest('button, input, textarea, a')) return
    const id = hit.closest<HTMLElement>('[data-target]')?.dataset.target?.match(/^plane:(.+)$/)?.[1]
    const p = id && pieces.find((x) => x.id === id)
    if (!p || useCanvasView.getState().editing.includes(p.id)) return
    stopFollowing()
    focus(p)
  }

  const pan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    useCanvasView.setState({ selected: null, labelSelected: null })
    stopFollowing()
    const start = camOf(wid)
    const [sx, sy] = [e.clientX, e.clientY]
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    el.dataset.panning = 'true'
    const move = (ev: PointerEvent) => setCam(wid, { ...start, x: start.x + ev.clientX - sx, y: start.y + ev.clientY - sy })
    const up = () => {
      delete el.dataset.panning
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  return (
    <div ref={root} className={styles.canvas} onPointerDown={pan} onDoubleClick={doubleClick} onContextMenu={rightClick} aria-label="Canvas" role="application">
      <div ref={lens} className={styles.lens}>
      <div
        className={styles.world}
        style={{ transform: `translate(${onPixel(size.w / 2 + cam.x)}px, ${onPixel(size.h / 2 + cam.y)}px) scale(${cam.zoom})` }}
      >
        {pieces.map((p) => (
          <PieceBox
            key={p.id}
            piece={p}
            cam={cam}
            selected={p.id === selected}
            editing={editor && editing.includes(p.id)}
            editor={editor}
            onFocus={() => focus(p)}
            focusing={p.id === focusId}
            cards={cardsOf(p.id)}
            labels={labelsOf(p.id)}
            content={contentOf(p)}
          />
        ))}
        {/* The canvas's own sections over its planes (no fill, so they hide nothing), its text over them (D-188). */}
        <TextItems labels={canvasLabels} layer="frames" live editor={editor} zoom={cam.zoom} carry={pieceCarry} />
        <TextItems labels={canvasLabels} layer="text" live editor={editor} zoom={cam.zoom} carry={pieceCarry} />
      </div>
      </div>
      {focused && (
        <FocusedPlane
          key={focused.id}
          piece={focused}
          at={screenRect(focused)}
          home={homeOf(focused, screenRect(focused), contentOf(focused))}
          bare={focusedBare}
          // A matrix's table glides from where it sits to the middle of the screen while the page fills in behind it.
          onSpread={focusedBare ? () => fitRef.current() : undefined}
          spread={focusSpread}
          leaving={focusLeaving}
          lens={lens}
          // Once there, its cards centred and fitted to the screen (D-186, D-187), or on to the place go to picked (D-196).
          onArrived={() => {
            useCanvasView.setState({ focusArrived: true })
            // Without the ink (a reload, a link) this can come before the screen is measured: it waits for that.
            if (useCanvasView.getState().size.w === 0) arriveRef.current = true
            else arrive()
          }}
          onLeft={left}
        >
          {focusedMatrix ? (
            <FocusedMatrix piece={focused} editor={editor} />
          ) : focusedTable ? (
            <FocusedTable piece={focused} editor={editor} />
          ) : (
            <FocusedCards cards={focusedCards} labels={focusedLabels} editor={editor} />
          )}
          {drawing === focused.id && <DrawSection space={focused.id} toSpace={planeToSpace} />}
          {focusedMatrix && editor && matrixSetup && focusArrived && !focusLeaving && <MatrixSetupPanel piece={focused} />}
          {focusedTable && editor && tableSetup && focusArrived && !focusLeaving && <TableSetupPanel piece={focused} />}
          {/* Once it's there, and gone the moment it leaves (D-185): the dock on the bottom edge (D-189). */}
          {focusArrived && !focusLeaving && (
            <FocusDock>
              {focusedMatrix && editor && (
                <DockAction label="setup" title="its rows, columns and cells" onClick={() => useMatrixUi.setState((s) => ({ setup: !s.setup }))} />
              )}
              {focusedTable && editor && (
                <DockAction label="setup" title="where its rows come from, its columns" onClick={() => useTableUi.setState((s) => ({ setup: !s.setup }))} />
              )}
              <DockAction label="unfocus" keyHint="esc" title="back to the canvas (Esc)" main onClick={unfocus} />
            </FocusDock>
          )}
        </FocusedPlane>
      )}
      {drawing === CANVAS && !focused && <DrawSection space={CANVAS} toSpace={canvasToSpace} />}
      <PeerCursors space={space} toScreen={toScreen} />
      {menu && <ContextMenu at={menu.at} items={menu.items} onClose={closeMenu} />}
      <ThreadInbox wid={wid} threads={threads} titleOf={titleOf} onGo={(t) => openThread(t.id)} onShow={goTo} isOwner={isOwnerOf(workspace, user?.id)} whereOf={(t) => spaceName(t.planeId ?? CANVAS)} here={spaceName(space)} goneOf={(t) => pinOf(t).gone} scopeName={(id) => `"${pieces.find((p) => p.id === id)?.name || 'plane'}"`} />
      <Follow focusId={focusId} focusTo={focusTo} />
      {confirming && (
        <HazardConfirm
          title={`delete ${confirming.name ? `"${confirming.name}"` : `this ${KIND_NAME[kindOfPiece(confirming)]}`}?`}
          lines={[isBare(confirming) ? `The ${KIND_NAME[kindOfPiece(confirming)]} and its cells go; the cards in it stay.` : 'The plane and everything on it goes.', `${UNDO_HINT} brings it back.`]}
          confirm="delete"
          onCancel={() => useCanvasView.setState({ confirming: null })}
          onConfirm={() => {
            useCanvasView.setState({ confirming: null })
            setEditing(confirming.id, false)
            void deletePiece(wid, confirming.id, cards, labels, cells, kindOfPiece(confirming), edges)
          }}
        />
      )}
    </div>
  )
}

const UNDO_HINT = navigator.platform.toLowerCase().includes('mac') ? '⌘Z' : 'Ctrl+Z'

type BoxProps = { piece: WithId<Piece>; cam: Cam; selected: boolean; editing: boolean; editor: boolean; onFocus: () => void; focusing: boolean; cards: Card[]; labels: Label[]; content: Bounds | null }

// What a piece shows of what's in it on the canvas (D-187): a plane's cards and text centred and fitted inside its box,
// never past 1; nothing = its own (0, 0) at its corner. Its px inside its 1 px edge. A matrix is a window: its table at
// its own size from the top-left, cut by the window's edge (D-208).
function innerView(box: Box, b: Bounds | null, bare = false): PlaneCam {
  if (!b || bare) return { ox: 0, oy: 0, zoom: 1 }
  const { zoom, cx, cy } = fitInto(b, box.w - 2, box.h - 2, GRID)
  return { ox: (box.w - 2) / 2 - cx * zoom, oy: (box.h - 2) / 2 - cy * zoom, zoom }
}

// That view on the screen, where focus starts from and goes back to.
function homeOf(piece: Piece, at: ScreenRect, content: Bounds | null): PlaneCam {
  const v = innerView(piece, content, isBare(piece))
  return { ox: at.x + at.zoom * (1 + v.ox), oy: at.y + at.zoom * (1 + v.oy), zoom: at.zoom * v.zoom }
}

// The focused matrix, live, on its own view (D-204).
function FocusedMatrix({ piece, editor }: { piece: WithId<Piece>; editor: boolean }) {
  const view = useCanvasView((s) => s.planeCam)
  return view ? <MatrixView piece={piece} view={view} live editor={editor} /> : null
}

// The focused table, live, on its own view (D-209).
function FocusedTable({ piece, editor }: { piece: WithId<Piece>; editor: boolean }) {
  const view = useCanvasView((s) => s.planeCam)
  return view ? <TableView piece={piece} view={view} live editor={editor} /> : null
}

// The focused plane's cards, live, on its own view.
function FocusedCards({ cards, labels, editor }: { cards: Card[]; labels: Label[]; editor: boolean }) {
  const view = useCanvasView((s) => s.planeCam)
  return view ? <PlaneCards cards={cards} labels={labels} view={view} live editor={editor} /> : null
}

// Resize handles (D-180, D-181): the corners are the cards' corner marks (D-150), grey on hover, long and cyan in edit
// mode, where they resize; the edges' middles get short bars. Each moves the sides it names.
const CORNERS = ['nw', 'ne', 'se', 'sw'] as const
const EDGES = ['n', 'e', 's', 'w'] as const
type Handle = (typeof CORNERS)[number] | (typeof EDGES)[number] | 'move'

// The box a press on `handle` turns `from` into after the pointer moved (dx, dy) canvas px; never under PIECE_MIN.
// Snapped (D-182): whatever edge moves lands on the 25 px grid; `free` (alt held) doesn't snap.
function dragBox(from: Box, handle: Handle, dx: number, dy: number, free: boolean): Box {
  const at = (v: number) => (free ? Math.round(v) : snap(v))
  if (handle === 'move') return { ...from, x: at(from.x + dx), y: at(from.y + dy) }
  let { x, y, w, h } = from
  const right = from.x + from.w
  const bottom = from.y + from.h
  if (handle.includes('e')) w = Math.max(PIECE_MIN.w, at(right + dx) - from.x)
  if (handle.includes('s')) h = Math.max(PIECE_MIN.h, at(bottom + dy) - from.y)
  if (handle.includes('w')) {
    x = Math.min(at(from.x + dx), right - PIECE_MIN.w)
    w = right - x
  }
  if (handle.includes('n')) {
    y = Math.min(at(from.y + dy), bottom - PIECE_MIN.h)
    h = bottom - y
  }
  return { x, y, w, h }
}

const same = (a: Box, b: Box) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h

function PieceBox({ piece, cam, selected, editing, editor, onFocus, focusing, cards, labels, content }: BoxProps) {
  const { wid } = useWs()
  const kind = kindOfPiece(piece)
  // Where a move or resize has it, held after the drop until the data gets there (else it would jump back for a moment).
  const [held, setHeld] = useState<Box | null>(null)
  useEffect(() => {
    if (held && same(held, piece)) setHeld(null)
  }, [held, piece])
  const box = held ?? piece
  // Carried by a section being dragged (D-188).
  const shift = useCanvasView((s) => (s.dragShift && s.dragShift.ids.includes(piece.id) ? s.dragShift : null))

  // Out of edit mode a press on a plane is the canvas's: it pans (D-186). In edit mode it selects the plane, and moving or
  // one of the handles changes its box (5 px before a press turns into a drag).
  const press = (handle: Handle) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !editing) return
    e.stopPropagation()
    useCanvasView.setState({ selected: piece.id })
    const [sx, sy] = [e.clientX, e.clientY]
    const from: Box = { x: piece.x, y: piece.y, w: piece.w, h: piece.h }
    let to: Box | null = null
    // On the window, not captured: a press that doesn't move stays a click.
    const move = (ev: PointerEvent) => {
      const [dx, dy] = [ev.clientX - sx, ev.clientY - sy]
      if (!to && Math.hypot(dx, dy) < DRAG_PX) return
      to = dragBox(from, handle, dx / cam.zoom, dy / cam.zoom, ev.altKey)
      setHeld(to)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (to && !same(to, from)) void placePiece(wid, piece.id, from, to, kind).catch(() => setHeld(null))
      else setHeld(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // Conversations (D-193, D-195): the one on the plane itself has its own chip under its corner, like any component's;
  // the ones on what's inside it are counted in its console, apart.
  const { threads } = useWs()
  const me = myUid()
  const seen = useReads(wid, me || null).data?.seen
  const own = threadOn(threads, piece.id)
  const mine = threads.filter((t) => !t.resolved && t.planeId === piece.id)
  const freshOnes = mine.filter((t) => isNew(t, seen, t.id, me))
  const comments = {
    count: mine.length,
    fresh: freshOnes.length > 0,
    mentioned: freshOnes.some((t) => t.mentions?.includes(me)),
    onOpen: () => toggleInbox(true, piece.id),
  }
  // Its cards fitted inside it, and its marks with them (D-187).
  const bare = isBare(piece)
  const inner = innerView(box, content, bare)
  const step = GRID * inner.zoom
  return (
    <div
      className={styles.piece}
      data-selected={selected || undefined}
      data-editing={editing || undefined}
      data-dragging={held ? true : undefined}
      // What the right-click menu comments on (D-193).
      data-target={`plane:${piece.id}`}
      data-kind={kind}
      // A matrix in focus is its focused copy's: the one here would show under it as it glides.
      data-away={bare && focusing ? true : undefined}
      style={{ left: box.x + (shift?.dx ?? 0), top: box.y + (shift?.dy ?? 0), width: box.w, height: box.h, ['--mark' as string]: `${step}px`, ['--mx' as string]: `${inner.ox - step / 2}px`, ['--my' as string]: `${inner.oy - step / 2}px` }}
      onPointerDown={press('move')}
    >
      {editing ? (
        <NameField value={piece.name ?? ''} placeholder={KIND_NAME[kind]} onSave={(name) => name !== (piece.name ?? '') && void renamePiece(wid, piece.id, name, kind)} />
      ) : (
        <span className={styles.name} data-unnamed={!piece.name || undefined}>
          {piece.name || KIND_NAME[kind]}
        </span>
      )}
      <PeerRing id={piece.id} space={CANVAS} />
      {/* A comment on the plane itself (D-195), not on what's in it. */}
      <ThreadChip wid={wid} thread={own} zoom={cam.zoom} />
      {/* What's in it, a picture here: the pointer goes through to the canvas (D-186, D-187). */}
      {kind === 'matrix' ? (
        <MatrixView piece={piece} view={inner} live={false} editor={editor} />
      ) : kind === 'table' ? (
        <TableView piece={piece} view={inner} live={false} editor={editor} />
      ) : (
        <PlaneCards cards={cards} labels={labels} view={inner} live={false} editor={editor} />
      )}
      {CORNERS.map((h) => (
        <span key={h} className={styles.mark} data-handle={h} onPointerDown={editing ? press(h) : undefined} aria-hidden />
      ))}
      {editing && EDGES.map((h) => <span key={h} className={styles.bar} data-handle={h} onPointerDown={press(h)} aria-hidden />)}
      <PlaneConsole
        // In focus, or on its way there or back (D-185), the plane's console isn't here.
        className={focusing ? styles.consoleAway : undefined}
        size={editing ? box : null}
        noun={KIND_NAME[kind]}
        onEdit={editor ? () => setEditing(piece.id, !editing) : undefined}
        onDelete={() => useCanvasView.setState({ confirming: piece.id })}
        onFocus={onFocus}
        comments={comments}
      />
    </div>
  )
}

// The name in the top edge in edit mode (D-180): always a field, as wide as what's typed; Enter or leaving it keeps
// it, Escape puts back what it was.
function NameField({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  // Someone else renaming it shows here unless you're typing.
  useEffect(() => {
    if (!focused) setDraft(value)
  }, [value, focused])
  return (
    <input
      className={`${styles.name} ${styles.nameField}`}
      aria-label="Plane name"
      value={draft}
      placeholder={placeholder}
      maxLength={PIECE_NAME_MAX}
      // As wide as what's typed, its letter spacing included, plus room for the caret.
      style={{ width: `calc(${Math.max(draft.length, placeholder.length) + 1} * (1ch + var(--track-label)))` }}
      onChange={(e) => setDraft(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        onSave(draft.trim())
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(value)
          // Blurs after the draft is back, so nothing changes.
          requestAnimationFrame(() => (document.activeElement as HTMLElement | null)?.blur())
        }
      }}
    />
  )
}

// A plane's console (D-179, D-180, D-181, D-189): always open, a tab inside the plane's bottom-right corner, its
// actions bracketed: `[focus] [edit]` (no name: it's on the plane, D-182; no zoom: the wheel does it,
// D-186). `focus` makes the plane the view (D-184); in focus `unfocus` is on the focus dock (D-189).
// In edit mode it turns into a status line with the plane's live size and what can be done, `[delete]` (confirmed first,
// D-182) and `[done]`, which ends edit mode. Viewers never get to edit mode.
type ConsoleProps = {
  // Its comments (D-193): on the plane and inside it, seen without going in; opens the threads panel on them.
  comments?: { count: number; fresh: boolean; mentioned: boolean; onOpen: () => void }
  size: Box | null
  // What it is, in its tips: a plane, a matrix.
  noun?: string
  onFocus: () => void
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

function PlaneConsole({ comments, size, noun = 'plane', onFocus, onEdit, onDelete, className }: ConsoleProps) {
  return (
    <div
      className={`${styles.console} ${className ?? ''}`}
      role="toolbar"
      aria-label={noun}
      data-editing={size ? true : undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {size ? (
        <>
          <span className={styles.mode}>EDIT</span>
          <span className={styles.readout}>
            {size.w} × {size.h}
          </span>
          {onDelete && (
            <button className={styles.tool} data-tone="danger" title={`delete the ${noun} (Delete)`} onClick={onDelete}>
              delete
            </button>
          )}
          {onEdit && (
            <button className={styles.tool} aria-pressed title="stop moving, resizing and renaming" onClick={onEdit}>
              done
            </button>
          )}
        </>
      ) : (
        <>
          {comments && comments.count > 0 && (
            <button
              className={styles.tool}
              data-new={comments.fresh || undefined}
              title={`${comments.count} conversation${comments.count === 1 ? '' : 's'} inside this ${noun}${comments.fresh ? ', something new' : ''}`}
              aria-label={`Comments inside, ${comments.count}`}
              onClick={comments.onOpen}
            >
              {comments.mentioned ? '@' : <CommentIcon size={11} />} {comments.count} inside
            </button>
          )}
          <button className={styles.tool} aria-pressed={false} title={`make the ${noun} the view`} onClick={onFocus}>
            focus
          </button>
          {onEdit && (
            <button className={styles.tool} aria-pressed={false} title={noun === 'plane' ? 'move, resize or rename the plane' : `move or rename the ${noun}`} onClick={onEdit}>
              edit
            </button>
          )}
        </>
      )}
    </div>
  )
}
