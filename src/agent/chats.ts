// Saved chats (S16, D-312; docs/specs/agent.md §4.7, §4.9 layer 5, §6 Phase 7–8): what a chat is when it's kept, the
// size caps, the shape check that mirrors firestore.rules, the model's history rebuilt from it, and an in-memory store
// with the rules' who-may for the evals and tests. Pure: no React, no Firebase (src/data/agentChats.ts writes them).
//
// A chat is kept per person, private unless they share it: `workspaces/{wid}/agentChats/{id}` (the summary the list
// reads: uid, title, times, shared, model, turns, summary?) and `…/{id}/content/body` (the turns and the chat's short
// ids, read when it's opened). Never the key; never a tool's raw result (a step keeps only its label and time); the
// usage log stays counts only (usage.ts).
import type { IdsState } from './read/ids'
import type { AgentTurn, ModelMessage, Transcript } from './contract'

export const CHAT_TURNS_MAX = 200
export const CHAT_BYTES_MAX = 450_000
export const CHAT_TITLE_MAX = 120
export const CHAT_TEXT_MAX = 20_000
export const CHAT_STEPS_MAX = 40
export const CHAT_SUMMARY_MAX = 2000

// One kept entry of the chat, as the column shows it: the person's message, the agent's answer (its steps as labels),
// a preview's change list (its lines, and what became of it), the status line after it, a note.
export type SavedStep = { label: string; ms?: number; ok?: boolean }
export type SavedTurn = {
  role: 'user' | 'agent' | 'changes' | 'report' | 'note'
  text: string
  at: number
  steps?: SavedStep[]
  usage?: { input: number; output: number }
  // How long the agent's turn took (its `▸ 2 steps · 3.6s`).
  ms?: number
  end?: string
  model?: string
  // A change list: what became of it (applied, discarded…) and how many changes; a status line: its words.
  applied?: { state: string; count?: number }
}

export type ChatSummary = {
  uid: string
  title: string
  createdAt: number
  updatedAt: number
  shared: boolean
  model: string
  turns: number
  // A short summary for search_chats (written by the agent at a chat's end, later).
  summary?: string
}
export type ChatBody = { turns: SavedTurn[]; ids: IdsState }
export type SavedChat = { id: string; summary: ChatSummary; body: ChatBody }

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length

// The title: the first thing the person asked, on one line.
export const chatTitle = (ask: string) => cut(ask.replace(/\s+/g, ' ').trim(), CHAT_TITLE_MAX) || 'untitled chat'

// A turn as kept: texts cut, at most CHAT_STEPS_MAX steps (labels only), no empty fields.
export function keptTurn(t: SavedTurn): SavedTurn {
  return {
    role: t.role,
    text: cut(t.text ?? '', CHAT_TEXT_MAX),
    at: Math.round(t.at || 0),
    ...(t.steps?.length ? { steps: t.steps.slice(0, CHAT_STEPS_MAX).map((s) => ({ label: cut(s.label, 200), ...(s.ms !== undefined ? { ms: Math.round(s.ms) } : {}), ...(s.ok === false ? { ok: false } : {}) })) } : {}),
    ...(t.usage ? { usage: { input: Math.round(t.usage.input), output: Math.round(t.usage.output) } } : {}),
    ...(t.ms !== undefined ? { ms: Math.round(t.ms) } : {}),
    ...(t.end ? { end: t.end } : {}),
    ...(t.model ? { model: cut(t.model, 100) } : {}),
    ...(t.applied ? { applied: { state: t.applied.state, ...(t.applied.count !== undefined ? { count: t.applied.count } : {}) } } : {}),
  }
}

// The turns capped to what a doc holds: the newest CHAT_TURNS_MAX; then, while the body is too big, the oldest turns'
// steps dropped, then the oldest turns themselves (a note in front says how many went).
export function capTurns(turns: SavedTurn[], ids: IdsState): SavedTurn[] {
  let out = turns.map(keptTurn)
  let dropped = 0
  if (out.length > CHAT_TURNS_MAX - 1) ((dropped = out.length - (CHAT_TURNS_MAX - 1)), (out = out.slice(dropped)))
  const size = () => bytes({ turns: out, ids })
  for (let i = 0; i < out.length && size() > CHAT_BYTES_MAX; i++) if (out[i].steps) out[i] = { ...out[i], steps: undefined } as SavedTurn
  out = out.map((t) => (t.steps ? t : (({ steps: _s, ...rest }) => rest as SavedTurn)(t)))
  while (out.length > 1 && size() > CHAT_BYTES_MAX) (out.shift(), dropped++)
  if (dropped) out = [{ role: 'note', text: `${dropped} earlier ${dropped === 1 ? 'entry was' : 'entries were'} left out to keep the chat small.`, at: out[0]?.at ?? 0 }, ...out]
  return out
}

