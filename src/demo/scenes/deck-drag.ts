// A deck in focus (onboarding-lessons.md `deck` page 1, "Moving work along"): the cursor takes a task from `doing` and
// drags it to `review` with real pointer events, so the deck's own lift and cyan drop line show; the move it would
// write is shown with set() at the drop, so the task stays where it landed.
import { K } from '../../views/workspace/Kanban'
import { aim, camera, cursor, find, set, wait, type Scene, type Ctx } from '../director'
import { pazar, workspace, WID, P } from '../fixtures/pazar'

const TASK = 'tk-cutoff'
const task = `[data-task="${TASK}"]`
// Under the last task in `review`.
const dropAt = () => {
  const col = find('[data-cell][data-col="review"]')
  if (!col) return null
  const tasks = [...col.querySelectorAll('[data-task]')]
  const r = col.getBoundingClientRect()
  const last = tasks.at(-1)?.getBoundingClientRect()
  return { x: r.left + r.width * 0.45, y: (last ? last.bottom : r.top) + 46 }
}

// The deck's tasks a week later than Pazar's: nothing due this week, so no SOON band over the columns (it isn't what this
// scene is about).
const DAY = 24 * 3600 * 1000
const later = (d?: string) => (d ? new Date(Date.parse(d) + 7 * DAY).toISOString().slice(0, 10) : d)
const tasks = pazar.tasks.map((t) => (t.col === 'done' ? t : { ...t, due: later(t.due), start: later(t.start) }))

const scene: Scene = {
  id: 'deck-drag',
  fixture: { ...pazar, tasks, wid: WID, workspace },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${P.deck}`,
  size: [960, 600],
  length: 4600,
  poster: 3900,
  cursor: (c: Ctx) => ({ x: c.size.w * 0.42 * c.scale, y: c.size.h * 0.8 * c.scale }),
  // `doing` and `review` in the middle, big enough to read, `to do` and `done` cut by the edges.
  setup: [camera.frame({ x: K.col + K.gap - 60, y: -10, w: 2 * K.col + K.gap + 120, h: 400 }, 24)],
  steps: [
    { at: 300, do: cursor.to(aim(task, 0.4, 0.45), 1000) },
    { do: wait(400) },
    {
      do: cursor.drag(
        aim(task, 0.4, 0.45),
        dropAt,
        1700,
        set((ws) => {
          const order = Math.max(0, ...ws.tasks.filter((t) => t.col === 'review').map((t) => t.order)) + 1
          return { ...ws, tasks: ws.tasks.map((t) => (t.id === TASK ? { ...t, col: 'review', order } : t)) }
        }, 'the task lands in review'),
      ),
    },
    { do: wait(400) },
    { do: cursor.to((c: Ctx) => ({ x: c.size.w * 0.62 * c.scale, y: c.size.h * 0.8 * c.scale }), 800) },
  ],
}
export default scene
