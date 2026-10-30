// `deck` page "Adding tasks" (onboarding-lessons.md §7): 05 Launch in focus, no HUD, framed on `to do` and `doing`. The
// hand clicks `+ add a task` under `to do`: a sheet to type in takes its place (the cyan `>`); a task is typed, Enter: it
// joins the column (the write shown with set()) and the field stays for the next; a second is typed, Enter, the same.
import type { Task } from '../../data/tasks'
import { cursor, key, onStage, set, wait, type Scene } from '../director'
import { AT, base, byText, type } from '../fixtures/kit'
import { view } from '../fixtures/o10'
import { NO_HUD, calmTasks, pageStyle } from '../fixtures/o12'
import { DEMO_USER, WID, P } from '../fixtures/pazar'

// Two in `to do`, so its foot (and what's added under it) stays in view.
const tasks = calmTasks(base.tasks).filter((t) => t.id !== 'tk-allergy' && t.id !== 'tk-plan')
const ADD = byText('[data-cell][data-col="todo"] button', '+ add a task', 0.3, 0.5)
const FIRST = 'Flyers for the Turkish market'
const SECOND = 'A stand at the Factory open day'
const typed = (id: string, title: string, n: number): Task => ({ id, pieceId: P.deck, col: 'todo', order: 50 + n, title, uid: DEMO_USER.uid, createdAt: AT + 100 + n, updatedAt: AT + 100 + n })
const add = (t: Task) => set((ws) => ({ ...ws, tasks: [...ws.tasks, t] }), `${t.title} added`)

const scene: Scene = {
  id: 'deck-add',
  fixture: { ...base, tasks },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${P.deck}`,
  size: [640, 400],
  length: 7300,
  poster: 7200,
  cursor: onStage(420, 360),
  setup: [pageStyle('deck-add', NO_HUD)],
  steps: [
    // At 0, not in the setup: what the loop before left open, shut as it starts again, refits the piece as the stage
    // settles, and this comes after it.
    { at: 0, do: view(0.85, 12, 8) },
    { at: 300, do: cursor.to(ADD, 1000) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(400) },
    { do: cursor.to(onStage(600, 330), 700) },
    ...type(FIRST, 45),
    { do: wait(250) },
    { do: key('↵') },
    { do: add(typed('tk-flyers', FIRST, 1)) },
    { do: wait(500) },
    ...type(SECOND, 45),
    { do: wait(250) },
    { do: key('↵') },
    { do: add(typed('tk-openday', SECOND, 2)) },
    { do: wait(600) },
  ],
}
export default scene
