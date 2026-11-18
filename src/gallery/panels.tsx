// Panels in the gallery (D-324, G3): Pazar's made-up threads (demo/fixtures/threads.ts, the lessons' too) shown with
// their messages, and small changes to Pazar a panel needs to show more.
import { demoThreads } from '../data/threads'
import type { Card } from '../data/cards'
import { MESSAGES, THREADS } from '../demo/fixtures/threads'
import { DEMO_USER } from '../demo/fixtures/pazar'
import { P, PAZAR } from './canvas'

type Ws = typeof PAZAR

// The threads on Pazar, their messages readable, you as the made-up person (new ones are new to you).
export { THREADS }
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
