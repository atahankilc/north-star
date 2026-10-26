// Things selected together on a focused plane (D-227, D-229; the old board's D-108/D-124): cards and text. Shift+click
// puts one in or out, alt+drag on the plane draws a box; two or more are `cardMulti` (one is `cardSelected` or
// `labelSelected`). The selection moves together, nudges with the arrows, copies (⌘C, ⌘V, ⌘D: in this tab), deletes
// with Delete, lets go with Escape.
import { useCanvasView } from '../../state/canvasView'
import { addPackage, type Card } from '../../data/cards'
import type { Edge } from '../../data/edges'
import type { Label } from '../../data/labels'
import { moveMany } from '../../data/labels'
import { snap } from '../../data/grid'
import type { DocumentReference } from 'firebase/firestore'
import { clearGuides, guide, showGuides, useGuides, type Box } from './guides'

// What's on the open plane, kept by its view as it draws: which ids are text, and how to move the selection (each
// with what it carries: a folded card's parts).
export const onPlane: {
  labels: Set<string>
  items: (ids: string[]) => { id: string; ref: DocumentReference; x: number; y: number }[]
  // Every card and text drawn on the plane with its box, for the guides (D-231).
  boxes: () => { id: string; box: Box }[]
  // What these carry: what's folded into them, all the way down (D-225, D-239).
  carried: (ids: string[]) => string[]
} = {
  labels: new Set(),
  items: () => [],
  boxes: () => [],
  carried: () => [],
}

// What lines things up against: everything on the plane but these.
export const othersThan = (ids: Set<string>) =>
  onPlane
    .boxes()
    .filter((b) => !ids.has(b.id))
    .map((b) => b.box)

export function selectedIds(): string[] {
  const { cardMulti, cardSelected, labelSelected } = useCanvasView.getState()
  return cardMulti.length ? cardMulti : cardSelected ? [cardSelected] : labelSelected ? [labelSelected] : []
}

export function setSelection(ids: string[]) {
  const clear = { linkSelected: null, selected: null }
  if (ids.length > 1) return useCanvasView.setState({ cardMulti: ids, cardSelected: null, labelSelected: null, ...clear })
  const one = ids[0] ?? null
  const label = !!one && onPlane.labels.has(one)
  useCanvasView.setState({ cardMulti: [], cardSelected: label ? null : one, labelSelected: label ? one : null, panelShut: null, ...(one ? clear : {}) })
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
// `ids0`: what moves, when it isn't the selection (an unfolded package's band carries its members, D-239).
export function startGroupDrag(e: { clientX: number; clientY: number }, zoom: number, from: { x: number; y: number }, onEnd?: () => void, ids0?: string[]) {
  const items = onPlane.items(ids0 ?? useCanvasView.getState().cardMulti)
  const ids = new Set(items.map((i) => i.id))
  // The selection's box, lined up as one against everything else (D-231).
  const boxes = onPlane.boxes().filter((b) => ids.has(b.id)).map((b) => b.box)
  const whole = boxes.length
    ? (() => {
        const [l, t] = [Math.min(...boxes.map((b) => b.x)), Math.min(...boxes.map((b) => b.y))]
        return { x: l, y: t, w: Math.max(...boxes.map((b) => b.x + b.w)) - l, h: Math.max(...boxes.map((b) => b.y + b.h)) - t }
      })()
    : null
  const others = othersThan(ids)
  const [sx, sy] = [e.clientX, e.clientY]
  let d: [number, number] | null = null
  const move = (ev: PointerEvent) => {
    const [dx, dy] = [ev.clientX - sx, ev.clientY - sy]
    if (!d && Math.hypot(dx, dy) < 5) return
    const free = ev.altKey || !useGuides.getState().snap
    const to = free ? [Math.round(from.x + dx / zoom), Math.round(from.y + dy / zoom)] : [snap(from.x + dx / zoom), snap(from.y + dy / zoom)]
    if (whole) {
      const g = guide({ ...whole, x: whole.x + to[0] - from.x, y: whole.y + to[1] - from.y }, others, zoom, free)
      to[0] += g.dx
      to[1] += g.dy
      showGuides(g.lines)
    }
    d = [to[0] - from.x, to[1] - from.y]
    useCanvasView.setState({ dragShift: { ids: items.map((i) => i.id), dx: d[0], dy: d[1], shrink: true } })
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    onEnd?.()
    clearGuides()
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

// A package of these cards on their plane (D-239), named after how many the workspace has; it shows unfolded, a frame
// round them. Returns its id, to select it.
export function packageThese(wid: string, members: Card[], all: Card[]) {
  const n = all.filter((c) => c.type === 'package').length + 1
  return addPackage(wid, members[0].pieceId, members, [Math.min(...members.map((m) => m.x)), Math.min(...members.map((m) => m.y))], n)
}
