// The AI assistant's settings (D-006, D-073), saved per browser. The OpenAI key lives only here, in this browser's
// localStorage: never in the DB, never in logs, never sent anywhere but api.openai.com.
import { create } from 'zustand'

// The cheapest current OpenAI model (Q-003, checked 2026-10-17). A per-feature model choice comes with the agent tools.
export const DEFAULT_MODEL = 'gpt-6-luna'

const KEY = 'north-star.openai-key'

function load(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    // Storage blocked: no key until one is entered for this session.
    return ''
  }
}

type AiSettings = {
  apiKey: string
  model: string
  setKey: (key: string) => void
}

export const useAiSettings = create<AiSettings>((set) => ({
  apiKey: load(),
  model: DEFAULT_MODEL,
  setKey: (apiKey) => {
    try {
      if (apiKey) localStorage.setItem(KEY, apiKey)
      else localStorage.removeItem(KEY)
    } catch {
      // Not persisted; still works for this session.
    }
    set({ apiKey })
  },
}))

// `sk-…abcd`: enough to recognise your key without showing it.
export const maskKey = (key: string) => (key.length > 8 ? `${key.slice(0, 3)}…${key.slice(-4)}` : '…')
