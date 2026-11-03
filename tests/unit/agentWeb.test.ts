// The web (D-360, src/agent/web.ts): both adapters offer their provider's own web search on a request with `web`
// (OpenAI's hosted `web_search`, Claude's `web_search` server tool), capped per response; what was searched comes as
// `search` events, the pages read and cited as `web.sources` (cited first, one per url); the searches are counted in
// the usage and its cost; the search's own items go back unchanged on the next request; a paused Claude search turn is
// taken up again. The loop offers the web on every step (off with `web: false`) and gathers the turn's sources; a
// saved chat keeps them, http(s) only, capped. Shapes from the providers' docs (2026-11), no real key.
import { describe, expect, it } from 'vitest'
import { anthropicModel, requestBody as claudeBody, webOf, webTool, PAUSES } from '../../src/agent/anthropic'
import { openaiModel, requestBody as openaiBody } from '../../src/agent/openai'
import { costOf } from '../../src/agent/models'
import { runTurn } from '../../src/agent/loop'
import { stubModel } from '../../src/agent/stubModel'
import { AGENT_TOOLS } from '../../src/agent/tools'
import { keptTurn } from '../../src/agent/chats'
import { joinSources, type AgentModel, type ModelEvent, type ModelMessage, type ModelRequest, type ModelResponse } from '../../src/agent/contract'
import { siteOf, WEB_SEARCHES, SEARCH_PRICE } from '../../src/agent/web'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'

const ASK: ModelMessage[] = [
  { role: 'system', content: 'You are the agent.' },
  { role: 'user', content: 'What does Getir charge for delivery now?' },
]
const req = (o: Partial<ModelRequest> = {}): ModelRequest => ({ messages: ASK, tools: AGENT_TOOLS.slice(0, 2).map((t) => t.def), ...o })

async function drain(it: AsyncIterable<ModelEvent>) {
  const events: ModelEvent[] = []
  for await (const e of it) events.push(e)
  return { events, response: (events[events.length - 1] as Extract<ModelEvent, { type: 'done' }>).response }
}

// ---- OpenAI

const OKEY = 'sk-test-SECRETSECRET1234567890abcd'
const sse = (events: Record<string, unknown>[]) => new Response(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } })
function openaiFetch(...answers: Response[]) {
  const bodies: Record<string, unknown>[] = []
  const f = (async (_u: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    return answers.shift()!
  }) as typeof fetch
  return { f, bodies }
}
const SEARCH_ITEM = {
  type: 'web_search_call',
  id: 'ws_1',
  status: 'completed',
  action: { type: 'search', query: 'Getir delivery fee 2026', sources: [{ type: 'url', url: 'https://getir.com/fees' }, { type: 'url', url: 'https://news.example.com/getir' }] },
}
const ANSWER_ITEM = {
  type: 'message',
  id: 'msg_1',
  role: 'assistant',
  content: [{ type: 'output_text', text: 'Getir charges €1.99 ([Getir](https://getir.com/fees)).', annotations: [{ type: 'url_citation', url: 'https://getir.com/fees', title: 'Getir fees', start_index: 0, end_index: 10 }] }],
}
const openaiAnswer = () =>
  sse([
    { type: 'response.created', response: { id: 'resp_1' } },
    { type: 'response.output_item.done', output_index: 0, item: SEARCH_ITEM },
    { type: 'response.output_text.delta', output_index: 1, delta: 'Getir charges €1.99 ([Getir](https://getir.com/fees)).' },
    { type: 'response.output_item.done', output_index: 1, item: ANSWER_ITEM },
    { type: 'response.completed', response: { id: 'resp_1', usage: { input_tokens: 900, output_tokens: 40 } } },
  ])

