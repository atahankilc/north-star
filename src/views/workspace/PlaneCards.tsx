// A plane's cards (D-187), drawn in the plane's own px through a view (where its (0, 0) is and its zoom). On the canvas
// they're a picture, fitted in the plane, and the pointer passes through to the canvas (D-186); in focus they're live:
// a click selects (the cards' corner marks, D-150), a drag moves (5 px first, snapped to the grid, alt = free, held where
// dropped until the data's back), a double-click types the title, which a new card starts with.
// As on the old board (D-150): a card added while you look builds up cell by cell; pressed, its corner marks close in
// on its corners in its colour; dragged, it goes 0.8 round the point held and follows the pointer, its marks on where
// it lands at full size, and grows into them when let go.
// Inside (D-152, D-205): the type and, right of it, a status, regions or priority with the evidence as cells; the title;
// the facts line; tags as chips. Smaller on screen (D-153): the title alone, bigger, in whole words; far out its lines
// as bars. Links (D-207): a hovered card shows a `›` just right of it; dragged onto another card it draws a link there,
// selected with its label ready to type.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
import { factsOf, type Facts, type Proof } from './cardFacts'
import { createEdge, defaultKind } from '../../data/edges'
import { drawLinks, ghostOf, LinkChips, LinkLines } from './PlaneLinks'
import styles from './PlaneCards.module.css'

const DRAG_PX = 5
// How a card is drawn by how big it is on screen (D-111, D-153): everything while its small text (8 px) is 4 px or more;
// the title alone (24 px) while that's 5 px or more; then bars. Going back up takes 10 % more, so a view resting on a
// line doesn't flip them.
export type Detail = 'full' | 'compact' | 'far'
const FULL_AT = 4 / 8
const COMPACT_AT = 5 / 24
const HYSTERESIS = 1.1
const RANK: Record<Detail, number> = { far: 0, compact: 1, full: 2 }
function detailAt(scale: number, was: Detail): Detail {
  const up = (at: number, d: Detail) => (RANK[was] < RANK[d] ? at * HYSTERESIS : at)
  if (scale >= up(FULL_AT, 'full')) return 'full'
  if (scale >= up(COMPACT_AT, 'compact')) return 'compact'
  return 'far'
}
// Evidence cells, up to this many each way (D-152).
const MOST = 5
// The full title: up to 80 characters, three lines (two with tags under it).
const TITLE_SHOWN = 80
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
  const { wid, evidence, competitorFeatures, edges } = useWs()
  const facts = useMemo(() => factsOf(cards, { evidence, competitorFeatures, edges }), [cards, evidence, competitorFeatures, edges])
  // Links follow cards being dragged, and carried by a section.
  const cardsLive = useCanvasView((s) => (live ? s.cardsLive : NO_LIVE))
  const shift = useCanvasView((s) => (live ? s.dragShift : null))
  const links = useMemo(
    () => drawLinks(cards, edges, (c) => cardsLive[c.id] ?? (shift?.ids.includes(c.id) ? [c.x + shift.dx, c.y + shift.dy] : [c.x, c.y])),
    [cards, edges, cardsLive, shift],
  )
  const linking = useCanvasView((s) => (live ? s.linking : null))
  const ghost = linking && !linking.over ? ghostOf(cards, linking) : null
  // On the canvas the plane's picture is scaled again by the canvas's zoom.
  const canvasZoom = useCanvasView((s) => s.cams[wid]?.zoom ?? 1)
  const was = useRef<Detail>('full')
  const detail = detailAt(view.zoom * (live ? 1 : canvasZoom), was.current)
  was.current = detail
  const carry = cards.map((c) => ({ id: c.id, ref: cardRef(wid, c.type, c.id), x: c.x, y: c.y, w: CARD.w, h: CARD.h }))
  // The cards there when this opened are just there in focus (the plane's own picture was already showing them); on the
  // canvas they build up with the page. Any card after that builds up as it arrives.
  const [first] = useState(() => new Set(cards.map((c) => c.id)))
  return (
    <div className={styles.layer} data-live={live || undefined}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }}>
        <TextItems labels={labels} layer="frames" live={live} editor={editor} zoom={view.zoom} carry={carry} />
        <LinkLines links={links} live={live} zoom={view.zoom} ghost={ghost} />
        {cards.map((c) => (
          <CardBox key={c.id} card={c} facts={facts.get(c.id)} detail={detail} zoom={view.zoom} live={live} editor={editor} arrive={!(live && first.has(c.id))} />
        ))}
        <LinkChips links={links} live={live} editor={editor} zoom={view.zoom} />
        <TextItems labels={labels} layer="text" live={live} editor={editor} zoom={view.zoom} carry={carry} />
      </div>
    </div>
  )
}

