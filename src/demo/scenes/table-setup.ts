// `table-keys` page 2 for editors (onboarding-lessons.md §5), "Your own columns": Pazar's features table in focus, as table-keys
// shows it, no HUD. The hand presses `setup` in the dock: the setup builds over the table's foot. `columns`, then
// `+ a mark` (a scale, low → high): a column of its own joins the table (the write shown with set()) and the table's view
// follows it in. `done`: the setup goes; the view glides on to the new `mark` column, its head readable.
import { DEFAULT_STEPS, type TableSetup } from '../../data/table'
import { cursor, onStage, run, wait, type Scene } from '../director'
import { base, byText } from '../fixtures/kit'
import { view } from '../fixtures/o10'
import { NO_HUD, fresh, glideToShow, pageStyle, pieceSet } from '../fixtures/o11'
import { P } from '../fixtures/pazar'
import { useTableUi } from '../../views/workspace/Table'

const ID = 'table-setup'
const SETUP = byText('button', 'setup', 0.5, 0.5)
const COLUMNS = byText('[data-learn="setup"] [role="tab"]', 'columns', 0.4, 0.5)
// The kind's own button (`▁▄█ + a mark`), not the kind picker of a column already there.
const MARK = () => {
  const el = [...document.querySelectorAll('[data-learn="setup"] button')].find((b) => (b.textContent ?? '').includes('+ a mark'))
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width * 0.35, y: r.top + r.height * 0.45 }
}
// The setup kept inside the small stage, its tabs in view, its body scrolling (in the app it has the screen's height).
const fit = `& [data-learn="setup"] { bottom: 52px; max-height: calc(100% - 60px); }
  & [data-learn="setup"] [role="tabpanel"] { min-height: 0; overflow: hidden; }`
const DONE = byText('[data-learn="setup"] button', 'done', 0.5, 0.5)
const only = (t: TableSetup): TableSetup => ({ ...t, cols: t.cols.filter((c) => c.id !== 'tc-impact' && c.id !== 'tc-effort') })
const fixture = { ...base, pieces: base.pieces.map((p) => (p.id === P.table ? { ...p, table: only(p.table as TableSetup) } : p)) }

const scene: Scene = {
  id: ID,
  fixture,
  view: 'focus',
  route: `/workspaces/${base.wid}?focus=${P.table}`,
  size: [480, 300],
  length: 7900,
  poster: 7800,
  cursor: onStage(440, 200),
  // The setup shut and on its first tab, as a fresh focus has it (a module store outlives the stage).
  setup: [fresh(), pageStyle(ID, `${NO_HUD} ${fit}`), run(() => useTableUi.setState({ setup: null, tab: 'rows' }), 'setup shut'), view(0.78, 24, 30)],
  steps: [
    { at: 300, do: cursor.to(SETUP, 800) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(500) },
    { do: cursor.to(COLUMNS, 700) },
    { do: wait(250) },
    { do: cursor.press() },
    { do: wait(450) },
    { do: cursor.to(MARK, 700) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: pieceSet(P.table, (p) => ({ ...p, table: { ...(p.table as TableSetup), cols: [...(p.table as TableSetup).cols, { id: 'tc-mark', name: 'mark', kind: 'scale', steps: DEFAULT_STEPS }] } }), 'a column of its own') },
    { do: wait(600) },
    { do: cursor.to(DONE, 700) },
    { do: wait(250) },
    { do: cursor.press() },
    // The view glides on to the new column, at its size: its head reads.
    { do: glideToShow('[data-find="h|tc-mark"]', 372, 30, 700) },
    { do: cursor.to(onStage(462, 288), 600) },
  ],
}
export default scene
