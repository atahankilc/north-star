// A complete example workspace (D-052): one fictional startup with every item type, link kind, customer tag,
// card tag (D-056), matrix cell and area label filled in, so each view has something real to show. Competitors are made up.
import { collection, doc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import type { BoardType, Coverage, EdgeKind, NodeType } from './model'
import { COLLECTIONS } from './nodes'
import { createWorkspace } from './workspaces'

type Card = { key: string; title: string; body?: string; tags?: string[] }
type Feature = Card & { priority: 'P1' | 'P2' | 'P3'; status: 'idea' | 'planned' | 'building' | 'shipped'; effort: 'S' | 'M' | 'L' }
type Competitor = { key: string; tags: string[]; name: string; url: string; pricing: string; audience: string; description: string; notes: string; features: [string, string, string][] }

// Areas sit far apart, so the jump list has somewhere to go. Each column is one link in the chain (D-045).
const COLUMN_X = { customer: -24, problem: -16, competitor: -8, idea: 0, feature: 8, package: 16 } as const
const TOP = 4
// Every card is the same size (D-055), so one row height fits all.
const ROW = 2.1

const customers: Card[] = [
  { key: 'owners', tags: ['buyer'], title: 'Independent restaurant owners', body: 'One or two sites, 10–40 staff. Do the rota themselves on Sunday night.' },
  { key: 'managers', tags: ['buyer', 'user'], title: 'Shift managers', body: 'Run the floor, field every sick call, own the group chat.' },
  { key: 'staff', tags: ['user'], title: 'Part-time staff', body: 'Students and second-jobbers. Want more shifts, on short notice, from their phone.' },
  { key: 'chains', tags: ['buyer', 'later'], title: 'Small café chains (2–5 sites)', body: 'Need one view across sites and labour cost per site.' },
]

const problems: Card[] = [
  { key: 'sick', title: 'Sick calls leave shifts empty', body: 'Managers text 10 people one by one at 7am. Half the time the shift runs short.', tags: ['urgent', 'daily'] },
  { key: 'chat', title: 'The rota lives in a WhatsApp group', body: 'A photo of a paper sheet, re-posted after every change. Nobody knows which one is current.', tags: ['daily'] },
  { key: 'swap', title: "Staff can't swap without the manager", body: 'Every swap goes through one person, who is busy running service.', tags: ['daily'] },
  { key: 'cost', title: 'Labour cost is only known at month end', body: 'Owners find out they overstaffed Tuesdays when payroll lands.', tags: ['monthly'] },
]

const competitors: Competitor[] = [
  {
    key: 'shiftgrid', tags: ['direct'], name: 'ShiftGrid', url: 'shiftgrid.example', pricing: '$4 / user / month', audience: 'Mid-size restaurant groups',
    description: 'Full scheduling suite with time clock and forecasting.', notes: 'Strong on reports, heavy to set up. Swaps always need a manager.',
    features: [['Drag-and-drop rota', 'scheduling', ''], ['Swap requests', 'scheduling', 'Every swap waits for a manager'], ['Time clock', 'payroll', ''], ['Labour cost forecast', 'reporting', 'Weekly, not live']],
  },
  {
    key: 'crewly', tags: ['direct'], name: 'Crewly', url: 'crewly.example', pricing: '$29 / location / month', audience: 'Cafés and bars',
    description: 'Simple rota app with team chat.', notes: 'Loved for its availability form. No cost tracking at all.',
    features: [['Rota templates', 'scheduling', ''], ['Team chat', 'communication', ''], ['Availability collection', 'scheduling', 'Staff mark free days each week']],
  },
  {
    key: 'paper', tags: ['status-quo'], name: 'Paper rota + WhatsApp', url: '', pricing: 'Free', audience: 'Most small restaurants today',
    description: 'The status quo: a printed sheet in the kitchen and a photo of it in the group chat.', notes: 'Free and everyone already has it. The real competitor.',
    features: [['Group chat', 'communication', ''], ['Photo of the rota', 'scheduling', 'Out of date after the first change']],
  },
  {
    key: 'bigchain', tags: ['enterprise'], name: 'BigChain HR', url: 'bigchainhr.example', pricing: 'Enterprise, on request', audience: 'Chains with 50+ sites',
    description: 'HR suite with scheduling as one module.', notes: 'Overkill and too expensive for independents.',
    features: [['Payroll integration', 'payroll', ''], ['Compliance reports', 'reporting', ''], ['Labour cost forecast', 'reporting', 'Live, per site']],
  },
]

const ideas: Card[] = [
  { key: 'market', title: 'Open-shift marketplace', body: 'An empty shift goes to everyone qualified at once. First to accept gets it.', tags: ['core'] },
  { key: 'tap', title: 'Swap with one tap, within rules', body: 'Swaps auto-approve if both people are qualified and nobody goes over hours.', tags: ['core'] },
  { key: 'meter', title: 'Live labour-cost meter', body: 'The rota shows cost per day as you build it, against a target.' },
  { key: 'photo', title: 'Import the WhatsApp rota photo', body: 'Snap the paper rota, get a digital one. Zero setup.', tags: ['onboarding'] },
]

const features: Feature[] = [
  { key: 'broadcast', title: 'Open shifts broadcast', body: 'Push to qualified staff, first accept wins.', priority: 'P1', status: 'building', effort: 'M', tags: ['mvp'] },
  { key: 'rules', title: 'Rule-based swap approval', priority: 'P1', status: 'planned', effort: 'M', tags: ['mvp'] },
  { key: 'costmeter', title: 'Labour cost meter', priority: 'P2', status: 'planned', effort: 'S', tags: ['v2'] },
  { key: 'avail', title: 'Availability collection', priority: 'P2', status: 'shipped', effort: 'S', tags: ['mvp'] },
  { key: 'ocr', title: 'Rota photo import', priority: 'P3', status: 'idea', effort: 'L', tags: ['onboarding'] },
  { key: 'payroll', title: 'Payroll export', priority: 'P3', status: 'idea', effort: 'M', tags: ['v2'] },
]
// The last two sit under "LATER", away from the roadmap.
const LATER = new Set(['ocr', 'payroll'])

const forTags: [string, string[]][] = [
  ['sick', ['owners', 'managers']],
  ['chat', ['managers', 'staff']],
  ['swap', ['staff']],
  ['cost', ['owners', 'chains']],
  ['market', ['managers', 'staff']],
  ['tap', ['staff']],
  ['meter', ['owners', 'chains']],
  ['photo', ['owners']],
  ['shiftgrid', ['chains']],
  ['crewly', ['owners']],
  ['paper', ['owners', 'staff']],
  ['bigchain', ['chains']],
]

const links: [string, string, EdgeKind][] = [
  ['market', 'sick', 'solves'],
  ['tap', 'swap', 'solves'],
  ['meter', 'cost', 'solves'],
  ['photo', 'chat', 'solves'],
  ['shiftgrid', 'sick', 'competes-with'],
  ['shiftgrid', 'swap', 'competes-with'],
  ['crewly', 'chat', 'competes-with'],
  ['paper', 'chat', 'competes-with'],
  ['bigchain', 'cost', 'competes-with'],
  ['broadcast', 'market', 'inspired-by'],
  ['rules', 'tap', 'inspired-by'],
  ['costmeter', 'meter', 'inspired-by'],
  ['ocr', 'photo', 'inspired-by'],
  ['avail', 'crewly:Availability collection', 'inspired-by'],
  ['payroll', 'bigchain:Payroll integration', 'inspired-by'],
  ['broadcast', 'rules', 'relates'],
]

// [feature, competitor, coverage, note]
const matrix: [string, string, Coverage, string][] = [
  ['broadcast', 'shiftgrid', 'partial', 'Managers can post open shifts, but staff get no push'],
  ['broadcast', 'crewly', 'none', ''],
  ['broadcast', 'paper', 'partial', 'A message in the group chat'],
  ['broadcast', 'bigchain', 'none', ''],
  ['rules', 'shiftgrid', 'partial', 'Swap requests, but every one needs a manager'],
  ['rules', 'crewly', 'none', ''],
  ['rules', 'paper', 'none', ''],
  ['rules', 'bigchain', 'partial', 'Approval chains, configured by HR'],
  ['costmeter', 'shiftgrid', 'full', 'Weekly forecast'],
  ['costmeter', 'crewly', 'none', ''],
  ['costmeter', 'paper', 'none', ''],
  ['costmeter', 'bigchain', 'better', 'Live per site, but enterprise only'],
  ['avail', 'shiftgrid', 'full', ''],
  ['avail', 'crewly', 'full', 'Their best-loved feature'],
  ['avail', 'paper', 'none', ''],
  ['avail', 'bigchain', 'full', ''],
  ['ocr', 'shiftgrid', 'none', ''],
  ['ocr', 'crewly', 'none', ''],
  ['ocr', 'paper', 'none', ''],
  ['ocr', 'bigchain', 'none', 'Nobody does this: a gap'],
  ['payroll', 'shiftgrid', 'full', ''],
  ['payroll', 'crewly', 'partial', 'CSV export only'],
  ['payroll', 'bigchain', 'better', ''],
]

const labels: [string, number, number][] = [
  ['CUSTOMERS', COLUMN_X.customer, TOP + 2.6],
  ['PROBLEMS', COLUMN_X.problem, TOP + 2.6],
  ['COMPETITION', COLUMN_X.competitor, TOP + 2.6],
  ['OUR IDEAS', COLUMN_X.idea, TOP + 2.6],
  ['ROADMAP', COLUMN_X.feature, TOP + 2.6],
  ['LATER', COLUMN_X.feature + 8, TOP + 2.6],
]

export async function createExampleWorkspace(uid: string): Promise<string> {
  const wid = await createWorkspace(
    'Example: Tablebook',
    uid,
    'Tablebook: shift scheduling for independent restaurants. Owners build the rota in minutes, staff swap shifts from their phones, and nobody runs it over WhatsApp any more.',
  )
  const col = (name: string) => collection(db(), 'workspaces', wid, name)
  const ids = new Map<string, { id: string; type: NodeType }>()
  const batch = writeBatch(db())
  let t = Date.now()
  const stamp = () => ({ createdAt: ++t, updatedAt: t })

  const place = (type: BoardType, list: { key: string }[], step: number, build: (item: never, x: number, y: number) => object) =>
    list.forEach((item, i) => {
      const ref = doc(col(COLLECTIONS[type]))
      ids.set(item.key, { id: ref.id, type })
      batch.set(ref, { ...build(item as never, COLUMN_X[type], TOP - i * step), ...stamp() })
    })

  const card = (c: Card, x: number, y: number) => ({ title: c.title, x, y, ...(c.body && { body: c.body }), ...(c.tags && { tags: c.tags }) })
  place('customer', customers, ROW, card)
  place('problem', problems, ROW, card)
  place('idea', ideas, ROW, card)
  place('competitor', competitors, ROW, (c: Competitor, x, y) => ({
    name: c.name, tags: c.tags, x, y, pricing: c.pricing, audience: c.audience, description: c.description, notes: c.notes, ...(c.url && { url: c.url }),
  }))
  // Roadmap and later each stack from the top.
  const rows = { roadmap: 0, later: 0 }
  place('feature', features, ROW, (f: Feature, x) => {
    const later = LATER.has(f.key)
    const y = TOP - (later ? rows.later++ : rows.roadmap++) * ROW
    return { title: f.title, priority: f.priority, status: f.status, effort: f.effort, x: later ? x + 8 : x, y, ...(f.body && { body: f.body }), ...(f.tags && { tags: f.tags }) }
  })

  for (const c of competitors) {
    for (const [name, category, description] of c.features) {
      const ref = doc(col('competitorFeatures'))
      ids.set(`${c.key}:${name}`, { id: ref.id, type: 'competitorFeature' })
      batch.set(ref, { competitorId: ids.get(c.key)!.id, name, category, ...(description && { description }), ...stamp() })
    }
  }

  const edge = (from: string, to: string, kind: EdgeKind) => {
    const a = ids.get(from)!
    const b = ids.get(to)!
    batch.set(doc(col('edges')), { fromId: a.id, fromType: a.type, toId: b.id, toType: b.type, kind })
  }
  for (const [item, who] of forTags) for (const c of who) edge(item, c, 'for')
  for (const [from, to, kind] of links) edge(from, to, kind)

  for (const [f, c, coverage, notes] of matrix) {
    const featureId = ids.get(f)!.id
    const competitorId = ids.get(c)!.id
    batch.set(doc(col('comparisons'), `${featureId}_${competitorId}`), { featureId, competitorId, coverage, ...(notes && { notes }), updatedAt: t })
  }

  for (const [text, x, y] of labels) batch.set(doc(col('labels')), { text, x, y, ...stamp() })

  await batch.commit()
  return wid
}
