// The agent's functions as they're called (D-434): checks, then the run's parts. Loaded by index.ts only when one of them
// runs, so the light functions start without it.
import { createHmac, randomUUID } from 'node:crypto'
import type { Database } from 'firebase-admin/database'
import type { Firestore } from 'firebase-admin/firestore'
import type { WebConfig } from './person'
import { BadAsk, readAsk, readTold, type Ask } from './ask'
import { dropRunKey, keepRunKey, mayPay, modelFor, ownKeys, ownSecret, keyLooksRight, passRunKey, type Provider } from './keys'
import { changesPath, runPath, threadPath, type Keep } from './keep'
import { dropLive } from './live'
import { NotAMember, roleNow } from './membership'
import { endRun, Held, newRunId, Refused, runRef, startRun, threadRef, type Run, type Thread } from './runs'
import { loadThread, tell } from './thread'
import { Stop, work, type KeptAsk, type Worked } from './worker'
import { keyHint, seal } from '../seal'
import type { Changeset } from '../../../src/agent/changeset'

export { BadAsk, Held, NotAMember, Refused }

export type Deps = {
  db: Firestore
  rtdb: Database
  keep: Keep
  web: WebConfig
  secret: string
  // Set only for emulator tests against a fake OpenAI.
  openai?: string
  enqueue: (run: string) => Promise<void>
  log: (what: string, more?: Record<string, unknown>) => void
}
export type Caller = { uid: string; name?: string }

// A message: a run made and queued. Answers with its id; the rest comes over RTDB.
export async function startAgentRun(who: Caller, data: unknown, d: Deps): Promise<{ run: string }> {
  const ask = readAsk(data)
  await roleNow(d.db, ask.wid, who.uid)
  const provider = await mayPay(d.db, { uid: who.uid, wid: ask.wid, paidBy: ask.paidBy, model: ask.model, ...(ask.key ? { key: ask.key } : {}) })
  const run = await queueRun(d, who, { ...ask, provider }, { text: ask.text, view: ask.view, ...(ask.off ? { off: ask.off } : {}) })
  return { run }
}

// A run made and queued. What it's asked is kept before the run exists, so a worker never finds a run with nothing to
// do; dropped, with its key, if the run isn't made.
async function queueRun(d: Deps, who: Caller, r: Pick<Ask, 'wid' | 'chatId' | 'paidBy' | 'model' | 'effort' | 'key'> & { provider: Provider }, kept: Omit<KeptAsk, 'name'>): Promise<string> {
  const id = newRunId(d.db)
  await d.keep.save(runPath(who.uid, id, 'ask'), { ...kept, ...(who.name ? { name: who.name } : {}) } satisfies KeptAsk)
  if (r.key) await keepRunKey(d.db, id, r.key, d.secret, Date.now())
  try {
    await startRun(d.db, id, { uid: who.uid, wid: r.wid, chatId: r.chatId, paidBy: r.paidBy, provider: r.provider, model: r.model, ...(r.effort ? { effort: r.effort } : {}) })
  } catch (e) {
    await Promise.all([d.keep.drop(runPath(who.uid, id, 'ask')), dropRunKey(d.db, id)]).catch(() => undefined)
    throw e
  }
  await d.enqueue(id)
  return id
}

// The queue's worker.
export function workRun(run: string, d: Deps & { deadline: number }): Promise<Worked> {
  return work(run, {
    ...d,
    by: randomUUID(),
    model: (r) =>
      modelFor(d.db, r, { secret: d.secret, safetyId: createHmac('sha256', d.secret).update(`safety:${r.uid}`).digest('hex'), ...(d.openai ? { openai: d.openai } : {}) }).catch((e) => {
        throw e instanceof Refused ? new Stop(e.message) : e
      }),
    keyTo: (r, next) => passRunKey(d.db, r, next),
    keyDone: (r) => dropRunKey(d.db, r),
    used: (r, u) => void logUse(d.db, r, u).catch((e) => d.log('usage log failed', { run: r.id, error: (e as Error).name })),
  })
}

// A workspace key's use, as the `ai` function logs it (aiUsage; the ledger takes its place in P3). Counts only.
async function logUse(db: Firestore, r: Run & { id: string }, u: { usage: { input: number; output: number; cached?: number; reasoning?: number; searches?: number } }) {
  if (r.paidBy !== 'workspace') return
  await db.collection(`workspaces/${r.wid}/aiUsage`).add({ uid: r.uid, name: '', keySource: 'workspace', task: 'chat', model: r.model, inputTokens: u.usage.input, cachedTokens: u.usage.cached ?? 0, outputTokens: u.usage.output, reasoningTokens: u.usage.reasoning ?? 0, webSearches: u.usage.searches ?? 0, tools: [], status: 'done', ms: 0, at: Date.now() })
}

async function mine(d: Deps, who: Caller, wid: string, chatId: string): Promise<Thread> {
  const t = (await threadRef(d.db, wid, chatId).get()).data() as Thread | undefined
  if (!t || t.uid !== who.uid) throw new Refused('No such chat.', 'not-found')
  return t
}

