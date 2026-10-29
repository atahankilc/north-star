// The kind guide's `timeline` row (onboarding-lessons.md §2): Pazar's launch days appear on a clear stretch of canvas,
// laid open (unframed, live), no HUD; then the hand drags one task's bar three days later with real pointer events (the
// timeline's own lift); the move it would write shown with set() at the drop.
import { aim, camera, cursor, find, onStage, set, wait, type Ctx, type Scene } from '../director'
import { CLEAR, appear, bare, base, pazarPiece } from '../fixtures/kit'
import { P } from '../fixtures/pazar'

const days = { ...pazarPiece(P.days), x: CLEAR.x, y: CLEAR.y, open: true }
const ID = 'tk-shelf'
const BAR = `[data-bar][data-task="${ID}"]`
const t0 = base.tasks.find((t) => t.id === ID)!
const DAY = 24 * 3600 * 1000
const shift = (d: string | undefined, n: number) => (d ? new Date(Date.parse(d) + n * DAY).toISOString().slice(0, 10) : d)
const span = Math.round((Date.parse(t0.due!) - Date.parse(t0.start!)) / DAY) + 1
let from = { x: 0, y: 0 }
// Three days on: the bar's own width is `span` days.
const grab = aim(BAR, 0.3, 0.5)
const to = (c: Ctx) => {
  const el = find(BAR)
  if (!el) return null
  const w = el.getBoundingClientRect().width / span
  from = grab() ?? from
  void c
  return { x: from.x + 3 * w, y: from.y }
}

const scene: Scene = {
  id: 'kind-timeline',
  fixture: { ...base, pieces: base.pieces.filter((p) => p.id !== P.days) },
  view: 'canvas',
  size: [480, 300],
  length: 4400,
  poster: 4300,
  cursor: onStage(260, 292),
  setup: [bare('kind-timeline'), camera.set(CLEAR.x + 840, CLEAR.y + 150, 0.66)],
  steps: [
    { at: 300, do: appear(days, 'the timeline appears') },
    { at: 1000, do: cursor.to(grab, 800) },
    { do: wait(300) },
    { do: cursor.drag(grab, to, 1300, set((ws) => ({ ...ws, tasks: ws.tasks.map((t) => (t.id === ID ? { ...t, start: shift(t.start, 3), due: shift(t.due, 3) } : t)) }), 'three days later')) },
    { do: wait(300) },
    { do: cursor.to(onStage(300, 292), 600) },
  ],
}
export default scene