describe('OpenAI: the hosted web_search', () => {
  it('offered with web, capped, its sources asked for; not without', () => {
    const on = openaiBody(req({ web: true }), { model: 'gpt-5.6-terra', reasoning: 'medium' })
    expect((on.tools as { type: string }[]).map((t) => t.type)).toEqual(['function', 'function', 'web_search'])
    expect(on.max_tool_calls).toBe(WEB_SEARCHES)
    expect(openaiBody(req({ web: true, searches: 15 }), { model: 'gpt-5.6-terra', reasoning: 'medium' }).max_tool_calls).toBe(15)
    expect(on.include).toEqual(['web_search_call.action.sources', 'reasoning.encrypted_content'])
    expect(on.store).toBe(false)
    const off = openaiBody(req(), { model: 'gpt-5.6-terra', reasoning: 'medium' })
    expect((off.tools as { type: string }[]).some((t) => t.type === 'web_search')).toBe(false)
    expect(off.max_tool_calls).toBeUndefined()
    expect(off.include).toEqual(['reasoning.encrypted_content'])
    // Only the web: the tools list holds it alone.
    const alone = openaiBody({ messages: ASK, tools: [], web: true }, { model: 'gpt-5.6-terra' })
    expect(alone.tools).toEqual([{ type: 'web_search' }])
  })

  it('the search said as an event; sources cited first, one per url; counted; its item kept for the next request', async () => {
    const { f, bodies } = openaiFetch(openaiAnswer(), openaiAnswer())
    const m = openaiModel({ key: OKEY, model: 'gpt-5.6-terra', fetch: f })
    const { events, response } = await drain(m.stream(req({ web: true })))
    expect(events.filter((e) => e.type === 'search')).toEqual([{ type: 'search', query: 'Getir delivery fee 2026' }])
    expect(response.web).toEqual({
      queries: ['Getir delivery fee 2026'],
      sources: [{ url: 'https://getir.com/fees', title: 'Getir fees', cited: true }, { url: 'https://news.example.com/getir' }],
    })
    expect(response.usage.searches).toBe(1)
    expect(response.providerItems).toEqual([SEARCH_ITEM, ANSWER_ITEM])
    // Sent back as it came, with the next ask.
    await drain(m.stream({ messages: [...ASK, { role: 'assistant', content: response.text, providerItems: response.providerItems, provider: 'openai' }, { role: 'user', content: 'and Flink?' }], tools: [], web: true }))
    expect((bodies[1].input as unknown[]).slice(1, 3)).toEqual([SEARCH_ITEM, ANSWER_ITEM])
  })
})

// ---- Claude

const AKEY = 'sk-ant-api03-FAKEKEYFORTESTS0123456789wxyz'
const AMODEL = 'claude-opus-5-5'
const msgStart = (id: string, usage: Record<string, unknown> = { input_tokens: 500, output_tokens: 1 }) => ({ type: 'message_start', message: { id, type: 'message', role: 'assistant', model: AMODEL, content: [], stop_reason: null, stop_sequence: null, usage } })
const searchBlocks = (i: number, id: string, query: string, url: string, title: string) => [
  { type: 'content_block_start', index: i, content_block: { type: 'server_tool_use', id, name: 'web_search', input: {} } },
  { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ query }) } },
  { type: 'content_block_stop', index: i },
  { type: 'content_block_start', index: i + 1, content_block: { type: 'web_search_tool_result', tool_use_id: id, content: [{ type: 'web_search_result', url, title, encrypted_content: 'ENC', page_age: null }] } },
  { type: 'content_block_stop', index: i + 1 },
]
const citedText = (i: number, text: string, url: string, title: string) => [
  { type: 'content_block_start', index: i, content_block: { type: 'text', text: '', citations: [] } },
  { type: 'content_block_delta', index: i, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url, title, encrypted_index: 'IDX', cited_text: 'fee €1.99' } } },
  { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text } },
  { type: 'content_block_stop', index: i },
]
const msgEnd = (stop: string, searches: number) => [{ type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 30, server_tool_use: { web_search_requests: searches } } }, { type: 'message_stop' }]
function claudeFetch(...answers: Response[]) {
  const bodies: Record<string, unknown>[] = []
  const f = (async (_u: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    const a = answers.shift()
    if (!a) throw new Error('no more answers')
    return a
  }) as typeof fetch
  return { f, bodies }
}

