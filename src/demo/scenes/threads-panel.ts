// `threads-panel` page 1 (onboarding-lessons.md §8), "Every conversation": the whole screen, Pazar fitted, four threads
// in the workspace (on cards of both planes, one resolved, one mentioning you; the others new to you). The hand clicks
// the threads button bottom left: the real panel builds cell by cell, every open thread newest first, `@` and `●` on
// what's new; it presses `mentions`: only the one that names you; it opens it: the thread half builds beside the list
// with its messages, and the hand rests on its `on 02 Product ↗`, what takes you there.
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

const MIN = 60 * 1000
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
const VIEW = (v: string) => byText(`${IN} nav button`, v, 0.5, 0.5)
const ROW = byText(`${IN} ol button`, '@', 0.5, 0.4)
const THERE = byText(`${IN} header button`, 'on 02 Product', 0.4, 0.5)

const scene: Scene = {
  id: 'threads-panel',
  fixture: { ...base, threads: THREADS },
  view: 'canvas',
  // Wider than the others: the list (340 px) and the thread beside it need the room.
  size: [768, 480],
  length: 7900,
  // The thread open beside the list, the hand on `on 02 Product ↗`.
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
    // The panel builds; a look down its rows.
    { do: wait(900) },
    { do: cursor.to(VIEW('mentions'), 800) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(600) },
    { do: cursor.to(ROW, 600) },
    { do: wait(300) },
    { do: cursor.press() },
    // The thread builds beside the list; a moment, then to where it is.
    { do: wait(900) },
    { do: cursor.to(THERE, 800) },
    { do: wait(500) },
  ],
}
export default scene
