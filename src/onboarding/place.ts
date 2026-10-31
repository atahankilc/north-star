// Where a lesson card goes (D-315, docs/specs/onboarding.md §3.1.4, §4.3): beside its anchor, never over it, never over
// the right panel; pure, all in screen px, so vitest checks every case.
//
// In order: right of the anchor, left, above (then below, for an anchor at the screen's top, like the breadcrumb). A
// side whose space holds cards first shifts along that side into a clear spot; only when no side has one does the card
// cover some cards (the side covering the least); only when no side fits at all, the bottom-middle card (no lead),
// clear of what it must never cover. A spot whose lead would cross a console's or dock's buttons is never taken.
// In a focus the right of the screen stays free (D-211): left first, the right only if the card stays clear of the
// right strip; an anchor that is the dock gets straight above it first. A look may ask for its own order (the drawer
// hangs below or rises above its anchor, joined to it: gap 0).

export type Rect = { x: number; y: number; w: number; h: number }
export type Side = 'right' | 'left' | 'above' | 'below'
export type Lead = { x1: number; y1: number; x2: number; y2: number }

export type PlaceInput = {
  // The anchor's rect on screen; null: no anchor found (the bottom-middle card).
  anchor: Rect | null
  // The card's size.
  size: { w: number; h: number }
  view: { w: number; h: number }
  // What it should shift away from before covering (cards, tasks).
  soft?: Rect[]
  // What it must never cover (the right panel, the piece being taught, consoles and docks, the coach's hints).
  hard?: Rect[]
  // What its lead line must never cross (the buttons of a console or a dock): a spot whose lead would is passed over.
  noLead?: Rect[]
  // In a focus: the right strip kept free, left before right.
  focus?: boolean
  // The anchor is the focus dock (straight above it first).
  dock?: boolean
  // The bottom edge's dock, if any: the bottom-middle card sits above it.
  bottomDock?: Rect | null
  order?: Side[]
  gap?: number
  margin?: number
}

export type Placed =
  | { at: 'beside'; side: Side; x: number; y: number; lead: Lead | null }
  | { at: 'bottom'; x: number; y: number; lead: null }

// The right strip a focus keeps free (a right panel's width, D-219).
export const RIGHT_FREE = 400
const STEP = 8

export const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
export const hits = (a: Rect, b: Rect) => overlap(a, b) > 0

const clamp = (v: number, lo: number, hi: number) => (hi < lo ? lo : Math.max(lo, Math.min(hi, v)))

export function sideOrder(i: Pick<PlaceInput, 'order' | 'focus' | 'dock'>): Side[] {
  if (i.order) return i.order
  if (i.dock) return ['above', 'left', 'right', 'below']
  if (i.focus) return ['left', 'above', 'right', 'below']
  return ['right', 'left', 'above', 'below']
}

// The card's base spot on one side: next to the anchor, centred on it along that side, kept inside the view.
function base(side: Side, a: Rect, s: { w: number; h: number }, view: { w: number; h: number }, gap: number, m: number): Rect {
  const cy = clamp(a.y + a.h / 2 - s.h / 2, m, view.h - m - s.h)
  const cx = clamp(a.x + a.w / 2 - s.w / 2, m, view.w - m - s.w)
  if (side === 'right') return { x: a.x + a.w + gap, y: cy, ...s }
  if (side === 'left') return { x: a.x - gap - s.w, y: cy, ...s }
  if (side === 'above') return { x: cx, y: a.y - gap - s.h, ...s }
  return { x: cx, y: a.y + a.h + gap, ...s }
}

// Past what it must never cover, along its side (right of a piece the anchor sits in, not over it).
function pastHard(side: Side, r: Rect, hard: Rect[], gap: number): Rect {
  let out = r
  for (let k = 0; k < 4; k++) {
    const h = hard.find((x) => hits(out, x))
    if (!h) return out
    if (side === 'right') out = { ...out, x: h.x + h.w + gap }
    else if (side === 'left') out = { ...out, x: h.x - gap - out.w }
    else if (side === 'above') out = { ...out, y: h.y - gap - out.h }
    else out = { ...out, y: h.y + h.h + gap }
  }
  return out
}

