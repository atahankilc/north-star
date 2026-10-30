// `table-keys` (onboarding-lessons.md §5), "Working in a table": Pazar's features table in focus (status, priority and its
// own `cost / month`), sorted by priority, no HUD. The hand clicks the empty cost of `Cook profile with a kitchen check`:
// selected. `↵` (its key chip) opens it for typing; `45` typed, `↵` keeps it. Then the hand presses the `cost / month`
// head: the rows sort by what they cost, cheapest first, the empty ones last. The writes the demo can't make (the cell,
// the sort) are shown with set() as they land.
import type { TableSetup } from '../../data/table'
import { cursor, key, onStage, wait, type Scene } from '../director'
import { base, byText, type } from '../fixtures/kit'
import { view } from '../fixtures/o10'
import { cellSet, NO_HUD, fresh, pageStyle, pieceSet } from '../fixtures/o11'
import { P } from '../fixtures/pazar'

const ID = 'table-keys'
const ROW = 'f-profile'
const CELL = `[data-cell$="|${ROW}|tc-cost"]`
const HEAD = byText('[data-own] [data-find="h|tc-cost"]', 'cost', 0.4, 0.5)
const only = (t: TableSetup): TableSetup => ({ ...t, cols: t.cols.filter((c) => c.id !== 'tc-impact' && c.id !== 'tc-effort') })
const fixture = { ...base, pieces: base.pieces.map((p) => (p.id === P.table ? { ...p, table: only(p.table as TableSetup) } : p)) }

const scene: Scene = {
  id: ID,
  fixture,
  view: 'focus',
  route: `/workspaces/${base.wid}?focus=${P.table}`,
  size: [480, 300],
  length: 6600,
  poster: 6500,
  cursor: onStage(440, 285),
  setup: [fresh(), pageStyle(ID, NO_HUD), view(0.78, 24, 30)],
  steps: [
    { at: 300, do: cursor.to(CELL, 1000) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(500) },
    { do: key('↵') },
    { do: wait(400) },
    ...type('45', 180),
    { do: wait(350) },
    { do: key('↵') },
    { do: cellSet(P.table, ROW, 'tc-cost', { value: 45 }) },
    { do: wait(600) },
    { do: cursor.to(HEAD, 800) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: pieceSet(P.table, (p) => ({ ...p, table: { ...(p.table as TableSetup), sort: { col: 'tc-cost' } } }), 'sorted by cost') },
    { do: wait(500) },
    { do: cursor.to(onStage(440, 285), 700) },
  ],
}
export default scene
