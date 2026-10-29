// The agent's driver in the browser (S14, D-312; docs/specs/agent.md §4.5, §4.6, §6 Phase 6): the chat's state for the
// UI (a zustand store) and what carries out the workflow's effects (workflow.ts: events in, effects out). It runs a turn
// with loop.ts' runTurn over an AgentEnv made of the workspace as it is now (`freshWs`), browser.ts' apply as the agent,
// the chat's short ids and pending changes, and the UI facade (ui.ts). Chats live in memory for this tab, one per
// workspace (saving them is S16).
//
// LOCKS (agent-run.md "S14 must"): the workflow locks the person's writes during a turn and the preview holds its own
// lock; the driver releases every agent lock (`releaseAgentLocks`) in a finally around each turn unless the turn ended
// in a preview (which keeps its lock until apply or discard), when the panel unmounts and when the workspace changes.
//
// FAIL FROM THE PREVIEW: the workflow's `fail` from previewing/applying now carries a `discard` effect (S14), so the
// changeset is emptied whenever the state says nothing is pending.
//
// THE KEY: read from this browser's storage (settings.ts' readKey) at the start of a turn and handed to makeModel; it is
// never put in the store, an entry, a log or the usage log (usage.ts keeps counts only).
import { create } from 'zustand'
import { AGENT_TOOLS } from '../tools'
import { runTurn, type LoopEvent } from '../loop'
import { devStubWanted, makeModel, SUGGESTED } from '../models'
import { initialWorkflow, reportOf, step as wfStep, type Effect, type Report, type WorkflowEvent, type WorkflowState } from '../workflow'
import { browserApply, lockPreview, lockTurn, releaseAgentLocks, undoAgentStep, unlockPreview, unlockTurn } from '../browser'
import { accept as acceptChanges, discard as discardChanges, emptyChangeset, pendingCount, type Changeset } from '../changeset'
import { makeIds, type Ids } from '../read'
import { agentUi } from '../ui'
import { recordTurn } from '../usage'
import { systemPrompt } from '../prompt'
import { freshWs } from '../../ops'
import type { OpActor } from '../../ops'
import type { AgentEnv, AgentTool, AgentWs, ModelMessage, TurnEnd, Usage } from '../contract'
import { NO_USAGE } from '../contract'
import { readKey, useAgentSettings } from './settings'
import { plainError, NO_KEY } from './errors'

export { plainError, KEY_REFUSED, NO_KEY } from './errors'

// ---- What the chat shows

export type StepLine = { id: string; label: string; running: boolean; ok?: boolean; ms?: number; say?: string }

export type ChangeLine = { id: string; line: string; where: string; delete: boolean; why?: string }

export type Entry =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'agent'; text: string; live: string; steps: StepLine[]; usage: Usage; running: boolean; ms?: number; end?: TurnEnd; error?: string; errorSettings?: boolean; model: string }
  // The pending changes (S14's simple list; S15's preview replaces it): `pending` until applied or discarded.
  | { id: string; kind: 'changes'; items: ChangeLine[]; warnings: string[]; state: 'pending' | 'applying' | 'applied' | 'undone' | 'discarded' | 'revising'; said?: string }
  // After an accept or discard: the workflow's report, and where the changes were (`Segments`), for the status line.
  | { id: string; kind: 'report'; report: Report; wheres: string[]; count: number }
  | { id: string; kind: 'note'; text: string; tone?: 'error'; settings?: boolean }

export type Chat = { id: string; wid: string; model: string; entries: Entry[]; wf: WorkflowState }

export type Mode = 'closed' | 'box' | 'column'

// Where the agent is looking (its local presence: a mark gliding to what it reads or changes). Never sent anywhere.
export type Touch = { id: string; kind: 'read' | 'change' | 'ui'; at: number }

type Me = { uid: string; name?: string }

type AgentState = {
  mode: Mode
  wid: string | null
  chat: Chat
  touch: Touch | null
}

export const READ_ONLY = "## You only read here\nThe person is a viewer in this workspace, so you can read and answer but never change anything: there is no change tool. When they ask for a change, say that an editor can make it, and offer the exact words or steps so they can pass it on."

