// A plane's cards (D-187), drawn in the plane's own px through a view (where its (0, 0) is and its zoom). On the canvas
// they're a picture, fitted in the plane, and the pointer passes through to the canvas (D-186); in focus they're live:
// a click selects (the cards' corner marks, D-150), a drag moves (5 px first, snapped to the grid, alt = free, held where
// dropped until the data's back). Its title is typed in its panel (D-221), never on the card.
// As on the old board (D-150): a card added while you look builds up cell by cell; pressed, its corner marks close in
// on its corners in its colour; dragged, it goes 0.8 round the point held and follows the pointer, its marks on where
// it lands at full size, and grows into them when let go.
// Inside (D-152, D-205): the type and, right of it, a status, regions or priority with the evidence as cells; the title;
// the facts line; tags as chips. Smaller on screen (D-153): the title alone, bigger, in whole words; far out its lines
// as bars. Links (D-207): a hovered card shows a `›` just right of it; dragged onto another card it draws a link there,
// selected with its label ready to type. Inside (D-225): a competitor grows on hover to hold its features as small
// cards by category (a strip at its foot says how many while it's closed); a feature with parts folds them into itself
// (`[−] 3 parts`), their cards shrinking into its rows, and grows back out on `[+]`.
// The selected card's right panel (D-219, D-221) opens at the right of the plane's part of the screen.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { CARD, cardRef, copyCards, deleteCards, moveCard, moveCards, updateCard, type Card, type CardType } from '../../data/cards'
import { clipboard, selectedIds, setSelection, toggleSelected } from './selection'
import type { CompetitorFeature } from '../../data/competitorFeatures'
import { byCategory, foldedHeight, foldsOf, openHeight, partRowBox, type Box } from './cardInside'
import type { Label } from '../../data/labels'
import { TextItems } from './TextItems'
import { PeerRing } from './collab'
import { ThreadChip, threadOn } from './Threads'
import { CardPanel } from './CardPanel'
import { GRID, snap } from '../../data/grid'
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
  const { wid, evidence, competitorFeatures, comparisons, edges } = useWs()
  const facts = useMemo(() => factsOf(cards, { evidence, competitorFeatures, edges }), [cards, evidence, competitorFeatures, edges])
  // Links follow cards being dragged, and carried by a section.
  const cardsLive = useCanvasView((s) => (live ? s.cardsLive : NO_LIVE))
  const shift = useCanvasView((s) => (live ? s.dragShift : null))
  const folds = useMemo(() => foldsOf(cards, edges), [cards, edges])
  const featuresOf = useMemo(() => {
    const m = new Map<string, CompetitorFeature[]>()
    for (const f of competitorFeatures) m.set(f.competitorId, [...(m.get(f.competitorId) ?? []), f])
    return m
  }, [competitorFeatures])
  const matched = useMemo(() => new Set(comparisons.filter((c) => c.competitorFeatureId).map((c) => c.competitorFeatureId!)), [comparisons])
  const hoverId = useCanvasView((s) => (live ? s.cardHovered : null))
  // A competitor is open while hovered and while it's selected (the user).
  const selId = useCanvasView((s) => (live ? s.cardSelected : null))
  const openIds = new Set([hoverId, selId].filter((x): x is string => !!x))
  const linking = useCanvasView((s) => (live ? s.linking : null))
  const ghost = linking && !linking.over ? ghostOf(cards, linking) : null
  // On the canvas the plane's picture is scaled again by the canvas's zoom.
  const canvasZoom = useCanvasView((s) => s.cams[wid]?.zoom ?? 1)
  const was = useRef<Detail>('full')
  const detail = detailAt(view.zoom * (live ? 1 : canvasZoom), was.current)
  was.current = detail
  // Where each card is drawn, and how tall: a folded feature holds its parts, a hovered competitor its features (only
  // while cards show everything); a folded part is its row in the feature that holds it.
  const at = (c: Card): [number, number] => cardsLive[c.id] ?? (shift?.ids.includes(c.id) ? [c.x + shift.dx, c.y + shift.dy] : [c.x, c.y])
  const heightOf = (c: Card) => {
    if (detail !== 'full') return CARD.h
    const rows = folds.rows.get(c.id)
    if (rows) return foldedHeight(rows.length)
    const list = c.type === 'competitor' && openIds.has(c.id) ? featuresOf.get(c.id) : undefined
    return list?.length ? openHeight(byCategory(list)) : CARD.h
  }
  const boxOf = (c: Card): Box => {
    const holder = folds.hidden.get(c.id)
    const parent = holder ? cards.find((k) => k.id === holder) : undefined
    if (parent) {
      const [px, py] = at(parent)
      const rows = folds.rows.get(parent.id)!
      const i = rows.findIndex((r) => r.card.id === c.id)
      return detail === 'full' ? partRowBox({ x: px, y: py, w: CARD.w, h: heightOf(parent) }, i, rows[i].depth) : { x: px, y: py, w: CARD.w, h: CARD.h }
    }
    const [x, y] = at(c)
    return { x, y, w: CARD.w, h: heightOf(c) }
  }
  // `part of` lines inside a fold are left out.
  const links = drawLinks(cards, edges, boxOf, (e) => e.kind === 'part-of' && folds.hidden.has(e.fromId))
  const carry = cards.map((c) => ({ id: c.id, ref: cardRef(wid, c.type, c.id), x: c.x, y: c.y, w: CARD.w, h: CARD.h }))
  // The cards there when this opened are just there in focus (the plane's own picture was already showing them); on the
  // canvas they build up with the page. Any card after that builds up as it arrives.
  const [first] = useState(() => new Set(cards.map((c) => c.id)))
  // A selection's drag: the cards in it (and the parts folded into them) follow the one held; dropped, they all move in
  // one undo step and land where they were let go.
  const groupMove = (held: string, d: [number, number], done: boolean) => {
    const ids = useCanvasView.getState().cardMulti
    const all = new Set(ids)
    for (const id of ids) for (const r of folds.rows.get(id) ?? []) all.add(r.card.id)
    if (!done) return void useCanvasView.setState({ dragShift: { ids: [...all].filter((x) => x !== held), dx: d[0], dy: d[1], shrink: true } })
    if (!d[0] && !d[1]) return void useCanvasView.setState({ dragShift: null })
    // The others stay where they were carried until the data's back.
    useCanvasView.setState({ dragShift: { ids: [...all].filter((x) => x !== held), dx: d[0], dy: d[1] } })
    const list = cards.filter((c) => all.has(c.id))
    return moveCards(wid, list.map((c) => ({ card: c, to: [c.x + d[0], c.y + d[1]] as [number, number] }))).finally(() => useCanvasView.setState({ dragShift: null }))
  }
  usePlaneKeys(live, editor, cards, edges, folds.rows)
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  // Alt+drag on the plane draws a box: the cards it touches are selected (with shift, added).
  const boxSelect = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live || !e.altKey || e.button !== 0) return
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const toPlane = (ev: { clientX: number; clientY: number }) => [(ev.clientX - r.left - view.ox) / view.zoom, (ev.clientY - r.top - view.oy) / view.zoom] as const
    const [x0, y0] = toPlane(e)
    const keep = e.shiftKey ? selectedIds() : []
    let last = { x0, y0, x1: x0, y1: y0 }
    setBox(last)
    const move = (ev: PointerEvent) => {
      const [x1, y1] = toPlane(ev)
      last = { x0, y0, x1, y1 }
      setBox(last)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setBox(null)
      const [l, t, rr, b] = [Math.min(last.x0, last.x1), Math.min(last.y0, last.y1), Math.max(last.x0, last.x1), Math.max(last.y0, last.y1)]
      if (rr - l < 3 && b - t < 3) return
      const hit = cards.filter((c) => {
        if (folds.hidden.has(c.id)) return false
        const q = boxOf(c)
        return q.x < rr && q.x + q.w > l && q.y < b && q.y + q.h > t
      })
      setSelection([...new Set([...keep, ...hit.map((c) => c.id)])])
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  return (
    <div className={styles.layer} data-live={live || undefined} onPointerDown={boxSelect}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }}>
        <TextItems labels={labels} layer="frames" live={live} editor={editor} zoom={view.zoom} carry={carry} />
        <LinkLines links={links} live={live} zoom={view.zoom} ghost={ghost} />
        {cards.map((c) => (
          <CardBox
            key={c.id}
            card={c}
            facts={facts.get(c.id)}
            detail={detail}
            zoom={view.zoom}
            live={live}
            editor={editor}
            arrive={!(live && first.has(c.id))}
            h={heightOf(c)}
            tuck={folds.hidden.has(c.id) ? boxOf(c) : null}
            parts={folds.count.get(c.id) ?? 0}
            rows={folds.rows.get(c.id)}
            carries={folds.rows.get(c.id)?.map((r) => r.card) ?? []}
            features={c.type === 'competitor' ? featuresOf.get(c.id) : undefined}
            matched={matched}
            open={c.type === 'competitor' && openIds.has(c.id) && detail === 'full'}
            onGroup={live && editor ? (d, done) => groupMove(c.id, d, done) : undefined}
          />
        ))}
        <LinkChips links={links} live={live} editor={editor} zoom={view.zoom} />
        {box && (
          <div
            className={styles.selectBox}
            style={{ left: Math.min(box.x0, box.x1), top: Math.min(box.y0, box.y1), width: Math.abs(box.x1 - box.x0), height: Math.abs(box.y1 - box.y0) }}
          />
        )}
        <TextItems labels={labels} layer="text" live={live} editor={editor} zoom={view.zoom} carry={carry} />
      </div>
      {live && <CardPanel cards={cards} editor={editor} />}
    </div>
  )
}

