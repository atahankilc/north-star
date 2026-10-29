// /workspaces/:wid: the workspace's canvas (D-174, D-176). An infinite space over the flowing backdrop, with no grid
// marks. Planes are placed on it from the side nav's `+`, at the middle of the screen; tables and the rest come later.
// Drag to pan, the wheel zooms round the pointer: always the canvas, over a plane too (D-186), until a plane is in focus,
// when they're the plane's (FocusedPlane). A plane is moved, resized and renamed only in edit mode (D-180), switched on
// and off from its console; in edit mode it takes the drag, it's selected, and Delete takes it away. Escape or a click on
// empty space lets go of the selection. `0` (or the side nav's fit) frames everything, or in focus the plane's contents.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../data/auth'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { canOpen, deletePiece, followTo, linkLens, openPiece, pieceRef, KIND_NAME, isBare, isHost, hostKind, kindOfPiece, sticks, placeLens, STICK_GAP, stickTarget, touchSide, PIECE_MIN, PIECE_NAME_MAX, placePiece, renamePiece, snap, type Box } from '../../data/pieces'
import { HazardConfirm } from '../../ui/HazardConfirm'
import type { MenuEntry } from '../../ui/Menu'
import { Select } from '../../ui/Select'
import { canEditIn } from '../../data/workspaces'
import { camOf, fitCanvas, fitInto, fitPlane, setCam, setEditing, useCanvasView, type Bounds, type PlaneCam, type ScreenRect } from '../../state/canvasView'
import { useWs } from './context'
import { FocusedPlane } from './FocusedPlane'
import { ViewMenu } from './ViewMenu'
import { planeCtx, planeItems } from './planeMenu'
import { PlaneDockExtras } from './FilterDock'
import { closeThread, CommentIcon, myUid, openThread, startComment, ThreadChip, threadIn, threadOn, toggleInbox, toggleThreadPins, useThreadView } from './Threads'
import { ContextMenu } from './ContextMenu'
import { BringCards } from './BringCards'
import { isNew, useReads } from '../../data/threads'
import { ThreadInbox } from './ThreadInbox'
import { CARD } from '../../data/cards'
import { glide, stopGlide } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import { isOwnerOf } from '../../data/workspaces'
import type { Thread } from '../../data/model'
import { Follow, PeerCursors, stopFollowing, useCursorReport, usePeersOn, usePresenceReport } from './collab'
import { deleteHere, heldAt } from './selection'
import { alikeProps } from './kept'
import { cardsByPlane, elsewhere } from '../../data/places'
import { runCells } from '../../ui/Appear'
import { EVERY_HANDLE, Landing, Marks, ZOOM_SETTLE_MS } from '../../ui/Marks'
import { DrawSection } from './DrawSection'
import { labelBox, TextItems } from './TextItems'
import { spaceBounds } from './spaceBounds'
import { CANVAS, deleteLabel, type Label } from '../../data/labels'
import { canvasOf, canvasTextOn, onCanvas } from '../../data/canvases'
import { canvasParams } from '../../app/paths'
import { PlaneCards } from './PlaneCards'
import { LensCardPanel } from './CardPanel'
import { DockAction, FocusDock } from './FocusDock'
import { deleteCards, isOnPlane, type Card } from '../../data/cards'
import { deleteEdge } from '../../data/edges'
import { GRID } from '../../data/grid'
import { goToPlace, useGoTo, type Place } from './goTo'
import { matrixBounds, MatrixView, useMatrixUi } from './Matrix'
import { MatrixSetupPanel } from './MatrixSetup'
import { tableBounds, TablePager, TableView, useTableUi } from './Table'
import { TableSetupPanel } from './TableSetup'
import { KanbanSetupPanel } from './KanbanSetup'
import { Beside, type EscNext } from './Beside'
import { TasksSide } from './TasksSide'
import { closeTasksSide, toggleTasksSide, useTasksSide } from './sideState'
import { isOpen, OPEN_PAD, shownPieces, useOpenSize } from './shownBox'
import { deleteDocument, downloadDocument, moveReports, unshareDocument, type Doc } from '../../data/documents'
import { closeDocs, shareOrAsk, documentsBounds, documentsOf, DocumentsTools, DocumentsView, listed, openDoc, pinnedView, readerLeft, uploadFiles, useDocUi } from './Documents'
import { DocFocus, DocPlace, DocReaders, documentBounds, documentHome, DocumentPieceView, membersOf, piecesOfDoc } from './DocumentPiece'
import { clearFound, useFind } from './find'
import { kanbanBounds, KanbanDockTools, KanbanLanes, KanbanView, selectTask, useKanbanSizes, useKanbanUi } from './Kanban'
import { timelineBounds, TimelineDockTools, TimelineView, TimelineWeeks } from './Timeline'
import { KanbanFilterDock } from './KanbanFilterDock'
import { TaskPanel } from './TaskPanel'
import { usePlaneFilter } from './planeFilter'
import styles from './CanvasView.module.css'

