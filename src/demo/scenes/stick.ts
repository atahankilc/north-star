// `stick-hint` (onboarding-lessons.md §2), "Stick it to a plane": a plane and a features table beside it on the canvas,
// the table in edit mode, no HUD. The hand takes the table and moves it to the plane's right edge: near it the table
// snaps one step out and shows it'll link (the real stick hint); let go, it's stuck (`⇆ 02 Product` on it), its rows
// now the plane's (what the drop would write shown with set()).
import { setEditing } from '../../state/canvasView'
import { aim, camera, cursor, onCanvas, onStage, run, set, wait, type Ctx, type Scene } from '../director'
import { CLEAR, TABLE_F, bare, lensFixture, tableF } from '../fixtures/kit'

const T = `[data-target="plane:${TABLE_F}"]`
const GRAB = aim(T, 0.45, 0.5)
const DONE = `${T} [role="toolbar"] button[aria-pressed="true"]`
// Narrower than Pazar's (375), so the plane and the table are both whole in view; where it starts: a little right of
// the plane and lower, free.
const START = { x: CLEAR.x + 600, y: CLEAR.y + 75, w: 375 }
const stuck = tableF(true, { w: START.w })
// Where its grab point lands: the table's left edge one step off the plane's right one.
const to = (c: Ctx) => {
  const free = START
  const a = GRAB()
  if (!a) return null
  const from = onCanvas(free.x, free.y)(c)
  const there = onCanvas(stuck.x, stuck.y)(c)
  return { x: a.x + there.x - from.x, y: a.y + there.y - from.y }
}

const scene: Scene = {
  id: 'stick',
  fixture: lensFixture(false, START),
  view: 'canvas',
  // A little larger than most (still 16:10): the plane, the table and its edit console whole.
  size: [768, 480],
  length: 6600,
  poster: 6500,
  cursor: onStage(560, 380),
  setup: [bare('stick'), camera.set(CLEAR.x + 487, CLEAR.y + 190, 0.74), run(() => setEditing(TABLE_F, true), 'in edit mode')],
  steps: [
    { at: 300, do: cursor.to(GRAB, 900) },
    { do: wait(350) },
    { do: cursor.drag(GRAB, to, 1700, set((ws) => ({ ...ws, pieces: ws.pieces.map((p) => (p.id === TABLE_F ? { ...stuck, createdAt: p.createdAt, updatedAt: p.updatedAt } : p)) }), 'stuck')) },
    { do: wait(400) },
    // `done` on its console: edit mode ends; the bond and `⇆ 02 Product` stay.
    { do: cursor.to(DONE, 700) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(400) },
    { do: cursor.to(onStage(600, 60), 700) },
    { do: wait(700) },
  ],
}
export default scene
