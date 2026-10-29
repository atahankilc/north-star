// `stuck` page 2 (onboarding-lessons.md §2), "Open it beside": 02 Product in focus with its features table open beside
// it, no HUD. The hand picks a row of the table, `Portion counter…`, by its name: the plane's view glides to that card
// and it's lit (selected); its panel is shut at once (as Enter leaves a card just named, D-250) so both halves stay in
// the slot.
import { useCanvasView } from '../../state/canvasView'
import { camera, cursor, onStage, run, wait, type Scene } from '../director'
import { PLANE_F, TABLE_F, bare, byText, focusRoute, lensFixture, shutPanelOnPick } from '../fixtures/kit'

const CARD = `${PLANE_F}-f-counter`
const ROW = byText('[data-card]', 'Portion counter', 0.35, 0.5)

const scene: Scene = {
  id: 'beside-pick',
  fixture: lensFixture(true),
  view: 'focus',
  route: `${focusRoute(PLANE_F)}&beside=${TABLE_F}`,
  size: [640, 400],
  length: 5200,
  poster: 5100,
  cursor: onStage(560, 330),
  // The plane's half looking at its top-right card; the counter (bottom-left) out of the middle until it's picked.
  setup: [bare('beside-pick'), run(() => useCanvasView.setState({ split: 0.5 }), 'split'), camera.frame({ x: 250, y: 25, w: 250, h: 150 }, 24)],
  steps: [
    // To the table's half, over the counter's row; the wheel turns in: the table's own view zooms round it until the rows
    // read; then the row is picked.
    { at: 300, do: cursor.to(ROW, 900) },
    { do: wait(250) },
    { do: cursor.wheel(-420, 900) },
    { do: wait(350) },
    { do: cursor.to(ROW, 400) },
    { do: wait(250) },
    { do: shutPanelOnPick(CARD) },
    { do: cursor.press() },
    { do: wait(1100) },
    { do: cursor.to(onStage(600, 340), 600) },
  ],
}
export default scene
