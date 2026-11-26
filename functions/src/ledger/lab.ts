// The lab's key (D-434, docs/specs/agent-server.md §6): North Star's own OpenAI key, which signed-in people may use up to
// a month's limit each (about €3), within a total. Set by a lab admin (a doc in `admins/{uid}`, made by hand in the
// Firebase console; nothing in the app makes one), in the backoffice; every change in the audit log.
// `lab/public`: on, its models, the limit a person (signed-in people read it). `lab/private`: the key's hint, the total,
// whether only invited people may use it (lab admins read it). `labPeople/{uid}`: one person's own standing (blocked, their
// own limit, when they agreed to the notice), which they read. `labInvites/{email}`: who's invited (admins only).
import { createHash } from 'node:crypto'
import type { Firestore } from 'firebase-admin/firestore'
import { audited, type Act } from './audit'
import { microToCents, monthOf, resetsOn } from '../../../src/agent/money'
import { LimitReached, meterId, rateOf, roomToStart, type Limits, type Meter } from './ledger'

import type { LabPerson, LabPrivate, LabPublic } from '../../../src/agent/labBoard'


export const DEFAULT_PERSON_CENTS = 300
export const DEFAULT_TOTAL_CENTS = 10_000
export const LAB_SECRET = 'aiSecrets/_lab'
const MODEL_ID = /^[A-Za-z0-9._:-]{1,100}$/
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}$/

export const labPublicRef = (db: Firestore) => db.doc('lab/public')
export const labPrivateRef = (db: Firestore) => db.doc('lab/private')
export const labPersonRef = (db: Firestore, uid: string) => db.doc(`labPeople/${uid}`)
export const labInviteRef = (db: Firestore, email: string) => db.doc(`labInvites/${email.toLowerCase()}`)

export class LabRefused extends Error {}

export async function isLabAdmin(db: Firestore, uid: string | undefined): Promise<boolean> {
  return !!uid && (await db.doc(`admins/${uid}`).get()).exists
}

export async function labNow(db: Firestore): Promise<{ pub: LabPublic; priv: LabPrivate }> {
  const [p, q] = await db.getAll(labPublicRef(db), labPrivateRef(db))
  return {
    pub: { on: false, hasKey: false, models: [], personCents: DEFAULT_PERSON_CENTS, ...((p.data() as Partial<LabPublic> | undefined) ?? {}) },
    priv: { invitedOnly: true, totalCents: DEFAULT_TOTAL_CENTS, ...((q.data() as Partial<LabPrivate> | undefined) ?? {}) },
  }
}

// The limits a person has on the lab's key this month.
export const labLimits = (pub: LabPublic, priv: LabPrivate, me: LabPerson | undefined): Limits => ({
  person: me?.personCents ?? pub.personCents,
  ...(priv.totalCents !== null && priv.totalCents !== undefined ? { total: priv.totalCents } : {}),
})

// Whether this person may use the lab's key for this model now; why not, in their words (thrown).
// Someone who deleted their account this month and signed up again keeps what they had spent, and a block (§9.8): kept
// under a hash of the email until the month ends (`labGone/{hash}`), never the address.
export const goneId = (email: string) => createHash('sha256').update(`north-star-lab:${email.toLowerCase()}`).digest('hex')
export type Gone = { month: string; spent: number; blocked?: boolean }
export async function rememberGone(db: Firestore, uid: string, email: string | undefined, now = Date.now()): Promise<void> {
  const month = monthOf(now)
  const [m, me] = await db.getAll(db.doc(`aiMeters/${meterId('lab', month, { uid })}`), labPersonRef(db, uid))
  const spent = ((m.data() as Meter | undefined)?.spent ?? 0) + ((m.data() as Meter | undefined)?.reserved ?? 0)
  const blocked = !!(me.data() as LabPerson | undefined)?.blocked
  if (email && (spent > 0 || blocked)) await db.doc(`labGone/${goneId(email)}`).set({ month, spent, ...(blocked ? { blocked } : {}) } satisfies Gone)
  await labPersonRef(db, uid).delete()
}
async function carryGone(db: Firestore, uid: string, email: string | undefined, now: number): Promise<boolean> {
  if (!email) return false
  const month = monthOf(now)
  const gone = (await db.doc(`labGone/${goneId(email)}`).get()).data() as Gone | undefined
  if (!gone || gone.month !== month) return false
  const ref = db.doc(`aiMeters/${meterId('lab', month, { uid })}`)
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) return
    tx.create(ref, { source: 'lab', uid, wid: null, month, spent: gone.spent, reserved: 0, calls: 0, input: 0, cached: 0, cacheWrite: 0, output: 0, searches: 0 } satisfies Meter)
  })
  return !!gone.blocked
}

