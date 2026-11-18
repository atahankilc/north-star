// `comment` "Every conversation" (lessons.ts, D-349): the whole screen, Pazar fitted, four threads
// in the workspace (on cards of both planes, one resolved, one mentioning you; the others new to you). The hand clicks
// the threads tool in the HUD's corner (D-402): the real list is uncovered on the left, under the screen (D-393), what's
// new on top under `NEW` (D-405), the resolved one behind a word at its foot; it opens the one that names you: the
// conversation builds on the right (the stage is narrow, so the list gives way to it), and the hand rests on its head,
// the card it's on, which takes you there.
// The messages, what you've read and who you are are the demo's (data/threads.ts' `demoThreads`, read instead of
// Firestore in the demo realm).
import type { WithId } from '../../data/hooks'
import type { ThreadMessage } from '../../data/model'
import { demoThreads } from '../../data/threads'
import { cursor, onStage, run, wait, type Scene } from '../director'
import { base, byText } from '../fixtures/kit'
import { calm, cornerOnly, thread } from '../fixtures/o13'
import { DEMO_USER, P, PEOPLE } from '../fixtures/pazar'
import { DEMO_DAY } from '../clock'
import { MIN } from '../time'

const THREADS = [
  thread('t-pickup', {
    on: 'card', targetId: 'f-pickup', planeId: P.product, count: 4, lastAt: DEMO_DAY - 12 * MIN,
    lastUid: PEOPLE.ayla.uid, lastName: 'Ayla Demir', lastText: '@You can the cut-off move to 10 pm? Cooks asked twice.',
    mentions: [DEMO_USER.uid],
  }),
  thread('t-break', {
    on: 'card', targetId: 'r-break', planeId: P.lunch, count: 3, lastAt: DEMO_DAY - 40 * MIN,
    lastUid: PEOPLE.jonas.uid, lastName: 'Jonas Weber', lastText: 'Ten minutes from order to desk, or they stay with the canteen.',
  }),
  thread('t-cooks', {
    on: 'card', targetId: 'c-cooks', planeId: P.lunch, count: 2, lastAt: DEMO_DAY - 3 * 60 * MIN, uid: PEOPLE.jonas.uid, name: 'Jonas Weber',
    lastUid: PEOPLE.lena.uid, lastName: 'Lena Hoffmann', lastText: 'Six of the twelve cooks cook for a living already.',
  }),
  thread('t-qr', {
    on: 'card', targetId: 'f-qr', planeId: P.product, count: 5, lastAt: DEMO_DAY - 26 * 60 * MIN, resolved: true,
    lastUid: PEOPLE.ayla.uid, lastName: 'Ayla Demir', lastText: 'Factory said yes to the shelf. Closing this.',
  }),
]
const msg = (id: string, who: { uid: string; name: string }, text: string, ago: number, mentions?: string[]): WithId<ThreadMessage> => ({ id, uid: who.uid, name: who.name, text, createdAt: DEMO_DAY - ago * MIN, ...(mentions ? { mentions } : {}) })
const MESSAGES: Record<string, WithId<ThreadMessage>[]> = {
  't-pickup': [
    msg('m1', PEOPLE.ayla, 'Three cooks said 9 pm is too early: they shop after work.', 190),
    msg('m2', PEOPLE.jonas, 'Office orders mostly come in between 8 and 9 anyway.', 150),
    msg('m3', { uid: DEMO_USER.uid, name: 'You' }, 'Then 10 pm costs us nothing. Let’s ask the pilot group.', 60),
    msg('m4', PEOPLE.ayla, '@You can the cut-off move to 10 pm? Cooks asked twice.', 12, [DEMO_USER.uid]),
  ],
}
const IN = '[data-learn="threads"]'
// The row that names you, under `NEW`: it leads with its thing's kind (D-398).
const ROW = byText(`${IN} ol button`, 'feature', 0.5, 0.3)
// The conversation's head, the card it's on (D-405): where it is, on its last line.
const THERE = byText('[data-learn="thread-column"] header [role="button"]', 'feature', 0.3, 0.8)

const scene: Scene = {
  id: 'threads-panel',
  fixture: { ...base, threads: THREADS },
  view: 'canvas',
  // Wider than the others: the list (400 px) beside the screen needs the room.
  size: [768, 480],
  length: 7900,
  // The conversation open on the right, the hand on the card it's on.
  poster: 7800,
  cursor: onStage(560, 200),
  setup: [
    cornerOnly('threads-panel'),
    calm(),
    run(() => {
      demoThreads.me = DEMO_USER.uid
      demoThreads.messages = MESSAGES
    }, 'the threads’ messages'),
  ],
  steps: [
    { at: 300, do: cursor.to('[aria-label^="Threads"]', 1000) },
    { do: wait(400) },
    { do: cursor.press() },
    // The panel opens; a look down what's new.
    { do: wait(1500) },
    { do: cursor.to(ROW, 900) },
    { do: wait(300) },
    { do: cursor.press() },
    // The conversation builds on the right; a moment, then to where it is.
    { do: wait(900) },
    { do: cursor.to(THERE, 800) },
    { do: wait(500) },
  ],
}
export default scene
