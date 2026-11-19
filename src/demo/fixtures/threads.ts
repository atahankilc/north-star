// Pazar's made-up threads and their messages (D-406: the lessons' `threads-panel` scene and the gallery's panels each
// had a copy, and they'd drifted: counts, messages). The demo realm reads them from `demoThreads` (src/data/threads.ts)
// instead of Firestore; whoever shows them sets `demoThreads.messages` and who `me` is.
import type { WithId } from '../../data/hooks'
import type { ThreadMessage } from '../../data/model'
import { DEMO_DAY } from '../clock'
import { MIN } from '../time'
import { thread } from './o13'
import { DEMO_USER, P, PEOPLE } from './pazar'

export const THREADS = [
  thread('t-pickup', {
    on: 'card', targetId: 'f-pickup', planeId: P.product, count: 4, lastAt: DEMO_DAY - 12 * MIN,
    lastUid: PEOPLE.ayla.uid, lastName: 'Ayla Demir', lastText: '@You can the cut-off move to 10 pm? Cooks asked twice.', mentions: [DEMO_USER.uid],
  }),
  thread('t-break', {
    on: 'card', targetId: 'r-break', planeId: P.lunch, count: 4, lastAt: DEMO_DAY - 40 * MIN,
    lastUid: PEOPLE.jonas.uid, lastName: 'Jonas Weber', lastText: 'Ten minutes from order to desk, or they stay with the canteen.',
  }),
  thread('t-cooks', {
    on: 'card', targetId: 'c-cooks', planeId: P.lunch, count: 3, lastAt: DEMO_DAY - 3 * 60 * MIN, uid: PEOPLE.jonas.uid, name: 'Jonas Weber',
    lastUid: PEOPLE.lena.uid, lastName: 'Lena Hoffmann', lastText: 'Six of the twelve cooks cook for a living already.',
  }),
  thread('t-qr', {
    on: 'card', targetId: 'f-qr', planeId: P.product, count: 5, lastAt: DEMO_DAY - 26 * 60 * MIN, resolved: true,
    lastUid: PEOPLE.ayla.uid, lastName: 'Ayla Demir', lastText: 'Factory said yes to the shelf. Closing this.',
  }),
  // Channels (D-416): conversations on nothing, in Talk.
  thread('ch-general', {
    on: 'channel', targetId: 'general', planeId: 'talk', count: 4, lastAt: DEMO_DAY - 6 * MIN, uid: PEOPLE.jonas.uid, name: 'Jonas Weber',
    lastUid: PEOPLE.lena.uid, lastName: 'Lena Hoffmann', lastText: 'I can do Thursday. Who brings the shelf labels?',
  }),
  thread('ch-pilot', {
    on: 'channel', targetId: 'pilot', planeId: 'talk', count: 2, lastAt: DEMO_DAY - 26 * 60 * MIN, uid: PEOPLE.ayla.uid, name: 'Ayla Demir',
    lastUid: PEOPLE.ayla.uid, lastName: 'Ayla Demir', lastText: 'Nine of twenty-two came back for a second order.',
  }),
]

const msg = (id: string, who: { uid: string; name: string }, text: string, ago: number, mentions?: string[]): WithId<ThreadMessage> => ({ id, uid: who.uid, name: who.name, text, createdAt: DEMO_DAY - ago * MIN, ...(mentions ? { mentions } : {}) })
export const MESSAGES: Record<string, WithId<ThreadMessage>[]> = {
  't-pickup': [
    msg('m1', PEOPLE.ayla, 'Three cooks said 9 pm is too early: they shop after work.', 190),
    msg('m2', PEOPLE.jonas, 'Office orders mostly come in between 8 and 9 anyway.', 150),
    msg('m3', { uid: DEMO_USER.uid, name: 'You' }, 'Then 10 pm costs us nothing. Let’s ask the pilot group.', 60),
    msg('m4', PEOPLE.ayla, '@You can the cut-off move to 10 pm? Cooks asked twice.', 12, [DEMO_USER.uid]),
  ],
  // Over two days (D-405): each day's rule, the clock.
  't-cooks': [
    msg('k1', PEOPLE.jonas, 'Asked the cooks group how many cook for a living.', 26 * 60),
    msg('k2', { uid: DEMO_USER.uid, name: 'You' }, 'And?', 25 * 60),
    msg('k3', PEOPLE.lena, 'Six of the twelve cooks cook for a living already.', 3 * 60),
  ],
  'ch-general': [
    msg('g1', PEOPLE.jonas, 'Morning. Factory’s office manager wants a call this week.', 200),
    msg('g2', PEOPLE.ayla, 'Shelf at Factory is free from Thursday. Can we all be there at 11?', 34),
    msg('g3', { uid: DEMO_USER.uid, name: 'You' }, 'Yes. I’ll bring the QR stand.', 20),
    msg('g4', PEOPLE.lena, 'I can do Thursday. Who brings the shelf labels?', 6),
  ],
  'ch-pilot': [
    msg('p1', PEOPLE.jonas, 'How many came back for a second order?', 26 * 60 + 10),
    msg('p2', PEOPLE.ayla, 'Nine of twenty-two came back for a second order.', 26 * 60),
  ],
  't-break': [
    msg('b1', PEOPLE.jonas, 'Asked five people at Factory how long their break really is.', 120),
    msg('b1b', PEOPLE.jonas, 'Thirty minutes on paper, twenty once they’re back at the desk.', 118),
    msg('b2', PEOPLE.lena, 'And?', 90),
    msg('b3', PEOPLE.jonas, 'Ten minutes from order to desk, or they stay with the canteen.', 40),
  ],
}

