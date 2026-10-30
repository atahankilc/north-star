// The agent's driver in the browser (S14, D-312; docs/specs/agent.md §4.5, §4.6, §6 Phase 6): the chat's state for the
// UI (a zustand store) and what carries out the workflow's effects (workflow.ts: events in, effects out). It runs a turn
// with loop.ts' runTurn over an AgentEnv made of the workspace as it is now (`freshWs`), browser.ts' apply as the agent,
// the chat's short ids and pending changes, and the UI facade (ui.ts). One chat open per workspace in this tab.
//
// MEMORY (S16): chats are saved per person (src/data/agentChats.ts; what's kept: src/agent/chats.ts) a moment after
// each turn, its preview's fate or a note; listed (your own and shared ones, newest first), reopened (the entries,
// the model's history as asks and answers, the chat's short ids), renamed, shared, deleted. The agent's snapshot
// carries what the store doesn't: the agent notes' text (data/agentNotes.ts), the change log and the people's names
// (data/changeLog.ts), loaded while the panel is up.
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
import { accept as acceptChanges, discard as discardChanges, emptyChangeset, pendingCount, untick as untickChange, type Changeset, type ChangeItem } from '../changeset'
import { closePreview, goOf, openPreview, previewState, setCurrent, updatePreview } from '../preview'
import { makeIds, type Ids } from '../read'
import { agentUi, leaveGoneCanvas } from '../ui'
import { recordTurn } from '../usage'
import { systemPrompt } from '../prompt'
import { freshWs } from '../../ops'
import type { OpActor } from '../../ops'
import type { AgentEnv, AgentTool, AgentWs, ModelMessage, TurnEnd, Usage } from '../contract'
import { NO_USAGE } from '../contract'
import { readKey, useAgentSettings } from './settings'
import { plainError, NO_KEY } from './errors'
import { subscribeWs } from '../../state/wsStore'
import { NOTES_ID, saveNotes as saveNotesData, watchNotes } from '../../data/agentNotes'
import { startChangeLog, watchChanges, watchMembers, type ChangeEntry } from '../../data/changeLog'
import { chatsAvailable, deleteChat, listChats, newChatId, openChat as openChatData, renameChat as renameChatData, saveChat, shareChat as shareChatData, type ChatListItem } from '../../data/agentChats'
import { chatDocs, historyOf, type ChatCursor, type ChatSummary } from '../chats'
import { entriesOf, turnsOf } from './chatEntries'

export { entriesOf, turnsOf } from './chatEntries'
import type { MemberInfo } from '../read'
import type { DiffLine } from '../../model/notes'

export { plainError, KEY_REFUSED, NO_KEY } from './errors'

// ---- What the chat shows

export type StepLine = { id: string; label: string; running: boolean; ok?: boolean; ms?: number; say?: string }

// `on`: ticked; off, either the person unticked it (`off`) or it needs one that is (`needs`: those items).
// `diff`: an agent-notes change's lines (S16), shown in the preview as + / −.
export type ChangeLine = { id: string; line: string; strike?: string; where: string; delete: boolean; why?: string; on: boolean; needs?: string[]; needsWords?: string[]; kind: string; op: string; sign: '+' | '~' | '−'; diff?: DiffLine[] }

export type Entry =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'agent'; text: string; live: string; steps: StepLine[]; usage: Usage; running: boolean; ms?: number; end?: TurnEnd; error?: string; errorSettings?: boolean; model: string }
  // The pending changes (S14's simple list; S15's preview replaces it): `pending` until applied or discarded.
  // The preview (S15): every item proposed, ticked or not, until applied or discarded.
  | { id: string; kind: 'changes'; items: ChangeLine[]; warnings: string[]; state: 'pending' | 'applying' | 'applied' | 'undone' | 'discarded' | 'revising' | 'unapplied'; said?: string; note?: string }
  // After an accept or discard: the workflow's report, and where the changes were (`Segments`), for the status line.
  | { id: string; kind: 'report'; report: Report; wheres: string[]; count: number }
  | { id: string; kind: 'note'; text: string; tone?: 'error'; settings?: boolean }

