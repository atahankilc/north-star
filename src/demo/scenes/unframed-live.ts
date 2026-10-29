// `unframed` (onboarding-lessons.md §2), "Live on the canvas": an unframed features table lying on the canvas, no HUD.
// No focus: the hand clicks an empty `cost / month` cell right there, double-clicks to type, `15` typed, Enter: the cell
// keeps it (the write shown with set() at the Enter).
import { camera, cursor, key, onStage, set, wait, type Scene } from '../director'
import { AT, CLEAR, PLANE_F, TABLE_F, bare, doubleClick, lensFixture, type } from '../fixtures/kit'

const CELL = `[data-cell$="|${PLANE_F}-f-counter|tc-cost"]`

const scene: Scene = {
  id: 'unframed-live',
  fixture: lensFixture(false, { open: true }),
  view: 'canvas',
  size: [640, 400],
  length: 4500,
  poster: 4400,
  cursor: onStage(420, 380),
  setup: [bare('unframed-live'), camera.set(CLEAR.x + 1035, CLEAR.y + 170, 0.85)],
  steps: [
    { at: 400, do: cursor.to(CELL, 1000) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(300) },
    { do: doubleClick(CELL) },
    { do: wait(400) },
    ...type('15', 160),
    { do: wait(400) },
    { do: key('↵') },
    { do: set((ws) => ({ ...ws, cells: [...ws.cells, { matrixId: TABLE_F, row: `${PLANE_F}-f-counter`, col: 'tc-cost', value: 15, updatedAt: AT }] }), 'kept') },
    { do: wait(400) },
    { do: cursor.to(onStage(600, 380), 700) },
  ],
}
export default scene
