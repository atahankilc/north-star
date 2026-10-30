// `task-card` (onboarding-lessons.md §7), "Tasks test cards": 05 Launch in focus, no HUD, its `done` column on the left.
// The pilot is finished, and its card (the pre-order idea) is still being tested, so the task offers `+ log what it
// taught`. The hand presses it: the task's panel opens on its `learned` section, what it found already written from the
// task's notes; Enter adds it: the panel reads `learned · supports it`, as evidence on the idea (shown with
// set()).
import type { Evidence } from '../../data/evidence'
import { K } from '../../views/workspace/Kanban'
import { cursor, key, onStage, set, wait, type Scene } from '../director'
import { AT, base, byText } from '../fixtures/kit'
import { scrollPanel, view } from '../fixtures/o10'
import { NO_HUD, calmTasks, pageStyle } from '../fixtures/o12'
import { WID, P } from '../fixtures/pazar'

const NOTES = '31 pre-orders in week one, from 2 cooks'
const tasks = calmTasks(base.tasks).map((t) => (t.id === 'tk-pilot' ? { ...t, notes: NOTES } : t))
const LEARNED: Evidence = { id: 'v-pilot', nodeId: 'i-preorder', nodeType: 'idea', kind: 'observation', stance: 'supports', text: `Run the two-week WhatsApp pilot: ${NOTES}`, date: '2026-10-20', createdAt: AT + 50 }

const LOG = byText('[data-task="tk-pilot"] button', '+ log what it taught', 0.3, 0.5)

const scene: Scene = {
  id: 'task-learned',
  fixture: { ...base, tasks },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${P.deck}`,
  size: [640, 400],
  length: 6100,
  poster: 6000,
  cursor: onStage(150, 360),
  setup: [pageStyle('task-learned', NO_HUD)],
  steps: [
    // At 0, not in the setup: the task's panel the loop before left open, shut as it starts again, gives the deck back
    // its part of the screen as the stage settles, and this comes after it.
    { at: 0, do: view(0.86, 14 - 3 * (K.col + K.gap) * 0.86, 24) },
    { at: 300, do: cursor.to(LOG, 1000) },
    { do: wait(400) },
    { do: cursor.press() },
    { do: wait(900) },
    // Its `learned` section brought up (as a person scrolls to it; on its own page the field's focus scrolls it too).
    { do: scrollPanel('#learned', 600) },
    { do: cursor.to(onStage(420, 250), 800) },
    { do: wait(300) },
    { do: key('↵') },
    { do: set((ws) => ({ ...ws, evidence: [...ws.evidence, LEARNED], tasks: ws.tasks.map((t) => (t.id === 'tk-pilot' ? { ...t, learned: LEARNED.id } : t)) }), 'logged on the idea') },
    { do: wait(600) },
    { do: cursor.to(onStage(330, 330), 700) },
  ],
}
export default scene
