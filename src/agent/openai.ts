// The OpenAI adapter (S12, D-312; docs/specs/agent.md §4.2): an `AgentModel` over the Responses API
// (`POST /v1/responses`, streamed as server-sent events), with `fetch` and no SDK. The loop and the tools never see
// OpenAI's shapes; another provider is another file like this one.
//
// THE KEY is a constructor argument and lives only in this module's closure: never a property of the model object,
// never read from storage here, never logged. Every error text that leaves this file passes through `redact` (OpenAI's
// own 401 message quotes part of the key). The person's own key stays in their browser (CLAUDE.md's hard rule); the
// only place it is sent is OpenAI, in the Authorization header.
//
// CHOICES (each easy to change, all here):
// - Replay, not `previous_response_id`. Every request carries the whole input: the assistant's output items of earlier
//   steps (`providerItems`: reasoning items with their encrypted content, messages, function calls) sent back as they
//   came, with `store: false` and `include: ['reasoning.encrypted_content']`. Why: nothing of the workspace is kept on
//   OpenAI's side beyond what their policy requires (store: false makes previous_response_id impossible), the loop
//   owns the context (it clears old tool results and compacts, §4.3; a stored chain can't be edited), and a saved chat
//   can go on later from the browser alone. Caching works the same: the prefix (tools → instructions → map → chat) is
//   byte-identical between steps. `responseId` is kept for the transcript only.
// - The first system message is `instructions`; later system messages (the map, the agent notes, where the person is,
//   the loop's notes) are `developer` input items, in place, so their order is the loop's.
// - `strict` per tool: OpenAI's strict mode needs every property required and `additionalProperties: false` at every
//   level. The read tools have optional filters, and making each one required-and-nullable is what 1.0 did (every
//   field required-nullable, ~21k chars of schema: agent.md §1 cause 2). So a tool is strict only when its schema
//   already fits (`fitsStrict`: closed objects, all properties required); otherwise `strict: false` and our own checks
//   hold (the read tools refuse bad values with the allowed list; `change` checks args against the op's schema).
// - `parallel_tool_calls: true` (1.0 had false: one call per step, §1 cause 6).
// - `reasoning: { effort }` only for reasoning models (models.ts says which; medium by default).
// - Errors: 401 a clear message about the key; 429 one retry honouring retry-after (not when the account is out of
//   credit), then a message; 5xx one retry; a network failure a message; an abort throws an `AbortError`.
//   A failure inside the stream (`response.failed`, `error`) is a response with `stop: 'error'`, not a throw.
// - Malformed tool-call JSON is `ToolCall.argsError` (the loop tells the model), never a throw.
import type { AgentModel, ModelEvent, ModelMessage, ModelRequest, ModelResponse, StopReason, ToolCall, ToolDef, Usage } from './contract'

export const OPENAI_API = 'https://api.openai.com/v1'

export type Effort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

