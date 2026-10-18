// Board areas the assistant proposes (D-086): the model says which cards go together and the area's name; this works
// out where. Each area is a label with its cards under it, one column per type in the chain's order (D-045), and the
// areas line up left to right from the board's top-left corner, wrapping below, wherever nothing else is in the way.
import type { NodeType } from '../data/model'
import { LABEL_SIZE } from '../views/canvas/BoardLabel'
import { CARD_H, CARD_W } from '../views/canvas/cardLayout'
import { titleHalf } from '../views/canvas/titleBlock'

const ORDER: NodeType[] = ['customer', 'problem', 'competitor', 'idea', 'feature']
const COL_GAP = 0.8
// A selected competitor fans its features out to its right (D-058): room for them before the next column.
const FAN_ROOM = 2.6
const ROW_H = CARD_H + 0.45
// From the label's centre down to the first row's centre.
const LABEL_DROP = 1.5
// Between areas, and around anything that isn't moving.
const GAP = 2
const STEP = 0.5

type Rect = { x0: number; y0: number; x1: number; y1: number }
export type Point = { x: number; y: number }

// `id`: an item's id, or the key of one created in the same proposal.
export type AreaPlan = { label: string; items: { id: string; type: NodeType }[] }
// Everything on the board that stays where it is.
export type Fixed = { cards: Point[]; labels: (Point & { text: string; kind?: string })[] }

export type Arranged = { labels: (Point & { text: string })[]; cards: Map<string, Point> }

const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
const cardRect = (p: Point): Rect => ({ x0: p.x - CARD_W / 2, x1: p.x + CARD_W / 2, y0: p.y - CARD_H / 2, y1: p.y + CARD_H / 2 })
// Label text is about 0.55 of its size wide per character.
const labelRect = (p: Point & { text: string; kind?: string }): Rect => {
  if (p.kind === 'title') {
    // The title block (D-118) is far bigger than its (empty) text.
    const [hw, hh] = titleHalf()
    return { x0: p.x - hw, x1: p.x + hw, y0: p.y - hh, y1: p.y + hh }
  }
  const w = Math.max(1, p.text.length * LABEL_SIZE * 0.55)
  return { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - LABEL_SIZE / 2, y1: p.y + LABEL_SIZE / 2 }
}
const grow = (r: Rect, by: number): Rect => ({ x0: r.x0 - by, x1: r.x1 + by, y0: r.y0 - by, y1: r.y1 + by })

// `everything`: every card's current position, moving or not, to find the board's top-left corner.
export function arrangeAreas(areas: AreaPlan[], fixed: Fixed, everything: Point[]): Arranged {
  const taken: Rect[] = [...fixed.cards.map(cardRect), ...fixed.labels.map(labelRect)].map((r) => grow(r, GAP / 2))
  const all = [...everything.map(cardRect), ...fixed.labels.map(labelRect)]
  const left = all.length ? Math.min(...all.map((r) => r.x0)) : 0
  const top = all.length ? Math.max(...all.map((r) => r.y1)) : 0
  const right = all.length ? Math.max(...all.map((r) => r.x1)) : 0
  // Areas wrap to a new row past the board's width, or 40 units if it's narrower.
  const maxRight = left + Math.max(40, right - left)

  const out: Arranged = { labels: [], cards: new Map() }
  for (const area of areas) {
    const columns = ORDER.map((t) => area.items.filter((i) => i.type === t)).filter((c) => c.length)
    const widths = columns.map((c) => CARD_W + (c[0].type === 'competitor' ? FAN_ROOM : 0))
    const w = widths.reduce((a, b) => a + b, 0) + COL_GAP * (columns.length - 1)
    const rows = Math.max(1, ...columns.map((c) => c.length))
    const h = LABEL_SIZE / 2 + LABEL_DROP + (rows - 1) * ROW_H + CARD_H / 2

    // First spot, row by row from the top-left, where the whole area fits.
    let at: Point = { x: left, y: top }
    search: for (let y = top; y > top - 400; y -= STEP) {
      for (let x = left; x + w <= Math.max(maxRight, left + w); x += STEP) {
        const r = { x0: x, x1: x + w, y0: y - h, y1: y }
        if (!taken.some((t) => overlaps(t, r))) {
          at = { x, y }
          break search
        }
      }
    }

    const labelY = at.y - LABEL_SIZE / 2
    const label = { text: area.label, x: at.x + w / 2, y: labelY }
    out.labels.push(label)
    let x = at.x
    columns.forEach((col, i) => {
      col.forEach((item, row) => out.cards.set(item.id, { x: x + CARD_W / 2, y: labelY - LABEL_DROP - row * ROW_H }))
      x += widths[i] + COL_GAP
    })
    taken.push(grow({ x0: at.x, x1: at.x + w, y0: at.y - h, y1: at.y }, GAP))
  }
  return out
}
