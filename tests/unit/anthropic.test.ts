// The Anthropic adapter (D-329, src/agent/anthropic.ts) through the real SDK on a fake fetch: Claude's streamed events
// (written from the Messages API's documented event shapes; no recording yet, no real key), the request we send
// (system, the context as mid-conversation system messages or text, thinking and effort, tools, caching, fallbacks),
// thinking blocks replayed verbatim and only to Claude, the same history rendered to the same bytes, a binding refusal
// retried once with drop_block, errors in plain words with no key in them, and the loop's append-only mode.
import { describe, expect, it } from 'vitest'
import { anthropicModel, listClaudeModels, modern, nativeSystem, requestBody, toClaude, AnthropicError } from '../../src/agent/anthropic'
import { makeModel, pickerRows, providerOf, reasons, canChat, claudeId, costOf } from '../../src/agent/models'
import { plainError } from '../../src/agent/ui/errors'
import { runTurn, FINAL_STEP_NOTE } from '../../src/agent/loop'
import { stubModel } from '../../src/agent/stubModel'
import { AGENT_TOOLS } from '../../src/agent/tools'
import type { ModelMessage, ModelRequest } from '../../src/agent/contract'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'

const KEY = 'sk-ant-api03-FAKEKEYFORTESTS0123456789wxyz'
const MODEL = 'claude-opus-5-5'

// ---- A fake Claude

type Ev = Record<string, unknown>
const sseBody = (events: Ev[]) => events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
const stream = (events: Ev[]) => new Response(sseBody(events), { status: 200, headers: { 'content-type': 'text/event-stream', 'request-id': 'req_test' } })
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } })

const start = (usage = { input_tokens: 100, output_tokens: 1, cache_read_input_tokens: 40, cache_creation_input_tokens: 10 }) => ({
  type: 'message_start',
  message: { id: 'msg_1', type: 'message', role: 'assistant', model: MODEL, content: [], stop_reason: null, stop_sequence: null, usage },
})
const thinking = (i: number, sig = 'SIG-1') => [
  { type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: i, delta: { type: 'signature_delta', signature: sig } },
  { type: 'content_block_stop', index: i },
]
const textBlock = (i: number, ...parts: string[]) => [
  { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } },
  ...parts.map((t) => ({ type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: t } })),
  { type: 'content_block_stop', index: i },
]
const toolBlock = (i: number, id: string, name: string, input: unknown) => [
  { type: 'content_block_start', index: i, content_block: { type: 'tool_use', id, name, input: {} } },
  { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } },
  { type: 'content_block_stop', index: i },
]
const end = (stop: string, output = 20) => [{ type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: output } }, { type: 'message_stop' }]

type Call = { url: string; body: Record<string, unknown>; headers: Headers }
function fakeFetch(...answers: (Response | Error)[]) {
  const calls: Call[] = []
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((v, k) => headers.set(k, v))
    calls.push({ url, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}, headers })
    const a = answers.shift()
    if (!a) throw new Error('no more answers')
    if (a instanceof Error) throw a
    return a
  }) as typeof fetch
  return { f, calls }
}

const ask = (messages: ModelMessage[], o: Partial<ModelRequest> = {}): ModelRequest => ({ messages, tools: AGENT_TOOLS.slice(0, 2).map((t) => t.def), ...o })

