// S12's OpenAI adapter (D-312, src/agent/openai.ts) against a mocked fetch and recorded-style SSE fixtures
// (tests/unit/fixtures/openai/*.sse): the request's shape, streaming (text deltas, function-call arguments assembled,
// parallel calls, reasoning items kept for replay, usage with cached and reasoning tokens), stop reasons, errors (401,
// 429 with one retry honouring retry-after, 500 with one retry, network, abort), malformed arguments → argsError, and
// the key never in a thrown message, a log line or the model object. Also models.ts' picker data and prices.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fitsStrict, listModels, openaiModel, OpenAIError, redact, requestBody, retryAfterMs, toInput, toOpenAITool, type OpenAIOptions } from '../../src/agent/openai'
import { cacheKeyOf, canChat, costOf, effortFor, makeModel, pickerRows, SUGGESTED, KNOWN_MODELS } from '../../src/agent/models'
import { AGENT_TOOLS } from '../../src/agent/tools'
import type { ModelEvent, ModelMessage, ModelRequest, ToolDef } from '../../src/agent/contract'

const KEY = 'sk-test-SECRETSECRET1234567890abcd'
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures/openai', `${name}.sse`), 'utf8')

// The text as a byte stream cut into uneven chunks (events split across reads, \r\n kept when asked).
function streamOf(text: string, o: { crlf?: boolean; chunk?: number } = {}): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(o.crlf ? text.replace(/\n/g, '\r\n') : text)
  const size = o.chunk ?? 37
  let at = 0
  return new ReadableStream({
    pull(c) {
      if (at >= bytes.length) return c.close()
      c.enqueue(bytes.slice(at, at + size))
      at += size
    },
  })
}

const sse = (name: string, o?: { crlf?: boolean; chunk?: number }) => new Response(streamOf(fixture(name), o), { status: 200, headers: { 'content-type': 'text/event-stream' } })
const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

type Call = { url: string; init: RequestInit }
function fakeFetch(...answers: (Response | Error | ((c: Call) => Response | Promise<Response>))[]) {
  const calls: Call[] = []
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const c = { url: String(url), init: init ?? {} }
    calls.push(c)
    const a = answers[Math.min(calls.length - 1, answers.length - 1)]
    if (a instanceof Error) throw a
    return typeof a === 'function' ? a(c) : a
  })
  return { f: f as unknown as typeof fetch, calls }
}

const sleeps: number[] = []
const noSleep = async (ms: number) => void sleeps.push(ms)
const model = (f: typeof fetch, o: Partial<OpenAIOptions> = {}) => openaiModel({ key: KEY, model: 'gpt-5.6-terra', reasoning: 'medium', fetch: f, sleep: noSleep, ...o })

const tool: ToolDef = { name: 'search', description: 'Words over everything.', parameters: { type: 'object', properties: { query: { type: 'string' }, page: { type: 'integer' } }, required: ['query'], additionalProperties: false } }
const closed: ToolDef = { name: 'where_am_i', description: 'Where the person is.', parameters: { type: 'object', properties: {} } }
const req = (messages: ModelMessage[], o: Partial<ModelRequest> = {}): ModelRequest => ({ messages, tools: [tool, closed], ...o })

afterEach(() => {
  sleeps.length = 0
  vi.restoreAllMocks()
})

