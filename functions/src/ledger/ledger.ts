// The ledger (D-434, docs/specs/agent-server.md §8–§9): every model call paid with a key we hold is held for before it's
// made and settled after, in one transaction each, on the person's meter and the total's; it's refused when it can't fit.
// `aiCalls/{id}`: one call, opened before, closed after: counts and money, never text. `aiMeters/{id}`: a month of one
// person's (or a whole workspace's) use of one way to pay. An own key's calls are recorded the same, with no limit.
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore'
import type { Usage } from '../../../src/agent/contract'
import { centsToMicro, costMicro, guessed, microToCents, monthOf, outputFor, resetsOn, USD_PER_EUR, worstCase } from '../../../src/agent/money'
import { priced } from '../../../src/agent/models'

// A request this big is refused: past 272k tokens OpenAI's price doubles, and the loop compacts long before.
const INPUT_MAX = 200_000
const dayOfMonth = (t: number) => new Date(t).toISOString().slice(8, 10)
// A model id as a map key (Firestore splits a field path at dots).
const modelKey = (m: string) => m.replace(/[.:/]/g, '_')

export type Source = 'workspace' | 'own' | 'lab'
export type Status = 'open' | 'done' | 'stopped' | 'failed'

export type Meter = { source: Source; uid: string | null; wid: string | null; month: string; spent: number; reserved: number; calls: number; input: number; cached: number; cacheWrite: number; output: number; searches: number; refused?: Record<string, number>; days?: Record<string, number>; models?: Record<string, number> }
// `asked`: what the hold was worked out from (the input's estimate, the searches), for closing a call whose answer never came.
export type Call = { source: Source; uid: string; wid: string | null; run: string | null; step: number; provider: string; model: string; status: Status; reserved: number; asked?: { input: number; searches: number }; cost: number; estimated?: boolean; input: number; cached: number; cacheWrite: number; output: number; reasoning: number; searches: number; at: number; ms?: number; responseId?: string; why?: string }

// What the people paying set: a month's limit per person and in total, in euro cents; left out, none.
export type Limits = { person?: number; total?: number }

export class LimitReached extends Error {
  constructor(
    message: string,
    public why: 'person' | 'total' | 'big' | 'unpriced',
  ) {
    super(message)
    this.name = 'LimitReached'
  }
}

export const meterId = (source: Source, month: string, who: { uid?: string | null; wid?: string | null }) =>
  source === 'workspace' ? `ws_${who.wid}_${who.uid ?? 'total'}_${month}` : `${source}_${who.uid ?? 'total'}_${month}`
const meterRef = (db: Firestore, id: string) => db.doc(`aiMeters/${id}`)
export const callRef = (db: Firestore, id: string) => db.doc(`aiCalls/${id}`)
export const newCallId = (db: Firestore) => db.collection('aiCalls').doc().id

const empty = (source: Source, month: string, uid: string | null, wid: string | null): Meter => ({ source, uid, wid, month, spent: 0, reserved: 0, calls: 0, input: 0, cached: 0, cacheWrite: 0, output: 0, searches: 0 })

// The month's rate (USD per EUR): set once a month (the sweep reads the ECB's), else the default.
export async function rateOf(db: Firestore, month: string): Promise<number> {
  const r = (await db.doc(`aiRates/${month}`).get()).data() as { usdPerEur?: number } | undefined
  return typeof r?.usdPerEur === 'number' && r.usdPerEur > 0.5 && r.usdPerEur < 2 ? r.usdPerEur : USD_PER_EUR
}

export type Hold = { call: string; maxOutput: number; reserved: number }
export type Who = { source: Source; uid: string; wid: string | null; run: string | null; step: number; provider: string; model: string }

const euros = (cents: number) => `€${(cents / 100).toFixed(2)}`