// ---- Per chat, outside React: the model's history, the chat's ids, the pending changes, the running turn's abort.

type Runtime = { history: ModelMessage[]; ids: Ids; changes: Changeset; abort: AbortController | null; last: AgentWs | null }

const runtimes = new Map<string, Runtime>()
const chats = new Map<string, Chat>()
let me: Me | null = null
let n = 0
const uid = (p: string) => `${p}${Date.now().toString(36)}${(++n).toString(36)}`

const newChat = (wid: string): Chat => {
  const c: Chat = { id: uid('chat'), wid, model: '', entries: [], wf: initialWorkflow() }
  runtimes.set(c.id, { history: [], ids: makeIds(), changes: emptyChangeset(), abort: null, last: null })
  return c
}

const rtOf = (c: Chat): Runtime => {
  let r = runtimes.get(c.id)
  if (!r) runtimes.set(c.id, (r = { history: [], ids: makeIds(), changes: emptyChangeset(), abort: null, last: null }))
  return r
}

export const useAgent = create<AgentState>(() => ({ mode: 'closed', wid: null, chat: newChat(''), touch: null }))

const get = () => useAgent.getState()
const setChat = (f: (c: Chat) => Chat) => {
  const c = f(get().chat)
  chats.set(c.wid, c)
  useAgent.setState({ chat: c })
}
const patchEntry = (id: string, f: (e: Entry) => Entry) => setChat((c) => ({ ...c, entries: c.entries.map((e) => (e.id === id ? f(e) : e)) }))
const push = (e: Entry) => setChat((c) => ({ ...c, entries: [...c.entries, e] }))

// ---- The model the chat uses

// The dev stub, asked for by `?agentStub=1` when the workspace opened: kept for this tab (the app rewrites the address
// as you focus and unfocus, which drops the parameter). Dev builds only (devStubWanted is false in production).
let stubAsked = devStubWanted()
export const stubOn = () => (stubAsked ||= devStubWanted())
export const chatModel = (c: Chat = get().chat) => (stubOn() ? 'dev stub' : c.model || useAgentSettings.getState().model || SUGGESTED)
// A key is there (or the dev stub stands in for the model).
export const canRun = () => stubOn() || useAgentSettings.getState().hasKey

// ---- The workspace and the person

const roleOf = (ws: AgentWs | null, u: string): OpActor['role'] => (ws?.workspace.roles?.[u] as OpActor['role']) ?? 'viewer'
const actorOf = (ws: AgentWs | null): OpActor => ({ uid: me?.uid ?? '', role: roleOf(ws, me?.uid ?? ''), agent: true, ...(me?.name ? { name: me.name } : {}) })

export const isViewer = (wid: string | null) => {
  const ws = wid ? freshWs(wid) : null
  return !!ws && !!me && roleOf(ws as AgentWs, me.uid) === 'viewer'
}

// A short id somewhere in a tool's arguments (`c12`, `p3`, `t40`, `x7`): the thing the agent looks at now.
const SHORT = /^[cptxd]\d+$/
function firstShort(v: unknown, depth = 0): string | undefined {
  if (depth > 4) return undefined
  if (typeof v === 'string') return SHORT.test(v) ? v : undefined
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = firstShort(x, depth + 1)
      if (s) return s
    }
    return undefined
  }
  if (v && typeof v === 'object') for (const x of Object.values(v)) {
    const s = firstShort(x, depth + 1)
    if (s) return s
  }
  return undefined
}

const touchAt = (id: string, kind: Touch['kind']) => useAgent.setState({ touch: { id, kind, at: Date.now() } })

// The tools as the loop gets them: each call first moves the agent's mark to what it names (local only).
const TOOLS: AgentTool[] = AGENT_TOOLS.map((t) => ({
  ...t,
  run: async (env, args) => {
    const s = firstShort(args)
    const r = s ? env.ids.real(s) : undefined
    if (r) touchAt(r.id, t.kind === 'write' ? 'change' : t.kind === 'ui' ? 'ui' : 'read')
    return t.run(env, args)
  },
}))

