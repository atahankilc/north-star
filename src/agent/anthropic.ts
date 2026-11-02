// The Anthropic adapter (D-329, docs/specs/agent-claude.md): an `AgentModel` over Claude's Messages API, through the
// official SDK in the browser (`dangerouslyAllowBrowser`: the person's own key, which never leaves their browser but
// for Anthropic). models.ts imports this file lazily, so the SDK is a chunk of its own, fetched only for a Claude chat.
//
// THE KEY lives only in the client inside this module's closure: never a property of the model object, never read from
// storage here, never logged. Every error text that leaves this file passes through `redact` (openai.ts').
//
// APPEND-ONLY (`appendOnly: true`): Claude binds each thinking block to everything before it, and new accounts get a
// 400 on an edited history, so the loop never edits what it sent (loop.ts) and this file renders the same history to
// the same bytes every time:
// - the first system message is `system`; later ones (the map, notes, where, a skill's guide, the last step's note)
//   are Claude's mid-conversation `system` messages where the API takes them (after a user message, before an
//   assistant one or last; models that have them), else text blocks in the user message next to them;
// - an assistant message from Claude goes back as its own content, thinking blocks and all (`providerItems`, tagged
//   `anthropic`); one from another provider as its text and tool calls (no thinking to bind);
// - a step's tool results in one user message (parallel calls stay parallel).
// If a binding is refused anyway (a 400 naming the conversation), one retry asks the API to drop the stale blocks
// (`drop_block`); the answer then lacks that reasoning, but the chat goes on.
//
// CACHING (agent-pipeline.md §6): three breakpoints. The system prompt (tools + system: the same for every chat of a
// workspace); the chat's first map, sent before its first ask (loop.ts), so every new chat in the workspace reads
// tools + system + map from the cache; and automatic caching for the growing tail. An eval run can ask for Claude's
// cache diagnostics (`diagnose`): each request names the previous response, and the answer says where they differed.
//
// CHOICES: adaptive thinking (Claude's current models can't turn it off; older ones get none), the person's effort
// always sent (Opus 5.5 and Haiku 5.5 default to medium, Sonnet 5.5 to high), prompt caching as above, tools strict
// where their schema already fits (openai.ts' `fitsStrict`), eager input streaming (we check every input ourselves:
// a call cut off by max_tokens is an `argsError`), server-side fallbacks on a refusal where the model has them.
//
// THE WEB (D-360): with `req.web`, Claude's `web_search` server tool beside ours (dynamic filtering where the model has
// it, `web_search_20260209`; else the basic one), at most WEB_SEARCHES a response. The searches run on Anthropic's side
// within the response; their blocks (encrypted results and citations) go back unchanged with the rest of the content.
// A long search turn can pause (`pause_turn`): the paused content is sent back as it came and the answer goes on, at
// most PAUSES times, the parts joined into one response.
import Anthropic, { APIConnectionError, APIUserAbortError, AuthenticationError, BadRequestError, InternalServerError, NotFoundError, PermissionDeniedError, RateLimitError } from '@anthropic-ai/sdk'
import type { BetaContentBlock, BetaContentBlockParam, BetaMessage, BetaMessageParam, BetaTool } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { AgentModel, ImagePart, ModelEvent, ModelMessage, ModelRequest, ModelResponse, StopReason, ToolCall, ToolDef, Usage } from './contract'
import { joinSources, type Source, type WebUse } from './contract'
import { fitsStrict, redact, type Effort } from './openai'
import { WEB_SEARCHES } from './web'

export type AnthropicOptions = {
  key: string
  model: string
  effort?: Effort | null
  maxTokens?: number
  // The evals: Claude's cache diagnostics on every request (why a request missed the cache, in `cacheMiss`).
  diagnose?: boolean
  // For tests: a fake fetch, the base URL.
  fetch?: typeof fetch
  baseUrl?: string
}

export type AnthropicErrorKind = 'auth' | 'forbidden' | 'not_found' | 'bad_request' | 'rate_limit' | 'quota' | 'server' | 'network' | 'stream'

export class AnthropicError extends Error {
  constructor(
    message: string,
    public kind: AnthropicErrorKind,
    public status?: number,
  ) {
    super(message)
    this.name = 'AnthropicError'
  }
}

const NEED_KEY = 'An Anthropic key is needed (Settings → the agent).'
// Streamed, so a long answer never hits a timeout; a cap only, not what it costs.
export const MAX_TOKENS = 64_000