// What the wheel scrolls rather than zooms: the threads panel, an open thread, a menu.
export const SCROLLS_ITSELF = 'section[aria-label=Threads], [role=dialog], [role=menu], [data-scrolls]'

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
  const { wid, workspace, pieces: everyPiece, cards, labels: everyLabel, threads, cells, edges, documents, tasks, places, canvas } = useWs()
  // Only what's on the canvas shown (D-302): its pieces, and its own text with the planes' (theirs go with them).
  // Looked up by id (a thread's plane, a focus asked for), every piece.
  const pieces = useMemo(() => everyPiece.filter(onCanvas(canvas)), [everyPiece, canvas])
  const labels = useMemo(() => everyLabel.filter((l) => l.pieceId !== CANVAS || canvasTextOn(canvas)(l)), [everyLabel, canvas])
  const { user } = useAuth()
  const editor = canEditIn(workspace, user?.id)
  // Not the camera itself: a pan or a zoom step moves only the world (World, below), and this draws again when the zoom
  // it shows settles.
  const zoom = useShownZoom(wid)
  const size = useCanvasView((s) => s.size)
  const selected = useCanvasView((s) => s.selected)
  const editing = useCanvasView((s) => s.editing)
  const confirmingId = useCanvasView((s) => s.confirming)
  const confirming = pieces.find((p) => p.id === confirmingId) ?? null
  // Cards also on other planes, deleted everywhere (D-281).
  const deletingCards = useCanvasView((s) => s.deleting)
  const root = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLDivElement>(null)
  // The plane in focus (D-184), in the address so back leaves it and a reload stays in it.
  const [params, setParams] = useSearchParams()
  const focusId = params.get('focus')
  const focused = focusId ? (everyPiece.find((p) => p.id === focusId) ?? null) : null
  const focusedBare = Boolean(focused && isBare(focused))
  const focusSpread = useCanvasView((s) => s.focusSpread)
  const focusArrived = useCanvasView((s) => s.focusArrived)
  const focusLeaving = useCanvasView((s) => s.focusLeaving)
  const focusedRef = useRef(false)
  focusedRef.current = Boolean(focused)
  const unfocusRef = useRef(() => {})
  const piecesRef = useRef(pieces)
  piecesRef.current = pieces
  // As they're drawn: one opened onto the canvas as big as its contents (D-228).
  // An open documents list, document (D-234), kanban or timeline (D-289) is as big as it came out when drawn.
  const openSizes = useOpenSize()
  // Only the unframed kanbans' sizes: a framed one growing (a task added) draws nothing here.
  const kanbanSizes = useKanbanSizes((s) => pieces.filter((p) => p.kind === 'kanban' && isOpen(p)).map((p) => `${s[p.id]?.w}×${s[p.id]?.h}`).join())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shown = useMemo(() => shownPieces(pieces, cards), [pieces, cards, openSizes, kanbanSizes])
  // Each space's cards and text, kept the same lists until they change: what's in a piece isn't drawn again as the
  // camera moves (the pieces' contents are memoised, below). A plane's cards include those brought from others (D-281).
  // A space whose things didn't change keeps its list, so a change on one plane draws only that one.
  const lastCards = useRef(new Map<string, Card[]>())
  const lastLabels = useRef(new Map<string, Label[]>())
  const cardsBy = useMemo(() => (lastCards.current = keepLists(lastCards.current, cardsByPlane(cards, places))), [cards, places])
  const labelsBy = useMemo(() => (lastLabels.current = keepLists(lastLabels.current, groupBy(labels, (l) => l.pieceId))), [labels])
  const cardsOf = (id: string) => cardsBy.get(id) ?? NONE
  const labelsOf = (id: string) => labelsBy.get(id) ?? NONE
  const canvasLabels = labelsOf(CANVAS)
  const focusedCards = focused ? cardsOf(focused.id) : []
  const focusedLabels = focused ? labelsOf(focused.id) : []
  const focusedMatrix = focused && kindOfPiece(focused) === 'matrix'
  const focusedTable = focused && kindOfPiece(focused) === 'table'
  // Documents (D-232): the list, and one on its own.
  const focusedDocuments = focused && kindOfPiece(focused) === 'documents'
  const focusedDocument = focused && kindOfPiece(focused) === 'document'
  // A kanban (D-251), a timeline (D-262).
  const focusedKanban = focused && kindOfPiece(focused) === 'kanban'
  const focusedTimeline = focused && kindOfPiece(focused) === 'timeline'
  const readerOpen = useDocUi((s) => s.readers.length > 0) && !!focusedDocuments
  // The list put away while documents are open: they fill the screen, and Escape goes straight back to the canvas.
  const listHidden = useDocUi((s) => s.listHidden) && readerOpen
  const sideBySide = useDocUi((s) => s.sideBySide)
  // What's stuck to the focused plane (D-210) or kanban (D-262), and what of it is open beside it (D-211), in the address
  // (`beside`).
  const stuckHere = focused && isHost(focused) ? pieces.filter((p) => p.stuckTo === focused.id && sticks(p)) : []
  const besideIds = (params.get('beside') ?? '').split(',').filter(Boolean)
  const besideOpen = besideIds.flatMap((id) => stuckHere.filter((p) => p.id === id))
  const besideRef = useRef(besideOpen)
  besideRef.current = besideOpen
  const split = useCanvasView((s) => s.split)
  const setBeside = (ids: string[]) => focusId && setParams(canvasParams(canvas, ids.length ? { focus: focusId, beside: ids.join(',') } : { focus: focusId }))
  const toggleBeside = (id: string) => setBeside(besideIds.includes(id) ? besideIds.filter((x) => x !== id) : [...besideIds, id])
  const sideOpen = useTasksSide((s) => s.open)
  const setBesideRef = useRef(setBeside)
  setBesideRef.current = setBeside
  const matrixSetup = useMatrixUi((s) => s.setup)
  const tableSetup = useTableUi((s) => s.setup)
  // A kanban's setup (D-268).
  const kanbanSetup = useKanbanUi((s) => s.setup)
  const matrixOnCanvas = useMatrixUi((s) => s.canvas)
  const canvasSetup = pieces.find((p) => isOpen(p) && (kindOfPiece(p) === 'matrix' ? matrixSetup && p.id === matrixOnCanvas : p.id === tableSetup || p.id === kanbanSetup)) ?? null
  // What Escape closes next, after a selection (D-211): a setup, then what's beside (the last opened), then focus. The
  // dock whose action that is shows `esc` on it; the key handler below goes in the same order.
  const matrixPane = besideOpen.find((p) => kindOfPiece(p) === 'matrix')?.id ?? null
  // Documents beside their list (D-232): Escape closes the last one; with the list put away, a framed list comes back,
  // an unframed one (opened from the canvas) goes straight back to the canvas.
  const focusedUnframed = !!focused && isOpen(focused)
  const focusedUnframedRef = useRef(focusedUnframed)
  focusedUnframedRef.current = focusedUnframed
  const escNext: EscNext = readerOpen && !(listHidden && focusedUnframed)
    ? { what: 'close', id: 'reader' }
    : matrixSetup && focused && (focusedMatrix || matrixPane)
      ? { what: 'setup', id: focusedMatrix ? focused.id : matrixPane! }
      : tableSetup
        ? { what: 'setup', id: tableSetup }
        : kanbanSetup
          ? { what: 'setup', id: kanbanSetup }
          : sideOpen
          ? { what: 'close', id: 'tasks' }
          : besideOpen.length
          ? { what: 'close', id: besideOpen[besideOpen.length - 1].id }
          : 'unfocus'
  const escOn = (what: 'setup' | 'close') => (escNext !== 'unfocus' && escNext.what === what && escNext.id === focused?.id ? 'esc' : undefined)
  // What's in a piece, in its own px: a plane's cards and text, a matrix's table (D-204) or a table's (D-209).
  // A plane's filter changes what its box holds.
  const filters = usePlaneFilter((s) => s.byPlane)
  const contents = useMemo(() => {
    const of = (p: WithId<Piece>) => {
      const kind = kindOfPiece(p)
      return kind === 'matrix'
        ? matrixBounds(p, cards)
        : kind === 'table'
          ? tableBounds(p, cards)
          : kind === 'documents'
            ? documentsBounds(p, listed(documents, documentsOf(p), user?.id).length)
            : kind === 'document'
              ? documentBounds(p)
              : kind === 'kanban'
                ? kanbanBounds(p, tasks)
                : kind === 'timeline'
                  ? timelineBounds(p, pieces, tasks, cards)
                  : spaceBounds(cardsBy.get(p.id) ?? NONE, edges, labelsBy.get(p.id) ?? NONE, [], p.id)
    }
    return new Map(pieces.map((p) => [p.id, of(p)]))
  }, [pieces, cards, edges, cardsBy, labelsBy, documents, user?.id, filters, tasks])
  const contentOf = (p: WithId<Piece>) => contents.get(p.id) ?? null
  const bonds = (layer: 'under' | 'over') =>
    shown.map((p) => {
      const plane = p.stuckTo && sticks(p) ? hostsBox.find((x) => x.id === p.stuckTo) : undefined
      return plane ? <Bond key={`bond-${layer}-${p.id}`} piece={p} plane={plane} zoom={zoom} layer={layer} /> : null
    })
  // What can be stuck to, as boxes (D-210): planes, and kanbans for timelines (D-262).
  const hostsBox = shown.filter((p) => isHost(p)).map((p) => ({ id: p.id, x: p.x, y: p.y, w: p.w, h: p.h, name: p.name, kind: kindOfPiece(p) }))
  // What fit frames (D-186, D-188): the focused plane's cards and text, or the canvas's planes and text.
  const fitRef = useRef((_instant?: boolean) => {})
  fitRef.current = (instant = false) => {
    // The documents list with a document beside it: pinned top-left, fitted to its part (D-232); a document on its
    // own: at 100 %, its top near the top of the screen.
    if (focused && focusedDocuments && listHidden) return
    if (focused && focusedDocuments && readerOpen) setPlaneView(pinnedView(contentOf(focused)!, readerLeft(contentOf(focused)!, size.w, useDocUi.getState().readerAt)), instant)
    else if (focused && focusedDocument) setPlaneView(documentHome(focused, size.w), instant)
    // A timeline fills the screen at its own size (D-304): a box as big as the screen less fit's margins.
    else if (focused && focusedTimeline) fitPlane({ x: 0, y: 0, w: size.w - 192, h: size.h - 192 }, instant)
    else if (focused) fitPlane(contentOf(focused), instant)
    else fitCanvas(wid, [...shown, ...canvasLabels.map(labelBox)])
  }
  // The line between the list and its document dragged: the list fits its new part at once.
  const readerAt = useDocUi((s) => s.readerAt)
  useEffect(() => {
    if (focusedDocuments && readerOpen && useCanvasView.getState().focusArrived) fitRef.current(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerAt, size.w])
  // The last document closed with the list put away: a framed list shows again, an unframed one leaves for the canvas.
  const readerCount = useDocUi((s) => s.readers.length)
  const hadReaders = useRef(0)
  useEffect(() => {
    const was = hadReaders.current
    hadReaders.current = readerCount
    if (!focusedDocuments || was === 0 || readerCount > 0 || !useDocUi.getState().listHidden) return
    if (focusedUnframed) unfocus()
    else useDocUi.setState({ listHidden: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerCount])

  // Table to shelf and back (or other kinds, another page): the list fits again, centred (or pinned beside documents).
  const focusedBox = focused && focusedDocuments ? `${contentOf(focused)?.w}x${contentOf(focused)?.h}:${listHidden}` : ''
  useEffect(() => {
    if (focusedBox && useCanvasView.getState().focusArrived) fitRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedBox])
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
  // The finder's pick in a piece (D-236): into its focus first (arriving lands it, above); already there, at once.
  const foundAsked = useFind((s) => s.asked)
  // A place on the canvas picked from inside a focus: there once focus has gone.
  const foundOnCanvas = useRef<Place | null>(null)
  useEffect(() => {
    const t = useFind.getState().target
    if (t?.place) {
      clearFound()
      if (t.place.space !== CANVAS || !focusId) return goPlaceRef.current(t.place)
      foundOnCanvas.current = t.place
      return unfocusRef.current()
    }
    if (!t?.focus) return
    stopFollowing()
    if (focusId !== t.focus) return focusTo(t.focus)
    if (useCanvasView.getState().focusArrived && t.view) {
      setPlaneView(t.view, false)
      clearFound()
    }
    // When a pick asks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foundAsked])
  // Leaving where it was lit lets go of it.
  useEffect(() => {
    const t = useFind.getState().target
    if (t?.focus && t.focus !== focusId) clearFound()
    if (!focusId && foundOnCanvas.current) {
      goToPlace(wid, foundOnCanvas.current, false)
      foundOnCanvas.current = null
    }
    // When focus changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId])
  useEffect(() => {
    if (!asked) return
    useGoTo.setState({ asked: null })
    goPlaceRef.current(asked)
  }, [asked])
  const allLabelsRef = useRef(labels)
  allLabelsRef.current = labels
  const edgesRef = useRef(edges)
  edgesRef.current = edges
  const placesRef = useRef(places)
  placesRef.current = places
  const focusedCardsRef = useRef(focusedCards)
  focusedCardsRef.current = focusedCards
  const drawing = useCanvasView((s) => s.drawing)
  // What a canvas section carries besides text: the planes inside it.
  const pieceCarry = useMemo(() => shown.map((p) => ({ id: p.id, ref: pieceRef(wid, p.id), x: p.x, y: p.y, w: p.w, h: p.h })), [shown, wid])
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
    const p = everyPiece.find((x) => x.id === planeId)
    if (!p) return
    // From another plane straight to theirs: no ink (it would spread from a plane that isn't on screen).
    if (focusId) {
      useCanvasView.setState({ focusSpread: false, focusArrived: false, focusLeaving: false, cardSelected: null, labelSelected: null })
      selectTask('', null)
      setParams(canvasParams(canvasOf(p), { focus: planeId }))
    } else focus(p)
  }

  // Comment threads (D-192, D-193): where each one's chip is (a component's bottom-right corner), in its space's px;
  // what it's on, in words.
  const pinOf = (t: Pick<Thread, 'on' | 'targetId' | 'x' | 'y'> & { planeId?: string }): { at: [number, number]; gone: boolean } => {
    if (t.on === 'card') {
      // Its spot on the plane in focus when it's there (brought or not, D-281), else where the thread was made.
      const c = [focusId, t.planeId].flatMap((sp) => (sp ? (cardsOf(sp).find((x) => x.id === t.targetId) ?? []) : []))[0] ?? cards.find((x) => x.id === t.targetId)
      return c ? { at: [c.x + CARD.w, c.y + CARD.h], gone: false } : { at: [t.x, t.y], gone: true }
    }
    if (t.on === 'label') {
      // On another canvas too (D-302): not gone.
      const l = labels.find((x) => x.id === t.targetId) ?? everyLabel.find((x) => x.id === t.targetId)
      if (!l) return { at: [t.x, t.y], gone: true }
      const b = labelBox(l)
      return { at: [b.x + b.w, b.y + b.h], gone: false }
    }
    if (t.on === 'plane') {
      const p = shown.find((x) => x.id === t.targetId) ?? everyPiece.find((x) => x.id === t.targetId)
      return p ? { at: [p.x + p.w, p.y + p.h], gone: false } : { at: [t.x, t.y], gone: true }
    }
    // A link (D-207): the middle between its cards' centres.
    if (t.on === 'link') {
      const e = edges.find((x) => x.id === t.targetId)
      const [a, b] = [cards.find((c) => c.id === e?.fromId), cards.find((c) => c.id === e?.toId)]
      return a && b ? { at: [(a.x + b.x + CARD.w) / 2, (a.y + b.y + CARD.h) / 2], gone: false } : { at: [t.x, t.y], gone: true }
    }
    // A task (D-260): it has no place in its kanban's px worth keeping; only whether it's still there.
    if (t.on === 'task') return { at: [t.x, t.y], gone: !tasks.some((x) => x.id === t.targetId) }
    return { at: [t.x, t.y], gone: false }
  }
  // Where a thread is: a card's where the card is (D-290): the plane in focus when it's there, else the one the thread was
  // started on while it's still there, else its home. Another thread where it was started.
  const threadSpace = (t: Pick<Thread, 'on' | 'targetId' | 'planeId'>): string => {
    const c = t.on === 'card' ? cards.find((x) => x.id === t.targetId) : undefined
    if (!c) return t.planeId ?? CANVAS
    if (focusId && isOnPlane(c, focusId)) return focusId
    return isOnPlane(c, t.planeId) ? t.planeId : c.pieceId
  }
  // What the threads list says of it: that plane, `+N` when the card is on others too.
  const whereOf = (t: WithId<Thread>) => {
    const sp = threadSpace(t)
    const c = t.on === 'card' ? cards.find((x) => x.id === t.targetId) : undefined
    const more = c?.planes && sp !== space ? c.planes.length - 1 : 0
    return `${spaceName(sp)}${more ? ` +${more}` : ''}`
  }
  // A thread inside a plane, for the threads list's `inside "<plane>"` (D-281: a card's, on a card brought there too).
  const insideOf = useCallback((t: WithId<Thread>, plane: string) => threadIn(t, plane, cards), [cards])
  const spaceName = (sp: string) => {
    const p = everyPiece.find((x) => x.id === sp)
    return sp === CANVAS ? 'the canvas' : p?.name || `a ${p ? KIND_NAME[kindOfPiece(p)] : 'plane'}`
  }
  const titleOf = (t: Pick<Thread, 'on' | 'targetId'>) => {
    if (t.on === 'card') {
      const c = cards.find((x) => x.id === t.targetId)
      return c ? `${c.type} ${c.title ? `"${c.title}"` : ''}`.trim() : 'a deleted card'
    }
    if (t.on === 'label') {
      const l = labels.find((x) => x.id === t.targetId)
      return l ? `${l.kind ?? (l.size === 'note' ? 'paragraph' : 'heading')} ${l.text ? `"${l.text.slice(0, 40)}"` : ''}`.trim() : 'deleted text'
    }
    if (t.on === 'plane') {
      const p = everyPiece.find((x) => x.id === t.targetId)
      return `${p ? KIND_NAME[kindOfPiece(p)] : 'plane'} ${p?.name ? `"${p.name}"` : ''}`.trim()
    }
    if (t.on === 'task') {
      const k = tasks.find((x) => x.id === t.targetId)
      return k ? `task "${k.title.slice(0, 40)}"` : 'a deleted task'
    }
    const e = edges.find((x) => x.id === t.targetId)
    const name = (id?: string) => cards.find((c) => c.id === id)?.title || 'untitled'
    return e ? `link "${name(e.fromId)}" → "${name(e.toId)}"` : 'a deleted link'
  }
  // Right-click (D-193): a menu on a plane, a card, a piece of text or a link (D-207); only `comment` for now. Elsewhere, nothing.
  const [menu, setMenu] = useState<{ at: [number, number]; what: string; items: MenuEntry[] } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const rightClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, [role=dialog], [aria-label=Threads]')) return
    e.preventDefault()
    if (focusId && !useCanvasView.getState().focusArrived) return
    const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-target]')?.dataset.target
    // Inside a focused plane (D-237): what can be done with what's under the pointer, or added where it is.
    const inPlane = focused && !isBare(focused) ? planeCtx(wid, focused.id, editor, { cards, labels, edges, places, pieces }, { uid: user?.id, author: user?.name || user?.email || 'someone' }, planeToSpace(e.clientX, e.clientY), [e.clientX, e.clientY]) : null
    if (!hit) {
      const items = inPlane ? planeItems(null, null, inPlane) : []
      const r0 = root.current!.getBoundingClientRect()
      return setMenu(items.length ? { at: [e.clientX - r0.left, e.clientY - r0.top], what: 'plane', items } : null)
    }
    const [on, targetId] = hit.split(':') as ['card' | 'label' | 'plane' | 'link' | 'doc' | 'task', string]
    // A document in a list (D-232): its own menu, no comment (threads go on what's on the canvas).
    if (on === 'doc') {
      const d = documents.find((x) => x.id === targetId)
      const r = root.current!.getBoundingClientRect()
      return d ? setMenu({ at: [e.clientX - r.left, e.clientY - r.top], what: 'document', items: docMenu(d) }) : setMenu(null)
    }
    // A plane on the canvas is in the canvas; a card or text, in the space it's written in; a task, its kanban (D-260).
    const task = on === 'task' ? tasks.find((x) => x.id === targetId) : undefined
    if (on === 'task' && !task) return setMenu(null)
    const where = on === 'plane' ? CANVAS : task ? task.pieceId : space
    const r = root.current!.getBoundingClientRect()
    // What it's on, for the menu's `>` line (D-222): "do with this customer…".
    const label = on === 'label' ? labels.find((x) => x.id === targetId) : undefined
    const piece = on === 'plane' ? everyPiece.find((x) => x.id === targetId) : undefined
    const what =
      on === 'card'
        ? (cards.find((x) => x.id === targetId)?.type ?? 'card')
        : label
          ? (label.kind === 'sticky' ? 'sticky note' : label.kind === 'title' ? 'title' : (label.kind ?? (label.size === 'note' ? 'paragraph' : 'heading')))
          : piece
            ? KIND_NAME[kindOfPiece(piece)]
            : task
              ? 'task'
              : 'link'
    const own = inPlane && on !== 'plane' && on !== 'task' ? planeItems(on, targetId, inPlane) : []
    // Several selected: only what's done to all of them, no comment.
    if (own[0] && 'heading' in own[0]) return setMenu({ at: [e.clientX - r.left, e.clientY - r.top], what: 'selection', items: own })
    setMenu({
      at: [e.clientX - r.left, e.clientY - r.top],
      what,
      items: [
        ...own.slice(0, 1),
        {
          key: 'comment',
          label: 'comment',
          glyph: '▣',
          letter: 'c',
          hint: threadOn(threads, targetId) ? 'open' : undefined,
          // Its conversation if it has one; a new one otherwise.
          onSelect: () => {
            const open = threadOn(threads, targetId)
            if (open) return openThread(open.id)
            const { at } = pinOf({ on, targetId, x: 0, y: 0 })
            startComment({ on, targetId, planeId: where, at: [Math.round(at[0]), Math.round(at[1])] })
          },
        },
        ...own.slice(1),
      ],
    })
  }
  // What can be done with a document from its list's right-click (D-232).
  const docMenu = (d: WithId<Doc>): MenuEntry[] => {
    const mine = d.uid === user?.id
    return [
      { key: 'open', label: 'open beside', glyph: '›', letter: 'o', onSelect: () => openDoc(d.id, false) },
      ...(useDocUi.getState().readers.length && !useDocUi.getState().readers.includes(d.id)
        ? [{ key: 'alongside', label: 'open next to the others', glyph: '⧉', letter: 'n', onSelect: () => openDoc(d.id, true) }]
        : []),
      ...(editor ? [{ key: 'place', label: 'place on the canvas', glyph: '⇱', letter: 'p', hint: d.shared ? undefined : 'shares it', onSelect: () => useDocUi.setState({ placing: { docId: d.id, near: focusId ?? undefined } }) }] : []),
      ...(mine ? [{ key: 'rename', label: 'rename', glyph: '✎', letter: 'r', onSelect: () => useDocUi.setState({ renaming: d.id }) }] : []),
      ...(mine ? [{ key: 'share', label: d.shared ? 'unshare' : 'share with everyone', glyph: '◐', letter: 's', onSelect: () => shareOrAsk(wid, d, pieces) }] : []),
      { key: 'download', label: 'download .md', glyph: '↓', letter: 'd', onSelect: () => void downloadDocument(wid, d) },
      ...(mine || (d.shared && isOwnerOf(workspace, user?.id)) ? [{ key: 'delete', label: 'delete', glyph: '×', letter: 'x', danger: true, onSelect: () => useDocUi.setState({ deleting: d.id }) }] : []),
    ]
  }
  const deletingId = useDocUi((s) => s.deleting)
  const deletingDoc = documents.find((d) => d.id === deletingId) ?? null
  const unsharingId = useDocUi((s) => s.unsharing)
  const unsharingDoc = documents.find((d) => d.id === unsharingId) ?? null
  const unsharingPieces = unsharingDoc ? pieces.filter((p) => p.docId === unsharingDoc.id) : []

  // A document just put on the canvas (D-232): in edit mode where you're looking, to be moved; from a focus, back to the
  // canvas to see it.
  const placedDoc = (id: string) => {
    if (focusedRef.current) unfocusRef.current()
    setEditing(id, true)
  }

  // Dragged out of a list (D-232): placed where it's let go, asked first when it's private.
  const dropped = useDocUi((s) => s.dropped)
  const dragging = useDocUi((s) => s.drag)
  useEffect(() => {
    if (!dropped) return
    useDocUi.setState({ dropped: null })
    if (focusedRef.current || !root.current) return
    const r = root.current.getBoundingClientRect()
    if (dropped.x < r.left || dropped.x > r.right || dropped.y < r.top || dropped.y > r.bottom) return
    useDocUi.setState({ placing: { docId: dropped.docId, at: canvasToSpace(dropped.x, dropped.y) } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropped])

  // Files dropped (D-232): on a documents list or in its focus they go into the workspace's documents; on the empty
  // canvas each .md also goes on the canvas on its own, where it was dropped (asked first: it's private).
  const [fileOver, setFileOver] = useState(false)
  const dragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!fileOver) setFileOver(true)
  }
  const dropFiles = async (e: React.DragEvent) => {
    setFileOver(false)
    if (!e.dataTransfer.files.length || !user) return
    e.preventDefault()
    const files = [...e.dataTransfer.files]
    const onList = focusedDocuments || !!(e.target as HTMLElement).closest('[data-kind=documents]')
    const at = !focusId && !onList ? canvasToSpace(e.clientX, e.clientY) : null
    const ids = await uploadFiles(wid, { uid: user.id, name: user.name || user.email || 'someone' }, files)
    if (at && editor && ids[0]) useDocUi.setState({ placing: { docId: ids[0], at } })
  }

  // The old reports move over as documents once (D-232): yours, and the shared ones if you own the workspace.
  useEffect(() => {
    if (user?.id) void moveReports(wid, user.id, isOwnerOf(workspace, user.id)).catch((e) => console.warn('[documents] moving reports', e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wid, user?.id])

  // From the threads panel: to its space, the pin in the middle, open.
  const goTo = (t: WithId<Thread>) => {
    // A card's thread goes where the card is (D-281, D-290).
    const sp = threadSpace(t)
    openThread(t.id)
    // A task (D-260): picked, so its kanban (its focus, gone into first if need be) shows it framed.
    // Going into its kanban first, the pick waits for the kanban to be live there (leaving a space lets go of picks).
    if (t.on === 'task') {
      const k = tasks.find((x) => x.id === t.targetId)
      if (sp === space) return k && selectTask(k.pieceId, k.id)
      if (k) useKanbanUi.setState({ pending: { piece: k.pieceId, task: k.id } })
      return focusTo(sp)
    }
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
  // Read when a piece asks: the pieces are memoised on what they show and keep the handler they were drawn with.
  const focusRef = useRef((_: WithId<Piece>) => {})
  const focus = (p: WithId<Piece>) => {
    // A cell or a setup of something open on the canvas (D-228) lets go: focus is a view of its own.
    useCanvasView.setState({ focusSpread: true, focusArrived: false, focusLeaving: false, selected: null, cardSelected: null })
    // A task picked (D-251, D-254) stays in the space it was picked in; a thread's go there picks after (`pending`).
    selectTask('', null)
    useMatrixUi.setState({ setup: false, canvas: null })
    useTableUi.setState({ setup: null })
    useKanbanUi.setState({ setup: null })
    closeDocs()
    setParams(canvasParams(canvasOf(p), { focus: p.id }))
  }
  focusRef.current = focus

  const unfocus = () => {
    if (!focused || useCanvasView.getState().focusLeaving) return
    useCanvasView.setState({ focusLeaving: true })
    selectTask('', null)
  }
  unfocusRef.current = unfocus
  const left = () => {
    // Documents open beside a list close with its focus (D-232).
    closeDocs()
    useCanvasView.setState({ focusSpread: false, focusArrived: false, focusLeaving: false, cardSelected: null, cardEditing: null, linkSelected: null, linking: null })
    setParams(canvasParams(canvas), { replace: true })
  }
  // Left by the back button, or a plane deleted (by someone else) while in focus: nothing to animate.
  useEffect(() => {
    if (!focusId) {
      useCanvasView.setState({ focusSpread: false, focusArrived: false, focusLeaving: false, cardSelected: null, cardEditing: null, linkSelected: null, linking: null })
      // A task picked from a card's panel in there stays there (D-254).
      if (useKanbanUi.getState().selected && !useKanbanUi.getState().pending) selectTask('', null)
    }
  }, [focusId])
  useEffect(() => {
    if (focusId && !focused && everyPiece.length > 0) setParams(canvasParams(canvas), { replace: true })
  }, [focusId, focused, everyPiece.length, setParams, canvas])

  // The plane's part of the screen follows what's open beside it (D-211); its contents fit there again.
  // A document open beside its list (D-232) takes the right part the same way.
  // The tasks side view too (D-300), on the canvas as in a focus; opened, what was beside closes.
  const besideCount = sideOpen ? 1 : besideOpen.length + (readerOpen ? 1 : 0)
  // The right part is the last opened's: the side view opened closes what's beside; something opened beside (a link, the
  // back button) or a document beside its list closes the side view.
  const sideWas = useRef(sideOpen)
  useEffect(() => {
    if (sideOpen && !sideWas.current) {
      if (besideRef.current.length) setBesideRef.current([])
      if (useDocUi.getState().readers.length) closeDocs()
    }
    sideWas.current = sideOpen
  }, [sideOpen])
  const besideKey = besideOpen.map((p) => p.id).join(',')
  useEffect(() => {
    if ((besideKey || readerOpen) && useTasksSide.getState().open) closeTasksSide()
  }, [besideKey, readerOpen])
  useEffect(() => {
    useCanvasView.setState({ beside: besideCount })
    if (focusId && useCanvasView.getState().focusArrived) fitRef.current()
  }, [besideCount, focusId])

  // Once in focus: on to the place go to picked (D-196), or its contents fitted to the screen (D-186, D-187); at once
  // when it came without the ink.
  const arriveRef = useRef(false)
  const arrive = () => {
    if (!focused) return
    const { pending } = useGoTo.getState()
    useGoTo.setState({ pending: null })
    const instant = !useCanvasView.getState().focusSpread
    if (instant) useCanvasView.setState((s) => ({ planeCam: s.planeHome }))
    // Where the finder's pick lands (D-236), as its preview showed.
    const found = useFind.getState().target
    if (pending?.space === focused.id) goToPlace(wid, pending, true)
    else if (found?.view && found.focus === focused.id) {
      setPlaneView(found.view, instant)
      clearFound()
    }
    else fitRef.current(instant)
  }
  // Set when it went there as the ink began, so arriving doesn't go again.
  const arrivedEarly = useRef(false)
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
    fitCanvas(wid, [...shown, ...canvasLabels.map(labelBox)], true)
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
      // The tasks side view (D-300), from anywhere.
      if (e.key === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) return toggleTasksSide()
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
          // A card, or a matrix's cell (D-204), lets go first; then as `escNext` says (its dock shows `esc`): the setup
          // closes, then what's beside, then focus goes.
          if (cardSelected) useCanvasView.setState({ cardSelected: null })
          else if (useMatrixUi.getState().setup) useMatrixUi.setState({ setup: false })
          else if (useTableUi.getState().setup) useTableUi.setState({ setup: null })
          else if (useKanbanUi.getState().setup) useKanbanUi.setState({ setup: null })
          // Documents open beside their list (D-232): with the list there, the last opened closes; with it put away, a
          // framed list comes back (they all close), an unframed one goes straight to the canvas.
          else if (useDocUi.getState().readers.length && !useDocUi.getState().listHidden) useDocUi.setState((s) => ({ readers: s.readers.slice(0, -1) }))
          else if (useDocUi.getState().readers.length && !focusedUnframedRef.current) closeDocs()
          // Then the tasks side view (D-300), or what's open beside the plane, the last opened first (D-211).
          else if (useTasksSide.getState().open) closeTasksSide()
          else if (besideRef.current.length) setBesideRef.current(besideRef.current.slice(0, -1).map((p) => p.id))
          else unfocusRef.current()
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && card && editor) {
          e.preventDefault()
          useCanvasView.setState({ cardSelected: null })
          deleteHere(wid, card.on ?? card.pieceId, [card], { edges: edgesRef.current, places: placesRef.current, pieces: piecesRef.current })
        }
        return
      }
      // Something open on the canvas (D-228): Escape closes its setup, then lets go of its cell.
      if (e.key === 'Escape') {
        if (useMatrixUi.getState().canvas) return useMatrixUi.setState({ setup: false, canvas: null })
        if (useTableUi.getState().setup) return useTableUi.setState({ setup: null })
        if (useKanbanUi.getState().setup) return useKanbanUi.setState({ setup: null })
        if (useCanvasView.getState().cardSelected) return useCanvasView.setState({ cardSelected: null })
        if (useTasksSide.getState().open && !useCanvasView.getState().selected) return closeTasksSide()
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
    // Nor through what's live on it, opened onto the canvas (D-228): a double-click there types in a cell.
    if (!hit || hit.closest('button, input, textarea, a, [data-live]')) return
    const id = hit.closest<HTMLElement>('[data-target]')?.dataset.target?.match(/^plane:(.+)$/)?.[1]
    const p = id && everyPiece.find((x) => x.id === id)
    if (!p || useCanvasView.getState().editing.includes(p.id)) return
    stopFollowing()
    focus(p)
  }

  const pan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    // A press on a cell of something open on the canvas (D-228) is the cell's until it moves 5 px, as in focus (D-217):
    // a click still selects it, a drag pans. Anywhere else it lets go of the cell too.
    const onCell = !!(e.target as HTMLElement).closest('[data-cell]')
    useCanvasView.setState(onCell ? { selected: null, labelSelected: null } : { selected: null, labelSelected: null, cardSelected: null })
    stopFollowing()
    const start = camOf(wid)
    const [sx, sy] = [e.clientX, e.clientY]
    const el = e.currentTarget
    const id = e.pointerId
    let panning = false
    const begin = () => {
      panning = true
      el.setPointerCapture(id)
      el.dataset.panning = 'true'
    }
    if (!onCell) begin()
    const move = (ev: PointerEvent) => {
      if (!panning) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_PX) return
        begin()
      }
      setCam(wid, { ...start, x: start.x + ev.clientX - sx, y: start.y + ev.clientY - sy })
    }
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
    <div
      ref={root}
      className={styles.canvas}
      data-file-over={fileOver || undefined}
      onPointerDown={pan}
      onDoubleClick={doubleClick}
      onContextMenu={rightClick}
      onDragOver={dragOver}
      onDragLeave={(e) => e.currentTarget === e.target && setFileOver(false)}
      onDrop={(e) => void dropFiles(e)}
      aria-label="Canvas"
      role="application"
    >
      <div ref={lens} className={styles.lens}>
      <World wid={wid} size={size} zoom={zoom}>
        {/* What's linked to a plane (D-210, D-215): touching, ASCII in the gap; apart, a thin line. Under the pieces, so a
            line never crosses one. */}
        {bonds('under')}
        {pieces.map((p, i) => (
          <PieceBox
            key={p.id}
            piece={p}
            shown={shown[i]}
            live={!focusId}
            zoom={zoom}
            selected={p.id === selected}
            editing={editor && editing.includes(p.id)}
            editor={editor}
            onFocus={() => focusRef.current(p)}
            focusing={p.id === focusId}
            cards={cardsOf(p.id)}
            labels={labelsOf(p.id)}
            content={contentOf(p)}
            planes={sticks(p) ? hostsBox.filter((x) => x.id !== p.id && x.kind === hostKind(p)) : []}
            followers={isHost(p) ? stuckChain(shown, p.id) : []}
            host={sticks(p) && p.stuckTo ? (hostsBox.find((x) => x.id === p.stuckTo) ?? null) : null}
          />
        ))}
        {/* The notches of what's linked to a plane, on its edge (D-215). */}
        {bonds('over')}
        {/* The canvas's own sections over its planes (no fill, so they hide nothing), its text over them (D-188). */}
        <Text labels={canvasLabels} layer="frames" live editor={editor} zoom={zoom} carry={pieceCarry} />
        <Text labels={canvasLabels} layer="text" live editor={editor} zoom={zoom} carry={pieceCarry} />
      </World>
      </div>
      {focused && (
        <FocusedPlane
          key={focused.id}
          piece={focused}
          at={screenRect(shown.find((p) => p.id === focused.id) ?? focused)}
          home={homeOf(focused, screenRect(shown.find((p) => p.id === focused.id) ?? focused), contentOf(focused))}
          bare={focusedBare}
          // Its view glides to where it's going (fitted, or the place picked) while the ink spreads or, a matrix, the page
          // fills in behind its table (D-297): not after.
          onSpread={() => {
            arrivedEarly.current = true
            arrive()
          }}
          spread={focusSpread}
          leaving={focusLeaving}
          lens={lens}
          // Once there, its cards centred and fitted to the screen (D-186, D-187), or on to the place go to picked (D-196).
          onArrived={() => {
            useCanvasView.setState({ focusArrived: true })
            if (arrivedEarly.current) return void (arrivedEarly.current = false)
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
          ) : focusedDocuments ? (
            <FocusedDocuments piece={focused} editor={editor} />
          ) : focusedDocument ? (
            // The same page as a document beside the list (D-232), its own dock with `[unfocus]`.
            <DocFocus piece={focused} onUnfocus={unfocus} />
          ) : focusedKanban ? (
            <FocusedKanban piece={focused} editor={editor} />
          ) : focusedTimeline ? (
            <FocusedTimeline piece={focused} editor={editor} />
          ) : (
            <FocusedCards cards={focusedCards} labels={focusedLabels} editor={editor} />
          )}
          {drawing === focused.id && <DrawSection space={focused.id} toSpace={planeToSpace} />}
          {focusArrived && !focusLeaving && (
            <Beside plane={focused} open={besideOpen} editor={editor} esc={escNext} matrixSetupPane={matrixPane} onClose={(id) => setBeside(besideIds.filter((x) => x !== id))} />
          )}
          {focusArrived && !focusLeaving && sideOpen && <TasksSide editor={editor} esc={escNext} plane={kindOfPiece(focused) === 'plane' ? focused : null} />}
          {focusedMatrix && editor && matrixSetup && focusArrived && !focusLeaving && <MatrixSetupPanel piece={focused} />}
          {focusedTable && editor && tableSetup === focused.id && focusArrived && !focusLeaving && <TableSetupPanel piece={focused} />}
          {focusedKanban && editor && kanbanSetup === focused.id && focusArrived && !focusLeaving && <KanbanSetupPanel piece={focused} />}
          {/* A card picked from a matrix's or a table's head, in its focus or beside the plane: its panel. */}
          {focusArrived && !focusLeaving && <LensCardPanel space={focused.id} editor={editor} />}
          {/* A kanban's task picked (D-251), or a task from a card's panel (D-254): its panel. */}
          {focusArrived && !focusLeaving && <TaskPanel editor={editor} />}
          {focusedDocuments && focusArrived && !focusLeaving && <DocReaders list={focused} />}
          {/* Once it's there, and gone the moment it leaves (D-185): the dock on the bottom edge (D-189). */}
          {/* With the list put away its dock goes too; unfocus is in the bar top-left (DocReaders). */}
          {/* A document's focus has the page's own dock (DocFocus). */}
          {focusArrived && !focusLeaving && !listHidden && !focusedDocument && (
            <FocusDock center={readerOpen ? readerLeft(contentOf(focused)!, size.w, readerAt) / 2 : besideOpen.length || sideOpen ? (size.w * split) / 2 : undefined}>
              {focusedMatrix && editor && (
                <DockAction label="setup" pressed={!!matrixSetup} keyHint={escOn('setup')} title="its rows, columns and cells" onClick={() => useMatrixUi.setState((s) => ({ setup: !s.setup }))} />
              )}
              {focusedTable && <TablePager piece={focused} editor={editor} />}
              {focusedTable && editor && (
                <DockAction label="setup" pressed={tableSetup === focused.id} keyHint={escOn('setup')} title="where its rows come from, its columns" onClick={() => useTableUi.setState((s) => ({ setup: s.setup === focused.id ? null : focused.id }))} />
              )}
              {focusedDocuments && <DocumentsTools piece={focused} editor={editor} />}
              {focusedKanban && <KanbanFilterDock piece={focused} />}
              {focusedKanban && <KanbanLanes piece={focused} editor={editor} />}
              {focusedKanban && <KanbanDockTools piece={focused} editor={editor} />}
              {focusedKanban && editor && (
                <DockAction label="setup" pressed={kanbanSetup === focused.id} keyHint={escOn('setup')} title="what it holds: tasks, or cards by a field" onClick={() => useKanbanUi.setState((s) => ({ setup: s.setup === focused.id ? null : focused.id }))} />
              )}
              {/* A timeline stuck to the kanban (D-262): opened beside it, or closed (D-211). */}
              {focusedKanban &&
                stuckHere.map((p) => (
                  <DockAction
                    key={p.id}
                    label={`⇆ ${KIND_NAME[kindOfPiece(p)]}${p.name ? ` · ${p.name}` : ''}`}
                    pressed={besideIds.includes(p.id)}
                    title={besideIds.includes(p.id) ? 'close it beside the deck' : 'open it beside the deck'}
                    onClick={() => toggleBeside(p.id)}
                  />
                ))}
              {focusedTimeline && <TimelineDockTools piece={focused} editor={editor} />}
              {/* Several documents side by side (D-232): a click opens one next to the others. */}
              {focusedDocuments && <DockAction label="⧉ side by side" pressed={sideBySide} title={sideBySide ? 'a click opens a document in place of the one open' : 'a click opens a document next to the ones open'} onClick={() => useDocUi.setState((s) => ({ sideBySide: !s.sideBySide }))} />}
              {focusedDocuments && readerOpen && <DockAction label="hide list" title="put the list away: the documents take the whole screen" onClick={() => useDocUi.setState({ listHidden: true })} />}
              {/* What the plane shows (D-233) and what's stuck to it (D-210), each a strip over the dock (D-235): a stuck
                  piece's button opens it beside the plane, or closes it (D-211). Its snapping and guides and what it shows, in the view menu (D-231). */}
              {!isBare(focused) && (
                <PlaneDockExtras
                  plane={focused.id}
                  cards={focusedCards}
                  stuck={{
                    count: stuckHere.length,
                    strip: stuckHere.map((p) => (
                      <DockAction
                        key={p.id}
                        label={`⇆ ${KIND_NAME[kindOfPiece(p)]}${p.name ? ` · ${p.name}` : ''}`}
                        pressed={besideIds.includes(p.id)}
                        title={besideIds.includes(p.id) ? 'close it beside the plane' : 'open it beside the plane'}
                        onClick={() => toggleBeside(p.id)}
                      />
                    )),
                  }}
                />
              )}
              {!isBare(focused) && <ViewMenu editor={editor} />}
              {/* Always here; `esc` only when Escape does it next (with something open beside, that closes first, D-211). */}
              <DockAction label="unfocus" keyHint={escNext === 'unfocus' ? 'esc' : undefined} title="back to the canvas" main onClick={unfocus} />
            </FocusDock>
          )}
        </FocusedPlane>
      )}
      {drawing === CANVAS && !focused && <DrawSection space={CANVAS} toSpace={canvasToSpace} />}
      {/* The setup of a matrix or table open on the canvas (D-228), from its console, at the bottom of the screen. */}
      {!focused && editor && canvasSetup && <CanvasSetup piece={canvasSetup} />}
      {/* And from one open on the canvas (D-228). */}
      {!focused && <LensCardPanel space={null} editor={editor} />}
      {/* The tasks side view on the canvas (D-300). */}
      {!focused && sideOpen && <TasksSide editor={editor} esc={null} plane={null} />}
      {/* And a task picked on a kanban open on the canvas (D-251), or from a card's panel there (D-254). */}
      {!focused && <TaskPanel editor={editor} />}
      <PeerCursors space={space} toScreen={toScreen} />
      {menu && <ContextMenu at={menu.at} what={menu.what} items={menu.items} onClose={closeMenu} />}
      {/* Cards from other planes to bring here (D-281), where the `+` or the right-click menu was. */}
      {focused && !isBare(focused) && <BringCards here={focused.id} origin={root.current?.getBoundingClientRect() ?? { left: 0, top: 0 }} />}
      {/* A document being dragged out of its list, and the question before a private one goes on the canvas (D-232). */}
      {dragging && <DragGhost doc={documents.find((d) => d.id === dragging.docId)} at={dragging} root={root} />}
      <DocPlaceHere wid={wid} toScreen={focusId ? null : toScreen} others={shown.map((p) => ({ id: p.id, x: p.x, y: p.y, w: p.w, h: p.h }))} members={membersOf(workspace.roles)} onPlaced={placedDoc} />
      {/* Unsharing a document that's on the canvas (D-232): its pieces go too; asks first. */}
      {unsharingDoc && (
        <HazardConfirm
          title={`unshare "${unsharingDoc.title.length > 40 ? `${unsharingDoc.title.slice(0, 39)}…` : unsharingDoc.title}"?`}
          lines={[
            `It's on the canvas ${unsharingPieces.length === 1 ? 'once' : `${unsharingPieces.length} times`}. Only you would see it, so ${unsharingPieces.length === 1 ? 'that piece is' : 'those pieces are'} taken off the canvas.`,
            editor ? `${UNDO_HINT} brings it back.` : 'An editor has to take it off the canvas first: you can only read here.',
          ]}
          confirm="unshare"
          onCancel={() => useDocUi.setState({ unsharing: null })}
          onConfirm={() => {
            useDocUi.setState({ unsharing: null })
            if (!editor) return
            // A document in focus that goes off the canvas: back to the canvas first.
            if (focused && unsharingPieces.some((p) => p.id === focused.id)) unfocus()
            void unshareDocument(wid, unsharingDoc.id, unsharingPieces.map((p) => pieceRef(wid, p.id)))
          }}
        />
      )}
      {deletingDoc && (
        <HazardConfirm
          title={`delete "${deletingDoc.title.length > 40 ? `${deletingDoc.title.slice(0, 39)}…` : deletingDoc.title}"?`}
          lines={[
            pieces.some((p) => p.docId === deletingDoc.id) ? 'The document goes, and every piece showing it on the canvas.' : 'The document goes from every list.',
            `${UNDO_HINT} brings it back.`,
          ]}
          confirm="delete"
          onCancel={() => useDocUi.setState({ deleting: null })}
          onConfirm={() => {
            useDocUi.setState((s) => ({ deleting: null, readers: s.readers.filter((x) => x !== deletingDoc.id) }))
            void deleteDocument(wid, deletingDoc.id, piecesOfDoc(wid, pieces, deletingDoc.id))
          }}
        />
      )}
      <ThreadInbox wid={wid} threads={threads} inside={insideOf} titleOf={titleOf} onGo={(t) => openThread(t.id)} onShow={goTo} isOwner={isOwnerOf(workspace, user?.id)} whereOf={whereOf} here={spaceName(space)} goneOf={(t) => pinOf(t).gone} scopeName={(id) => `"${everyPiece.find((p) => p.id === id)?.name || 'plane'}"`} />
      <Follow focusId={focusId} focusTo={focusTo} />
      {deletingCards && (
        <HazardConfirm
          title={deletingCards.ids.length > 1 ? `delete ${deletingCards.ids.length} cards everywhere?` : `delete "${cards.find((c) => c.id === deletingCards.ids[0])?.title || 'this card'}" everywhere?`}
          lines={[
            `${deletingCards.ids.length > 1 ? 'They go' : 'It goes'} from every plane ${deletingCards.ids.length > 1 ? "they're" : "it's"} on, with ${deletingCards.ids.length > 1 ? 'their' : 'its'} links.`,
            `To take ${deletingCards.ids.length > 1 ? 'them' : 'it'} off this plane only: ⌫.`,
            `${UNDO_HINT} brings it back.`,
          ]}
          confirm="delete everywhere"
          onCancel={() => useCanvasView.setState({ deleting: null })}
          onConfirm={() => {
            useCanvasView.setState({ deleting: null, cardSelected: null, cardMulti: [] })
            void deleteCards(wid, cards.filter((c) => deletingCards.ids.includes(c.id)), edges, [], places)
          }}
        />
      )}
      {confirming && (
        <HazardConfirm
          title={`delete ${confirming.name ? `"${confirming.name}"` : `this ${KIND_NAME[kindOfPiece(confirming)]}`}?`}
          lines={[
            kindOfPiece(confirming) === 'document'
              ? 'It goes from the canvas; the document stays in its list.'
              : kindOfPiece(confirming) === 'documents'
                ? 'The list goes; the documents in it stay.'
                : kindOfPiece(confirming) === 'kanban'
                  ? 'The deck and its tasks go; the cards they were for stay.'
                  : isBare(confirming)
                  ? `The ${KIND_NAME[kindOfPiece(confirming)]} and its cells go; the cards in it stay.`
                  : 'The plane and everything on it goes.',
            ...(isBare(confirming) ? [] : sharedOnOf(cards, places, confirming)),
            `${UNDO_HINT} brings it back.`,
          ]}
          confirm="delete"
          onCancel={() => useCanvasView.setState({ confirming: null })}
          onConfirm={() => {
            useCanvasView.setState({ confirming: null })
            setEditing(confirming.id, false)
            void deletePiece(wid, confirming.id, cards, labels, cells, kindOfPiece(confirming), edges, tasks, places)
          }}
        />
      )}
    </div>
  )
}

// A plane's delete keeps its cards that are also on other planes (D-281): says how many.
function sharedOnOf(cards: Card[], places: import('../../data/places').Place[], plane: { id: string }) {
  const n = cards.filter((c) => c.pieceId === plane.id && elsewhere(c, places, plane.id).length).length
  return n ? [`${n === 1 ? 'One card' : `${n} cards`} on it ${n === 1 ? 'is' : 'are'} on other planes too and ${n === 1 ? 'stays' : 'stay'} there.`] : []
}

// The focus's own view set, gliding there unless `instant`.
function setPlaneView(to: PlaneCam, instant: boolean) {
  const c = useCanvasView.getState().planeCam
  stopGlide()
  if (instant || !c || isReducedMotion()) useCanvasView.setState({ planeCam: to })
  else glide(c, to, 420, (v) => useCanvasView.setState({ planeCam: v }))
}

// The zoom what's held at screen size on the canvas is drawn for (piece names, consoles, marks, text's bars): the
// camera's, once it stops changing for ZOOM_SETTLE_MS. Each wheel step (or a glide's frame) then moves only the world's
// transform; with that zoom in the pieces' styles (--z, --zs), every step restyled all that's on the canvas and zooming
// crawled. A press takes the camera's at once, so a drag right after a zoom reads the zoom it's under. Heard from the
// store, not read in render: a pan leaves the canvas undrawn.
function useShownZoom(wid: string) {
  const [shown, setShown] = useState(() => camOf(wid).zoom)
  const shownRef = useRef(shown)
  shownRef.current = shown
  useEffect(() => {
    let last = camOf(wid).zoom
    let t = 0
    const now = () => {
      off()
      flushSync(() => setShown(camOf(wid).zoom))
    }
    const off = () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', now, true)
    }
    const heard = () => {
      const z = camOf(wid).zoom
      if (z === last) return
      last = z
      off()
      if (z === shownRef.current) return
      t = window.setTimeout(() => setShown(z), ZOOM_SETTLE_MS)
      window.addEventListener('pointerdown', now, true)
    }
    // A zoom between the first draw and this.
    if (last !== shownRef.current) setShown(last)
    const unsub = useCanvasView.subscribe(heard)
    return () => {
      unsub()
      off()
    }
  }, [wid])
  return shown
}