function envOf(chat: Chat, rt: Runtime): AgentEnv {
  const wid = chat.wid
  const live = (): AgentWs => {
    const ws = freshWs(wid) as AgentWs | null
    if (ws) rt.last = ws
    if (!rt.last) throw new Error('the workspace is not open')
    return rt.last
  }
  const ws0 = live()
  const actor = actorOf(ws0)
  return {
    getWs: live,
    apply: browserApply(wid, actor, () => freshWs(wid)),
    actor,
    ids: rt.ids,
    ui: {
      ...agentUi,
      goTo: (id) => (touchAt(id, 'ui'), agentUi.goTo(id)),
      openPanel: (id) => (touchAt(id, 'ui'), agentUi.openPanel(id)),
    },
    now: () => Date.now(),
    chatId: chat.id,
    get changes() {
      return rt.changes
    },
    set changes(cs) {
      rt.changes = cs ?? emptyChangeset()
    },
  }
}

// ---- The workflow: events in, effects carried out

function dispatch(ev: WorkflowEvent) {
  const chat = get().chat
  const { state, effects } = wfStep(chat.wf, ev)
  setChat((c) => ({ ...c, wf: state }))
  for (const e of effects) run(chat.id, e)
}

const lastChanges = (c: Chat) => [...c.entries].reverse().find((e): e is Extract<Entry, { kind: 'changes' }> => e.kind === 'changes' && (e.state === 'pending' || e.state === 'applying' || e.state === 'revising'))

const linesOf = (cs: Changeset): ChangeLine[] => cs.items.map((i) => ({ id: i.id, line: i.line, where: i.where, delete: i.delete, ...(i.why ? { why: i.why } : {}) }))

function run(chatId: string, e: Effect) {
  const chat = get().chat
  if (chat.id !== chatId) return
  const rt = rtOf(chat)
  switch (e.type) {
    case 'lock':
      return lockTurn()
    case 'unlock':
      unlockTurn()
      unlockPreview()
      return
    case 'run':
      return void turn(chat, e.text, e.turn)
    case 'abort':
      return rt.abort?.abort()
    case 'preview': {
      // S15 switches the store to the previewed copy; S14 lists the changes and locks the app while they wait.
      lockPreview()
      unlockTurn()
      const was = lastChanges(chat)
      const entry: Entry = { id: uid('chg'), kind: 'changes', items: linesOf(rt.changes), warnings: rt.changes.warnings.slice(0, 3), state: 'pending' }
      setChat((c) => ({ ...c, entries: [...c.entries.filter((x) => x !== was), entry] }))
      return
    }
    case 'close_preview': {
      unlockPreview()
      const was = lastChanges(chat)
      if (was && was.state === 'pending' && get().chat.wf.phase === 'running') patchEntry(was.id, (x) => ({ ...x, state: 'revising' }) as Entry)
      return
    }
    case 'accept':
      return void accept(chat)
    case 'discard': {
      rt.changes = discardChanges(rt.changes)
      const was = lastChanges(get().chat)
      if (was) patchEntry(was.id, (x) => ({ ...x, state: 'discarded' }) as Entry)
      return
    }
    case 'report': {
      // Where the changes were, from the list that was just applied (`Segments · plane` → `Segments`).
      const list = [...get().chat.entries].reverse().find((x): x is Extract<Entry, { kind: 'changes' }> => x.kind === 'changes')
      const items = list?.state === 'applied' ? list.items : []
      const wheres = [...new Set(items.map((i) => i.where.replace(/ · [a-z ]+$/, '')))]
      return push({ id: uid('rep'), kind: 'report', report: e.report, wheres, count: e.report.done.length })
    }
    case 'undo':
      return void undoAgentStep(e.step.key).then((ok) => {
        if (get().chat.id !== chatId) return
        dispatch({ type: 'undo_done', ok })
        if (!ok) return
        const list = [...get().chat.entries].reverse().find((x) => x.kind === 'changes' && x.state === 'applied')
        if (list) patchEntry(list.id, (x) => ({ ...x, state: 'undone' }) as Entry)
      })
  }
}

