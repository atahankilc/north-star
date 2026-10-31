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
  // What it keeps clear of when it can, but may cover rather than go far from its anchor with no lead (other pieces'
  // consoles, a focused lens's cells): tried after every clear spot, before the bottom-middle card.
  firm?: Rect[]
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
// Further than this from its anchor (card edge to anchor edge) a spot is far: a near one over another piece's console
// goes first.
export const FAR = 120

const gapBetween = (r: Rect, a: Rect) =>
  Math.hypot(Math.max(a.x - (r.x + r.w), 0, r.x - (a.x + a.w)), Math.max(a.y - (r.y + r.h), 0, r.y - (a.y + a.h)))

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

function fits(r: Rect, i: PlaceInput, m: number, firmToo = true, buttonsToo = true): boolean {
  const { view } = i
  if (r.x < m || r.y < m || r.x + r.w > view.w - m || r.y + r.h > view.h - m) return false
  if (i.anchor && hits(r, i.anchor)) return false
  if ((i.hard ?? []).some((h) => hits(r, h))) return false
  if (firmToo && (i.firm ?? []).some((h) => hits(r, h))) return false
  // Never over a console's buttons (`noLead`, the buttons of every console and menu on screen), firm or not; only the
  // last resort (place()'s `overButtons` pass) may.
  if (buttonsToo && (i.noLead ?? []).some((h) => hits(r, h))) return false
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
  return bottomSpot(i).placed
}