function fits(r: Rect, i: PlaceInput, m: number): boolean {
  const { view } = i
  if (r.x < m || r.y < m || r.x + r.w > view.w - m || r.y + r.h > view.h - m) return false
  if (i.anchor && hits(r, i.anchor)) return false
  if ((i.hard ?? []).some((h) => hits(r, h))) return false
  if (i.focus && r.x + r.w > view.w - RIGHT_FREE) return false
  return true
}

const covered = (r: Rect, soft: Rect[]) => soft.reduce((n, s) => n + overlap(r, s), 0)

// The lead as a thin box (a pixel off its anchor end, so a button the anchor touches doesn't count).
function leadBox(l: Lead): Rect {
  if (l.y1 === l.y2) {
    const x0 = Math.min(l.x1, l.x2)
    const x1 = Math.max(l.x1, l.x2)
    return l.x2 > l.x1 ? { x: x0, y: l.y1 - 0.5, w: Math.max(0, x1 - x0 - 1), h: 1 } : { x: x0 + 1, y: l.y1 - 0.5, w: Math.max(0, x1 - x0 - 1), h: 1 }
  }
  const y0 = Math.min(l.y1, l.y2)
  const y1 = Math.max(l.y1, l.y2)
  return l.y2 > l.y1 ? { x: l.x1 - 0.5, y: y0, w: 1, h: Math.max(0, y1 - y0 - 1) } : { x: l.x1 - 0.5, y: y0 + 1, w: 1, h: Math.max(0, y1 - y0 - 1) }
}
export const leadCrosses = (l: Lead, blocks: Rect[]) => {
  const b = leadBox(l)
  return b.w > 0 && b.h > 0 && blocks.some((x) => hits(b, x))
}

// The line from the card's edge to the anchor's (straight, along the side's axis where they face each other).
export function leadFor(side: Side, r: Rect, a: Rect): Lead {
  if (side === 'right' || side === 'left') {
    const lo = Math.max(r.y, a.y)
    const hi = Math.min(r.y + r.h, a.y + a.h)
    const y = lo <= hi ? (lo + hi) / 2 : clamp(a.y + a.h / 2, r.y + 8, r.y + r.h - 8)
    return side === 'right' ? { x1: r.x, y1: y, x2: a.x + a.w, y2: y } : { x1: r.x + r.w, y1: y, x2: a.x, y2: y }
  }
  const lo = Math.max(r.x, a.x)
  const hi = Math.min(r.x + r.w, a.x + a.w)
  const x = lo <= hi ? (lo + hi) / 2 : clamp(a.x + a.w / 2, r.x + 8, r.x + r.w - 8)
  return side === 'above' ? { x1: x, y1: r.y + r.h, x2: x, y2: a.y } : { x1: x, y1: r.y, x2: x, y2: a.y + a.h }
}

// Along a side: 0, +8, −8, +16, −16… as far as the view allows.
function* shifts(limit: number) {
  yield 0
  for (let d = STEP; d <= limit; d += STEP) {
    yield d
    yield -d
  }
}

