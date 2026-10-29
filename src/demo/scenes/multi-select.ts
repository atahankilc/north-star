// `multi-select` (onboarding-lessons.md §3), "Several at once": 02 Product in focus, no HUD, four features. With `⌥`
// held the hand drags a box over three of them: the box draws, the three are selected (their L's); `⌥` let go, it
// takes one of them and drags: all three go together (each at 0.8, landing L's where they'll land), and land. The
// `N selected` panel is left out here (the lesson sits beside it in the app). What the move would write shown with set().
import { aim, camera, cursor, inFocus, set, wait, type Scene } from '../director'
import { PLANE_K, by, focusRoute, moved, smallPlane } from '../fixtures/kit'
import { hold, letGoKeys, stage } from '../fixtures/o10'

const three = ['f-pickup', 'f-qr', 'f-counter']
const cards = [moved('f-pickup', PLANE_K, 0, 25), moved('f-qr', PLANE_K, 225, 25), moved('f-counter', PLANE_K, 0, 175), moved('f-tips', PLANE_K, 500, 200)]
const FROM = inFocus(-15, 5)
const TO = inFocus(445, 290)
const GRAB = aim('[data-target="card:f-qr"]', 0.5, 0.5)
const MOVE = { x: 75, y: 50 }

const scene: Scene = {
  id: 'multi-select',
  fixture: smallPlane(cards),
  view: 'focus',
  route: focusRoute(),
  size: [640, 400],
  length: 6600,
  poster: 6500,
  cursor: inFocus(300, 400),
  setup: [...stage('multi-select', 'body:has(&) [data-learn="card-panel"] { display: none !important; }'), camera.frame({ x: -40, y: -20, w: 760, h: 440 }, 6)],
  steps: [
    { at: 300, do: cursor.to(FROM, 900) },
    { do: wait(120) },
    { do: hold('⌥', 1600) },
    { do: wait(120) },
    { do: cursor.drag(FROM, TO, 1300) },
    { do: letGoKeys() },
    { do: wait(500) },
    { do: cursor.to(GRAB, 700) },
    { do: wait(300) },
    {
      do: cursor.drag(GRAB, by(GRAB, MOVE.x, MOVE.y), 1400, set((ws) => ({ ...ws, cards: ws.cards.map((c) => (three.includes(c.id) ? { ...c, x: c.x + MOVE.x, y: c.y + MOVE.y } : c)) }), 'they land')),
    },
    { do: wait(400) },
  ],
}
export default scene
