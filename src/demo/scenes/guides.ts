// `guides-snap` (onboarding-lessons.md §3), "Lines up by itself": 02 Product in focus, no HUD, three features, one out
// of line. The hand takes it and carries it under the one on the right: the magenta guides show as its edges meet the
// others' (the real guides, D-231), it snaps onto the line, and lands there. Picked as a selection of one, so its panel
// stays out of the slot. What the move would write shown with set().
import { useCanvasView } from '../../state/canvasView'
import { aim, camera, cursor, inFocus, run, set, wait, type Scene } from '../director'
import { PLANE_K, focusRoute, moved, smallPlane } from '../fixtures/kit'
import { stage } from '../fixtures/o10'

const MOVED = 'f-counter'
const START_AT = { x: 40, y: 200 }
const END_AT = { x: 275, y: 175 }
const cards = [moved('f-pickup', PLANE_K, 25, 25), moved('f-qr', PLANE_K, 275, 25), moved(MOVED, PLANE_K, START_AT.x, START_AT.y)]
const GRAB = aim(`[data-target="card:${MOVED}"]`, 0.5, 0.5)
// Where the card's middle ends up (plane px), held a moment off the line first so the snap shows.
const TO = inFocus(END_AT.x + 100 + 6, END_AT.y + 50 + 4)

const scene: Scene = {
  id: 'guides',
  fixture: smallPlane(cards),
  view: 'focus',
  route: focusRoute(),
  size: [480, 300],
  length: 5200,
  poster: 3900,
  cursor: inFocus(470, 360),
  setup: [...stage('guides'), run(() => useCanvasView.setState({ cardMulti: [MOVED] }), 'picked'), camera.frame({ x: 0, y: 0, w: 500, h: 360 }, 6)],
  steps: [
    { at: 300, do: cursor.to(GRAB, 900) },
    { do: wait(350) },
    { do: cursor.drag(GRAB, TO, 2600, set((ws) => ({ ...ws, cards: ws.cards.map((c) => (c.id === MOVED ? { ...c, ...END_AT } : c)) }), 'it lands')) },
    { do: wait(300) },
    { do: cursor.to(inFocus(470, 360), 700) },
  ],
}
export default scene
