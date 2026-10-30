// `text-made` (onboarding-lessons.md §4), "Writing on the canvas": a clear stretch of canvas, no HUD: a heading (`02 ──
// WHO WE BEAT`'s small line over `Who we beat`) and a paragraph under it. The hand clicks the heading (selected: its bar
// under it), double-clicks it: its fields open; ` on price` typed at a person's pace, `↵` keeps it (shown with set()).
// Then the bar's `H2`: the heading steps down a size (shown with set()), the bar still under it.
import { CANVAS, type Label } from '../../data/labels'
import { camera, cursor, key, onStage, run, wait, type Scene } from '../director'
import { CLEAR, base, byText, doubleClick, text, type } from '../fixtures/kit'
import { NO_HUD, fresh, pageStyle } from '../fixtures/o11'

const ID = 'text-edit'
const X = CLEAR.x
const Y = CLEAR.y
const H = text({ id: 'h-beat', pieceId: CANVAS, text: 'Who we beat', size: 'heading', kicker: '02 who we beat', x: X, y: Y })
const para = text({ id: 'p-beat', pieceId: CANVAS, size: 'note', text: 'Delivery apps win on choice. We win on **price** and on *who cooks*: a neighbour, not a chain.', scale: 'medium', w: 400, x: X, y: Y + 175 })
const HEAD = '[data-target="label:h-beat"]'
const H2 = byText('[data-learn="text-bar"] button', 'H2', 0.5, 0.5)
const relabel = (patch: Partial<Label>, what: string) => ({
  what,
  ms: 0,
  start: (c: import('../director').Ctx) => {
    const ws = c.store.get()
    c.store.set({ ...ws, labels: ws.labels.map((l) => (l.id === H.id ? { ...l, ...patch } : l)) })
    c.store.tell()
  },
})

const scene: Scene = {
  id: ID,
  fixture: { ...base, labels: [H, para] },
  view: 'canvas',
  size: [640, 400],
  length: 6900,
  poster: 6800,
  cursor: onStage(580, 360),
  setup: [fresh(), pageStyle(ID, NO_HUD), camera.set(X + 280, Y + 135, 1.1)],
  steps: [
    { at: 300, do: cursor.to(HEAD, 900) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(500) },
    { do: doubleClick(HEAD) },
    { do: wait(80) },
    // The caret at the end, as a click there puts it (the field opens with its words selected).
    { do: run(() => { const f = document.querySelector<HTMLInputElement>('[aria-label="heading text"]'); f?.setSelectionRange(f.value.length, f.value.length) }, 'caret at the end') },
    { do: wait(420) },
    ...type(' on price', 90),
    { do: wait(350) },
    { do: key('↵') },
    { do: relabel({ text: 'Who we beat on price' }, 'kept') },
    { do: wait(600) },
    { do: cursor.to(H2, 800) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: relabel({ size: 'subheading' }, 'a size down') },
    { do: wait(500) },
    { do: cursor.to(onStage(580, 360), 700) },
  ],
}
export default scene
