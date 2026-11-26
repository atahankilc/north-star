// A chat between its runs (D-434): the model's history, the short ids, the pending changes and the job, kept as they are;
// and the chat as the workspace keeps it (agentChats, src/agent/chats.ts), written by the server so an answer is there
// whether or not a tab was open. A thread that was dropped, or a chat that began in a tab, is built again from that.
import type { Firestore } from 'firebase-admin/firestore'
import { discard, emptyChangeset, type ChangeItem } from '../../../src/agent/changeset'
import { chatDocs, historyOf, reopenedJob, type ChatBody, type ChatSummary, type SavedTurn } from '../../../src/agent/chats'
import { chooseAt, JOB_BUDGET, moveAfterTurn, nextMove, nextStep, takeMove, type Job } from '../../../src/agent/job'
import { makeIds } from '../../../src/agent/read'
import { withOutcome, type Report } from '../../../src/agent/workflow'
import type { AgentTurn, ModelMessage } from '../../../src/agent/contract'
import type { Told } from './ask'
import type { EnvState } from './env'
import { threadPath, type Keep } from './keep'
import { threadId } from './runs'

export type KeptThread = { v: 1; history: ModelMessage[]; env: EnvState }

const chatRef = (db: Firestore, wid: string, chatId: string) => db.doc(`workspaces/${wid}/agentChats/${chatId}`)
const bodyRef = (db: Firestore, wid: string, chatId: string) => db.doc(`workspaces/${wid}/agentChats/${chatId}/content/body`)

export async function loadThread(keep: Keep, db: Firestore, o: { uid: string; wid: string; chatId: string }): Promise<KeptThread> {
  const kept = await keep.load<KeptThread>(threadPath(o.uid, o.wid, o.chatId))
  if (kept?.v === 1) return kept
  const summary = (await chatRef(db, o.wid, o.chatId).get()).data() as ChatSummary | undefined
  const body = summary?.uid === o.uid ? ((await bodyRef(db, o.wid, o.chatId).get()).data() as ChatBody | undefined) : undefined
  return { v: 1, history: body ? historyOf(body.turns) : [], env: { changes: emptyChangeset(), ids: body?.ids ?? makeIds().toJSON(), job: reopenedJob(body?.job) } }
}

// The chat's entries of one run, as the column shows and keeps them.
export function entriesOfRun(o: { asked: string[]; turn: AgentTurn; model: string; steps: SavedTurn['steps']; items: ChangeItem[]; now: number }): SavedTurn[] {
  return [
    ...o.asked.map((text): SavedTurn => ({ role: 'user', text, at: o.now })),
    { role: 'agent', text: o.turn.answer || (o.turn.error ? `! ${o.turn.error}` : ''), at: o.now, ...(o.steps?.length ? { steps: o.steps } : {}), usage: { input: o.turn.usage.input, output: o.turn.usage.output }, ms: o.turn.ms, end: o.turn.end, model: o.model, ...(o.turn.sources?.length ? { sources: o.turn.sources } : {}) },
    ...(o.items.length ? [{ role: 'changes' as const, text: o.items.map((i) => `${i.sign ?? (i.delete ? '−' : '~')} ${i.where}\t${i.line}`).join('\n'), at: o.now, applied: { state: 'not applied' as const, count: o.items.length } }] : []),
  ]
}

// Adds a run's entries to the saved chat (made if it isn't there), as its person; never over someone else's. A change
// list still open from the run before is the same preview grown: the new one takes its place. Once a run, however often
// its end is tried (the thread's doc says which run was saved last).
export async function saveRun(db: Firestore, o: { run: string; uid: string; wid: string; chatId: string; model: string; entries: SavedTurn[]; env: EnvState; now: number }): Promise<void> {
  await db.runTransaction(async (tx) => {
    const was = (await tx.get(chatRef(db, o.wid, o.chatId))).data() as ChatSummary | undefined
    const at = db.doc(`agentThreads/${threadId(o.wid, o.chatId)}`)
    if ((await tx.get(at)).data()?.saved === o.run) return
    if (was && was.uid !== o.uid) return
    const body = (await tx.get(bodyRef(db, o.wid, o.chatId))).data() as ChatBody | undefined
    const before = body?.turns ?? []
    const last = before[before.length - 1]
    const open = last?.role === 'changes' && last.applied?.state === 'not applied'
    const turns = [...(open && o.entries.some((e) => e.role === 'changes') ? before.slice(0, -1) : before), ...o.entries]
    const docs = chatDocs({ uid: o.uid, model: o.model, turns, ids: o.env.ids, was: was ?? null, now: o.now, job: o.env.job })
    tx.set(chatRef(db, o.wid, o.chatId), plain(docs.summary))
    tx.set(bodyRef(db, o.wid, o.chatId), plain(docs.body))
    tx.set(at, { saved: o.run }, { merge: true })
  })
}
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

