// A plane's cards (D-187), drawn in the plane's own px through a view (where its (0, 0) is and its zoom). On the canvas
// they're a picture, fitted in the plane, and the pointer passes through to the canvas (D-186); in focus they're live:
// a click selects (the cards' corner marks, D-150), a drag moves (5 px first, snapped to the grid, alt = free, held where
// dropped until the data's back), a double-click types the title, which a new card starts with.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { CARD, moveCard, retitleCard, TITLE_MAX, type Card, type CardType } from '../../data/cards'
import { snap } from '../../data/grid'
import type { PlaneCam } from '../../state/canvasView'
import { useCanvasView } from '../../state/canvasView'
import { useWs } from './context'
import styles from './PlaneCards.module.css'

const DRAG_PX = 5

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

type Props = { cards: Card[]; view: PlaneCam; live: boolean; editor: boolean }

export function PlaneCards({ cards, view, live, editor }: Props) {
  return (
    <div className={styles.layer} data-live={live || undefined}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }}>
        {cards.map((c) => (
          <CardBox key={c.id} card={c} zoom={view.zoom} live={live} editor={editor} />
        ))}
      </div>
    </div>
  )
}

function CardBox({ card, zoom, live, editor }: { card: Card; zoom: number; live: boolean; editor: boolean }) {
  const { wid } = useWs()
  const selected = useCanvasView((s) => live && s.cardSelected === card.id)
  const typing = useCanvasView((s) => live && editor && s.cardEditing === card.id)
  const [held, setHeld] = useState<[number, number] | null>(null)
  useEffect(() => {
    if (held && held[0] === card.x && held[1] === card.y) setHeld(null)
  }, [held, card.x, card.y])
  const [x, y] = held ?? [card.x, card.y]

  const press = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live || e.button !== 0) return
    // The plane would pan.
    e.stopPropagation()
    useCanvasView.setState({ cardSelected: card.id })
    if (!editor || typing) return
    const [sx, sy] = [e.clientX, e.clientY]
    let to: [number, number] | null = null
    const move = (ev: PointerEvent) => {
      const [dx, dy] = [ev.clientX - sx, ev.clientY - sy]
      if (!to && Math.hypot(dx, dy) < DRAG_PX) return
      const at = (v: number) => (ev.altKey ? Math.round(v) : snap(v))
      to = [at(card.x + dx / zoom), at(card.y + dy / zoom)]
      setHeld(to)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (to && (to[0] !== card.x || to[1] !== card.y)) void moveCard(wid, card, to).catch(() => setHeld(null))
      else setHeld(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <div
      className={styles.card}
      style={{ left: x, top: y, width: CARD.w, height: CARD.h, ['--type' as string]: TYPE_ACCENT[card.type] }}
      data-selected={selected || undefined}
      data-dragging={held ? true : undefined}
      onPointerDown={press}
      onDoubleClick={live && editor ? () => useCanvasView.setState({ cardEditing: card.id, cardSelected: card.id }) : undefined}
    >
      <span className={styles.kind}>{card.type}</span>
      {typing ? (
        <TitleField card={card} />
      ) : (
        <p className={styles.title} data-empty={!card.title || undefined}>
          {card.title || PLACEHOLDER[card.type]}
        </p>
      )}
      <i className={styles.mark} data-corner="nw" aria-hidden />
      <i className={styles.mark} data-corner="ne" aria-hidden />
      <i className={styles.mark} data-corner="se" aria-hidden />
      <i className={styles.mark} data-corner="sw" aria-hidden />
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