// `saved`: the summary as last saved (its id is the chat's), or null until the first save; `from`: the person whose
// shared chat this one was copied from (opening someone else's shared chat makes a copy of your own).
export type Chat = { id: string; wid: string; model: string; entries: Entry[]; wf: WorkflowState; saved?: ChatSummary | null; from?: string }

export type Mode = 'closed' | 'box' | 'column'

// What the column shows: the chat, the list of saved chats, or the agent notes.
export type View = 'chat' | 'chats' | 'notes'

// Where the agent is looking (its local presence: a mark gliding to what it reads or changes). Never sent anywhere.
export type Touch = { id: string; kind: 'read' | 'change' | 'ui'; at: number }

type Me = { uid: string; name?: string }

type AgentState = {
  mode: Mode
  view: View
  wid: string | null
  chat: Chat
  touch: Touch | null
  // The saved chats as last listed (null: not listed yet), and whether there are more.
  chats: ChatListItem[] | null
  chatsMore: boolean
  // The agent notes' text (null: none yet, or not loaded).
  notes: string | null
}

export const READ_ONLY = "## You only read here\nThe person is a viewer in this workspace, so you can read and answer but never change anything: there is no change tool. When they ask for a change, say that an editor can make it, and offer the exact words or steps so they can pass it on."

// ---- Per chat, outside React: the model's history, the chat's ids, the pending changes, the running turn's abort.

// `base`: the changes as the preview opened (unticking works from it, so a tick put back brings its item back); `off`:
// the items the person unticked.
type Runtime = { history: ModelMessage[]; ids: Ids; changes: Changeset; abort: AbortController | null; last: AgentWs | null; base: Changeset | null; off: Set<string> }

const runtimes = new Map<string, Runtime>()
const chats = new Map<string, Chat>()
let me: Me | null = null
let n = 0
const uid = (p: string) => `${p}${Date.now().toString(36)}${(++n).toString(36)}`

const newChat = (wid: string): Chat => {
  const c: Chat = { id: wid && chatsAvailable() ? newChatId(wid) : uid('chat'), wid, model: '', entries: [], wf: initialWorkflow(), saved: null }
  runtimes.set(c.id, { history: [], ids: makeIds(), changes: emptyChangeset(), abort: null, last: null, base: null, off: new Set() })
  return c
}

const rtOf = (c: Chat): Runtime => {
  let r = runtimes.get(c.id)
  if (!r) runtimes.set(c.id, (r = { history: [], ids: makeIds(), changes: emptyChangeset(), abort: null, last: null, base: null, off: new Set() }))
  return r
}

export const useAgent = create<AgentState>(() => ({ mode: 'closed', view: 'chat', wid: null, chat: newChat(''), touch: null, chats: null, chatsMore: false, notes: null }))

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
    const ws = liveWs(wid)
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

// ---- What the agent reads beside the store (S16): the notes' text, the change log, the people

type Extra = { wid: string; notes: string | null; changeLog: ChangeEntry[] | null; members: MemberInfo[] | null; version: number }
let extra: Extra | null = null
let unwatch: (() => void)[] = []
let notesOff: (() => void) | null = null
let notesWatched = false

// The workspace as the agent reads it: the listeners' snapshot (freshWs, never the preview) with the notes' text, the
// change log, the members and who's asking. The same object while neither changes (the changeset's views key on it).
let made: { from: AgentWs; version: number; ws: AgentWs } | null = null
export function liveWs(wid: string): AgentWs | null {
  const ws = freshWs(wid) as AgentWs | null
  if (!ws) return null
  const x = extra?.wid === wid ? extra : null
  const version = x?.version ?? -1
  if (made && made.from === ws && made.version === version) return made.ws
  const out: AgentWs = {
    ...ws,
    ...(x?.notes != null ? { bodies: { ...(ws.bodies ?? {}), [NOTES_ID]: { text: x.notes } } } : {}),
    ...(x?.changeLog?.length ? { changeLog: x.changeLog } : {}),
    ...(x?.members?.length ? { members: x.members } : {}),
    ...(me?.uid ? { me: me.uid } : {}),
  }
  made = { from: ws, version, ws: out }
  return out
}

