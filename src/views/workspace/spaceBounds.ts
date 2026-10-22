// The box round what's in a space (D-187, D-188): a plane's cards and text, or the canvas's planes and text. Fit frames it;
// a plane on the canvas shows it fitted inside itself. null when there's nothing.
// Cards are measured as they're drawn: a folded card's insides are in it (taller, its rows), not where they were left,
// and an unfolded package is the frame round its members, not its own spot. A plane's filter (D-233) leaves out what
// it hides.
import { CARD, type Card } from '../../data/cards'
import type { Edge } from '../../data/edges'
import type { Label } from '../../data/labels'
import type { Bounds } from '../../state/canvasView'
import { keep, filterOf } from './planeFilter'
import { foldedHeight, foldsOf, packageBox, type Box } from './cardInside'
import { labelBox } from './TextItems'

function cardBoxes(cards: Card[], edges: Edge[], kept: Set<string> | null): Box[] {
  const folds = foldsOf(cards, edges)
  const shows = (c: Card) => !folds.hidden.has(c.id) && (!kept || kept.has(c.id))
  const boxOf = (c: Card, depth = 0): Box | null => {
    if (c.type === 'package' && !c.folded && depth < 8) {
      const framed = packageBox((folds.members.get(c.id) ?? []).filter(shows).flatMap((m) => boxOf(m, depth + 1) ?? []))
      if (framed) return framed
    }
    const rows = folds.rows.get(c.id)
    return { x: c.x, y: c.y, w: CARD.w, h: rows ? foldedHeight(rows.length) : CARD.h }
  }
  return cards.filter(shows).flatMap((c) => boxOf(c) ?? [])
}

export function spaceBounds(cards: Card[], edges: Edge[], labels: Label[], more: Bounds[] = [], plane?: string): Bounds | null {
  const kept = plane ? keep(cards, edges, filterOf(plane)) : null
  const boxes = [...cardBoxes(cards, edges, kept), ...labels.map(labelBox), ...more]
  if (!boxes.length) return null
  const x0 = Math.min(...boxes.map((b) => b.x))
  const y0 = Math.min(...boxes.map((b) => b.y))
  const x1 = Math.max(...boxes.map((b) => b.x + b.w))
  const y1 = Math.max(...boxes.map((b) => b.y + b.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}
