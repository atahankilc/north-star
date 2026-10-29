// Links on a plane (D-207), as on the old board (D-059, D-108, D-113, D-147, D-154): a straight line from card edge to
// card edge with an arrowhead, in its kind's colour, and a small framed chip at its middle saying its kind (its own label
// while it's hovered, selected or the selected card's). Several links between two cards sit side by side. In focus a
// click selects one (a bar under its chip: kind, label, reverse, remove); a hovered link, or a hovered or selected card,
// lights its links (a hovered link shows its own label) and the rest dim. Right-click → comment (D-193): its
// conversation's chip under the link's chip. A link is drawn from a card's `›` onto another card (PlaneCards). Always
// straight: no bend points (D-292).
import { useEffect, useRef, useState } from 'react'
import { CARD, type Card } from '../../data/cards'
import { deleteEdge, FOR, reverseEdge, updateEdge, type Edge } from '../../data/edges'
import { useCanvasView } from '../../state/canvasView'
import { Select } from '../../ui/Select'
import { useWs } from './context'
import { Marks } from '../../ui/Marks'
import { ThreadChip, threadOn } from './Threads'
import styles from './PlaneLinks.module.css'

type LinkGroup = 'solves' | 'part' | 'competes' | 'clashes' | 'draws' | 'depends' | 'plain' | 'for'

// Each kind its own colour, all solid (D-146, D-147).
const KINDS: Record<string, { label: string; group: LinkGroup }> = {
  relates: { label: 'relates', group: 'plain' },
  solves: { label: 'solves', group: 'solves' },
  'part-of': { label: 'part of', group: 'part' },
  'competes-with': { label: 'competes', group: 'competes' },
  contradicts: { label: 'contradicts', group: 'clashes' },
  'inspired-by': { label: 'inspired by', group: 'draws' },
  'depends-on': { label: 'depends on', group: 'depends' },
  [FOR]: { label: 'for', group: 'for' },
}
const kindOf = (kind: string) => KINDS[kind] ?? { label: kind, group: 'plain' as LinkGroup }
export const linkTone = (kind: string) => `var(--link-${kindOf(kind).group})`

// In plane px (the old board's units × 80): the arrowhead, the gap between a line's end and its card, and how far apart
// links between the same two cards sit.
const ARROW = 12.8
const GAP = 4
const SPREAD = 25.6
// Chips of side-by-side links on a steep line would sit on each other: each moves along its line by this much a slot,
// times how steep the line is, never past the line's visible part (D-113).
const CHIP_SHIFT = 28.8
const CHIP_H = 12
// The chip's text is a card's small text (D-154); below this on screen the chip isn't drawn (unless selected).
const CHIP_TEXT = 8
const CHIP_MIN_PX = 4.5

type V = [number, number]
export type Drawn = { edge: Edge; a: V; b: V; mid: V }

type B = { x: number; y: number; w: number; h: number }

// Where a ray from `p` (inside the box) in direction `d` leaves the box.
function exit(p: V, d: V, box: { x: number; y: number; w?: number; h?: number }): number {
  const [w, h] = [box.w ?? CARD.w, box.h ?? CARD.h]
  const ts = [
    d[0] > 0 ? (box.x + w - p[0]) / d[0] : d[0] < 0 ? (box.x - p[0]) / d[0] : Infinity,
    d[1] > 0 ? (box.y + h - p[1]) / d[1] : d[1] < 0 ? (box.y - p[1]) / d[1] : Infinity,
  ]
  return Math.min(...ts)
}

const centre = (c: Card): V => [c.x + CARD.w / 2, c.y + CARD.h / 2]