export type OpenAIOptions = {
  key: string
  model: string
  // Null or left out: no reasoning block (a model that doesn't reason).
  reasoning?: Effort | null
  maxOutputTokens?: number
  // OpenAI's prompt_cache_key: requests with the same key are routed to the same cache (e.g. a hash of the workspace id).
  cacheKey?: string
  // For tests: a fake fetch, the base URL, and how long a retry waits.
  fetch?: typeof fetch
  baseUrl?: string
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

export type OpenAIErrorKind = 'auth' | 'forbidden' | 'not_found' | 'bad_request' | 'rate_limit' | 'quota' | 'server' | 'network' | 'stream'

export class OpenAIError extends Error {
  constructor(
    message: string,
    public kind: OpenAIErrorKind,
    public status?: number,
  ) {
    super(message)
    this.name = 'OpenAIError'
  }
}

// ---- Keys out of every text

const KEYISH = /\b(sk|sess|rk)-[A-Za-z0-9_*.-]{6,}/g

// Any copy of `key` and anything shaped like an OpenAI key, taken out of `text`.
export function redact(text: string, key?: string): string {
  let s = String(text ?? '')
  if (key && key.length >= 4) s = s.split(key).join('[key]')
  return s.replace(KEYISH, '[key]')
}

// ---- The request

// Whether OpenAI's strict mode can take the schema as it is: every object closed and every property required, at every
// level (also inside arrays and anyOf). An open object (`{ type: 'object' }` with no properties) can't be strict.
export function fitsStrict(s: unknown): boolean {
  if (!s || typeof s !== 'object') return true
  const o = s as Record<string, unknown>
  if (Array.isArray(o.anyOf) && !o.anyOf.every(fitsStrict)) return false
  if (o.items && !fitsStrict(o.items)) return false
  const types = Array.isArray(o.type) ? o.type : [o.type]
  if (types.includes('object')) {
    const props = (o.properties ?? null) as Record<string, unknown> | null
    if (!props || o.additionalProperties !== false) return false
    const req = new Set((o.required as string[] | undefined) ?? [])
    if (!Object.keys(props).every((k) => req.has(k))) return false
    if (!Object.values(props).every(fitsStrict)) return false
  }
  return true
}

export type OpenAITool = { type: 'function'; name: string; description: string; parameters: Record<string, unknown>; strict: boolean }

// A tool for OpenAI. Strict only when the schema fits as it is (a tool asking for strict that doesn't fit is sent
// non-strict: our own checks hold); `strict: false` on the def keeps it off.
export function toOpenAITool(def: ToolDef): OpenAITool {
  const parameters = { ...def.parameters, additionalProperties: def.parameters.additionalProperties ?? false }
  const strict = def.strict !== false && fitsStrict(parameters)
  return { type: 'function', name: def.name, description: def.description, parameters, strict }
}

type Item = Record<string, unknown>

// The contract's messages as the Responses API's `instructions` + `input` items.
export function toInput(messages: ModelMessage[]): { instructions?: string; input: Item[] } {
  let instructions: string | undefined
  const input: Item[] = []
  for (const m of messages) {
    if (m.role === 'system') {
      if (instructions === undefined && !input.length) instructions = m.content
      else input.push({ role: 'developer', content: m.content })
    } else if (m.role === 'user') input.push({ role: 'user', content: m.content })
    else if (m.role === 'assistant') {
      if (m.providerItems?.length) {
        // The response's own items, as they came (reasoning items carry their encrypted content).
        for (const it of m.providerItems) input.push(it as Item)
        continue
      }
      if (m.content) input.push({ role: 'assistant', content: m.content })
      for (const c of m.toolCalls ?? []) input.push({ type: 'function_call', call_id: c.id, name: c.name, arguments: c.rawArgs ?? JSON.stringify(c.args ?? {}) })
    } else input.push({ type: 'function_call_output', call_id: m.callId, output: m.content })
  }
  return { ...(instructions !== undefined ? { instructions } : {}), input }
}

export function requestBody(req: ModelRequest, o: Pick<OpenAIOptions, 'model' | 'reasoning' | 'maxOutputTokens' | 'cacheKey'>): Record<string, unknown> {
  const { instructions, input } = toInput(req.messages)
  return {
    model: o.model,
    ...(instructions !== undefined ? { instructions } : {}),
    input,
    ...(req.tools.length ? { tools: req.tools.map(toOpenAITool), tool_choice: req.toolChoice ?? 'auto', parallel_tool_calls: true } : {}),
    // TODO(S12 review): OpenAI may take `reasoning.context` (e.g. 'current_turn', to drop reasoning items of earlier
    // turns server-side); not confirmed in docs we could check offline, so not sent. The loop's compaction already
    // drops old turns' provider items.
    ...(o.reasoning ? { reasoning: { effort: o.reasoning }, include: ['reasoning.encrypted_content'] } : {}),
    ...(o.maxOutputTokens ? { max_output_tokens: o.maxOutputTokens } : {}),
    ...(o.cacheKey ? { prompt_cache_key: o.cacheKey } : {}),
    store: false,
    stream: true,
  }
}

// ---- Server-sent events

// The `data` of each event in a stream (multi-line data joined with \n; comments and other fields skipped).
export async function* sseData(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let finished = false
  const flush = function* (block: string) {
    const data = block
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).replace(/^ /, ''))
    if (data.length) yield data.join('\n')
  }
  try {
    for (;;) {
      if (signal?.aborted) throw abortError()
      const { value, done } = await reader.read()
      if (done) {
        finished = true
        break
      }
      buf += dec.decode(value, { stream: true }).replace(/\r\n?/g, '\n')
      let end: number
      while ((end = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, end)
        buf = buf.slice(end + 2)
        yield* flush(block)
      }
    }
    buf += dec.decode()
    if (buf.trim()) yield* flush(buf)
  } finally {
    // Left early (the response ended, an abort, an error): close the connection instead of leaving it open.
    if (!finished) await reader.cancel().catch(() => undefined)
    reader.releaseLock?.()
  }
}