// The canvas's world: the camera's pan and zoom as its transform, the only thing a pan or a wheel step changes. What's
// in it is CanvasView's, drawn again only when that is. While the camera's zoom isn't yet the one shown (`zoom`), what's
// held at screen size is hidden (`data-zooming`, D-293): set once when a zoom starts, once when it settles.
function World({ wid, size, zoom, children }: { wid: string; size: { w: number; h: number }; zoom: number; children: ReactNode }) {
  const cam = useCanvasView((s) => s.cams[wid]) ?? camOf(wid)
  return (
    <div
      className={styles.world}
      // The finder's preview copies it (D-236).
      data-canvas-world
      data-zooming={cam.zoom !== zoom || undefined}
      style={{ transform: `translate(${onPixel(size.w / 2 + cam.x)}px, ${onPixel(size.h / 2 + cam.y)}px) scale(${cam.zoom})` }}
    >
      {children}
    </div>
  )
}

// Placing a document (D-232): its frame where it'll land follows the camera.
function DocPlaceHere({ wid, ...props }: Omit<Parameters<typeof DocPlace>[0], 'zoom'> & { wid: string }) {
  const cam = useCanvasView((s) => s.cams[wid])
  return <DocPlace {...props} zoom={cam?.zoom ?? 1} />
}

