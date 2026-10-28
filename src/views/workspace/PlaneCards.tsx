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
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { CARD, copyCards, foldCard, foldPackage, moveCard, moveCards, spotRef, type AnyType, type Card } from '../../data/cards'
import { planeOf } from '../../data/places'
import { clipboard, deleteHere, heldAt, landed, onPlane, othersThan, selectedIds, setSelection, startGroupDrag, toggleSelected } from './selection'
import { clearGuides, guide, showGuides, toggleGuides, toggleSnap, useGuides } from './guides'
import { groupOf, keep, useFilter } from './planeFilter'
import { useSearchParams } from 'react-router-dom'
import { useHistory } from '../../data/history'
import { labelRef, moveMany } from '../../data/labels'
import type { CompetitorFeature } from '../../data/competitorFeatures'
import { byCategory, foldedHeight, foldsOf, INDENT, openHeight, packageBox, partRowBox, type Box } from './cardInside'
import type { Label } from '../../data/labels'
import { labelBox, TextItems } from './TextItems'
import { usePeersOn } from './collab'
import { BoxSelect, Landing, Marks, useSettledZoom } from '../../ui/Marks'
import { ThreadChip, threadOn } from './Threads'
import { PackPick } from './PackPick'
import { CardPanel } from './CardPanel'
import { GRID, snap } from '../../data/grid'
import { useRevealed } from '../../state/curtain'
import { isReducedMotion } from '../../state/motion'
import { runCells } from '../../ui/Appear'
import type { PlaneCam } from '../../state/canvasView'
import { useCanvasView } from '../../state/canvasView'
import { useWs, useWsNow } from './context'
import { useStill } from './still'
import { factsOf, useTaskTally, type Facts, type Proof } from './cardFacts'
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
export const TYPE_ACCENT: Record<AnyType, string> = {
  package: 'var(--accent-blue)',
  customer: 'var(--accent-green)',
  problem: 'var(--accent-magenta)',
  competitor: 'var(--accent-yellow)',
  idea: 'var(--fg)',
  feature: 'var(--accent-cyan)',
}

const PLACEHOLDER: Record<AnyType, string> = {
  package: 'What does this piece deliver?',
  customer: 'Who are they?',
  problem: 'What hurts?',
  competitor: 'Who else does it?',
  idea: "What's the thought?",
  feature: 'What does it do?',
}

type Props = { cards: Card[]; labels: Label[]; view: PlaneCam; live: boolean; editor: boolean }

// A plane's contents: its sections under its cards, its text over them (D-188). Its view moves only the world's
// transform: what's in it is drawn again when the zoom changes, never as the view pans.
export function PlaneCards({ cards, labels, view, live, editor }: Props) {
  const { wid } = useWs()
  // On the canvas the plane's picture is scaled again by the canvas's zoom.
  // Read as the level itself, so a wheel zoom re-renders the cards only when the level changes.
  const was = useRef<Detail>('full')
  // Drawn still in the finder's preview (D-236), its detail is read as in focus.
  const still = useStill()
  const settled = useSettledZoom(view.zoom, live)
  const detail = useCanvasView((s) => detailAt(view.zoom * (live || still ? 1 : (s.cams[wid]?.zoom ?? 1)), was.current))
  was.current = detail
  const [params] = useSearchParams()
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  // Alt+drag on the plane draws a box: the cards and text it touches are selected (with shift, added).
  // Picking a package's cards (D-240): a drag on the plane draws the box without alt, adding to what's picked.
  const packing = useCanvasView((s) => live && !!s.packing && s.packing === params.get('focus'))
  const boxSelect = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live || !(e.altKey || packing) || e.button !== 0) return
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const toPlane = (ev: { clientX: number; clientY: number }) => [(ev.clientX - r.left - view.ox) / view.zoom, (ev.clientY - r.top - view.oy) / view.zoom] as const
    const [x0, y0] = toPlane(e)
    const keep = e.shiftKey || packing ? selectedIds() : []
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
      setSelection([...new Set([...keep, ...onPlane.hit({ l, t, r: rr, b }, packing)])])
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  return (
    <div className={styles.layer} data-live={live || undefined} data-packing={packing || undefined} onPointerDown={boxSelect}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }}>
        <Inside cards={cards} labels={labels} zoom={settled} detail={detail} live={live} editor={editor} still={still} box={box} />
      </div>
      {live && !packing && <Panel cards={cards} labels={labels} editor={editor} />}
      {packing && <PackPick cards={cards} />}
    </div>
  )
}

