// `card-made` page 2 and `card-panel` (onboarding-lessons.md §3), "Its panel": 01 Lunch in focus, no HUD, a problem
// with its customer above and the idea that solves it below. The hand clicks the problem: its panel builds on the
// right (what it is, its status and evidence, its links by meaning, tags, notes); the hand goes over the panel and it
// scrolls down through the sections, as a wheel would.
import { aim, cursor, inFocus, wait, type Scene } from '../director'
import { PLANE_K, base, focusRoute, moved, smallPlane } from '../fixtures/kit'
import { scrollPanel, stage, view } from '../fixtures/o10'

const CARD = '[data-target="card:r-greasy"]'

const scene: Scene = {
  id: 'card-panel',
  fixture: smallPlane([moved('c-office', PLANE_K, 0, 0), moved('r-greasy', PLANE_K, 0, 150, { tags: ['price'] }), moved('i-preorder', PLANE_K, 0, 300)], {
    edges: base.edges.filter((e) => e.id === 'e-1' || e.id === 'e-8'),
  }),
  view: 'focus',
  route: focusRoute(),
  size: [640, 400],
  length: 6000,
  poster: 3400,
  cursor: inFocus(330, 380),
  setup: [...stage('card-panel'), view(0.78, 16, 22)],
  steps: [
    { at: 300, do: cursor.to(aim(CARD, 0.5, 0.55), 900) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(1300) },
    { do: cursor.to((c) => ({ x: (640 - 190) * c.scale, y: 250 * c.scale }), 800) },
    { do: wait(300) },
    { do: scrollPanel(320, 1500) },
    { do: wait(400) },
  ],
}
export default scene