// Each link whose two cards are both here, from edge to edge. Links between the same pair are spread square to their
// line round the centres, the side taken from the pair (not the direction), within 80 % of a card's shorter side (D-113).
// `boxOf` is where a card is drawn: a grown card's whole box, a folded part's row (D-225); `skip` leaves a link out.
export function drawLinks(cards: Card[], edges: Edge[], boxOf: (c: Card) => B = (c) => ({ x: c.x, y: c.y, w: CARD.w, h: CARD.h }), skip?: (e: Edge) => boolean): Drawn[] {
  const byId = new Map(cards.map((c) => [c.id, c]))
  const pairs = new Map<string, Edge[]>()
  for (const e of edges) {
    if (!byId.has(e.fromId) || !byId.has(e.toId) || skip?.(e)) continue
    const key = [e.fromId, e.toId].sort().join('|')
    pairs.set(key, [...(pairs.get(key) ?? []), e])
  }
  const out: Drawn[] = []
  for (const [key, list] of pairs) {
    const [i, j] = key.split('|')
    const ci = byId.get(i)!
    const cj = byId.get(j)!
    const bi = boxOf(ci)
    const bj = boxOf(cj)
    const p0: V = [bi.x + bi.w / 2, bi.y + bi.h / 2]
    const p1: V = [bj.x + bj.w / 2, bj.y + bj.h / 2]
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    if (len < 1) continue
    const d: V = [(p1[0] - p0[0]) / len, (p1[1] - p0[1]) / len]
    const n: V = [-d[1], d[0]]
    const step = list.length > 1 ? Math.min(SPREAD, (0.8 * Math.min(bi.h, bj.h)) / (list.length - 1)) : 0
    list.forEach((e, k) => {
      const off = (k - (list.length - 1) / 2) * step
      const s: V = [p0[0] + n[0] * off, p0[1] + n[1] * off]
      const t: V = [p1[0] + n[0] * off, p1[1] + n[1] * off]
      const t0 = exit(s, d, bi) + GAP
      const t1 = len - exit(t, [-d[0], -d[1]], bj) - GAP
      // Overlapping cards: nothing to draw between them.
      if (t1 - t0 < ARROW) return
      const a: V = [s[0] + d[0] * t0, s[1] + d[1] * t0]
      const b: V = [s[0] + d[0] * t1, s[1] + d[1] * t1]
      const [from, to] = e.fromId === i ? [a, b] : [b, a]
      const room = Math.max(0, (t1 - t0 - CHIP_H) / 2 - ARROW)
      const along = Math.max(-room, Math.min(room, CHIP_SHIFT * (k - (list.length - 1) / 2) * Math.abs(d[1])))
      out.push({ edge: e, a: from, b: to, mid: [(a[0] + b[0]) / 2 + d[0] * along, (a[1] + b[1]) / 2 + d[1] * along] })
    })
  }
  return out
}

type State = { selected: boolean; active: boolean; dim: boolean }

function useLinkState(live: boolean) {
  const sel = useCanvasView((s) => (live ? s.linkSelected : null))
  const over = useCanvasView((s) => (live ? s.linkHovered : null))
  const card = useCanvasView((s) => (live ? (s.linking?.from ?? s.cardHovered ?? s.cardSelected) : null))
  return (e: Edge): State => {
    const selected = e.id === sel
    const active = e.id === over || (!!card && (e.fromId === card || e.toId === card))
    return { selected, active, dim: (!!sel || !!card || !!over) && !selected && !active }
  }
}

const select = (id: string) => useCanvasView.setState({ linkSelected: id, cardSelected: null, labelSelected: null, selected: null })
const hover = (id: string) => ({
  onPointerEnter: () => useCanvasView.setState({ linkHovered: id }),
  onPointerLeave: () => useCanvasView.getState().linkHovered === id && useCanvasView.setState({ linkHovered: null }),
})

// The lines, under the cards.
export function LinkLines({ links, live, zoom, ghost }: { links: Drawn[]; live: boolean; zoom: number; ghost: { a: V; b: V } | null }) {
  const state = useLinkState(live)
  return (
    <svg className={styles.lines} aria-hidden>
      {links.map(({ edge, a, b }) => {
        const s = state(edge)
        const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
        // The line stops at the arrowhead's back.
        const end: V = [b[0] - Math.cos(angle) * ARROW * 0.8, b[1] - Math.sin(angle) * ARROW * 0.8]
        return (
          <g key={edge.id} style={{ color: linkTone(edge.kind) }} opacity={s.dim ? 0.22 : 1}>
            <line x1={a[0]} y1={a[1]} x2={end[0]} y2={end[1]} className={styles.line} strokeWidth={s.selected ? 3 : s.active ? 2.2 : 1.5} />
            <polygon
              className={styles.arrow}
              points={`0,0 ${-ARROW},${ARROW / 2} ${-ARROW},${-ARROW / 2}`}
              transform={`translate(${b[0]} ${b[1]}) rotate(${(angle * 180) / Math.PI})`}
            />
            {live && (
              <line
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                className={styles.hit}
                data-target={`link:${edge.id}`}
                {...hover(edge.id)}
                strokeWidth={Math.max(12, 12 / zoom)}
                onPointerDown={(ev) => {
                  if (ev.button !== 0) return
                  ev.stopPropagation()
                  select(edge.id)
                }}
              />
            )}
          </g>
        )
      })}
      {ghost && <line x1={ghost.a[0]} y1={ghost.a[1]} x2={ghost.b[0]} y2={ghost.b[1]} className={styles.ghost} />}
    </svg>
  )
}

