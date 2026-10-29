// The rich made-up workspace every scene draws from (D-315, docs/specs/onboarding.md §6.4): "Pazar", a marketplace where
// home cooks sell tomorrow's lunch to the offices round the corner. 6 customers, 8 problems, 5 competitors with their
// features, 6 ideas, 8 features, links, a matrix, a table, a deck of 12 tasks, a timeline and two documents, on one
// canvas. Typed as the app's own WorkspaceData, so the compiler says when a shape changes. Words that read like a real
// startup's (never lorem, never "Card 1"); customers' names short, as long ones crowd a card's meta line. Every id and
// time fixed, so every run draws the same.
import type { WithId } from '../../data/hooks'
import type { Piece, Workspace } from '../../data/model'
import type { WorkspaceData } from '../../data/workspaceData'
import type { Card, CardType } from '../../data/cards'
import type { Edge } from '../../data/edges'
import type { Evidence } from '../../data/evidence'
import type { CompetitorFeature } from '../../data/competitorFeatures'
import type { Cell, MatrixSetup } from '../../data/matrix'
import type { TableSetup } from '../../data/table'
import type { KanbanSetup, Task } from '../../data/tasks'
import type { Doc } from '../../data/documents'
import { SCALES } from '../../data/scales'
import { MAIN } from '../../data/canvases'
import { DEMO_DAY } from '../clock'

export const WID = 'pazar'
export const DEMO_USER = { uid: 'demo', name: 'You' }
// A week before the demo's day, so "2m ago"-style times read as last week's work.
const AT = DEMO_DAY - 7 * 24 * 3600 * 1000

// The team (only names: the demo has no accounts).
export const PEOPLE = { you: { uid: 'demo', name: 'You' }, ayla: { uid: 'u-ayla', name: 'Ayla Demir' }, jonas: { uid: 'u-jonas', name: 'Jonas Weber' }, lena: { uid: 'u-lena', name: 'Lena Hoffmann' } }

export const workspace: WithId<Workspace> = {
  id: WID,
  name: 'Pazar',
  description: 'Home cooks sell tomorrow’s lunch to the offices round the corner.',
  ownerId: DEMO_USER.uid,
  memberIds: [DEMO_USER.uid, PEOPLE.ayla.uid, PEOPLE.jonas.uid, PEOPLE.lena.uid],
  roles: { [DEMO_USER.uid]: 'owner', [PEOPLE.ayla.uid]: 'editor', [PEOPLE.jonas.uid]: 'editor', [PEOPLE.lena.uid]: 'viewer' },
  inviteCode: '',
  createdAt: AT,
}

// ——— pieces on the canvas ———

export const P = { lunch: 'p-lunch', product: 'p-product', matrix: 'm-cover', table: 't-features', deck: 'k-launch', days: 'l-launch', docs: 'd-research' }

const piece = (id: string, p: Omit<Piece, 'createdAt' | 'updatedAt'>, n: number): WithId<Piece> => ({ id, ...p, createdAt: AT + n * 60_000, updatedAt: AT + n * 60_000 })

const step = (n: number) => SCALES[0].steps[n].id

const matrix: MatrixSetup = {
  rows: { type: 'feature', plane: P.product, items: [], noun: 'features' },
  cols: { type: 'competitor', items: [] },
  cell: 'scale',
  steps: SCALES[0].steps,
  notRelevant: true,
  confidence: true,
  reading: true,
}

const table: TableSetup = {
  rows: { rules: [{ field: 'type', values: ['feature'] }], items: [] },
  cols: [
    { id: 'tc-status', field: 'status' },
    { id: 'tc-priority', field: 'priority' },
    { id: 'tc-impact', field: 'impact' },
    { id: 'tc-effort', field: 'effort' },
    { id: 'tc-cost', name: 'cost / month', kind: 'number', unit: '€' },
  ],
  sort: { col: 'tc-priority' },
}

const deck: KanbanSetup = {
  cols: [
    { id: 'todo', name: 'to do' },
    { id: 'doing', name: 'doing', limit: 3 },
    { id: 'review', name: 'review' },
    { id: 'done', name: 'done', done: true },
  ],
}

