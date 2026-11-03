// What's stuck to a plane, opened beside it in its focus (D-211). The focus dock lists what's stuck to the plane (D-210);
// each opens on the right of the screen, which splits: the plane keeps the left part (its fit, its dock), and each piece
// opened gets a pane of its own on the right, stacked when there are more. Each pane is its own area: its own view
// (the wheel zooms it round the pointer, a drag on empty space pans it), its own dock (the focus dock, named:
// `TABLE · name | [setup] [close]`), its setup
// opening inside it. The line between the plane and the panes drags (kept per browser). A card's row in a table clicked
// takes the plane to that card; a card selected on the plane lights its row. Matrices and tables only: decks and
// timelines open in the tasks side view (D-300, D-314).
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { WithId } from '../../../data/hooks'
import type { Piece } from '../../../data/model'
import { CARD, type Card } from '../../../data/cards'
import { cardsOn, type Place } from '../../../data/places'
import { KIND_NAME, kindOfPiece } from '../../../data/pieces'
import { fitInto, glide, setSplit, stopGlide, useCanvasView, type Bounds, type PlaneCam } from '../../../state/canvasView'
import { isReducedMotion } from '../../../state/motion'
import { SIDE_PANEL_W } from '../../../ui/patterns/SidePanel'
import { SplitLine } from '../../../ui/primitives/SplitLine'
import { useWs } from './context'
import { MatrixView } from '../matrix/Matrix'
import { TableView } from '../table/Table'
import { PIECE_KINDS, useSetupOn } from './pieceKinds'
import { DockAction, FocusDock } from './FocusDock'
import styles from './Beside.module.css'
import { DUR } from '../../../ui/foundation/motion'
import { wheelStep, zoomAt } from '../../../ui/foundation/feel'
import { panPointer } from '../../../ui/foundation/dragPointer'

const PAD = 48

type Props = {
  plane: WithId<Piece>
  open: WithId<Piece>[]
  editor: boolean
  onClose: (id: string) => void
}

export function Beside({ plane, open, editor, onClose }: Props) {
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

  // The line between them drags (SplitLine, D-359).
  const drag = (ev: PointerEvent) => setSplit(ev.clientX / Math.max(1, size.w))

  // The line under pane `i`: it moves the height between that pane and the next, each kept at least 15 % of the screen.
  const dragRow = (i: number) => (ev: PointerEvent) => {
    const [y0, y1] = [tops[i], tops[i + 2]]
    const min = size.h * 0.15
    const top = ((ev.target as HTMLElement).parentElement?.getBoundingClientRect().top ?? 0)
    const at = Math.min(y1 - min, Math.max(y0 + min, ev.clientY - top))
    const next = [...w]
    const pair = w[i] + w[i + 1]
    next[i] = (pair * (at - y0)) / (y1 - y0)
    next[i + 1] = pair - next[i]
    setWeights({ ids, w: next })
  }

  if (!open.length) return null
  return (
    <>
      {open.map((p, i) => (
        <Pane key={p.id} piece={p} plane={plane} box={{ x: left, y: tops[i], w: size.w - left, h: tops[i + 1] - tops[i] }} editor={editor} first={i === 0} onClose={() => onClose(p.id)} />
      ))}
      <SplitLine data-off-space data-learn="split" style={{ left }} onDrag={drag} label="Plane and what's beside it" />
      {open.slice(0, -1).map((p, i) => (
        <SplitLine key={`row-${p.id}`} axis="y" data-off-space style={{ left, top: tops[i + 1] }} onDrag={dragRow(i)} label="Between two panes" />
      ))}
    </>
  )
}

type PaneProps = { piece: WithId<Piece>; plane: WithId<Piece>; box: Bounds; editor: boolean; first: boolean; onClose: () => void }

