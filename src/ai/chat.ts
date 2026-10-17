// The assistant's conversation (D-073): this tab only, one per workspace, gone on reload. Collaborators never see it.
// An answer is a short agent loop (D-084): the model may call a tool, see its result and go on, for a few steps.
import { create } from 'zustand'
import type { ItemRef } from './context'
import type { KeySource } from '../data/ai'
import type { WorkspaceCtx } from '../views/workspace/context'
import { callAi } from './call'
import { AiError, type ChatTurn, type Citation, type InputItem, type ToolCall } from './openai'
import { GET_ITEMS, GET_ITEMS_TOOL, readItems } from './readTools'
import { modelFor, useAiSettings } from './settings'
import { PROPOSE, PROPOSE_TOOL, parseProposal, proposalForHistory, proposalReport, type Proposal, type ProposalState } from './tools'

// Calls to OpenAI per answer. The last one may not use tools, so an answer always ends in words.
const MAX_STEPS = 6

export type ChatMessage = ChatTurn & {
  id: number
  error?: string
  // Changes the assistant proposed in this answer (D-074), with the refs they were written against.
  proposal?: Proposal
  proposalState?: ProposalState
  refs?: Map<string, ItemRef>
  // Web search (D-076): what it looked up, whether it's looking now, and the sources the answer cites.
  searching?: boolean
  queries?: string[]
  citations?: Citation[]
  // Items it read in full along the way (D-084).
  read?: string[]
}

// Built when a message is sent, so it sees the workspace as it is then.
// `ws` is what the read tools see for the whole answer.
export type Prepared = { instructions: string; refs: Map<string, ItemRef>; source: KeySource; ws: WorkspaceCtx }

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
    const settings = useAiSettings.getState()
    const { apiKey, web } = settings
    const model = modelFor(settings)
    const content = text.trim()
    const wid = get().wid
    if (!content || get().busy || !wid) return
    // Failed answers aren't sent back as history.
    const turns: ChatTurn[] = [
      ...get()
        .messages.filter((m) => !m.error && (m.content || m.proposal))
        .map(asTurn),
      { role: 'user', content },
    ]
    const { instructions, refs, source, ws } = prepare()
    if (source === 'own' && !apiKey) return
    const reply: ChatMessage = { id: nextId++, role: 'assistant', content: '', refs }
    set((s) => ({ busy: true, messages: [...s.messages, { id: nextId++, role: 'user', content }, reply] }))

    const update = (patch: Partial<ChatMessage>) =>
      set((s) => ({ messages: s.messages.map((m) => (m.id === reply.id ? { ...m, ...patch } : m)) }))
    const ctl = new AbortController()
    controller = ctl
    let answer = ''
    const queries: string[] = []
    const citations: Citation[] = []
    const read: string[] = []
    // A tool's result, as the model will read it; a proposal also shows in the chat (a later one replaces it).
    const run = (c: ToolCall): string => {
      if (c.name === PROPOSE) {
        const proposal = parseProposal(c.args, refs)
        update({ proposal, proposalState: { status: 'pending' } })
        return proposalReport(proposal)
      }
      if (c.name === GET_ITEMS) {
        const r = readItems(c.args, ws, refs)
        read.push(...r.names.filter((n) => !read.includes(n)))
        update({ read: [...read] })
        return r.text
      }
      return `There is no tool called ${c.name}.`
    }
    const loop = async () => {
      let input: InputItem[] = turns
      for (let step = 0; step < MAX_STEPS; step++) {
        // Text from an earlier step stays; the next step's text starts a new paragraph.
        let fresh = true
        const { output, calls } = await callAi({
          wid,
          task: web ? 'research' : 'chat',
          source,
          apiKey,
          model,
          instructions,
          webSearch: web,
          onSearch: (e) => {
            if (e.status === 'searching') return update({ searching: true })
            queries.push(...e.queries.filter((q) => !queries.includes(q)))
            update({ searching: false, queries: [...queries] })
          },
          onCitation: (c) => {
            if (citations.some((x) => x.url === c.url)) return
            citations.push(c)
            update({ citations: [...citations] })
          },
          turns: input,
          signal: ctl.signal,
          onDelta: (d) => {
            if (fresh && answer.trim()) answer = `${answer.trimEnd()}\n\n`
            fresh = false
            update({ content: (answer += d) })
          },
          tools: [PROPOSE_TOOL, GET_ITEMS_TOOL],
          toolChoice: step === MAX_STEPS - 1 ? 'none' : 'auto',
        })
        if (!calls.length || ctl.signal.aborted) return
        input = [...input, ...output, ...calls.map((c) => ({ type: 'function_call_output', call_id: c.callId, output: run(c) }))]
      }
    }
    loop()
      .catch((e: unknown) => {
        if (ctl.signal.aborted) return
        update({ error: e instanceof AiError ? e.message : 'Something went wrong talking to OpenAI.' })
      })
      .finally(() => {
        update({ searching: false })
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