export const pieces: WithId<Piece>[] = [
  piece(P.lunch, { kind: 'plane', x: 0, y: 0, w: 1200, h: 725, name: '01 Lunch' }, 1),
  piece(P.product, { kind: 'plane', x: 1300, y: 0, w: 1200, h: 725, name: '02 Product' }, 2),
  piece(P.matrix, { kind: 'matrix', x: 2600, y: 0, w: 900, h: 600, name: '03 Who covers what', matrix }, 3),
  piece(P.table, { kind: 'table', x: 2600, y: 700, w: 900, h: 450, name: '04 Features', table }, 4),
  piece(P.deck, { kind: 'kanban', x: 0, y: 850, w: 1200, h: 600, name: '05 Launch', kanban: deck }, 5),
  piece(P.days, { kind: 'timeline', x: 1300, y: 850, w: 1200, h: 450, name: '06 Launch days', timeline: { rows: 'kanban' } }, 6),
  piece(P.docs, { kind: 'documents', x: 1300, y: 1400, w: 1200, h: 350, name: '07 Research', documents: { view: 'table', pageSize: 10 } }, 7),
]

// ——— cards ———

const COL = 225
const ROW = 150
const card = (pieceId: string, type: CardType, id: string, title: string, col: number, row: number, fields: Partial<Card> = {}): Card => ({ id, type, pieceId, title, x: col * COL, y: row * ROW, ...fields })

// 01 Lunch: who, what hurts, what we'd do about it (the chain's order, top to bottom).
const lunch: Card[] = [
  card(P.lunch, 'customer', 'c-office', 'Office workers', 0, 0, { validation: 'validated', tags: ['b2c'] }),
  card(P.lunch, 'customer', 'c-cooks', 'Home cooks', 1, 0, { validation: 'testing', tags: ['supply'] }),
  card(P.lunch, 'customer', 'c-students', 'Students', 2, 0, { validation: 'hypothesis', tags: ['b2c'] }),
  card(P.lunch, 'customer', 'c-nights', 'Night shifts', 3, 0, { validation: 'hypothesis' }),
  card(P.lunch, 'customer', 'c-teams', 'Team leads', 4, 0, { validation: 'testing', tags: ['b2b'] }),
  card(P.lunch, 'customer', 'c-gyms', 'Gym-goers', 5, 0, { validation: 'invalidated' }),
  card(P.lunch, 'problem', 'r-greasy', 'Delivery lunch is greasy and costs €14 or more', 0, 1, { validation: 'validated' }),
  card(P.lunch, 'problem', 'r-break', 'A 30-minute break leaves no time to queue', 1, 1, { validation: 'validated' }),
  card(P.lunch, 'problem', 'r-same', 'The canteen serves the same five dishes every week', 2, 1, { validation: 'testing' }),
  card(P.lunch, 'problem', 'r-permit', 'Cooks don’t know which permit they need to sell', 3, 1, { validation: 'testing' }),
  card(P.lunch, 'problem', 'r-waste', 'Cooks guess portions and throw food away', 0, 2, { validation: 'testing' }),
  card(P.lunch, 'problem', 'r-allergy', 'Hard to trust allergy info from a stranger', 1, 2, { validation: 'hypothesis' }),
  card(P.lunch, 'problem', 'r-far', 'Pickup points are a walk away from the office', 2, 2, { validation: 'hypothesis' }),
  card(P.lunch, 'problem', 'r-meetings', 'Ordering for a team meeting takes an hour of emails', 3, 2, { validation: 'testing' }),
  card(P.lunch, 'idea', 'i-preorder', 'Home cooks sell tomorrow’s lunch the night before', 0, 3.5, { validation: 'testing' }),
  card(P.lunch, 'idea', 'i-shelf', 'A pickup shelf in each office lobby', 1, 3.5, { validation: 'hypothesis' }),
  card(P.lunch, 'idea', 'i-plan', 'A weekly lunch plan you pay for once', 2, 3.5, { validation: 'hypothesis' }),
  card(P.lunch, 'idea', 'i-ratings', 'Cooks rated by the neighbours who eat with them', 3, 3.5, { validation: 'testing' }),
  card(P.lunch, 'idea', 'i-forecast', 'Tell cooks tonight how many portions sold', 4, 3.5, { validation: 'validated' }),
  card(P.lunch, 'idea', 'i-boxes', 'Team lunch boxes, one order for the whole room', 5, 3.5, { validation: 'hypothesis' }),
]

