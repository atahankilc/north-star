// The assistant's conversation (D-073): this tab only, one per workspace, gone on reload. Collaborators never see it.
// An answer is a short agent loop (D-084): the model may call a tool, see its result and go on, for a few steps.
// Deep research (D-088) is a plan you review, researchers on the web, then one such answer written from their findings.
import { create } from 'zustand'
import type { ItemRef } from './context'
import type { KeySource } from '../data/ai'
import type { WorkspaceCtx } from '../views/workspace/context'
import { callAi } from './call'
import { AiError, type ChatTurn, type Citation, type InputItem, type ToolCall } from './openai'
import { GET_ITEMS, GET_ITEMS_TOOL, GET_REPORT, GET_REPORT_TOOL, readItems, readReport } from './readTools'
import {
  CHAT_REPORT,
  CHAT_REPORT_TOOL,
  numberSources,
  parseChatReport,
  PARALLEL,
  parsePlan,
  parseReport,
  PLAN,
  PLAN_TOOL,
  planAsk,
  REPORT,
  REPORT_TOOL,
  reportAsk,
  reportText,
  researcherInstructions,
  type Report,
  type Research,
} from './research'
import { useAiSettings, type AiTask } from './settings'
import { newReportId, saveReport } from '../data/reports'
import type { ReportKind } from '../data/model'
import { PROPOSE, PROPOSE_TOOL, parseProposal, proposalForHistory, proposalReport, type Proposal, type ProposalState } from './tools'

// Calls to OpenAI per answer. The last one may not use tools, so an answer always ends in words.
const MAX_STEPS = 6

export type ChatMessage = ChatTurn & {
  id: number
  // What the chat shows instead of `content`: an analysis mode as typed (`/validate`), while the model gets its full ask (D-085).
  shown?: string
  error?: string
  // Changes the assistant proposed in this answer (D-074), with the refs they were written against.
  proposal?: Proposal
  proposalState?: ProposalState
  refs?: Map<string, ItemRef>
  // What it did along the way, in order (D-084): reads, web searches (D-076), proposals. `thinking` while a step runs
  // with nothing to show yet.
  steps?: Step[]
  thinking?: boolean
  // The sources the answer cites (D-076).
  citations?: Citation[]
  // A deep research run (D-088): its plan, its researchers and where it's at; its report (D-089).
  research?: Research
  report?: Report
  // Its id in the reports tab (D-090), saved there at once for research and when you choose for a chat write-up;
  // why saving failed, if it did; and what it's saved with.
  reportId?: string
  reportError?: string
  reportMeta?: { kind: ReportKind; topic: string; model: string }
}

// `warn`: done, but not all of it worked (a proposal with rows that can't be applied, refs that matched nothing).
export type Step = { kind: 'read' | 'search' | 'propose' | 'plan' | 'research' | 'report'; text: string; state: 'running' | 'done' | 'warn' }

// Built when a message is sent, so it sees the workspace as it is then.
// `ws` is what the read tools see for the whole answer; `reports` the brief's report handles (D-099).
// `models`: the model per task for this key and workspace (D-104, src/ai/models.ts).
export type Prepared = { instructions: string; refs: Map<string, ItemRef>; reports: Map<string, string>; source: KeySource; ws: WorkspaceCtx; models: Record<AiTask, string> }

// Everything one answer's loop needs: where it writes (`update`), its key and model, what the tools see.
type AnswerRun = {
  wid: string
  source: KeySource
  apiKey: string
  model: string
  task: 'chat' | 'research'
  webSearch: boolean
  instructions: string
  refs: Map<string, ItemRef>
  reports: Map<string, string>
  ws: WorkspaceCtx
  signal: AbortSignal
  update: (patch: Partial<ChatMessage>) => void
  // Carried in from earlier phases (a research run's steps), added to here.
  steps: Step[]
  citations: Citation[]
  // More function tools for this answer (the research report, D-089), and whether its first step must call one.
  extra?: { def: object; name: string; run: (args: string) => string | Promise<string> }[]
  firstRequired?: boolean
}

