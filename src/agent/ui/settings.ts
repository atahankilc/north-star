// The agent's settings in this browser (S14, D-312; docs/specs/agent.md §4.2, §4.8; CLAUDE.md's hard rule): the
// person's own OpenAI key, the model they picked, its reasoning effort, and the model ids their key can use (filled by
// Settings' [check]). Kept ONLY in this browser's localStorage under the names below; the key is read here and handed
// to makeModel / listModels, which send it to api.openai.com and nowhere else. Nothing here logs, stores elsewhere or
// shows the key again: what the UI shows is `sk-…abcd` (`keyHint`).
import { create } from 'zustand'
import type { Effort } from '../openai'
import { DEFAULT_EFFORT } from '../models'

export const KEY_STORE = 'northstar.agent.openaiKey'
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

const readModels = (): string[] => {
  try {
    const v = JSON.parse(read(MODELS_STORE) || '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 400) : []
  } catch {
    return []
  }
}

type AgentSettingsState = {
  // Whether a key is saved (the key itself is read only when a chat or [check] needs it: `readKey`).
  hasKey: boolean
  hint: string
  // The person's pick ('' = nothing picked yet: the picker pre-selects SUGGESTED, nothing runs on it until saved).
  model: string
  effort: Effort
  models: string[]
  saveKey: (key: string) => void
  removeKey: () => void
  setModel: (id: string) => void
  setEffort: (e: Effort) => void
  setModels: (ids: string[]) => void
}

// `sk-…abcd`: enough to tell two keys apart, never the key.
export const keyHint = (key: string) => (key ? `${key.trim().slice(0, 3)}…${key.trim().slice(-4)}` : '')

// The saved key, for the one call that needs it (makeModel, listModels). Never put it in state, a log or the DOM.
export const readKey = (): string => read(KEY_STORE).trim()

const savedEffort = (): Effort => {
  const e = read(EFFORT_STORE) as Effort
  return EFFORTS.includes(e) ? e : DEFAULT_EFFORT
}

export const useAgentSettings = create<AgentSettingsState>((set) => ({
  hasKey: !!readKey(),
  hint: keyHint(readKey()),
  model: read(MODEL_STORE),
  effort: savedEffort(),
  models: readModels(),
  saveKey: (key) => {
    const k = key.trim()
    write(KEY_STORE, k)
    set({ hasKey: !!k, hint: keyHint(k) })
  },
  removeKey: () => {
    write(KEY_STORE, null)
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
}))
