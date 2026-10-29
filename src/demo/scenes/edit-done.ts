// `piece-made` page 2, "Done when you're done" (onboarding-lessons.md §2): a plane on the canvas in edit mode, its
// console showing `EDIT 500 × 325 … done`, no HUD. The hand goes to `done` and presses it (the real console's press):
// edit mode ends, the handles and the cyan frame go, the console with them as the hand moves off.
import { setEditing } from '../../state/canvasView'
import { aim, camera, cursor, onStage, run, wait, type Scene } from '../director'
import { CLEAR, PLANE_E, bare, base, planeE, planeECards, planeEEdges } from '../fixtures/kit'

const DONE = `[data-target="plane:${PLANE_E}"] [role="toolbar"] button[aria-pressed="true"]`

const scene: Scene = {
  id: 'edit-done',
  fixture: { ...base, pieces: [...base.pieces, planeE()], cards: [...base.cards, ...planeECards], edges: [...base.edges, ...planeEEdges] },
  view: 'canvas',
  size: [640, 400],
  length: 4000,
  poster: 3900,
  cursor: onStage(560, 380),
  setup: [bare('edit-done'), camera.set(CLEAR.x + 250, CLEAR.y + 175, 0.9), run(() => setEditing(PLANE_E, true), 'in edit mode')],
  steps: [
    { at: 400, do: cursor.to(aim(DONE, 0.5, 0.5), 1000) },
    { do: wait(400) },
    { do: cursor.press() },
    { do: wait(700) },
    { do: cursor.to(onStage(600, 120), 900) },
    { do: wait(400) },
  ],
}
export default scene
