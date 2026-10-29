// O0's spike, on the director: a plane in focus, the cursor carries a card to an empty spot below and lets go there;
// its links follow it. Real pointer events on the real card (its press marks, the 0.8 carry, the landing L's, the panel
// a press opens); the move it would write shown with set() at the drop.
import { CARD } from '../../data/cards'
import { camera, cursor, inFocus, set, wait, type Scene } from '../director'
import { PLANE, tiny, WID, workspace } from '../fixtures/tiny'

const CARRIED = 'c-cooks'
const TO = { x: 300, y: 450 }
const card = `[data-target="card:${CARRIED}"]`

const scene: Scene = {
  id: 'plane-drag',
  fixture: { ...tiny, wid: WID, workspace },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${PLANE}`,
  size: [960, 600],
  length: 4300,
  poster: 3700,
  cursor: inFocus(120, 520),
  // Every card and the spot it goes to in view, on the left (a press opens the card's panel on the right).
  setup: [camera.frame({ x: -40, y: -40, w: 1080, h: 640 }, 40)],
  steps: [
    { at: 300, do: cursor.to(card, 1000) },
    { do: wait(350) },
    {
      do: cursor.drag(card, inFocus(TO.x + CARD.w / 2, TO.y + CARD.h / 2), 1700, set((ws) => ({ ...ws, cards: ws.cards.map((c) => (c.id === CARRIED ? { ...c, ...TO } : c)) }), 'the card lands')),
    },
    { do: wait(250) },
    { do: cursor.to(inFocus(120, 560), 700) },
  ],
}
export default scene
