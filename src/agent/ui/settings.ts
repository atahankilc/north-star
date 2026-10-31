// The agent's settings in this browser (S14, D-312, D-329; docs/specs/agent.md §4.2, §4.8; CLAUDE.md's hard rule):
// the person's own keys (OpenAI's, Anthropic's, either or both), the model they picked, its reasoning effort, and the
// model ids each key can use (filled by Settings' [check]). Kept ONLY in this browser's localStorage under the names
// below; a key is read here and handed to makeModel / the model list, which send it to its own provider (api.openai.com
// or api.anthropic.com) and nowhere else. Nothing here logs, stores elsewhere or
// shows the key again: what the UI shows is `sk-…abcd` (`keyHint`).
import { create } from 'zustand'
import type { Effort } from '../openai'
import { DEFAULT_EFFORT } from '../models'

import { KNOWN_MODELS, suggestedFor, type ProviderId } from '../models'

export const KEY_STORE = 'northstar.agent.openaiKey'
export const ANTHROPIC_KEY_STORE = 'northstar.agent.anthropicKey'
export const CLAUDE_MODELS_STORE = 'northstar.agent.claudeModels'
const STORE: Record<ProviderId, string> = { openai: KEY_STORE, anthropic: ANTHROPIC_KEY_STORE }
export const MODEL_STORE = 'northstar.agent.model'
export const EFFORT_STORE = 'northstar.agent.effort'
export const MODELS_STORE = 'northstar.agent.models'

export const EFFORTS: readonly Effort[] = ['low', 'medium', 'high']

const read = (k: string): string => {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}

const write = (k: string, v: string | null) => {
  try {
    if (v === null || v === '') localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    // Storage blocked: the setting lasts for this tab only.
  }
}

const readModels = (store = MODELS_STORE): string[] => {
  try {
    const v = JSON.parse(read(store) || '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 400) : []
  } catch {
    return []
  }
}

type AgentSettingsState = {
  // Whether a key is saved (the key itself is read only when a chat or [check] needs it: `readKey`).
  hasKey: boolean
  hint: string
  // The Anthropic key (D-329), the same way: whether one is saved, its `sk-…abcd`.
  hasClaudeKey: boolean
  claudeHint: string
  // The person's pick ('' = nothing picked yet: the picker pre-selects SUGGESTED, nothing runs on it until saved).
  model: string
  effort: Effort
  models: string[]
  // Claude's ids as ours (`anthropic:claude-…`), from its key's [check].
  claudeModels: string[]
  saveKey: (key: string, provider?: ProviderId) => void
  removeKey: (provider?: ProviderId) => void
  setModel: (id: string) => void
  setEffort: (e: Effort) => void
  setModels: (ids: string[]) => void
  setClaudeModels: (ids: string[]) => void
}

// `sk-…abcd`: enough to tell two keys apart, never the key.
export const keyHint = (key: string) => (key ? `${key.trim().slice(0, 3)}…${key.trim().slice(-4)}` : '')

// The saved key, for the one call that needs it (makeModel, listModels). Never put it in state, a log or the DOM.
export const readKey = (provider: ProviderId = 'openai'): string => read(STORE[provider]).trim()

const savedEffort = (): Effort => {
  const e = read(EFFORT_STORE) as Effort
  return EFFORTS.includes(e) ? e : DEFAULT_EFFORT
}

export const useAgentSettings = create<AgentSettingsState>((set) => ({
  hasKey: !!readKey(),
  hint: keyHint(readKey()),
  hasClaudeKey: !!readKey('anthropic'),
  claudeHint: keyHint(readKey('anthropic')),
  model: read(MODEL_STORE),
  effort: savedEffort(),
  models: readModels(),
  claudeModels: readModels(CLAUDE_MODELS_STORE),
  saveKey: (key, provider = 'openai') => {
    const k = key.trim()
    write(STORE[provider], k)
    set(provider === 'anthropic' ? { hasClaudeKey: !!k, claudeHint: keyHint(k) } : { hasKey: !!k, hint: keyHint(k) })
  },
  removeKey: (provider = 'openai') => {
    write(STORE[provider], null)
    if (provider === 'anthropic') {
      write(CLAUDE_MODELS_STORE, null)
      set({ hasClaudeKey: false, claudeHint: '', claudeModels: [] })
      return
    }
    write(MODELS_STORE, null)
    set({ hasKey: false, hint: '', models: [] })
  },
  setModel: (id) => {
    write(MODEL_STORE, id)
    set({ model: id })
  },
  setEffort: (effort) => {
    write(EFFORT_STORE, effort)
    set({ effort })
  },
  setModels: (ids) => {
    write(MODELS_STORE, JSON.stringify(ids))
    set({ models: ids })
  },
  setClaudeModels: (ids) => {
    write(CLAUDE_MODELS_STORE, JSON.stringify(ids))
    set({ claudeModels: ids })
  },
}))

type Keys = Pick<AgentSettingsState, 'hasKey' | 'hasClaudeKey' | 'models' | 'claudeModels'>

// The models the picker offers (D-329): each saved key's checked list (else the known ones of that provider); with no
// key at all, every known one.
export function pickable(s: Keys): string[] {
  const known = (p: ProviderId) => KNOWN_MODELS.filter((m) => m.provider === p).map((m) => m.id)
  const openai = s.models.length ? s.models : known('openai')
  const claude = s.claudeModels.length ? s.claudeModels : known('anthropic')
  if (s.hasKey && s.hasClaudeKey) return [...openai, ...claude]
  if (s.hasClaudeKey) return claude
  return s.hasKey ? openai : [...openai, ...claude]
}

// The model pre-selected for the keys saved (the person's own pick always wins where one is read).
export const suggested = (s: Pick<AgentSettingsState, 'hasKey' | 'hasClaudeKey'>) => suggestedFor({ openai: s.hasKey, anthropic: s.hasClaudeKey })
