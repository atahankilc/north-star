// Board areas the assistant proposes (D-086, D-125, D-126): the model says which cards go together, the area's name, how
// its cards are laid out, whether it is a section of another area and which area it sits beside; this works out where.
// Each area is a label with its cards (and its sections) under it, ordered so links cross as little as they can. An
// area without a place of its own goes where its links are shortest while the whole stays compact (about ASPECT wide
// to tall, never one long line); a lone area that already has a label stays where it is.
import type { NodeType } from '../data/model'
import { CARD_H, CARD_W } from '../views/canvas/cardLayout'
import { labelHalf } from '../views/canvas/titleBlock'

export const AREA_LAYOUTS = ['columns', 'rows', 'grid', 'line', 'hub'] as const
export type AreaLayout = (typeof AREA_LAYOUTS)[number]
export const AREA_SIDES = ['right', 'left', 'above', 'below'] as const
export type AreaSide = (typeof AREA_SIDES)[number]

const ORDER: NodeType[] = ['customer', 'problem', 'competitor', 'idea', 'feature']
// Room between columns for a link's chip (D-059), and between rows.
const COL_GAP = 1.4
const ROW_GAP = 0.6
// A selected competitor fans its features out to its right (D-058): room for them before the next column.
const FAN_ROOM = 2.6
// Between the bands of a `rows` area, between sections of an area, under an area's name.
const BAND_GAP = 1.1
const SECTION_GAP = 2
const HEAD_GAP = 0.55
// Between areas, and around anything that isn't moving.
const GAP = 3
// Width to height the areas (and sections) are packed to.
const ASPECT = 1.7
const STEP = 0.5

export type Point = { x: number; y: number }

// `id`: an item's id, or the key of one created in the same proposal. `layout`: undefined picks one from the cards.
// `within`: the label of the area this one is a section of. `beside`/`side`: the area it goes next to.
export type AreaPlan = {
  label: string
  items: { id: string; type: NodeType }[]
  layout?: AreaLayout
  within?: string
  beside?: string
  side?: AreaSide
  // Where its label is now: the area is rearranged there rather than moved.
  stay?: Point
}
// Everything on the board that stays where it is; a card's id lets an area go near what it links to.
export type Fixed = { cards: (Point & { id?: string })[]; labels: (Point & { text: string; kind?: string; size?: string })[] }
type Rect = { x0: number; y0: number; x1: number; y1: number }
// `sub`: a section's name, written as a subheading. `areas`: each area's and section's outline and the layout it got.
export type Arranged = {
  labels: (Point & { text: string; sub: boolean })[]
  cards: Map<string, Point>
  areas: (Rect & { label: string; layout?: AreaLayout; sub: boolean })[]
}

type Item = AreaPlan['items'][number]
// A laid-out piece, relative to its top-left corner (y grows upwards on the board, so everything in it is below 0).
type Block = {
  w: number
  h: number
  cards: { id: string; x: number; y: number }[]
  labels: { text: string; sub: boolean; x: number; y: number }[]
  areas: Arranged['areas']
}
const EMPTY: Block = { w: 0, h: 0, cards: [], labels: [], areas: [] }

const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
const cardRect = (p: Point): Rect => ({ x0: p.x - CARD_W / 2, x1: p.x + CARD_W / 2, y0: p.y - CARD_H / 2, y1: p.y + CARD_H / 2 })
const labelRect = (p: Point & { text: string; kind?: string; size?: string }): Rect => {
  const [hw, hh] = labelHalf(p as Parameters<typeof labelHalf>[0])
  return { x0: p.x - hw, x1: p.x + hw, y0: p.y - hh, y1: p.y + hh }
}
const grow = (r: Rect, by: number): Rect => ({ x0: r.x0 - by, x1: r.x1 + by, y0: r.y0 - by, y1: r.y1 + by })
const nameKey = (t: string) => t.trim().toLowerCase()
const cellW = (i: Item) => CARD_W + (i.type === 'competitor' ? FAN_ROOM : 0)
const shift = (b: Block, dx: number, dy: number): Pick<Block, 'cards' | 'labels' | 'areas'> => ({
  cards: b.cards.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy })),
  labels: b.labels.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy })),
  areas: b.areas.map((a) => ({ ...a, x0: a.x0 + dx, x1: a.x1 + dx, y0: a.y0 + dy, y1: a.y1 + dy })),
})

