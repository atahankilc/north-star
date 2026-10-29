// The smallest made-up workspace (D-315's O0 spike): one canvas, one plane "Pazar", six cards and three links. Typed as
// the app's own WorkspaceData, so the compiler says when a shape changes. Pazar is a made-up startup: home cooks selling
// tomorrow's lunch to office workers nearby.
import type { WithId } from '../../data/hooks'
import type { Piece, Workspace } from '../../data/model'
import type { WorkspaceData } from '../../data/workspaceData'
import type { Card } from '../../data/cards'
import { MAIN } from '../../data/canvases'

// The demo's person (no Firebase user: the demo realm has none).
export const DEMO_USER = { uid: 'demo', name: 'You' }

export const WID = 'demo'
export const PLANE = 'pazar'

// A fixed moment, so every run draws the same ("2m ago" and the like don't drift between shots).
const AT = Date.UTC(2026, 9, 20, 9, 0)

export const workspace: WithId<Workspace> = {
  id: WID,
  name: 'Pazar',
  description: 'Home cooks sell tomorrow’s lunch to the offices round the corner.',
  ownerId: DEMO_USER.uid,
  memberIds: [DEMO_USER.uid],
  roles: { [DEMO_USER.uid]: 'owner' },
  inviteCode: '',
  createdAt: AT,
}

const plane: WithId<Piece> = { id: PLANE, kind: 'plane', x: 0, y: 0, w: 1000, h: 650, name: 'Pazar', createdAt: AT, updatedAt: AT }

const card = (c: Omit<Card, 'pieceId'>): Card => ({ pieceId: PLANE, ...c })

const cards: Card[] = [
  card({ id: 'c-office', type: 'customer', title: 'Office workers', x: 0, y: 0, validation: 'testing', tags: ['b2c'] }),
  card({ id: 'p-greasy', type: 'problem', title: 'Delivery lunch is greasy and costs €14 or more', x: 300, y: 0, validation: 'validated' }),
  card({ id: 'k-wolt', type: 'competitor', title: 'Wolt', x: 600, y: 0, regions: ['Europe'], description: 'Restaurant delivery in 25 countries' }),
  card({ id: 'c-cooks', type: 'customer', title: 'Retired cooks', x: 0, y: 225, validation: 'hypothesis' }),
  card({ id: 'i-preorder', type: 'idea', title: 'Home cooks sell tomorrow’s lunch the night before', x: 300, y: 225, validation: 'testing' }),
  card({ id: 'f-pickup', type: 'feature', title: 'Pre-order by 9 pm, pick up at noon', x: 600, y: 225, priority: 'P1', status: 'planned', impact: 'high', effort: 'M' }),
]

export const tiny: WorkspaceData = {
  canvases: [{ id: MAIN, name: 'Main', order: 0, createdAt: AT }],
  pieces: [plane],
  spots: [],
  cards,
  labels: [],
  threads: [],
  cells: [],
  // What backs the statuses: the validated problem has three for it, so it reads `validated`, not `validated !` (D-137).
  evidence: [
    { id: 'v-interviews', nodeId: 'p-greasy', nodeType: 'problem', kind: 'interview', stance: 'supports', text: '9 of 12 said they skip delivery lunch most days because it’s heavy and dear', source: 'Interviews, Kreuzberg offices', date: '2026-09-18', createdAt: AT },
    { id: 'v-survey', nodeId: 'p-greasy', nodeType: 'problem', kind: 'data', stance: 'supports', text: 'Average delivery lunch: €14.60 with fees, 41 minutes', source: 'Survey, 86 office workers', date: '2026-09-25', createdAt: AT },
    { id: 'v-quote', nodeId: 'p-greasy', nodeType: 'problem', kind: 'quote', stance: 'supports', text: '“By two I’m asleep at my desk.”', source: 'Lena, UX designer', date: '2026-09-18', createdAt: AT },
    { id: 'v-office', nodeId: 'c-office', nodeType: 'customer', kind: 'observation', stance: 'supports', text: 'A queue of 20 at the one salad bar on Oranienstraße at 12:30', source: 'Two lunchtimes watched', date: '2026-09-22', createdAt: AT },
    { id: 'v-preorder', nodeId: 'i-preorder', nodeType: 'idea', kind: 'data', stance: 'supports', text: '31 pre-orders in the first week of the WhatsApp test', source: 'Pilot, 2 cooks', date: '2026-10-09', createdAt: AT },
    { id: 'v-cutoff', nodeId: 'i-preorder', nodeType: 'idea', kind: 'interview', stance: 'contradicts', text: 'Ordering the night before is too early for some', source: 'Pilot follow-up calls', date: '2026-10-14', createdAt: AT },
  ],
  competitorFeatures: [
    { id: 'w-tracking', competitorId: 'k-wolt', name: 'Live courier tracking', category: 'delivery', availability: 'free', createdAt: AT },
    { id: 'w-plus', competitorId: 'k-wolt', name: 'Wolt+ free delivery', category: 'pricing', availability: 'paid', createdAt: AT },
  ],
  comparisons: [],
  edges: [
    { id: 'e-solves', fromId: 'i-preorder', fromType: 'idea', toId: 'p-greasy', toType: 'problem', kind: 'solves' },
    { id: 'e-needs', fromId: 'i-preorder', fromType: 'idea', toId: 'c-cooks', toType: 'customer', kind: 'depends-on' },
    { id: 'e-inspired', fromId: 'f-pickup', fromType: 'feature', toId: 'i-preorder', toType: 'idea', kind: 'inspired-by' },
    // A plane hides `for` and `competes-with` lines until its filter shows them (D-233): these only count on the cards
    // (`2 tagged for them`, `vs 1`).
    { id: 'e-for-problem', fromId: 'p-greasy', fromType: 'problem', toId: 'c-office', toType: 'customer', kind: 'for' },
    { id: 'e-for-cooks', fromId: 'i-preorder', fromType: 'idea', toId: 'c-cooks', toType: 'customer', kind: 'for' },
    { id: 'e-competes', fromId: 'k-wolt', fromType: 'competitor', toId: 'p-greasy', toType: 'problem', kind: 'competes-with' },
  ],
  documents: [],
  tasks: [],
  places: [],
}