const UNDO_HINT = navigator.platform.toLowerCase().includes('mac') ? '⌘Z' : 'Ctrl+Z'

type BoxProps = {
  piece: WithId<Piece>
  // Where it's drawn: an open matrix or table as big as its contents (D-228).
  shown: Box
  // Whether what's open on it is live: not while a plane is in focus.
  live: boolean
  // The canvas's zoom as shown (useShownZoom), for what's held at screen size on it.
  zoom: number
  selected: boolean
  editing: boolean
  editor: boolean
  onFocus: () => void
  focusing: boolean
  cards: Card[]
  labels: Label[]
  content: Bounds | null
  // A matrix or a table: the planes it can stick to (D-210).
  planes: (Box & { id: string })[]
  // A plane: what's stuck to it, moved with it (as drawn), and what's stuck to those (a kanban's timeline, D-298): each
  // after the one it's stuck to.
  followers: WithId<Piece>[]
  // A matrix or a table: the plane it's linked to (D-215), named first in its edge.
  host: (Box & { id: string; name?: string }) | null
}

// A link between a plane and a matrix or table (D-210, D-215), quiet grey, cyan while either is under the pointer.
// Touching (one grid step out): the gap along what they share holds faint `· ›` cells (9 px, pointing away from the
// plane) and the plane's edge a notch there. Apart: a thin straight line from the middle of the plane's side facing it
// to the piece's, never dashed, a notch where it leaves. No motion.
// Drawn in two layers: the gap and the line under the pieces, the notch over its plane's edge.
function Bond({ piece, plane: at, zoom, layer }: { piece: WithId<Piece>; plane: Box & { id: string }; zoom: number; layer: 'under' | 'over' }) {
  const box = useCanvasView((s) => s.following[piece.id]) ?? piece
  const plane = useCanvasView((s) => s.following[at.id]) ?? at
  const lit = useCanvasView((s) => s.bondHover === piece.id || s.bondHover === at.id)
  const side = touchSide(box, plane)
  if (side) {
    const across = side === 'right' || side === 'left'
    const a = across ? Math.max(box.y, plane.y) : Math.max(box.x, plane.x)
    const b = across ? Math.min(box.y + box.h, plane.y + plane.h) : Math.min(box.x + box.w, plane.x + plane.w)
    const inset = 12
    const len = Math.max(0, b - a - 2 * inset)
    const notch = across
      ? { left: side === 'right' ? plane.x + plane.w - 1 : plane.x - 1, top: a + inset, width: 2, height: len }
      : { top: side === 'bottom' ? plane.y + plane.h - 1 : plane.y - 1, left: a + inset, height: 2, width: len }
    const gap = across
      ? { left: side === 'right' ? plane.x + plane.w : box.x + box.w, top: a + inset, width: STICK_GAP, height: len }
      : { top: side === 'bottom' ? plane.y + plane.h : box.y + box.h, left: a + inset, width: len, height: STICK_GAP }
    const glyph = side === 'right' ? '›' : side === 'left' ? '‹' : side === 'bottom' ? '⌄' : '⌃'
    const cols = Math.floor(gap.width / BOND_CELL)
    const rows = Math.floor(gap.height / BOND_CELL)
    const text = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => ((r + c) % 2 ? glyph : '·')).join('')).join('\n')
    return layer === 'over' ? (
      <span className={styles.notch} data-lit={lit || undefined} data-screen-sized style={notch} aria-hidden />
    ) : (
      <span className={styles.bondGap} data-lit={lit || undefined} style={gap} aria-hidden>
        {text}
      </span>
    )
  }
  // Apart: from the plane's side facing it, its middle (kept inside the side), to the piece's facing side.
  const cx = (q: Box) => q.x + q.w / 2
  const cy = (q: Box) => q.y + q.h / 2
  const dx = cx(box) - cx(plane)
  const dy = cy(box) - cy(plane)
  const flat = Math.abs(dx) / plane.w > Math.abs(dy) / plane.h
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
  const A = flat ? [dx > 0 ? plane.x + plane.w : plane.x, clamp(cy(box), plane.y + 30, plane.y + plane.h - 30)] : [clamp(cx(box), plane.x + 30, plane.x + plane.w - 30), dy > 0 ? plane.y + plane.h : plane.y]
  const B = flat ? [dx > 0 ? box.x : box.x + box.w, clamp(A[1], box.y + 20, box.y + box.h - 20)] : [clamp(A[0], box.x + 20, box.x + box.w - 20), dy > 0 ? box.y : box.y + box.h]
  const notch = flat ? { left: A[0] - 1, top: A[1] - 10, width: 2, height: 20 } : { left: A[0] - 10, top: A[1] - 1, width: 20, height: 2 }
  return layer === 'over' ? (
    <span className={styles.notch} data-lit={lit || undefined} data-screen-sized style={notch} aria-hidden />
  ) : (
    <svg className={styles.bondLine} data-lit={lit || undefined} data-screen-sized aria-hidden>
      <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} strokeWidth={1 / zoom} />
    </svg>
  )
}