// The agent loop (D-084): up to MAX_STEPS calls, running the function tools the model calls in between.
async function runAnswer(r: AnswerRun, turns: InputItem[]): Promise<void> {
  const { update, steps, citations, refs, ws } = r
  const showSteps = (patch: Partial<ChatMessage> = {}) => update({ steps: [...steps], ...patch })
  let answer = ''
  let proposed = false
  // A tool's result, as the model will read it, and a step in the chat; a proposal also shows its checklist (a later
  // one in the same answer replaces it).
  const run = async (c: ToolCall): Promise<string> => {
    if (c.name === PROPOSE) {
      const proposal = parseProposal(c.args, refs, ws.labels.map((l) => l.text))
      const bad = proposal.changes.filter((x) => x.problem)
      const n = proposal.changes.length
      const what = `${proposed ? 'corrected the proposal' : 'proposed'}: ${n} change${n === 1 ? '' : 's'}`
      const why = [...new Set(bad.map((x) => x.problem))].join(', ')
      steps.push({ kind: 'propose', text: bad.length ? `${what}, ${bad.length} can't be applied (${why})` : what, state: bad.length || !n ? 'warn' : 'done' })
      proposed = true
      showSteps({ proposal, proposalState: { status: 'pending' } })
      return proposalReport(proposal)
    }
    if (c.name === GET_ITEMS) {
      const res = readItems(c.args, ws, refs)
      const missed = res.missed ? `${res.names.length ? ', ' : ''}${res.missed} not found` : ''
      steps.push({ kind: 'read', text: `read ${res.names.join(' · ')}${missed}`, state: res.missed ? 'warn' : 'done' })
      showSteps()
      return res.text
    }
    if (c.name === GET_REPORT) {
      const refOf = new Map([...refs].map(([ref, it]) => [it.id, ref]))
      const res = await readReport(c.args, r.wid, r.reports, (id) => refOf.get(id))
      steps.push({ kind: 'read', text: res.title ? `read the report "${res.title}"` : "couldn't read the report", state: res.title ? 'done' : 'warn' })
      showSteps()
      return res.text
    }
    const x = r.extra?.find((t) => t.name === c.name)
    if (x) return x.run(c.args)
    return `There is no tool called ${c.name}.`
  }
  let input = turns
  for (let step = 0; step < MAX_STEPS; step++) {
    // Text from an earlier step stays; the next step's text starts a new paragraph.
    let fresh = true
    update({ thinking: true })
    const { output, calls } = await callAi({
      wid: r.wid,
      task: r.task,
      source: r.source,
      apiKey: r.apiKey,
      model: r.model,
      instructions: r.instructions,
      webSearch: r.webSearch,
      onSearch: (e) => {
        if (e.status === 'searching') {
          steps.push({ kind: 'search', text: 'searching the web', state: 'running' })
          return showSteps({ thinking: false })
        }
        const at = steps.map((x) => x.kind === 'search' && x.state === 'running').lastIndexOf(true)
        const text = e.queries.length ? `searched ${e.queries.map((q) => `"${q}"`).join(' · ')}` : 'searched the web'
        if (at >= 0) steps[at] = { kind: 'search', text, state: 'done' }
        showSteps()
      },
      onCitation: (c) => {
        if (citations.some((x) => x.url === c.url)) return
        citations.push(c)
        update({ citations: [...citations] })
      },
      turns: input,
      signal: r.signal,
      onDelta: (d) => {
        if (fresh && answer.trim()) answer = `${answer.trimEnd()}\n\n`
        fresh = false
        update({ content: (answer += d), thinking: false })
      },
      tools: [PROPOSE_TOOL, GET_ITEMS_TOOL, GET_REPORT_TOOL, ...(r.extra ?? []).map((t) => t.def)],
      toolChoice: step === MAX_STEPS - 1 ? 'none' : step === 0 && r.firstRequired ? 'required' : 'auto',
    })
    update({ thinking: false })
    if (!calls.length || r.signal.aborted) return
    // One at a time, in order, so steps show in the order they were called.
    const results: InputItem[] = []
    for (const c of calls) results.push({ type: 'function_call_output', call_id: c.callId, output: await run(c) })
    if (r.signal.aborted) return
    input = [...input, ...output, ...results]
  }
}

