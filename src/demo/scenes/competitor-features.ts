// `competitor-features` (onboarding-lessons.md §3), "Their features inside": 02 Product in focus, no HUD, two
// competitors. The hand comes over Shef: it grows and its features show inside it, by category (the real hover); it
// clicks: Shef is selected, its panel builds (its features there to add and match), and as the hand moves off to the
// panel Shef stays open. All real.
import { aim, cursor, inFocus, wait, type Scene } from '../director'
import { PLANE_K, focusRoute, moved, smallPlane } from '../fixtures/kit'
import { scrollPanel, stage, view } from '../fixtures/o10'

const SHEF = '[data-target="card:k-shef"]'

const scene: Scene = {
  id: 'competitor-features',
  fixture: smallPlane([moved('k-shef', PLANE_K, 0, 0), moved('k-wolt', PLANE_K, 250, 0)]),
  view: 'focus',
  route: focusRoute(),
  size: [640, 400],
  length: 6600,
  poster: 6500,
  cursor: inFocus(330, 330),
  setup: [...stage('competitor-features'), view(0.85, 16, 40)],
  steps: [
    { at: 300, do: cursor.to(aim(SHEF, 0.5, 0.3), 1000) },
    { do: wait(1300) },
    { do: cursor.press() },
    { do: wait(1100) },
    { do: cursor.to((c) => ({ x: 430 * c.scale, y: 260 * c.scale }), 900) },
    { do: scrollPanel('#features', 1000) },
    { do: wait(700) },
  ],
}
export default scene