// The cells in the gap of a touching link (D-215): the backdrop's 9 px.
const BOND_CELL = 9

// What a piece shows of what's in it on the canvas (D-187): a plane's cards and text centred and fitted inside its box,
// never past 1; nothing = its own (0, 0) at its corner. Its px inside its 1 px edge. A matrix is a window: its table at
// its own size from the top-left, cut by the window's edge (D-208).
function innerView(box: Box, b: Bounds | null, bare = false, pad = GRID): PlaneCam {
  if (!b || bare) return { ox: 0, oy: 0, zoom: 1 }
  const { zoom, cx, cy } = fitInto(b, box.w - 2, box.h - 2, pad)
  return { ox: (box.w - 2) / 2 - cx * zoom, oy: (box.h - 2) / 2 - cy * zoom, zoom }
}

// How a piece shows what's in it: a table at its own size from the top-left, cut by its edge (D-208); a matrix fitted
// whole in its window, a little room round it (D-214); a plane's cards fitted.
// A timeline (D-262) is fitted in its window, as a matrix is: two weeks are wider than any window.
const asShown = (p: Piece): [boolean, number] => (kindOfPiece(p) === 'matrix' || kindOfPiece(p) === 'timeline' ? [false, 12] : [isBare(p), GRID])

// That view on the screen, where focus starts from and goes back to.
function homeOf(piece: Piece, at: ScreenRect, content: Bounds | null): PlaneCam {
  // Open on the canvas (D-228): its contents a margin in from its corner, at their own size.
  const v = isOpen(piece) ? { ox: OPEN_PAD, oy: OPEN_PAD, zoom: 1 } : innerView(piece, content, ...asShown(piece))
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

// The focused kanban, live, on its own view (D-251).
// The focused timeline, live, on its own view (D-262).
function FocusedTimeline({ piece, editor }: { piece: WithId<Piece>; editor: boolean }) {
  const view = useCanvasView((s) => s.planeCam)
  return view ? <TimelineView piece={piece} view={view} live editor={editor} /> : null
}

function FocusedKanban({ piece, editor }: { piece: WithId<Piece>; editor: boolean }) {
  const view = useCanvasView((s) => s.planeCam)
  return view ? <KanbanView piece={piece} view={view} live editor={editor} /> : null
}

// The focused documents list, live (D-232); a click opens a document beside it (DocReader).
function FocusedDocuments({ piece, editor }: { piece: WithId<Piece>; editor: boolean }) {
  const view = useCanvasView((s) => s.planeCam)
  return view ? <DocumentsView piece={piece} view={view} live editor={editor} /> : null
}


// A document dragged out of its list (D-232): its name under the pointer, framed like the piece it'll become.
function DragGhost({ doc, at, root }: { doc?: WithId<Doc>; at: { x: number; y: number }; root: React.RefObject<HTMLDivElement | null> }) {
  const r = root.current?.getBoundingClientRect()
  if (!doc || !r) return null
  return (
    <div className={styles.dragGhost} style={{ left: at.x - r.left, top: at.y - r.top }} aria-hidden>
      <span className={styles.dragGhostName}>{doc.shared ? '' : '◐ '}{doc.title}</span>
    </div>
  )
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

// A name's leading number, apart (D-266): `04 Rivals` → `04`, `Rivals`.
function numberOf(name: string | undefined): { num: string; rest: string } {
  const m = /^(\d{1,4})(?:[\s.·:—–-]+(.*))?$/.exec(name?.trim() ?? '')
  return m ? { num: m[1], rest: m[2] ?? '' } : { num: '', rest: name ?? '' }
}

// A piece's kind's colour (D-263): its marks' tone now, its band later.
const KIND_TONE: Record<string, string> = {
  plane: 'var(--fg)',
  matrix: 'var(--link-solves)',
  table: 'var(--link-part)',
  kanban: 'var(--link-draws)',
  documents: 'var(--link-depends)',
  document: 'var(--link-depends)',
  timeline: 'var(--link-competes)',
}

// A piece on the canvas, memoised on what it shows (its handler reads a ref, its lists compared by what's in them): a
// change in one piece, or a card on one plane, doesn't draw the others (D-287's *Not yet*).
const PieceBox = memo(PieceBoxOf, alikeProps)

function PieceBoxOf({ piece, shown, live, zoom, selected, editing, editor, onFocus, focusing, cards, labels, content, planes, followers, host }: BoxProps) {
  const peers = usePeersOn(piece.id, CANVAS)
  const { wid } = useWs()
  const kind = kindOfPiece(piece)
  // A document on its own is named by its document's title (D-232); it has no name of its own.
  const docTitle = useWs().documents.find((d) => d.id === piece.docId)?.title
  const name = kind === 'document' ? docTitle : piece.name
  const open = isOpen(piece)
  // Where a move or resize has it, held after the drop until the data gets there (else it would jump back for a moment).
  const [held, setHeld] = useState<Box | null>(null)
  useEffect(() => {
    if (held && same(held, shown)) setHeld(null)
  }, [held, shown])
  // Moved along with the plane it's stuck to (D-210), while that's dragged.
  const following = useCanvasView((s) => s.following[piece.id])
  const box = held ?? following ?? shown
  // A matrix or table about to stick here (D-210): the plane's edge lights.
  const stickHere = useCanvasView((s) => s.stickHint?.plane === piece.id)
  // Its link lights while it or its plane is under the pointer (D-215).
  const hover = (on: boolean) => () => useCanvasView.setState((s) => (on ? { bondHover: piece.id } : s.bondHover === piece.id ? { bondHover: null } : {}))
  // Carried by a section being dragged (D-188).
  const shift = useCanvasView((s) => (s.dragShift && s.dragShift.ids.includes(piece.id) ? s.dragShift : null))
  // Moved (D-265): where it is under the pointer (canvas px) and the point held in it, while its box is where it lands;
  // resized: by which handle, for its lit edges and the readout.
  const [moving, setMoving] = useState<{ free: [number, number]; at: [number, number] } | null>(null)
  const [sizing, setSizing] = useState<Handle | null>(null)
  // Its console (D-264) shows while the pointer's on it, or after a first tap on a touch screen (a second goes in);
  // its setup open (unframed, D-228) keeps it too.
  const [pointed, setPointed] = useState(false)
  const [tapped, setTapped] = useState(false)
  const self = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!tapped) return
    const away = (e: PointerEvent) => !self.current?.contains(e.target as Node) && setTapped(false)
    window.addEventListener('pointerdown', away, true)
    return () => window.removeEventListener('pointerdown', away, true)
  }, [tapped])
  const matrixSetupOn = useMatrixUi((s) => !!s.setup && s.canvas === piece.id)
  const tableSetupOn = useTableUi((s) => s.setup === piece.id)
  const kanbanSetupOn = useKanbanUi((s) => s.setup === piece.id)
  const setupOn = matrixSetupOn || tableSetupOn || kanbanSetupOn
  const tap = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'touch' || editing || e.button !== 0) return
    const [sx, sy] = [e.clientX, e.clientY]
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointerup', up)
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > DRAG_PX) return
      if (tapped) onFocus()
      else setTapped(true)
    }
    window.addEventListener('pointerup', up)
  }

  // Out of edit mode a press on a plane is the canvas's: it pans (D-186). In edit mode it selects the plane, and moving or
  // one of the handles changes its box (5 px before a press turns into a drag).
  const press = (handle: Handle) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !editing) return
    e.stopPropagation()
    useCanvasView.setState({ selected: piece.id })
    const [sx, sy] = [e.clientX, e.clientY]
    const at = heldAt(e, 0, 0, zoom)
    // Open on the canvas it only moves (its size is its contents', D-228).
    if (open && handle !== 'move') return
    const from: Box = { ...shown }
    let to: Box | null = null
    // A matrix or table moved near a plane's edge sticks there (D-210); moved anywhere else it stays linked as it was
    // (only its dropdown lets go, D-215). A plane carries what's linked to it: what touches it stays on its edge, what's
    // apart moves as the plane's corner does.
    const lens = sticks(piece) && handle === 'move'
    const linked: string | null = piece.stuckTo && planes.some((p) => p.id === piece.stuckTo) ? piece.stuckTo : null
    let stick = linked
    // Each follows the one it's stuck to: this piece, or a follower before it (D-298: a plane's kanban's timeline).
    const fromOf = new Map<string, Box>([[piece.id, from], ...followers.map((f) => [f.id, { x: f.x, y: f.y, w: f.w, h: f.h }] as [string, Box])])
    const carried = followers.map((f) => {
      const host = f.stuckTo ?? piece.id
      return { id: f.id, host, from: fromOf.get(f.id)!, side: touchSide(f, fromOf.get(host) ?? from) }
    })
    const followed = (b: Box) => {
      const tos = new Map<string, Box>([[piece.id, b]])
      return carried.map((f) => {
        const [hf, ht] = [fromOf.get(f.host) ?? from, tos.get(f.host) ?? b]
        const to = f.side ? followTo(f.from, f.side, hf, ht) : { ...f.from, x: f.from.x + ht.x - hf.x, y: f.from.y + ht.y - hf.y }
        tos.set(f.id, to)
        return { id: f.id, from: f.from, to }
      })
    }
    // On the window, not captured: a press that doesn't move stays a click.
    const move = (ev: PointerEvent) => {
      const [dx, dy] = [ev.clientX - sx, ev.clientY - sy]
      if (!to && Math.hypot(dx, dy) < DRAG_PX) return
      to = dragBox(from, handle, dx / zoom, dy / zoom, ev.altKey)
      if (handle === 'move') setMoving({ free: [from.x + dx / zoom, from.y + dy / zoom], at })
      else setSizing(handle)
      if (lens) {
        // Within 48 screen px of an edge; alt held: free, no sticking.
        const t = ev.altKey ? null : stickTarget(to, planes, 48 / zoom)
        stick = t?.plane ?? linked
        if (t) to = t.box
        useCanvasView.setState({ stickHint: t ? { plane: t.plane, box: t.box } : null })
      }
      setHeld(to)
      // The plane too, so its links follow live (D-215); a linked matrix or table being moved, so its link turns from
      // touching to apart and back as it goes, at once.
      if (carried.length) useCanvasView.setState({ following: { ...Object.fromEntries(followed(to).map((f) => [f.id, f.to])), [piece.id]: to } })
      else if (lens && stick) useCanvasView.setState({ following: { [piece.id]: to } })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      useCanvasView.setState({ stickHint: null })
      setMoving(null)
      setSizing(null)
      // The followers stay where they were carried until their data's back.
      const done = () => useCanvasView.setState({ following: {} })
      if (to && !same(to, from)) {
        // An open one's window keeps its stored size.
        const kept = (b: Box): Box => (open ? { ...b, w: piece.w, h: piece.h } : b)
        const write = lens ? placeLens(wid, piece, kept(from), kept(to), stick, followed(to)) : placePiece(wid, piece.id, from, to, kind, followed(to))
        void write.then(done, () => (setHeld(null), done()))
      } else {
        setHeld(null)
        done()
      }
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
  // Its own cards (brought ones too) say which cards' threads are inside it (D-286): not every card, so a card elsewhere
  // changing doesn't draw this piece.
  const mine = threads.filter((t) => !t.resolved && threadIn(t, piece.id, cards))
  const freshOnes = mine.filter((t) => isNew(t, seen, t.id, me))
  const comments = {
    count: mine.length,
    fresh: freshOnes.length > 0,
    mentioned: freshOnes.some((t) => t.mentions?.includes(me)),
    onOpen: () => toggleInbox(true, piece.id),
  }
  // Its cards fitted inside it, and its marks with them (D-187).
  const bare = isBare(piece)
  const [noFit, pad] = asShown(piece)
  // Its own view, the same object until its box or contents change, so what's in it isn't drawn again as the canvas
  // moves (Matrix, Table, Cards below).
  const inner = useMemo(() => innerView({ x: 0, y: 0, w: box.w, h: box.h }, content, noFit, pad), [box.w, box.h, content, noFit, pad])
  // Going between framed and unframed (D-267): the window breaks cell by cell (or builds) while what's in it grows from
  // fitted in it to its own size (or shrinks back), 320 ms; nothing else moves. Reduced motion: at once.
  const fitted = useMemo(() => innerView({ x: 0, y: 0, w: piece.w, h: piece.h }, content, noFit, pad), [piece.w, piece.h, content, noFit, pad])
  const [morph, setMorph] = useState<{ to: 'open' | 'framed'; t: number } | null>(null)
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current === open) return
    wasOpen.current = open
    if (isReducedMotion()) return
    const to = open ? 'open' : 'framed'
    const t0 = performance.now()
    let f = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / MORPH_MS)
      setMorph(t < 1 ? { to, t } : null)
      if (t < 1) f = requestAnimationFrame(step)
    }
    setMorph({ to, t: 0 })
    f = requestAnimationFrame(step)
    return () => cancelAnimationFrame(f)
  }, [open])
  const ghost = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    if (!ghost.current || !morph) return
    return runCells(ghost.current, morph.to === 'open' ? 'exit' : 'enter', 0, MORPH_MS)
    // Once a turn: on its start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [morph?.to])
  const eased = morph ? easeBoth(morph.t) : 1
  const openView = morph?.to === 'open' ? between(fitted, OPEN_VIEW, eased) : OPEN_VIEW
  const framedView = morph?.to === 'framed' ? between(OPEN_VIEW, inner, eased) : inner
  const step = GRID * inner.zoom
  // Carried (its own move, or by a section): 0.8 round the point held under the pointer, its marks where it lands.
  const left = box.x + (shift?.dx ?? 0)
  const top = box.y + (shift?.dy ?? 0)
  const carried = moving
    ? { translate: `${moving.free[0] - left}px ${moving.free[1] - top}px`, scale: '0.8', transformOrigin: `${moving.at[0]}px ${moving.at[1]}px` }
    : shift?.shrink && shift.free && shift.at
      ? { translate: `${shift.free[0] - shift.dx}px ${shift.free[1] - shift.dy}px`, scale: '0.8', transformOrigin: `${shift.at[0] - box.x}px ${shift.at[1] - box.y}px` }
      : undefined
  const tone = KIND_TONE[kind]
  const numbered = numberOf(name)
  return (
    <>
    <div
      className={styles.piece}
      data-selected={selected || undefined}
      data-editing={editing || undefined}
      data-dragging={held ? true : undefined}
      data-carried={carried ? true : undefined}
      data-stick={stickHere || undefined}
      // What the right-click menu comments on (D-193).
      data-target={`plane:${piece.id}`}
      data-kind={kind}
      data-open={open || undefined}
      data-morph={morph?.to}
      // A matrix in focus is its focused copy's: the one here would show under it as it glides.
      data-away={bare && focusing ? true : undefined}
      // --z: the canvas's zoom, so the name holds its size on the screen (D-223).
      style={{ ...carried, left, top, width: box.w, height: box.h, ['--cs' as string]: consoleScale(zoom), ['--mark' as string]: `${step}px`, ['--mx' as string]: `${inner.ox - step / 2}px`, ['--my' as string]: `${inner.oy - step / 2}px`, ['--z' as string]: zoom }}
      ref={self}
      onPointerDown={(e) => (tap(e), press('move')(e))}
      onPointerEnter={(e) => (hover(true)(), e.pointerType !== 'touch' && setPointed(true))}
      onPointerLeave={() => (hover(false)(), setPointed(false))}
    >
      {editing && kind !== 'document' ? (
        <NameField value={piece.name ?? ''} placeholder={KIND_NAME[kind]} onSave={(name) => name !== (piece.name ?? '') && void renamePiece(wid, piece.id, name, kind)} />
      ) : (
        // Named: the name, then its kind faint (D-223); unnamed: the kind alone, faint. A number it starts with in
        // magenta before it (D-266); unframed, the name is a heading's small line, `04 ── RIVALS · TABLE` (D-267).
        <span className={styles.name} data-unnamed={!name || undefined} title={name || undefined}>
          {numbered.num && <span className={styles.nameNum}>{numbered.num}</span>}
          {numbered.num && open && <span className={styles.nameRule} aria-hidden />}
          {(numbered.rest || !numbered.num) && <span className={styles.nameText}>{numbered.rest || KIND_NAME[kind]}</span>}
          {name && (
            <>
              <span className={styles.nameSep} aria-hidden>
                ·
              </span>
              <span className={styles.nameKind}>{KIND_NAME[kind]}</span>
            </>
          )}
        </span>
      )}
      {/* Its marks (D-265, tier L, its kind's colour): hover, others' selection; in edit mode selected, with a cyan
          handle on every corner and edge (an open one only moves), the moving edges lit and its size beside them. */}
      <Marks
        zoom={zoom}
        tier="l"
        short={Math.min(box.w, box.h)}
        tone={tone}
        live={!editing}
        selected={editing}
        dragging={!!carried}
        peers={peers}
        handles={editing && !open ? EVERY_HANDLE : undefined}
        onHandle={(h, ev) => press(h)(ev)}
        resizing={sizing === 'move' ? null : sizing}
        readout={sizing && sizing !== 'move' ? `${Math.round(box.w)} × ${Math.round(box.h)}` : undefined}
      />
      {/* A comment on the plane itself (D-195), not on what's in it. */}
      <ThreadChip wid={wid} thread={own} zoom={zoom} />
      {/* What's in it, a picture here: the pointer goes through to the canvas (D-186, D-187). Open on the canvas (D-228),
          live: not in edit mode (a press moves it) or while a plane's in focus. */}
      {/* Open, the piece itself is the page under its contents, feathered: the backdrop stays out from under its text
          (D-009, D-289). */}
      {/* The window it's leaving or going into (D-267), breaking or building cell by cell under what's in it. */}
      {morph && <span ref={ghost} className={styles.ghostWindow} style={{ width: piece.w, height: piece.h }} aria-hidden />}
      {bare && focusing ? null : open ? (
        // In focus (and on its way there and back) its copy here is hidden: nothing drawn in it meanwhile.
        // Open on the canvas (D-228), live: at its own size a margin in, under the canvas's zoom (its view stays at 1, so
        // the camera moving never draws it again); what's at screen size in it reads the piece's `--z`.
        <div className={styles.openLayer} style={{ width: box.w, height: box.h }}>
          {kind === 'matrix' ? (
            <Matrix piece={piece} view={openView} live={live && !editing} editor={editor} onCanvas />
          ) : kind === 'table' ? (
            <Table piece={piece} view={openView} live={live && !editing} editor={editor} onCanvas />
          ) : kind === 'documents' ? (
            // Open on the canvas (D-234): its rows live there; a click takes the list into focus with the document beside it.
            <DocsList piece={piece} view={openView} live={live && !editing} editor={editor} onCanvas onOpen={onFocus} />
          ) : kind === 'kanban' ? (
            <Kanban piece={piece} view={openView} live={live && !editing} editor={editor} onCanvas />
          ) : kind === 'timeline' ? (
            <Timeline piece={piece} view={openView} live={live && !editing} editor={editor} onCanvas />
          ) : (
            <DocOne piece={piece} view={openView} live={live && !editing} onCanvas onMore={onFocus} />
          )}
        </div>
      ) : kind === 'matrix' ? (
        <Matrix piece={piece} view={framedView} live={false} editor={editor} />
      ) : kind === 'table' ? (
        <Table piece={piece} view={framedView} live={false} editor={editor} />
      ) : kind === 'documents' ? (
        <DocsList piece={piece} view={framedView} live={false} editor={editor} />
      ) : kind === 'document' ? (
        <DocOne piece={piece} view={framedView} live={false} />
      ) : kind === 'kanban' ? (
        <Kanban piece={piece} view={framedView} live={false} editor={editor} />
      ) : kind === 'timeline' ? (
        <Timeline piece={piece} view={framedView} live={false} editor={editor} />
      ) : (
        <Cards cards={cards} labels={labels} view={inner} live={false} editor={editor} />
      )}
      <PlaneConsole
        // In focus, or on its way there or back (D-185), the plane's console isn't here.
        className={focusing ? styles.consoleAway : undefined}
        shown={pointed || tapped || setupOn}
        size={editing ? box : null}
        noun={KIND_NAME[kind]}
        onEdit={editor ? () => setEditing(piece.id, !editing) : undefined}
        onDelete={() => useCanvasView.setState({ confirming: piece.id })}
        onFocus={onFocus}
        comments={comments}
        link={sticks(piece) ? { at: host?.id ?? null, planes, editor, onChange: (plane) => void linkLens(wid, piece, plane) } : undefined}
        // Out of its window onto the canvas and back (D-228), in edit mode; open, its pages and setup are here.
        open={canOpen(piece) ? { on: open, onToggle: () => void openPiece(wid, piece, !open) } : undefined}
        extra={
          // A documents list's tools (upload, table or shelf…) are in its focus, and on it once unframed; framed, its
          // console is only `[focus] [edit]`.
          kind === 'documents' ? (
            open ? <DocumentsTools piece={piece} editor={editor} toolClass={styles.tool} /> : undefined
          ) : kind === 'document' ? undefined : open ? (
            <OpenTools piece={piece} editor={editor} />
          ) : undefined
        }
      />
    </div>
    {carried && <Landing x={left} y={top} w={box.w} h={box.h} zoom={zoom} tier="l" tone={tone} />}
    </>
  )
}

