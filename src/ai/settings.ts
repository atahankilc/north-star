// The AI assistant's settings (D-006, D-073), saved per browser. The OpenAI key lives only here, in this browser's
// localStorage: never in the DB, never in logs, never sent anywhere but api.openai.com.
import { create } from 'zustand'
import type { KeySource } from '../data/ai'

// A model per task (D-077): the chat (questions and proposals) and research (a message sent with [web] on).
export type AiTask = 'chat' | 'research'

// Cheapest first. No prices here: they change, and the classes are well known (user's call). Any other id can be typed in.
export const MODELS: { id: string; note: string }[] = [
  { id: 'gpt-6-luna', note: 'cheapest, good for most questions' },
  { id: 'gpt-5.6-luna', note: 'small, a little stronger' },
  { id: 'gpt-6.1-sol', note: 'stronger reasoning and research' },
  { id: 'gpt-5.5', note: 'strongest for agentic web search' },
]

// Both start on the cheapest (Q-003); research is the one worth raising.
export const DEFAULT_MODELS: Record<AiTask, string> = { chat: 'gpt-6-luna', research: 'gpt-6-luna' }

const KEY = 'north-star.openai-key'
// Web search on or off in the chat (D-076), remembered in this browser.
const WEB = 'north-star.ai-web'
const MODELS_KEY = 'north-star.ai-models'
// Per workspace: use the workspace's key or your own (D-079).
const KEY_CHOICE = 'north-star.ai-key-choice'

function loadKeyChoice(): Record<string, KeySource> {
  try {
    return JSON.parse(load(KEY_CHOICE) || '{}') as Record<string, KeySource>
  } catch {
    return {}
  }
}

function loadModels(): Record<AiTask, string> {
  try {
    const saved = JSON.parse(load(MODELS_KEY) || '{}') as Partial<Record<AiTask, unknown>>
    const pick = (t: AiTask) => (typeof saved[t] === 'string' && saved[t] ? (saved[t] as string) : DEFAULT_MODELS[t])
    return { chat: pick('chat'), research: pick('research') }
  } catch {
    return { ...DEFAULT_MODELS }
  }
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
  models: Record<AiTask, string>
  setModel: (task: AiTask, id: string) => void
  setKey: (key: string) => void
  web: boolean
  setWeb: (web: boolean) => void
  keyChoice: Record<string, KeySource>
  setKeyChoice: (wid: string, source: KeySource) => void
}

export const useAiSettings = create<AiSettings>((set) => ({
  apiKey: load(KEY),
  models: loadModels(),
  setModel: (task, id) =>
    set((s) => {
      const models = { ...s.models, [task]: id }
      save(MODELS_KEY, JSON.stringify(models))
      return { models }
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

// The model a message goes to: research while web search is on.
export const modelFor = (s: { models: Record<AiTask, string>; web: boolean }) => s.models[s.web ? 'research' : 'chat']

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
