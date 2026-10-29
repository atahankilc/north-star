// The kind guide's `competitor` row, in a plane (onboarding-lessons.md §2): a plane in focus, no HUD. A competitor card
// appears, Shef (shown with set()); the hand comes over it and its features grow out of it, inside the card (the real
// hover), by category.
import { aim, camera, cursor, wait, type Scene } from '../director'
import { PLANE_K, arrive, bare, focusRoute, moved, smallPlane } from '../fixtures/kit'
import { inFocus } from '../director'

const card = moved('k-shef', PLANE_K, 150, 50)
const scene: Scene = {
  id: 'card-competitor',
  fixture: smallPlane([]),
  view: 'focus',
  route: focusRoute(),
  size: [480, 300],
  length: 3600,
  poster: 3400,
  cursor: inFocus(470, 300),
  setup: [bare('card-competitor'), camera.frame({ x: 75, y: 0, w: 350, h: 260 }, 12)],
  steps: [
    { at: 300, do: arrive(card) },
    { at: 1000, do: cursor.to(aim('[data-target="card:k-shef"]', 0.6, 0.4), 900) },
    { do: wait(1700) },
  ],
}
export default scene