// The name in the top edge in edit mode (D-180, D-223): a field framed in cyan on the edge, a cyan `>` before it and
// what's typed against the most (`17/80`) after it; as wide as what's typed. Enter or leaving it keeps it, Escape puts
// back what it was.
function NameField({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  // Someone else renaming it shows here unless you're typing.
  useEffect(() => {
    if (!focused) setDraft(value)
  }, [value, focused])
  return (
    // A press anywhere on the frame types into it, never moves the piece.
    <label className={`${styles.name} ${styles.nameEdit}`} onPointerDown={(e) => e.stopPropagation()}>
      <span className={styles.namePrompt} aria-hidden>
        &gt;
      </span>
      <input
        className={styles.nameField}
        aria-label={`${placeholder} name`}
        value={draft}
        placeholder={`name this ${placeholder}`}
        maxLength={PIECE_NAME_MAX}
        // As wide as what's typed (or the placeholder), plus room for the caret.
        style={{ width: `${Math.max(draft.length, placeholder.length + 10) + 1}ch` }}
        onChange={(e) => setDraft(e.target.value)}
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
      <span className={styles.nameCount}>
        {draft.length}/{PIECE_NAME_MAX}
      </span>
    </label>
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
  // A matrix's or table's link to a plane (D-215): a dropdown, `link ▾` or `⇆ 01 Pazar ▾`, to pick a plane or unlink.
  link?: { at: string | null; planes: (Box & { id: string; name?: string })[]; editor: boolean; onChange: (plane: string | null) => void }
  // A matrix or table opened onto the canvas or not (D-228), in edit mode: `[unframe]` takes it out, `[frame]` puts it back.
  open?: { on: boolean; onToggle: () => void }
  // Before `[focus]`: what an open one is used by from here (its pages, its setup).
  extra?: ReactNode
  // Pointed at, tapped, or its setup open (D-264); edit mode and the keyboard in it show it anyway.
  shown?: boolean
}

const UNLINKED = 'none'

// A console's size on the screen (D-264): 11 px at 100 % and over, growing as the canvas zooms out, 1.4 times at most
// (70 %: 13.1 px; 50 % and under: 15.4 px). In the canvas's px, so its zoom's divided back out.
const consoleScale = (zoom: number) => Math.min(1.4, Math.max(1, zoom ** -0.5)) / zoom

function PlaneConsole({ comments, size, noun = 'plane', onFocus, onEdit, onDelete, className, link, open, extra, shown = true }: ConsoleProps) {
  // Shown only while the piece is pointed at (D-264), in edit mode, or with the keyboard in it: built cell by cell as it
  // comes (170 ms), broken as it goes (90 ms). Something new in its comments stays meanwhile, a small magenta tab.
  const ref = useRef<HTMLDivElement>(null)
  const [keys, setKeys] = useState(false)
  const on = shown || !!size || keys
  const first = useRef(true)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (first.current) {
      first.current = false
      el.style.clipPath = on ? '' : 'polygon(0 0, 0 0, 0 0)'
      return
    }
    return runCells(el, on ? 'enter' : 'exit', 0, on ? 170 : 90)
  }, [on])
  const fresh = !on && !!comments?.fresh && comments.count > 0
  return (
    <>
    {fresh && (
      <div className={`${styles.console} ${className ?? ''}`} data-fresh data-screen-sized onPointerDown={(e) => e.stopPropagation()}>
        <button className={styles.tool} data-new title={`something new in the conversations inside this ${noun}`} aria-label={`Comments inside, ${comments!.count}, something new`} onClick={comments!.onOpen}>
          {comments!.mentioned ? '@' : <CommentIcon size={11} />} {comments!.count}
        </button>
      </div>
    )}
    <div
      ref={ref}
      className={`${styles.console} ${className ?? ''}`}
      role="toolbar"
      aria-label={noun}
      data-screen-sized
      data-editing={size ? true : undefined}
      data-shown={on || undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onFocus={() => setKeys(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setKeys(false)}
    >
      {size ? (
        <>
          <span className={styles.mode}>EDIT</span>
          <span className={styles.readout}>
            {size.w} × {size.h}
          </span>
          {open && (
            <button className={styles.tool} title={open.on ? 'back into its window' : 'out of its window onto the canvas, live there'} onClick={open.onToggle}>
              {open.on ? 'frame' : 'unframe'}
            </button>
          )}
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
          {link &&
            (link.editor ? (
              <Select<string>
                ariaLabel={`Link the ${noun} to a plane`}
                className={styles.linkPick}
                value={link.at ?? UNLINKED}
                options={[
                  { value: UNLINKED, label: link.at ? 'unlink' : 'link' },
                  ...link.planes.map((p) => ({ value: p.id, label: `⇆ ${p.name || 'unnamed plane'}` })),
                ]}
                onChange={(v) => v !== (link.at ?? UNLINKED) && link.onChange(v === UNLINKED ? null : v)}
              />
            ) : (
              link.at && <span className={styles.linkAt}>⇆ {link.planes.find((p) => p.id === link.at)?.name || 'plane'}</span>
            ))}
          {extra}
          <button className={styles.tool} aria-pressed={false} title={`make the ${noun} the view`} onClick={onFocus}>
            focus
          </button>
          {onEdit && (
            <button className={styles.tool} aria-pressed={false} title={noun === 'plane' ? 'move, resize or rename the plane' : `move, rename or open the ${noun}`} onClick={onEdit}>
              edit
            </button>
          )}
        </>
      )}
    </div>
    </>
  )
}

// What an open matrix or table (D-228) is used by from its console: a table's pages (D-213), and the setup, which opens
// at the bottom of the screen (CanvasSetup).
function OpenTools({ piece, editor }: { piece: WithId<Piece>; editor: boolean }) {
  const kind = kindOfPiece(piece)
  const matrix = kind === 'matrix'
  const matrixOn = useMatrixUi((s) => !!s.setup && s.canvas === piece.id)
  const tableOn = useTableUi((s) => s.setup === piece.id)
  const kanbanOn = useKanbanUi((s) => s.setup === piece.id)
  const on = matrix ? matrixOn : kind === 'kanban' ? kanbanOn : tableOn
  const toggle = () =>
    matrix
      ? useMatrixUi.setState((s) => (s.setup && s.canvas === piece.id ? { setup: false, canvas: null } : { setup: 'rows', canvas: piece.id }))
      : kind === 'kanban'
        ? useKanbanUi.setState((s) => ({ setup: s.setup === piece.id ? null : piece.id }))
        : useTableUi.setState((s) => ({ setup: s.setup === piece.id ? null : piece.id }))
  // A timeline's weeks (D-289); its filter and rows are in its focus.
  if (kind === 'timeline') return <TimelineWeeks piece={piece} toolClass={styles.tool} />
  return (
    <>
      {kind === 'table' && <TablePager piece={piece} editor={editor} />}
      {editor && (
        <button className={styles.tool} aria-pressed={on} title={matrix ? 'its rows, columns and cells' : kind === 'kanban' ? 'what it holds: tasks, or cards by a field' : 'where its rows come from, its columns'} onClick={toggle}>
          setup
        </button>
      )}
    </>
  )
}

// The setup of a matrix or table open on the canvas (D-228), as in its focus.
function CanvasSetup({ piece }: { piece: WithId<Piece> }) {
  const kind = kindOfPiece(piece)
  return kind === 'matrix' ? <MatrixSetupPanel piece={piece} /> : kind === 'kanban' ? <KanbanSetupPanel piece={piece} /> : <TableSetupPanel piece={piece} />
}

// What's in a piece, drawn again only when it changes, not as the camera moves (its view is the same object meanwhile).
const Matrix = memo(MatrixView)
const Table = memo(TableView)
const DocsList = memo(DocumentsView)
const DocOne = memo(DocumentPieceView)
const Kanban = memo(KanbanView)
const Timeline = memo(TimelineView)
const Cards = memo(PlaneCards)
// The canvas's text, drawn again as the zoom changes (its editors follow it), not as the canvas pans.
const Text = memo(TextItems)
const NONE: never[] = []
// An open matrix's or table's view (D-228): a margin in from its corner, at 1.
const OPEN_VIEW: PlaneCam = { ox: OPEN_PAD, oy: OPEN_PAD, zoom: 1 }

// Framing and unframing (D-267): as long as the cells' build-up (D-034's components'), eased both ends.
const MORPH_MS = 320
const easeBoth = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const between = (a: PlaneCam, b: PlaneCam, t: number): PlaneCam => ({ ox: a.ox + (b.ox - a.ox) * t, oy: a.oy + (b.oy - a.oy) * t, zoom: a.zoom + (b.zoom - a.zoom) * t })

// What's stuck to a piece, and what's stuck to those, all the way down (D-298), each after the one it's stuck to.
function stuckChain(shown: WithId<Piece>[], id: string): WithId<Piece>[] {
  const out: WithId<Piece>[] = []
  const hosts = [id]
  for (let i = 0; i < hosts.length; i++)
    for (const f of shown)
      if (f.stuckTo === hosts[i] && sticks(f) && !hosts.includes(f.id)) (out.push(f), hosts.push(f.id))
  return out
}

// Each list from before that holds the same things in the same order, in place of the new one.
function keepLists<T>(was: Map<string, T[]>, now: Map<string, T[]>) {
  for (const [k, list] of now) {
    const old = was.get(k)
    if (old && old.length === list.length && list.every((x, i) => x === old[i])) now.set(k, old)
  }
  return now
}

function groupBy<T>(list: T[], key: (t: T) => string) {
  const out = new Map<string, T[]>()
  for (const t of list) {
    const k = key(t)
    const at = out.get(k)
    if (at) at.push(t)
    else out.set(k, [t])
  }
  return out
}
