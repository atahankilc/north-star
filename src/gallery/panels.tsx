// Panels in the gallery (D-324, G3): Pazar's made-up threads and their messages (the demo realm reads them from
// `demoThreads`, src/data/threads.ts, instead of Firestore), and small changes to Pazar a panel needs to show more.
import { demoThreads } from '../data/threads'
import type { WithId } from '../data/hooks'
import type { ThreadMessage } from '../data/model'
import type { Card } from '../data/cards'
import { thread } from '../demo/fixtures/o13'
import { DEMO_USER, PEOPLE } from '../demo/fixtures/pazar'
import { DEMO_DAY } from '../demo/clock'
import { P, PAZAR } from './canvas'

type Ws = typeof PAZAR
const MIN = 60 * 1000

export const THREADS = [
  thread('t-pickup', {
    on: 'card', targetId: 'f-pickup', planeId: P.product, count: 4, lastAt: DEMO_DAY - 12 * MIN,
    lastUid: PEOPLE.ayla.uid, lastName: 'Ayla Demir', lastText: '@You can the cut-off move to 10 pm? Cooks asked twice.', mentions: [DEMO_USER.uid],
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
  't-break': [
    msg('b1', PEOPLE.jonas, 'Asked five people at Factory how long their break really is.', 120),
    msg('b2', PEOPLE.lena, 'And?', 90),
    msg('b3', PEOPLE.jonas, 'Ten minutes from order to desk, or they stay with the canteen.', 40),
  ],
}

// The threads on Pazar, their messages readable, you as the made-up person (new ones are new to you).
export const withThreads = (ws: Ws): Ws => ({ ...ws, threads: THREADS })
export function threadMessages() {
  demoThreads.me = DEMO_USER.uid
  demoThreads.messages = MESSAGES
  demoThreads.seen = {}
}

// A package round three of 02 Product's features (D-239).
export const PACKAGE: Card = { id: 'pk-launch', type: 'package', pieceId: P.product, title: 'Launch at Factory', x: 0, y: 0, memberIds: ['f-pickup', 'f-qr', 'f-counter'] }
export const withPackage = (ws: Ws): Ws => ({ ...ws, cards: [...ws.cards, PACKAGE] })

// A competitor's feature matched to ours (D-133's `≈ our`), so a feature's panel has a `matched by` row.
export const withMatch = (ws: Ws): Ws => ({ ...ws, comparisons: [{ id: 'cmp-1', featureId: 'f-pickup', competitorId: 'k-shef', competitorFeatureId: 's-1' }] })

// Two parts under the pre-order feature (D-225).
export const withParts = (ws: Ws): Ws => ({
  ...ws,
  cards: [
    ...ws.cards,
    { ...ws.cards.find((c) => c.id === 'f-pickup')!, id: 'f-cutoff', title: 'Order cut-off at 9 pm', status: 'shipped', priority: undefined, criteria: undefined, x: 0, y: 450 },
    { ...ws.cards.find((c) => c.id === 'f-pickup')!, id: 'f-slot', title: 'Pickup slot at checkout', status: 'building', priority: undefined, criteria: undefined, x: 225, y: 450 },
  ],
  edges: [
    ...ws.edges,
    { id: 'po-cutoff', fromId: 'f-cutoff', fromType: 'feature', toId: 'f-pickup', toType: 'feature', kind: 'part-of' },
    { id: 'po-slot', fromId: 'f-slot', fromType: 'feature', toId: 'f-pickup', toType: 'feature', kind: 'part-of' },
  ],
})
