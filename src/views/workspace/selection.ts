// Things selected together on a focused plane (D-227, D-229; the old board's D-108/D-124): cards and text. Shift+click
// puts one in or out, alt+drag on the plane draws a box; two or more are `cardMulti` (one is `cardSelected` or
// `labelSelected`). The selection moves together, nudges with the arrows, copies (⌘C, ⌘V, ⌘D: in this tab), deletes
// with Delete, lets go with Escape.
import { useCanvasView } from '../../state/canvasView'
import type { Card } from '../../data/cards'
import type { Edge } from '../../data/edges'
import type { Label } from '../../data/labels'
import { moveMany } from '../../data/labels'
import { snap } from '../../data/grid'
import type { DocumentReference } from 'firebase/firestore'

// What's on the open plane, kept by its view as it draws: which ids are text, and how to move the selection (each
// with what it carries: a folded card's parts).
export const onPlane: { labels: Set<string>; items: (ids: string[]) => { id: string; ref: DocumentReference; x: number; y: number }[] } = {
  labels: new Set(),
  items: () => [],
}

export function selectedIds(): string[] {
  const { cardMulti, cardSelected, labelSelected } = useCanvasView.getState()
  return cardMulti.length ? cardMulti : cardSelected ? [cardSelected] : labelSelected ? [labelSelected] : []
}

export function setSelection(ids: string[]) {
  const clear = { linkSelected: null, selected: null }
  if (ids.length > 1) return useCanvasView.setState({ cardMulti: ids, cardSelected: null, labelSelected: null, ...clear })
  const one = ids[0] ?? null
  const label = !!one && onPlane.labels.has(one)
  useCanvasView.setState({ cardMulti: [], cardSelected: label ? null : one, labelSelected: label ? one : null, ...(one ? clear : {}) })
}

// Shift+click: in or out.
export function toggleSelected(id: string) {
  const now = selectedIds()
  setSelection(now.includes(id) ? now.filter((x) => x !== id) : [...now, id])
}

// Let go where they are: held at `to` until their data says so (each item clears its own when it arrives).
export function land(moves: { id: string; to: [number, number] }[]) {
  useCanvasView.setState((s) => ({ landing: { ...s.landing, ...Object.fromEntries(moves.map((m) => [m.id, m.to])) }, dragShift: null }))
}
export function landed(id: string) {
  useCanvasView.setState((s) => {
    const { [id]: _, ...rest } = s.landing
    return { landing: rest }
  })
}

// A press on something selected with others: they all follow the pointer by the same snapped step (alt: free), each
// 0.8 round its middle while carried; let go, they move in one undo step and stay where they were let go.
export function startGroupDrag(e: { clientX: number; clientY: number }, zoom: number, from: { x: number; y: number }, onEnd?: () => void) {
  const items = onPlane.items(useCanvasView.getState().cardMulti)
  const [sx, sy] = [e.clientX, e.clientY]
  let d: [number, number] | null = null
  const move = (ev: PointerEvent) => {
    const [dx, dy] = [ev.clientX - sx, ev.clientY - sy]
    if (!d && Math.hypot(dx, dy) < 5) return
    const to = ev.altKey ? [Math.round(from.x + dx / zoom), Math.round(from.y + dy / zoom)] : [snap(from.x + dx / zoom), snap(from.y + dy / zoom)]
    d = [to[0] - from.x, to[1] - from.y]
    useCanvasView.setState({ dragShift: { ids: items.map((i) => i.id), dx: d[0], dy: d[1], shrink: true } })
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    onEnd?.()
    if (!d || (!d[0] && !d[1])) return useCanvasView.setState({ dragShift: null })
    const [dx, dy] = d
    land(items.map((i) => ({ id: i.id, to: [i.x + dx, i.y + dy] })))
    void moveMany(
      `move ${items.length} things`,
      items.map((i) => ({ ref: i.ref, from: { x: i.x, y: i.y }, to: { x: i.x + dx, y: i.y + dy } })),
    ).catch(() => items.forEach((i) => landed(i.id)))
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

// The tab's clipboard: what was copied, and how many times it's been pasted (each paste lands a step further).
export const clipboard: { cards: Card[]; labels: Label[]; edges: Edge[]; pasted: number } = { cards: [], labels: [], edges: [], pasted: 0 }
