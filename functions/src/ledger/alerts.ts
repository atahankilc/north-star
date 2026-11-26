// Mails to the lab about North Star's key (D-434, docs/specs/agent-server.md §10): 50, 80 and 100 % of the month's total,
// failures over 5 % in an hour, a run stuck, the audit chain broken. Each sent once (a threshold once a month, the rest
// once a day), remembered in `labAlerts/{month}`. Counts and money only; no address but the lab's own.
import type { Firestore } from 'firebase-admin/firestore'
import { microToCents, monthOf } from '../../../src/agent/money'
import { NOTICE_FROM, NOTICE_TO } from '../waitlist.js'
import type { Mail } from '../mail.js'
import { checkChain } from './audit'
import { labNow } from './lab'
import { meterId, rateOf, type Meter } from './ledger'

export const THRESHOLDS = [50, 80, 100] as const
const HOUR = 3_600_000
const STUCK_MS = 35 * 60_000
export type Facts = { month: string; spentCents: number; totalCents: number | null; failedHour: number; callsHour: number; stuck: number; chainOk: boolean }
type Sent = Record<string, string | number>

// What to say now, given the facts and what was already sent: pure, so it's tested.
export function alertsFor(f: Facts, sent: Sent, day: string): { key: string; mark: string | number; subject: string; line: string }[] {
  const out: { key: string; mark: string | number; subject: string; line: string }[] = []
  const eur = (c: number) => `€${(c / 100).toFixed(2)}`
  if (f.totalCents) {
    const pct = (f.spentCents / f.totalCents) * 100
    const hit = [...THRESHOLDS].reverse().find((t) => pct >= t)
    if (hit && !(Number(sent.total ?? 0) >= hit))
      out.push({ key: 'total', mark: hit, subject: `North Star's key at ${hit} % of the month`, line: `${eur(f.spentCents)} of ${eur(f.totalCents)} spent in ${f.month}.${hit === 100 ? ' Nobody more can use it this month.' : ''}` })
  }
  if (f.callsHour >= 20 && f.failedHour / f.callsHour > 0.05 && sent.failures !== day)
    out.push({ key: 'failures', mark: day, subject: "North Star's key: calls failing", line: `${f.failedHour} of ${f.callsHour} calls failed in the last hour.` })
  if (f.stuck > 0 && sent.stuck !== day) out.push({ key: 'stuck', mark: day, subject: "North Star's key: runs stuck", line: `${f.stuck} runs are past 35 minutes and not ended.` })
  if (!f.chainOk && sent.chain !== day) out.push({ key: 'chain', mark: day, subject: 'North Star: the audit chain is broken', line: 'The audit log no longer checks; see the backoffice → audit.' })
  return out
}

export async function labAlerts(db: Firestore, send: (m: Mail) => Promise<boolean>, now = Date.now()): Promise<number> {
  const month = monthOf(now)
  const { pub, priv } = await labNow(db)
  if (!pub.hasKey) return 0
  const [total, rate, calls, stuck, chain, sentDoc] = await Promise.all([
    db.doc(`aiMeters/${meterId('lab', month, { uid: null })}`).get(),
    rateOf(db, month),
    db.collection('aiCalls').where('source', '==', 'lab').where('at', '>', now - HOUR).orderBy('at', 'desc').limit(1000).get(),
    db.collection('agentRuns').where('paidBy', '==', 'lab').where('status', 'in', ['queued', 'running']).get(),
    checkChain(db, 200),
    db.doc(`labAlerts/${month}`).get(),
  ])
  const t = total.data() as Meter | undefined
  const facts: Facts = {
    month,
    spentCents: microToCents((t?.spent ?? 0) + (t?.reserved ?? 0), rate),
    totalCents: priv.totalCents ?? null,
    callsHour: calls.size,
    failedHour: calls.docs.filter((d) => d.get('status') === 'failed').length,
    stuck: stuck.docs.filter((d) => (d.get('createdAt') as number) < now - STUCK_MS).length,
    chainOk: chain.ok,
  }
  const day = new Date(now).toISOString().slice(0, 10)
  const due = alertsFor(facts, (sentDoc.data() ?? {}) as Sent, day)
  let n = 0
  for (const a of due) {
    if (!(await send({ from: NOTICE_FROM, to: [NOTICE_TO], subject: a.subject, text: `${a.line}\n\nThe backoffice: https://north-star.atem-lab.com/backoffice\n` }))) continue
    await db.doc(`labAlerts/${month}`).set({ [a.key]: a.mark }, { merge: true })
    n++
  }
  return n
}