// The chips and the selected link's bar, over the cards.
export function LinkChips({ links, live, editor, zoom }: { links: Drawn[]; live: boolean; editor: boolean; zoom: number }) {
  const { wid, threads } = useWs()
  const state = useLinkState(live)
  const readable = CHIP_TEXT * zoom >= CHIP_MIN_PX
  return (
    <>
      {links.map(({ edge, mid }) => {
        const s = state(edge)
        const thread = live ? threadOn(threads, edge.id) : null
        if (!readable && !s.selected && !thread) return null
        // Its own label only while it's in focus (D-135); otherwise its kind.
        const text = (s.selected || s.active) && edge.label ? edge.label : kindOf(edge.kind).label
        return (
          <div key={edge.id} className={styles.at} style={{ left: mid[0], top: mid[1], ['--tone' as string]: linkTone(edge.kind) }}>
            <span
              className={styles.chip}
              data-selected={s.selected || undefined}
              data-live={live || undefined}
              data-hidden={(!readable && !s.selected) || undefined}
              data-target={live ? `link:${edge.id}` : undefined}
              {...(live ? hover(edge.id) : {})}
              style={{ opacity: s.dim ? 0.22 : 1 }}
              onPointerDown={(ev) => {
                if (!live || ev.button !== 0) return
                ev.stopPropagation()
                select(edge.id)
              }}
            >
              {text}
              {live && <Marks zoom={zoom} tier="s" tone="var(--tone)" selected={s.selected} />}
              {thread && (
                <span className={styles.thread}>
                  <ThreadChip wid={wid} thread={thread} zoom={zoom} />
                </span>
              )}
            </span>
            {s.selected && editor && <LinkBar edge={edge} zoom={zoom} />}
          </div>
        )
      })}
    </>
  )
}

// A kind in the picker: a short bar in its colour, then its name.
function KindOption({ kind }: { kind: string }) {
  return (
    <span style={{ ['--tone' as string]: linkTone(kind) }}>
      <span className={styles.swatch} aria-hidden />
      {kindOf(kind).label}
    </span>
  )
}

// Under a selected link, at the screen's size (D-108, D-154): its kind, its own label, turn it round, remove. A link just
// drawn opens it with the cursor in the label.
function LinkBar({ edge, zoom }: { edge: Edge; zoom: number }) {
  const { wid } = useWs()
  const [draft, setDraft] = useState(edge.label ?? '')
  useEffect(() => setDraft(edge.label ?? ''), [edge.label])
  const input = useRef<HTMLInputElement>(null)
  const labelling = useCanvasView((s) => s.linkLabelling)
  useEffect(() => {
    if (!labelling) return
    input.current?.focus({ preventScroll: true })
    useCanvasView.setState({ linkLabelling: false })
  }, [labelling])
  const save = () => {
    const next = draft.trim()
    if (next !== (edge.label ?? '')) void updateEdge(wid, edge.id, { label: next || undefined })
  }
  return (
    <div className={styles.barAt} data-screen-sized style={{ transform: `scale(${1 / zoom})` }}>
      <div
        className={styles.bar}
        style={{ ['--tone' as string]: linkTone(edge.kind) }}
        role="toolbar"
        aria-label="Link"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <Select
          className={styles.kind}
          value={edge.kind}
          options={Object.keys(KINDS).map((k) => ({ value: k, label: <KindOption kind={k} /> }))}
          onChange={(kind) => void updateEdge(wid, edge.id, { kind })}
          ariaLabel="Link type"
        />
        <span className={styles.rule} />
        <input
          ref={input}
          className={styles.input}
          value={draft}
          maxLength={200}
          placeholder="label…"
          aria-label="Link label"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setDraft(edge.label ?? '')
              requestAnimationFrame(() => (e.target as HTMLInputElement).blur())
            }
          }}
        />
        <span className={styles.rule} />
        {/* A customer tag always points item → customer (D-044). */}
        <button
          className={styles.button}
          disabled={edge.kind === FOR}
          title={edge.kind === FOR ? 'A customer tag always points at the customer' : 'Turn the arrow around'}
          onClick={() => void reverseEdge(wid, edge)}
        >
          ⇄ reverse
        </button>
        <button
          className={styles.button}
          data-tone="danger"
          title="Delete or Backspace"
          onClick={() => {
            useCanvasView.setState({ linkSelected: null })
            void deleteEdge(wid, edge.id)
          }}
        >
          × remove
        </button>
      </div>
    </div>
  )
}

// The link being drawn from a card's `›`: from that card's edge to the pointer.
export function ghostOf(cards: Card[], linking: { from: string; to: V } | null): { a: V; b: V } | null {
  const c = linking && cards.find((k) => k.id === linking.from)
  if (!c || !linking) return null
  const p = centre(c)
  const len = Math.hypot(linking.to[0] - p[0], linking.to[1] - p[1])
  if (len < 1) return null
  const d: V = [(linking.to[0] - p[0]) / len, (linking.to[1] - p[1]) / len]
  const t = exit(p, d, c)
  if (t >= len) return null
  return { a: [p[0] + d[0] * t, p[1] + d[1] * t], b: linking.to }
}
