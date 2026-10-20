// /workspaces/:wid: the workspace's canvas (D-174, D-176). An infinite plane over the flowing backdrop, with no grid marks.
// Boards are placed on it from the side nav's `+`, at the middle of the screen; tables and the rest come later. Drag empty
// space to pan, the wheel zooms round the pointer. A board drags by itself (5 px before a press turns into a drag),
// Delete takes the selected one away, Escape or a click on empty space lets go of it.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useAuth } from '../../data/auth'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { deletePiece, movePiece } from '../../data/pieces'
import { canEditIn } from '../../data/workspaces'
import { camOf, setCam, useCanvasView, type Cam } from '../../state/canvasView'
import { useWs } from './context'
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
  const { wid, workspace, pieces } = useWs()
  const { user } = useAuth()
  const editor = canEditIn(workspace, user?.id)
  const cam = useCanvasView((s) => s.cams[wid]) ?? camOf(wid)
  const size = useCanvasView((s) => s.size)
  const selected = useCanvasView((s) => s.selected)
  const root = useRef<HTMLDivElement>(null)

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

  // Delete and Escape for the selected board, unless typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, [contenteditable], dialog')) return
      const id = useCanvasView.getState().selected
      if (!id) return
      if (e.key === 'Escape') useCanvasView.setState({ selected: null })
      if ((e.key === 'Delete' || e.key === 'Backspace') && editor) {
        e.preventDefault()
        useCanvasView.setState({ selected: null })
        void deletePiece(wid, id)
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
    useCanvasView.setState({ selected: null })
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
      <div
        className={styles.world}
        style={{ transform: `translate(${onPixel(size.w / 2 + cam.x)}px, ${onPixel(size.h / 2 + cam.y)}px) scale(${cam.zoom})` }}
      >
        {pieces.map((p) => (
          <PieceBox key={p.id} piece={p} cam={cam} selected={p.id === selected} editor={editor} />
        ))}
      </div>
    </div>
  )
}

type BoxProps = { piece: WithId<Piece>; cam: Cam; selected: boolean; editor: boolean }

function PieceBox({ piece, cam, selected, editor }: BoxProps) {
  const { wid } = useWs()
  // Where a drag has it, held after the drop until the data gets there (else it would jump back for a moment).
  const [held, setHeld] = useState<[number, number] | null>(null)
  useEffect(() => {
    if (held && piece.x === held[0] && piece.y === held[1]) setHeld(null)
  }, [held, piece.x, piece.y])
  const [x, y] = held ?? [piece.x, piece.y]

  const press = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // The canvas would pan and let go of the selection.
    e.stopPropagation()
    useCanvasView.setState({ selected: piece.id })
    if (!editor) return
    const el = e.currentTarget
    const [sx, sy] = [e.clientX, e.clientY]
    const from: [number, number] = [piece.x, piece.y]
    let to: [number, number] | null = null
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const [dx, dy] = [ev.clientX - sx, ev.clientY - sy]
      if (!to && Math.hypot(dx, dy) < DRAG_PX) return
      to = [Math.round(from[0] + dx / cam.zoom), Math.round(from[1] + dy / cam.zoom)]
      setHeld(to)
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      if (to && (to[0] !== from[0] || to[1] !== from[1])) void movePiece(wid, piece.id, from, to).catch(() => setHeld(null))
      else setHeld(null)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  return (
    <div
      className={styles.piece}
      data-selected={selected || undefined}
      data-dragging={held ? true : undefined}
      style={{ left: x, top: y, width: piece.w, height: piece.h }}
      onPointerDown={press}
    >
      <span className={styles.name}>{piece.name || 'board'}</span>
      {/* Empty for now: the board's cards come back inside it, piece by piece (D-177). */}
    </div>
  )
}