const NO_LIVE: Record<string, [number, number]> = {}

// Keys for the selection on a focused plane (D-227), heard before the canvas's own (capture): Escape lets go of
// several, Delete takes them all away, the arrows nudge a grid step (shift: four), ⌘C / ⌘V / ⌘D copy, paste and
// duplicate within this tab (pasted a step further each time, with the links between them, selected).
function usePlaneKeys(live: boolean, editor: boolean, cards: Card[], edges: import('../../data/edges').Edge[], rows: Map<string, { card: Card; depth: number }[]>) {
  const { wid } = useWs()
  const now = useRef({ cards, edges, rows, editor })
  now.current = { cards, edges, rows, editor }
  useEffect(() => {
    if (!live) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, [contenteditable], [role=dialog], [role=menu], [role=listbox]')) return
      const { cards, edges, rows, editor } = now.current
      const { cardMulti } = useCanvasView.getState()
      const ids = selectedIds()
      const picked = cards.filter((c) => ids.includes(c.id))
      const stop = () => (e.preventDefault(), e.stopImmediatePropagation())
      const mod = e.metaKey || e.ctrlKey
      if (e.key === 'Escape' && cardMulti.length) return (stop(), setSelection([]))
      if ((e.key === 'Delete' || e.key === 'Backspace') && cardMulti.length && editor) {
        stop()
        setSelection([])
        return void deleteCards(wid, picked, edges)
      }
      const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key] as [number, number] | undefined
      if (step && picked.length && editor && !mod) {
        stop()
        const by = (e.shiftKey ? 4 : 1) * GRID
        const moving = [...picked, ...picked.flatMap((c) => (rows.get(c.id) ?? []).map((r) => r.card))]
        return void moveCards(wid, moving.map((c) => ({ card: c, to: [c.x + step[0] * by, c.y + step[1] * by] as [number, number] })))
      }
      if (!mod || !picked.length) {
        if (mod && e.key.toLowerCase() === 'v' && clipboard.cards.length && editor) {
          stop()
          clipboard.pasted++
          const pieceId = cards[0]?.pieceId ?? useCanvasView.getState().cardMulti[0]
          const plane = new URLSearchParams(location.search).get('focus') ?? pieceId
          if (plane) setSelection(copyCards(wid, plane, clipboard.cards, clipboard.edges, [clipboard.pasted * 2 * GRID, clipboard.pasted * 2 * GRID]))
        }
        return
      }
      const key = e.key.toLowerCase()
      if (key === 'c') {
        stop()
        clipboard.cards = picked
        clipboard.edges = edges
        clipboard.pasted = 0
      }
      if (key === 'd' && editor) {
        stop()
        setSelection(copyCards(wid, picked[0].pieceId, picked, edges, [2 * GRID, 2 * GRID]))
      }
      if (key === 'v' && clipboard.cards.length && editor) {
        stop()
        clipboard.pasted++
        setSelection(copyCards(wid, picked[0].pieceId, clipboard.cards, clipboard.edges, [clipboard.pasted * 2 * GRID, clipboard.pasted * 2 * GRID]))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [live, wid])
}

type Drag = { free: [number, number]; at: [number, number] }

type BoxProps = {
  card: Card
  facts?: Facts
  detail: Detail
  zoom: number
  live: boolean
  editor: boolean
  arrive: boolean
  // Its height (it grows to hold what's inside it), and for a folded part the row it's tucked into.
  h: number
  tuck: Box | null
  // A feature's parts (all the way down); its folded rows; the parts a folded one carries when dragged.
  parts: number
  rows?: { card: Card; depth: number }[]
  carries: Card[]
  // A competitor's features, which of them match ours, and whether it's open (hovered).
  features?: CompetitorFeature[]
  matched: Set<string>
  open: boolean
  // A selection's drag (D-227): the others follow by `d` while it lasts; `done` writes it (one undo step).
  onGroup?: (d: [number, number], done: boolean) => Promise<unknown> | void
}

function CardBox({ card, facts, detail, zoom, live, editor, arrive, h, tuck, parts, rows, carries, features, matched, open, onGroup }: BoxProps) {
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
  const selected = useCanvasView((s) => live && (s.cardSelected === card.id || s.cardMulti.includes(card.id)))
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
    // Shift: in or out of the selection, no drag (D-227).
    if (e.shiftKey) return toggleSelected(card.id)
    // Pressed inside a selection, the whole of it moves; otherwise this card alone is picked.
    const group = useCanvasView.getState().cardMulti.includes(card.id)
    if (!group) setSelection([card.id])
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
      if (group) onGroup?.([to[0] - card.x, to[1] - card.y], false)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setPressed(false)
      setDrag(null)
      const [dx, dy] = to ? [to[0] - card.x, to[1] - card.y] : [0, 0]
      if (group) {
        if (to && (dx || dy)) void onGroup?.([dx, dy], true)?.finally(() => setHeld(null))
        else (onGroup?.([0, 0], true), setHeld(null))
        return
      }
      // A folded feature carries its parts (D-164).
      if (to && (dx || dy))
        void (carries.length ? moveCards(wid, [{ card, to }, ...carries.map((c) => ({ card: c, to: [c.x + dx, c.y + dy] as [number, number] }))]) : moveCard(wid, card, to)).catch(() => setHeld(null))
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
  const carried = drag
    ? { translate: `${drag.free[0] - x}px ${drag.free[1] - y}px`, scale: `${CARRIED}`, transformOrigin: `${drag.at[0]}px ${drag.at[1]}px` }
    : shift?.shrink
      ? { scale: `${CARRIED}`, transformOrigin: '50% 50%' }
      : undefined
  // A folded part shrinks into its row in the feature that holds it, and grows back out of it.
  const tucked = tuck ? { transform: `translate(${tuck.x - x}px, ${tuck.y - y}px) scale(${tuck.w / CARD.w}, ${tuck.h / CARD.h})` } : undefined

  return (
    <div
      className={styles.box}
      style={{ left: x, top: y, width: CARD.w, height: h, ['--type' as string]: TYPE_ACCENT[card.type], ...tucked }}
      data-tucked={tuck ? true : undefined}
      data-open={open && !drag ? true : undefined}
      aria-hidden={tuck ? true : undefined}
      data-selected={selected || undefined}
      data-pressed={pressed || !!drag || undefined}
      data-dragging={drag ? true : undefined}
      data-link-target={target || undefined}
      data-target={`card:${card.id}`}
      onPointerDown={press}
      onPointerEnter={live ? () => useCanvasView.setState({ cardHovered: card.id }) : undefined}
      onPointerLeave={live ? () => useCanvasView.getState().cardHovered === card.id && useCanvasView.setState({ cardHovered: null }) : undefined}
    >
      <div ref={face} className={styles.card} style={carried} data-detail={detail}>
        {detail === 'full' ? (
          <FullCard
            card={card}
            facts={facts}
            editor={live && editor}
            parts={parts}
            rows={rows}
            features={features}
            matched={matched}
            open={open && !drag}
          />
        ) : (
          <CompactTitle text={card.title || PLACEHOLDER[card.type]} empty={!card.title} bars={detail === 'far'} />
        )}
      </div>
      <i className={styles.mark} data-corner="nw" aria-hidden />
      <i className={styles.mark} data-corner="ne" aria-hidden />
      <i className={styles.mark} data-corner="se" aria-hidden />
      <i className={styles.mark} data-corner="sw" aria-hidden />
      {live && editor && !drag && (hovered || linkingFrom) && (
        <span className={styles.handle} data-linking={linkingFrom || undefined} onPointerDown={startLink} aria-label="Drag to another card to link">
          <span aria-hidden>›</span>
        </span>
      )}
      {live && <PeerRing id={card.id} space={card.pieceId} />}
      {live && <ThreadChip wid={wid} thread={threadOn(threads, card.id)} zoom={zoom} />}
    </div>
  )
}

type FullProps = { card: Card; facts?: Facts; editor: boolean; parts: number; rows?: { card: Card; depth: number }[]; features?: CompetitorFeature[]; matched: Set<string>; open: boolean }

function FullCard({ card, facts, editor, parts, rows, features, matched, open }: FullProps) {
  const { wid } = useWs()
  const tags = card.tags ?? []
  const inside = !!rows || open
  const groups = open && features?.length ? byCategory(features) : null
  const ours = features?.filter((f) => matched.has(f.id)).length ?? 0
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
      <p className={styles.title} data-empty={!card.title || undefined} data-lines={inside || tags.length ? 2 : 3} data-inside={inside || undefined}>
        {title || PLACEHOLDER[card.type]}
      </p>
      {groups && (
        <div className={styles.inner}>
          {groups.map((g) => (
            <div key={g.cat || '-'}>
              {g.cat && (
                <p className={styles.innerCat}>
                  {g.cat} <span>{g.items.length}</span>
                </p>
              )}
              {g.items.map((f) => (
                <button
                  key={f.id}
                  className={styles.mini}
                  data-match={matched.has(f.id) || undefined}
                  onClick={() => useCanvasView.setState({ cardSelected: card.id, cfOpen: f.id, labelSelected: null, linkSelected: null })}
                >
                  <span className={styles.miniName}>{f.name}</span>
                  <span className={styles.miniAv}>{f.availability}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {rows && (
        <div className={styles.inner}>
          {rows.map((r, i) => {
            const last = i === rows.length - 1 || rows[i + 1].depth < r.depth || (rows.slice(i + 1).find((x) => x.depth <= r.depth)?.depth ?? -1) < r.depth
            return (
              <button
                key={r.card.id}
                className={styles.partRow}
                style={{ paddingLeft: r.depth * 12 }}
                onClick={() => useCanvasView.setState({ cardSelected: r.card.id, labelSelected: null, linkSelected: null })}
              >
                <span className={styles.partTree}>{last ? '└' : '├'}</span>
                <span className={styles.miniName}>{r.card.title || PLACEHOLDER[r.card.type]}</span>
                <span className={styles.miniAv}>{r.card.status ?? r.card.validation}</span>
              </button>
            )
          })}
        </div>
      )}
      {!open && features && features.length > 0 && (
        <span className={styles.strip} aria-label={`${features.length} features, ${ours} match ours`}>
          <span className={styles.cells}>
            {byCategory(features)
              .flatMap((g) => g.items)
              .slice(0, 12)
              .map((f) => (
                <i key={f.id} data-match={matched.has(f.id) || undefined} />
              ))}
          </span>
          {features.length} features{ours ? ` · ${ours} ≈ ours` : ''}
        </span>
      )}
      <span className={styles.foot}>
        {facts?.meta && <span className={styles.facts}>{facts.meta}</span>}
        {parts > 0 && (
          <button
            className={styles.fold}
            disabled={!editor}
            title={card.folded ? 'Unfold its parts onto the plane' : 'Fold its parts into it'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => void updateCard(wid, card, { folded: card.folded ? undefined : true }, card.folded ? 'unfold' : 'fold')}
          >
            [{card.folded ? '+' : '−'}] {parts} part{parts === 1 ? '' : 's'}
          </button>
        )}
      </span>
      {tags.length > 0 && !inside && <TagChips tags={tags} />}
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