function bump(f: (x: Extra) => Partial<Extra>) {
  if (!extra) return
  extra = { ...extra, ...f(extra), version: extra.version + 1 }
}

// The notes' body is listened to only once its summary is in the documents (its rule reads the summary).
function followNotes(wid: string) {
  const has = !!freshWs(wid)?.documents?.some((d) => d.id === NOTES_ID)
  if (has === notesWatched) return
  notesWatched = has
  notesOff?.()
  notesOff = null
  if (!has) {
    bump(() => ({ notes: null }))
    useAgent.setState({ notes: null })
    return
  }
  notesOff = watchNotes(wid, (text) => {
    if (extra?.wid !== wid) return
    bump(() => ({ notes: text }))
    useAgent.setState({ notes: text })
  })
}

function watchExtra(wid: string) {
  stopExtra()
  extra = { wid, notes: null, changeLog: null, members: null, version: 0 }
  startChangeLog()
  unwatch = [
    watchChanges(wid, (list) => bump(() => ({ changeLog: list }))),
    watchMembers(wid, (list) => bump(() => ({ members: list }))),
    subscribeWs(() => followNotes(wid)),
  ]
  followNotes(wid)
}

function stopExtra() {
  for (const f of unwatch) f()
  unwatch = []
  notesOff?.()
  notesOff = null
  notesWatched = false
  extra = null
  made = null
}

// ---- Saving the chat (S16): a moment after each turn, preview or note; never the key, never a tool's raw result.

const SAVE_MS = 1200
// Where the chats list's two queries got to (src/agent/chats.ts' pageChats).
let chatCursor: ChatCursor | null = null

let saveTimer: ReturnType<typeof setTimeout> | null = null
let saving: Promise<void> = Promise.resolve()

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void saveNow(), SAVE_MS)
}

// Saves the open chat (once it has a message of the person's); one save at a time.
export function saveNow(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  const chat = get().chat
  if (!me?.uid || !chat.wid || !chatsAvailable() || !chat.entries.some((e) => e.kind === 'user')) return saving
  if (chat.saved && chat.saved.uid !== me.uid) return saving
  const rt = rtOf(chat)
  const { summary, body } = chatDocs({ uid: me.uid, model: chatModel(chat), turns: turnsOf(chat.entries), ids: rt.ids.toJSON(), was: chat.saved ?? null, now: Date.now() })
  saving = saving
    .then(() => saveChat(chat.wid, chat.id, summary, body))
    .then(() => {
      const c = get().chat
      if (c.id === chat.id) {
        useAgent.setState({ chat: { ...c, saved: summary } })
        chats.set(c.wid, { ...c, saved: summary })
      }
      const list = get().chats
      if (list) useAgent.setState({ chats: [{ ...summary, id: chat.id }, ...list.filter((x) => x.id !== chat.id)] })
    })
    // Not saved (offline, refused): the chat stays open here and the next turn tries again.
    .catch(() => {})
  return saving
}

// ---- The workflow: events in, effects carried out

function dispatch(ev: WorkflowEvent) {
  const chat = get().chat
  const { state, effects } = wfStep(chat.wf, ev)
  setChat((c) => ({ ...c, wf: state }))
  for (const e of effects) run(chat.id, e)
  // A turn ended, a preview was applied or discarded, an undo: the chat is saved a moment later.
  if (ev.type === 'turn_end' || ev.type === 'applied' || ev.type === 'discard' || ev.type === 'undo_done' || ev.type === 'fail' || ev.type === 'apply_failed') scheduleSave()
}

