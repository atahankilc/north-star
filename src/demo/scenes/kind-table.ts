// The kind guide's `table…` row (onboarding-lessons.md §2): Pazar's features table, no HUD. It appears (what the wizard
// makes, shown with set()) with its rows chosen by its rule (every feature) and the cards' own fields; then a column of
// its own comes, `cost / month`, and its numbers are typed in down the rows (each shown with set()).
import type { TableSetup } from '../../data/table'
import { camera, set, wait, type Scene } from '../director'
import { AWAY, CLEAR, appear, bare, base, pazarPiece } from '../fixtures/kit'
import { P } from '../fixtures/pazar'

const all = pazarPiece(P.table).table as TableSetup
// Its name, status and priority; the impact and effort columns left out, so the one of its own reads in the slot.
const full: TableSetup = { ...all, cols: all.cols.filter((c) => c.id !== 'tc-impact' && c.id !== 'tc-effort') }
const t = { ...pazarPiece(P.table), table: full, x: CLEAR.x, y: CLEAR.y, w: 600, h: 300 }
const before = { ...t, table: { ...full, cols: full.cols.filter((c) => c.id !== 'tc-cost') } }
const costs = base.cells.filter((c) => c.matrixId === P.table)

const scene: Scene = {
  id: 'kind-table',
  fixture: { ...base, pieces: base.pieces.filter((p) => p.id !== P.table), cells: base.cells.filter((c) => c.matrixId !== P.table) },
  view: 'canvas',
  size: [480, 300],
  length: 4200,
  poster: 4100,
  cursor: AWAY,
  setup: [bare('kind-table'), camera.set(t.x + t.w / 2, t.y + t.h / 2 - 10, 0.7)],
  steps: [
    { at: 300, do: appear(before, 'the table appears') },
    { at: 1500, do: set((ws) => ({ ...ws, pieces: ws.pieces.map((p) => (p.id === P.table ? t : p)) }), 'its own column') },
    ...costs.map((c, i) => ({ at: 2200 + i * 350, do: set((ws) => ({ ...ws, cells: [...ws.cells, c] }), `cost of ${c.row}`) })),
    { at: 2200 + costs.length * 350, do: wait(600) },
  ],
}
export default scene