// What the job does after a turn that ended by itself: words to go on with, if any (src/agent/job.ts, the app's and the
// evals' own step). `left`: what the person wrote too late for the turn's last step goes first.
export function afterTurn(env: EnvState, o: { turn: AgentTurn; left: string[] }): { env: EnvState; say?: string; auto?: boolean } {
  const spent = env.job && env.job.status !== 'done' ? { ...env.job, tokens: env.job.tokens + o.turn.usage.input + o.turn.usage.output } : env.job
  const left = o.left.join('\n\n').trim()
  if (left) return { env: { ...env, job: spent }, say: left }
  const taken = takeMove(spent, moveAfterTurn(spent, { pending: env.changes.items.length > 0, stopped: o.turn.end === 'stopped' }))
  return { env: { ...env, job: taken?.job ?? spent }, ...(taken?.send !== undefined ? { say: taken.send, auto: true } : {}) }
}

// A message starting a run: a paused job goes on with it, a planned one takes the preview suggested (D-328).
export function onAsk(env: EnvState): EnvState {
  const j = env.job
  if (j?.status === 'paused') return { ...env, job: { ...j, status: 'running', paused: undefined, settledAt: -1 } }
  if (j?.status === 'planned' && !j.preview) return { ...env, job: chooseAt(j) }
  return env
}

// What the person did, taken into the thread: the model hears it with its next turn, the pending changes go with an
// outcome, the job moves. `say`: a run that follows by itself.
export function tell(t: KeptThread, what: Told['what']): { thread: KeptThread; say?: string } {
  const env = t.env
  if (what.kind === 'applied' || what.kind === 'discarded') {
    const report: Report = { text: what.text, done: what.done, notDone: what.notDone, step: null }
    const history = withOutcome(t.history, what.kind === 'applied' ? { applied: report } : { discarded: report })
    const taken = takeMove(env.job, nextMove(env.job, what.kind === 'applied' ? { applied: what.done.length } : { discarded: true }))
    return { thread: { v: 1, history, env: { ...env, changes: discard(env.changes), job: taken?.job ?? env.job } }, ...(taken?.send !== undefined ? { say: taken.send } : {}) }
  }
  if (what.kind === 'undone') return { thread: { ...t, history: withOutcome(t.history, { undone: true }) } }
  const j = env.job
  const withJob = (job: Job | null, say?: string) => ({ thread: { ...t, env: { ...env, job } }, ...(say !== undefined ? { say } : {}) })
  if (!j) return { thread: t }
  const goOn = (job: Job) => {
    const nx = nextStep(job)
    return job.status === 'done' || !nx ? withJob(job) : withJob({ ...job, status: 'running', paused: undefined, stopAfter: undefined, settledAt: -1 }, `Go on with step ${nx.n} of ${job.steps.length}: ${nx.title}.`)
  }
  switch (what.act) {
    case 'all':
    case 'each':
      return j.status === 'planned' ? withJob(chooseAt(j, what.act), what.act === 'all' ? 'go (one preview at the end)' : 'go (one preview per step)') : { thread: t }
    case 'stopAfter':
      return withJob({ ...j, stopAfter: true })
    case 'keepOn':
      return withJob({ ...j, stopAfter: undefined })
    case 'goOn':
      return goOn(j)
    case 'raise':
      return goOn({ ...j, budget: j.budget + JOB_BUDGET })
    case 'drop':
      return withJob(null)
  }
}