async function turn(chat: Chat, text: string, n: number) {
  const rt = rtOf(chat)
  const model = chatModel(chat)
  const id = uid('ans')
  push({ id, kind: 'agent', text: '', live: '', steps: [], usage: { ...NO_USAGE }, running: true, model })
  const controller = new AbortController()
  rt.abort = controller
  const mine = () => get().chat.id === chat.id
  const on = (e: LoopEvent) => {
    if (!mine()) return
    patchEntry(id, (x) => {
      if (x.kind !== 'agent') return x
      switch (e.type) {
        case 'text':
          return { ...x, live: x.live + e.delta }
        case 'tool_started': {
          // What the model said before its calls stays as a line among the steps.
          const said: StepLine[] = x.live.trim() ? [{ id: `${e.call.id}-say`, label: '', running: false, say: x.live.trim() }] : []
          return { ...x, live: '', steps: [...x.steps, ...said, { id: e.call.id, label: e.call.label, running: true }] }
        }
        case 'tool_finished':
          return { ...x, steps: x.steps.map((s) => (s.id === e.call.id ? { ...s, running: false, ok: e.call.ok, ms: e.call.ms } : s)) }
        case 'step_started':
          return x.live.trim() && x.steps.length ? x : { ...x, live: '' }
        case 'usage':
          return { ...x, usage: e.total }
        default:
          return x
      }
    })
  }
  try {
    const stub = stubOn()
    const key = stub ? '' : readKey()
    if (!stub && !key) throw new Error('An OpenAI key is needed (Settings → the agent).')
    const env = envOf(chat, rt)
    const m = await makeModel({ model, key, env, stub, effort: useAgentSettings.getState().effort })
    // A viewer's agent gets no write tool at all, and is told up front that it reads only (§7.2 point 7).
    const viewer = env.actor.role === 'viewer'
    const tools = viewer ? TOOLS.filter((t) => t.kind !== 'write') : TOOLS
    const system = viewer ? `${systemPrompt({ workspaceName: env.getWs().workspace?.name })}\n\n${READ_ONLY}` : undefined
    const r = await runTurn(m, env, tools, rt.history, text, { signal: controller.signal, onEvent: on, turnId: `${chat.id}:${n}`, ...(system ? { system } : {}) })
    rt.history = r.history
    // The usage log counts the person's own model calls; the dev stub's scripted turns aren't any.
    // A call that failed before any token was counted isn't an answer either.
    const counted = r.turn.usage.input > 0 || r.turn.usage.output > 0 || r.turn.end !== 'error'
    if (!stub && counted) recordTurn(r.turn, m.name)
    const err = r.turn.error ? plainError(r.turn.error) : null
    patchEntry(id, (x) => (x.kind === 'agent' ? { ...x, text: r.turn.answer || (r.turn.end === 'stopped' ? '' : x.live), live: '', running: false, ms: r.turn.ms, end: r.turn.end, usage: r.turn.usage, ...(err ? { error: err.text, ...(err.settings ? { errorSettings: true } : {}) } : {}) } : x))
    if (mine()) dispatch({ type: 'turn_end', answer: r.turn.answer, pending: pendingCount(rt.changes), end: r.turn.end })
  } catch (e) {
    const err = plainError((e as Error)?.message ?? String(e))
    patchEntry(id, (x) => (x.kind === 'agent' ? { ...x, running: false, live: '', error: err.text, ...(err.settings ? { errorSettings: true } : {}), end: 'error' } : x))
    if (mine()) dispatch({ type: 'fail', error: err.text })
  } finally {
    rt.abort = null
    // A turn never leaves the person locked out, unless it ended in a preview (which holds its own lock on purpose).
    const phase = get().chat.wf.phase
    if (!mine() || (phase !== 'previewing' && phase !== 'applying')) releaseAgentLocks()
  }
}