const BETA_FALLBACK = 'server-side-fallback-2026-07-01'
const BETA_BINDING = 'thinking-binding-controls-2026-08-01'

// The models with today's request surface (adaptive thinking, effort): the 4.6+ generation. Older ones get neither.
export const modern = (model: string) => /^claude-(opus|sonnet|haiku|fable|mythos)-(4-[6-9]|[5-9])/.test(model)
// Mid-conversation system messages (no beta): not Sonnet 5, not the 4.6/4.7 generation.
export const nativeSystem = (model: string) => /^claude-(opus-5|opus-4-8|fable-5|mythos-5|sonnet-5-5|haiku-5-5)/.test(model)
// Server-side fallbacks on a refusal, the `default` form: the models Anthropic offers it for.
export const fallsBack = (model: string) => /^claude-(opus-5|fable-5|sonnet-5-5)/.test(model)

// Dynamic filtering (the search's results filtered by code before they reach the context): Opus, Sonnet, Fable and
// Mythos from 4.6 on; Haiku and older models get the basic tool, which needs no code execution.
export const filtersWeb = (model: string) => /^claude-(opus|sonnet|fable|mythos)-(4-[6-9]|[5-9])/.test(model)
export const webTool = (model: string) => ({ type: filtersWeb(model) ? ('web_search_20260209' as const) : ('web_search_20250305' as const), name: 'web_search' as const, max_uses: WEB_SEARCHES })
// How many times a paused search turn is taken up again before its answer stands as it is.
export const PAUSES = 3

const EFFORTS = { none: 'low', minimal: 'low', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' } as const

// ---- The request

export function toClaudeTool(def: ToolDef): BetaTool {
  const input_schema = { ...def.parameters, additionalProperties: def.parameters.additionalProperties ?? false } as BetaTool['input_schema']
  const strict = def.strict !== false && fitsStrict(input_schema)
  return { name: def.name, description: def.description, input_schema, ...(strict ? { strict: true } : {}), eager_input_streaming: true }
}

type Out = BetaMessageParam | { role: 'system'; content: string }

const text = (t: string): BetaContentBlockParam => ({ type: 'text', text: t })
const CACHE = { type: 'ephemeral' as const }
const imageBlock = (i: ImagePart) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: i.mediaType, data: i.data } })

// The contract's messages as Claude's `system` + `messages`, the same bytes for the same history (see the head).
export function toClaude(messages: ModelMessage[], model: string): { system?: string; messages: Out[] } {
  const native = nativeSystem(model)
  let system: string | undefined
  const out: Out[] = []
  // The context waiting to be sent, with its tags (a map is a cache breakpoint, once: the chat's first, in user text).
  let pending: { content: string; tag?: string }[] = []
  let mapMarked = false
  const last = () => out[out.length - 1]
  const userBlocks = (): BetaContentBlockParam[] | null => {
    const m = last()
    return m && m.role === 'user' && Array.isArray(m.content) ? (m.content as BetaContentBlockParam[]) : null
  }
  // A user message to add blocks to: the last one when it is a user message, else a new one.
  const user = (): BetaContentBlockParam[] => {
    const have = userBlocks()
    if (have) return have
    const content: BetaContentBlockParam[] = []
    out.push({ role: 'user', content })
    return content
  }
  // The context waiting to be sent, before what comes next (`next`: the role of the message that follows, or null).
  const flush = (next: 'user' | 'assistant' | null) => {
    if (!pending.length) return
    const joined = pending.map((p) => p.content).join('\n\n')
    const hasMap = pending.some((p) => p.tag === 'map')
    pending = []
    const afterUser = last()?.role === 'user'
    if (native && afterUser && next !== 'user') {
      out.push({ role: 'system', content: joined })
      return
    }
    const block = text(joined)
    if (hasMap && !mapMarked) {
      mapMarked = true
      Object.assign(block, { cache_control: CACHE })
    }
    if (next === 'user' || !afterUser) user().push(block)
    else userBlocks()!.push(block)
  }
  messages.forEach((m, i) => {
    if (m.role === 'system') {
      if (i === 0) system = m.content
      else pending.push({ content: m.content, tag: m.tag })
      return
    }
    if (m.role === 'assistant') {
      const blocks: BetaContentBlockParam[] =
        m.providerItems?.length && m.provider === 'anthropic'
          ? (m.providerItems as BetaContentBlockParam[])
          : [...(m.content ? [text(m.content)] : []), ...(m.toolCalls ?? []).map((c): BetaContentBlockParam => ({ type: 'tool_use', id: c.id, name: c.name, input: c.args ?? {} }))]
      if (!blocks.length) return
      flush('assistant')
      out.push({ role: 'assistant', content: blocks })
      return
    }
    flush('user')
    if (m.role === 'user') {
      const blocks = user()
      blocks.push(text(m.content))
      for (const i of m.images ?? []) blocks.push(imageBlock(i))
    } else {
      // A tool result: with the step's others, first in its user message.
      const prev = last()
      const blocks = prev?.role === 'user' && Array.isArray(prev.content) && (prev.content as BetaContentBlockParam[]).every((b) => b.type === 'tool_result') ? (prev.content as BetaContentBlockParam[]) : null
      // A picture with its result (D-327, `look`): text then the image, in the tool result itself.
      const r: BetaContentBlockParam = { type: 'tool_result', tool_use_id: m.callId, content: m.image ? [{ type: 'text', text: m.content || '(empty)' }, imageBlock(m.image)] : m.content || '(empty)' }
      if (blocks) blocks.push(r)
      else out.push({ role: 'user', content: [r] })
    }
  })
  flush(null)
  return { ...(system !== undefined ? { system } : {}), messages: out }
}

