// The kind guide's `section` row (onboarding-lessons.md §2): a clear stretch of canvas with a heading and two sticky
// notes, no HUD. A section appears round them (what the crosshair draws, shown with set()); then the hand takes it by
// its name and moves it: what's inside goes with it (real pointer events, the section's own carry and landing marks; the
// move it would write shown with set() at the drop).
import { CANVAS, type Label } from '../../data/labels'
import { aim, camera, cursor, onCanvas, onStage, set, wait, type Scene } from '../director'
import { CLEAR, bare, base, text } from '../fixtures/kit'
import { DEMO_USER, PEOPLE } from '../fixtures/pazar'

const X = CLEAR.x
const Y = CLEAR.y
const inside: Label[] = [
  text({ id: 'sh', pieceId: CANVAS, text: 'Open questions', size: 'subheading', x: X + 25, y: Y + 50 }),
  text({ id: 's1', pieceId: CANVAS, kind: 'sticky', text: 'Which permit? Ask the Bezirksamt', color: 'yellow', w: 150, uid: DEMO_USER.uid, author: DEMO_USER.name, x: X + 25, y: Y + 125 }),
  text({ id: 's2', pieceId: CANVAS, kind: 'sticky', text: '€39 or €45 for the weekly plan?', color: 'magenta', w: 150, uid: PEOPLE.ayla.uid, author: 'Ayla', x: X + 200, y: Y + 125 }),
]
const SEC = text({ id: 'sec', pieceId: CANVAS, kind: 'section', text: 'This week', x: X, y: Y, w: 400, h: 300 })
const D = { x: 100, y: 25 }
const NAME = aim('[data-target="label:sec"]', 0.18, 0, 0, 2)

const scene: Scene = {
  id: 'kind-section',
  fixture: { ...base, labels: inside },
  view: 'canvas',
  size: [480, 300],
  length: 4400,
  poster: 4300,
  cursor: onStage(440, 290),
  setup: [bare('kind-section'), camera.set(X + 250, Y + 150, 0.72)],
  steps: [
    { at: 300, do: set((ws) => ({ ...ws, labels: [SEC, ...ws.labels] }), 'the section appears') },
    { at: 1100, do: cursor.to(NAME, 800) },
    { do: wait(300) },
    {
      do: cursor.drag(
        NAME,
        (c) => {
          const a = NAME() ?? { x: 0, y: 0 }
          const o = onCanvas(0, 0)(c)
          const d = onCanvas(D.x, D.y)(c)
          return { x: a.x + d.x - o.x, y: a.y + d.y - o.y }
        },
        1300,
        set((ws) => ({ ...ws, labels: ws.labels.map((l) => ({ ...l, x: l.x + D.x, y: l.y + D.y })) }), 'it lands, with what it holds'),
      ),
    },
    { do: wait(300) },
    { do: cursor.to(onStage(450, 292), 600) },
  ],
}
export default scene
