// The kind guide's `customer` row, in a plane (onboarding-lessons.md §2): a plane in focus with two problems on it, no
// HUD. A customer card appears above them (shown with set()); the problems say who they're for (their `for` links,
// shown with set()), and with the customer selected its `for` lines show (D-128).
import { camera, set, ui, wait, type Scene } from '../director'
import { AWAY, PLANE_K, arrive, bare, base, focusRoute, moved, shutPanelOnPick, smallPlane } from '../fixtures/kit'

const office = moved('c-office', PLANE_K, 125, 0)
const scene: Scene = {
  id: 'card-customer',
  fixture: smallPlane([moved('r-greasy', PLANE_K, 0, 175), moved('r-break', PLANE_K, 250, 175)]),
  view: 'focus',
  route: focusRoute(),
  size: [480, 300],
  length: 3400,
  poster: 3300,
  cursor: AWAY,
  setup: [bare('card-customer'), camera.frame({ x: -25, y: -25, w: 500, h: 325 }, 16)],
  steps: [
    { at: 400, do: arrive(office) },
    { at: 1300, do: set((ws) => ({ ...ws, edges: base.edges.filter((e) => e.id === 'e-8' || e.id === 'e-9') }), 'the problems are for them') },
    // Selected (D-128: a card's `for` lines show while it's selected), its panel shut as Enter leaves it on a card just
    // named (D-250), so the plane stays in view in the slot.
    { at: 1500, do: shutPanelOnPick('c-office') },
    { at: 1500, do: ui.select('card:c-office') },
    { do: wait(1800) },
  ],
}
export default scene