describe('the request', () => {
  it('has the agreed shape: instructions, input items, tools (strict where it fits), parallel calls, reasoning replay, no storage, streamed', () => {
    const messages: ModelMessage[] = [
      { role: 'system', content: 'SYSTEM PROMPT' },
      { role: 'system', content: 'THE MAP' },
      { role: 'user', content: 'earlier ask' },
      { role: 'assistant', content: 'earlier answer' },
      { role: 'system', content: 'WHERE' },
      { role: 'user', content: 'which problems?' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'call_1', name: 'search', args: { query: 'x' }, rawArgs: '{"query":"x"}' }] },
      { role: 'tool', callId: 'call_1', name: 'search', content: 'RESULT' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'call_2', name: 'where_am_i', args: {} }], providerItems: [{ id: 'rs_9', type: 'reasoning', encrypted_content: 'enc' }, { id: 'fc_9', type: 'function_call', call_id: 'call_2', name: 'where_am_i', arguments: '{}' }], responseId: 'resp_9' },
      { role: 'tool', callId: 'call_2', name: 'where_am_i', content: 'HERE' },
    ]
    expect(requestBody(req(messages), { model: 'gpt-5.6-terra', reasoning: 'medium', cacheKey: 'ws-hash' })).toEqual({
      model: 'gpt-5.6-terra',
      instructions: 'SYSTEM PROMPT',
      input: [
        { role: 'developer', content: 'THE MAP' },
        { role: 'user', content: 'earlier ask' },
        { role: 'assistant', content: 'earlier answer' },
        { role: 'developer', content: 'WHERE' },
        { role: 'user', content: 'which problems?' },
        { type: 'function_call', call_id: 'call_1', name: 'search', arguments: '{"query":"x"}' },
        { type: 'function_call_output', call_id: 'call_1', output: 'RESULT' },
        // Replayed as they came: the reasoning item with its encrypted content, then its call.
        { id: 'rs_9', type: 'reasoning', encrypted_content: 'enc' },
        { id: 'fc_9', type: 'function_call', call_id: 'call_2', name: 'where_am_i', arguments: '{}' },
        { type: 'function_call_output', call_id: 'call_2', output: 'HERE' },
      ],
      tools: [
        { type: 'function', name: 'search', description: 'Words over everything.', parameters: tool.parameters, strict: false },
        { type: 'function', name: 'where_am_i', description: 'Where the person is.', parameters: { type: 'object', properties: {}, additionalProperties: false }, strict: true },
      ],
      tool_choice: 'auto',
      parallel_tool_calls: true,
      reasoning: { effort: 'medium' },
      include: ['reasoning.encrypted_content'],
      prompt_cache_key: 'ws-hash',
      store: false,
      stream: true,
    })
  })

  it('the last step: tools listed, tool_choice none; no tools: no tool fields; a model that does not reason: no reasoning block', () => {
    expect(requestBody(req([{ role: 'user', content: 'x' }], { toolChoice: 'none' }), { model: 'm', reasoning: 'low' })).toMatchObject({ tool_choice: 'none', tools: expect.any(Array) })
    const bare = requestBody({ messages: [{ role: 'user', content: 'x' }], tools: [] }, { model: 'gpt-4.1', reasoning: null })
    expect(Object.keys(bare).sort()).toEqual(['input', 'model', 'store', 'stream'])
  })

  it('strict only where the schema fits as it is (closed objects, every property required, at every level)', () => {
    expect(fitsStrict({ type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false })).toBe(true)
    expect(fitsStrict({ type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false })).toBe(false)
    expect(fitsStrict({ type: 'object' })).toBe(false)
    expect(fitsStrict({ type: 'object', properties: { a: { type: 'array', items: { type: 'object', properties: { b: { type: 'string' } }, required: ['b'] } } }, required: ['a'], additionalProperties: false })).toBe(false)
    expect(toOpenAITool({ ...closed, strict: false }).strict).toBe(false)
    // The agent's own tools: where_am_i strict; the read tools with optional filters and the open `change` not.
    const strict = Object.fromEntries(AGENT_TOOLS.map((t) => [t.def.name, toOpenAITool(t.def).strict]))
    expect(strict).toMatchObject({ where_am_i: true, search: false, query: false, change: false })
  })

  it('a system message after the first input item is a developer item', () => {
    expect(toInput([{ role: 'user', content: 'a' }, { role: 'system', content: 'b' }])).toEqual({ input: [{ role: 'user', content: 'a' }, { role: 'developer', content: 'b' }] })
  })

  it('a key pasted with spaces is trimmed; makeModel sends a prompt_cache_key that is a hash of the workspace id', async () => {
    const { f, calls } = fakeFetch(sse('text'), sse('text'))
    await openaiModel({ key: `  ${KEY}\n`, model: 'm', fetch: f }).respond(req([]))
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`)
    const real = globalThis.fetch
    globalThis.fetch = f
    try {
      const m = await makeModel({ model: 'gpt-5.6-terra', key: KEY, env: { getWs: () => ({ wid: 'ws-secret-id' }) as never, ids: {} as never }, stub: false })
      await m.respond(req([]))
    } finally {
      globalThis.fetch = real
    }
    const body = JSON.parse(String(calls[1].init.body))
    expect(body.prompt_cache_key).toBe(cacheKeyOf('ws-secret-id'))
    expect(body.prompt_cache_key).toMatch(/^ns-[0-9a-f]{8}$/)
    expect(String(calls[1].init.body)).not.toContain('ws-secret-id')
  })

  it('sends the key only in the Authorization header, to OpenAI', async () => {
    const { f, calls } = fakeFetch(sse('text'))
    await model(f).respond(req([{ role: 'user', content: 'x' }]))
    expect(calls[0].url).toBe('https://api.openai.com/v1/responses')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`)
    expect(String(calls[0].init.body)).not.toContain(KEY)
    expect(calls[0].init.method).toBe('POST')
  })
})