// What the model sees of an earlier answer: its text plus what it proposed and what became of it.
// A report (D-089) goes back as its compact text.
function asTurn(m: ChatMessage): ChatTurn {
  const text = [m.report && reportText(m.report), m.content].filter(Boolean).join('\n\n')
  if (!m.proposal) return { role: m.role, content: text }
  const note = proposalForHistory(m.proposal, m.proposalState ?? { status: 'pending' })
  return { role: m.role, content: text ? `${text}\n\n${note}` : note }
}

type ChatState = {
  wid: string | null
  open: boolean
  messages: ChatMessage[]
  busy: boolean
  // The report on the report screen (D-089), by its saved id (D-090), or null.
  reportOpen: string | null
  showReport: (id: string | null) => void
  setOpen: (open: boolean) => void
  // Switching workspace starts a new conversation.
  enter: (wid: string) => void
  send: (text: string, prepare: () => Prepared, shown?: string) => void
  // Deep research (D-088): plan the questions for a topic; then, once you've picked them, run it.
  research: (topic: string, prepare: () => Prepared, shown: string) => void
  toggleQuestion: (id: number, question: number) => void
  runResearch: (id: number, prepare: () => Prepared) => void
  decide: (id: number, state: ProposalState) => void
  // Saves a chat write-up (D-090) to the reports tab, for you only until you share it.
  keepReport: (id: number) => void
  stop: () => void
  clear: () => void
}

let nextId = 1
let controller: AbortController | null = null

// What the model sees of the conversation so far. Failed answers aren't sent back.
const history = (messages: ChatMessage[]): ChatTurn[] => messages.filter((m) => !m.error && (m.content || m.proposal)).map(asTurn)
// The conversation before the ask that message `id` answers.
const before = (messages: ChatMessage[], id: number) => messages.slice(0, Math.max(0, messages.findIndex((m) => m.id === id) - 1))

