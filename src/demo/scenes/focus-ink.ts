// `piece-console` page 2, "Go inside with focus" (onboarding-lessons.md §2): a plane on the canvas, no HUD. The hand
// comes onto it, its console builds; to `focus`, a press: the plane spreads like ink, cell by cell, and its view glides
// to its fit as the page goes black: the plane is the view, its dock at the bottom.
import { aim, camera, cursor, onStage, wait, type Scene } from '../director'
import { CLEAR, PLANE_E, bare, base, planeE, planeECards, planeEEdges } from '../fixtures/kit'

const P = `[data-target="plane:${PLANE_E}"]`
const FOCUS = `${P} [role="toolbar"] button[title^="make the"]`

const scene: Scene = {
  id: 'focus-ink',
  fixture: { ...base, pieces: [...base.pieces, planeE()], cards: [...base.cards, ...planeECards], edges: [...base.edges, ...planeEEdges] },
  view: 'canvas',
  size: [640, 400],
  length: 5200,
  poster: 5100,
  cursor: onStage(560, 380),
  setup: [bare('focus-ink'), camera.set(CLEAR.x + 250, CLEAR.y + 175, 0.8)],
  steps: [
    { at: 300, do: cursor.to(aim(P, 0.55, 0.6), 900) },
    { do: wait(500) },
    { do: cursor.to(aim(FOCUS), 700) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(1200) },
    { do: cursor.to(onStage(600, 330), 700) },
    { do: wait(300) },
  ],
}
export default scene
