// Runs and the chats they belong to (D-434, docs/specs/agent-server.md §5.2): who, which chat, which model, how far, how it
// ended; never text. `agentRuns/{id}` one run (one turn); `agentThreads/{wid}_{chatId}` the chat on the server: whose it
// is and which run it's on, so a chat has one run at a time. Written here only (firestore.rules lets its person read).
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore'
import type { PaidBy } from './ask'

export type RunStatus = 'queued' | 'running' | 'waiting' | 'done' | 'stopped' | 'failed'
export type Run = {
  uid: string
  wid: string
  chatId: string
  turn: number
  status: RunStatus
  paidBy: PaidBy
  provider: 'openai' | 'anthropic'
  model: string
  effort?: string
  createdAt: number
  startedAt?: number
  endedAt?: number
  // The worker that holds it and until when; taken again when that passed.
  lease?: { by: string; until: number } | null
  attempts: number
  steps: number
  // How many changes wait in the preview at its end; the loop's own word for the end; what stopped it, in plain words.
  pending?: number
  end?: string
  said?: string
  // The run that goes on after it by itself (a job's next step, words sent too late for its last step).
  next?: string
}
export type Thread = { uid: string; wid: string; chatId: string; running: string | null; last: string | null; turn: number; waiting: boolean; updatedAt: number; saved?: string }

// A worker renews it every 30 s; a dead one's runs out within this, and the task's tries (5, then up to 60 s apart) outlast it.
export const LEASE_MS = 60_000
export const ATTEMPTS_MAX = 5
// At most this many runs at once for one person, over all their chats.
export const RUNS_AT_ONCE = 3

export class Refused extends Error {
  constructor(
    message: string,
    public code: 'failed-precondition' | 'permission-denied' | 'resource-exhausted' | 'not-found' = 'failed-precondition',
  ) {
    super(message)
  }
}

export const threadId = (wid: string, chatId: string) => `${wid}_${chatId}`
export const runRef = (db: Firestore, id: string) => db.doc(`agentRuns/${id}`)
export const threadRef = (db: Firestore, wid: string, chatId: string) => db.doc(`agentThreads/${threadId(wid, chatId)}`)
export const newRunId = (db: Firestore) => db.collection('agentRuns').doc().id

export type NewRun = Pick<Run, 'uid' | 'wid' | 'chatId' | 'paidBy' | 'provider' | 'model' | 'effort'>

// Makes the run and puts the chat on it, all or nothing. `after`: the run this one follows by itself (the chat is still
// on it). Refuses a chat that's busy or someone else's.
function addRun(tx: Transaction, db: Firestore, id: string, r: NewRun, thread: Thread | null, now: number) {
  const turn = (thread?.turn ?? 0) + 1
  const run: Run = { uid: r.uid, wid: r.wid, chatId: r.chatId, turn, status: 'queued', paidBy: r.paidBy, provider: r.provider, model: r.model, ...(r.effort ? { effort: r.effort } : {}), createdAt: now, attempts: 0, steps: 0 }
  tx.create(runRef(db, id), run)
  tx.set(threadRef(db, r.wid, r.chatId), { uid: r.uid, wid: r.wid, chatId: r.chatId, running: id, last: id, turn, waiting: false, updatedAt: now, ...(thread?.saved ? { saved: thread.saved } : {}) } satisfies Thread)
  return turn
}

export async function startRun(db: Firestore, id: string, r: NewRun, now = Date.now()): Promise<number> {
  const going = await db.collection('agentRuns').where('uid', '==', r.uid).where('status', 'in', ['queued', 'running']).count().get()
  if (going.data().count >= RUNS_AT_ONCE) throw new Refused(`You have ${RUNS_AT_ONCE} chats at work already: wait for one, or stop it.`, 'resource-exhausted')
  return db.runTransaction(async (tx) => {
    const thread = ((await tx.get(threadRef(db, r.wid, r.chatId))).data() as Thread | undefined) ?? null
    if (thread && thread.uid !== r.uid) throw new Refused("That chat isn't yours.", 'permission-denied')
    if (thread?.running) throw new Refused('This chat is at work already.')
    // A chat kept in the workspace (agentChats) is its writer's, shared or not.
    const chat = (await tx.get(db.doc(`workspaces/${r.wid}/agentChats/${r.chatId}`))).data() as { uid?: string } | undefined
    if (chat && chat.uid !== r.uid) throw new Refused("That chat isn't yours.", 'permission-denied')
    return addRun(tx, db, id, r, thread, now)
  })
}

