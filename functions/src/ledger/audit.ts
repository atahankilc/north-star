// The audit log of what people with power did (D-434, docs/specs/agent-server.md §8.2–§8.3): a key set, replaced or
// removed, who may use it, its models, its limits. An act and its entry are one transaction: neither without the other.
// Entries are numbered and each carries the hash of the one before, so one changed or taken out shows when the chain is
// walked; each is also a line in Cloud Logging, which a log bucket with a locked retention keeps apart. A key appears only
// as `sk-…abcd`. No client writes here (firestore.rules); owners read their workspace's, lab admins the lab's.
import { createHash } from 'node:crypto'
import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'

export type Act = { what: string; by: string; wid?: string | null; from?: unknown; to?: unknown; reason?: string }
export type Entry = Act & { at: number; seq: number; prev: string; hash: string }
type Head = { seq: number; hash: string }

const headRef = (db: Firestore) => db.doc('auditHead/main')
const entryRef = (db: Firestore, seq: number) => db.doc(`audit/${String(seq).padStart(12, '0')}`)
const START = '0'.repeat(64)

// The same entry always hashes the same: its fields in a fixed order.
export const hashOf = (prev: string, e: Omit<Entry, 'hash' | 'prev'>) => createHash('sha256').update(`${prev}\n${JSON.stringify([e.seq, e.at, e.what, e.by, e.wid ?? null, e.from ?? null, e.to ?? null, e.reason ?? null])}`).digest('hex')

// Runs `act` in a transaction whose last write is its entry. `act` reads first, then writes, and says what it did (null:
// nothing happened, no entry).
export async function audited<T>(db: Firestore, act: (tx: Transaction) => Promise<{ entry: Act | null; value: T }>, now = Date.now()): Promise<T> {
  let written: Entry | null = null
  const value = await db.runTransaction(async (tx) => {
    written = null
    const head = ((await tx.get(headRef(db))).data() as Head | undefined) ?? { seq: 0, hash: START }
    const r = await act(tx)
    if (r.entry) {
      const base = { ...clean(r.entry), at: now, seq: head.seq + 1 }
      const entry: Entry = { ...base, prev: head.hash, hash: hashOf(head.hash, base) }
      tx.create(entryRef(db, entry.seq), entry)
      tx.set(headRef(db), { seq: entry.seq, hash: entry.hash } satisfies Head)
      written = entry
    }
    return r.value
  })
  if (written) logger.info('audit', { audit: written })
  return value
}

// Fields with nothing in them left out (Firestore keeps no undefined).
const clean = (a: Act): Act => JSON.parse(JSON.stringify(a)) as Act

// Walks the newest `n` entries back from the head: where the chain breaks, if it does.
export async function checkChain(db: Firestore, n = 1000): Promise<{ ok: true; seen: number } | { ok: false; at: number; why: string }> {
  const head = (await headRef(db).get()).data() as Head | undefined
  if (!head) return { ok: true, seen: 0 }
  const from = Math.max(1, head.seq - n + 1)
  const docs = await db.collection('audit').where('seq', '>=', from).orderBy('seq').get()
  const list = docs.docs.map((d) => d.data() as Entry)
  for (let i = 0; i < list.length; i++) {
    const e = list[i]
    if (e.seq !== from + i) return { ok: false, at: from + i, why: 'an entry is missing' }
    const { hash, prev, ...base } = e
    if (hashOf(prev, base) !== hash) return { ok: false, at: e.seq, why: 'an entry was changed' }
    if (i > 0 && prev !== list[i - 1].hash) return { ok: false, at: e.seq, why: 'the chain is broken' }
  }
  if (list.length && list[list.length - 1].hash !== head.hash) return { ok: false, at: head.seq, why: "the head doesn't match the last entry" }
  return { ok: true, seen: list.length }
}

export type { DocumentReference }
