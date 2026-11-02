import type { ReactNode } from 'react'
import { example } from '../../../gallery/example'
import { CARD, type Card } from '../../../data/cards'
import type { CompetitorFeature } from '../../../data/competitorFeatures'
import { ALL_TYPES } from '../../../model/cards'
import { byCategory, foldedHeight, openHeight } from '../plane/cardInside'
import type { Facts } from '../plane/cardFacts'
import { GRID } from '../../../data/grid'
import { PackageBand, PlaneCard, type Detail } from './PlaneCard'

// Cards at their plane size (200 × 100, taller when they hold something), as in a focused plane at 100 %.
const TITLE = { customer: 'Office workers near the market', problem: 'Lunch takes too long', competitor: 'Lieferando', idea: 'Pre-order at the stall', feature: 'Order by QR code', package: 'Pickup at work' } as const
const of = (type: Card['type'], more: Partial<Card> = {}): Card => ({ id: `c-${type}`, type, pieceId: 'p', title: TITLE[type], x: 0, y: 0, ...more })
const FACTS: Record<string, Facts> = {
  customer: { head: 'testing', proof: { supports: 2, contradicts: 1, clash: false }, meta: 'for 3 problems' },
  problem: { head: 'validated', proof: { supports: 0, contradicts: 2, clash: true }, clash: true, meta: '[Office workers]' },
  competitor: { head: 'Germany · Europe', meta: '4 features' },
  idea: { head: 'hypothesis', meta: 'solves 1 problem', tasks: { done: 1, all: 3 } },
  feature: { head: 'P1', meta: 'impact high · effort low', tasks: { done: 2, all: 2 }, planes: 2 },
  package: { head: '★ 4/5', meta: '3 inside' },
}
const NONE = new Set<string>()
const at = (h = CARD.h) => ({ position: 'relative' as const, width: CARD.w, height: h })
const grid = (n: ReactNode) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', maxWidth: 3 * CARD.w + 80, alignItems: 'flex-start' }}>{n}</div>
const card = (c: Card, more: Partial<Parameters<typeof PlaneCard>[0]> = {}, h = CARD.h) => (
  <div key={c.id} style={at(h)}>
    <PlaneCard card={c} facts={FACTS[c.type]} detail="full" editor parts={0} matched={NONE} open={false} style={{ position: 'absolute', inset: 0 }} {...more} />
  </div>
)
const every = (detail: Detail) => grid(ALL_TYPES.map((t) => card(of(t), { detail })))

const features: CompetitorFeature[] = [
  { id: 'f1', competitorId: 'c-competitor', name: 'Order ahead', category: 'ordering', availability: 'free', createdAt: 0 },
  { id: 'f2', competitorId: 'c-competitor', name: 'Group order', category: 'ordering', availability: 'paid', createdAt: 0 },
  { id: 'f3', competitorId: 'c-competitor', name: 'Live tracking', category: 'delivery', availability: 'free', createdAt: 0 },
  { id: 'f4', competitorId: 'c-competitor', name: 'Office drop-off', category: 'delivery', availability: 'enterprise', createdAt: 0 },
]
const matched = new Set(['f1', 'f3'])
const parts = [
  { card: of('feature', { id: 'p1', title: 'Scan the QR', status: 'planned' }), depth: 0 },
  { card: of('feature', { id: 'p2', title: 'Pay in the browser', status: 'building' }), depth: 1 },
  { card: of('feature', { id: 'p3', title: 'Pickup number', status: 'idea' }), depth: 0 },
]
const members = [of('customer'), of('problem'), of('feature')]

export default example({
  name: 'PlaneCard',
  place: 'canvas/cards',
  also: ['canvas/pieces'],
  file: 'src/views/workspace/cards/PlaneCard.tsx',
  note: 'a card on a plane (D-187, D-358): on the card face, tinted in its type; full, compact (the title) or far (bars) by its size on screen',
  states: {
    'every type, full': () => every('full'),
    'compact (zoomed out)': () => every('compact'),
    'far (bars)': () => every('far'),
    'empty (its question)': () => grid(ALL_TYPES.map((t) => card(of(t, { title: '' }), { facts: undefined }))),
    'long title, tags': () =>
      grid(
        <>
          {card(of('idea', { title: 'Let stall owners take pre-orders from the office towers around the market before the lunch rush starts every day of the week' }))}
          {card(of('customer', { tags: ['b2c', 'berlin', 'pilot', 'lunch', 'office'] }))}
          {card(of('problem', { tags: ['time'] }))}
        </>,
      ),
    'a competitor, closed': () => grid(card(of('competitor'), { features, matched })),
    'a competitor, open': () => grid(card(of('competitor'), { features, matched, open: true }, openHeight(byCategory(features)))),
    'a feature, folded': () => grid(card(of('feature', { folded: true }), { parts: 3, rows: parts }, foldedHeight(parts.length))),
    'a feature with parts, out': () => grid(card(of('feature'), { parts: 3 })),
    'a package, folded': () => grid(card(of('package', { folded: true }), { parts: 3, rows: members.map((m) => ({ card: m, depth: 0 })), inPkg: new Map() }, foldedHeight(members.length))),
    'a package, unfolded (its band)': () => (
      <div style={{ position: 'relative', width: 3 * CARD.w, height: GRID }}>
        <PackageBand card={of('package')} facts={FACTS.package} members={members} editor onFold={() => {}} />
      </div>
    ),
    'viewer (no fold button press)': () => grid(card(of('feature'), { parts: 3, editor: false })),
  },
})