const lastChanges = (c: Chat) => [...c.entries].reverse().find((e): e is Extract<Entry, { kind: 'changes' }> => e.kind === 'changes' && (e.state === 'pending' || e.state === 'applying' || e.state === 'revising'))

// An item in a few words, for a note about it: what it does (`link "Stalls run out…" → "Weekend…"`), not its id.
export const wordsOfItem = (i: Pick<ChangeItem, 'line' | 'label'>) => {
  const w = i.line.split(': ').slice(1).join(': ') || i.label
  return w.length > 60 ? `${w.slice(0, 59)}…` : w
}
const lineOf = (i: ChangeItem, on: boolean, needs?: string[], all?: ChangeItem[]): ChangeLine => ({
  id: i.id,
  line: i.line,
  where: i.where,
  delete: i.delete,
  ...(i.strike ? { strike: i.strike } : {}),
  kind: i.kind,
  op: i.op,
  sign: i.sign ?? (i.delete ? '−' : '~'),
  on,
  ...(i.why ? { why: i.why } : {}),
  ...(i.diff ? { diff: i.diff } : {}),
  ...(needs?.length ? { needs, needsWords: needs.map((n) => { const x = all?.find((y) => y.id === n); return x ? wordsOfItem(x) : n }) } : {}),
})
const linesOf = (cs: Changeset): ChangeLine[] => cs.items.map((i) => lineOf(i, true))

// Every item of the preview's base, ticked or not: an item still in the changes is on; one the person unticked is off;
// one that came off with it says which unticked items it needs.
function previewLines(rt: Runtime): ChangeLine[] {
  const base = rt.base ?? rt.changes
  const on = new Set(rt.changes.items.map((i) => i.id))
  return base.items.map((i) => {
    if (on.has(i.id)) return lineOf(rt.changes.items.find((x) => x.id === i.id) ?? i, true)
    if (rt.off.has(i.id)) return lineOf(i, false)
    const needs = needsOf(base.items, i, rt.off)
    return lineOf(i, false, needs.length ? needs : undefined, base.items)
  })
}

