// /workspaces/:wid: the workspace's canvas (D-174, D-176). An infinite space over the flowing backdrop, with no grid
// marks. Planes are placed on it from the side nav's `+`, at the middle of the screen; tables and the rest come later.
// Drag to pan, the wheel zooms round the pointer: always the canvas, over a plane too (D-186), until a plane is in focus,
// when they're the plane's (FocusedPlane). A plane is moved, resized and renamed only in edit mode (D-180), switched on
// and off from its console; in edit mode it takes the drag, it's selected, and Delete takes it away. Escape or a click on
// empty space lets go of the selection. `0` (or the side nav's fit) frames everything, or in focus the plane's contents.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../data/auth'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { deletePiece, pieceRef, KIND_NAME, PIECE_MIN, PIECE_NAME_MAX, placePiece, renamePiece, snap, type Box } from '../../data/pieces'
import { HazardConfirm } from '../../ui/HazardConfirm'
import { canEditIn } from '../../data/workspaces'
import { camOf, fitCanvas, fitInto, fitPlane, setCam, setEditing, useCanvasView, type Cam, type PlaneCam, type ScreenRect } from '../../state/canvasView'
import { useWs } from './context'
import { FocusedPlane } from './FocusedPlane'
import { DrawSection } from './DrawSection'
import { labelBox, TextItems } from './TextItems'
import { spaceBounds } from './spaceBounds'
import { CANVAS, deleteLabel, type Label } from '../../data/labels'
import { PlaneCards } from './PlaneCards'
import { DockAction, FocusDock } from './FocusDock'
import { deleteCard, type Card } from '../../data/cards'
import { GRID } from '../../data/grid'
import styles from './CanvasView.module.css'

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
  const { wid, workspace, pieces, cards, labels } = useWs()
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
  // What fit frames (D-186, D-188): the focused plane's cards and text, or the canvas's planes and text.
  const fitRef = useRef(() => {})
  fitRef.current = () => {
    if (focused) fitPlane(spaceBounds(focusedCards, focusedLabels))
    else fitCanvas(wid, [...pieces, ...canvasLabels.map(labelBox)])
  }
  const allLabelsRef = useRef(labels)
  allLabelsRef.current = labels
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
    useCanvasView.setState({ focusSpread: false, focusArrived: false, focusLeaving: false, cardSelected: null, cardEditing: null })
    setParams({}, { replace: true })
  }
  // Left by the back button, or a plane deleted (by someone else) while in focus: nothing to animate.
  useEffect(() => {
    if (!focusId) useCanvasView.setState({ focusSpread: false, focusArrived: false, focusLeaving: false, cardSelected: null, cardEditing: null })
  }, [focusId])
  useEffect(() => {
    if (focusId && !focused && pieces.length > 0) setParams({}, { replace: true })
  }, [focusId, focused, pieces.length, setParams])

  // The screen box, for the middle of the screen and zooming round the pointer.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const ro = new ResizeObserver(() => useCanvasView.setState({ size: { w: el.clientWidth, h: el.clientHeight } }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Wheel zoom round the pointer; a listener of our own, since React's wheel handlers are passive.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
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
        const { cardSelected } = useCanvasView.getState()
        const card = focusedCardsRef.current.find((c) => c.id === cardSelected)
        if (e.key === 'Escape') {
          if (card) useCanvasView.setState({ cardSelected: null })
          else unfocusRef.current()
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && card && editor) {
          e.preventDefault()
          useCanvasView.setState({ cardSelected: null })
          void deleteCard(wid, card)
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

  const pan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    useCanvasView.setState({ selected: null, labelSelected: null })
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
    <div ref={root} className={styles.canvas} onPointerDown={pan} aria-label="Canvas" role="application">
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
          home={homeOf(focused, screenRect(focused), focusedCards, focusedLabels)}
          spread={focusSpread}
          leaving={focusLeaving}
          lens={lens}
          // Once there, its cards centred and fitted to the screen (D-186, D-187).
          onArrived={() => {
            useCanvasView.setState({ focusArrived: true })
            fitRef.current()
          }}
          onLeft={left}
        >
          <FocusedCards cards={focusedCards} labels={focusedLabels} editor={editor} />
          {drawing === focused.id && <DrawSection space={focused.id} toSpace={planeToSpace} />}
          {/* Once it's there, and gone the moment it leaves (D-185): the dock on the bottom edge (D-189). */}
          {focusArrived && !focusLeaving && (
            <FocusDock>
              <DockAction label="unfocus" keyHint="esc" title="back to the canvas (Esc)" main onClick={unfocus} />
            </FocusDock>
          )}
        </FocusedPlane>
      )}
      {drawing === CANVAS && !focused && <DrawSection space={CANVAS} toSpace={canvasToSpace} />}
      {confirming && (
        <HazardConfirm
          title={`delete ${confirming.name ? `"${confirming.name}"` : 'this plane'}?`}
          lines={['The plane and everything on it goes.', `${UNDO_HINT} brings it back.`]}
          confirm="delete"
          onCancel={() => useCanvasView.setState({ confirming: null })}
          onConfirm={() => {
            useCanvasView.setState({ confirming: null })
            setEditing(confirming.id, false)
            void deletePiece(wid, confirming.id, cards, labels)
          }}
        />
      )}
    </div>
  )
}

