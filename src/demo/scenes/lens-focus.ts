// `focus-lens` (onboarding-lessons.md §2), "Working in a window": a plane and a features table on the canvas, no HUD.
// The hand comes onto the table, its console builds; `focus`, a press: the table glides to the middle of the screen as
// the page builds behind it, its dock at the bottom (`setup`, `unfocus esc`).
import { aim, camera, cursor, onStage, wait, type Scene } from '../director'
import { CLEAR, TABLE_F, bare, lensFixture } from '../fixtures/kit'

const T = `[data-target="plane:${TABLE_F}"]`
const FOCUS = `${T} [role="toolbar"] button[title^="make the"]`

const scene: Scene = {
  id: 'lens-focus',
  fixture: lensFixture(false),
  view: 'canvas',
  size: [640, 400],
  length: 4900,
  poster: 4800,
  cursor: onStage(420, 380),
  setup: [bare('lens-focus'), camera.set(CLEAR.x + 590, CLEAR.y + 150, 0.52)],
  steps: [
    { at: 300, do: cursor.to(aim(T, 0.5, 0.6), 900) },
    { do: wait(500) },
    { do: cursor.to(aim(FOCUS), 700) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(1100) },
    { do: cursor.to(onStage(600, 250), 700) },
    { do: wait(200) },
  ],
}
export default scene