const NO_LIVE: Record<string, [number, number]> = {}

type Drag = { free: [number, number]; at: [number, number] }

type BoxProps = { card: Card; facts?: Facts; detail: Detail; zoom: number; live: boolean; editor: boolean; arrive: boolean }

function CardBox({ card, facts, detail, zoom, live, editor, arrive }: BoxProps) {
  const { wid, threads, cards, edges } = useWs()
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
  useEffect(() => {
    if (!held) return
    useCanvasView.setState((s) => ({ cardsLive: { ...s.cardsLive, [card.id]: held } }))
    return () =>
      useCanvasView.setState((s) => {
        const { [card.id]: _, ...rest } = s.cardsLive
        return { cardsLive: rest }
      })
  }, [held, card.id])
  const hovered = useCanvasView((s) => live && s.cardHovered === card.id)
  const target = useCanvasView((s) => live && s.linking?.over === card.id)
  const linkingFrom = useCanvasView((s) => live && s.linking?.from === card.id)

  const press = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live || e.button !== 0) return
    // The plane would pan.
    e.stopPropagation()
    useCanvasView.setState({ cardSelected: card.id, labelSelected: null, linkSelected: null })
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

  // The `›` (D-152, D-207): pressed and dragged onto another card, a link from this one to it.
  const startLink = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    const toPlane = (ev: { clientX: number; clientY: number }): [number, number] => [card.x + (ev.clientX - box.left) / zoom, card.y + (ev.clientY - box.top) / zoom]
    const overAt = (ev: { clientX: number; clientY: number }) => {
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-target^="card:"]')?.dataset.target?.slice(5)
      return hit && hit !== card.id ? hit : null
    }
    useCanvasView.setState({ linking: { from: card.id, to: toPlane(e), over: null }, linkSelected: null })
    const move = (ev: PointerEvent) => useCanvasView.setState({ linking: { from: card.id, to: toPlane(ev), over: overAt(ev) } })
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      const over = ev.type === 'pointerup' ? overAt(ev) : null
      useCanvasView.setState({ linking: null })
      const other = over && cards.find((c) => c.id === over)
      if (!other) return
      // One link between two cards from the handle: an existing one is selected instead.
      const was = edges.find((x) => (x.fromId === card.id && x.toId === other.id) || (x.fromId === other.id && x.toId === card.id))
      if (was) return useCanvasView.setState({ linkSelected: was.id, cardSelected: null, labelSelected: null })
      const id = createEdge(wid, card, other, defaultKind(card.type, other.type))
      useCanvasView.setState({ linkSelected: id, linkLabelling: true, cardSelected: null, labelSelected: null })
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
      data-link-target={target || undefined}
      data-target={`card:${card.id}`}
      onPointerDown={press}
      onPointerEnter={live ? () => useCanvasView.setState({ cardHovered: card.id }) : undefined}
      onPointerLeave={live ? () => useCanvasView.getState().cardHovered === card.id && useCanvasView.setState({ cardHovered: null }) : undefined}
      onDoubleClick={live && editor ? () => useCanvasView.setState({ cardEditing: card.id, cardSelected: card.id }) : undefined}
    >
      <div ref={face} className={styles.card} style={carried} data-detail={typing ? 'full' : detail}>
        {typing ? (
          <>
            <span className={styles.head}>
              <span className={styles.kind}>{card.type}</span>
            </span>
            <TitleField card={card} />
          </>
        ) : detail === 'full' ? (
          <FullCard card={card} facts={facts} />
        ) : (
          <CompactTitle text={card.title || PLACEHOLDER[card.type]} empty={!card.title} bars={detail === 'far'} />
        )}
      </div>
      <i className={styles.mark} data-corner="nw" aria-hidden />
      <i className={styles.mark} data-corner="ne" aria-hidden />
      <i className={styles.mark} data-corner="se" aria-hidden />
      <i className={styles.mark} data-corner="sw" aria-hidden />
      {live && editor && !drag && !typing && (hovered || linkingFrom) && (
        <span className={styles.handle} data-linking={linkingFrom || undefined} onPointerDown={startLink} aria-label="Drag to another card to link">
          <span aria-hidden>›</span>
        </span>
      )}
      {live && <PeerRing id={card.id} space={card.pieceId} />}
      {live && <ThreadChip wid={wid} thread={threadOn(threads, card.id)} zoom={zoom} />}
    </div>
  )
}