type InsideProps = { cards: Card[]; labels: Label[]; zoom: number; detail: Detail; live: boolean; editor: boolean; still: boolean; box: { x0: number; y0: number; x1: number; y1: number } | null }

const Inside = memo(PlaneInside)
const Panel = memo(CardPanel)

function PlaneInside({ cards, labels, zoom, detail, live, editor, still, box }: InsideProps) {
  const { wid, evidence, competitorFeatures, comparisons, edges, places } = useWs()
  const tally = useTaskTally()
  // How many planes each card is on (D-281): its home and its places.
  const spread = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of places) m.set(p.cardId, (m.get(p.cardId) ?? 1) + 1)
    return m
  }, [places])
  const facts = useMemo(() => factsOf(cards, { evidence, competitorFeatures, edges }, tally, spread), [cards, evidence, competitorFeatures, edges, tally, spread])
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
  // Where each card is drawn, and how tall: a folded feature holds its parts, a hovered competitor its features (only
  // while cards show everything); a folded part is its row in the feature that holds it.
  const landing = useCanvasView((s) => (live ? s.landing : NO_LIVE))
  const at = (c: Card): [number, number] => cardsLive[c.id] ?? landing[c.id] ?? (shift?.ids.includes(c.id) ? [c.x + shift.dx, c.y + shift.dy] : [c.x, c.y])
  const heightOf = (c: Card) => {
    if (detail !== 'full') return CARD.h
    const rows = folds.rows.get(c.id)
    if (rows) return foldedHeight(rows.length)
    const list = c.type === 'competitor' && openIds.has(c.id) ? featuresOf.get(c.id) : undefined
    return list?.length ? openHeight(byCategory(list)) : CARD.h
  }
  const boxOf = (c: Card, depth = 0): Box => {
    const holder = folds.hidden.get(c.id)
    const parent = holder ? cards.find((k) => k.id === holder) : undefined
    if (parent && depth < 8) {
      // Inside something itself folded away (a part of a feature in a package): where that is.
      if (folds.hidden.has(parent.id)) return boxOf(parent, depth + 1)
      const [px, py] = at(parent)
      const rows = folds.rows.get(parent.id)!
      const i = rows.findIndex((r) => r.card.id === c.id)
      return detail === 'full' ? partRowBox({ x: px, y: py, w: CARD.w, h: heightOf(parent) }, i, rows[i].depth) : { x: px, y: py, w: CARD.w, h: CARD.h }
    }
    // An unfolded package (D-239): its band and the frame round its members.
    if (c.type === 'package' && !c.folded && depth < 8) {
      const framed = packageBox((folds.members.get(c.id) ?? []).filter((m) => !folds.hidden.has(m.id) && kept.has(m.id)).map((m) => boxOf(m, depth + 1)))
      if (framed) return framed
    }
    const [x, y] = at(c)
    return { x, y, w: CARD.w, h: heightOf(c) }
  }
  // `part of` lines inside a fold are left out.
  // The plane's filter (D-233), in focus: the cards it keeps, the kinds of link it hides (still shown on the card
  // pointed at or selected, and the selected link).
  // The canvas's picture of the plane shows it as its filter says too.
  const [params] = useSearchParams()
  const filter = useFilter(live ? params.get('focus') : ((cards[0] && planeOf(cards[0])) ?? labels[0]?.pieceId ?? null))
  const kept = useMemo(() => keep(cards, edges, filter), [cards, edges, filter])
  const shown = cards.filter((c) => kept.has(c.id))
  const lit = useCanvasView((s) => (live ? [s.cardHovered, s.cardSelected, ...s.cardMulti, s.linking?.from].filter(Boolean).join(' ') : ''))
  const linkSel = useCanvasView((s) => (live ? s.linkSelected : null))
  // What a card is folded into, all the way out (itself when it isn't).
  const outer = (id: string) => {
    let at = id
    for (let i = 0; i < 12 && folds.hidden.has(at); i++) at = folds.hidden.get(at)!
    return at
  }
  const links = drawLinks(
    shown,
    edges,
    boxOf,
    (e) =>
      // Both ends folded into the same thing (a feature's parts, a package's cards, D-240): inside it, not drawn.
      outer(e.fromId) === outer(e.toId) ||
      (filter.links.includes(groupOf(e.kind)) && e.id !== linkSel && !lit.includes(e.fromId) && !lit.includes(e.toId)),
  )
  // Cards inside an unfolded package's frame that aren't in it (D-242): drawn faint, so the frame says who's in.
  const outsiders = new Set<string>()
  for (const p of shown) {
    if (p.type !== 'package' || p.folded || folds.hidden.has(p.id)) continue
    const f = boxOf(p)
    const inside = new Set([p.id, ...(folds.members.get(p.id) ?? []).map((m) => m.id)])
    for (const c of shown) {
      if (inside.has(c.id) || folds.hidden.has(c.id) || (c.type === 'package' && !c.folded)) continue
      const b = boxOf(c)
      if (b.x < f.x + f.w && b.x + b.w > f.x && b.y < f.y + f.h && b.y + b.h > f.y) outsiders.add(c.id)
    }
  }
  const carry = cards.map((c) => ({ id: c.id, ref: spotRef(wid, c), x: c.x, y: c.y, w: CARD.w, h: CARD.h }))
  // The cards there when this opened are just there in focus (the plane's own picture was already showing them); on the
  // canvas they build up with the page. Any card after that builds up as it arrives.
  const [first] = useState(() => new Set(cards.map((c) => c.id)))
  // What a card carries when it moves: what's folded into it, all the way down (a package's members and their parts).
  const carriedBy = (id: string): Card[] => {
    const out: Card[] = []
    const walk = (i: string, depth: number) => {
      for (const r of folds.rows.get(i) ?? []) if (depth < 8) (out.push(r.card), walk(r.card.id, depth + 1))
    }
    walk(id, 0)
    return out
  }
  if (live) onPlane.carried = (ids) => ids.flatMap((id) => carriedBy(id).map((c) => c.id))
  // The selection (D-227, D-229) moves as one: what's on this plane, cards and text, and what a folded card carries.
  // Only the plane in focus says what's on it; the pictures on the canvas don't.
  if (live) onPlane.labels = new Set(labels.map((l) => l.id))
  if (live) onPlane.items = (ids) => {
    const all = new Set(ids)
    for (const id of ids) for (const r of folds.rows.get(id) ?? []) all.add(r.card.id)
    return [
      ...cards.filter((c) => all.has(c.id)).map((c) => ({ id: c.id, ref: spotRef(wid, c), x: c.x, y: c.y })),
      ...labels.filter((l) => all.has(l.id)).map((l) => ({ id: l.id, ref: labelRef(wid, l.id), x: l.x, y: l.y })),
    ]
  }
  if (live) onPlane.boxes = () => [
    ...shown.filter((c) => !folds.hidden.has(c.id)).map((c) => ({ id: c.id, box: boxOf(c) })),
    ...labels.map((l) => ({ id: l.id, box: labelBox(l) })),
  ]
  usePlaneKeys(live, editor, cards, labels, edges)
  // What a box drawn on the plane touches (PlaneCards' boxSelect): an unfolded package only when all of it is in the box
  // (its frame round the cards would take it every time); picking a package's cards, no text.
  if (live) onPlane.hit = ({ l, t, r: rr, b }, picking) => {
    const touches = (q: { x: number; y: number; w: number; h: number }) => q.x < rr && q.x + q.w > l && q.y < b && q.y + q.h > t
    const inside = (q: { x: number; y: number; w: number; h: number }) => q.x >= l && q.x + q.w <= rr && q.y >= t && q.y + q.h <= b
    return [
      ...shown.filter((c) => !folds.hidden.has(c.id) && (c.type === 'package' && !c.folded ? inside(boxOf(c)) : touches(boxOf(c)))).map((c) => c.id),
      ...(picking ? [] : labels.filter((x) => touches(labelBox(x))).map((x) => x.id)),
    ]
  }
  return (
    <>
      <TextItems labels={labels} layer="frames" live={live} editor={editor} zoom={zoom} carry={carry} />
      <LinkLines links={links} live={live} zoom={zoom} ghost={ghost} />
      {shown.map((c) => (
        <CardBox
          key={c.id}
          card={c}
          facts={facts.get(c.id)}
          detail={detail}
          zoom={zoom}
          live={live}
          editor={editor}
          // Not in the finder's preview (D-236): it's drawn as it'll be, already there.
          arrive={!still && !(live && first.has(c.id))}
          h={heightOf(c)}
          tuck={folds.hidden.has(c.id) ? boxOf(c) : null}
          dim={outsiders.has(c.id)}
          parts={folds.count.get(c.id) ?? 0}
          rows={folds.rows.get(c.id)}
          carries={carriedBy(c.id)}
          place={c.type === 'package' && !c.folded ? boxOf(c) : undefined}
          members={c.type === 'package' ? folds.members.get(c.id) : undefined}
          counts={c.type === 'package' ? folds.count : undefined}
          features={c.type === 'competitor' ? featuresOf.get(c.id) : undefined}
          matched={matched}
          open={c.type === 'competitor' && openIds.has(c.id) && detail === 'full'}
        />
      ))}
      <LinkChips links={links} live={live} editor={editor} zoom={zoom} />
      {box && (
        <BoxSelect x={Math.min(box.x0, box.x1)} y={Math.min(box.y0, box.y1)} w={Math.abs(box.x1 - box.x0)} h={Math.abs(box.y1 - box.y0)} zoom={zoom} />
      )}
      <TextItems labels={labels} layer="text" live={live} editor={editor} zoom={zoom} carry={carry} />
      {live && <GuideLines zoom={zoom} />}
    </>
  )
}

