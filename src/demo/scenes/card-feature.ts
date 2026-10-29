// The kind guide's `feature` row, in a plane (onboarding-lessons.md §2): a plane in focus with an idea on it, no HUD. A
// feature appears beside it (shown with set()), its `inspired by` link to the idea; then its parts come (two smaller
// features, part of it) and it folds them in as a small tree inside it.
import type { Edge } from '../../data/edges'
import { camera, set, wait, type Scene } from '../director'
import { AWAY, frameTo, PLANE_K, arrive, bare, base, focusRoute, moved, smallPlane } from '../fixtures/kit'

const feature = moved('f-pickup', PLANE_K, 300, 50)
const parts = [
  { ...moved('f-pickup', PLANE_K, 300, 200), id: 'f-cutoff', title: 'Order cut-off at 9 pm', status: 'shipped' },
  { ...moved('f-pickup', PLANE_K, 525, 200), id: 'f-slot', title: 'Pickup slot at checkout', status: 'building' },
]
const partOf = (id: string): Edge => ({ id: `po-${id}`, fromId: id, fromType: 'feature', toId: feature.id, toType: 'feature', kind: 'part-of' })

const scene: Scene = {
  id: 'card-feature',
  fixture: smallPlane([moved('i-preorder', PLANE_K, 0, 50)]),
  view: 'focus',
  route: focusRoute(),
  size: [480, 300],
  length: 4000,
  poster: 3900,
  cursor: AWAY,
  setup: [bare('card-feature'), camera.frame({ x: -25, y: 0, w: 775, h: 325 }, 12)],
  steps: [
    { at: 400, do: arrive(feature) },
    { at: 1100, do: set((ws) => ({ ...ws, edges: [...ws.edges, ...base.edges.filter((e) => e.id === 'e-14')] }), 'inspired by the idea') },
    { at: 1700, do: set((ws) => ({ ...ws, cards: [...ws.cards, ...parts], edges: [...ws.edges, ...parts.map((p) => partOf(p.id))] }), 'its parts') },
    { at: 2700, do: set((ws) => ({ ...ws, cards: ws.cards.map((c) => (c.id === feature.id ? { ...c, folded: true } : c)) }), 'folded in') },
    { do: frameTo({ x: -25, y: 0, w: 575, h: 225 }, 700) },
    { do: wait(600) },
  ],
}
export default scene