describe('streaming', () => {
  it('text deltas in order, the whole text, usage with cached and reasoning tokens, the reasoning item kept', async () => {
    const { f } = fakeFetch(sse('text', { crlf: true, chunk: 11 }))
    const events: ModelEvent[] = []
    for await (const e of model(f).stream(req([{ role: 'user', content: 'x' }]))) events.push(e)
    expect(events.filter((e) => e.type === 'text').map((e) => (e as { delta: string }).delta)).toEqual(['Three problems ', 'have no evidence: ', 'c15, c16, c17.'])
    const done = events[events.length - 1] as Extract<ModelEvent, { type: 'done' }>
    expect(done.type).toBe('done')
    expect(done.response).toMatchObject({ text: 'Three problems have no evidence: c15, c16, c17.', toolCalls: [], stop: 'end', responseId: 'resp_text_1', usage: { input: 5210, cached: 4096, output: 184, reasoning: 128 } })
    expect(done.response.providerItems?.map((i) => (i as { type: string }).type)).toEqual(['reasoning', 'message'])
    expect((done.response.providerItems![0] as { encrypted_content: string }).encrypted_content).toBe('gAAAAenc-text-1')
  })

  it('function-call arguments assembled; two calls in one response (parallel), each a tool_call event, stop tool_calls', async () => {
    const { f } = fakeFetch(sse('tools', { chunk: 5 }))
    const events: ModelEvent[] = []
    for await (const e of model(f).stream(req([{ role: 'user', content: 'x' }]))) events.push(e)
    const calls = events.filter((e) => e.type === 'tool_call').map((e) => (e as { call: unknown }).call)
    expect(calls).toEqual([
      { id: 'call_A', name: 'search', args: { query: 'pricing' }, rawArgs: '{"query":"pricing"}' },
      { id: 'call_B', name: 'get', args: { ids: ['c12', 'p3'] }, rawArgs: '{"ids":["c12","p3"]}' },
    ])
    const r = (events[events.length - 1] as Extract<ModelEvent, { type: 'done' }>).response
    expect([r.stop, r.text, r.usage.cached, r.usage.reasoning, r.providerItems?.length]).toEqual(['tool_calls', '', 11264, 64, 3])
  })

  it('non-ASCII split across reads (mid-character), items put in output_index order, the stream cancelled once the response is done', async () => {
    const bytes = new TextEncoder().encode(fixture('unicode'))
    let at = 0
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (at >= bytes.length) return c.close()
        c.enqueue(bytes.slice(at, at + 3))
        at += 3
      },
      cancel() {
        cancelled = true
      },
    })
    const r = await model(fakeFetch(new Response(body, { status: 200 })).f).respond(req([]))
    expect(r.text).toBe('Ayşe’s bakery: ekmek 🍞 €2,50 — çok iyi')
    expect(r.toolCalls[0].args).toEqual({ query: 'Ayşe’nin fırını €' })
    expect(r.providerItems!.map((i) => (i as { id: string }).id)).toEqual(['msg_u', 'fc_u'])
    expect(cancelled).toBe(true)
  })

  it('malformed arguments become argsError, never a throw', async () => {
    const { f } = fakeFetch(sse('malformed'))
    const r = await model(f).respond(req([{ role: 'user', content: 'x' }]))
    expect(r.toolCalls[0]).toMatchObject({ id: 'call_bad', name: 'get', args: {}, rawArgs: '{"ids": ["c12"' })
    expect(r.toolCalls[0].argsError).toBeTruthy()
    expect(r.toolCalls[1]).toMatchObject({ id: 'call_arr', args: {}, argsError: 'the arguments must be a JSON object' })
    expect(r.stop).toBe('tool_calls')
  })

  it('stop reasons: max_output_tokens → length, content_filter, refusal, response.failed → error (redacted), a stream cut short → error', async () => {
    expect(await model(fakeFetch(sse('incomplete')).f).respond(req([]))).toMatchObject({ stop: 'length', text: 'The list goes on: c1, c2, c3, c', usage: { output: 4000, reasoning: 3900 } })
    expect((await model(fakeFetch(sse('filtered')).f).respond(req([]))).stop).toBe('content_filter')
    expect(await model(fakeFetch(sse('refusal')).f).respond(req([]))).toMatchObject({ stop: 'refusal', text: "I can't help with that." })
    const failed = await model(fakeFetch(sse('failed')).f).respond(req([]))
    expect(failed.stop).toBe('error')
    expect(failed.error).toContain('The server had an error')
    expect(failed.error).not.toContain('LEAKYLEAKY')
    const cut = fixture('text').split('event: response.completed')[0]
    const short = await model(fakeFetch(new Response(streamOf(cut), { status: 200 })).f).respond(req([]))
    expect([short.stop, short.text]).toEqual(['error', 'Three problems have no evidence: c15, c16, c17.'])
  })
})