const UNDO_HINT = navigator.platform.toLowerCase().includes('mac') ? '⌘Z' : 'Ctrl+Z'

type BoxProps = { piece: WithId<Piece>; cam: Cam; selected: boolean; editing: boolean; editor: boolean; onFocus: () => void; focusing: boolean; cards: Card[]; labels: Label[] }

// What a plane shows of its cards on the canvas (D-187): all of them, centred and fitted inside its box, never past 1;
// none = its own (0, 0) at its corner. Plane px inside its 1 px edge.
function innerView(box: Box, cards: Card[], labels: Label[]): PlaneCam {
  const b = spaceBounds(cards, labels)
  if (!b) return { ox: 0, oy: 0, zoom: 1 }
  const { zoom, cx, cy } = fitInto(b, box.w - 2, box.h - 2, GRID)
  return { ox: (box.w - 2) / 2 - cx * zoom, oy: (box.h - 2) / 2 - cy * zoom, zoom }
}

// That view on the screen, where focus starts from and goes back to.
function homeOf(piece: Box, at: ScreenRect, cards: Card[], labels: Label[]): PlaneCam {
  const v = innerView(piece, cards, labels)
  return { ox: at.x + at.zoom * (1 + v.ox), oy: at.y + at.zoom * (1 + v.oy), zoom: at.zoom * v.zoom }
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

function PieceBox({ piece, cam, selected, editing, editor, onFocus, focusing, cards, labels }: BoxProps) {
  const { wid } = useWs()
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
      if (to && !same(to, from)) void placePiece(wid, piece.id, from, to).catch(() => setHeld(null))
      else setHeld(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const kind = KIND_NAME.plane
  // Its cards fitted inside it, and its marks with them (D-187).
  const inner = innerView(box, cards, labels)
  const step = GRID * inner.zoom
  return (
    <div
      className={styles.piece}
      data-selected={selected || undefined}
      data-editing={editing || undefined}
      data-dragging={held ? true : undefined}
      style={{ left: box.x + (shift?.dx ?? 0), top: box.y + (shift?.dy ?? 0), width: box.w, height: box.h, ['--mark' as string]: `${step}px`, ['--mx' as string]: `${inner.ox - step / 2}px`, ['--my' as string]: `${inner.oy - step / 2}px` }}
      onPointerDown={press('move')}
    >
      {editing ? (
        <NameField value={piece.name ?? ''} placeholder={kind} onSave={(name) => name !== (piece.name ?? '') && void renamePiece(wid, piece.id, name)} />
      ) : (
        <span className={styles.name} data-unnamed={!piece.name || undefined}>
          {piece.name || kind}
        </span>
      )}
      {/* Its cards, a picture here: the pointer goes through to the canvas (D-186, D-187). */}
      <PlaneCards cards={cards} labels={labels} view={inner} live={false} editor={editor} />
      {CORNERS.map((h) => (
        <span key={h} className={styles.mark} data-handle={h} onPointerDown={editing ? press(h) : undefined} aria-hidden />
      ))}
      {editing && EDGES.map((h) => <span key={h} className={styles.bar} data-handle={h} onPointerDown={press(h)} aria-hidden />)}
      <PlaneConsole
        // In focus, or on its way there or back (D-185), the plane's console isn't here.
        className={focusing ? styles.consoleAway : undefined}
        size={editing ? box : null}
        onEdit={editor ? () => setEditing(piece.id, !editing) : undefined}
        onDelete={() => useCanvasView.setState({ confirming: piece.id })}
        onFocus={onFocus}
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
  size: Box | null
  onFocus: () => void
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

function PlaneConsole({ size, onFocus, onEdit, onDelete, className }: ConsoleProps) {
  return (
    <div
      className={`${styles.console} ${className ?? ''}`}
      role="toolbar"
      aria-label="Plane"
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
            <button className={styles.tool} data-tone="danger" title="delete the plane (Delete)" onClick={onDelete}>
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
          <button className={styles.tool} aria-pressed={false} title="make the plane the view" onClick={onFocus}>
            focus
          </button>
          {onEdit && (
            <button className={styles.tool} aria-pressed={false} title="move, resize or rename the plane" onClick={onEdit}>
              edit
            </button>
          )}
        </>
      )}
    </div>
  )
}
