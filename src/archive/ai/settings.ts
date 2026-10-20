// The AI assistant's settings (D-006, D-073), saved per browser. The OpenAI key lives only here, in this browser's
// localStorage: never in the DB, never in logs, never sent anywhere but api.openai.com.
import { create } from 'zustand'
import type { KeySource } from '../data/ai'

// A model per task (D-077, D-104): the chat (questions and proposals), research (a message sent with [web] on) and deep
// research (/research: its plan, researchers and report, D-088).
export type AiTask = 'chat' | 'research' | 'deep'
export const AI_TASKS: readonly AiTask[] = ['chat', 'research', 'deep']
export const TASK_LABEL: Record<AiTask, string> = { chat: 'chat', research: 'web answers', deep: 'deep research' }
export type TaskModels = Partial<Record<AiTask, string>>

// Cheapest first. No prices here: they change, and the classes are well known (user's call). Any other id can be typed in.
export const MODELS: { id: string; note: string }[] = [
  { id: 'gpt-6-luna', note: 'cheapest, good for most questions' },
  { id: 'gpt-5.6-luna', note: 'small, a little stronger' },
  { id: 'gpt-6.1-sol', note: 'stronger reasoning and research' },
  { id: 'gpt-5.5', note: 'strongest for agentic web search' },
]

// All start on the cheapest (Q-003); research is the one worth raising. The server assumes the same for a workspace key
// whose owners haven't chosen (functions/src/index.ts).
export const DEFAULT_MODELS: Record<AiTask, string> = { chat: 'gpt-6-luna', research: 'gpt-6-luna', deep: 'gpt-6-luna' }

const KEY = 'north-star.openai-key'
// Web search on or off in the chat (D-076), remembered in this browser.
const WEB = 'north-star.ai-web'
// Your own key's models (D-104): a default per task, and overrides per workspace.
const MODELS_KEY = 'north-star.ai-models'
// What you picked on a workspace key, per workspace, within what its owners allow (D-104).
const WS_CHOICE = 'north-star.ai-workspace-models'
// Per workspace: use the workspace's key or your own (D-079).
const KEY_CHOICE = 'north-star.ai-key-choice'

function loadKeyChoice(): Record<string, KeySource> {
  try {
    return JSON.parse(load(KEY_CHOICE) || '{}') as Record<string, KeySource>
  } catch {
    return {}
  }
}

export type OwnModels = { default: Record<AiTask, string>; byWorkspace: Record<string, TaskModels> }

const ids = (v: unknown): TaskModels => {
  const o = (v ?? {}) as Record<string, unknown>
  return Object.fromEntries(AI_TASKS.filter((t) => typeof o[t] === 'string' && o[t]).map((t) => [t, o[t] as string]))
}

function loadModels(): OwnModels {
  try {
    const saved = JSON.parse(load(MODELS_KEY) || '{}') as Record<string, unknown>
    // Before D-104 it was a flat { chat, research }; deep research used research's.
    const flat = !('default' in saved)
    const d = ids(flat ? saved : saved.default)
    const byWorkspace = flat ? {} : Object.fromEntries(Object.entries((saved.byWorkspace ?? {}) as Record<string, unknown>).map(([w, m]) => [w, ids(m)]))
    return {
      default: { chat: d.chat ?? DEFAULT_MODELS.chat, research: d.research ?? DEFAULT_MODELS.research, deep: d.deep ?? d.research ?? DEFAULT_MODELS.deep },
      byWorkspace,
    }
  } catch {
    return { default: { ...DEFAULT_MODELS }, byWorkspace: {} }
  }
}

function loadWsChoice(): Record<string, TaskModels> {
  try {
    return Object.fromEntries(Object.entries(JSON.parse(load(WS_CHOICE) || '{}') as Record<string, unknown>).map(([w, m]) => [w, ids(m)]))
  } catch {
    return {}
  }
}

// Sets one task's model in a set; '' takes it out (falls back to the default).
const withModel = (m: TaskModels | undefined, task: AiTask, id: string): TaskModels => {
  const next = { ...m }
  if (id) next[task] = id
  else delete next[task]
  return next
}

function load(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    // Storage blocked: nothing until it's set again this session.
    return ''
  }
}

function save(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // Not persisted; still works for this session.
  }
}

type AiSettings = {
  apiKey: string
  // Your own key's models: `wid` null sets the default, a workspace id its override ('' clears it).
  ownModels: OwnModels
  setOwnModel: (task: AiTask, id: string, wid: string | null) => void
  // Your picks on each workspace's key ('' goes back to the owners' default).
  wsChoice: Record<string, TaskModels>
  setWsChoice: (wid: string, task: AiTask, id: string) => void
  setKey: (key: string) => void
  web: boolean
  setWeb: (web: boolean) => void
  keyChoice: Record<string, KeySource>
  setKeyChoice: (wid: string, source: KeySource) => void
}

export const useAiSettings = create<AiSettings>((set) => ({
  apiKey: load(KEY),
  ownModels: loadModels(),
  setOwnModel: (task, id, wid) =>
    set((s) => {
      const ownModels: OwnModels = wid
        ? { ...s.ownModels, byWorkspace: { ...s.ownModels.byWorkspace, [wid]: withModel(s.ownModels.byWorkspace[wid], task, id) } }
        : { ...s.ownModels, default: { ...s.ownModels.default, [task]: id || DEFAULT_MODELS[task] } }
      save(MODELS_KEY, JSON.stringify(ownModels))
      return { ownModels }
    }),
  wsChoice: loadWsChoice(),
  setWsChoice: (wid, task, id) =>
    set((s) => {
      const wsChoice = { ...s.wsChoice, [wid]: withModel(s.wsChoice[wid], task, id) }
      save(WS_CHOICE, JSON.stringify(wsChoice))
      return { wsChoice }
    }),
  setKey: (apiKey) => {
    save(KEY, apiKey)
    set({ apiKey })
  },
  keyChoice: loadKeyChoice(),
  setKeyChoice: (wid, source) =>
    set((s) => {
      const keyChoice = { ...s.keyChoice, [wid]: source }
      save(KEY_CHOICE, JSON.stringify(keyChoice))
      return { keyChoice }
    }),
  web: load(WEB) === 'on',
  setWeb: (web) => {
    save(WEB, web ? 'on' : '')
    set({ web })
  },
}))

// `sk-…abcd`: enough to recognise your key without showing it.
export const maskKey = (key: string) => (key.length > 8 ? `${key.slice(0, 3)}…${key.slice(-4)}` : '…')


// Which key a workspace's calls use: your pick if it's available, else the workspace key when you may use it, else yours.
export function keySourceFor(
  s: { apiKey: string; keyChoice: Record<string, KeySource> },
  wid: string,
  workspaceKeyUsable: boolean,
): KeySource | null {
  const pick = s.keyChoice[wid]
  if (pick === 'workspace' && workspaceKeyUsable) return 'workspace'
  if (pick === 'own' && s.apiKey) return 'own'
  if (workspaceKeyUsable) return 'workspace'
  return s.apiKey ? 'own' : null
}
