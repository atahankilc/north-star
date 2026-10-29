// A space (the canvas or a plane) as the person reads it: its sections, each holding what lies wholly inside it, and
// everything in reading order (top to bottom, then left to right). The map and `view` both list a space this way.
import { CARD, type Card } from '../../model/cards'
import { CANVAS, kindOf, type Label } from '../../model/labels'
import { labelBox } from '../../model/labelBox'
import { inside, piecesShown, type Box } from '../../model/textPlace'
import { canvasOf } from '../../model/canvases'
import { derive, type P } from './derive'
import type { ReadWs } from './types'

export type Node =
  | { kind: 'section'; label: Label; box: Box; children: Node[] }
  | { kind: 'card'; card: Card; box: Box }
  | { kind: 'text'; label: Label; box: Box }
  | { kind: 'piece'; piece: P; box: Box }

const area = (b: Box) => b.w * b.h
const reading = (a: Node, b: Node) => a.box.y - b.box.y || a.box.x - b.box.x

function tree(items: Node[]): Node[] {
  const sections = items.filter((n): n is Extract<Node, { kind: 'section' }> => n.kind === 'section')
  // Each thing goes into the smallest section wholly round it.
  const parent = new Map<Node, Extract<Node, { kind: 'section' }>>()
  for (const n of items) {
    let best: Extract<Node, { kind: 'section' }> | undefined
    for (const s of sections) if (s !== n && inside(n.box, s.box) && (!best || area(s.box) < area(best.box)) && !(n.kind === 'section' && area(s.box) <= area(n.box))) best = s
    if (best) parent.set(n, best)
  }
  for (const s of sections) s.children = items.filter((n) => parent.get(n) === s).sort(reading)
  return items.filter((n) => !parent.has(n)).sort(reading)
}

// A plane: its cards (each at its spot there, folded parts and package contents inside their card left out) and text.
export function planeNodes(ws: ReadWs, plane: string): Node[] {
  const d = derive(ws)
  const cards = (d.onPlane.get(plane) ?? []).filter((c) => !d.folds.hidden.has(c.id))
  const items: Node[] = [
    ...cards.map((c): Node => ({ kind: 'card', card: c, box: { x: c.x, y: c.y, w: CARD.w, h: CARD.h } })),
    ...ws.labels.filter((l) => l.pieceId === plane).map((l): Node => (kindOf(l) === 'section' ? { kind: 'section', label: l, box: labelBox(l), children: [] } : { kind: 'text', label: l, box: labelBox(l) })),
  ]
  return tree(items)
}

// A canvas: its pieces (at their spot there) and its own text.
export function canvasNodes(ws: ReadWs, canvas: string): Node[] {
  const items: Node[] = [
    ...piecesShown(canvas, ws.pieces, ws.spots).map((p): Node => ({ kind: 'piece', piece: p, box: { x: p.x, y: p.y, w: p.w, h: p.h } })),
    ...ws.labels
      .filter((l) => l.pieceId === CANVAS && canvasOf(l) === canvas)
      .map((l): Node => (kindOf(l) === 'section' ? { kind: 'section', label: l, box: labelBox(l), children: [] } : { kind: 'text', label: l, box: labelBox(l) })),
  ]
  return tree(items)
}

// Every node, depth first, with how deep it sits.
export function flatten(nodes: Node[], depth = 0, out: { node: Node; depth: number }[] = []) {
  for (const n of nodes) {
    out.push({ node: n, depth })
    if (n.kind === 'section') flatten(n.children, depth + 1, out)
  }
  return out
}