function FullCard({ card, facts }: { card: Card; facts?: Facts }) {
  const tags = card.tags ?? []
  const title = card.title.length > TITLE_SHOWN ? `${card.title.slice(0, TITLE_SHOWN - 1).trimEnd()}…` : card.title
  const head = facts?.head && facts.head.length > 24 ? `${facts.head.slice(0, 23)}…` : facts?.head
  return (
    <>
      <span className={styles.head}>
        <span className={styles.kind}>{card.type}</span>
        {head && (
          <span className={styles.status} data-clash={facts?.clash || undefined}>
            {head}
          </span>
        )}
        {facts?.proof && <ProofCells proof={facts.proof} />}
      </span>
      <p className={styles.title} data-empty={!card.title || undefined} data-lines={tags.length ? 2 : 3}>
        {title || PLACEHOLDER[card.type]}
      </p>
      {facts?.meta && <span className={styles.facts}>{facts.meta}</span>}
      {tags.length > 0 && <TagChips tags={tags} />}
    </>
  )
}

// Evidence as cells: filled for each piece that supports it, outlined for each against; magenta when the evidence and
// the status disagree.
function ProofCells({ proof }: { proof: Proof }) {
  const cells = [...Array<boolean>(Math.min(MOST, proof.supports)).fill(true), ...Array<boolean>(Math.min(MOST, proof.contradicts)).fill(false)]
  return (
    <span className={styles.proof} data-clash={proof.clash || undefined} aria-label={`${proof.supports} for, ${proof.contradicts} against`}>
      {cells.map((filled, i) => (
        <i key={i} data-filled={filled || undefined} />
      ))}
    </span>
  )
}

// Tags as framed chips in a row; what doesn't fit becomes `+N`. Mono is 0.6 em a character.
const CHIP_TEXT = 7.5
const CHIP_PAD = 4
const CHIP_GAP = 5
const CHIP_ROOM = CARD.w - 2 * 7 - 4
const chipWidth = (text: string) => text.length * CHIP_TEXT * 0.6 + CHIP_PAD * 2
function TagChips({ tags }: { tags: string[] }) {
  const shown: string[] = []
  let x = 0
  for (let i = 0; i < tags.length; i++) {
    const text = `#${tags[i]}`
    // Room for the `+N` chip unless this is the last tag.
    const need = chipWidth(text) + (i < tags.length - 1 ? CHIP_GAP + chipWidth(`+${tags.length - i - 1}`) : 0)
    if (x + need > CHIP_ROOM) {
      shown.push(`+${tags.length - i}`)
      break
    }
    shown.push(text)
    x += chipWidth(text) + CHIP_GAP
  }
  return (
    <span className={styles.tags}>
      {shown.map((t) => (
        <span key={t} className={styles.chip}>
          {t}
        </span>
      ))}
    </span>
  )
}

// Zoomed out (D-153): the title alone at one size, at most three lines, ending at the last whole word that fits with
// `…`; far out, each line a bar as long as the line.
function CompactTitle({ text, empty, bars }: { text: string; empty: boolean; bars: boolean }) {
  const el = useRef<HTMLParagraphElement>(null)
  const [cut, setCut] = useState<{ of: string; text: string } | null>(null)
  useLayoutEffect(() => {
    const p = el.current
    if (!p) return
    const fits = () => p.scrollHeight <= p.clientHeight + 1
    const words = text.split(/\s+/)
    const span = p.firstElementChild as HTMLElement
    span.textContent = text
    if (fits()) return setCut(null)
    // The most whole words that fit with the `…`; a single long word is cut short instead.
    let lo = 0
    let hi = words.length - 1
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      span.textContent = `${words.slice(0, mid).join(' ')}…`
      if (fits()) lo = mid
      else hi = mid - 1
    }
    let shown = lo > 0 ? `${words.slice(0, lo).join(' ')}…` : text
    if (lo === 0)
      for (let n = text.length - 1; n > 0; n--) {
        span.textContent = `${text.slice(0, n)}…`
        if (fits()) {
          shown = span.textContent
          break
        }
      }
    span.textContent = shown
    setCut({ of: text, text: shown })
  }, [text])
  return (
    <p ref={el} className={styles.compact} data-empty={empty || undefined} data-bars={bars || undefined}>
      <span>{cut?.of === text ? cut.text : text}</span>
    </p>
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