// The unticked items an item depends on, however far.
function needsOf(items: ChangeItem[], i: ChangeItem, off: Set<string>): string[] {
  const seen = new Set<string>()
  const out = new Set<string>()
  const walk = (x: ChangeItem) => {
    for (const d of x.dependsOn) {
      if (seen.has(d)) continue
      seen.add(d)
      if (off.has(d)) out.add(d)
      const y = items.find((z) => z.id === d)
      if (y) walk(y)
    }
  }
  walk(i)
  return [...out]
}

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
      // The store overlaid with the changes (S15, preview.ts), the app locked while it's open, the list in the chat.
      lockPreview()
      unlockTurn()
      rt.base = rt.changes
      rt.off = new Set()
      openPreview(rt.changes)
      const was = lastChanges(chat)
      const entry: Entry = { id: uid('chg'), kind: 'changes', items: previewLines(rt), warnings: rt.changes.warnings.slice(0, 3), state: 'pending' }
      setChat((c) => ({ ...c, entries: [...c.entries.filter((x) => x !== was), entry] }))
      return
    }
    case 'close_preview': {
      closePreview()
      unlockPreview()
      // Discarded (or revising): a canvas only the preview had is gone; applied, it's real by now (or soon: then the
      // layout's own check sends it to the first canvas until the listener brings it).
      if (get().chat.wf.phase !== 'applied') leaveGoneCanvas()
      const was = lastChanges(chat)
      if (was && was.state === 'pending' && get().chat.wf.phase === 'running') patchEntry(was.id, (x) => ({ ...x, state: 'revising' }) as Entry)
      // Revising: the agent works from what's ticked now (unticked items are gone from the changes).
      rt.base = null
      rt.off = new Set()
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
      const items = list?.state === 'applied' ? list.items.filter((i) => i.on) : []
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
  const live = liveWs(chat.wid)
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
  if (r.stale) {
    // What still works is the new base: the preview shows it, with why the rest came off.
    rt.base = r.cs
    rt.off = new Set()
    updatePreview(r.cs)
  }
  if (was) patchEntry(was.id, (x) => ({ ...x, state: 'pending', items: r.stale ? linesOf(r.cs) : previewLines(rt), said: r.said }) as Entry)
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
    useAgent.setState({ wid, chat, mode: 'closed', view: 'chat', touch: null, chats: null, chatsMore: false, notes: null })
    watchExtra(wid)
  },
  // The panel went away (the workspace closed).
  detach() {
    void saveNow()
    leave()
    stopExtra()
    useAgent.setState({ wid: null, mode: 'closed', view: 'chat', touch: null })
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
  // A tick in the preview: off takes the item and what needs it off, on brings it back (and what came off only with
  // it); the preview is worked out again from its base on the workspace as it is now.
  tick(item: string, on: boolean) {
    const chat = get().chat
    if (chat.wf.phase !== 'previewing') return
    const rt = rtOf(chat)
    const base = rt.base ?? rt.changes
    if (!base.items.some((i) => i.id === item)) return
    const off = new Set(rt.off)
    if (on) off.delete(item)
    else off.add(item)
    const live = liveWs(chat.wid)
    if (!live) return
    const ctx = { live, actor: actorOf(live), now: Date.now(), ids: rt.ids }
    let cs = base
    for (const id of off) if (cs.items.some((i) => i.id === id)) cs = untickChange(cs, id, ctx).cs
    rt.off = off
    rt.changes = cs
    updatePreview(cs)
    const lines = previewLines(rt)
    const also = !on ? base.items.filter((i) => lines.some((l) => l.id === i.id && l.needs?.includes(item))) : []
    const off1 = base.items.find((i) => i.id === item)!
    const was = lastChanges(get().chat)
    const note = also.length ? `${also.map((i) => wordsOfItem(i)).join('; ')} ${also.length === 1 ? 'came off too: it needs' : 'came off too: they need'} ${wordsOfItem(off1)}` : undefined
    if (was) patchEntry(was.id, (x) => ({ ...x, items: lines, warnings: cs.warnings.slice(0, 3), note }) as Entry)
    dispatch({ type: 'untick', pending: pendingCount(cs) })
  },
  // The stepper: glides to an item's change (into a focus or another canvas), its marks lit.
  goToItem(item: string) {
    const chat = get().chat
    const rt = rtOf(chat)
    const i = (rt.base ?? rt.changes).items.find((x) => x.id === item)
    const st = previewState()
    setCurrent(item)
    if (!i || !st) return
    const go = goOf(i, st.ws)
    if (go) void agentUi.show(go.id, { ...(go.plane ? { plane: go.plane } : {}), ...(go.canvas ? { canvas: go.canvas } : {}), ...(go.focus ? { focus: true } : {}) }).catch(() => {})
  },
  accept: () => dispatch({ type: 'accept' }),
  discard: () => dispatch({ type: 'discard' }),
  undo: () => dispatch({ type: 'undo' }),
  newChat() {
    const s = get()
    void saveNow()
    leave()
    const chat = newChat(s.wid ?? '')
    chats.set(chat.wid, chat)
    useAgent.setState({ chat, mode: s.mode === 'closed' ? 'box' : s.mode, view: 'chat', touch: null })
  },
  // ---- Saved chats (S16)
  show(view: View) {
    useAgent.setState({ view, mode: 'column' })
    if (view === 'chats') void agentActions.listChats()
  },
  async listChats(more = false) {
    const s = get()
    if (!s.wid || !me?.uid) return
    try {
      const r = await listChats(s.wid, me.uid, { size: 20, ...(more && chatCursor ? { cursor: chatCursor } : {}) })
      chatCursor = r.cursor
      const had = more ? (get().chats ?? []) : []
      const byId = new Map([...had, ...r.items].map((c) => [c.id, c]))
      useAgent.setState({ chats: [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt), chatsMore: r.cursor.mineMore || r.cursor.sharedMore })
    } catch {
      // Not listed (offline, an index still building): what was listed stays.
      useAgent.setState({ chats: get().chats ?? [], chatsMore: false })
    }
  },
  // A saved chat reopened: its entries, the model's history (asks and answers) and its short ids. Someone else's
  // shared chat opens as a copy of your own (saved under a new id on its next turn).
  async openChat(id: string) {
    const s = get()
    if (!s.wid) return
    if (s.chat.id === id) return useAgent.setState({ view: 'chat' })
    const got = await openChatData(s.wid, id)
    if (!got) return
    await saveNow()
    leave()
    const mine = got.summary.uid === me?.uid
    const chat: Chat = { id: mine ? id : newChatId(s.wid), wid: s.wid, model: got.summary.model, entries: entriesOf(got.body.turns), wf: initialWorkflow(), saved: mine ? got.summary : null, ...(mine ? {} : { from: got.summary.uid }) }
    runtimes.set(chat.id, { history: historyOf(got.body.turns), ids: makeIds(got.body.ids), changes: emptyChangeset(), abort: null, last: null, base: null, off: new Set() })
    chats.set(chat.wid, chat)
    useAgent.setState({ chat, view: 'chat', mode: 'column', touch: null })
  },
  async renameChat(id: string, title: string) {
    const s = get()
    if (!s.wid || !title.trim()) return
    await renameChatData(s.wid, id, title).catch(() => {})
    await agentActions.listChats()
    const c = get().chat
    if (c.id === id && c.saved) setChat((x) => ({ ...x, saved: { ...x.saved!, title: title.trim().slice(0, 120) } }))
  },
  async shareChat(id: string, shared: boolean) {
    const s = get()
    if (!s.wid) return
    await shareChatData(s.wid, id, shared).catch(() => {})
    useAgent.setState({ chats: (get().chats ?? []).map((c) => (c.id === id ? { ...c, shared } : c)) })
    const c = get().chat
    if (c.id === id && c.saved) setChat((x) => ({ ...x, saved: { ...x.saved!, shared } }))
  },
  async deleteChat(id: string) {
    const s = get()
    if (!s.wid) return
    await deleteChat(s.wid, id).catch(() => {})
    useAgent.setState({ chats: (get().chats ?? []).filter((c) => c.id !== id) })
    if (get().chat.id === id) {
      leave()
      const chat = newChat(s.wid)
      chats.set(chat.wid, chat)
      useAgent.setState({ chat })
    }
  },
  // A person's edit of the agent notes (one undo step, as them).
  saveNotes: (text: string) => {
    const wid = get().wid
    return wid ? saveNotesData(wid, text, get().notes) : Promise.resolve()
  },
  setModel(model: string) {
    setChat((c) => ({ ...c, model }))
  },
}

// Stops the current chat's turn, drops what it had pending and releases every lock (a workspace change, an unmount, a
// new chat).
function leave() {
  closePreview()
  const chat = get().chat
  if (chat.wf.phase !== 'idle') dispatch({ type: 'reset' })
  rtOf(chat).abort?.abort()
  releaseAgentLocks()
  if (chat.entries.some((e) => e.kind === 'agent' && e.running))
    setChat((c) => ({ ...c, entries: c.entries.map((e) => (e.kind === 'agent' && e.running ? { ...e, running: false, live: '', end: 'stopped', steps: e.steps.map((s) => ({ ...s, running: false })) } : e)) }))
}

// The chat is saved when the tab goes away or is hidden (a closed tab gets no next turn).
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void saveNow())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void saveNow()
  })
}

// For dev checks and the screenshots: the store (dev builds only).
if (import.meta.env.DEV) (window as unknown as { __agent: unknown }).__agent = { useAgent, agentActions, previewState, liveWs, saveNow }
