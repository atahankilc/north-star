// The dev stub model (S12, D-312; agent-run.md S12, S14): plays scripted, realistic conversations against the CURRENT
// workspace without a key, so the agent's UI can be driven, shown and screenshotted. It is an `AgentModel` like the
// OpenAI adapter: it streams text, asks for real tool calls with the workspace's real short ids, and the loop runs them
// through the real tools, so steps, results and (S15) previews are real. Only the model's choices are scripted.
//
// Dev only: models.ts' `makeModel` imports this file behind `import.meta.env.DEV` when the address has `?agentStub=1`
// (or localStorage `northstar.agentStub` = '1'); a production build drops it (tests/unit/devStub.test.ts builds
// models.ts for production and checks that DEV_STUB_MARK is gone; after `npm run build`, grep dist for it).
//
// Scripts, picked by words in the person's message:
//   refuse    members, roles, invites, keys, deleting everything or the workspace → says no (or asks), no tools.
//   plan      build, organise, matrix, compare, prioritise, research, "deck of", plan → reads a plane, answers a
//             numbered plan and makes no change (a big job, prompt.ts' "Big jobs").
//   go        "go" / "yes" / "do it" right after that plan → carries it out in one `change` (a matrix, a deck of three
//             tasks, or a heading) and says what it made.
//   edit      add, create, make, new → where_am_i + the planes; view the plane; one `change` (create_card); reports
//             what the result says (short id, one undo step).
//   question  anything else → search (or a query when there are no words); get the first hits; answers citing them.
import type { AgentEnv, AgentModel, ModelEvent, ModelMessage, ModelRequest, ModelResponse, ToolCall, Usage } from './contract'
import { estimateTokens } from './read/text'
import { clean, derive } from './read/derive'
import { kindOfPiece } from '../model/pieces'
import { canvasOf } from '../model/canvases'

export const DEV_STUB_MARK = 'north-star:agent-dev-stub'

export type DevStubOpts = {
  // Pause before each step's answer (thinking), ms; and between streamed words.
  thinkMs?: number
  wordMs?: number
}

type Env = Pick<AgentEnv, 'getWs' | 'ids'>
type Call = { name: string; args: Record<string, unknown> }
type Step = { calls: Call[]; text?: string } | { answer: string }

const TYPES = ['customer', 'problem', 'competitor', 'idea', 'feature'] as const

const STOP = new Set('a an the and or of to in on for with is are was were be do does did what which who whom how many much our we us my me i you it its this that these those there any all have has had about from by as at show tell list give find please can could would should will'.split(' '))

export type Script = 'refuse' | 'plan' | 'go' | 'edit' | 'question'

const PLAN_MARK = 'Say go, or tell me what to change in the plan.'

// `before`: the agent's last answer before this message (a plan waiting for go makes "go" carry it out).
export function pickScript(ask: string, before = ''): Script {
  const a = ask.toLowerCase()
  if (before.includes(PLAN_MARK) && /^\s*(go|yes|ok|okay|do it|go ahead|sure)\b/.test(a)) return 'go'
  if (/\b(members?|roles?|owners?|admins?|invites?|invite code|api key|keys?|password)\b/.test(a) || /\bdelete (everything|all|the workspace|this workspace)\b/.test(a) || /\bremove everything\b/.test(a)) return 'refuse'
  if (/\b(build|organi[sz]e|tidy|matrix|compare|prioriti[sz]e|research|deck of|plan|roadmap)\b/.test(a)) return 'plan'
  if (/\b(add|create|make|new)\b/.test(a)) return 'edit'
  return 'question'
}