// ---- Parsing a response

type RawUsage = { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number }; output_tokens_details?: { reasoning_tokens?: number } }

export function usageOf(u: RawUsage | undefined): Usage {
  return { input: u?.input_tokens ?? 0, output: u?.output_tokens ?? 0, cached: u?.input_tokens_details?.cached_tokens ?? 0, reasoning: u?.output_tokens_details?.reasoning_tokens ?? 0 }
}

// A function call's arguments as the contract's ToolCall: parsed, or `argsError` (never thrown).
export function toolCallOf(item: { call_id?: string; id?: string; name?: string; arguments?: string }): ToolCall {
  const rawArgs = item.arguments ?? ''
  const base = { id: item.call_id ?? item.id ?? '', name: item.name ?? '', rawArgs }
  if (!rawArgs.trim()) return { ...base, args: {} }
  try {
    const v = JSON.parse(rawArgs) as unknown
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { ...base, args: {}, argsError: 'the arguments must be a JSON object' }
    return { ...base, args: v as Record<string, unknown> }
  } catch (e) {
    return { ...base, args: {}, argsError: (e as Error).message }
  }
}

type Ev = {
  type: string
  delta?: string
  message?: string
  code?: string
  output_index?: number
  item?: Item & { type?: string; call_id?: string; name?: string; arguments?: string; content?: { type?: string; text?: string; refusal?: string }[] }
  response?: { id?: string; status?: string; usage?: RawUsage; error?: { message?: string; code?: string }; incomplete_details?: { reason?: string } }
}

// Reads the events of one streamed response, yielding the contract's events; the last is always `done`.
export async function* readResponse(datas: AsyncIterable<string>, key?: string): AsyncGenerator<ModelEvent> {
  let text = ''
  let refusal = ''
  // Output items with their output_index, put in that order at the end (the stream may finish them out of order).
  const items: { at: number; seq: number; item: Item }[] = []
  const calls: ToolCall[] = []
  let usage: Usage = usageOf(undefined)
  let responseId: string | undefined
  let stop: StopReason | null = null
  let error: string | undefined
  for await (const data of datas) {
    if (data === '[DONE]') break
    let ev: Ev
    try {
      ev = JSON.parse(data) as Ev
    } catch {
      continue
    }
    if (ev.response?.id) responseId = ev.response.id
    switch (ev.type) {
      case 'response.output_text.delta':
        if (ev.delta) {
          text += ev.delta
          yield { type: 'text', delta: ev.delta }
        }
        break
      case 'response.refusal.delta':
        if (ev.delta) refusal += ev.delta
        break
      case 'response.output_item.done': {
        const it = ev.item
        if (!it) break
        items.push({ at: typeof ev.output_index === 'number' ? ev.output_index : Infinity, seq: items.length, item: it })
        if (it.type === 'function_call') {
          const call = toolCallOf(it)
          calls.push(call)
          yield { type: 'tool_call', call }
        } else if (it.type === 'message' && Array.isArray(it.content)) {
          // The whole text, when no delta came (or a refusal part).
          const whole = it.content.filter((c) => c.type === 'output_text').map((c) => c.text ?? '').join('')
          if (whole && !text) {
            text = whole
            yield { type: 'text', delta: whole }
          }
          for (const c of it.content) if (c.type === 'refusal' && c.refusal && !refusal) refusal = c.refusal
        }
        break
      }
      case 'response.completed':
        usage = usageOf(ev.response?.usage)
        stop = calls.length ? 'tool_calls' : refusal && !text ? 'refusal' : 'end'
        break
      case 'response.incomplete': {
        usage = usageOf(ev.response?.usage)
        const why = ev.response?.incomplete_details?.reason
        stop = why === 'content_filter' ? 'content_filter' : 'length'
        break
      }
      case 'response.failed':
        usage = usageOf(ev.response?.usage)
        stop = 'error'
        error = redact(ev.response?.error?.message ?? 'OpenAI stopped with an error.', key)
        break
      case 'error':
        stop = 'error'
        error = redact(ev.message ?? 'OpenAI stopped with an error.', key)
        break
    }
    if (stop) break
  }
  if (!stop) {
    stop = 'error'
    error = 'The answer stopped before it finished (the connection closed early).'
  }
  // A cut-short response that still asked for calls: the calls are whole (each came with its done event), so they run.
  if (stop === 'length' && calls.length) stop = 'tool_calls'
  const response: ModelResponse = { text: text || (stop === 'refusal' ? refusal : ''), toolCalls: calls, usage, stop, ...(error ? { error } : {}), ...(items.length ? { providerItems: items.sort((a, b) => a.at - b.at || a.seq - b.seq).map((x) => x.item) } : {}), ...(responseId ? { responseId } : {}) }
  yield { type: 'done', response }
}