// The previous response in this chat (the last assistant message Claude wrote): what the cache diagnostics compare with.
const previousId = (messages: ModelMessage[]) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'assistant') return m.provider === 'anthropic' && m.responseId ? m.responseId : null
  }
  return null
}

export function requestBody(req: ModelRequest, o: Pick<AnthropicOptions, 'model' | 'effort' | 'maxTokens' | 'diagnose'>, binding?: 'drop_block') {
  const { system, messages } = toClaude(req.messages, o.model)
  const now = modern(o.model)
  const betas = [...(fallsBack(o.model) ? [BETA_FALLBACK] : []), ...(binding ? [BETA_BINDING] : [])]
  return {
    model: o.model,
    max_tokens: o.maxTokens ?? MAX_TOKENS,
    // A breakpoint on the system prompt: tools + system, the same for every chat.
    ...(system !== undefined ? { system: [{ type: 'text' as const, text: system, cache_control: CACHE }] } : {}),
    messages: messages as BetaMessageParam[],
    ...(req.tools.length || req.web ? { tools: [...req.tools.map(toClaudeTool), ...(req.web ? [webTool(o.model)] : [])], tool_choice: { type: req.toolChoice === 'none' ? ('none' as const) : ('auto' as const) } } : {}),
    ...(now ? { thinking: { type: 'adaptive' as const, ...(binding ? { block_binding: { prefix_mismatch_behavior: binding } } : {}) } } : {}),
    ...(now && o.effort ? { output_config: { effort: EFFORTS[o.effort] } } : {}),
    cache_control: CACHE,
    ...(o.diagnose ? { diagnostics: { previous_message_id: previousId(req.messages) } } : {}),
    ...(fallsBack(o.model) ? { fallbacks: 'default' as const } : {}),
    ...(betas.length ? { betas } : {}),
  }
}

// ---- The response

const STOPS: Record<string, StopReason> = { end_turn: 'end', stop_sequence: 'end', pause_turn: 'end', tool_use: 'tool_calls', max_tokens: 'length', model_context_window_exceeded: 'length', refusal: 'refusal' }

export function usageOf(u: BetaMessage['usage'] | undefined): Usage {
  if (!u) return { input: 0, output: 0 }
  const read = u.cache_read_input_tokens ?? 0
  const searches = u.server_tool_use?.web_search_requests ?? 0
  return { input: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + read, output: u.output_tokens ?? 0, cached: read, ...(searches ? { searches } : {}) }
}

// What the content searched and read (the results), and the pages its text cites.
export function webOf(content: BetaContentBlock[]): WebUse | undefined {
  const queries: string[] = []
  const read: Source[] = []
  const cited: Source[] = []
  for (const b of content) {
    if (b.type === 'server_tool_use' && b.name === 'web_search') {
      const q = (b.input as { query?: unknown } | null)?.query
      if (typeof q === 'string' && q.trim() && !queries.includes(q)) queries.push(q)
    } else if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r.type === 'web_search_result' && r.url) read.push({ url: r.url, ...(r.title ? { title: r.title } : {}) })
    } else if (b.type === 'text') {
      for (const c of b.citations ?? []) if (c.type === 'web_search_result_location' && c.url) cited.push({ url: c.url, ...(c.title ? { title: c.title } : {}), cited: true })
    }
  }
  return queries.length || read.length || cited.length ? { queries, sources: joinSources([cited, read]) } : undefined
}

