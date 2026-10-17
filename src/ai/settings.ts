// The AI assistant's settings (D-006, D-073), saved per browser. The OpenAI key lives only here, in this browser's
// localStorage: never in the DB, never in logs, never sent anywhere but api.openai.com.
import { create } from 'zustand'

// The cheapest current OpenAI model (Q-003, checked 2026-10-17). A per-feature model choice comes with the agent tools.
export const DEFAULT_MODEL = 'gpt-6-luna'

const KEY = 'north-star.openai-key'
// Web search on or off in the chat (D-076), remembered in this browser.
const WEB = 'north-star.ai-web'

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
  model: string
  setKey: (key: string) => void
  web: boolean
  setWeb: (web: boolean) => void
}

export const useAiSettings = create<AiSettings>((set) => ({
  apiKey: load(KEY),
  model: DEFAULT_MODEL,
  setKey: (apiKey) => {
    save(KEY, apiKey)
    set({ apiKey })
  },
  web: load(WEB) === 'on',
  setWeb: (web) => {
    save(WEB, web ? 'on' : '')
    set({ web })
  },
}))

// `sk-…abcd`: enough to recognise your key without showing it.
export const maskKey = (key: string) => (key.length > 8 ? `${key.slice(0, 3)}…${key.slice(-4)}` : '…')
