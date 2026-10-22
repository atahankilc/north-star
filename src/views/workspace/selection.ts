// Cards selected together on a focused plane (D-227, the old board's D-108/D-124): shift+click adds or takes one away,
// alt+drag on the plane draws a box; two or more are `cardMulti` (one is `cardSelected`). The selection moves
// together, nudges with the arrows, copies (⌘C, ⌘V, ⌘D: in this tab), deletes with Delete, lets go with Escape.
import { useCanvasView } from '../../state/canvasView'
import type { Card } from '../../data/cards'
import type { Edge } from '../../data/edges'

export function selectedIds(): string[] {
  const { cardMulti, cardSelected } = useCanvasView.getState()
  return cardMulti.length ? cardMulti : cardSelected ? [cardSelected] : []
}

export function setSelection(ids: string[]) {
  const clear = { labelSelected: null, linkSelected: null, selected: null }
  if (ids.length > 1) useCanvasView.setState({ cardMulti: ids, cardSelected: null, ...clear })
  else useCanvasView.setState({ cardMulti: [], cardSelected: ids[0] ?? null, ...(ids.length ? clear : {}) })
}

// Shift+click: in or out.
export function toggleSelected(id: string) {
  const now = selectedIds()
  setSelection(now.includes(id) ? now.filter((x) => x !== id) : [...now, id])
}

// The tab's clipboard: what was copied, and how many times it's been pasted (each paste lands a step further).
export const clipboard: { cards: Card[]; edges: Edge[]; pasted: number } = { cards: [], edges: [], pasted: 0 }
