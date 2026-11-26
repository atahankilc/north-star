// What the backoffice reads (D-434, docs/specs/agent-server.md §10): North Star's key this month in one answer, for a lab
// admin only. Money stays in micro-dollars with the month's rate beside it; the page turns it into euros. Counts and
// money, never a message: the ledger has no text to give.
import type { Firestore } from 'firebase-admin/firestore'
import type { Auth } from 'firebase-admin/auth'
import { monthOf } from '../../../src/agent/money'
import { checkChain, type Entry } from './audit'
import { labNow } from './lab'
import type { Board, BoardCall, BoardPerson, LabPerson } from '../../../src/agent/labBoard'
import { meterId, rateOf, type Call, type Meter } from './ledger'

export const BOARD_CALLS = 300
export const BOARD_RUNS = 200
export const BOARD_AUDIT = 300
const HOUR = 3_600_000

const EMPTY = { spent: 0, reserved: 0, calls: 0, input: 0, cached: 0, output: 0, searches: 0 }

export async function board(db: Firestore, auth: Auth, now = Date.now()): Promise<Board> {
  const month = monthOf(now)
  const [{ pub, priv }, rate, totalDoc, meters, standing, invites, callsQ, runsQ, auditQ, chain] = await Promise.all([
    labNow(db),
    rateOf(db, month),
    db.doc(`aiMeters/${meterId('lab', month, { uid: null })}`).get(),
    db.collection('aiMeters').where('source', '==', 'lab').where('month', '==', month).get(),
    db.collection('labPeople').get(),
    db.collection('labInvites').get(),
    db.collection('aiCalls').where('source', '==', 'lab').orderBy('at', 'desc').limit(BOARD_CALLS).get(),
    db.collection('agentRuns').where('paidBy', '==', 'lab').orderBy('createdAt', 'desc').limit(BOARD_RUNS).get(),
    db.collection('audit').orderBy('seq', 'desc').limit(BOARD_AUDIT).get(),
    checkChain(db),
  ])
  const t = (totalDoc.data() as Meter | undefined) ?? null
  const calls = callsQ.docs.map((d) => {
    const c = d.data() as Call
    return { id: d.id, uid: c.uid, run: c.run, model: c.model, status: c.status, cost: c.cost, reserved: c.reserved, input: c.input, cached: c.cached, output: c.output, searches: c.searches, at: c.at, ...(c.ms !== undefined ? { ms: c.ms } : {}), ...(c.estimated ? { estimated: true } : {}), ...(c.why ? { why: c.why } : {}) } satisfies BoardCall
  })
  // Each person's meter this month, their standing and their last call; those with only a standing or an invite too.
  const people = new Map<string, BoardPerson>()
  const person = (uid: string) => {
    let p = people.get(uid)
    if (!p) people.set(uid, (p = { uid, name: null, email: null, spent: 0, reserved: 0, calls: 0, last: null, blocked: false, limitCents: null, agreed: false, invited: false }))
    return p
  }
  for (const d of meters.docs) {
    const m = d.data() as Meter
    if (!m.uid) continue
    Object.assign(person(m.uid), { spent: m.spent, reserved: m.reserved, calls: m.calls })
  }
  for (const d of standing.docs) {
    const s = d.data() as LabPerson
    Object.assign(person(d.id), { blocked: !!s.blocked, limitCents: s.personCents ?? null, agreed: !!s.agreedAt, ...(s.reason ? { reason: s.reason } : {}) })
  }
  for (const c of calls) {
    const p = person(c.uid)
    p.last = Math.max(p.last ?? 0, c.at)
  }
  const invited = new Set(invites.docs.map((d) => d.id))
  const uids = [...people.keys()]
  for (let i = 0; i < uids.length; i += 100) {
    const got = await auth.getUsers(uids.slice(i, i + 100).map((uid) => ({ uid }))).catch(() => ({ users: [] as { uid: string; displayName?: string; email?: string }[] }))
    for (const u of got.users) Object.assign(person(u.uid), { name: u.displayName ?? null, email: u.email ?? null, invited: !!u.email && invited.has(u.email.toLowerCase()) })
  }
  const costOf = new Map<string, number>()
  for (const c of calls) if (c.run) costOf.set(c.run, (costOf.get(c.run) ?? 0) + c.cost)
  const runs = runsQ.docs.map((d) => {
    const r = d.data() as { uid: string; status: string; model: string; steps: number; createdAt: number; endedAt?: number; end?: string; said?: string }
    return { id: d.id, uid: r.uid, status: r.status, model: r.model, steps: r.steps, createdAt: r.createdAt, endedAt: r.endedAt ?? null, end: r.end ?? null, said: r.said ?? null, cost: costOf.get(d.id) ?? 0 }
  })
  // The lab's own entries: those with no workspace.
  const audit = auditQ.docs.map((d) => d.data() as Entry).filter((e) => !e.wid).map(({ prev: _p, hash: _h, ...e }) => e)
  const hour = calls.filter((c) => c.at > now - HOUR)
  return {
    month,
    rate,
    pub,
    priv,
    total: t ? { spent: t.spent, reserved: t.reserved, calls: t.calls, input: t.input, cached: t.cached, output: t.output, searches: t.searches, ...(t.days ? { days: t.days } : {}), ...(t.models ? { models: t.models } : {}), ...(t.refused ? { refused: t.refused } : {}) } : EMPTY,
    people: [...people.values()].sort((a, b) => b.spent - a.spent || (b.last ?? 0) - (a.last ?? 0)),
    invites: [...invited].sort(),
    runs,
    calls,
    audit,
    health: {
      open: calls.filter((c) => c.status === 'open').length,
      failedHour: hour.filter((c) => c.status === 'failed').length,
      callsHour: hour.length,
      stuck: runs.filter((r) => (r.status === 'running' || r.status === 'queued') && r.createdAt < now - 35 * 60_000).length,
      chain,
    },
  } satisfies Board
}