// Another worker holds the run, and its lease hasn't run out: the task is tried again later (Cloud Tasks may deliver a task
// twice, or try it again before a dead worker's lease is out), until the run ends or the lease is free.
export class Held extends Error {}

// The worker takes a queued run, or one whose worker died. Null: there's nothing to do (it ended). Throws Held while
// another worker holds it. `spent`: tried too often, the caller ends it.
export async function takeLease(db: Firestore, id: string, by: string, now = Date.now()): Promise<{ run: Run; spent: boolean } | null> {
  return db.runTransaction(async (tx) => {
    const run = (await tx.get(runRef(db, id))).data() as Run | undefined
    if (!run || (run.status !== 'queued' && run.status !== 'running')) return null
    if (run.lease && run.lease.until > now && run.lease.by !== by) throw new Held()
    const attempts = run.attempts + 1
    tx.update(runRef(db, id), { status: 'running', lease: { by, until: now + LEASE_MS }, attempts, ...(run.startedAt ? {} : { startedAt: now }) })
    return { run: { ...run, status: 'running', attempts }, spent: attempts > ATTEMPTS_MAX }
  })
}

export class LeaseLost extends Error {}

// Still this worker's: held for longer, with the step it's at. Throws LeaseLost when it isn't (it must stop at once).
export async function renewLease(db: Firestore, id: string, by: string, step: number, now = Date.now()): Promise<void> {
  await db.runTransaction(async (tx) => {
    const run = (await tx.get(runRef(db, id))).data() as Run | undefined
    if (!run || run.status !== 'running' || run.lease?.by !== by) throw new LeaseLost()
    tx.update(runRef(db, id), { lease: { by, until: now + LEASE_MS }, steps: step })
  })
}

// Given back with the run still to do (its time is nearly up): the next task takes it at once. `fresh`: not a failure,
// so it doesn't count as a try.
export async function releaseLease(db: Firestore, id: string, by: string, fresh: boolean): Promise<void> {
  await db.runTransaction(async (tx) => {
    const run = (await tx.get(runRef(db, id))).data() as Run | undefined
    if (!run || run.status !== 'running' || run.lease?.by !== by) return
    tx.update(runRef(db, id), { lease: null, ...(fresh ? { attempts: FieldValue.increment(-1) } : {}) })
  })
}

export type Ending = { status: Exclude<RunStatus, 'queued' | 'running'>; end?: string; said?: string; pending?: number; steps?: number }

// Ends a run and frees its chat, or puts the chat on the run that follows it, all in one. False: it had ended already.
export async function endRun(db: Firestore, id: string, by: string | null, e: Ending, next?: { id: string; run: NewRun }, now = Date.now()): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const run = (await tx.get(runRef(db, id))).data() as Run | undefined
    if (!run || (run.status !== 'queued' && run.status !== 'running')) return false
    if (by !== null && run.lease?.by !== by) return false
    const thread = ((await tx.get(threadRef(db, run.wid, run.chatId))).data() as Thread | undefined) ?? null
    tx.update(runRef(db, id), { status: e.status, endedAt: now, lease: null, ...(e.end ? { end: e.end } : {}), ...(e.said ? { said: e.said.slice(0, 500) } : {}), ...(e.pending !== undefined ? { pending: e.pending } : {}), ...(e.steps !== undefined ? { steps: e.steps } : {}), ...(next ? { next: next.id } : {}) })
    if (next && thread) addRun(tx, db, next.id, next.run, thread, now)
    else if (thread?.running === id) tx.update(threadRef(db, run.wid, run.chatId), { running: null, waiting: !!e.pending, updatedAt: now })
    return true
  })
}