export const keywords = (ask: string) =>
  ask
    .toLowerCase()
    .replace(/["“”'’?.!,:;()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .slice(0, 4)
    .join(' ')

const quoted = (ask: string) => /["“]([^"”]{2,80})["”]/.exec(ask)?.[1]?.trim()

const idsIn = (text: string, kinds = 'ctpxd') => [...new Set(text.match(new RegExp(`\\b[${kinds}]\\d+\\b`, 'g')) ?? [])]

// The turn so far as the stub reads it: the ask, how many steps it has answered, the tool results it got.
function turnOf(messages: ModelMessage[]) {
  let at = -1
  for (let i = messages.length - 1; i >= 0; i--)
    if (messages[i].role === 'user') {
      at = i
      break
    }
  const after = messages.slice(at + 1)
  const said = messages.slice(0, Math.max(0, at)).filter((m) => m.role === 'assistant' && m.content)
  return {
    before: said.length ? said[said.length - 1].content : '',
    ask: at >= 0 ? (messages[at] as { content: string }).content : '',
    step: after.filter((m) => m.role === 'assistant').length,
    results: after.filter((m): m is Extract<ModelMessage, { role: 'tool' }> => m.role === 'tool'),
  }
}

function titleOf(env: Env, short: string): string {
  const r = env.ids.real(short)
  if (!r) return short
  const ws = clean(env.getWs())
  const t =
    r.kind === 'card' ? ws.cards.find((c) => c.id === r.id)?.title
    : r.kind === 'task' ? ws.tasks.find((c) => c.id === r.id)?.title
    : r.kind === 'piece' ? derive(ws).nameById(r.id)
    : r.kind === 'text' ? ws.labels.find((c) => c.id === r.id)?.text
    : r.kind === 'document' ? ws.documents.find((c) => c.id === r.id)?.title
    : undefined
  const flat = (t ?? '').replace(/\s+/g, ' ').trim()
  return flat ? `"${flat.length > 60 ? `${flat.slice(0, 59)}…` : flat}"` : short
}

function firstPlane(env: Env): string | undefined {
  const ws = clean(env.getWs())
  const p = ws.pieces.find((x) => kindOfPiece(x) === 'plane')
  return p ? env.ids.short('piece', p.id) : undefined
}

// The canvas a piece is on, as a short id.
function canvasOfShort(env: Env, piece: string): string | undefined {
  const r = env.ids.real(piece)
  const p = r && clean(env.getWs()).pieces.find((x) => x.id === r.id)
  return p ? env.ids.short('canvas', canvasOf(p)) : undefined
}

const startupName = (env: Env) => env.getWs().workspace?.name?.trim() || 'your startup'

// The script's next step for this turn.
export function nextStep(env: Env, ask: string, step: number, results: { name: string; content: string }[], before = ''): Step {
  const last = results[results.length - 1]?.content ?? ''
  const kind = pickScript(ask, before)
  if (kind === 'go') {
    const plane = /Read (p\d+)/.exec(before)?.[1] ?? firstPlane(env)
    const canvas = plane ? canvasOfShort(env, plane) : undefined
    if (step === 0) {
      if (!plane || !canvas) return { answer: "I can't find the plane from my plan any more; ask me again and I'll make a fresh plan." }
      if (/Make a matrix/.test(before))
        return { calls: [{ name: 'change', args: { ops: [{ op: 'create_piece', args: { kind: 'matrix', canvas, name: 'Features vs competitors', matrix: { template: 'compare', rows: { type: 'feature', plane }, cols: { type: 'competitor' } } } }], summary: 'a competitor matrix' } }], text: 'Making the matrix.' }
      if (/Make a deck of tasks/.test(before))
        return {
          calls: [{ name: 'change', args: { ops: [
            { op: 'create_piece', args: { kind: 'deck', canvas, name: 'Next steps', handle: '$d' } },
            { op: 'create_task', args: { deck: '$d', title: 'Talk to 5 customers about it' } },
            { op: 'create_task', args: { deck: '$d', title: 'Run a one-week test' } },
            { op: 'create_task', args: { deck: '$d', title: 'Write down what we learned' } },
          ], summary: 'a deck of tasks' } }],
          text: 'Making the deck.',
        }
      return { calls: [{ name: 'change', args: { ops: [{ op: 'create_text', args: { kind: 'heading', plane, text: 'Sorted by the agent', size: 'subheading' } }], summary: 'a heading' } }], text: 'Adding the heading.' }
    }
    const made = [...last.matchAll(/\$\w+ → ([cptx]\d+)/g)].map((m) => m[1])
    if (results[results.length - 1]?.name === 'change' && /^Applied/.test(last)) return { answer: `Done, as planned: ${made.length ? made.map((m) => `${m} ${titleOf(env, m)}`).join(', ') : 'the change is in'}. It's one undo step: ⌘Z takes it all back.` }
    return { answer: `I tried, but it was refused: ${last.split('\n')[0]}. Nothing changed.` }
  }
  if (kind === 'refuse') {
    if (/\bdelete\b|\bremove\b/i.test(ask))
      return { answer: `I won't delete everything in ${startupName(env)} at once. Tell me which planes, cards or tasks should go, and I'll list them for you to confirm with a yes before anything is deleted.` }
    return { answer: "I can't change members, roles, invites, codes or keys: no tool of mine can, and that stays with the workspace's owners in Settings → people. I can help with the workspace's content instead." }
  }
  if (kind === 'plan') {
    const plane = firstPlane(env)
    if (step === 0) return plane ? { calls: [{ name: 'view', args: { piece: plane } }, { name: 'query', args: { kind: 'card', type: 'feature', limit: 20 } }], text: '' } : { calls: [{ name: 'query', args: { kind: 'card', limit: 20 } }] }
    const what = /matrix|compare/i.test(ask) ? 'a matrix' : /deck|task|plan|roadmap/i.test(ask) ? 'a deck of tasks' : /organi[sz]e|tidy/i.test(ask) ? 'sections and headings' : 'the new pieces'
    const n = idsIn(results.map((r) => r.content).join('\n'), 'c').length
    return {
      answer: [
        `Here's my plan for ${startupName(env)} (${n} cards read so far):`,
        `1. Read ${plane ? `${plane} ${titleOf(env, plane)}` : 'your planes'} in full and the cards it links to.`,
        `2. Make ${what}${plane ? ` beside ${plane}` : ''}, placed by the app (nothing moves that you made).`,
        '3. Fill it from what the cards already say, marking anything unknown with ? instead of guessing.',
        '4. Show you every change as a preview, as one undo step.',
        PLAN_MARK,
      ].join('\n'),
    }
  }
  if (kind === 'edit') {
    const type = TYPES.find((t) => new RegExp(`\\b${t}`, 'i').test(ask)) ?? 'idea'
    const title = quoted(ask) ?? `New ${type}`
    if (step === 0) return { calls: [{ name: 'where_am_i', args: {} }, { name: 'query', args: { kind: 'piece', type: 'plane' } }] }
    const focus = /in focus: (p\d+)/.exec(results.map((r) => r.content).join('\n'))?.[1]
    const plane = focus ?? firstPlane(env)
    if (!plane) return { answer: `There's no plane in ${startupName(env)} to put the ${type} on yet. Add one with + → plane, then ask me again.` }
    if (step === 1) return { calls: [{ name: 'view', args: { piece: plane } }] }
    if (step === 2) return { calls: [{ name: 'change', args: { ops: [{ op: 'create_card', args: { type, plane, title } }], summary: `add ${type} "${title}"` } }], text: `Adding the ${type} to ${plane}.` }
    const made = /\$\w+ → (c\d+)/.exec(last)?.[1]
    if (results[results.length - 1]?.name === 'change' && made) return { answer: `Added the ${type} ${made} ${titleOf(env, made)} on ${plane} ${titleOf(env, plane)}. It's one undo step: ⌘Z takes it back. I didn't link it to anything yet; tell me what it's for and I'll wire it in.` }
    return { answer: `I tried to add the ${type}, but it was refused: ${last.split('\n')[0]}. Nothing changed.` }
  }
  // question
  const words = keywords(ask)
  if (step === 0) return words ? { calls: [{ name: 'search', args: { query: words, limit: 8 } }] } : { calls: [{ name: 'query', args: { kind: 'card', limit: 10 } }] }
  const found = idsIn(results.map((r) => r.content).join('\n'), 'ctd').slice(0, 3)
  if (step === 1 && found.length) return { calls: [{ name: 'get', args: { ids: found, detail: 'concise' } }] }
  if (!found.length) return { answer: `I couldn't find anything about "${words || ask}" in ${startupName(env)}. Try other words, or tell me which plane to look on.` }
  return { answer: [`Here's what ${startupName(env)} has on "${words}":`, ...found.map((s) => `- ${s} ${titleOf(env, s)}`), 'Ask me to open any of them, or to dig into one.'].join('\n') }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const abort = () => {
      const e = new Error('Stopped.')
      e.name = 'AbortError'
      rej(e)
    }
    if (signal?.aborted) return abort()
    if (ms <= 0) return res()
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', on)
      res()
    }, ms)
    const on = () => {
      clearTimeout(t)
      abort()
    }
    signal?.addEventListener('abort', on, { once: true })
  })