describe('the request', () => {
  it('system first, the ask as user text, thinking adaptive, effort, tools, caching, fallbacks, the browser header', async () => {
    const { f, calls } = fakeFetch(stream([start(), ...textBlock(0, 'Hel', 'lo'), ...end('end_turn')]))
    const m = anthropicModel({ key: ` ${KEY}\n`, model: MODEL, effort: 'high', fetch: f })
    expect([m.name, m.provider, m.appendOnly]).toEqual([MODEL, 'anthropic', true])
    const deltas: string[] = []
    let done
    for await (const ev of m.stream(ask([{ role: 'system', content: 'PROMPT' }, { role: 'user', content: 'hi' }]))) {
      if (ev.type === 'text') deltas.push(ev.delta)
      else done = ev.response
    }
    expect(deltas).toEqual(['Hel', 'lo'])
    expect(done).toMatchObject({ text: 'Hello', toolCalls: [], stop: 'end', usage: { input: 150, output: 20, cached: 40 }, responseId: 'msg_1' })
    const [c] = calls
    expect(c.url).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/messages/)
    // The key only in the auth header (SDK 1.x sends it as `authorization`; older ones `x-api-key`), never in the body.
    expect(`${c.headers.get('authorization') ?? ''} ${c.headers.get('x-api-key') ?? ''}`).toContain(KEY)
    expect(JSON.stringify(c.body)).not.toContain('FAKEKEY')
    expect(c.headers.get('anthropic-dangerous-direct-browser-access')).toBe('true')
    expect(c.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01')
    expect(c.body).toMatchObject({
      model: MODEL,
      system: 'PROMPT',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      cache_control: { type: 'ephemeral' },
      fallbacks: 'default',
      tool_choice: { type: 'auto' },
      stream: true,
    })
    const tools = c.body.tools as { name: string; input_schema: unknown; eager_input_streaming?: boolean }[]
    expect(tools.map((t) => t.name)).toEqual(AGENT_TOOLS.slice(0, 2).map((t) => t.def.name))
    expect(tools.every((t) => t.eager_input_streaming)).toBe(true)
  })

  it('the last step asks for text with the tools still listed; an older model gets no thinking, effort or fallbacks', () => {
    const last = requestBody(ask([{ role: 'system', content: 'P' }, { role: 'user', content: 'x' }], { toolChoice: 'none' }), { model: MODEL, effort: 'medium' })
    expect(last.tool_choice).toEqual({ type: 'none' })
    const old = requestBody(ask([{ role: 'user', content: 'x' }]), { model: 'claude-haiku-4-5', effort: 'medium' })
    expect(old).not.toHaveProperty('thinking')
    expect(old).not.toHaveProperty('output_config')
    expect(old).not.toHaveProperty('fallbacks')
    expect([modern('claude-haiku-4-5'), modern('claude-sonnet-4-6'), modern('claude-haiku-5-5'), modern('claude-fable-5-1')]).toEqual([false, true, true, true])
    expect([nativeSystem('claude-sonnet-5'), nativeSystem('claude-sonnet-5-5'), nativeSystem('claude-opus-5-5')]).toEqual([false, true, true])
  })
})

describe('the history as Claude reads it (append-only: the same bytes every time)', () => {
  const callTurn: ModelMessage[] = [
    { role: 'system', content: 'PROMPT' },
    { role: 'user', content: 'list the rivals' },
    { role: 'system', tag: 'map', content: '# Workspace map' },
    { role: 'system', tag: 'where', content: '## Where the person is now' },
    { role: 'assistant', content: 'Looking.', toolCalls: [{ id: 'tu_1', name: 'query', args: { type: 'competitor' } }, { id: 'tu_2', name: 'get', args: { ids: ['c1'] } }], providerItems: [{ type: 'thinking', thinking: '', signature: 'SIG-A' }, { type: 'text', text: 'Looking.' }, { type: 'tool_use', id: 'tu_1', name: 'query', input: { type: 'competitor' } }, { type: 'tool_use', id: 'tu_2', name: 'get', input: { ids: ['c1'] } }], provider: 'anthropic' },
    { role: 'tool', callId: 'tu_1', name: 'query', content: 'c1 Acme' },
    { role: 'tool', callId: 'tu_2', name: 'get', content: 'c1 Acme, Germany' },
    { role: 'system', tag: 'final', content: FINAL_STEP_NOTE },
    { role: 'assistant', content: 'One rival: c1 "Acme".', providerItems: [{ type: 'thinking', thinking: '', signature: 'SIG-B' }, { type: 'text', text: 'One rival: c1 "Acme".' }], provider: 'anthropic' },
  ]

  it('context after the ask as one system message; tool results together; the final note before the answer; thinking verbatim', () => {
    const { system, messages } = toClaude(callTurn, MODEL)
    expect(system).toBe('PROMPT')
    expect(messages.map((m) => m.role)).toEqual(['user', 'system', 'assistant', 'user', 'system', 'assistant'])
    expect(messages[1]).toEqual({ role: 'system', content: '# Workspace map\n\n## Where the person is now' })
    expect(messages[2].content).toEqual(callTurn[4].role === 'assistant' ? callTurn[4].providerItems : null)
    expect(messages[3].content).toEqual([
      { type: 'tool_result', tool_use_id: 'tu_1', content: 'c1 Acme' },
      { type: 'tool_result', tool_use_id: 'tu_2', content: 'c1 Acme, Germany' },
    ])
    expect(messages[4]).toEqual({ role: 'system', content: FINAL_STEP_NOTE })
  })

  it('a step later, a turn later: what was sent before is the same prefix, byte for byte', () => {
    const firstStep = toClaude(callTurn.slice(0, 4), MODEL)
    const later = toClaude([...callTurn, { role: 'user', content: 'and in France?' }, { role: 'system', tag: 'where', content: '## Where (again)' }], MODEL)
    expect(JSON.stringify(later.messages.slice(0, 2))).toBe(JSON.stringify(firstStep.messages))
    expect(JSON.stringify(later.messages.slice(0, 6))).toBe(JSON.stringify(toClaude(callTurn, MODEL).messages))
    expect(later.messages.slice(6)).toEqual([{ role: 'user', content: [{ type: 'text', text: 'and in France?' }] }, { role: 'system', content: '## Where (again)' }])
  })

  it('a model without mid-conversation system messages gets the context as text, in place', () => {
    const { messages } = toClaude(callTurn, 'claude-sonnet-5')
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(messages[0].content).toEqual([{ type: 'text', text: 'list the rivals' }, { type: 'text', text: '# Workspace map\n\n## Where the person is now' }])
    expect((messages[2].content as { type: string }[]).map((b) => b.type)).toEqual(['tool_result', 'tool_result', 'text'])
  })

  it("another provider's items never go to Claude: its text and calls do; a compaction's note leads the next ask", () => {
    const { messages } = toClaude(
      [
        { role: 'system', content: 'P' },
        { role: 'system', tag: 'compact', content: 'Earlier in this chat: 2 turns compacted' },
        { role: 'user', content: 'ask' },
        { role: 'assistant', content: 'calling', toolCalls: [{ id: 'call_1', name: 'search', args: { query: 'x' } }], providerItems: [{ type: 'reasoning', encrypted_content: 'OPENAI' }], provider: 'openai' },
        { role: 'tool', callId: 'call_1', name: 'search', content: 'found' },
      ],
      MODEL,
    )
    expect(JSON.stringify(messages)).not.toContain('OPENAI')
    expect(messages[0]).toEqual({ role: 'user', content: [{ type: 'text', text: 'Earlier in this chat: 2 turns compacted' }, { type: 'text', text: 'ask' }] })
    expect(messages[1]).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'calling' }, { type: 'tool_use', id: 'call_1', name: 'search', input: { query: 'x' } }] })
  })
})

