// `right-click` (onboarding-lessons.md §3), "Right-click is a prompt": 01 Lunch in focus, no HUD, a problem. A
// right-click on it: the real menu builds (open, comment, copy, duplicate, delete); `du` typed in its `>` line narrows
// it to `duplicate`; a click takes it: the copy lands two grid steps off. What the copy would write shown with set().
import { cursor, camera, inFocus, set, wait, aim, type Scene } from '../director'
import { PLANE_K, focusRoute, moved, rightClick, smallPlane, type } from '../fixtures/kit'
import { stage } from '../fixtures/o10'

const card = moved('r-permit', PLANE_K, 0, 25)
const AT_CARD = aim(`[data-target="card:${card.id}"]`, 0.6, 0.55)

const scene: Scene = {
  id: 'prompt-type',
  fixture: smallPlane([card]),
  view: 'focus',
  route: focusRoute(),
  size: [480, 300],
  length: 5700,
  poster: 3700,
  cursor: inFocus(420, 260),
  setup: [...stage('prompt-type'), camera.frame({ x: -25, y: 0, w: 500, h: 250 }, 10)],
  steps: [
    { at: 300, do: cursor.to(AT_CARD, 800) },
    { do: wait(350) },
    { do: rightClick(AT_CARD) },
    { do: wait(800) },
    ...type('du', 300),
    { do: wait(700) },
    { do: cursor.to(aim('[role="menu"] [data-key="dup"]', 0.3, 0.5), 600) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: set((ws) => ({ ...ws, cards: [...ws.cards, { ...card, id: 'r-permit-2', x: card.x + 50, y: card.y + 50 }] }), 'the copy lands') },
    { do: wait(600) },
  ],
}
export default scene
