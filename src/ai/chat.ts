// The assistant's conversation (D-073): this tab only, one per workspace, gone on reload. Collaborators never see it.
import { create } from 'zustand'
import { AiError, streamReply, type ChatTurn } from './openai'
import { useAiSettings } from './settings'

export type ChatMessage = ChatTurn & { id: number; error?: string }

type ChatState = {
  wid: string | null
  open: boolean
  messages: ChatMessage[]
  busy: boolean
  setOpen: (open: boolean) => void
  // Switching workspace starts a new conversation.
  enter: (wid: string) => void
  send: (text: string, instructions: () => string) => void
  stop: () => void
  clear: () => void
}

let nextId = 1
let controller: AbortController | null = null

export const useChat = create<ChatState>((set, get) => ({
  wid: null,
  open: false,
  messages: [],
  busy: false,
  setOpen: (open) => set({ open }),
  enter: (wid) => {
    if (get().wid === wid) return
    get().stop()
    set({ wid, messages: [] })
  },
  send: (text, instructions) => {
    const { apiKey, model } = useAiSettings.getState()
    const content = text.trim()
    if (!content || get().busy || !apiKey) return
    // Failed answers aren't sent back as history.
    const turns: ChatTurn[] = [...get().messages.filter((m) => !m.error && m.content), { role: 'user' as const, content }].map(
      ({ role, content }) => ({ role, content }),
    )
    const reply: ChatMessage = { id: nextId++, role: 'assistant', content: '' }
    set((s) => ({ busy: true, messages: [...s.messages, { id: nextId++, role: 'user', content }, reply] }))

    const update = (patch: Partial<ChatMessage>) =>
      set((s) => ({ messages: s.messages.map((m) => (m.id === reply.id ? { ...m, ...patch } : m)) }))
    const ctl = new AbortController()
    controller = ctl
    let answer = ''
    streamReply({
      key: apiKey,
      model,
      instructions: instructions(),
      turns,
      signal: ctl.signal,
      onDelta: (d) => update({ content: (answer += d) }),
    })
      .catch((e: unknown) => {
        if (ctl.signal.aborted) return
        update({ error: e instanceof AiError ? e.message : 'Something went wrong talking to OpenAI.' })
      })
      .finally(() => {
        if (controller !== ctl) return
        controller = null
        set({ busy: false })
      })
  },
  stop: () => {
    controller?.abort()
    controller = null
    set({ busy: false })
  },
  clear: () => {
    get().stop()
    set({ messages: [] })
  },
}))