describe('the response', () => {
  it('thinking, text and parallel calls: the calls parsed, the whole content kept to send back', async () => {
    const { f } = fakeFetch(stream([start(), ...thinking(0), ...textBlock(1, 'Two reads.'), ...toolBlock(2, 'tu_1', 'search', { query: 'pricing' }), ...toolBlock(3, 'tu_2', 'get', { ids: ['c1'] }), ...end('tool_use')]))
    const r = await anthropicModel({ key: KEY, model: MODEL, effort: 'medium', fetch: f }).respond(ask([{ role: 'user', content: 'x' }]))
    expect(r.stop).toBe('tool_calls')
    expect(r.toolCalls.map((c) => [c.id, c.name, c.args, c.argsError])).toEqual([
      ['tu_1', 'search', { query: 'pricing' }, undefined],
      ['tu_2', 'get', { ids: ['c1'] }, undefined],
    ])
    expect((r.providerItems as { type: string; signature?: string }[]).map((b) => b.type)).toEqual(['thinking', 'text', 'tool_use', 'tool_use'])
    expect((r.providerItems as { signature?: string }[])[0].signature).toBe('SIG-1')
  })

  it('a call cut off by max_tokens is an argsError (never run as if whole); a refusal says refusal', async () => {
    const { f } = fakeFetch(stream([start(), ...toolBlock(0, 'tu_1', 'change', { ops: [] }), ...end('max_tokens')]), stream([start(), ...textBlock(0, 'I can’t help with that.'), ...end('refusal')]))
    const m = anthropicModel({ key: KEY, model: MODEL, fetch: f })
    const cut = await m.respond(ask([{ role: 'user', content: 'x' }]))
    expect(cut.toolCalls[0].argsError).toMatch(/cut off/)
    expect(cut.stop).toBe('length')
    expect((await m.respond(ask([{ role: 'user', content: 'y' }]))).stop).toBe('refusal')
  })
})