// ---- HTTP

function abortError(): Error {
  const e = new Error('Stopped.')
  e.name = 'AbortError'
  return e
}

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    if (signal?.aborted) return rej(abortError())
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', on)
      res()
    }, ms)
    const on = () => {
      clearTimeout(t)
      rej(abortError())
    }
    signal?.addEventListener('abort', on, { once: true })
  })

// How long OpenAI asks to wait (retry-after-ms, or retry-after in seconds or as a date), in ms; undefined when it doesn't say.
export function retryAfterMs(h: Headers, now = Date.now()): number | undefined {
  const ms = Number(h.get('retry-after-ms'))
  if (h.get('retry-after-ms') && Number.isFinite(ms)) return Math.max(0, ms)
  const ra = h.get('retry-after')
  if (!ra) return undefined
  const s = Number(ra)
  if (Number.isFinite(s)) return Math.max(0, s * 1000)
  const at = Date.parse(ra)
  return Number.isFinite(at) ? Math.max(0, at - now) : undefined
}

// The longest wait a retry takes; past it, the message says to try later.
export const MAX_RETRY_WAIT = 20_000

async function detailOf(res: Response): Promise<{ message: string; code?: string }> {
  try {
    const j = (await res.json()) as { error?: { message?: string; code?: string; type?: string } }
    return { message: j.error?.message ?? '', code: j.error?.code ?? j.error?.type }
  } catch {
    return { message: '' }
  }
}

async function failure(res: Response, model: string, key: string): Promise<OpenAIError> {
  const d = await detailOf(res)
  const detail = redact(d.message, key)
  const s = res.status
  if (s === 401) return new OpenAIError("OpenAI didn't accept this key. Check the key in Settings → the agent (it may be mistyped, revoked or from another project).", 'auth', s)
  if (s === 403) return new OpenAIError(`This key isn't allowed to do that${detail ? `: ${detail}` : '.'}`, 'forbidden', s)
  if (s === 404) return new OpenAIError(`This key can't use ${model}${detail ? `: ${detail}` : '.'} Pick another model in Settings → the agent.`, 'not_found', s)
  if (s === 429 && (d.code === 'insufficient_quota' || /quota|billing|credit/i.test(d.message))) return new OpenAIError('The OpenAI account behind this key is out of credit (or has hit its spending limit).', 'quota', s)
  if (s === 429) return new OpenAIError(`OpenAI says slow down (rate limit) and the retry didn't help; try again in a minute${detail ? `. ${detail}` : '.'}`, 'rate_limit', s)
  if (s >= 500) return new OpenAIError(`OpenAI had a problem (${s}) and the retry didn't help; try again in a moment.`, 'server', s)
  return new OpenAIError(detail || `OpenAI answered ${s}.`, 'bad_request', s)
}