const NO_LIVE: Record<string, [number, number]> = {}

// The guides while something is dragged (D-231): thin magenta lines at the screen's 1 px, over everything.
function GuideLines({ zoom }: { zoom: number }) {
  const shown = useGuides((s) => s.shown)
  return (
    <>
      {shown.map((g, i) => (
        <i
          key={i}
          className={styles.guide}
          style={
            g.axis === 'x'
              ? { left: g.at - 0.5 / zoom, top: g.from, width: 1 / zoom, height: g.to - g.from }
              : { top: g.at - 0.5 / zoom, left: g.from, height: 1 / zoom, width: g.to - g.from }
          }
        />
      ))}
    </>
  )
}

// Keys for the selection on a focused plane (D-227, D-229), heard before the canvas's own (capture): Escape lets go of
// several, Delete takes them all away, the arrows nudge a grid step (shift: four), ⌘C / ⌘V / ⌘D copy, paste and
// duplicate within this tab (pasted a step further each time, with the links between the cards, selected).
function usePlaneKeys(live: boolean, editor: boolean, cards: Card[], labels: Label[], edges: import('../../data/edges').Edge[]) {
  const { wid, places, pieces } = useWs()
  const now = useRef({ cards, labels, edges, editor, places, pieces })
  now.current = { cards, labels, edges, editor, places, pieces }
  useEffect(() => {
    if (!live) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, [contenteditable], [role=dialog], [role=menu], [role=listbox]')) return
      const { cards, labels, edges, editor, places, pieces } = now.current
      const { cardMulti } = useCanvasView.getState()
      const ids = selectedIds()
      const picked = cards.filter((c) => ids.includes(c.id))
      const texts = labels.filter((l) => ids.includes(l.id))
      const stop = () => (e.preventDefault(), e.stopImmediatePropagation())
      const mod = e.metaKey || e.ctrlKey
      const plane = new URLSearchParams(location.search).get('focus')
      const paste = () => {
        if (!plane || (!clipboard.cards.length && !clipboard.labels.length)) return
        stop()
        clipboard.pasted++
        const by = clipboard.pasted * 2 * GRID
        setSelection(copyCards(wid, plane, clipboard.cards, clipboard.edges, [by, by], clipboard.labels))
      }
      if (e.key === 'Escape' && cardMulti.length) return (stop(), setSelection([]))
      // Snapping and guides, on and off (D-231).
      if (!mod && !e.altKey && (e.key === 'g' || e.key === 'a')) {
        stop()
        const on = e.key === 'g' ? toggleSnap() : toggleGuides()
        return useHistory.getState().say(`${e.key === 'g' ? 'snapping to the grid' : 'alignment guides'} ${on ? 'on' : 'off'}`)
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && cardMulti.length && editor) {
        stop()
        setSelection([])
        const plane = new URLSearchParams(location.search).get('focus')
        return plane ? deleteHere(wid, plane, picked, { edges, places, pieces }, texts) : undefined
      }
      const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key] as [number, number] | undefined
      if (step && ids.length && editor && !mod) {
        stop()
        const by = (e.shiftKey ? 4 : 1) * GRID
        const items = onPlane.items(ids)
        return void moveMany(
          `nudge ${items.length > 1 ? `${items.length} things` : 'it'}`,
          items.map((i) => ({ ref: i.ref, from: { x: i.x, y: i.y }, to: { x: i.x + step[0] * by, y: i.y + step[1] * by } })),
        )
      }
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === 'v' && editor) return paste()
      if (!picked.length && !texts.length) return
      if (key === 'c') {
        stop()
        Object.assign(clipboard, { cards: picked, labels: texts, edges, pasted: 0 })
      }
      if (key === 'd' && editor && plane) {
        stop()
        setSelection(copyCards(wid, plane, picked, edges, [2 * GRID, 2 * GRID], texts))
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
  // In an unfolded package's frame but not in it (D-242).
  dim?: boolean
  // An unfolded package (D-239): its box (band and frame round its members), and its members.
  place?: Box
  members?: Card[]
  // How many parts each card has (a folded package's members say what they hold).
  counts?: Map<string, number>
}

function CardBoxOf(props: BoxProps) {
  if (props.place && props.card.type === 'package' && !props.card.folded) return <PackageFrame {...props} place={props.place} />
  return <CardBody {...props} />
}

// The same value: the same thing, or lists and plain objects holding the same (two levels down: a card's facts hold its
// tasks' counts). The plane builds its cards' props again on every change; a card whose props hold the same doesn't draw.
function same(a: unknown, b: unknown, depth = 2): boolean {
  if (a === b) return true
  if (!depth || !a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i], depth - 1))
  if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) return false
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], depth - 1))
}
const sameProps = (a: BoxProps, b: BoxProps) => (Object.keys(a) as (keyof BoxProps)[]).every((k) => same(a[k], b[k])) && Object.keys(a).length === Object.keys(b).length

