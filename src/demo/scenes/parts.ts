// `parts` (onboarding-lessons.md §3), "Parts fold inside": 02 Product in focus, no HUD, a feature with its two parts
// laid out under it (`part of` links). The hand presses the feature's `[−] 2 parts`: the parts shrink into it as rows of
// a small tree, and the view closes in on the folded card. What the fold would write shown with set().
import type { Edge } from '../../data/edges'
import { aim, camera, cursor, inFocus, set, wait, type Scene } from '../director'
import { PLANE_K, focusRoute, frameTo, moved, smallPlane } from '../fixtures/kit'
import { stage } from '../fixtures/o10'

const feature = moved('f-pickup', PLANE_K, 125, 0)
const parts = [
  { ...moved('f-pickup', PLANE_K, 0, 175), id: 'f-cutoff', title: 'Order cut-off at 9 pm', status: 'shipped' as const, priority: undefined },
  { ...moved('f-pickup', PLANE_K, 250, 175), id: 'f-slot', title: 'Pickup slot at checkout', status: 'building' as const, priority: undefined },
]
const partOf = (id: string): Edge => ({ id: `po-${id}`, fromId: id, fromType: 'feature', toId: feature.id, toType: 'feature', kind: 'part-of' })
const FOLD = aim(`[data-target="card:${feature.id}"] button[title="Fold its parts into it"]`, 0.5, 0.5)

const scene: Scene = {
  id: 'parts',
  fixture: smallPlane([feature, ...parts], { edges: parts.map((p) => partOf(p.id)) }),
  view: 'focus',
  route: focusRoute(),
  size: [480, 300],
  length: 4600,
  poster: 4500,
  cursor: inFocus(470, 320),
  setup: [...stage('parts'), camera.frame({ x: -25, y: -15, w: 500, h: 330 }, 8)],
  steps: [
    { at: 300, do: cursor.to(FOLD, 1100) },
    { do: wait(400) },
    { do: cursor.press() },
    { do: set((ws) => ({ ...ws, cards: ws.cards.map((c) => (c.id === feature.id ? { ...c, folded: true } : c)) }), 'folded in') },
    { do: wait(500) },
    { do: frameTo({ x: 75, y: -15, w: 300, h: 220 }, 900) },
    { do: wait(500) },
  ],
}
export default scene