export async function mayUseLab(db: Firestore, o: { uid: string; email?: string; emailVerified?: boolean; model: string; needAgreed?: boolean }): Promise<Limits> {
  const { pub, priv } = await labNow(db)
  if (await carryGone(db, o.uid, o.emailVerified ? o.email : undefined, Date.now())) throw new LabRefused("You can't use North Star's key. Write to us from atem-lab.com/contact if that's a mistake.")
  if (!pub.on || !pub.hasKey) throw new LabRefused("North Star's key isn't open now.")
  if (!pub.models.includes(o.model.replace(/^openai:/, ''))) throw new LabRefused(`North Star's key doesn't run ${o.model}; pick ${pub.models[0] ?? 'another model'}.`)
  const me = (await labPersonRef(db, o.uid).get()).data() as LabPerson | undefined
  if (me?.blocked) throw new LabRefused("You can't use North Star's key. Write to us from atem-lab.com/contact if that's a mistake.")
  if (priv.invitedOnly && !(o.email && o.emailVerified && (await labInviteRef(db, o.email).get()).exists)) throw new LabRefused("North Star's key is open to invited people for now.")
  if (o.needAgreed !== false && !me?.agreedAt) throw new LabRefused("to use North Star's key, read how it works and agree first: Settings → the agent → North Star's key")
  const limits = labLimits(pub, priv, me)
  await roomToStart(db, { source: 'lab', uid: o.uid, wid: null, model: o.model }, limits).catch((e) => {
    throw e instanceof LimitReached ? new LabRefused(e.message.replace("this workspace's key", "North Star's key")) : e
  })
  return limits
}

// What a person is told of the lab's key: whether they may, and this month's use of their limit.
export type LabStatus = { state: 'off' | 'not invited' | 'blocked' | 'open'; agreed: boolean; models: string[]; limitCents: number; usedCents: number; resets: string }
export async function labStatus(db: Firestore, o: { uid: string; email?: string; emailVerified?: boolean }, now = Date.now()): Promise<LabStatus> {
  const { pub, priv } = await labNow(db)
  const me = (await labPersonRef(db, o.uid).get()).data() as LabPerson | undefined
  const month = monthOf(now)
  const [meter, rate] = await Promise.all([db.doc(`aiMeters/${meterId('lab', month, { uid: o.uid })}`).get(), rateOf(db, month)])
  const m = meter.data() as Meter | undefined
  const limitCents = me?.personCents ?? pub.personCents
  const state = !pub.on || !pub.hasKey ? 'off' : me?.blocked ? 'blocked' : priv.invitedOnly && !(o.email && o.emailVerified && (await labInviteRef(db, o.email).get()).exists) ? 'not invited' : 'open'
  return { state, agreed: !!me?.agreedAt, models: pub.models, limitCents, usedCents: microToCents((m?.spent ?? 0) + (m?.reserved ?? 0), rate), resets: resetsOn(now) }
}

export async function agreeToLab(db: Firestore, uid: string, now = Date.now()): Promise<void> {
  await labPersonRef(db, uid).set({ agreedAt: now }, { merge: true })
}

// ---- What a lab admin changes (the backoffice), each in the audit log

export type LabPatch = { on?: boolean; models?: string[]; personCents?: number; totalCents?: number | null; invitedOnly?: boolean }
const cents = (v: unknown, nullable: boolean) => (v === null && nullable ? null : typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10_000_000 ? v : (() => { throw new LabRefused('An amount is whole euro cents.') })())

export function readLabPatch(d: Record<string, unknown>): LabPatch {
  const p: LabPatch = {}
  if (d.on !== undefined) p.on = d.on === true
  if (d.invitedOnly !== undefined) p.invitedOnly = d.invitedOnly === true
  if (d.models !== undefined) {
    if (!Array.isArray(d.models) || d.models.length > 20 || !d.models.every((m) => typeof m === 'string' && MODEL_ID.test(m))) throw new LabRefused('Models: a list of model ids.')
    p.models = [...new Set(d.models as string[])]
  }
  if (d.personCents !== undefined) p.personCents = cents(d.personCents, false) as number
  if (d.totalCents !== undefined) p.totalCents = cents(d.totalCents, true)
  return p
}

const pick = <T extends object>(o: T, keys: string[]) => Object.fromEntries(keys.map((k) => [k, (o as Record<string, unknown>)[k] ?? null]))