// One card on a plane: drawn again only when what it shows changed (one card's title changing draws that card).
const CardBox = memo(CardBoxOf, sameProps)

// An unfolded package (D-239): no card, a frame round its members and a band over it that is the package (its name,
// rating, a cell per member, `[−]` to fold them in). The band takes the pointer (select, drag them all, its `›`); the
// frame lets it through to the cards and the plane.
function PackageFrame({ card, facts, zoom, live, editor, place, members = [] }: BoxProps & { place: Box }) {
  const { wid, threads } = useWs()
  const selected = useCanvasView((s) => live && (s.cardSelected === card.id || s.cardMulti.includes(card.id)))
  const hovered = useCanvasView((s) => live && s.cardHovered === card.id)
  const peers = usePeersOn(card.id, planeOf(card))
  const [pressed, setPressed] = useState(false)
  // Its members carry it: `place` already follows them while they're dragged.
  const [x, y] = [place.x, place.y]
  const press = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live || e.button !== 0) return
    e.stopPropagation()
    // Picking a new package's cards: a package can be one of them (D-240).
    if (e.shiftKey || useCanvasView.getState().packing) return toggleSelected(card.id)
    setSelection([card.id])
    if (!editor || !members.length) return
    setPressed(true)
    // Its members and what they carry; the package itself has no place of its own while unfolded.
    const ids = members.map((m) => m.id)
    startGroupDrag(e, zoom, members[0], () => setPressed(false), [...ids, ...onPlane.carried(ids)], heldAt(e, place.x, place.y, zoom))
  }
  const fold = () => void foldPackage(wid, card, [snap(place.x), snap(place.y)])
  return (
    <div
      className={styles.pkg}
      style={{ left: x, top: y, width: place.w, height: place.h, ['--type' as string]: TYPE_ACCENT.package }}
      data-selected={selected || undefined}
      data-pressed={pressed || undefined}
      data-target={`card:${card.id}`}
    >
      <div
        className={styles.band}
        onPointerDown={press}
        onPointerEnter={live ? () => useCanvasView.setState({ cardHovered: card.id }) : undefined}
        onPointerLeave={live ? () => useCanvasView.getState().cardHovered === card.id && useCanvasView.setState({ cardHovered: null }) : undefined}
      >
        <span className={styles.kind}>package</span>
        <span className={styles.bandName} data-empty={!card.title || undefined}>
          {card.title || PLACEHOLDER.package}
        </span>
        {facts?.head && <span className={styles.bandFacts}>{facts.head}</span>}
        <span className={styles.cells}>
          {members.slice(0, 12).map((m) => (
            <i key={m.id} data-on style={{ background: TYPE_ACCENT[m.type] }} />
          ))}
        </span>
        {editor && (
          <button className={styles.fold} onPointerDown={(e) => e.stopPropagation()} onClick={fold} title="Fold its members into it">
            [−] {members.length}
          </button>
        )}
      </div>
      <div className={styles.frame} />
      {live && <Marks zoom={zoom} tier="l" short={Math.min(place.w, place.h)} hover={hovered} selected={selected} pressed={pressed} peers={peers} />}
      {live && <ThreadChip wid={wid} thread={threadOn(threads, card.id)} zoom={zoom} />}
    </div>
  )
}