export function bottomMiddle(i: PlaceInput): Placed {
  const m = i.margin ?? 16
  const { view, size } = i
  const floor = i.bottomDock ? i.bottomDock.y - 12 : view.h - 24
  const y = Math.max(m, floor - size.h)
  const mid = (view.w - size.w) / 2
  const hard = i.hard ?? []
  // Never over its anchor either (an anchor low on the screen, a big one that left no room beside it).
  const all = [...hard, ...(i.anchor ? [i.anchor] : [])]
  // The middle, else the clear spot nearest it (beside each thing it mustn't cover), at the floor or else at the top (a
  // wide anchor along the bottom: the threads list with a thread beside it).
  const xs = [mid, ...all.flatMap((h) => [h.x - 12 - size.w, h.x + h.w + 12])]
    .map((x) => Math.max(m, Math.min(view.w - m - size.w, x)))
    .sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid))
  const spots = [y, m].flatMap((yy) => xs.map((x) => ({ x, y: yy })))
  // Nothing clear: the spot hiding least, as the share of each thing it covers (a sliver of a big piece before the side
  // nav), its anchor counting three times.
  const share = (r: Rect, h: Rect) => overlap(r, h) / Math.max(1, h.w * h.h)
  const cost = (p: { x: number; y: number }) => {
    const r = { x: p.x, y: p.y, ...size }
    return hard.reduce((n, h) => n + share(r, h), 0) + 3 * (i.anchor ? share(r, i.anchor) : 0)
  }
  let best = spots[0]
  let least = Infinity
  for (const p of spots) {
    const c = cost(p)
    if (c === 0) {
      best = p
      break
    }
    if (c < least) {
      least = c
      best = p
    }
  }
  return { at: 'bottom', x: Math.round(best.x), y: Math.round(best.y), lead: null }
}

// Whether a card already placed must be placed again: what it must keep clear has moved or grown under it (its anchor:
// a console widening as its piece goes into edit mode; what the lesson is about: a link's two cards).
export const mustReplace = (card: Rect, anchor: Rect | null, keep: Rect[] = []) => (!!anchor && hits(card, anchor)) || keep.some((k) => hits(card, k))

// Whether placing again would put the card somewhere else (a must-replace with no clear spot left gives the same spot:
// then it stays, and isn't asked again).
export const movesTo = (now: Pick<Placed, 'x' | 'y' | 'at'> | null, next: Pick<Placed, 'x' | 'y' | 'at'>) =>
  !now || now.x !== next.x || now.y !== next.y || now.at !== next.at

export function place(i: PlaceInput): Placed {
  const a = i.anchor
  if (!a) return bottomMiddle(i)
  const gap = i.gap ?? 14
  const m = i.margin ?? 16
  const soft = i.soft ?? []
  const sides = sideOrder(i)
  const done = (side: Side, r: Rect): Placed => ({
    at: 'beside',
    side,
    x: Math.round(r.x),
    y: Math.round(r.y),
    lead: gap > 0 ? leadFor(side, r, a) : null,
  })

  // 1. A clear spot on a side, shifted along it if its first spot holds cards.
  for (const side of sides) {
    const r0 = pastHard(side, base(side, a, i.size, i.view, gap, m), i.hard ?? [], Math.max(gap, 12))
    const along = side === 'right' || side === 'left'
    const limit = along ? i.view.h : i.view.w
    for (const d of shifts(limit)) {
      const r = along ? { ...r0, y: r0.y + d } : { ...r0, x: r0.x + d }
      if (!fits(r, i, m)) {
        // Off the view this way: further this way won't come back in for the first spot; keep trying the other way.
        continue
      }
      // A shifted card must still face its anchor (a lead can reach it straight).
      if (along ? r.y > a.y + a.h || r.y + r.h < a.y : r.x > a.x + a.w || r.x + r.w < a.x) continue
      if (leadCrosses(leadFor(side, r, a), i.noLead ?? [])) continue
      if (covered(r, soft) === 0) return done(side, r)
    }
  }
  // 2. No clear spot: the side that covers the least, at its first spot.
  let best: { side: Side; r: Rect; n: number } | null = null
  for (const side of sides) {
    const r = pastHard(side, base(side, a, i.size, i.view, gap, m), i.hard ?? [], Math.max(gap, 12))
    if (!fits(r, i, m) || leadCrosses(leadFor(side, r, a), i.noLead ?? [])) continue
    const n = covered(r, soft)
    if (!best || n < best.n) best = { side, r, n }
  }
  if (best) return done(best.side, best.r)
  // 3. No room beside it: the bottom-middle card.
  return bottomMiddle(i)
}