// What the person did with a preview, or with the job's checklist; a run may follow by itself.
export async function tellAgent(who: Caller, data: unknown, d: Deps): Promise<{ run?: string; job: unknown }> {
  const told = readTold(data)
  await roleNow(d.db, told.wid, who.uid)
  const t = await mine(d, who, told.wid, told.chatId)
  if (t.running) throw new Refused('This chat is at work; wait for it, or stop it.')
  const thread = await loadThread(d.keep, d.db, { uid: who.uid, wid: told.wid, chatId: told.chatId })
  const r = tell(thread, told.what)
  await d.keep.save(threadPath(who.uid, told.wid, told.chatId), r.thread)
  if (told.what.kind === 'applied' || told.what.kind === 'discarded') {
    await d.keep.save(changesPath(who.uid, told.wid, told.chatId), { run: t.last, changes: r.thread.env.changes, ids: r.thread.env.ids, job: r.thread.env.job })
    await threadRef(d.db, told.wid, told.chatId).update({ waiting: false, updatedAt: Date.now() })
  }
  const job = r.thread.env.job
  if (r.say === undefined || !told.paidBy || !told.model) return { job }
  const provider = await mayPay(d.db, { uid: who.uid, wid: told.wid, paidBy: told.paidBy, model: told.model, ...(told.key ? { key: told.key } : {}) })
  const run = await queueRun(d, who, { wid: told.wid, chatId: told.chatId, paidBy: told.paidBy, model: told.model, ...(told.effort ? { effort: told.effort } : {}), ...(told.key ? { key: told.key } : {}), provider }, { text: r.say, view: told.view, auto: true })
  return { run, job }
}

// The chat's pending changes, for its person's preview.
export async function agentChanges(who: Caller, data: unknown, d: Deps): Promise<{ run: string | null; changes: Changeset; ids: unknown; job: unknown } | null> {
  const { wid, chatId } = (data ?? {}) as { wid?: unknown; chatId?: unknown }
  if (typeof wid !== 'string' || typeof chatId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(wid) || !/^[A-Za-z0-9_-]{1,128}$/.test(chatId)) throw new BadAsk('Bad request (chat).')
  await roleNow(d.db, wid, who.uid)
  await mine(d, who, wid, chatId)
  return d.keep.load(changesPath(who.uid, wid, chatId))
}

// A person's own key in their account: kept, replaced or removed. Checked with its provider first; never given back.
export async function setOwnAgentKey(who: Caller, data: unknown, d: Deps & { check: (key: string, p: Provider) => Promise<number> }): Promise<{ hint: string | null }> {
  const { provider, key } = (data ?? {}) as { provider?: unknown; key?: unknown }
  const p: Provider = provider === 'anthropic' ? 'anthropic' : provider === 'openai' ? 'openai' : (() => { throw new BadAsk('Bad request (provider).') })()
  if (key === '' || key === null || key === undefined) {
    await d.db.runTransaction(async (tx) => {
      const was = (await tx.get(ownKeys(d.db, who.uid))).data() ?? {}
      const { [p]: _gone, ...rest } = was
      tx.delete(ownSecret(d.db, who.uid, p))
      tx.set(ownKeys(d.db, who.uid), rest)
    })
    return { hint: null }
  }
  const clean = typeof key === 'string' ? key.trim() : ''
  if (!keyLooksRight(clean, p)) throw new Refused(`That doesn't look like ${p === 'openai' ? 'an OpenAI' : 'a Claude'} key.`)
  const status = await d.check(clean, p)
  if (status !== 200) throw new Refused(status === 401 ? `${p === 'openai' ? 'OpenAI' : 'Anthropic'} didn't accept this key.` : `${p === 'openai' ? 'OpenAI' : 'Anthropic'} answered ${status}.`)
  const hint = keyHint(clean)
  await d.db.runTransaction(async (tx) => {
    const was = (await tx.get(ownKeys(d.db, who.uid))).data() ?? {}
    tx.set(ownSecret(d.db, who.uid, p), { ...seal(clean, d.secret), at: Date.now() })
    tx.set(ownKeys(d.db, who.uid), { ...was, [p]: { hint, at: Date.now() } })
  })
  return { hint }
}

// What was left behind: a run whose worker died or was never queued is queued again; an own key whose run is over, and a
// run's live node a while after its end, go.
export const STALE_MS = 3 * 60_000
export const LIVE_KEPT_MS = 10 * 60_000
const RUN_KEY_MAX_MS = 2 * 60 * 60_000
const DAY_MS = 24 * 60 * 60_000
export async function closeStale(d: Deps, now = Date.now()): Promise<{ queued: number; ended: number; keys: number; live: number }> {
  const out = { queued: 0, ended: 0, keys: 0, live: 0 }
  const open = await d.db.collection('agentRuns').where('status', 'in', ['queued', 'running']).limit(300).get()
  for (const s of open.docs) {
    const r = s.data() as Run
    const since = Math.max(r.createdAt, r.lease?.until ?? 0)
    if (now - since < STALE_MS) continue
    if (now - r.createdAt > DAY_MS) {
      if (await endRun(d.db, s.id, null, { status: 'failed', said: 'This stopped on the way; send it again.' })) out.ended++
    } else {
      await d.enqueue(s.id)
      out.queued++
    }
  }
  const keys = await d.db.collection('aiSecrets').where('runAt', '<', now - RUN_KEY_MAX_MS).limit(300).get()
  for (const s of keys.docs) {
    if (!s.id.startsWith('run_')) continue
    const run = (await runRef(d.db, s.id.slice(4)).get()).data() as Run | undefined
    if (run && (run.status === 'queued' || run.status === 'running') && now - run.createdAt < DAY_MS) continue
    await s.ref.delete()
    out.keys++
  }
  const ended = await d.db.collection('agentRuns').where('endedAt', '>', now - 3 * LIVE_KEPT_MS).limit(300).get()
  for (const s of ended.docs) {
    const r = s.data() as Run
    if (now - (r.endedAt ?? now) < LIVE_KEPT_MS) continue
    await dropLive(d.rtdb, r.uid, s.id)
    out.live++
  }
  if (out.keys) d.log('own keys left behind were deleted', { keys: out.keys })
  return out
}
