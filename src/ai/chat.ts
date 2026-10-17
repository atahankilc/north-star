// The assistant's conversation (D-073): this tab only, one per workspace, gone on reload. Collaborators never see it.
import { create } from 'zustand'
import type { ItemRef } from './context'
import { AiError, streamReply, type ChatTurn } from './openai'
import { useAiSettings } from './settings'
import { PROPOSE, PROPOSE_TOOL, parseProposal, proposalForHistory, type Proposal, type ProposalState } from './tools'

export type ChatMessage = ChatTurn & {
  id: number
  error?: string
  // Changes the assistant proposed in this answer (D-074), with the refs they were written against.
  proposal?: Proposal
  proposalState?: ProposalState
  refs?: Map<string, ItemRef>
}

// Built when a message is sent, so it sees the workspace as it is then.
export type Prepared = { instructions: string; refs: Map<string, ItemRef> }

// What the model sees of an earlier answer: its text plus what it proposed and what became of it.
function asTurn(m: ChatMessage): ChatTurn {
  if (!m.proposal) return { role: m.role, content: m.content }
  const note = proposalForHistory(m.proposal, m.proposalState ?? { status: 'pending' })
  return { role: m.role, content: m.content ? `${m.content}\n\n${note}` : note }
}

type ChatState = {
  wid: string | null
  open: boolean
  messages: ChatMessage[]
  busy: boolean
  setOpen: (open: boolean) => void
  // Switching workspace starts a new conversation.
  enter: (wid: string) => void
  send: (text: string, prepare: () => Prepared) => void
  decide: (id: number, state: ProposalState) => void
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
  send: (text, prepare) => {
    const { apiKey, model } = useAiSettings.getState()
    const content = text.trim()
    if (!content || get().busy || !apiKey) return
    // Failed answers aren't sent back as history.
    const turns: ChatTurn[] = [
      ...get()
        .messages.filter((m) => !m.error && (m.content || m.proposal))
        .map(asTurn),
      { role: 'user', content },
    ]
    const { instructions, refs } = prepare()
    const reply: ChatMessage = { id: nextId++, role: 'assistant', content: '', refs }
    set((s) => ({ busy: true, messages: [...s.messages, { id: nextId++, role: 'user', content }, reply] }))

    const update = (patch: Partial<ChatMessage>) =>
      set((s) => ({ messages: s.messages.map((m) => (m.id === reply.id ? { ...m, ...patch } : m)) }))
    const ctl = new AbortController()
    controller = ctl
    let answer = ''
    streamReply({
      key: apiKey,
      model,
      instructions,
      turns,
      signal: ctl.signal,
      onDelta: (d) => update({ content: (answer += d) }),
      tools: [PROPOSE_TOOL],
      onToolCall: (name, args) => {
        if (name === PROPOSE) update({ proposal: parseProposal(args, refs), proposalState: { status: 'pending' } })
      },
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
  decide: (id, proposalState) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, proposalState } : m)) })),
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
