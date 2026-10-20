// The box round what's in a space (D-187, D-188): a plane's cards and text, or the canvas's planes and text. Fit frames it;
// a plane on the canvas shows it fitted inside itself. null when there's nothing.
import { CARD, type Card } from '../../data/cards'
import type { Label } from '../../data/labels'
import type { Bounds } from '../../state/canvasView'
import { labelBox } from './TextItems'

export function spaceBounds(cards: Card[], labels: Label[], more: Bounds[] = []): Bounds | null {
  const boxes = [...cards.map((c) => ({ x: c.x, y: c.y, w: CARD.w, h: CARD.h })), ...labels.map(labelBox), ...more]
  if (!boxes.length) return null
  const x0 = Math.min(...boxes.map((b) => b.x))
  const y0 = Math.min(...boxes.map((b) => b.y))
  const x1 = Math.max(...boxes.map((b) => b.x + b.w))
  const y1 = Math.max(...boxes.map((b) => b.y + b.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}