export async function setLab(db: Firestore, by: string, patch: LabPatch, reason?: string): Promise<LabPublic & LabPrivate> {
  return audited(db, async (tx) => {
    const [p, q] = await tx.getAll(labPublicRef(db), labPrivateRef(db))
    const pub = { on: false, hasKey: false, models: [], personCents: DEFAULT_PERSON_CENTS, ...((p.data() as Partial<LabPublic>) ?? {}) }
    const priv = { invitedOnly: true, totalCents: DEFAULT_TOTAL_CENTS, ...((q.data() as Partial<LabPrivate>) ?? {}) }
    const nextPub = { ...pub, ...(patch.on !== undefined ? { on: patch.on } : {}), ...(patch.models ? { models: patch.models } : {}), ...(patch.personCents !== undefined ? { personCents: patch.personCents } : {}) }
    const nextPriv = { ...priv, ...(patch.invitedOnly !== undefined ? { invitedOnly: patch.invitedOnly } : {}), ...(patch.totalCents !== undefined ? { totalCents: patch.totalCents } : {}) }
    const changed = Object.keys(patch).filter((k) => JSON.stringify((k in nextPub ? nextPub : nextPriv)[k as never] ?? null) !== JSON.stringify((k in pub ? pub : priv)[k as never] ?? null))
    if (!changed.length) return { entry: null, value: { ...nextPub, ...nextPriv } }
    tx.set(labPublicRef(db), nextPub)
    tx.set(labPrivateRef(db), nextPriv)
    const was = { ...pub, ...priv }
    const now = { ...nextPub, ...nextPriv }
    const entry: Act = { what: `lab key: ${changed.join(', ')}`, by, from: pick(was, changed), to: pick(now, changed), ...(reason ? { reason: reason.slice(0, 300) } : {}) }
    return { entry, value: now }
  })
}

// The key itself: kept sealed (`seal` is the caller's), its hint public to admins only.
export async function setLabKey(db: Firestore, by: string, box: Record<string, unknown> | null, hint: string | null): Promise<void> {
  await audited(db, async (tx) => {
    const [q, p] = await tx.getAll(labPrivateRef(db), labPublicRef(db))
    const was = (q.data() as LabPrivate | undefined)?.keyHint ?? null
    if (box) tx.set(db.doc(LAB_SECRET), box)
    else tx.delete(db.doc(LAB_SECRET))
    tx.set(labPrivateRef(db), { keyHint: hint, keySetAt: Date.now() }, { merge: true })
    tx.set(labPublicRef(db), { ...(p.data() ?? { on: false, models: [], personCents: DEFAULT_PERSON_CENTS }), hasKey: !!box }, { merge: true })
    return { entry: { what: box ? (was ? 'lab key replaced' : 'lab key set') : 'lab key removed', by, ...(was ? { from: was } : {}), ...(hint ? { to: hint } : {}) }, value: null }
  })
}

// A person's standing on the lab's key: blocked or not, their own limit (null: the usual), with why.
export async function setLabPerson(db: Firestore, by: string, uid: string, patch: { blocked?: boolean; personCents?: number | null }, reason: string): Promise<void> {
  await audited(db, async (tx) => {
    const ref = labPersonRef(db, uid)
    const was = ((await tx.get(ref)).data() ?? {}) as LabPerson
    const next: LabPerson = { ...was, ...(patch.blocked !== undefined ? { blocked: patch.blocked } : {}), ...(patch.personCents !== undefined ? { personCents: patch.personCents } : {}), reason: reason.slice(0, 300) }
    tx.set(ref, next)
    return { entry: { what: `lab key: ${patch.blocked !== undefined ? (patch.blocked ? 'person blocked' : 'person freed') : 'person limit'}`, by, to: { uid, ...patch }, reason }, value: null }
  })
}

export async function inviteToLab(db: Firestore, by: string, email: string, on: boolean): Promise<void> {
  const e = email.trim().toLowerCase()
  if (!EMAIL.test(e)) throw new LabRefused("That isn't an email address.")
  await audited(db, async (tx) => {
    const ref = labInviteRef(db, e)
    const had = (await tx.get(ref)).exists
    if (had === on) return { entry: null, value: null }
    if (on) tx.set(ref, { by, at: Date.now() })
    else tx.delete(ref)
    // The address itself stays out of the log: who invited, and a hash to tell two apart.
    return { entry: { what: on ? 'lab key: invited' : 'lab key: invite taken back', by, to: { email: `${e.slice(0, 2)}…@${e.split('@')[1]}` } }, value: null }
  })
}