export function responseOf(msg: BetaMessage): ModelResponse {
  const content = msg.content as BetaContentBlock[]
  const stop = STOPS[msg.stop_reason ?? ''] ?? 'end'
  const cutOff = msg.stop_reason === 'max_tokens'
  const toolCalls: ToolCall[] = content.flatMap((b): ToolCall[] => {
    if (b.type !== 'tool_use') return []
    const input = b.input as unknown
    const ok = !!input && typeof input === 'object' && !Array.isArray(input)
    const args = ok ? (input as Record<string, unknown>) : {}
    let rawArgs = ''
    try {
      rawArgs = JSON.stringify(input ?? {})
    } catch {
      rawArgs = '{}'
    }
    return [{ id: b.id, name: b.name, args, rawArgs, ...(cutOff ? { argsError: 'the arguments were cut off (the answer hit its length limit)' } : !ok ? { argsError: 'the arguments were not a JSON object' } : {}) }]
  })
  const said = content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  const miss = cacheMissOf(msg)
  const web = webOf(content)
  return { text: said, toolCalls, usage: usageOf(msg.usage), stop: toolCalls.length && !cutOff ? 'tool_calls' : stop, providerItems: content, responseId: msg.id, ...(miss ? { cacheMiss: miss } : {}), ...(web ? { web } : {}) }
}

// The cache diagnostics' verdict in a few words: its type and, when it has one, the tokens after where they differed.
export function cacheMissOf(msg: BetaMessage): string | undefined {
  const d = (msg as { diagnostics?: { cache_miss_reason?: { type?: string; cache_missed_input_tokens?: number } | null } | null }).diagnostics
  if (!d) return undefined
  const r = d.cache_miss_reason
  if (!r) return 'pending'
  return `${r.type ?? 'unknown'}${typeof r.cache_missed_input_tokens === 'number' ? ` ~${r.cache_missed_input_tokens}` : ''}`
}

// ---- Errors

const abortError = () => Object.assign(new Error('stopped'), { name: 'AbortError' })

const bindingRefused = (e: unknown) => e instanceof BadRequestError && /bound to a different conversation/i.test(String(e.message))
// The API's own "retry" failures mid-stream (Sonnet, prioritize-01: "Unable to parse tool parameter JSON from model.
// Please retry your request"): the same request once more.
const askedToRetry = (e: unknown) => /please retry your request|unable to parse tool parameter json/i.test(String((e as Error)?.message ?? e))

export function plainFailure(e: unknown, model: string, key: string): Error {
  const say = (m: string, kind: AnthropicErrorKind, status?: number) => new AnthropicError(redact(m, key), kind, status)
  if (e instanceof APIUserAbortError) return abortError()
  if (e instanceof AuthenticationError) return say("Anthropic didn't accept this key. Check the key in Settings → the agent.", 'auth', 401)
  if (e instanceof PermissionDeniedError) return say(`This key can't use ${model}. Pick another model in the header or in Settings → the agent.`, 'forbidden', 403)
  if (e instanceof NotFoundError) return say(`This key can't use ${model} (Anthropic doesn't know it). Pick another model in the header or in Settings → the agent.`, 'not_found', 404)
  if (e instanceof RateLimitError) return say('Anthropic says slow down (rate limit). Try again in a minute.', 'rate_limit', 429)
  if (e instanceof BadRequestError && /credit balance|billing/i.test(String(e.message)))
    return say("The Anthropic organisation behind your key is out of credit. A Max, Ultra or Team plan's monthly API credits come back next cycle; or add credits in the Console.", 'quota', 400)
  if (e instanceof BadRequestError) return say(`Anthropic refused the request: ${String(e.message)}`, 'bad_request', 400)
  if (e instanceof InternalServerError) return say('Anthropic is overloaded or failing right now. Send again in a moment.', 'server', e.status)
  if (e instanceof APIConnectionError) return say("Couldn't reach Anthropic. Check your connection and send again.", 'network')
  if ((e as Error)?.name === 'AbortError') return abortError()
  return say(`The answer broke off: ${(e as Error)?.message ?? String(e)}`, 'stream')
}

// ---- The model

export type AnthropicModel = AgentModel & { stream: (req: ModelRequest) => AsyncIterable<ModelEvent>; readonly model: string }

const clientOf = (key: string, o: Pick<AnthropicOptions, 'fetch' | 'baseUrl'>) =>
  new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2, ...(o.fetch ? { fetch: o.fetch } : {}), ...(o.baseUrl ? { baseURL: o.baseUrl } : {}) })

