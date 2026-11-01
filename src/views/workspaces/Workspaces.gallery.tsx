import { example, type StateSpec } from '../../gallery/example'
import type { AuthUser } from '../../data/auth'
import type { WithId } from '../../data/hooks'
import type { Invite, JoinRequest, Role, Workspace } from '../../data/model'
import { setDemoLists } from '../../data/workspaces'
import { setDemoGlance, type DemoGlance } from '../../data/glance'
import { makeSummary, readSummary } from '../../model/summary'
import type { ChangeEntry } from '../../model/changeLog'
import { coachDev } from '../../onboarding/Coach'
import { Workspaces } from './Workspaces'

// The workspaces page (D-338) on made-up lists and glances: without Firebase its hooks read setDemoLists' and
// setDemoGlance's values. Times are from now, so "2h ago" reads the same whenever the gallery opens.
const ME: AuthUser = { id: 'demo', email: 'you@example.com', name: 'You', photoURL: null }
const MIN = 60_000 // tokens-ok: a minute in ms, for made-up times
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const ws = (id: string, name: string, role: Role, members: number, about = ''): WithId<Workspace> => {
  const others = Array.from({ length: members - 1 }, (_, i) => `u${i}`)
  const roles: Record<string, Role> = { demo: role }
  others.forEach((u) => (roles[u] = 'editor'))
  if (role !== 'owner') roles.u0 = 'owner'
  return { id, name, description: about || undefined, ownerId: role === 'owner' ? 'demo' : 'u0', memberIds: ['demo', ...others], roles, inviteCode: 'QRSTUVWX', createdAt: Date.now() - 90 * DAY }
}

// A made-up first canvas: planes with cards, a deck, a table, laid out by a seed.
function picture(seed: number) {
  let s = seed
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  const kinds = ['plane', 'plane', 'kanban', 'plane', 'table', 'matrix'] as const
  const n = 3 + Math.floor(r() * 3)
  const pieces = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, kind: kinds[i % kinds.length], x: (i % 3) * 1100, y: Math.floor(i / 3) * 800, w: 900 + r() * 200, h: 600 + r() * 150 }))
  const types = ['customer', 'problem', 'competitor', 'idea', 'feature'] as const
  const cards = Array.from({ length: 40 }, () => ({ type: types[Math.floor(r() * types.length)], pieceId: `p${Math.floor(r() * n)}`, x: Math.floor(r() * 5) * 225, y: Math.floor(r() * 5) * 125 }))
  return readSummary({ ...makeSummary(pieces, cards, []), by: 'u0', at: Date.now() })
}
const change = (by: string, kinds: ChangeEntry['kinds'], n: number, ago: number): ChangeEntry => ({ by, at: Date.now() - ago, kinds, ids: Array.from({ length: n }, (_, i) => `x${i}`), actor: 'person' })

const FEW = [
  ws('w-pazar', 'Pazar', 'owner', 3, 'A marketplace for neighbourhood bazaars: stalls book a spot, buyers pre-order.'),
  ws('w-lunch', 'Office lunch subscriptions', 'editor', 5, 'Weekly lunch plans for teams of 10–50.'),
  ws('w-pets', 'Pet-sitting marketplace', 'owner', 2),
  ws('w-audit', 'Rival audit, Q4', 'viewer', 4),
  ws('w-climb', 'Second-hand climbing gear', 'owner', 1),
]
const MANY = [...FEW, ...['Clinic booking for small towns', 'Tutors on demand', 'Farm boxes', 'Repair cafés', 'Used textbooks', 'Coworking for parents', 'Kitchen robots for cafés'].map((name, i) => ws(`w-x${i}`, name, i % 3 ? 'editor' : 'owner', 2 + (i % 4)))]
const GLANCE: Record<string, DemoGlance> = {
  'w-pazar': {
    visited: Date.now() - 2 * HOUR,
    summary: picture(3),
    since: [change('u1', ['ideas', 'problems'], 4, 40 * MIN), change('u2', ['tasks'], 2, HOUR), change('u1', ['edges'], 3, 70 * MIN)],
    names: { u1: 'Ayşe', u2: 'Mert' },
    here: ['Ayşe'],
    newTasks: 2,
  },
  'w-lunch': { visited: Date.now() - 26 * HOUR, summary: picture(7), since: [change('u3', ['pieces'], 1, 5 * HOUR)], newTasks: 1 },
  'w-pets': { visited: Date.now() - 6 * DAY, summary: picture(11) },
  'w-audit': { visited: Date.now() - 21 * DAY, summary: picture(19), here: ['Lale'] },
  'w-climb': { visited: Date.now() - 64 * DAY, summary: null },
}
const INVITES: WithId<Invite>[] = [{ id: 'i1', workspaceId: 'w-x', email: 'you@example.com', name: 'Kitchen robots', memberCount: 4, invitedBy: 'u0', at: Date.now() - DAY }]
const REQUESTS: WithId<JoinRequest>[] = [{ id: 'r1', workspaceId: 'w-y', uid: 'demo', name: 'You', email: 'you@example.com', code: 'QRSTUVWX', createdAt: Date.now() - DAY }]

type Ctx = Parameters<NonNullable<StateSpec['setup']>>[0]
// The coach's welcome would open over the page on a fresh gallery: its queue kept quiet.
const quietCoach = async (c: Ctx) => {
  for (let i = 0; i < 40 && !coachDev.current; i++) await c.wait(50) // tokens-ok: polls the lazy coach for 2 s
  coachDev.current?.quiet(true)
}

const page = (lists: Parameters<typeof setDemoLists>[0], more: Partial<StateSpec> = {}): StateSpec => ({
  size: 'full',
  route: '/workspaces',
  ...more,
  setup: async (c) => {
    await quietCoach(c)
    await more.setup?.(c)
  },
  render: () => {
    setDemoLists(lists)
    setDemoGlance(GLANCE)
    return <Workspaces user={ME} />
  },
})
const typed = (text: string) => async (c: Ctx) => {
  c.click('[data-ws-prompt]')
  c.type(text, '[data-ws-prompt]')
}

export default example({
  name: 'Workspaces',
  place: 'screens/workspaces',
  file: 'src/views/workspaces/Workspaces.tsx',
  note: 'the page after sign-in (D-338): the title and its count, one prompt, the workspace you left, what needs you, the others; made-up lists and glances, every write refused',
  states: {
    'a few': page({ workspaces: FEW, invites: INVITES, requests: REQUESTS, asking: { 'w-pazar': 2 } }),
    'first visit': page({}),
    one: { ...page({ workspaces: [FEW[2]] }), note: 'the three ways in stay while you have two or fewer' },
    many: page({ workspaces: MANY }),
    'typed a name': page({ workspaces: FEW }, { setup: typed('pa') }),
    'typed a code': page({ workspaces: FEW }, { setup: typed('ABCD-EFGH') }),
    'a menu': page({ workspaces: FEW }, { setup: (c) => c.click('[aria-label^="more for"]') }),
  },
})
