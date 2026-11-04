// `deck` "Only some tasks" (lessons.ts, D-349): 05 Launch in focus, no HUD, framed on `to do` and
// `doing`. The hand presses the dock's `[filter]`: its columns build over the dock (GIVEN TO, DUE, FOR, LABEL, D-364);
// in GIVEN TO it ticks `me`: only the tasks given to you stay: `to do` empties, `doing`
// keeps yours. All real: a filter writes nothing.
import { K } from '../../views/workspace/deck/Kanban'
import { NO_FILTER } from '../../model/kanbanFilter'
import { setKanbanFilter } from '../../views/workspace/deck/kanbanFilter'
import { aim, camera, cursor, key, onStage, run, wait, type Scene } from '../director'
import { base } from '../fixtures/kit'
import { NO_HUD, calmTasks, pageStyle } from '../fixtures/o12'
import { WID, P } from '../fixtures/pazar'

const tasks = calmTasks(base.tasks)

const FILTER = aim('button[title="which tasks it shows"]')
const ME = aim('[data-learn="filter-strip"] [data-key="me"]')

const scene: Scene = {
  id: 'deck-filter',
  fixture: { ...base, tasks },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${P.deck}`,
  size: [640, 400],
  length: 6300,
  poster: 6200,
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
    { do: cursor.to(ME, 600) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(500) },
    // The drawer shut: what's left on the deck, the tab saying why (`filter 1`).
    { do: key('Esc') },
    { do: cursor.to(onStage(600, 230), 800) },
    { do: wait(300) },
  ],
}
export default scene
