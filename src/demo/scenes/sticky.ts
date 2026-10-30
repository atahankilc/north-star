// `sticky-made` (onboarding-lessons.md §4), "A sticky note": a clear stretch of canvas, no HUD, two sticky notes: yours,
// yellow, long (eight lines of what to ask Jonas), and Ayla's, green, beside it; each band says who wrote it and
// when. The hand goes to yours, then to the `▾` in its band and presses it: the note folds back to its first lines
// (shown with set(), as the write would land), the rest a press away.
import { CANVAS } from '../../data/labels'
import { camera, cursor, onStage, wait, type Scene } from '../director'
import { CLEAR, base, text } from '../fixtures/kit'
import { DEMO_USER, PEOPLE } from '../fixtures/pazar'
import { DEMO_DAY } from '../clock'
import { NO_HUD, fresh, pageStyle } from '../fixtures/o11'

const ID = 'sticky'
const X = CLEAR.x
const Y = CLEAR.y
const MINE = 's-ask'
const mine = { ...text({ id: MINE, pieceId: CANVAS, kind: 'sticky', text: 'Ask Jonas before Friday:\n- which permit?\n- one fridge for two cooks?\n- who checks the labels?\n- is a lobby shelf storage?\n- a hygiene course?\n- kitchen insurance?\n- selling from a balcony?', color: 'yellow', w: 150, uid: DEMO_USER.uid, author: DEMO_USER.name, x: X, y: Y}), createdAt: DEMO_DAY - 2 * 3600_000 }
const hers = { ...text({ id: 's-ayla', pieceId: CANVAS, kind: 'sticky', text: 'Two lobbies said yes to a shelf!', color: 'green', w: 150, uid: PEOPLE.ayla.uid, author: 'Ayla', x: X + 165, y: Y}), createdAt: DEMO_DAY - 26 * 60_000 }
const NOTE = `[data-target="label:${MINE}"]`
const FOLD = `${NOTE} button[aria-label="fold the note"]`

const scene: Scene = {
  id: ID,
  fixture: { ...base, labels: [mine, hers] },
  view: 'canvas',
  size: [480, 300],
  length: 4200,
  poster: 4100,
  cursor: onStage(440, 280),
  setup: [fresh(), pageStyle(ID, NO_HUD), camera.set(X + 157, Y + 84, 1.45)],
  steps: [
    { at: 300, do: cursor.to(`${NOTE}`, 900) },
    { do: wait(400) },
    { do: cursor.to(FOLD, 600) },
    { do: wait(350) },
    { do: cursor.press() },
    {
      do: {
        what: 'folded',
        ms: 0,
        start: (c) => {
          const ws = c.store.get()
          c.store.set({ ...ws, labels: ws.labels.map((l) => (l.id === MINE ? { ...l, folded: true } : l)) })
          c.store.tell()
        },
      },
    },
    { do: wait(700) },
    { do: cursor.to(onStage(440, 280), 700) },
  ],
}
export default scene
