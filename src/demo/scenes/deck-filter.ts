// `deck-filter` (onboarding-lessons.md §7), "Only some tasks": 05 Launch in focus, no HUD, framed on `to do` and
// `doing`. The hand presses the dock's `[filter]`: the strip builds over the dock (GIVEN TO, DUE, FOR, LABEL); it opens
// GIVEN TO and picks `me`: only the tasks given to you stay: `to do` empties, `doing`
// keeps yours. All real: a filter writes nothing.
import { K } from '../../views/workspace/Kanban'
import { NO_FILTER } from '../../model/kanbanFilter'
import { setKanbanFilter } from '../../views/workspace/kanbanFilter'
import { aim, camera, cursor, onStage, run, wait, type Scene } from '../director'
import { base, byText } from '../fixtures/kit'
import { row } from '../fixtures/o10'
import { NO_HUD, calmTasks, pageStyle } from '../fixtures/o12'
import { WID, P } from '../fixtures/pazar'

const tasks = calmTasks(base.tasks)

const FILTER = aim('button[title="which tasks it shows"]')
const GIVEN = byText('[data-learn="filter-strip"] button', 'given to', 0.4, 0.5)
const ME = row('me')

const scene: Scene = {
  id: 'deck-filter',
  fixture: { ...base, tasks },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${P.deck}`,
  size: [640, 400],
  length: 7800,
  poster: 7700,
  cursor: onStage(560, 330),
  setup: [pageStyle('deck-filter', NO_HUD), run(() => setKanbanFilter(P.deck, NO_FILTER), 'no filter')],
  steps: [
    // At 0, not in the setup: what the loop before left open, shut as it starts again, refits the piece as the stage
    // settles, and this comes after it.
    { at: 0, do: camera.frame({ x: -6, y: -6, w: 2 * K.col + K.gap + 12, h: 300 }, 4) },
    { at: 300, do: cursor.to(FILTER, 900) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(700) },
    { do: cursor.to(GIVEN, 600) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(600) },
    { do: cursor.to(ME, 600) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(500) },
    // The menu closed by its own button again: what's left on the deck, the strip saying why.
    { do: cursor.to(GIVEN, 500) },
    { do: wait(250) },
    { do: cursor.press() },
    { do: cursor.to(onStage(600, 230), 800) },
    { do: wait(300) },
  ],
}
export default scene