describe('errors', () => {
  it('401: a clear message about the key, never the key (OpenAI quotes part of it)', async () => {
    const { f, calls } = fakeFetch(json(401, { error: { message: `Incorrect API key provided: ${KEY}. You can find your API key at https://platform.openai.com.`, code: 'invalid_api_key' } }))
    const e = await model(f).respond(req([])).catch((x) => x)
    expect(e).toBeInstanceOf(OpenAIError)
    expect([e.kind, e.status]).toEqual(['auth', 401])
    expect(e.message).toContain("didn't accept this key")
    expect(e.message).not.toContain(KEY)
    expect(calls).toHaveLength(1)
  })

  it('429: one retry after retry-after, then the answer', async () => {
    const { f, calls } = fakeFetch(json(429, { error: { message: 'Rate limit reached', code: 'rate_limit_exceeded' } }, { 'retry-after': '3' }), sse('text'))
    const r = await model(f).respond(req([]))
    expect([calls.length, sleeps, r.stop]).toEqual([2, [3000], 'end'])
  })

  it('429 twice: gives up with a message; out of credit: no retry; a wait too long: no retry', async () => {
    const twice = fakeFetch(json(429, { error: { message: 'Rate limit reached' } }, { 'retry-after-ms': '500' }))
    const e = await model(twice.f).respond(req([])).catch((x) => x)
    expect([e.kind, twice.calls.length, sleeps]).toEqual(['rate_limit', 2, [500]])
    expect(e.message).toContain('slow down')
    sleeps.length = 0
    const quota = fakeFetch(json(429, { error: { message: 'You exceeded your current quota', code: 'insufficient_quota' } }))
    const q = await model(quota.f).respond(req([])).catch((x) => x)
    expect([q.kind, quota.calls.length, sleeps.length]).toEqual(['quota', 1, 0])
    const long = fakeFetch(json(429, { error: { message: 'slow' } }, { 'retry-after': '120' }))
    const l = await model(long.f).respond(req([])).catch((x) => x)
    expect([l.kind, long.calls.length]).toEqual(['rate_limit', 1])
    expect(l.message).toContain('120 s')
  })

  it('500: one retry; twice: a message', async () => {
    const once = fakeFetch(json(500, { error: { message: 'oops' } }), sse('text'))
    expect((await model(once.f).respond(req([]))).stop).toBe('end')
    expect(once.calls).toHaveLength(2)
    const twice = fakeFetch(json(503, {}))
    const e = await model(twice.f).respond(req([])).catch((x) => x)
    expect([e.kind, e.status, twice.calls.length]).toEqual(['server', 503, 2])
  })

  it('404: the key cannot use the model; 400: OpenAI\'s detail, redacted', async () => {
    const nf = await model(fakeFetch(json(404, { error: { message: 'The model `gpt-9` does not exist' } })).f, { model: 'gpt-9' }).respond(req([])).catch((x) => x)
    expect([nf.kind, nf.message.includes("can't use gpt-9")]).toEqual(['not_found', true])
    const bad = await model(fakeFetch(json(400, { error: { message: `Invalid input near ${KEY}` } })).f).respond(req([])).catch((x) => x)
    expect([bad.kind, bad.message.includes(KEY), bad.message.includes('Invalid input')]).toEqual(['bad_request', false, true])
  })

  it('a network failure: a message; an abort: AbortError, before or during the stream', async () => {
    const net = await model(fakeFetch(new TypeError('fetch failed')).f).respond(req([])).catch((x) => x)
    expect([net.kind, net.message]).toEqual(['network', "Couldn't reach OpenAI. Check your connection."])
    const before = new AbortController()
    before.abort()
    expect((await model(fakeFetch(sse('text')).f).respond(req([], { signal: before.signal })).catch((x) => x)).name).toBe('AbortError')
    // Aborted while reading: the stream never finishes on its own.
    const during = new AbortController()
    let pulls = 0
    const endless = new ReadableStream<Uint8Array>({
      pull(c) {
        if (++pulls === 3) during.abort()
        c.enqueue(new TextEncoder().encode(`data: {"type":"response.output_text.delta","delta":"x"}\n\n`))
      },
    })
    const e = await model(fakeFetch(new Response(endless, { status: 200 })).f).respond(req([], { signal: during.signal })).catch((x) => x)
    expect(e.name).toBe('AbortError')
  })

  it('the key is never in a thrown message, a console line or the model object', async () => {
    const log = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'info'), vi.spyOn(console, 'debug')]
    const bodies = [json(401, { error: { message: `bad ${KEY}` } }), json(400, { error: { message: `bad ${KEY}` } }), json(500, { error: { message: KEY } }), new Error(`boom ${KEY}`)]
    for (const b of bodies) {
      const m = model(fakeFetch(b, b).f)
      expect(JSON.stringify(m)).not.toContain(KEY)
      expect(Object.values(m).map(String).join(' ')).not.toContain(KEY)
      const e = await m.respond(req([])).catch((x) => x)
      expect(String(e?.message)).not.toContain(KEY)
      expect(String(e?.stack ?? '')).not.toContain(KEY)
    }
    const errStream = new Response(streamOf(`data: {"type":"error","message":"nope ${KEY}"}\n\n`), { status: 200 })
    const r = await model(fakeFetch(errStream).f).respond(req([]))
    expect([r.stop, r.error?.includes(KEY)]).toEqual(['error', false])
    for (const s of log) for (const c of s.mock.calls) expect(c.map(String).join(' ')).not.toContain(KEY)
    expect(() => openaiModel({ key: '', model: 'x' })).toThrow(/key is needed/)
    expect(() => openaiModel({ key: '   ', model: 'x' })).toThrow(/key is needed/)
  })

  it('redact takes out the key and anything shaped like one', () => {
    expect(redact(`a ${KEY} b sk-proj-abcdefgh12345 c`, KEY)).toBe('a [key] b [key] c')
    expect(redact('nothing here')).toBe('nothing here')
  })

  it('retry-after as seconds, ms or a date', () => {
    expect(retryAfterMs(new Headers({ 'retry-after': '2' }))).toBe(2000)
    expect(retryAfterMs(new Headers({ 'retry-after-ms': '250' }))).toBe(250)
    expect(retryAfterMs(new Headers({ 'retry-after': new Date(10_000).toUTCString() }), 4_000)).toBe(6000)
    expect(retryAfterMs(new Headers())).toBeUndefined()
  })
})