// Set up a run writing into message `id`, and make it the one Stop aborts.
function begin(id: number, p: Prepared, task: AnswerRun['task'], model: string, webSearch: boolean): AnswerRun {
  const ctl = new AbortController()
  controller = ctl
  const wid = useChat.getState().wid!
  return {
    wid,
    source: p.source,
    apiKey: useAiSettings.getState().apiKey,
    model,
    task,
    webSearch,
    instructions: p.instructions,
    refs: p.refs,
    reports: p.reports,
    ws: p.ws,
    signal: ctl.signal,
    update: (patch) => useChat.setState((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
    steps: [],
    citations: [],
  }
}

// Errors into the message, running steps closed, the chat free again.
function finish(id: number, run: AnswerRun, work: Promise<void>) {
  work
    .catch((e: unknown) => {
      if (run.signal.aborted) return
      run.update({ error: e instanceof AiError ? e.message : 'Something went wrong talking to OpenAI.' })
      const r = useChat.getState().messages.find((m) => m.id === id)?.research
      if (r && r.phase !== 'done') run.update({ research: { ...r, phase: 'failed' } })
    })
    .finally(() => {
      for (const [i, x] of run.steps.entries()) if (x.state === 'running') run.steps[i] = { ...x, state: 'done' }
      run.update({ steps: [...run.steps], thinking: false })
      if (run.signal.aborted) {
        const r = useChat.getState().messages.find((m) => m.id === id)?.research
        if (r && !['done', 'review'].includes(r.phase)) run.update({ research: { ...r, phase: 'cancelled' } })
      }
      if (controller?.signal !== run.signal) return
      controller = null
      useChat.setState({ busy: false })
    })
}

export const useChat = create<ChatState>((set, get) => ({
  wid: null,
  open: false,
  messages: [],
  busy: false,
  reportOpen: null,
  showReport: (reportOpen) => set({ reportOpen }),
  setOpen: (open) => set({ open }),
  enter: (wid) => {
    if (get().wid === wid) return
    get().stop()
    set({ wid, messages: [], reportOpen: null })
  },
  send: (text, prepare, shown) => {
    const settings = useAiSettings.getState()
    const content = text.trim()
    if (!content || get().busy || !get().wid) return
    const turns = [...history(get().messages), { role: 'user' as const, content }]
    const p = prepare()
    if (p.source === 'own' && !settings.apiKey) return
    const reply: ChatMessage = { id: nextId++, role: 'assistant', content: '', refs: p.refs }
    set((s) => ({ busy: true, messages: [...s.messages, { id: nextId++, role: 'user', content, shown }, reply] }))
    const run = begin(reply.id, p, settings.web ? 'research' : 'chat', p.models[settings.web ? 'research' : 'chat'], settings.web)
    // Asked for a report, it writes the conversation up (D-090); it shows at once and waits for you to save it.
    let reportId: string | undefined
    run.extra = [
      {
        def: CHAT_REPORT_TOOL,
        name: CHAT_REPORT,
        run: (args) => {
          const cited = [...get().messages.flatMap((m) => m.citations ?? []), ...run.citations]
          const report = parseChatReport(args, run.refs, cited)
          if (!report) return `The report came back garbled. Call ${CHAT_REPORT} again with every field filled.`
          reportId ??= newReportId(run.wid)
          run.steps.push({ kind: 'report', text: `wrote a report · ${report.sections.length} sections`, state: 'done' })
          run.update({ report, reportId, reportError: undefined, steps: [...run.steps], reportMeta: { kind: 'chat', topic: (shown ?? content).slice(0, 500), model: run.model } })
          useChat.setState({ reportOpen: reportId })
          return 'Shown to the user on the report screen, where they can save it to the reports tab or download it as .md. Finish with one short sentence; don\'t repeat the report or claim it was saved.'
        },
      },
    ]
    finish(reply.id, run, runAnswer(run, turns))
  },
  research: (topic, prepare, shown) => {
    const settings = useAiSettings.getState()
    if (get().busy || !get().wid) return
    const p = prepare()
    if (p.source === 'own' && !settings.apiKey) return
    const reply: ChatMessage = { id: nextId++, role: 'assistant', content: '', refs: p.refs, research: { topic, phase: 'planning', questions: [] } }
    // The short form is what later turns see of the ask; the report carries what was found.
    const content = `Research: ${topic || 'our market'}`
    set((s) => ({ busy: true, messages: [...s.messages, { id: nextId++, role: 'user', content, shown }, reply] }))
    const run = begin(reply.id, p, 'research', p.models.deep, false)
    run.steps.push({ kind: 'plan', text: 'planning the research', state: 'running' })
    run.update({ steps: [...run.steps] })
    const plan = async () => {
      const { calls } = await callAi({
        wid: run.wid,
        task: 'research',
        source: run.source,
        apiKey: run.apiKey,
        model: run.model,
        instructions: run.instructions,
        turns: [...history(before(get().messages, reply.id)), { role: 'user', content: planAsk(topic) }],
        signal: run.signal,
        onDelta: () => {},
        tools: [PLAN_TOOL],
        toolChoice: 'required',
      })
      const questions = parsePlan(calls.find((c) => c.name === PLAN)?.args ?? '')
      run.steps[0] = { kind: 'plan', text: questions.length ? `planned ${questions.length} questions` : "couldn't plan the research", state: questions.length ? 'done' : 'warn' }
      run.update({ steps: [...run.steps], research: { topic, phase: questions.length ? 'review' : 'failed', questions } })
    }
    finish(reply.id, run, plan())
  },
  toggleQuestion: (id, question) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id && m.research?.phase === 'review'
          ? { ...m, research: { ...m.research, questions: m.research.questions.map((q) => (q.id === question ? { ...q, on: !q.on } : q)) } }
          : m,
      ),
    })),
  runResearch: (id, prepare) => {
    const settings = useAiSettings.getState()
    const msg = get().messages.find((m) => m.id === id)
    if (get().busy || !msg?.research || msg.research.phase !== 'review') return
    if (!msg.research.questions.some((q) => q.on)) return
    const p = prepare()
    if (p.source === 'own' && !settings.apiKey) return
    set({ busy: true })
    // The report is written like any answer, with deep research's model (D-104); the board as it is now.
    const run = { ...begin(id, p, 'research', p.models.deep, false), steps: [...(msg.steps ?? [])] }
    let research: Research = { ...msg.research, phase: 'running' }
    const setQuestion = (q: number, patch: Partial<Research['questions'][number]>) => {
      research = { ...research, questions: research.questions.map((x) => (x.id === q ? { ...x, ...patch } : x)) }
      run.update({ research })
    }
    run.update({ research, refs: p.refs })
    const researcher = async (q: Research['questions'][number]) => {
      const step = run.steps.push({ kind: 'research', text: `researching "${q.question}"`, state: 'running' }) - 1
      run.update({ steps: [...run.steps] })
      setQuestion(q.id, { state: 'running' })
      let findings = ''
      const sources: Citation[] = []
      const queries: string[] = []
      try {
        await callAi({
          wid: run.wid,
          task: 'research',
          source: run.source,
          apiKey: run.apiKey,
          model: run.model,
          instructions: researcherInstructions(p.ws, research.topic),
          turns: [{ role: 'user', content: q.question }],
          signal: run.signal,
          webSearch: true,
          onSearch: (e) => {
            if (e.status === 'done') queries.push(...e.queries)
          },
          onCitation: (c) => {
            if (!sources.some((x) => x.url === c.url)) sources.push(c)
          },
          onDelta: (d) => (findings += d),
        })
        run.steps[step] = { kind: 'research', text: `researched "${q.question}" · ${sources.length} source${sources.length === 1 ? '' : 's'}`, state: 'done' }
        setQuestion(q.id, { state: 'done', findings, sources, queries })
        for (const c of sources) if (!run.citations.some((x) => x.url === c.url)) run.citations.push(c)
      } catch (e) {
        if (run.signal.aborted) throw e
        run.steps[step] = { kind: 'research', text: `couldn't research "${q.question}"`, state: 'warn' }
        setQuestion(q.id, { state: 'failed' })
      }
      run.update({ steps: [...run.steps], citations: [...run.citations] })
    }
    const go = async () => {
      // A few researchers at a time: each takes the next waiting question.
      const queue = research.questions.filter((q) => q.on)
      await Promise.all(
        Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
          for (let q = queue.shift(); q; q = queue.shift()) await researcher(q)
        }),
      )
      if (!research.questions.some((q) => q.on && q.state === 'done')) {
        run.update({ research: { ...research, phase: 'failed' }, error: 'None of the researchers came back with findings.' })
        return
      }
      research = { ...research, phase: 'writing', sources: numberSources(research) }
      run.update({ research })
      const turns = [...history(before(get().messages, id)), { role: 'user' as const, content: reportAsk(research) }]
      // The report comes through write_report (D-089) and opens on the report screen; the text answer is one sentence.
      // Saved as soon as it's written, under one id even if the model writes it again.
      const reportId = newReportId(run.wid)
      run.extra = [
        {
          def: REPORT_TOOL,
          name: REPORT,
          run: (args) => {
            const report = parseReport(args, research.sources ?? [], run.refs)
            if (!report) return 'The report came back garbled. Call write_report again with every field filled.'
            run.steps.push({ kind: 'report', text: `wrote the report · ${report.sections.length} sections · ${report.sources.length} sources`, state: 'done' })
            const reportMeta = { kind: 'research' as const, topic: research.topic, model: run.model }
            run.update({ report, reportId, reportError: undefined, reportMeta, steps: [...run.steps] })
            saveReport(run.wid, reportId, report, reportMeta).catch((e: Error) =>
              run.update({ reportError: e.message }),
            )
            // It opens by itself: that's what the run was for.
            useChat.setState({ reportOpen: reportId })
            return 'Shown to the user on the report screen. Now propose changes if they help, then finish with one short sentence.'
          },
        },
      ]
      run.firstRequired = true
      await runAnswer(run, turns)
      run.update({ research: { ...research, phase: 'done' } })
    }
    finish(id, run, go())
  },
  keepReport: (id) => {
    const m = get().messages.find((x) => x.id === id)
    const wid = get().wid
    if (!m?.report || !m.reportId || !m.reportMeta || !wid) return
    const update = (patch: Partial<ChatMessage>) => set((s) => ({ messages: s.messages.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
    update({ reportError: undefined })
    saveReport(wid, m.reportId, m.report, m.reportMeta).catch((e: Error) => update({ reportError: e.message }))
  },
  decide: (id, proposalState) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, proposalState } : m)) })),
  stop: () => {
    controller?.abort()
    controller = null
    set({ busy: false })
  },
  clear: () => {
    get().stop()
    set({ messages: [], reportOpen: null })
  },
}))
