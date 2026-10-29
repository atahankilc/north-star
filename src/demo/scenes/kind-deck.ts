// The kind guide's `deck…` row (onboarding-lessons.md §2): Pazar's launch deck (its `doing` and `review` columns) appears on a clear stretch of canvas,
// laid open there (unframed, live), no HUD; then the hand takes a task from `doing` to `review` with real pointer events,
// so the deck's own lift and cyan drop line show; the move it would write shown with set() at the drop.
import { aim, camera, cursor, find, onStage, set, wait, type Scene } from '../director'
import { CLEAR, appear, bare, base, pazarPiece } from '../fixtures/kit'
import { P } from '../fixtures/pazar'

const DAY = 24 * 3600 * 1000
// A week later than Pazar's, so no SOON band over the columns (not what this one is about).
const later = (d?: string) => (d ? new Date(Date.parse(d) + 7 * DAY).toISOString().slice(0, 10) : d)
// Two of its columns, `doing` and `review`, so the whole deck (its name too) reads in the slot.
const full = pazarPiece(P.deck)
const cols = full.kanban!.cols.filter((c) => c.id === 'doing' || c.id === 'review')
const tasks = base.tasks.filter((t) => t.col === 'doing' || t.col === 'review').map((t) => ({ ...t, due: later(t.due), start: later(t.start) }))
const deck = { ...full, kanban: { ...full.kanban!, cols }, x: CLEAR.x, y: CLEAR.y, open: true }
const TASK = '[data-cell] [data-task="tk-cutoff"]'
const dropAt = () => {
  const col = find('[data-cell][data-col="review"]')
  if (!col) return null
  const last = [...col.querySelectorAll('[data-task]')].at(-1)?.getBoundingClientRect()
  const r = col.getBoundingClientRect()
  return { x: r.left + r.width * 0.45, y: (last ? last.bottom : r.top) + 30 }
}

const scene: Scene = {
  id: 'kind-deck',
  fixture: { ...base, tasks, pieces: base.pieces.filter((p) => p.id !== P.deck) },
  view: 'canvas',
  size: [480, 300],
  length: 4500,
  poster: 4400,
  cursor: onStage(300, 290),
  // `doing` and `review` in view.
  setup: [bare('kind-deck'), camera.set(CLEAR.x + 292, CLEAR.y + 175, 0.75)],
  steps: [
    { at: 300, do: appear(deck, 'the deck appears') },
    { at: 1000, do: cursor.to(aim(TASK, 0.4, 0.45), 800) },
    { do: wait(300) },
    {
      do: cursor.drag(
        aim(TASK, 0.4, 0.45),
        dropAt,
        1400,
        set((ws) => {
          const order = Math.max(0, ...ws.tasks.filter((t) => t.col === 'review').map((t) => t.order)) + 1
          return { ...ws, tasks: ws.tasks.map((t) => (t.id === 'tk-cutoff' ? { ...t, col: 'review', order } : t)) }
        }, 'the task lands in review'),
      ),
    },
    { do: wait(300) },
    { do: cursor.to(onStage(330, 292), 600) },
  ],
}
export default scene
