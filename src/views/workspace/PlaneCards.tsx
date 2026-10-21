// A plane's cards (D-187), drawn in the plane's own px through a view (where its (0, 0) is and its zoom). On the canvas
// they're a picture, fitted in the plane, and the pointer passes through to the canvas (D-186); in focus they're live:
// a click selects (the cards' corner marks, D-150), a drag moves (5 px first, snapped to the grid, alt = free, held where
// dropped until the data's back), a double-click types the title, which a new card starts with.
// As on the old board (D-150): a card added while you look builds up cell by cell; pressed, its corner marks close in
// on its corners in its colour; dragged, it goes 0.8 round the point held and follows the pointer, its marks on where
// it lands at full size, and grows into them when let go.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { CARD, cardRef, moveCard, retitleCard, TITLE_MAX, type Card, type CardType } from '../../data/cards'
import type { Label } from '../../data/labels'
import { TextItems } from './TextItems'
import { PeerRing } from './collab'
import { ThreadChip, threadOn } from './Threads'
import { snap } from '../../data/grid'
import { useRevealed } from '../../state/curtain'
import { isReducedMotion } from '../../state/motion'
import { runCells } from '../../ui/Appear'
import type { PlaneCam } from '../../state/canvasView'
import { useCanvasView } from '../../state/canvasView'
import { useWs } from './context'
import styles from './PlaneCards.module.css'

const DRAG_PX = 5
// A dragged card's size (the old board's CARRIED).
const CARRIED = 0.8

// Type = the left edge and the label in its colour (D-055, D-057).
export const TYPE_ACCENT: Record<CardType, string> = {
  customer: 'var(--accent-green)',
  problem: 'var(--accent-magenta)',
  competitor: 'var(--accent-yellow)',
  idea: 'var(--fg)',
  feature: 'var(--accent-cyan)',
}

const PLACEHOLDER: Record<CardType, string> = {
  customer: 'Who are they?',
  problem: 'What hurts?',
  competitor: 'Who else does it?',
  idea: "What's the thought?",
  feature: 'What does it do?',
}

type Props = { cards: Card[]; labels: Label[]; view: PlaneCam; live: boolean; editor: boolean }

// A plane's contents: its sections under its cards, its text over them (D-188).
export function PlaneCards({ cards, labels, view, live, editor }: Props) {
  const { wid } = useWs()
  const carry = cards.map((c) => ({ id: c.id, ref: cardRef(wid, c.type, c.id), x: c.x, y: c.y, w: CARD.w, h: CARD.h }))
  // The cards there when this opened are just there in focus (the plane's own picture was already showing them); on the
  // canvas they build up with the page. Any card after that builds up as it arrives.
  const [first] = useState(() => new Set(cards.map((c) => c.id)))
  return (
    <div className={styles.layer} data-live={live || undefined}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }}>
        <TextItems labels={labels} layer="frames" live={live} editor={editor} zoom={view.zoom} carry={carry} />
        {cards.map((c) => (
          <CardBox key={c.id} card={c} zoom={view.zoom} live={live} editor={editor} arrive={!(live && first.has(c.id))} />
        ))}
        <TextItems labels={labels} layer="text" live={live} editor={editor} zoom={view.zoom} carry={carry} />
      </div>
    </div>
  )
}

type Drag = { free: [number, number]; at: [number, number] }

