// The kind guide's `matrix…` row (onboarding-lessons.md §2): a clear look at Pazar's matrix, no HUD. It appears (what the
// wizard makes, shown with set()), built cell by cell: Product's features down, the competitors across, every cell
// empty; then the scores come in one cell at a time, as a person scoring them would, until the rows read.
import { camera, set, wait, type Scene } from '../director'
import { AWAY, CLEAR, appear, bare, base, pazarPiece } from '../fixtures/kit'
import { P } from '../fixtures/pazar'

const m = { ...pazarPiece(P.matrix), x: CLEAR.x, y: CLEAR.y, w: 800, h: 500 }
const scores = base.cells.filter((c) => c.matrixId === P.matrix)

const scene: Scene = {
  id: 'kind-matrix',
  fixture: { ...base, pieces: base.pieces.filter((p) => p.id !== P.matrix), cells: base.cells.filter((c) => c.matrixId !== P.matrix) },
  view: 'canvas',
  size: [480, 300],
  length: 4000,
  poster: 3900,
  cursor: AWAY,
  setup: [bare('kind-matrix'), camera.set(m.x + m.w / 2, m.y + m.h / 2 - 10, 0.55)],
  steps: [
    { at: 300, do: appear(m, 'the matrix appears') },
    // The scores, a few at a time (every 130 ms), down the rows.
    ...scores.map((c, i) => ({ at: 1000 + i * 130, do: set((ws) => ({ ...ws, cells: [...ws.cells, c] }), `scored ${c.row} × ${c.col}`) })),
    { at: 1000 + scores.length * 130, do: wait(600) },
  ],
}
export default scene
