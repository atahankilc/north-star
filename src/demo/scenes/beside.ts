// `beside` (onboarding-lessons.md §2), "Side by side": 02 Product in focus with its features table stuck to it, no HUD,
// framed tight on the plane and its dock. The hand opens `linked · 1` in the dock, then presses `⇆ table · 04 Features`:
// the table opens beside the plane, the screen split with the line between, each half with its own dock; the plane's
// half is then looked at closer, and the wheel over the table zooms that half's own view, so its rows read.
import { useCanvasView } from '../../state/canvasView'
import { camera, cursor, onStage, run, wait, type Scene } from '../director'
import { PLANE_F, bare, byText, focusRoute, frameTo, lensFixture } from '../fixtures/kit'

const LINKED = byText('button', 'linked')
const BESIDE = 'button[title="open it beside the plane"]'
const ROWS = byText('[data-card]', 'Pickup shelf', 0.3, 0.5)

const scene: Scene = {
  id: 'beside',
  fixture: lensFixture(true),
  view: 'focus',
  route: focusRoute(PLANE_F),
  size: [640, 400],
  length: 6700,
  poster: 6600,
  cursor: onStage(470, 250),
  setup: [bare('beside'), run(() => useCanvasView.setState({ split: 0.5 }), 'split'), camera.frame({ x: 0, y: 25, w: 500, h: 325 }, 40)],
  steps: [
    { at: 300, do: cursor.to(LINKED, 900) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(500) },
    { do: cursor.to(BESIDE, 600) },
    { do: wait(350) },
    { do: cursor.press() },
    // The plane's half looked at closer (its view, as a wheel would), so its cards read beside the table.
    { do: wait(700) },
    { do: frameTo({ x: 0, y: 25, w: 500, h: 325 }, 600) },
    // Then the hand on the table's half and the wheel turning in: that half's own view zooms, the plane's stays.
    { do: cursor.to(ROWS, 700) },
    { do: wait(200) },
    { do: cursor.wheel(-420, 900) },
    { do: wait(300) },
  ],
}
export default scene