describe('listModels and the picker', () => {
  it('lists the ids this key can use (GET /v1/models), the key only in the header', async () => {
    const { f, calls } = fakeFetch(json(200, { data: [{ id: 'gpt-5.6-terra' }, { id: 'text-embedding-3-small' }, { id: 'gpt-5.4-mini' }, { id: 'gpt-5.6-terra' }] }))
    expect(await listModels(KEY, { fetch: f })).toEqual(['gpt-5.4-mini', 'gpt-5.6-terra', 'text-embedding-3-small'])
    expect([calls[0].url, calls[0].init.method]).toEqual(['https://api.openai.com/v1/models', 'GET'])
    const e = await listModels(KEY, { fetch: fakeFetch(json(401, { error: { message: KEY } })).f, sleep: noSleep }).catch((x) => x)
    expect([e.kind, e.message.includes(KEY)]).toEqual(['auth', false])
  })

  it('picker rows: chat models only, known first, the suggestion pre-selected only when nothing is chosen, the chosen kept', () => {
    const rows = pickerRows(['text-embedding-3-small', 'gpt-4.1', 'gpt-5.4-mini', 'gpt-5.6-terra', 'whisper-1', 'gpt-realtime'])
    expect(rows.map((r) => r.id)).toEqual(['gpt-5.6-terra', 'gpt-5.4-mini', 'gpt-4.1'])
    expect(rows.filter((r) => r.suggested).map((r) => r.id)).toEqual([SUGGESTED])
    expect(rows[0]).toMatchObject({ fit: 'unknown', fitWords: 'not tried yet', effort: 'medium' })
    expect(rows.find((r) => r.id === 'gpt-4.1')!.effort).toBeNull()
    const chosen = pickerRows(['gpt-5.6-terra'], 'gpt-5.4-mini')
    expect([chosen.map((r) => r.id), chosen.some((r) => r.suggested)]).toEqual([['gpt-5.6-terra', 'gpt-5.4-mini'], false])
    expect([canChat('o4-mini'), canChat('gpt-image-1'), canChat('dall-e-3'), canChat('chatgpt-4o-latest'), canChat('gpt-5-codex')]).toEqual([true, false, false, false, true])
  })

  it('effort medium by default for reasoning models; the suggestion is never the cheapest; prices for the report', () => {
    expect([effortFor('gpt-5.6-sol'), effortFor('gpt-5.9-new'), effortFor('o3'), effortFor('gpt-4o'), effortFor('gpt-5-chat-latest')]).toEqual(['medium', 'medium', 'medium', null, null])
    const cheapest = [...KNOWN_MODELS].sort((a, b) => a.price!.input - b.price!.input)[0].id
    expect(SUGGESTED).not.toBe(cheapest)
    expect(costOf('gpt-5.6-terra', { input: 1_000_000, cached: 500_000, output: 100_000 })).toBeCloseTo(0.5 * 2 + 0.5 * 0.2 + 0.1 * 12)
    expect(costOf('openai:gpt-5.6-terra', { input: 1_000_000, output: 0 })).toBeCloseTo(2)
    expect(costOf('unknown-model', { input: 5, output: 5 })).toBe(0)
  })
})