// The summary and body to save (the first ask as the title unless it was renamed).
export function chatDocs(o: { uid: string; model: string; turns: SavedTurn[]; ids: IdsState; was?: ChatSummary | null; now: number }): { summary: ChatSummary; body: ChatBody } {
  const turns = capTurns(o.turns, o.ids)
  const first = o.turns.find((t) => t.role === 'user')
  const summary: ChatSummary = {
    uid: o.was?.uid ?? o.uid,
    title: o.was?.title ?? chatTitle(first?.text ?? ''),
    createdAt: o.was?.createdAt ?? o.now,
    updatedAt: o.now,
    shared: o.was?.shared ?? false,
    model: cut(o.model || 'unknown', 100),
    turns: o.turns.filter((t) => t.role === 'user').length,
    ...(o.was?.summary ? { summary: o.was.summary } : {}),
  }
  return { summary, body: { turns, ids: o.ids } }
}

// What's wrong with a chat's docs as firestore.rules sees them (keys, types, sizes); empty = fine.
export function chatProblems(summary: Record<string, unknown>, body?: Record<string, unknown>): string[] {
  const out: string[] = []
  const SUMMARY_KEYS = ['uid', 'title', 'createdAt', 'updatedAt', 'shared', 'model', 'turns', 'summary']
  for (const k of Object.keys(summary)) if (!SUMMARY_KEYS.includes(k)) out.push(`summary: ${k} isn't a field a chat has`)
  if (typeof summary.uid !== 'string' || !summary.uid) out.push('summary: uid')
  if (typeof summary.title !== 'string' || !summary.title || summary.title.length > CHAT_TITLE_MAX) out.push('summary: title (1–120)')
  if (typeof summary.createdAt !== 'number' || typeof summary.updatedAt !== 'number') out.push('summary: times')
  if (typeof summary.shared !== 'boolean') out.push('summary: shared')
  if (typeof summary.model !== 'string' || summary.model.length > 100) out.push('summary: model')
  if (!Number.isInteger(summary.turns) || (summary.turns as number) < 0) out.push('summary: turns')
  if (summary.summary !== undefined && (typeof summary.summary !== 'string' || summary.summary.length > CHAT_SUMMARY_MAX)) out.push('summary: summary')
  if (body) {
    for (const k of Object.keys(body)) if (k !== 'turns' && k !== 'ids') out.push(`body: ${k} isn't a field a chat's body has`)
    if (!Array.isArray(body.turns) || body.turns.length > CHAT_TURNS_MAX) out.push(`body: turns (a list of at most ${CHAT_TURNS_MAX})`)
    if (!body.ids || typeof body.ids !== 'object' || Array.isArray(body.ids)) out.push('body: ids')
    if (bytes(body) > CHAT_BYTES_MAX + 50_000) out.push('body: too big')
  }
  return out
}

// The model's history from a kept chat: the person's messages and the agent's answers, in order (no tool calls or
// results: they were never kept). A change list or a status line becomes a short line of the agent's, so it knows.
export function historyOf(turns: SavedTurn[]): ModelMessage[] {
  const out: ModelMessage[] = []
  for (const t of turns) {
    if (t.role === 'user') out.push({ role: 'user', content: t.text })
    else if (t.role === 'agent' && t.text) out.push({ role: 'assistant', content: t.text })
    else if (t.role === 'changes' && t.applied) out.push({ role: 'assistant', content: `[the proposed changes were ${t.applied.state}${t.applied.count !== undefined ? ` (${t.applied.count})` : ''}]` })
  }
  // A history starts with the person (a kept chat whose first entries went starts at the next message of theirs).
  const first = out.findIndex((m) => m.role === 'user')
  return first < 0 ? [] : out.slice(first)
}

