// What's stuck to a plane, opened beside it in its focus (D-211). The focus dock lists what's stuck to the plane (D-210);
// each opens on the right of the screen, which splits: the plane keeps the left part (its fit, its dock), and each piece
// opened gets a pane of its own on the right, stacked when there are more. Each pane is its own area: its own view
// (the wheel zooms it round the pointer, a drag on empty space pans it), its own dock (the focus dock, named:
// `TABLE · name | [setup] [close]`), its setup
// opening inside it. The line between the plane and the panes drags (kept per browser). A card's row in a table clicked
// takes the plane to that card; a card selected on the plane lights its row. A kanban (D-255) opens here too: a task
// picked glides the plane to its card (the task's panel opens, over the plane's part).
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { CARD, type Card } from '../../data/cards'
import type { Task } from '../../data/tasks'
import { KIND_NAME, kindOfPiece } from '../../data/pieces'
import { fitInto, glide, setSplit, stopGlide, useCanvasView, type Bounds, type PlaneCam } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import { SIDE_PANEL_W } from '../../ui/SidePanel'
import { useWs } from './context'
import { matrixBounds, MatrixView, toggleMatrixSetup, useMatrixUi } from './Matrix'
import { MatrixSetupPanel } from './MatrixSetup'
import { tableBounds, TablePager, TableView, useTableUi } from './Table'
import { kanbanBounds, KanbanDockTools, KanbanLanes, KanbanView } from './Kanban'
import { KanbanFilterDock } from './KanbanFilterDock'
import { DockAction, FocusDock } from './FocusDock'
import { TableSetupPanel } from './TableSetup'
import styles from './Beside.module.css'

const ZOOM_MIN = 0.1
const ZOOM_MAX = 4
const PAD = 48
// How far a press on a cell moves before it pans instead (D-217).
const CELL_DRAG_PX = 5

// What Escape closes next (after a selection): a setup, then what's beside (the last opened), then focus. The dock
// whose action that is shows `esc` on it.
export type EscNext = { what: 'setup' | 'close'; id: string } | 'unfocus'

type Props = {
  plane: WithId<Piece>
  open: WithId<Piece>[]
  editor: boolean
  esc: EscNext
  // The matrix pane its setup opens in, when it's open.
  matrixSetupPane: string | null
  onClose: (id: string) => void
}