// Cards in a table: each in a column and a row; a column is as wide as its widest card; `bands` adds a gap above those rows.
function table(cells: { item: Item; col: number; row: number }[], bands = new Set<number>()): Block {
  const cols = [...new Set(cells.map((c) => c.col))].sort((a, b) => a - b)
  const widths = cols.map((col) => Math.max(...cells.filter((c) => c.col === col).map((c) => cellW(c.item))))
  const xs = widths.map((_, i) => widths.slice(0, i).reduce((a, b) => a + b + COL_GAP, 0))
  const rowTop = (row: number) => row * (CARD_H + ROW_GAP) + [...bands].filter((b) => b > 0 && b <= row).length * BAND_GAP
  const cards = cells.map((c) => ({ id: c.item.id, x: xs[cols.indexOf(c.col)] + CARD_W / 2, y: -rowTop(c.row) - CARD_H / 2 }))
  const last = widths.length - 1
  // The last column needs no room after it unless its competitor fans out.
  const w = xs[last] + widths[last]
  const h = Math.max(...cells.map((c) => rowTop(c.row))) + CARD_H
  return { w, h, cards, labels: [], areas: [] }
}

// One column per type in the chain's order (D-045). The cards in each column are ordered by where the cards they link to
// sit (sweeping forwards and back a few times, so links cross as little as they can), then each sits level with the
// cards it links to in earlier columns.
function columns(items: Item[], links: Map<string, Set<string>>): Block {
  const cols = ORDER.map((t) => items.filter((i) => i.type === t)).filter((c) => c.length)
  const colOf = new Map(cols.flatMap((c, ci) => c.map((i) => [i.id, ci] as const)))
  const at = new Map<string, number>()
  const index = () => cols.forEach((c) => c.forEach((i, k) => at.set(i.id, k)))
  index()
  // Mean place of a card's links in the columns `side` of it; a card with none keeps its place.
  const sortBy = (ci: number, side: (other: number) => boolean) => {
    const key = new Map(
      cols[ci].map((i) => {
        const ks = [...(links.get(i.id) ?? [])].filter((n) => colOf.has(n) && side(colOf.get(n)!)).map((n) => at.get(n)!)
        return [i.id, ks.length ? ks.reduce((a, b) => a + b, 0) / ks.length : at.get(i.id)!] as const
      }),
    )
    cols[ci].sort((a, b) => key.get(a.id)! - key.get(b.id)! || at.get(a.id)! - at.get(b.id)!)
    index()
  }
  for (let pass = 0; pass < 4; pass++) {
    for (let ci = 1; ci < cols.length; ci++) sortBy(ci, (o) => o < ci)
    for (let ci = cols.length - 2; ci >= 0; ci--) sortBy(ci, (o) => o > ci)
  }
  const rowOf = new Map<string, number>()
  const cells: { item: Item; col: number; row: number }[] = []
  cols.forEach((col, ci) => {
    let next = 0
    for (const item of col) {
      const rows = [...(links.get(item.id) ?? [])].map((n) => rowOf.get(n)).filter((r): r is number => r !== undefined)
      const want = rows.length ? Math.round(rows.reduce((a, b) => a + b, 0) / rows.length) : next
      const row = Math.max(next, want)
      rowOf.set(item.id, row)
      cells.push({ item, col: ci, row })
      next = row + 1
    }
  })
  return table(cells)
}