describe('the API asks to retry', () => {
  it('a mid-stream "Unable to parse tool parameter JSON … Please retry your request": the same request once more', async () => {
    const broke = { type: 'error', error: { type: 'invalid_request_error', message: 'Unable to parse tool parameter JSON from model. Please retry your request or adjust your prompt.' } }
    const { f, calls } = fakeFetch(stream([start(), broke as never]), stream([start(), ...textBlock(0, 'ok'), ...end('end_turn')]))
    const r = await anthropicModel({ key: KEY, model: MODEL, fetch: f }).respond(ask([{ role: 'user', content: 'x' }]))
    expect(r.text).toBe('ok')
    expect(calls.length).toBe(2)
  })
})

describe('errors', () => {
  const err = (status: number, type: string, message: string) => json(status, { type: 'error', error: { type, message } })

  it('a refused key, a model it cannot use, out of credit: plain words, never the key', async () => {
    for (const [res, want, plain] of [
      [err(401, 'authentication_error', `invalid x-api-key ${KEY}`), /didn't accept this key/, 'your key was refused — check it in Settings → the agent'],
      [err(404, 'not_found_error', 'model: claude-nope'), /can't use claude-nope/, /pick another model/],
      [err(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API.'), /out of credit/, /monthly API credits come back next cycle/],
    ] as const) {
      const { f } = fakeFetch(res)
      const model = String(want).includes('nope') ? 'claude-nope' : MODEL
      const e = await anthropicModel({ key: KEY, model, fetch: f }).respond(ask([{ role: 'user', content: 'x' }])).catch((x) => x)
      expect(e).toBeInstanceOf(AnthropicError)
      expect(e.message).toMatch(want)
      expect(e.message).not.toContain('FAKEKEY')
      const said = plainError(`the model failed: ${e.message}`).text
      if (typeof plain === 'string') expect(said).toBe(plain)
      else expect(said).toMatch(plain)
    }
  })

  it('a stale thinking block refused: once more with drop_block, and the answer comes', async () => {
    const { f, calls } = fakeFetch(err(400, 'invalid_request_error', 'messages.3.content.0: Invalid `signature` in `thinking` block. The block is bound to a different conversation.'), stream([start(), ...textBlock(0, 'ok'), ...end('end_turn')]))
    const r = await anthropicModel({ key: KEY, model: MODEL, fetch: f }).respond(ask([{ role: 'user', content: 'x' }]))
    expect(r.text).toBe('ok')
    expect(calls).toHaveLength(2)
    expect(calls[1].body.thinking).toEqual({ type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } })
    expect(calls[1].headers.get('anthropic-beta')).toContain('thinking-binding-controls-2026-08-01')
  })

  it('no key: a clear error before any request; the model list too', async () => {
    expect(() => anthropicModel({ key: '  ', model: MODEL })).toThrow(/An Anthropic key is needed/)
    await expect(listClaudeModels('')).rejects.toThrow(/An Anthropic key is needed/)
    const { f } = fakeFetch(json(200, { data: [{ type: 'model', id: 'claude-sonnet-5-5', display_name: 'S', created_at: '2026-01-01T00:00:00Z' }, { type: 'model', id: 'claude-opus-5-5', display_name: 'O', created_at: '2026-01-01T00:00:00Z' }], has_more: false, first_id: 'a', last_id: 'b' }))
    expect(await listClaudeModels(KEY, { fetch: f })).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5'])
  })
})

describe('models and the picker', () => {
  it('ids carry their provider; Claude reasons; prices; makeModel picks the adapter', async () => {
    expect([providerOf('gpt-5.6-terra'), providerOf('anthropic:claude-opus-5-5')]).toEqual(['openai', 'anthropic'])
    expect([reasons('anthropic:claude-opus-5-5'), reasons('anthropic:claude-haiku-4-5'), canChat(claudeId('claude-opus-5-5'))]).toEqual([true, false, true])
    expect(costOf('anthropic:claude-opus-5-5', { input: 1_000_000, output: 0, cached: 0 })).toBe(4)
    // By the bare name the adapter reports too (an eval prices its attempts by it: Claude's runs showed $0).
    expect(costOf('claude-opus-5-5', { input: 1_000_000, output: 0, cached: 0 })).toBe(4)
    const rows = pickerRows(['gpt-5.6-terra', 'anthropic:claude-opus-5-5'], undefined, 'anthropic:claude-opus-5-5')
    expect(rows.find((r) => r.suggested)?.id).toBe('anthropic:claude-opus-5-5')
    const m = await makeModel({ model: 'anthropic:claude-sonnet-5-5', key: KEY, env: { getWs: () => ({ wid: 'w' }) as never, ids: {} as never }, stub: false, effort: 'low' })
    expect([m.name, m.provider, m.appendOnly]).toEqual(['claude-sonnet-5-5', 'anthropic', true])
    expect(JSON.stringify(m)).not.toContain('FAKEKEY')
  })
})

describe("the loop's append-only mode", () => {
  const env = () => makeEnv(loadFixture('medium'))
  const claudeLike = (script: Parameters<typeof stubModel>[0]) => ({ ...stubModel(script), appendOnly: true, provider: 'anthropic' as const })

  it('every request starts with what the one before sent; the history keeps the context; nothing cleared', async () => {
    const big = { def: { name: 'big', description: 'big', parameters: { type: 'object' as const, properties: {} } }, kind: 'read' as const, run: async () => ({ ok: true, text: `R ${'y'.repeat(2000)}` }) }
    const m = claudeLike([...Array.from({ length: 14 }, () => ({ calls: [{ name: 'big', args: {} }] })), { answer: 'done' }])
    const { history } = await runTurn(m, env(), [big], [], 'go')
    for (let i = 1; i < m.seen.length; i++) expect(m.seen[i].messages.slice(0, m.seen[i - 1].messages.length)).toEqual(m.seen[i - 1].messages)
    // The head is the prompt alone; the ask, then the map and where, kept in the history.
    expect(m.seen[0].messages.map((x) => x.role)).toEqual(['system', 'user', 'system', 'system'])
    expect(history.slice(0, 3).map((x) => (x.role === 'system' ? x.tag : x.role))).toEqual(['user', 'map', 'where'])
    expect(history.filter((x) => x.role === 'tool').every((x) => x.content.startsWith('R '))).toBe(true)
    // Claude's own items are tagged as Claude's.
    expect(m.seen.length).toBe(15)
  })

  it('the next turn: the map only when it changed, where again; the last step note kept', async () => {
    const e = env()
    const m1 = claudeLike([{ answer: 'one' }])
    const t1 = await runTurn(m1, e, AGENT_TOOLS, [], 'first')
    const m2 = claudeLike([{ answer: 'two' }])
    const t2 = await runTurn(m2, e, AGENT_TOOLS, t1.history, 'second')
    expect(m2.seen[0].messages.slice(1, 1 + t1.history.length)).toEqual(t1.history)
    expect(t2.history.slice(t1.history.length).map((x) => (x.role === 'system' ? x.tag : x.role))).toEqual(['user', 'where', 'assistant'])
    const m3 = claudeLike([{ calls: [{ name: 'where_am_i', args: {} }] }, { answer: 'three' }])
    const t3 = await runTurn(m3, e, AGENT_TOOLS, t2.history, 'third', { stepBudget: 2 })
    expect(t3.history.some((x) => x.role === 'system' && x.tag === 'final' && x.content === FINAL_STEP_NOTE)).toBe(true)
  })

  it('compaction keeps no turn whole: every turn its ask and answer as text, no calls or provider items', async () => {
    const turnOf = (i: number): ModelMessage[] => [
      { role: 'user', content: `ask ${i}` },
      { role: 'system', tag: 'where', content: 'where' },
      { role: 'assistant', content: '', toolCalls: [{ id: `k${i}`, name: 'get', args: {} }], providerItems: [{ type: 'thinking', signature: 'S' }], provider: 'anthropic' },
      { role: 'tool', callId: `k${i}`, name: 'get', content: 'r'.repeat(3000) },
      { role: 'assistant', content: `answer ${i}`, providerItems: [{ type: 'thinking', signature: 'S' }, { type: 'text', text: `answer ${i}` }], provider: 'anthropic' },
    ]
    const history = Array.from({ length: 4 }, (_, i) => turnOf(i)).flat()
    const m = claudeLike([{ answer: 'ok' }])
    await runTurn(m, env(), AGENT_TOOLS, history, 'next', { compactAt: 2000 })
    const sent = m.seen[0].messages
    expect(JSON.stringify(sent)).not.toContain('"signature"')
    expect(sent.filter((x) => x.role === 'tool')).toEqual([])
    expect(sent.filter((x) => x.role === 'user').map((x) => x.content)).toEqual(['ask 0', 'ask 1', 'ask 2', 'ask 3', 'next'])
  })
})