// Holds what a call may cost and opens its entry; the output it may write comes back. Throws LimitReached, in words.
export async function hold(db: Firestore, w: Who, o: { input: number; searches: number; asked?: number; limits?: Limits; now?: number }): Promise<Hold> {
  const now = o.now ?? Date.now()
  const month = monthOf(now)
  const limited = w.source !== 'own'
  if (o.input > INPUT_MAX) throw new LimitReached('This request is too long for the agent; start a new chat.', 'big')
  if (limited && !priced(w.model)) throw new LimitReached(`${w.model} has no known price, so it can't run on a key with a limit.`, 'unpriced')
  const rate = limited ? await rateOf(db, month) : USD_PER_EUR
  const ids = { person: meterId(w.source, month, { uid: w.uid, wid: w.wid }), total: w.source === 'own' ? null : meterId(w.source, month, { uid: null, wid: w.wid }) }
  const call = newCallId(db)
  return db.runTransaction(async (tx) => {
    const [p, t] = await tx.getAll(meterRef(db, ids.person), ...(ids.total ? [meterRef(db, ids.total)] : []))
    const person = (p.data() as Meter | undefined) ?? empty(w.source, month, w.uid, w.wid)
    const total = t ? ((t.data() as Meter | undefined) ?? empty(w.source, month, null, w.wid)) : null
    const room = (m: Meter, cents?: number) => (cents === undefined ? Infinity : centsToMicro(cents, rate) - m.spent - m.reserved)
    const left = Math.min(limited ? room(person, o.limits?.person) : Infinity, total ? room(total, o.limits?.total) : Infinity)
    const maxOutput = left === Infinity ? Math.min(o.asked ?? 32_000, 32_000) : outputFor(w.model, left, o)
    if (maxOutput === null) {
      const which = room(person, o.limits?.person) <= room(total!, o.limits?.total) ? 'person' : 'total'
      bump(tx, db, ids.person, person, { refused: which })
      const spent = euros(microToCents(person.spent, rate))
      throw new LimitReached(
        which === 'person'
          ? `Your AI budget on ${w.source === 'lab' ? "North Star's key" : "this workspace's key"} for this month is used up (${spent} of ${euros(o.limits!.person!)}). It starts again on ${resetsOn(now)}; your own key works meanwhile (Settings → the agent).`
          : `This workspace's AI budget for this month is used up (${euros(o.limits!.total!)}). It starts again on ${resetsOn(now)}; the owners can raise it (Settings → workspace → agent key), or use your own key.`,
        which,
      )
    }
    const reserved = limited ? worstCase(w.model, { input: o.input, output: maxOutput, searches: o.searches }) : 0
    tx.create(callRef(db, call), { ...w, status: 'open', reserved, asked: { input: o.input, searches: o.searches }, cost: 0, input: 0, cached: 0, cacheWrite: 0, output: 0, reasoning: 0, searches: 0, at: now } satisfies Call)
    bump(tx, db, ids.person, person, { reserved })
    if (total && ids.total) bump(tx, db, ids.total, total, { reserved })
    return { call, maxOutput, reserved }
  })
}

// Writes a meter whole when it's new, else only what moved.
function bump(tx: Transaction, db: Firestore, id: string, m: Meter, d: { reserved?: number; spent?: number; usage?: Usage; refused?: string; day?: string; model?: string }) {
  const fresh = m.calls === 0 && m.reserved === 0 && m.spent === 0 && !m.refused
  const add = (n: number) => (fresh ? n : FieldValue.increment(n))
  const u = d.usage
  const patch: Record<string, unknown> = {
    ...(d.reserved ? { reserved: add(d.reserved) } : {}),
    ...(d.spent !== undefined ? { spent: add(d.spent), calls: add(1) } : {}),
    ...(u ? { input: add(u.input), cached: add(u.cached ?? 0), cacheWrite: add(u.cacheWrite ?? 0), output: add(u.output), searches: add(u.searches ?? 0) } : {}),
  }
  if (fresh) {
    const base: Meter = { ...m, ...(patch as Partial<Meter>) }
    if (d.refused) base.refused = { [d.refused]: 1 }
    if (d.day && d.spent) base.days = { [d.day]: d.spent }
    if (d.model && d.spent) base.models = { [d.model]: d.spent }
    tx.set(db.doc(`aiMeters/${id}`), base)
    return
  }
  if (d.refused) patch[`refused.${d.refused}`] = FieldValue.increment(1)
  if (d.day && d.spent) patch[`days.${d.day}`] = FieldValue.increment(d.spent)
  if (d.model && d.spent) patch[`models.${d.model}`] = FieldValue.increment(d.spent)
  if (Object.keys(patch).length) tx.update(db.doc(`aiMeters/${id}`), patch)
}