// The bottom-middle card and whether it had to cover a console's buttons (then a near spot covering the fewest of them,
// with its lead, is better: place()'s last pass).
function bottomSpot(i: PlaceInput): { placed: Placed; buttons: boolean } {
  const m = i.margin ?? 16
  const { view, size } = i
  const floor = i.bottomDock ? i.bottomDock.y - 12 : view.h - 24
  const y = Math.max(m, floor - size.h)
  const mid = (view.w - size.w) / 2
  const hard = i.hard ?? []
  // Never over its anchor either (an anchor low on the screen, a big one that left no room beside it).
  const firm = i.firm ?? []
  const buttons = i.noLead ?? []
  const all = [...hard, ...firm, ...buttons, ...(i.anchor ? [i.anchor] : [])]
  // The middle, else the clear spot nearest it (beside each thing it mustn't cover), at the floor or else at the top (a
  // wide anchor along the bottom: the threads list with a thread beside it).
  const xs = [mid, ...all.flatMap((h) => [h.x - 12 - size.w, h.x + h.w + 12])]
    .map((x) => Math.max(m, Math.min(view.w - m - size.w, x)))
    .sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid))
  const spots = [y, m].flatMap((yy) => xs.map((x) => ({ x, y: yy })))
  // Nothing clear: the spot hiding least, as the share of each thing it covers (a sliver of a big piece before the side
  // nav), its anchor counting three times, a console's frame once, its buttons ten times.
  const share = (r: Rect, h: Rect) => overlap(r, h) / Math.max(1, h.w * h.h)
  const cost = (p: { x: number; y: number }) => {
    const r = { x: p.x, y: p.y, ...size }
    return (
      hard.reduce((n, h) => n + share(r, h), 0) +
      3 * (i.anchor ? share(r, i.anchor) : 0) +
      firm.reduce((n, h) => n + share(r, h), 0) +
      10 * buttons.reduce((n, h) => n + share(r, h), 0)
    )
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
  const r = { x: best.x, y: best.y, ...size }
  return { placed: { at: 'bottom', x: Math.round(best.x), y: Math.round(best.y), lead: null }, buttons: buttons.some((b) => hits(r, b)) }
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

  const all = [...(i.hard ?? []), ...(i.firm ?? [])]
  const far = (r: Rect) => gapBetween(r, a) > FAR
  // 1. A clear spot on a side, shifted along it if its first spot holds cards. One pushed far from its anchor (past
  // other pieces' consoles) is kept for later: a near spot over those (3) goes first.
  let farClear: { side: Side; r: Rect } | null = null
  for (const side of sides) {
    const r0 = base(side, a, i.size, i.view, gap, m)
    const along = side === 'right' || side === 'left'
    const limit = along ? i.view.h : i.view.w
    for (const d of shifts(limit)) {
      // Shifted along its side first, then out past what it must not cover there (what's only in the way of the first
      // spot, like a corner button low on the screen, mustn't push every shifted spot off the screen).
      const r = pastHard(side, along ? { ...r0, y: r0.y + d } : { ...r0, x: r0.x + d }, all, Math.max(gap, 12))
      if (!fits(r, i, m)) {
        // Off the view this way: further this way won't come back in for the first spot; keep trying the other way.
        continue
      }
      // A shifted card must still face its anchor (a lead can reach it straight).
      if (along ? r.y > a.y + a.h || r.y + r.h < a.y : r.x > a.x + a.w || r.x + r.w < a.x) continue
      if (leadCrosses(leadFor(side, r, a), i.noLead ?? [])) continue
      if (covered(r, soft) === 0) {
        if (!far(r)) return done(side, r)
        farClear ??= { side, r }
        break
      }
    }
  }
  // 2. No clear spot: the side that covers the least, at its first spot.
  let best: { side: Side; r: Rect; n: number } | null = null
  if (!farClear)
    for (const side of sides) {
      const r = pastHard(side, base(side, a, i.size, i.view, gap, m), all, Math.max(gap, 12))
      if (!fits(r, i, m) || leadCrosses(leadFor(side, r, a), i.noLead ?? [])) continue
      const n = covered(r, soft) + (far(r) ? 1e9 : 0)
      if (!best || n < best.n) best = { side, r, n }
    }
  if (best && best.n < 1e9) return done(best.side, best.r)
  // 3. Nothing clear near it: beside it all the same, with its lead, over the least of what it would rather keep clear
  // (another piece's console frame, a lens's cells; cards count less; never a console's buttons), before a far spot or
  // the bottom-middle card.
  const firm = i.firm ?? []
  const buttons = i.noLead ?? []
  // `overButtons`: the last resort, when even the bottom-middle card must cover buttons: the near spot covering the fewest
  // (the card's and its lead's), with its lead.
  const nearPass = (overButtons: boolean) => {
    let near: { side: Side; r: Rect; n: number } | null = null
    for (const side of sides) {
      const r0 = base(side, a, i.size, i.view, gap, m)
      const along = side === 'right' || side === 'left'
      for (const d of shifts(along ? i.view.h : i.view.w)) {
        // Out past what it may never cover here: what's hard, and (but in the last resort) every console's buttons.
        const r = pastHard(side, along ? { ...r0, y: r0.y + d } : { ...r0, x: r0.x + d }, overButtons ? (i.hard ?? []) : [...(i.hard ?? []), ...buttons], Math.max(gap, 12))
        if (!fits(r, i, m, false, !overButtons)) continue
        if (along ? r.y > a.y + a.h || r.y + r.h < a.y : r.x > a.x + a.w || r.x + r.w < a.x) continue
        const crosses = leadCrosses(leadFor(side, r, a), buttons)
        if (crosses && !overButtons) continue
        const pressed = overButtons ? buttons.filter((b) => hits(r, b)).length + (crosses ? 1 : 0) : 0
        const n = 1e6 * pressed + 4 * covered(r, firm) + covered(r, soft) + Math.abs(d) + (far(r) ? 1e9 : 0)
        if (!near || n < near.n) near = { side, r, n }
      }
    }
    return near
  }
  const near = nearPass(false)
  if (near && near.n < 1e9) return done(near.side, near.r)
  if (farClear) return done(farClear.side, farClear.r)
  if (best) return done(best.side, best.r)
  if (near) return done(near.side, near.r)
  // 4. No room beside it: the bottom-middle card, if it finds a spot clear of every console's buttons; else the near
  // spot covering the fewest buttons, with its lead.
  const bottom = bottomSpot(i)
  if (!bottom.buttons) return bottom.placed
  const last = nearPass(true)
  return last ? done(last.side, last.r) : bottom.placed
}