// A pane's own view (D-211): fitted to its box (again when the box changes), the wheel zooming round the pointer, a drag on
// its empty space panning (a press on a cell is the cell's until it moves 5 px, D-217). Beside a plane and in the tasks
// side view (D-300).
// `top`: it sits at the top left, at most its own size (the tasks side view's boards and days); `floor`: never smaller
// than this (a board stays readable, the rest panned to).
export function usePaneView(content: Bounds, box: Bounds, top = false, floor = 0) {
  const el = useRef<HTMLDivElement>(null)
  const fitted = (): PlaneCam => {
    const fit = fitInto(content, box.w, box.h, PAD)
    const zoom = top ? Math.max(floor, Math.min(1, fit.zoom)) : fit.zoom
    if (top) return { ox: PAD - content.x * zoom, oy: PAD - content.y * zoom, zoom }
    return { ox: box.w / 2 - fit.cx * zoom, oy: box.h / 2 - fit.cy * zoom, zoom }
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
      if ((e.target as HTMLElement).closest('[role=dialog], [role=menu], section, [data-scrolls]')) return
      e.preventDefault()
      const c = viewRef.current
      const r = node.getBoundingClientRect()
      const zoom = wheelStep(c.zoom, e)
      const [ox, oy] = zoomAt(c.zoom, zoom, [e.clientX - r.left, e.clientY - r.top], [c.ox, c.oy])
      setView({ zoom, ox, oy })
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
    panPointer(e, { lazy: onCell, move: (dx, dy) => setView({ ...start, ox: start.ox + dx, oy: start.oy + dy }) })
  }
  return { el, view, setView, pan }
}

// The focused plane's view glides to put a card in the middle of the plane's part; `panel`: a right panel covers the
// right of that part, the card goes to the middle of what's left. Not on the plane: nothing.
export function glidePlaneTo(picked: Pick<Card, 'id'>, plane: string, cards: Card[], places: Place[], panel = false) {
  // Its spot on this plane, where it was brought from another too (D-281).
  const card = cardsOn(cards, places, plane).find((c) => c.id === picked.id)
  if (!card) return
  const { planeCam: c, size, split } = useCanvasView.getState()
  if (!c) return
  const part = size.w * split
  const w = panel ? part - Math.min(SIDE_PANEL_W, part) : part
  const to = { ...c, ox: w / 2 - (card.x + CARD.w / 2) * c.zoom, oy: size.h / 2 - (card.y + CARD.h / 2) * c.zoom }
  stopGlide()
  if (isReducedMotion()) useCanvasView.setState({ planeCam: to })
  else glide(c, to, DUR.glide, (v) => useCanvasView.setState({ planeCam: v }))
}

function Pane({ piece, plane, box, editor, first, onClose }: PaneProps) {
  const { cards, places, tasks, pieces, documents } = useWs()
  const kind = kindOfPiece(piece)
  // A matrix or a table (what sticks to a plane and opens beside it): its record (pieceKinds.tsx).
  const rec = PIECE_KINDS[kind as 'matrix' | 'table']
  const content = rec.bounds(piece, { cards, tasks, pieces, documents })
  const { el, view, setView, pan } = usePaneView(content, box)

  // A card's row picked: the card selected, and the plane's view glides to put it in the middle of the plane's part.
  const toCard = (card: Card) => {
    useCanvasView.setState({ cardSelected: card.id, labelSelected: null })
    glidePlaneTo(card, plane.id, cards, places)
  }

  const setupOpen = useSetupOn(piece.id)
  const { setup, dock: Tools } = rec

  return (
    <div
      ref={el}
      className={styles.pane}
      data-off-space
      data-first={first || undefined}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      onPointerDown={pan}
      aria-label={`${piece.name || KIND_NAME[kind]}, beside the plane`}
    >
      {kind === 'matrix' ? (
        <MatrixView piece={piece} view={view} live editor={editor} />
      ) : (
        <TableView piece={piece} view={view} live editor={editor} onCard={toCard} onView={setView} />
      )}
      {setup && setupOpen && editor && <setup.Panel piece={piece} />}
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
        {Tools && <Tools piece={piece} editor={editor} />}
        {setup && editor && <DockAction label="setup" pressed={setupOpen} title={setup.title} onClick={() => setup.toggle(piece.id)} />}
        <DockAction label="close" main title="close it; it stays stuck to the plane" onClick={onClose} />
      </FocusDock>
    </div>
  )
}