function CardBox({ card, zoom, live, editor, arrive }: { card: Card; zoom: number; live: boolean; editor: boolean; arrive: boolean }) {
  const { wid, threads } = useWs()
  const face = useRef<HTMLDivElement>(null)
  const revealed = useRevealed()
  useLayoutEffect(() => {
    if (arrive && face.current && !isReducedMotion()) face.current.style.clipPath = 'polygon(0 0, 0 0, 0 0)'
    // On mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!arrive || !revealed || !face.current) return
    return runCells(face.current, 'enter', 0, 320)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed])
  const [pressed, setPressed] = useState(false)
  // While dragged: where the card is under the pointer (free) and the point held in it, both in plane px.
  const [drag, setDrag] = useState<Drag | null>(null)
  const selected = useCanvasView((s) => live && s.cardSelected === card.id)
  const typing = useCanvasView((s) => live && editor && s.cardEditing === card.id)
  const [held, setHeld] = useState<[number, number] | null>(null)
  useEffect(() => {
    if (held && held[0] === card.x && held[1] === card.y) setHeld(null)
  }, [held, card.x, card.y])
  // Carried by a section being dragged (D-188).
  const shift = useCanvasView((s) => (s.dragShift && s.dragShift.ids.includes(card.id) ? s.dragShift : null))
  const [x, y] = held ?? [card.x + (shift?.dx ?? 0), card.y + (shift?.dy ?? 0)]

  const press = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live || e.button !== 0) return
    // The plane would pan.
    e.stopPropagation()
    useCanvasView.setState({ cardSelected: card.id, labelSelected: null })
    if (typing) return
    setPressed(true)
    const [sx, sy] = [e.clientX, e.clientY]
    const rect = e.currentTarget.getBoundingClientRect()
    const at: [number, number] = [(sx - rect.left) / zoom, (sy - rect.top) / zoom]
    let to: [number, number] | null = null
    const move = (ev: PointerEvent) => {
      if (!editor) return
      const [dx, dy] = [ev.clientX - sx, ev.clientY - sy]
      if (!to && Math.hypot(dx, dy) < DRAG_PX) return
      const free: [number, number] = [card.x + dx / zoom, card.y + dy / zoom]
      const place = (v: number) => (ev.altKey ? Math.round(v) : snap(v))
      to = [place(free[0]), place(free[1])]
      setHeld(to)
      setDrag({ free, at })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setPressed(false)
      setDrag(null)
      if (to && (to[0] !== card.x || to[1] !== card.y)) void moveCard(wid, card, to).catch(() => setHeld(null))
      else setHeld(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // The face, small, under the pointer: from where it lands (the box) to where it is, shrunk round the point held.
  const carried = drag ? { translate: `${drag.free[0] - x}px ${drag.free[1] - y}px`, scale: `${CARRIED}`, transformOrigin: `${drag.at[0]}px ${drag.at[1]}px` } : undefined

  return (
    <div
      className={styles.box}
      style={{ left: x, top: y, width: CARD.w, height: CARD.h, ['--type' as string]: TYPE_ACCENT[card.type] }}
      data-selected={selected || undefined}
      data-pressed={pressed || !!drag || undefined}
      data-dragging={drag ? true : undefined}
      data-target={`card:${card.id}`}
      onPointerDown={press}
      onDoubleClick={live && editor ? () => useCanvasView.setState({ cardEditing: card.id, cardSelected: card.id }) : undefined}
    >
      <div ref={face} className={styles.card} style={carried}>
        <span className={styles.kind}>{card.type}</span>
        {typing ? (
          <TitleField card={card} />
        ) : (
          <p className={styles.title} data-empty={!card.title || undefined}>
            {card.title || PLACEHOLDER[card.type]}
          </p>
        )}
      </div>
      <i className={styles.mark} data-corner="nw" aria-hidden />
      <i className={styles.mark} data-corner="ne" aria-hidden />
      <i className={styles.mark} data-corner="se" aria-hidden />
      <i className={styles.mark} data-corner="sw" aria-hidden />
      {live && <PeerRing id={card.id} space={card.pieceId} />}
      {live && <ThreadChip wid={wid} thread={threadOn(threads, card.id)} zoom={zoom} />}
    </div>
  )
}

// The title being typed: Enter or leaving keeps it, Escape puts it back. Typing merges into one undo step.
function TitleField({ card }: { card: Card }) {
  const { wid } = useWs()
  const [draft, setDraft] = useState(card.title)
  const field = useRef<HTMLTextAreaElement>(null)
  const done = useRef(false)
  useEffect(() => {
    field.current?.focus()
    field.current?.select()
  }, [])
  const finish = (keep: boolean) => {
    if (done.current) return
    done.current = true
    const title = draft.trim()
    if (keep && title !== card.title) void retitleCard(wid, card, title)
    useCanvasView.setState({ cardEditing: null })
  }
  return (
    <textarea
      ref={field}
      className={`${styles.title} ${styles.field}`}
      aria-label={`${card.type} title`}
      value={draft}
      placeholder={PLACEHOLDER[card.type]}
      maxLength={TITLE_MAX}
      rows={3}
      onChange={(e) => setDraft(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter' && !e.shiftKey) (e.preventDefault(), finish(true))
        if (e.key === 'Escape') finish(false)
      }}
    />
  )
}
