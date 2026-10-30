// `section-draw` (onboarding-lessons.md §4), "Draw a section": a clear stretch of canvas, no HUD, a heading and two
// sticky notes. The crosshair's hint is up (the `+` menu's `section`); the hand drags a frame round the three, the real
// one drawn as it goes. Let go, the section is there (shown with set(), as the write would land) with its name being
// typed: `This week`, `↵`. Then the hand takes it by its name and moves it: what's inside goes with it (its own carry
// and landing marks; the move shown with set() at the drop).
import { CANVAS, type Label } from '../../data/labels'
import { useCanvasView } from '../../state/canvasView'
import { aim, camera, cursor, key, onCanvas, onStage, run, wait, type Ctx, type Scene } from '../director'
import { CLEAR, base, text, type } from '../fixtures/kit'
import { DEMO_USER, PEOPLE } from '../fixtures/pazar'
import { NO_HUD, fresh, pageStyle } from '../fixtures/o11'

const ID = 'section'
const X = CLEAR.x
const Y = CLEAR.y
const inside: Label[] = [
  text({ id: 'sh', pieceId: CANVAS, text: 'Open questions', size: 'subheading', x: X + 25, y: Y + 50 }),
  text({ id: 's1', pieceId: CANVAS, kind: 'sticky', text: 'Which permit? Ask the Bezirksamt', color: 'yellow', w: 150, uid: DEMO_USER.uid, author: DEMO_USER.name, x: X + 25, y: Y + 125 }),
  text({ id: 's2', pieceId: CANVAS, kind: 'sticky', text: '€39 or €45 for the weekly plan?', color: 'magenta', w: 150, uid: PEOPLE.ayla.uid, author: 'Ayla', x: X + 200, y: Y + 125 }),
]
const SEC = text({ id: 'sec', pieceId: CANVAS, kind: 'section', text: '', x: X, y: Y, w: 400, h: 300 })
const D = { x: 75, y: 0 }
const NAME = aim('[data-target="label:sec"]', 0.2, 0, 0, 2)
const change = (f: (ls: Label[]) => Label[], what: string) => ({
  what,
  ms: 0,
  start: (c: Ctx) => {
    const ws = c.store.get()
    c.store.set({ ...ws, labels: f(ws.labels) })
    c.store.tell()
  },
})

const scene: Scene = {
  id: ID,
  fixture: { ...base, labels: inside },
  view: 'canvas',
  size: [480, 300],
  length: 7800,
  poster: 7700,
  cursor: onStage(30, 20),
  // Drawing a section, as the `+` menu's `section` leaves the canvas: the crosshair and its hint.
  setup: [fresh(), pageStyle(ID, NO_HUD), camera.set(X + 235, Y + 128, 0.7), run(() => useCanvasView.setState({ drawing: CANVAS }), 'drawing')],
  steps: [
    { at: 300, do: cursor.to(onCanvas(X - 6, Y - 6), 700) },
    { do: wait(300) },
    {
      do: cursor.drag(onCanvas(X - 6, Y - 6), onCanvas(X + 398, Y + 298), 1300),
    },
    // The section the release would have made, its name being typed (after the refused write's own answer).
    { do: wait(60) },
    { do: change((ls) => [SEC, ...ls.filter((l) => l.id !== SEC.id)], 'the section') },
    { do: run(() => useCanvasView.setState({ labelSelected: SEC.id, labelEditing: SEC.id, fresh: SEC.id }), 'naming it') },
    { do: wait(400) },
    ...type('This week', 80),
    { do: wait(250) },
    { do: key('↵') },
    { do: change((ls) => ls.map((l) => (l.id === SEC.id ? { ...l, text: 'This week' } : l)), 'named') },
    { do: wait(500) },
    { do: cursor.to(NAME, 700) },
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
        1200,
        change((ls) => ls.map((l) => ({ ...l, x: l.x + D.x, y: l.y + D.y })), 'it lands, with what it holds'),
      ),
    },
    { do: wait(200) },
  ],
}
export default scene
