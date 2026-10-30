// `deck` page "A task's panel" (onboarding-lessons.md §7): 05 Launch in focus, no HUD, its `doing` column on the left.
// The hand clicks "Sign up five more cooks": its panel builds on the right (its column, who has it, its days, its card,
// its checklist); the hand goes over the panel, it scrolls down to the checklist, and the last step is ticked (shown
// with set(): `3/3` on the task too).
import { K } from '../../views/workspace/Kanban'
import { aim, cursor, onStage, set, wait, type Scene } from '../director'
import { base } from '../fixtures/kit'
import { scrollPanel, view } from '../fixtures/o10'
import { NO_HUD, calmTasks, pageStyle } from '../fixtures/o12'
import { WID, P } from '../fixtures/pazar'

const tasks = calmTasks(base.tasks)

const TASK = '[data-cell] [data-task="tk-cooks"]'
const VISITS = aim('[data-learn="card-panel"] button[aria-label="tick"]')

const scene: Scene = {
  id: 'task-panel',
  fixture: { ...base, tasks },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${P.deck}`,
  size: [640, 400],
  length: 7300,
  poster: 7200,
  cursor: onStage(150, 360),
  setup: [pageStyle('task-panel', NO_HUD)],
  steps: [
    // At 0, not in the setup: the task's panel the loop before left open, shut as it starts again, gives the deck back
    // its part of the screen as the stage settles, and this comes after it.
    { at: 0, do: view(0.86, 14 - (K.col + K.gap) * 0.86, 24) },
    { at: 300, do: cursor.to(aim(TASK, 0.45, 0.4), 900) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(1300) },
    { do: cursor.to(onStage(430, 260), 700) },
    { do: wait(250) },
    { do: scrollPanel('#checklist', 1100) },
    { do: wait(300) },
    { do: cursor.to(VISITS, 700) },
    { do: wait(300) },
    { do: cursor.press() },
    {
      do: set(
        (ws) => ({ ...ws, tasks: ws.tasks.map((t) => (t.id === 'tk-cooks' ? { ...t, checks: t.checks!.map((c) => ({ ...c, done: true })) } : t)) }),
        'the last step ticked',
      ),
    },
    { do: wait(700) },
  ],
}
export default scene
