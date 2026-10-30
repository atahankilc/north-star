// `timeline` page 2 (onboarding-lessons.md §7), "Plan by drawing": 06 Launch days in focus, by who has them, no HUD and
// no dock (its tools aren't what this is about, and wider than the stage it landed a pixel apart from one start to the
// next). The hand comes over an empty stretch of Ayla's row, the day's `+` shows; it presses and draws across three days: the new
// task's days drawn as it goes; let go, the card prompt opens (`a card it's for, or type a task…`); `shelf` typed narrows
// it, the hand picks the pickup shelf idea: the task is there, those days, for that card (the write shown with set()).
import type { Task } from '../../data/tasks'
import { resetStrip } from '../../views/workspace/Timeline'
import { cursor, find, onStage, set, wait, type Ctx, type Scene } from '../director'
import { AT, base, type } from '../fixtures/kit'
import { row, view } from '../fixtures/o10'
import { NO_HUD, pageStyle } from '../fixtures/o12'
import { DEMO_USER, PEOPLE, WID, P } from '../fixtures/pazar'

const days = base.pieces.map((p) => (p.id === P.days ? { ...p, timeline: { rows: 'assignee' as const } } : p))
// Ayla's second lane, the days before "Find two lobbies" (from the 22nd): from the 18th to the 20th (far enough from
// the strip's left edge that it doesn't scroll along).
const PPD = 48
const before = (d: number) => (c: Ctx) => {
  const bar = find('[data-bar][data-task="tk-shelf"]')?.getBoundingClientRect()
  if (!bar) return null
  return { x: bar.left - d * PPD * c.scale, y: bar.top + bar.height / 2 }
}
const FROM = before(3.5)
const TO = before(1.2)
const CARD = row('A pickup shelf')
const made: Task = { id: 'tk-drawn', pieceId: P.deck, col: 'todo', order: 99, title: 'A pickup shelf in each office lobby', assignee: PEOPLE.ayla.uid, assigneeName: PEOPLE.ayla.name, start: '2026-10-18', due: '2026-10-20', cardId: 'i-shelf', cardType: 'idea', uid: DEMO_USER.uid, createdAt: AT + 90, updatedAt: AT + 90 }

const scene: Scene = {
  id: 'timeline-draw',
  fixture: { ...base, pieces: days },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${P.days}`,
  size: [640, 400],
  length: 7400,
  poster: 7300,
  cursor: onStage(560, 300),
  setup: [pageStyle('timeline-draw', `${NO_HUD} & [data-learn="dock"] { visibility: hidden; }`), run0(), view(1, 6, 4)],
  steps: [
    { at: 300, do: cursor.to(FROM, 1000) },
    { do: wait(500) },
    { do: cursor.drag(FROM, TO, 1300) },
    { do: wait(600) },
    ...type('shelf', 90),
    { do: wait(400) },
    { do: cursor.to(CARD, 900) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: set((ws) => ({ ...ws, tasks: [...ws.tasks, made] }), 'the task is made') },
    { do: wait(400) },
    { do: cursor.to(onStage(560, 320), 800) },
  ],
}
function run0() {
  return { what: 'today, by weeks', ms: 0, start: () => resetStrip(P.days) }
}
export default scene