// 02 Product: what we'd build, and who's already there.
const product: Card[] = [
  card(P.product, 'feature', 'f-pickup', 'Pre-order by 9 pm, pick up at noon', 0, 0, { priority: 'P1', status: 'building', impact: 'high', effort: 'M', criteria: [{ id: 'cr-cutoff', text: 'Order cut-off the night before' }, { id: 'cr-slot', text: 'Pickup slot chosen at checkout' }] }),
  card(P.product, 'feature', 'f-qr', 'Pickup shelf opened with a QR code', 1, 0, { priority: 'P1', status: 'planned', impact: 'high', effort: 'L' }),
  card(P.product, 'feature', 'f-profile', 'Cook profile with a kitchen check', 2, 0, { priority: 'P2', status: 'planned', impact: 'medium', effort: 'S' }),
  card(P.product, 'feature', 'f-allergens', 'Allergen labels on every dish', 3, 0, { priority: 'P1', status: 'shipped', impact: 'medium', effort: 'S' }),
  card(P.product, 'feature', 'f-counter', 'Portion counter for cooks at 9 pm', 0, 1, { priority: 'P1', status: 'shipped', impact: 'high', effort: 'S' }),
  card(P.product, 'feature', 'f-weekly', 'Weekly plan, paid on Mondays', 1, 1, { priority: 'P3', status: 'idea', impact: 'medium', effort: 'M' }),
  card(P.product, 'feature', 'f-split', 'One team order, split by person', 2, 1, { priority: 'P2', status: 'idea', impact: 'medium', effort: 'M' }),
  card(P.product, 'feature', 'f-tips', 'Tip your cook in the app', 3, 1, { priority: 'P3', status: 'idea', impact: 'low', effort: 'S' }),
  card(P.product, 'competitor', 'k-wolt', 'Wolt', 0, 3, { regions: ['Europe'], description: 'Restaurant delivery in 25 countries', pricing: '€1.99–4.99 delivery' }),
  card(P.product, 'competitor', 'k-lieferando', 'Lieferando', 1, 3, { regions: ['Germany'], description: 'Takeaway orders from 25,000 restaurants', pricing: 'free delivery over €15' }),
  card(P.product, 'competitor', 'k-tgtg', 'Too Good To Go', 2, 3, { regions: ['Europe'], description: 'Surplus food from shops at a third of the price' }),
  card(P.product, 'competitor', 'k-shef', 'Shef', 3, 3, { regions: ['US'], description: 'Home-cooked meals from vetted local cooks' }),
  card(P.product, 'competitor', 'k-canteen', 'The office canteen', 4, 3, { regions: ['Berlin'], description: 'Subsidised, same menu every week', pricing: '€4.20 a meal' }),
]

export const cards: Card[] = [...lunch, ...product]

// ——— what links them ———

const link = (id: string, from: Card['id'], kind: Edge['kind'], to: Card['id'], label?: string): Edge => {
  const t = (cid: string) => cards.find((c) => c.id === cid)!.type
  return { id, fromId: from, fromType: t(from), toId: to, toType: t(to), kind, ...(label ? { label } : {}) }
}

export const edges: Edge[] = [
  link('e-1', 'i-preorder', 'solves', 'r-greasy'),
  link('e-2', 'i-preorder', 'solves', 'r-break'),
  link('e-3', 'i-shelf', 'solves', 'r-far'),
  link('e-4', 'i-plan', 'solves', 'r-same'),
  link('e-5', 'i-forecast', 'solves', 'r-waste'),
  link('e-6', 'i-boxes', 'solves', 'r-meetings'),
  link('e-7', 'i-ratings', 'solves', 'r-allergy', 'trust'),
  link('e-8', 'r-greasy', 'for', 'c-office'),
  link('e-9', 'r-break', 'for', 'c-office'),
  link('e-10', 'r-permit', 'for', 'c-cooks'),
  link('e-11', 'r-waste', 'for', 'c-cooks'),
  link('e-12', 'r-meetings', 'for', 'c-teams'),
  link('e-13', 'i-preorder', 'depends-on', 'c-cooks'),
  link('e-14', 'f-pickup', 'inspired-by', 'i-preorder'),
  link('e-15', 'f-qr', 'inspired-by', 'i-shelf'),
  link('e-16', 'f-counter', 'inspired-by', 'i-forecast'),
  link('e-17', 'f-split', 'inspired-by', 'i-boxes'),
  link('e-18', 'f-profile', 'relates', 'f-allergens'),
  link('e-19', 'k-shef', 'competes-with', 'i-preorder'),
  link('e-20', 'k-wolt', 'competes-with', 'r-greasy'),
]