// Token counts that look like a real model's (the input mostly cached after the first step), for the UI's numbers.
function fakeUsage(req: ModelRequest, out: string, step: number): Usage {
  const input = estimateTokens(req.messages.map((m) => m.content).join('\n') + JSON.stringify(req.tools))
  const output = estimateTokens(out) + 40
  return { input, cached: step === 0 ? 0 : Math.floor(input * 0.8), output, reasoning: 40 }
}

export function devStubModel(env: Env, o: DevStubOpts = {}): AgentModel & { stream: (req: ModelRequest) => AsyncIterable<ModelEvent>; readonly mark: string } {
  const thinkMs = o.thinkMs ?? 650
  const wordMs = o.wordMs ?? 28
  let n = 0
  async function* stream(req: ModelRequest): AsyncGenerator<ModelEvent> {
    const { ask, step, results, before } = turnOf(req.messages)
    await sleep(thinkMs + (step === 0 ? 250 : 0), req.signal)
    let s = nextStep(env, ask, step, results, before)
    // The loop's last step has the tools off: answer instead of calling.
    if (req.toolChoice === 'none' && 'calls' in s) s = { answer: "I ran out of steps for this turn before finishing. Here's where I got to; ask me to go on." }
    const text = 'answer' in s ? s.answer : (s.text ?? '')
    for (const w of text.match(/\S+\s*/g) ?? []) {
      await sleep(wordMs, req.signal)
      yield { type: 'text', delta: w }
    }
    const toolCalls: ToolCall[] = 'calls' in s ? s.calls.map((c) => ({ id: `stub_${++n}`, name: c.name, args: structuredClone(c.args), rawArgs: JSON.stringify(c.args) })) : []
    for (const call of toolCalls) yield { type: 'tool_call', call }
    const response: ModelResponse = { text, toolCalls, usage: fakeUsage(req, text, step), stop: toolCalls.length ? 'tool_calls' : 'end' }
    yield { type: 'done', response }
  }
  return {
    name: 'dev stub',
    mark: DEV_STUB_MARK,
    stream,
    async respond(req) {
      for await (const ev of stream(req)) if (ev.type === 'done') return ev.response
      throw new Error('the dev stub stopped early')
    },
  }
}