// One band per lead card (each problem; else each customer, competitor or idea), its linked cards beside it in the
// chain's columns, like the Flow view (D-040); cards linked to no lead in a last band.
function rows(items: Item[], links: Map<string, Set<string>>): Block {
  const leadType = (['problem', 'customer', 'competitor', 'idea'] as NodeType[]).find((t) => items.filter((i) => i.type === t).length >= 2)
  if (!leadType) return columns(items, links)
  const leads = items.filter((i) => i.type === leadType)
  const inArea = new Set(items.map((i) => i.id))
  // Each card goes to the lead nearest it over links (within the area), the first lead on a tie.
  const owner = new Map<string, string>(leads.map((l) => [l.id, l.id]))
  let front = leads.map((l) => l.id)
  while (front.length) {
    const next: string[] = []
    for (const id of front) {
      for (const n of links.get(id) ?? []) {
        if (!inArea.has(n) || owner.has(n)) continue
        owner.set(n, owner.get(id)!)
        next.push(n)
      }
    }
    front = next
  }
  const types = ORDER.filter((t) => items.some((i) => i.type === t))
  const groups = [...leads.map((l) => items.filter((i) => owner.get(i.id) === l.id)), items.filter((i) => !owner.has(i.id))].filter((g) => g.length)
  const cells: { item: Item; col: number; row: number }[] = []
  const bands = new Set<number>()
  let top = 0
  for (const g of groups) {
    bands.add(top)
    let tall = 1
    types.forEach((t, col) => {
      const stack = g.filter((i) => i.type === t)
      stack.forEach((item, k) => cells.push({ item, col, row: top + k }))
      tall = Math.max(tall, stack.length)
    })
    top += tall
  }
  return table(cells, bands)
}

// In the given order, row by row, about as wide as ASPECT says.
function grid(items: Item[]): Block {
  const fit = Math.ceil(Math.sqrt((items.length * ASPECT * (CARD_H + ROW_GAP)) / (CARD_W + COL_GAP)))
  const n = Math.max(1, Math.min(items.length, fit))
  return table(items.map((item, i) => ({ item, col: i % n, row: Math.floor(i / n) })))
}

// In the given order, left to right: a journey, steps, a timeline.
const line = (items: Item[]): Block => table(items.map((item, i) => ({ item, col: i, row: 0 })))

// The first card in the middle, the others around it on an oval, starting on its left.
function hub(items: Item[]): Block {
  const [centre, ...ring] = items
  if (!ring.length) return line(items)
  const clear = (a: Point, b: Point) => Math.abs(a.x - b.x) >= CARD_W + COL_GAP * 0.7 || Math.abs(a.y - b.y) >= CARD_H + ROW_GAP
  let pts: Point[] = []
  for (let ry = CARD_H + ROW_GAP + 0.4; ry < 60; ry *= 1.08) {
    const rx = Math.max(CARD_W + COL_GAP, ry * 2.1)
    pts = ring.map((_, i) => {
      const a = Math.PI + (2 * Math.PI * i) / ring.length
      return { x: rx * Math.cos(a), y: -ry * Math.sin(a) }
    })
    const all = [{ x: 0, y: 0 }, ...pts]
    if (all.every((a, i) => all.every((b, j) => j <= i || clear(a, b)))) break
  }
  const all = [{ id: centre.id, x: 0, y: 0 }, ...ring.map((it, i) => ({ id: it.id, ...pts[i] }))]
  const x0 = Math.min(...all.map((p) => p.x)) - CARD_W / 2
  const y1 = Math.max(...all.map((p) => p.y)) + CARD_H / 2
  const w = Math.max(...all.map((p) => p.x)) + CARD_W / 2 - x0
  const h = y1 - (Math.min(...all.map((p) => p.y)) - CARD_H / 2)
  return { w, h, cards: all.map((p) => ({ id: p.id, x: p.x - x0, y: p.y - y1 })), labels: [], areas: [] }
}

// When the model leaves it open: one kind of card → a grid (a line if few); several problems → their bands; else columns.
function pick(items: Item[]): AreaLayout {
  const types = new Set(items.map((i) => i.type))
  if (types.size === 1) return items.length <= 4 ? 'line' : 'grid'
  if (items.filter((i) => i.type === 'problem').length >= 2) return 'rows'
  return 'columns'
}