function CardBody({ card, facts, detail, zoom, live, editor, arrive, h, tuck, parts, rows, carries, features, matched, open, counts, dim }: BoxProps) {
  const { wid, threads } = useWs()
  // Every card and link only when a link is drawn from it: read then, so a card doesn't draw again when another changes.
  const now = useWsNow()
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
  // Let go with others (or by a section): held where it was let go until its data's back (D-229).
  const landing = useCanvasView((s) => s.landing[card.id])
  useEffect(() => {
    if (landing && landing[0] === card.x && landing[1] === card.y) landed(card.id)
  }, [landing, card.x, card.y, card.id])
  const [x, y] = held ?? landing ?? [card.x + (shift?.dx ?? 0), card.y + (shift?.dy ?? 0)]
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
  const peers = usePeersOn(card.id, planeOf(card))
  const target = useCanvasView((s) => live && s.linking?.over === card.id)
  const linkingFrom = useCanvasView((s) => live && s.linking?.from === card.id)

  const press = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live || e.button !== 0) return
    // The plane would pan.
    e.stopPropagation()
    // Shift, or picking a package's cards (D-240): in or out of the selection, no drag (D-227).
    if (e.shiftKey || useCanvasView.getState().packing) return toggleSelected(card.id)
    // Pressed inside a selection, the whole of it moves (D-229); otherwise this card alone is picked.
    if (useCanvasView.getState().cardMulti.includes(card.id)) {
      if (!editor) return
      setPressed(true)
      return startGroupDrag(e, zoom, card, () => setPressed(false))
    }
    setSelection([card.id])
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
      const loose = ev.altKey || !useGuides.getState().snap
      const place = (v: number) => (loose ? Math.round(v) : snap(v))
      to = [place(free[0]), place(free[1])]
      // Lined up with the rest of the plane (D-231): pulled onto a line when loose, only shown on the grid.
      const g = guide({ x: to[0], y: to[1], w: CARD.w, h }, othersThan(new Set([card.id, ...carries.map((c) => c.id)])), zoom, loose)
      to = [to[0] + g.dx, to[1] + g.dy]
      showGuides(g.lines)
      setHeld(to)
      setDrag({ free, at })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setPressed(false)
      setDrag(null)
      clearGuides()
      const [dx, dy] = to ? [to[0] - card.x, to[1] - card.y] : [0, 0]
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
      const { cards, edges } = now()
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

  // The face, small, under the pointer: from where it lands (the box) to where it is, shrunk round the point held. Carried
  // with a selection, the same round the point held in the one pressed; its marks on `<Landing>` meanwhile (D-265).
  const along = shift?.shrink && shift.free && shift.at ? { free: shift.free, at: shift.at } : null
  const carried = drag
    ? { translate: `${drag.free[0] - x}px ${drag.free[1] - y}px`, scale: `${CARRIED}`, transformOrigin: `${drag.at[0]}px ${drag.at[1]}px` }
    : along && shift
      ? {
          translate: `${along.free[0] - shift.dx}px ${along.free[1] - shift.dy}px`,
          scale: `${CARRIED}`,
          transformOrigin: `${along.at[0] - card.x}px ${along.at[1] - card.y}px`,
        }
      : undefined
  const moving = !!drag || !!along
  // A folded part shrinks into its row in the feature that holds it, and grows back out of it.
  const tucked = tuck ? { transform: `translate(${tuck.x - x}px, ${tuck.y - y}px) scale(${tuck.w / CARD.w}, ${tuck.h / CARD.h})` } : undefined

  return (
    <>
      <div
        className={styles.box}
        style={{ left: x, top: y, width: CARD.w, height: h, ['--type' as string]: TYPE_ACCENT[card.type], ...tucked }}
        data-type={card.type}
        data-tucked={tuck ? true : undefined}
        data-open={open && !drag ? true : undefined}
        aria-hidden={tuck ? true : undefined}
        data-selected={selected || undefined}
        data-pressed={pressed || moving || undefined}
        data-dragging={moving || undefined}
        data-dim={dim || undefined}
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
              inPkg={counts}
              features={features}
              matched={matched}
              open={open && !drag}
            />
          ) : (
            <CompactTitle text={card.title || PLACEHOLDER[card.type]} empty={!card.title} bars={detail === 'far'} />
          )}
        </div>
        {live && <Marks zoom={zoom} short={Math.min(CARD.w, h)} tone="var(--type)" selected={selected} pressed={pressed} dragging={moving} target={target} peers={peers} />}
        {live && editor && !drag && (hovered || linkingFrom) && (
          <span className={styles.handle} data-linking={linkingFrom || undefined} onPointerDown={startLink} aria-label="Drag to another card to link">
            <span aria-hidden>›</span>
          </span>
        )}
        {live && <ThreadChip wid={wid} thread={threadOn(threads, card.id)} zoom={zoom} />}
      </div>
      {live && moving && <Landing x={x} y={y} w={CARD.w} h={h} zoom={zoom} tone={TYPE_ACCENT[card.type]} />}
    </>
  )
}