export function Beside({ plane, open, editor, esc, matrixSetupPane, onClose }: Props) {
  const size = useCanvasView((s) => s.size)
  const split = useCanvasView((s) => s.split)
  const left = Math.round(size.w * split)
  // Stacked panes share the height by their weights; the lines between them drag (D-211). Even again when what's open
  // changes.
  const ids = open.map((p) => p.id).join(',')
  const [weights, setWeights] = useState<{ ids: string; w: number[] }>({ ids, w: open.map(() => 1) })
  const w = weights.ids === ids ? weights.w : open.map(() => 1)
  const total = w.reduce((a, b) => a + b, 0) || 1
  const tops = w.reduce<number[]>((acc, x, i) => [...acc, acc[i] + (x / total) * size.h], [0])

  // The line between them drags; the plane's view keeps the point under the line's middle where it was.
  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => setSplit(ev.clientX / Math.max(1, size.w))
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  // The line under pane `i`: it moves the height between that pane and the next, each kept at least 15 % of the screen.
  const dragRow = (i: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const [y0, y1] = [tops[i], tops[i + 2]]
    const min = size.h * 0.15
    const move = (ev: PointerEvent) => {
      const at = Math.min(y1 - min, Math.max(y0 + min, ev.clientY - el.parentElement!.getBoundingClientRect().top))
      const next = [...w]
      const pair = w[i] + w[i + 1]
      next[i] = (pair * (at - y0)) / (y1 - y0)
      next[i + 1] = pair - next[i]
      setWeights({ ids, w: next })
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  if (!open.length) return null
  return (
    <>
      {open.map((p, i) => (
        <Pane key={p.id} piece={p} plane={plane} box={{ x: left, y: tops[i], w: size.w - left, h: tops[i + 1] - tops[i] }} editor={editor} first={i === 0} esc={esc} matrixSetupHere={p.id === matrixSetupPane} onClose={() => onClose(p.id)} />
      ))}
      <div className={styles.divider} style={{ left }} onPointerDown={drag} role="separator" aria-orientation="vertical" aria-label="Plane and what's beside it" />
      {open.slice(0, -1).map((p, i) => (
        <div key={`row-${p.id}`} className={styles.rowDivider} style={{ left, top: tops[i + 1] }} onPointerDown={dragRow(i)} role="separator" aria-orientation="horizontal" aria-label="Between two panes" />
      ))}
    </>
  )
}

type PaneProps = { piece: WithId<Piece>; plane: WithId<Piece>; box: Bounds; editor: boolean; first: boolean; esc: EscNext; matrixSetupHere: boolean; onClose: () => void }

function Pane({ piece, plane, box, editor, first, esc, matrixSetupHere, onClose }: PaneProps) {
  const { cards, tasks } = useWs()
  const kind = kindOfPiece(piece)
  const el = useRef<HTMLDivElement>(null)
  const content = kind === 'matrix' ? matrixBounds(piece, cards) : kind === 'kanban' ? kanbanBounds(piece, tasks) : tableBounds(piece, cards)
  const fitted = (): PlaneCam => {
    const { zoom, cx, cy } = fitInto(content, box.w, box.h, PAD)
    return { ox: box.w / 2 - cx * zoom, oy: box.h / 2 - cy * zoom, zoom }
  }
  const [view, setView] = useState<PlaneCam>(fitted)
  const viewRef = useRef(view)
  viewRef.current = view
  // Fitted again when its box changes (the line dragged, another pane opened or closed).
  const key = `${box.w}x${box.h}`
  useLayoutEffect(() => {
    setView(fitted())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // The wheel zooms its own view round the pointer; a listener of our own (React's are passive), kept from the plane.
  useEffect(() => {
    const node = el.current
    if (!node) return
    const onWheel = (e: WheelEvent) => {
      e.stopPropagation()
      if ((e.target as HTMLElement).closest('[role=dialog], [role=menu], section')) return
      e.preventDefault()
      const c = viewRef.current
      const r = node.getBoundingClientRect()
      const [px, py] = [e.clientX - r.left, e.clientY - r.top]
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, c.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))))
      const k = zoom / c.zoom
      setView({ zoom, ox: px - (px - c.ox) * k, oy: py - (py - c.oy) * k })
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  // A drag on its empty space pans it; a press there lets go of what's selected.
  const pan = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (e.button !== 0 && e.button !== 1) return
    // A press on a cell is the cell's until it moves 5 px: a click still selects it, a drag pans (as in focus, D-217).
    const onCell = !!(e.target as HTMLElement).closest('[data-cell]')
    if (!onCell) useCanvasView.setState({ cardSelected: null, labelSelected: null, linkSelected: null })
    const start = viewRef.current
    const [sx, sy] = [e.clientX, e.clientY]
    const node = e.currentTarget
    const id = e.pointerId
    let panning = false
    const begin = () => {
      panning = true
      node.setPointerCapture(id)
      node.dataset.panning = 'true'
    }
    if (!onCell) begin()
    const move = (ev: PointerEvent) => {
      if (!panning) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < CELL_DRAG_PX) return
        begin()
      }
      setView({ ...start, ox: start.ox + ev.clientX - sx, oy: start.oy + ev.clientY - sy })
    }
    const up = () => {
      delete node.dataset.panning
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', up)
    }
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', up)
  }

  // A card's row picked: the card selected, and the plane's view glides to put it in the middle of the plane's part.
  const toCard = (card: Card) => {
    useCanvasView.setState({ cardSelected: card.id, labelSelected: null })
    glideTo(card)
  }
  // A task picked: the plane glides to its card (on this plane), not selecting it (the task's panel stays open).
  const toTask = (t: Task) => {
    const card = t.cardId ? cards.find((c) => c.id === t.cardId) : undefined
    if (card) glideTo(card, true)
  }
  // `panel`: the task's panel covers the right of the plane's part; the card goes to the middle of what's left.
  const glideTo = (card: Card, panel = false) => {
    if (card.pieceId !== plane.id) return
    const { planeCam: c, size, split } = useCanvasView.getState()
    if (!c) return
    const part = size.w * split
    const w = panel ? part - Math.min(SIDE_PANEL_W, part) : part
    const to = { ...c, ox: w / 2 - (card.x + CARD.w / 2) * c.zoom, oy: size.h / 2 - (card.y + CARD.h / 2) * c.zoom }
    stopGlide()
    if (isReducedMotion()) useCanvasView.setState({ planeCam: to })
    else glide(c, to, 420, (v) => useCanvasView.setState({ planeCam: v }))
  }

  const tableSetup = useTableUi((s) => s.setup === piece.id)
  // Read as on / off, so a wider setup state (a tab open) still reads right. A matrix's setup is one switch for all (its
  // own store): it shows in one matrix pane only, the one CanvasView names.
  const matrixSetup = useMatrixUi((s) => !!s.setup) && matrixSetupHere
  const setupOpen = kind === 'table' ? tableSetup : matrixSetup
  const toggleSetup = () =>
    kind === 'table' ? useTableUi.setState((s) => ({ setup: s.setup === piece.id ? null : piece.id })) : toggleMatrixSetup()
  const escHere = (what: 'setup' | 'close') => (esc !== 'unfocus' && esc.what === what && esc.id === piece.id ? 'esc' : undefined)

  return (
    <div
      ref={el}
      className={styles.pane}
      data-first={first || undefined}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      onPointerDown={pan}
      aria-label={`${piece.name || KIND_NAME[kind]}, beside the plane`}
    >
      {kind === 'matrix' ? (
        <MatrixView piece={piece} view={view} live editor={editor} />
      ) : kind === 'kanban' ? (
        <KanbanView piece={piece} view={view} live editor={editor} onTask={toTask} />
      ) : (
        <TableView piece={piece} view={view} live editor={editor} onCard={toCard} onView={setView} />
      )}
      {kind === 'table' && tableSetup && editor && <TableSetupPanel piece={piece} />}
      {kind === 'matrix' && matrixSetup && editor && <MatrixSetupPanel piece={piece} />}
      {/* Its dock: the focus dock itself, at the bottom middle of its part, named (D-189, D-211). */}
      <FocusDock
        label={`${KIND_NAME[kind]} beside`}
        name={
          <>
            <span className={styles.kind}>{KIND_NAME[kind]}</span>
            {piece.name ? ` · ${piece.name}` : ''}
          </>
        }
      >
        {kind === 'table' && <TablePager piece={piece} editor={editor} />}
        {kind === 'kanban' && <KanbanFilterDock piece={piece} />}
        {kind === 'kanban' && <KanbanLanes piece={piece} editor={editor} />}
        {kind === 'kanban' && <KanbanDockTools piece={piece} editor={editor} />}
        {editor && kind !== 'kanban' && (
          <DockAction
            label="setup"
            pressed={setupOpen}
            keyHint={escHere('setup')}
            title={kind === 'table' ? 'where its rows come from, its columns' : 'its rows, columns and cells'}
            onClick={toggleSetup}
          />
        )}
        <DockAction label="close" main keyHint={escHere('close')} title="close it; it stays stuck to the plane" onClick={onClose} />
      </FocusDock>
    </div>
  )
}