// What backs the statuses (D-137): the validated problem has three for it; the pre-order idea one against.
const ev = (id: string, nodeId: string, nodeType: Evidence['nodeType'], kind: Evidence['kind'], stance: Evidence['stance'], text: string, source: string, date: string): Evidence => ({ id, nodeId, nodeType, kind, stance, text, source, date, createdAt: AT })
export const evidence: Evidence[] = [
  ev('v-1', 'r-greasy', 'problem', 'interview', 'supports', '9 of 12 said they skip delivery lunch most days because it’s heavy and dear', 'Interviews, Kreuzberg offices', '2026-09-18'),
  ev('v-2', 'r-greasy', 'problem', 'data', 'supports', 'Average delivery lunch: €14.60 with fees, 41 minutes', 'Survey, 86 office workers', '2026-09-25'),
  ev('v-3', 'r-greasy', 'problem', 'quote', 'supports', '“By two I’m asleep at my desk.”', 'Lena, UX designer', '2026-09-18'),
  ev('v-4', 'c-office', 'customer', 'observation', 'supports', 'A queue of 20 at the one salad bar on Oranienstraße at 12:30', 'Two lunchtimes watched', '2026-09-22'),
  ev('v-5', 'i-preorder', 'idea', 'data', 'supports', '31 pre-orders in the first week of the WhatsApp test', 'Pilot, 2 cooks', '2026-10-09'),
  ev('v-6', 'i-preorder', 'idea', 'interview', 'contradicts', 'Ordering the night before is too early for some', 'Pilot follow-up calls', '2026-10-14'),
  ev('v-7', 'r-break', 'problem', 'data', 'supports', '64 % of the survey have 30 minutes or less', 'Survey, 86 office workers', '2026-09-25'),
  ev('v-8', 'i-forecast', 'idea', 'data', 'supports', 'Waste fell from 6 to 1 portion a night with the 9 pm count', 'Pilot, 2 cooks', '2026-10-16'),
]

const cf = (id: string, competitorId: string, name: string, category: string, availability: CompetitorFeature['availability']): CompetitorFeature => ({ id, competitorId, name, category, availability, createdAt: AT })
export const competitorFeatures: CompetitorFeature[] = [
  cf('w-1', 'k-wolt', 'Live courier tracking', 'delivery', 'free'),
  cf('w-2', 'k-wolt', 'Wolt+ free delivery', 'pricing', 'paid'),
  cf('l-1', 'k-lieferando', 'Group orders', 'ordering', 'free'),
  cf('l-2', 'k-lieferando', 'Allergen filter', 'trust', 'free'),
  cf('t-1', 'k-tgtg', 'Surprise bags', 'pricing', 'free'),
  cf('s-1', 'k-shef', 'Order days ahead', 'ordering', 'free'),
  cf('s-2', 'k-shef', 'Cook kitchen checks', 'trust', 'free'),
  cf('s-3', 'k-shef', 'Weekly meal plans', 'pricing', 'paid'),
  cf('o-1', 'k-canteen', 'Subsidised price', 'pricing', 'free'),
]

// ——— the matrix's cells (features × competitors, coverage) ———

const cell = (row: string, col: string, s: number, confidence?: Cell['confidence']): Cell => ({ matrixId: P.matrix, row, col, value: step(s), ...(confidence ? { confidence } : {}), updatedAt: AT })
export const cells: Cell[] = [
  cell('f-pickup', 'k-wolt', 0),
  cell('f-pickup', 'k-lieferando', 0),
  cell('f-pickup', 'k-tgtg', 1),
  cell('f-pickup', 'k-shef', 2),
  cell('f-pickup', 'k-canteen', 0),
  cell('f-qr', 'k-tgtg', 1, 'inferred'),
  cell('f-qr', 'k-shef', 0),
  cell('f-profile', 'k-shef', 3),
  cell('f-profile', 'k-wolt', 1),
  cell('f-allergens', 'k-lieferando', 2),
  cell('f-allergens', 'k-wolt', 1),
  cell('f-allergens', 'k-shef', 2),
  cell('f-counter', 'k-tgtg', 1, 'guess'),
  cell('f-weekly', 'k-shef', 2),
  cell('f-split', 'k-lieferando', 2),
  cell('f-split', 'k-wolt', 1),
  cell('f-tips', 'k-wolt', 2),
  cell('f-tips', 'k-lieferando', 2),
  // The table's own column: what each feature costs to run.
  { matrixId: P.table, row: 'f-pickup', col: 'tc-cost', value: 120, updatedAt: AT },
  { matrixId: P.table, row: 'f-qr', col: 'tc-cost', value: 640, updatedAt: AT },
  { matrixId: P.table, row: 'f-counter', col: 'tc-cost', value: 15, updatedAt: AT },
  { matrixId: P.table, row: 'f-allergens', col: 'tc-cost', value: 0, updatedAt: AT },
]