// An eval's transcript as kept turns (the person's asks, the agent's answers with their steps' labels).
export function turnsOfTranscript(t: Transcript, label: (name: string) => string = (n) => n.replace(/_/g, ' ')): SavedTurn[] {
  return t.turns.flatMap((x: AgentTurn) => [
    { role: 'user' as const, text: x.ask, at: t.startedAt },
    { role: 'agent' as const, text: x.answer, at: t.startedAt, steps: x.steps.flatMap((s) => s.results.map((r) => ({ label: label(r.name), ms: r.ms, ...(r.ok ? {} : { ok: false }) }))), usage: { input: x.usage.input, output: x.usage.output }, end: x.end, model: t.model },
  ])
}

// ---- Paging the list: yours and the shared ones are two queries (the rules can prove each), each with its own
// cursor (the updatedAt of the last one it gave), so neither skips a chat when the other is newer.

export type ChatCursor = { mine?: number; shared?: number; mineMore: boolean; sharedMore: boolean }
export type ChatFetch = (before: number | undefined, size: number) => Promise<(ChatSummary & { id: string })[]>
export const FIRST_PAGE: ChatCursor = { mineMore: true, sharedMore: true }

export async function pageChats(mine: ChatFetch, shared: ChatFetch, at: ChatCursor, size = 20): Promise<{ items: (ChatSummary & { id: string })[]; cursor: ChatCursor }> {
  const [a, b] = await Promise.all([at.mineMore ? mine(at.mine, size) : Promise.resolve([]), at.sharedMore ? shared(at.shared, size) : Promise.resolve([])])
  const items = [...new Map([...a, ...b].map((c) => [c.id, c])).values()].sort((x, y) => y.updatedAt - x.updatedAt)
  return {
    items,
    cursor: {
      mine: a.length ? a[a.length - 1].updatedAt : at.mine,
      shared: b.length ? b[b.length - 1].updatedAt : at.shared,
      mineMore: at.mineMore && a.length === size,
      sharedMore: at.sharedMore && b.length === size,
    },
  }
}

// ---- The rules' who-may, in memory (evals and tests): read your own, or a shared one as a member; write only your own.

export type ChatWho = { uid: string; member: boolean }
export type ChatStore = {
  save: (who: ChatWho, chat: SavedChat) => { ok: true } | { ok: false; why: string }
  read: (who: ChatWho, id: string) => SavedChat | null
  list: (who: ChatWho) => (ChatSummary & { id: string })[]
  share: (who: ChatWho, id: string, shared: boolean) => boolean
  rename: (who: ChatWho, id: string, title: string) => boolean
  remove: (who: ChatWho, id: string) => boolean
}

export function memoryChats(): ChatStore {
  const all = new Map<string, SavedChat>()
  const mayRead = (who: ChatWho, c: SavedChat) => who.member && (c.summary.uid === who.uid || c.summary.shared)
  const mine = (who: ChatWho, id: string) => {
    const c = all.get(id)
    return who.member && !!c && c.summary.uid === who.uid ? c : null
  }
  return {
    save(who, chat) {
      if (!who.member) return { ok: false, why: 'not a member' }
      if (chat.summary.uid !== who.uid) return { ok: false, why: 'a chat is saved only by its writer, as themselves' }
      const was = all.get(chat.id)
      if (was && was.summary.uid !== who.uid) return { ok: false, why: "someone else's chat" }
      const bad = chatProblems(chat.summary as unknown as Record<string, unknown>, chat.body as unknown as Record<string, unknown>)
      if (bad.length) return { ok: false, why: bad.join('; ') }
      all.set(chat.id, structuredClone(chat))
      return { ok: true }
    },
    read: (who, id) => {
      const c = all.get(id)
      return c && mayRead(who, c) ? structuredClone(c) : null
    },
    list: (who) => [...all.values()].filter((c) => mayRead(who, c)).sort((a, b) => b.summary.updatedAt - a.summary.updatedAt).map((c) => ({ ...c.summary, id: c.id })),
    share(who, id, shared) {
      const c = mine(who, id)
      if (!c) return false
      c.summary = { ...c.summary, shared }
      return true
    },
    rename(who, id, title) {
      const c = mine(who, id)
      if (!c || !title.trim()) return false
      c.summary = { ...c.summary, title: chatTitle(title) }
      return true
    },
    remove(who, id) {
      if (!mine(who, id)) return false
      all.delete(id)
      return true
    },
  }
}