async function accept(chat: Chat) {
  const rt = rtOf(chat)
  const was = lastChanges(chat)
  if (was) patchEntry(was.id, (x) => ({ ...x, state: 'applying' }) as Entry)
  const live = freshWs(chat.wid) as AgentWs | null
  if (!live) return dispatch({ type: 'apply_failed', error: 'the workspace is not open' })
  const actor = actorOf(live)
  const r = await acceptChanges(rt.changes, browserApply(chat.wid, actor, () => freshWs(chat.wid)), { rebuild: { live, actor, now: Date.now(), ids: rt.ids } })
  rt.changes = r.cs
  if (get().chat.id !== chat.id) return
  if (r.ok) {
    if (was) patchEntry(was.id, (x) => ({ ...x, state: 'applied' }) as Entry)
    dispatch({ type: 'applied', report: reportOf({ applied: r.applied.map((i) => ({ line: i.line, where: i.where })), notDone: r.notDone.map((i) => ({ line: i.line })), step: r.step }) })
    return
  }
  if (was) patchEntry(was.id, (x) => ({ ...x, state: 'pending', items: linesOf(r.cs), said: r.said }) as Entry)
  dispatch({ type: 'apply_failed', error: r.said })
  if (r.stale) dispatch({ type: 'untick', pending: pendingCount(r.cs) })
}

// The real id behind a short id the chat's answers cite (`c12`), for a link that goes there.
export const realOf = (short: string): string | undefined => rtOf(get().chat).ids.real(short)?.id

// The change lines grouped by where they are, in the order first touched (changeset.ts' byWhere for the UI's lines).
export function byWhereLines(items: ChangeLine[]): [string, ChangeLine[]][] {
  const out = new Map<string, ChangeLine[]>()
  for (const i of items) out.set(i.where, [...(out.get(i.where) ?? []), i])
  return [...out]
}

// ---- What the UI calls

export const agentActions = {
  // The panel came up in a workspace (or another one): the chat there, the old one's turn stopped and locks released.
  attach(wid: string, who: Me | null) {
    me = who
    const s = get()
    if (s.wid === wid) return
    if (s.wid) leave()
    const chat = chats.get(wid) ?? newChat(wid)
    chats.set(wid, chat)
    useAgent.setState({ wid, chat, mode: 'closed', touch: null })
  },
  // The panel went away (the workspace closed).
  detach() {
    leave()
    useAgent.setState({ wid: null, mode: 'closed', touch: null })
  },
  open() {
    const s = get()
    useAgent.setState({ mode: s.chat.entries.length ? 'column' : 'box' })
  },
  close() {
    useAgent.setState({ mode: 'closed' })
  },
  send(text: string) {
    const t = text.trim()
    if (!t) return
    const s = get()
    const phase = s.chat.wf.phase
    if (phase === 'running' || phase === 'applying') return
    useAgent.setState({ mode: 'column' })
    push({ id: uid('you'), kind: 'user', text: t })
    if (!canRun()) {
      push({ id: uid('note'), kind: 'note', text: NO_KEY, tone: 'error', settings: true })
      return
    }
    dispatch({ type: 'send', text: t })
  },
  stop: () => dispatch({ type: 'stop' }),
  accept: () => dispatch({ type: 'accept' }),
  discard: () => dispatch({ type: 'discard' }),
  undo: () => dispatch({ type: 'undo' }),
  newChat() {
    const s = get()
    leave()
    const chat = newChat(s.wid ?? '')
    chats.set(chat.wid, chat)
    useAgent.setState({ chat, mode: s.mode === 'closed' ? 'box' : s.mode, touch: null })
  },
  setModel(model: string) {
    setChat((c) => ({ ...c, model }))
  },
}

// Stops the current chat's turn, drops what it had pending and releases every lock (a workspace change, an unmount, a
// new chat).
function leave() {
  const chat = get().chat
  if (chat.wf.phase !== 'idle') dispatch({ type: 'reset' })
  rtOf(chat).abort?.abort()
  releaseAgentLocks()
  if (chat.entries.some((e) => e.kind === 'agent' && e.running))
    setChat((c) => ({ ...c, entries: c.entries.map((e) => (e.kind === 'agent' && e.running ? { ...e, running: false, live: '', end: 'stopped', steps: e.steps.map((s) => ({ ...s, running: false })) } : e)) }))
}

// For dev checks and the screenshots: the store (dev builds only).
if (import.meta.env.DEV) (window as unknown as { __agent: unknown }).__agent = { useAgent, agentActions }