// ——— the deck's 12 tasks ———

// Days round the demo's day (Tuesday 20 October 2026).
const day = (offset: number) => new Date(DEMO_DAY + offset * 24 * 3600 * 1000).toISOString().slice(0, 10)
let order = 0
const task = (id: string, col: string, title: string, who: keyof typeof PEOPLE | null, extra: Partial<Task> = {}): Task => {
  const c = extra.cardId ? cards.find((x) => x.id === extra.cardId) : undefined
  return {
    id,
    pieceId: P.deck,
    col,
    order: ++order,
    title,
    ...(who ? { assignee: PEOPLE[who].uid, assigneeName: PEOPLE[who].name } : {}),
    ...(c ? { cardType: c.type } : {}),
    uid: DEMO_USER.uid,
    createdAt: AT + order * 60_000,
    updatedAt: AT + order * 60_000,
    ...extra,
  }
}
export const tasks: Task[] = [
  task('tk-permit', 'todo', 'Ask the Bezirksamt which permit home cooks need', 'jonas', { due: day(3), cardId: 'r-permit', priority: 'P1' }),
  task('tk-shelf', 'todo', 'Find two lobbies that would host a shelf', 'ayla', { start: day(2), due: day(9), cardId: 'i-shelf' }),
  task('tk-allergy', 'todo', 'Write the allergen checklist with a dietitian', 'lena', { due: day(6), cardId: 'f-allergens', labels: ['trust'] }),
  task('tk-plan', 'todo', 'Price a weekly plan: €39 or €45?', null, { due: day(12), cardId: 'i-plan' }),
  task('tk-cooks', 'doing', 'Sign up five more cooks in Neukölln', 'ayla', { start: day(-4), due: day(2), cardId: 'c-cooks', priority: 'P1', checks: [{ id: 'ch-1', text: 'Flyers at the Turkish market', done: true }, { id: 'ch-2', text: 'Call the three from the waitlist', done: true }, { id: 'ch-3', text: 'Kitchen visits' }] }),
  task('tk-cutoff', 'doing', 'Move the order cut-off from 8 pm to 9 pm', 'you', { start: day(-2), due: day(1), cardId: 'f-pickup' }),
  task('tk-survey', 'doing', 'Survey 40 more office workers at Factory', 'lena', { start: day(-3), due: day(-1), cardId: 'c-office' }),
  task('tk-qr', 'review', 'QR shelf lock: test with the hardware sample', 'jonas', { start: day(-6), due: day(0), cardId: 'f-qr' }),
  task('tk-counter', 'review', 'Portion counter: send at 9 pm sharp', 'you', { due: day(-1), cardId: 'f-counter' }),
  task('tk-pilot', 'done', 'Run the two-week WhatsApp pilot', 'ayla', { start: day(-20), due: day(-7), cardId: 'i-preorder' }),
  task('tk-interviews', 'done', 'Interview 12 people in Kreuzberg offices', 'lena', { start: day(-35), due: day(-28), cardId: 'r-greasy' }),
  task('tk-labels', 'done', 'Allergen labels on every dish', 'jonas', { due: day(-10), cardId: 'f-allergens' }),
]

// ——— two documents ———

const docOf = (id: string, title: string, excerpt: string, words: number, n: number, who = PEOPLE.lena): WithId<Doc> => ({
  id,
  kind: 'markdown',
  title,
  excerpt,
  origin: 'upload',
  uid: who.uid,
  name: who.name,
  shared: true,
  contentType: 'text/markdown',
  size: words * 6,
  words,
  createdAt: AT + n * 3600_000,
  updatedAt: AT + n * 3600_000,
})
export const documents: WithId<Doc>[] = [
  docOf('doc-interviews', 'Interviews: Kreuzberg offices', 'Twelve people, three offices, one question: what did you eat yesterday, and why?', 2140, 2),
  docOf('doc-pilot', 'Pilot, week one: 31 pre-orders', 'Two cooks, one WhatsApp group, a shelf at Factory. What sold, what didn’t, what we’d change.', 980, 30, PEOPLE.ayla),
]

export const pazar: WorkspaceData = {
  canvases: [{ id: MAIN, name: 'Main', order: 0, createdAt: AT }],
  pieces,
  spots: [],
  cards,
  labels: [],
  threads: [],
  cells,
  evidence,
  competitorFeatures,
  comparisons: [],
  edges,
  documents,
  tasks,
  places: [],
}
