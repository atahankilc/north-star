// `comment` page 1 (onboarding-lessons.md §8), "Comments stay on things": 01 Lunch in focus, one card already talked
// about (its chip under its corner, `3`). The hand right-clicks another problem card: the real menu, `comment`; the real
// thread opens bottom left, its field taking the keys; `@Jonas test 12 dishes?` is typed, `↵`: the thread is on the
// card now, its chip under the card's corner (what sending would write, shown with set(); the panel is closed so the
// chip shows: an open thread's messages load from Firestore, which the demo hasn't got), the view closes in on the
// card, and the hand rests on the chip.
import { closeThread } from '../../views/workspace/Threads'
import { aim, camera, cursor, inFocus, key, run, set, wait, type Scene } from '../director'
import { base, rightClick, type } from '../fixtures/kit'
import { calm, thread, cornerOnly } from '../fixtures/o13'
import { closeIn } from '../fixtures/o10'
import { P, PEOPLE } from '../fixtures/pazar'
import { DEMO_DAY } from '../clock'

const CARD = '[data-target="card:r-same"]'
const COMMENT = '[role="menu"] [data-key="comment"]'
const TYPED = '@Jonas test 12 dishes?'
const on = aim(CARD, 0.5, 0.55)
// The chip under the card's bottom-right corner, once it's there.
const CHIP = aim('[aria-label="Comments, 1"]', 0.5, 0.5)

const OLD = thread('t-break', {
  on: 'card',
  targetId: 'r-break',
  planeId: P.lunch,
  count: 3,
  lastUid: PEOPLE.jonas.uid,
  lastName: PEOPLE.jonas.name,
  lastText: 'Ten minutes from order to desk, or they stay with the canteen.',
})
const NEW = thread('t-same', {
  on: 'card',
  targetId: 'r-same',
  planeId: P.lunch,
  uid: '',
  name: 'You',
  count: 1,
  lastUid: '',
  lastName: 'You',
  lastText: TYPED,
  mentions: [PEOPLE.jonas.uid],
  lastAt: DEMO_DAY,
  createdAt: DEMO_DAY,
  updatedAt: DEMO_DAY,
})

const scene: Scene = {
  id: 'thread',
  fixture: { ...base, threads: [OLD] },
  view: 'focus',
  route: `/workspaces/${base.wid}?focus=${P.lunch}`,
  size: [640, 400],
  length: 7800,
  // The new chip under the card, the hand on it.
  poster: 7750,
  cursor: inFocus(700, 700),
  // The problems and customers in view, big enough to read; the thread opens bottom left over the customers.
  setup: [cornerOnly('thread'), calm(), camera.frame({ x: 0, y: 0, w: 900, h: 560 }, 20)],
  steps: [
    { at: 300, do: cursor.to(on, 900) },
    { do: wait(400) },
    { do: rightClick(on) },
    { do: wait(550) },
    { do: cursor.to(aim(COMMENT, 0.3, 0.5), 700) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(400) },
    ...type(TYPED, 45),
    { do: wait(350) },
    { do: key('↵', 800) },
    {
      do: set((ws) => ({ ...ws, threads: [...ws.threads, NEW] }), 'the thread is on the card'),
    },
    { do: run(() => closeThread(), 'the thread closes') },
    // Closer on the card (the problem at column 2, row 1 of Pazar's plane) and its new chip, so the chip reads small.
    { do: closeIn({ x: 300, y: 40, w: 520, h: 300 }, 700) },
    { do: cursor.to(CHIP, 800) },
    { do: wait(500) },
  ],
}
export default scene