function content(layout: AreaLayout, plan: AreaPlan, links: Map<string, Set<string>>): Block {
  if (layout === 'rows') return rows(plan.items, links)
  if (layout === 'grid') return grid(plan.items)
  if (layout === 'line') return line(plan.items)
  if (layout === 'hub') return hub(plan.items)
  return columns(plan.items, links)
}

// Blocks in rows, left to right, wrapping so the whole comes out about ASPECT wide to tall; each row top-aligned.
function pack(blocks: Block[], gap: number): Block {
  const area = blocks.reduce((a, b) => a + (b.w + gap) * (b.h + gap), 0)
  const width = Math.max(...blocks.map((b) => b.w), Math.sqrt(area * ASPECT))
  const out: Block = { ...EMPTY, cards: [], labels: [], areas: [] }
  let x = 0
  let y = 0
  let tall = 0
  for (const b of blocks) {
    if (x > 0 && x + b.w > width) {
      x = 0
      y += tall + gap
      tall = 0
    }
    const moved = shift(b, x, -y)
    out.cards.push(...moved.cards)
    out.labels.push(...moved.labels)
    out.areas.push(...moved.areas)
    out.w = Math.max(out.w, x + b.w)
    out.h = Math.max(out.h, y + b.h)
    tall = Math.max(tall, b.h)
    x += b.w + gap
  }
  return out
}

// An area: its name over its own cards and its sections, packed together; the name centred over all of it.
function areaBlock(plan: AreaPlan, sections: Map<string, AreaPlan[]>, links: Map<string, Set<string>>, sub: boolean, seen: Set<string>): Block {
  seen.add(nameKey(plan.label))
  const parts: Block[] = []
  const layout = plan.items.length ? (plan.layout ?? pick(plan.items)) : undefined
  if (layout) parts.push(content(layout, plan, links))
  for (const s of sections.get(nameKey(plan.label)) ?? []) {
    if (!seen.has(nameKey(s.label))) parts.push(areaBlock(s, sections, links, true, seen))
  }
  const body: Block = parts.length > 1 ? pack(parts, SECTION_GAP) : (parts[0] ?? EMPTY)
  const [hw, hh] = labelHalf({ text: plan.label, size: sub ? 'subheading' : 'heading' })
  const w = Math.max(body.w, 2 * hw)
  const head = 2 * hh + HEAD_GAP
  const moved = shift(body, (w - body.w) / 2, -head)
  return {
    w,
    h: head + body.h,
    cards: moved.cards,
    labels: [{ text: plan.label, sub, x: w / 2, y: -hh }, ...moved.labels],
    areas: [{ label: plan.label, layout, sub, x0: 0, x1: w, y0: -(head + body.h), y1: 0 }, ...moved.areas],
  }
}