describe('Claude: the web_search server tool', () => {
  it('dynamic filtering where the model has it, the basic tool elsewhere; capped; offered only with web', () => {
    expect(webTool('claude-opus-5-5')).toEqual({ type: 'web_search_20260209', name: 'web_search', max_uses: WEB_SEARCHES })
    expect(webTool('claude-opus-5-5', 15).max_uses).toBe(15)
    expect(webTool('claude-sonnet-4-6').type).toBe('web_search_20260209')
    expect(webTool('claude-haiku-5-5').type).toBe('web_search_20250305')
    expect(webTool('claude-sonnet-4-5-20250929').type).toBe('web_search_20250305')
    const on = claudeBody(req({ web: true }), { model: AMODEL })
    expect((on.tools as { name: string }[]).map((t) => t.name)).toEqual([...AGENT_TOOLS.slice(0, 2).map((t) => t.def.name), 'web_search'])
    expect((claudeBody(req(), { model: AMODEL }).tools as { name: string }[]).some((t) => t.name === 'web_search')).toBe(false)
    expect(claudeBody({ messages: ASK, tools: [], web: true }, { model: AMODEL }).tools).toEqual([webTool(AMODEL)])
  })

  it('reads queries, results and citations from the content; errors and other blocks add nothing', () => {
    const w = webOf([
      { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'flink fees' } },
      { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', url: 'https://a.example/x', title: 'A', encrypted_content: 'E', page_age: null }] },
      { type: 'server_tool_use', id: 's2', name: 'web_search', input: { query: 'flink fees' } },
      { type: 'web_search_tool_result', tool_use_id: 's2', content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' } },
      { type: 'text', text: 'B says so.', citations: [{ type: 'web_search_result_location', url: 'https://b.example/y', title: 'B', encrypted_index: 'I', cited_text: 'so' }] },
    ] as never)
    expect(w).toEqual({ queries: ['flink fees'], sources: [{ url: 'https://b.example/y', title: 'B', cited: true }, { url: 'https://a.example/x', title: 'A' }] })
    expect(webOf([{ type: 'text', text: 'no web', citations: null }] as never)).toBeUndefined()
  })

  it('a paused search turn is taken up again: the paused content sent back as it came, the parts joined, searches summed', async () => {
    const { f, bodies } = claudeFetch(
      sse([msgStart('msg_a'), ...searchBlocks(0, 'srv_1', 'getir fee', 'https://getir.com/fees', 'Getir fees'), ...msgEnd('pause_turn', 1)]),
      sse([msgStart('msg_b'), ...searchBlocks(0, 'srv_2', 'getir fee berlin', 'https://news.example.com/getir', 'News'), ...citedText(2, 'Getir charges €1.99.', 'https://getir.com/fees', 'Getir fees'), ...msgEnd('end_turn', 1)]),
    )
    const m = anthropicModel({ key: AKEY, model: AMODEL, fetch: f })
    const { events, response } = await drain(m.stream(req({ web: true })))
    expect(events.filter((e) => e.type === 'search')).toEqual([
      { type: 'search', query: 'getir fee' },
      { type: 'search', query: 'getir fee berlin' },
    ])
    // The second request: the same messages, then the paused assistant content as it came.
    const sent = bodies[1].messages as { role: string; content: { type: string; id?: string }[] }[]
    const lastMsg = sent[sent.length - 1]
    expect(lastMsg.role).toBe('assistant')
    expect(lastMsg.content.map((b) => b.type)).toEqual(['server_tool_use', 'web_search_tool_result'])
    expect(response.text).toBe('Getir charges €1.99.')
    expect((response.providerItems as { type: string }[]).map((b) => b.type)).toEqual(['server_tool_use', 'web_search_tool_result', 'server_tool_use', 'web_search_tool_result', 'text'])
    expect(response.usage.searches).toBe(2)
    expect(response.web?.queries).toEqual(['getir fee', 'getir fee berlin'])
    expect(response.web?.sources[0]).toEqual({ url: 'https://getir.com/fees', title: 'Getir fees', cited: true })
    expect(response.stop).toBe('end')
  })

  it(`a turn still paused after ${PAUSES} take-ups stands as it is`, async () => {
    const paused = () => sse([msgStart('msg_p'), ...searchBlocks(0, 'srv', 'q', 'https://x.example', 'X'), ...msgEnd('pause_turn', 1)])
    const { f, bodies } = claudeFetch(...Array.from({ length: PAUSES + 1 }, paused))
    const { response } = await drain(anthropicModel({ key: AKEY, model: AMODEL, fetch: f }).stream(req({ web: true })))
    expect(bodies).toHaveLength(PAUSES + 1)
    expect(response.stop).toBe('end')
    expect(response.usage.searches).toBe(PAUSES + 1)
  })
})

// ---- Cost, sources, the loop, a saved chat

describe('the web around the adapters', () => {
  it('a search costs SEARCH_PRICE on top of the tokens', () => {
    const tokens = costOf('gpt-5.6-terra', { input: 1000, output: 100 })
    expect(costOf('gpt-5.6-terra', { input: 1000, output: 100, searches: 3 })).toBeCloseTo(tokens + 3 * SEARCH_PRICE, 10)
  })

  it('joinSources: one per url, cited if any copy was, cited first, http(s) only', () => {
    expect(
      joinSources([
        [{ url: 'https://a.example', title: 'A' }, { url: 'javascript:alert(1)' }],
        [{ url: 'https://b.example', cited: true }, { url: 'https://a.example', cited: true }],
      ]),
    ).toEqual([
      { url: 'https://a.example', title: 'A', cited: true },
      { url: 'https://b.example', cited: true },
    ])
    expect(siteOf('https://www.getir.com/fees?x=1')).toBe('getir.com')
  })

  it('the loop offers the web on every step (not with web: false), says each search, and gathers the turn\'s sources', async () => {
    const seen: (boolean | undefined)[] = []
    const replies: ModelResponse[] = [
      { text: '', toolCalls: [{ id: 'c1', name: 'where_am_i', args: {} }], usage: { input: 10, output: 5, searches: 1 }, stop: 'tool_calls', web: { queries: ['getir fee'], sources: [{ url: 'https://news.example.com/getir' }] } },
      { text: 'Getir charges €1.99.', toolCalls: [], usage: { input: 10, output: 5 }, stop: 'end', web: { queries: [], sources: [{ url: 'https://getir.com/fees', cited: true }, { url: 'https://news.example.com/getir' }] } },
    ]
    const model: AgentModel = {
      name: 'fake',
      async *stream(r) {
        seen.push(r.web)
        const res = replies.shift()!
        for (const q of res.web?.queries ?? []) yield { type: 'search', query: q }
        yield { type: 'done', response: res }
      },
      async respond() {
        throw new Error('streams')
      },
    }
    const searches: string[] = []
    const env = makeEnv(loadFixture('medium'))
    const r = await runTurn(model, env, AGENT_TOOLS, [], 'What does Getir charge?', { onEvent: (e) => void (e.type === 'search' && searches.push(e.query)) })
    expect(seen).toEqual([true, true])
    expect(searches).toEqual(['getir fee'])
    expect(r.turn.sources).toEqual([{ url: 'https://getir.com/fees', cited: true }, { url: 'https://news.example.com/getir' }])
    expect(r.turn.searches).toEqual(['getir fee'])
    expect(r.turn.usage.searches).toBe(1)
    // Off: the request says nothing of the web.
    const off: (boolean | undefined)[] = []
    const plain = stubModel([{ answer: 'ok' }])
    const watched: AgentModel = { ...plain, respond: (q) => (off.push(q.web), plain.respond(q)), stream: undefined }
    await runTurn(watched, makeEnv(loadFixture('medium')), AGENT_TOOLS, [], 'hi', { web: false })
    expect(off).toEqual([undefined])
  })

  it('a saved chat keeps an answer\'s sources: http(s) only, at most 20, titles cut', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ url: `https://s${i}.example`, title: 'T'.repeat(300) }))
    const kept = keptTurn({ role: 'agent', text: 'x', at: 1, sources: [{ url: 'ftp://nope', cited: true }, ...many] })
    expect(kept.sources).toHaveLength(20)
    expect(kept.sources![0].url).toBe('https://s0.example')
    expect(kept.sources![0].title!.length).toBeLessThanOrEqual(200)
    expect(keptTurn({ role: 'agent', text: 'x', at: 1 }).sources).toBeUndefined()
  })
})
