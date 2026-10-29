// The kind guide's `package` row, in a plane (onboarding-lessons.md §2): a plane in focus with three features, no HUD.
// A package forms round them (shown with set()): the blue frame on the grid's marks, its band on top with its name and
// rating; then it folds into one blue card of rows, a bar in each member's colour.
import type { Card } from '../../data/cards'
import { camera, set, wait, type Scene } from '../director'
import { AWAY, frameTo, PLANE_K, bare, focusRoute, moved, smallPlane } from '../fixtures/kit'

const members = [moved('f-pickup', PLANE_K, 0, 75), moved('f-qr', PLANE_K, 225, 75), moved('f-counter', PLANE_K, 450, 75)]
const pkg: Card = { id: 'pk-launch', type: 'package', pieceId: PLANE_K, title: 'Launch at Factory', x: 0, y: 0, memberIds: members.map((m) => m.id), priority: 'P1' }

const scene: Scene = {
  id: 'kind-package',
  fixture: smallPlane(members),
  view: 'focus',
  route: focusRoute(),
  size: [480, 300],
  length: 3800,
  poster: 3700,
  cursor: AWAY,
  setup: [bare('kind-package'), camera.frame({ x: -25, y: -25, w: 700, h: 275 }, 12)],
  steps: [
    { at: 500, do: set((ws) => ({ ...ws, cards: [...ws.cards, pkg] }), 'the package forms') },
    { at: 2200, do: set((ws) => ({ ...ws, cards: ws.cards.map((c) => (c.id === pkg.id ? { ...c, folded: true } : c)) }), 'folded') },
    { do: frameTo({ x: -50, y: -25, w: 300, h: 200 }, 800) },
    { do: wait(800) },
  ],
}
export default scene