// `everything`: every card's current position, moving or not, to find the board's top-left corner.
// `links`: pairs of linked cards (ids or keys), a competitor standing in for its features.
export function arrangeAreas(areas: AreaPlan[], fixed: Fixed, everything: Point[], links: [string, string][] = []): Arranged {
  const near = new Map<string, Set<string>>()
  for (const [a, b] of links) {
    if (a === b) continue
    near.set(a, (near.get(a) ?? new Set()).add(b))
    near.set(b, (near.get(b) ?? new Set()).add(a))
  }
  // Sections go inside their area; one naming an area that isn't here (or itself) is an area of its own.
  const names = new Set(areas.map((a) => nameKey(a.label)))
  const isSection = (a: AreaPlan) => !!a.within && names.has(nameKey(a.within)) && nameKey(a.within) !== nameKey(a.label)
  const sections = new Map<string, AreaPlan[]>()
  for (const a of areas.filter(isSection)) sections.set(nameKey(a.within!), [...(sections.get(nameKey(a.within!)) ?? []), a])
  const seen = new Set<string>()
  const tops = areas.filter((a) => !isSection(a)).map((a) => ({ plan: a, block: areaBlock(a, sections, near, false, seen) }))
  // Sections in a loop (each within the other) never reach a top-level area: lay them out on their own.
  for (const a of areas) if (!seen.has(nameKey(a.label))) tops.push({ plan: a, block: areaBlock({ ...a, within: undefined }, sections, near, false, seen) })

  const taken: Rect[] = [...fixed.cards.map(cardRect), ...fixed.labels.map(labelRect)].map((r) => grow(r, GAP / 2))
  const all = [...everything.map(cardRect), ...fixed.labels.map(labelRect)]
  const left = all.length ? Math.min(...all.map((r) => r.x0)) : 0
  const top = all.length ? Math.max(...all.map((r) => r.y1)) : 0
  const area = tops.reduce((s, t) => s + (t.block.w + GAP) * (t.block.h + GAP), 0)
  const maxRight = left + Math.max(...tops.map((t) => t.block.w), Math.sqrt(area * ASPECT))
  const rectAt = (b: Block, at: Point): Rect => ({ x0: at.x, x1: at.x + b.w, y0: at.y - b.h, y1: at.y })
  const free = (r: Rect) => !taken.some((t) => overlaps(t, r))

  const out: Arranged = { labels: [], cards: new Map(), areas: [] }
  const placed = new Map<string, Rect>()
  // Where each card is so far: the ones staying, then each area's as it is placed.
  const where = new Map<string, Point>()
  for (const c of fixed.cards) if (c.id) where.set(c.id, c)
  let box: Rect | undefined
  const put = (plan: AreaPlan, b: Block, at: Point) => {
    const moved = shift(b, at.x, at.y)
    for (const c of moved.cards) {
      out.cards.set(c.id, { x: c.x, y: c.y })
      where.set(c.id, c)
    }
    out.labels.push(...moved.labels)
    out.areas.push(...moved.areas)
    const r = rectAt(b, at)
    placed.set(nameKey(plan.label), r)
    taken.push(grow(r, GAP))
    box = box ? { x0: Math.min(box.x0, r.x0), x1: Math.max(box.x1, r.x1), y0: Math.min(box.y0, r.y0), y1: Math.max(box.y1, r.y1) } : r
  }
  // First spot, row by row from the top-left, where the whole area fits.
  const auto = (b: Block): Point => {
    for (let y = top; y > top - 600; y -= STEP) {
      for (let x = left; x + b.w <= Math.max(maxRight, left + b.w); x += STEP) {
        if (free(rectAt(b, { x, y }))) return { x, y }
      }
    }
    return { x: left, y: top }
  }
  // Next to something: level with it (or under its left edge), sliding further out until clear.
  const besideOf = (b: Block, r: Rect, side: AreaSide): Point => {
    const start: Point =
      side === 'left' ? { x: r.x0 - GAP - b.w, y: r.y1 } : side === 'above' ? { x: r.x0, y: r.y1 + GAP + b.h } : side === 'below' ? { x: r.x0, y: r.y0 - GAP } : { x: r.x1 + GAP, y: r.y1 }
    const [dx, dy] = side === 'left' ? [-STEP, 0] : side === 'above' ? [0, STEP] : side === 'below' ? [0, -STEP] : [STEP, 0]
    for (let i = 0; i < 800; i++) {
      const at = { x: start.x + dx * i, y: start.y + dy * i }
      if (free(rectAt(b, at))) return at
    }
    return start
  }
  // The free spot nearest `at`, ring by ring.
  const nearestFree = (b: Block, at: Point): Point => {
    for (let ring = 0; ring < 120; ring++) {
      let best: Point | undefined
      for (let i = -ring; i <= ring; i++) {
        for (const [dx, dy] of [[i, -ring], [i, ring], [-ring, i], [ring, i]]) {
          const p = { x: at.x + dx * STEP, y: at.y + dy * STEP }
          if (free(rectAt(b, p)) && (!best || Math.hypot(p.x - at.x, p.y - at.y) < Math.hypot(best.x - at.x, best.y - at.y))) best = p
        }
      }
      if (best) return best
    }
    return auto(b)
  }
  // How good a spot is (lower is better): its links short, the whole still compact and about ASPECT wide to tall, and
  // nothing pushed above or left of where the board starts.
  const cost = (b: Block, at: Point): number => {
    const own = new Set(b.cards.map((c) => c.id))
    let reach = 0
    for (const c of b.cards) {
      for (const n of near.get(c.id) ?? []) {
        const q = where.get(n)
        if (q && !own.has(n)) reach += Math.min(40, Math.hypot(c.x + at.x - q.x, c.y + at.y - q.y))
      }
    }
    const r = rectAt(b, at)
    const u = box ? { x0: Math.min(box.x0, r.x0), x1: Math.max(box.x1, r.x1), y0: Math.min(box.y0, r.y0), y1: Math.max(box.y1, r.y1) } : r
    const w = u.x1 - u.x0
    const h = u.y1 - u.y0
    const spread = w + h + Math.abs(Math.log(w / h / ASPECT)) * (w + h) * 0.5
    const outside = Math.max(0, r.y1 - top) + Math.max(0, left - r.x0)
    return reach * 0.7 + spread + outside * 2
  }
  // An area with no place of its own: the best of the first free spot and every side of each placed area and of the
  // staying cards it links to.
  const best = (b: Block): Point => {
    const spots = [auto(b)]
    for (const r of placed.values()) for (const side of AREA_SIDES) spots.push(besideOf(b, r, side))
    const own = new Set(b.cards.map((c) => c.id))
    const anchors = new Set<string>()
    for (const c of b.cards) for (const n of near.get(c.id) ?? []) if (!own.has(n) && fixed.cards.some((f) => f.id === n)) anchors.add(n)
    for (const id of [...anchors].slice(0, 6)) for (const side of AREA_SIDES) spots.push(besideOf(b, grow(cardRect(where.get(id)!), 0.5), side))
    let pick = spots[0]
    let low = cost(b, pick)
    for (const p of spots.slice(1)) {
      const c = cost(b, p)
      if (c < low - 0.01) [pick, low] = [p, c]
    }
    return pick
  }
  // A lone area that has a label already is rearranged where it is: its label stays put, the cards go under it.
  const placeOf = (t: (typeof tops)[number]): Point => {
    if (!t.plan.stay) return best(t.block)
    const head = t.block.labels[0]
    return nearestFree(t.block, { x: t.plan.stay.x - head.x, y: t.plan.stay.y - head.y })
  }

  // In order; an area beside another waits for that one, then takes its spot before the areas after it.
  const besides = (t: (typeof tops)[number]) => !!t.plan.beside && names.has(nameKey(t.plan.beside)) && nameKey(t.plan.beside) !== nameKey(t.plan.label)
  let waiting: typeof tops = []
  const flush = () => {
    for (let ready = waiting.find((t) => placed.has(nameKey(t.plan.beside!))); ready; ready = waiting.find((t) => placed.has(nameKey(t.plan.beside!)))) {
      put(ready.plan, ready.block, besideOf(ready.block, placed.get(nameKey(ready.plan.beside!))!, ready.plan.side ?? 'right'))
      waiting = waiting.filter((t) => t !== ready)
    }
  }
  for (const t of tops) {
    if (besides(t) && !placed.has(nameKey(t.plan.beside!))) waiting.push(t)
    else put(t.plan, t.block, besides(t) ? besideOf(t.block, placed.get(nameKey(t.plan.beside!))!, t.plan.side ?? 'right') : placeOf(t))
    flush()
  }
  // Beside an area that is itself a section, or in a loop: find room instead.
  while (waiting.length) {
    const t = waiting.shift()!
    put(t.plan, t.block, placeOf(t))
    flush()
  }
  return out
}