type Http = { key: string; model: string; fetch: typeof fetch; sleep: NonNullable<OpenAIOptions['sleep']> }

// One request with at most one retry: on 429 (honouring retry-after, never when out of credit) and on 5xx.
async function send(h: Http, url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw abortError()
    let res: Response
    try {
      res = await h.fetch(url, { ...init, signal })
    } catch (e) {
      if (signal?.aborted || (e as Error)?.name === 'AbortError') throw abortError()
      throw new OpenAIError("Couldn't reach OpenAI. Check your connection.", 'network')
    }
    if (res.ok) return res
    const retryable = res.status === 429 || res.status >= 500
    if (attempt === 0 && retryable) {
      if (res.status === 429) {
        const peek = res.clone()
        const d = await detailOf(peek)
        if (d.code === 'insufficient_quota') throw await failure(res, h.model, h.key)
        const wait = retryAfterMs(res.headers) ?? 2000
        if (wait > MAX_RETRY_WAIT) throw new OpenAIError(`OpenAI says slow down (rate limit): it asks to wait ${Math.ceil(wait / 1000)} s. Try again then.`, 'rate_limit', 429)
        await h.sleep(wait, signal)
      } else await h.sleep(1000, signal)
      continue
    }
    throw await failure(res, h.model, h.key)
  }
}

// ---- The model

export type OpenAIModel = AgentModel & { stream: (req: ModelRequest) => AsyncIterable<ModelEvent>; readonly model: string }

export function openaiModel(o: OpenAIOptions): OpenAIModel {
  // Trimmed: a key pasted with a space or a newline still works.
  const key = typeof o.key === 'string' ? o.key.trim() : ''
  if (!key) throw new OpenAIError('An OpenAI key is needed (Settings → the agent).', 'auth')
  const base = o.baseUrl ?? OPENAI_API
  const h: Http = { key, model: o.model, fetch: o.fetch ?? ((...a) => fetch(...a)), sleep: o.sleep ?? defaultSleep }
  async function* stream(req: ModelRequest): AsyncGenerator<ModelEvent> {
    const body = requestBody(req, o)
    const res = await send(h, `${base}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify(body) }, req.signal)
    if (!res.body) throw new OpenAIError('OpenAI answered without a body.', 'stream', res.status)
    try {
      yield* readResponse(sseData(res.body, req.signal), key)
    } catch (e) {
      if (req.signal?.aborted || (e as Error)?.name === 'AbortError') throw abortError()
      if (e instanceof OpenAIError) throw e
      throw new OpenAIError(redact(`The answer broke off: ${(e as Error)?.message ?? e}`, key), 'stream')
    }
  }
  return {
    name: o.model,
    model: o.model,
    stream,
    async respond(req) {
      for await (const ev of stream(req)) if (ev.type === 'done') return ev.response
      throw new OpenAIError('The answer stopped before it finished.', 'stream')
    },
  }
}

// The models this key can use (GET /v1/models), ids sorted; for Settings' model picker (models.ts sorts and marks them).
export async function listModels(rawKey: string, o: Pick<OpenAIOptions, 'fetch' | 'baseUrl' | 'sleep'> & { signal?: AbortSignal } = {}): Promise<string[]> {
  const key = typeof rawKey === 'string' ? rawKey.trim() : ''
  if (!key) throw new OpenAIError('An OpenAI key is needed (Settings → the agent).', 'auth')
  const h: Http = { key, model: 'the model list', fetch: o.fetch ?? ((...a) => fetch(...a)), sleep: o.sleep ?? defaultSleep }
  const res = await send(h, `${o.baseUrl ?? OPENAI_API}/models`, { method: 'GET', headers: { Authorization: `Bearer ${key}` } }, o.signal)
  const j = (await res.json()) as { data?: { id?: string }[] }
  return [...new Set((j.data ?? []).map((m) => m.id).filter((x): x is string => typeof x === 'string'))].sort()
}