export function anthropicModel(o: AnthropicOptions): AnthropicModel {
  // Trimmed: a key pasted with a space or a newline still works.
  const key = typeof o.key === 'string' ? o.key.trim() : ''
  if (!key) throw new AnthropicError(NEED_KEY, 'auth')
  const client = clientOf(key, o)

  // One answer: streamed, a search said as it is asked, a paused search turn taken up again (the parts joined).
  async function* once(req: ModelRequest, binding?: 'drop_block'): AsyncGenerator<ModelEvent> {
    let before: BetaContentBlock[] = []
    let usage: Usage = { input: 0, output: 0 }
    for (let k = 0; ; k++) {
      const body = requestBody(req, o, binding)
      if (before.length) body.messages.push({ role: 'assistant', content: before as BetaContentBlockParam[] })
      const s = client.beta.messages.stream(body as Parameters<typeof client.beta.messages.stream>[0], { signal: req.signal })
      // A web search's query, gathered from its streamed input, said when its block ends.
      const asking = new Map<number, string>()
      for await (const ev of s) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') yield { type: 'text', delta: ev.delta.text }
        else if (ev.type === 'content_block_start' && ev.content_block.type === 'server_tool_use' && ev.content_block.name === 'web_search') asking.set(ev.index, '')
        else if (ev.type === 'content_block_delta' && ev.delta.type === 'input_json_delta' && asking.has(ev.index)) asking.set(ev.index, asking.get(ev.index)! + ev.delta.partial_json)
        else if (ev.type === 'content_block_stop' && asking.has(ev.index)) {
          let q: unknown
          try {
            q = (JSON.parse(asking.get(ev.index) || '{}') as { query?: unknown }).query
          } catch {
            q = undefined
          }
          asking.delete(ev.index)
          if (typeof q === 'string' && q.trim()) yield { type: 'search', query: q }
        }
      }
      const msg = await s.finalMessage()
      const u = usageOf(msg.usage)
      usage = { input: usage.input + u.input, output: usage.output + u.output, cached: (usage.cached ?? 0) + (u.cached ?? 0), ...((usage.searches ?? 0) + (u.searches ?? 0) ? { searches: (usage.searches ?? 0) + (u.searches ?? 0) } : {}) }
      const content = [...before, ...(msg.content as BetaContentBlock[])]
      if (msg.stop_reason === 'pause_turn' && k < PAUSES) {
        before = content
        continue
      }
      yield { type: 'done', response: { ...responseOf({ ...msg, content } as BetaMessage), usage } }
      return
    }
  }

  async function* stream(req: ModelRequest): AsyncGenerator<ModelEvent> {
    let sent = false
    try {
      for await (const ev of once(req)) {
        sent = sent || ev.type === 'text'
        yield ev
      }
    } catch (e) {
      if (req.signal?.aborted) throw abortError()
      // A stale thinking block refused before any output: once more, dropping the stale blocks.
      if (!sent && bindingRefused(e) && modern(o.model)) {
        try {
          yield* once(req, 'drop_block')
          return
        } catch (e2) {
          if (req.signal?.aborted) throw abortError()
          throw plainFailure(e2, o.model, key)
        }
      }
      if (askedToRetry(e)) {
        try {
          yield* once(req)
          return
        } catch (e2) {
          if (req.signal?.aborted) throw abortError()
          throw plainFailure(e2, o.model, key)
        }
      }
      throw plainFailure(e, o.model, key)
    }
  }

  return {
    name: o.model,
    model: o.model,
    provider: 'anthropic',
    appendOnly: true,
    stream,
    async respond(req) {
      for await (const ev of stream(req)) if (ev.type === 'done') return ev.response
      throw new AnthropicError('The answer stopped before it finished.', 'stream')
    },
  }
}

// The models this key can use (GET /v1/models), ids sorted; for Settings' model picker.
export async function listClaudeModels(rawKey: string, o: Pick<AnthropicOptions, 'fetch' | 'baseUrl'> = {}): Promise<string[]> {
  const key = typeof rawKey === 'string' ? rawKey.trim() : ''
  if (!key) throw new AnthropicError(NEED_KEY, 'auth')
  const ids = new Set<string>()
  try {
    for await (const m of clientOf(key, o).models.list({ limit: 100 })) if (typeof m.id === 'string') ids.add(m.id)
  } catch (e) {
    throw plainFailure(e, 'the model list', key)
  }
  return [...ids].sort()
}