// Closes a call with what it used: its hold given back, its cost on the meters. Once: a call closed already is left.
export async function settle(db: Firestore, call: string, o: { usage: Usage; status: Exclude<Status, 'open'>; ms: number; estimated?: boolean; cost?: number; responseId?: string; why?: string; now?: number }): Promise<void> {
  await db.runTransaction(async (tx) => {
    const c = (await tx.get(callRef(db, call))).data() as Call | undefined
    if (!c || c.status !== 'open') return
    const cost = o.cost ?? (c.source === 'own' && !priced(c.model) ? 0 : costMicro(c.model, o.usage))
    const month = monthOf(c.at)
    const ids = [meterId(c.source, month, { uid: c.uid, wid: c.wid }), ...(c.source === 'own' ? [] : [meterId(c.source, month, { uid: null, wid: c.wid })])]
    const meters = await tx.getAll(...ids.map((id) => meterRef(db, id)))
    const u = o.usage
    tx.update(callRef(db, call), { status: o.status, cost, ms: o.ms, input: u.input, cached: u.cached ?? 0, cacheWrite: u.cacheWrite ?? 0, output: u.output, reasoning: u.reasoning ?? 0, searches: u.searches ?? 0, ...(o.estimated ? { estimated: true } : {}), ...(o.responseId ? { responseId: o.responseId.slice(0, 100) } : {}), ...(o.why ? { why: o.why.slice(0, 200) } : {}) })
    meters.forEach((s, i) => {
      const m = (s.data() as Meter | undefined) ?? empty(c.source, month, i === 0 ? c.uid : null, c.wid)
      bump(tx, db, ids[i], m, { reserved: -c.reserved, spent: cost, usage: u, day: dayOfMonth(o.now ?? Date.now()), model: modelKey(c.model) })
    })
  })
}

// A run going on after its worker died: the call that worker had open is closed now, at what it likely cost (its input,
// output by the time it had, never more than was held), not left holding the person's budget until the sweep.
export const DEAD_CALL_MS = 60_000
export async function closeRunCalls(db: Firestore, run: string, now = Date.now()): Promise<number> {
  const open = await db.collection('aiCalls').where('run', '==', run).where('status', '==', 'open').get()
  for (const d of open.docs) {
    const c = d.data() as Call
    const g = guessed(c.model, { input: c.asked?.input ?? 0, streamedChars: 0, ms: Math.min(now - c.at, DEAD_CALL_MS), held: c.reserved })
    await settle(db, d.id, { usage: g.usage, ...(c.reserved ? { cost: g.cost } : {}), status: 'failed', ms: now - c.at, estimated: true, why: 'its worker stopped before the answer came', now })
  }
  return open.size
}

// Calls left open past this (their worker died) are closed at what was held for them.
export const OPEN_MAX_MS = 35 * 60_000
export async function closeOpen(db: Firestore, now = Date.now()): Promise<number> {
  const open = await db.collection('aiCalls').where('status', '==', 'open').where('at', '<', now - OPEN_MAX_MS).limit(200).get()
  for (const d of open.docs) {
    const c = d.data() as Call
    await settle(db, d.id, { usage: { input: 0, output: 0 }, cost: c.reserved, status: 'failed', ms: now - c.at, estimated: true, why: 'its worker stopped before the answer came', now })
  }
  return open.size
}

// Whether there's room to start at all (before a run is made): the same words a call would get.
export async function roomToStart(db: Firestore, w: Pick<Who, 'source' | 'uid' | 'wid' | 'model'>, limits: Limits | undefined, now = Date.now()): Promise<void> {
  if (w.source === 'own' || (!limits?.person && !limits?.total)) return
  const month = monthOf(now)
  const rate = await rateOf(db, month)
  const [p, t] = await db.getAll(meterRef(db, meterId(w.source, month, { uid: w.uid, wid: w.wid })), meterRef(db, meterId(w.source, month, { uid: null, wid: w.wid })))
  const used = (m: Meter | undefined) => (m ? m.spent + m.reserved : 0)
  const over = (m: Meter | undefined, cents?: number) => cents !== undefined && centsToMicro(cents, rate) - used(m) < worstCase(w.model, { input: 20_000, output: 1_500, searches: 0 })
  if (over(p.data() as Meter | undefined, limits.person)) throw new LimitReached(`Your AI budget on this workspace's key for this month is used up (${euros(limits.person!)}). It starts again on ${resetsOn(now)}; your own key works meanwhile (Settings → the agent).`, 'person')
  if (over(t.data() as Meter | undefined, limits.total)) throw new LimitReached(`This workspace's AI budget for this month is used up (${euros(limits.total!)}). It starts again on ${resetsOn(now)}; the owners can raise it (Settings → workspace → agent key), or use your own key.`, 'total')
}