type FullProps = { card: Card; facts?: Facts; editor: boolean; parts: number; rows?: { card: Card; depth: number }[]; inPkg?: Map<string, number>; features?: CompetitorFeature[]; matched: Set<string>; open: boolean }

function FullCard({ card, facts, editor, parts, rows, inPkg, features, matched, open }: FullProps) {
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
          {rows.map((r) => {
            // What a folded card holds (D-245): each row a bar in its own card's colour, a step further in for each level
            // down, so what's under what shows; its status or priority; a package's row, how much it holds.
            const held = r.card.type === 'package' ? (inPkg?.get(r.card.id) ?? 0) : 0
            return (
              <button
                key={r.card.id}
                className={styles.memberRow}
                style={{ ['--tone' as string]: TYPE_ACCENT[r.card.type], paddingLeft: r.depth * INDENT }}
                onClick={() => useCanvasView.setState({ cardSelected: r.card.id, labelSelected: null, linkSelected: null })}
              >
                <i aria-hidden />
                <span className={styles.miniName}>{r.card.title || PLACEHOLDER[r.card.type]}</span>
                <span className={styles.miniAv}>{[held ? `${held} inside` : '', r.card.status ?? r.card.validation ?? r.card.priority].filter(Boolean).join(' · ')}</span>
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
        {facts?.tasks && (
          <span className={styles.tasks} data-all={facts.tasks.done === facts.tasks.all || undefined} title={`${facts.tasks.done} of ${facts.tasks.all} tasks finished`}>
            {facts.tasks.done === facts.tasks.all ? '☑' : '☐'} {facts.tasks.done}/{facts.tasks.all}
          </span>
        )}
        {/* On other planes too (D-281): what's changed here changes there. */}
        {facts?.planes && (
          <span className={styles.planes} title={`On ${facts.planes} planes: the same card on each`}>
            ⧉ <b>{facts.planes}</b>
          </span>
        )}
        {parts > 0 && (
          <button
            className={styles.fold}
            disabled={!editor}
            title={card.type === 'package' ? 'Lay what it holds out on the plane' : card.folded ? 'Unfold its parts onto the plane' : 'Fold its parts into it'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() =>
              void (card.type === 'package' ? foldPackage(wid, card, null) : foldCard(wid, card, !card.folded))
            }
          >
            {card.type === 'package' ? `[+] ${parts} inside` : `[${card.folded ? '+' : '−'}] ${parts} part${parts === 1 ? '' : 's'}`}
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
