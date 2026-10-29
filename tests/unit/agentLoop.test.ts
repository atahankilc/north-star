// S12's loop (D-312, src/agent/loop.ts) with the stub model on the medium fixture: tool errors go back to the model,
// the step budget (25, the last step asked to answer with the tools off), a stop mid-turn, parallel calls in one step
// (reads at once, writes in order), old results cleared and compaction, every write as the agent, a model error ending
// the turn cleanly, the context's order (map byte-stable, where-am-i last), events with step labels, the transcript.
import { describe, expect, it, vi } from 'vitest'
import { runTurn, clearOldResults, compactHistory, stepLabel, FINAL_STEP_NOTE, KEEP_RESULTS, STEP_BUDGET, type LoopEvent } from '../../src/agent/loop'
import { stubModel } from '../../src/agent/stubModel'
import { AGENT_TOOLS } from '../../src/agent/tools'
import { systemPrompt } from '../../src/agent/prompt'
import type { AgentModel, AgentTool, ModelMessage, ModelRequest, ModelResponse, Transcript } from '../../src/agent/contract'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'
import { realOf } from '../../evals/tasks/util'

const env = () => makeEnv(loadFixture('medium'))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const tool = (name: string, kind: AgentTool['kind'], run: AgentTool['run']): AgentTool => ({ def: { name, description: name, parameters: { type: 'object', properties: {} } }, kind, run })
const toolMsgs = (msgs: ModelMessage[]) => msgs.filter((m): m is Extract<ModelMessage, { role: 'tool' }> => m.role === 'tool')

// Every call in a history has its result, and every result its call (what OpenAI requires of an input).
function wellFormed(msgs: ModelMessage[]) {
  const calls = msgs.flatMap((m) => (m.role === 'assistant' ? (m.toolCalls ?? []).map((c) => c.id) : []))
  const results = toolMsgs(msgs).map((m) => m.callId)
  expect(results.sort()).toEqual(calls.sort())
}

describe('tool errors go back to the model', () => {
  it('a throwing tool, a refusing tool, an unknown tool and unparsed args: each a result that says why; the turn goes on', async () => {
    const e = env()
    const tools = [tool('boom', 'read', async () => Promise.reject(new Error('the disk fell over'))), tool('nope', 'read', async () => ({ ok: false, text: 'refused: say a plane' }))]
    const m: AgentModel & { seen: ModelRequest[] } = Object.assign(stubModel([{ calls: [{ name: 'boom', args: {} }, { name: 'nope', args: {} }, { name: 'ghost', args: {} }] }, { answer: 'sorry' }]), {})
    const first = m.respond.bind(m)
    // One more call whose arguments didn't parse, as the adapter would give it.
    m.respond = async (req) => {
      const r = await first(req)
      if (r.toolCalls.length) r.toolCalls.push({ id: 'bad', name: 'nope', args: {}, rawArgs: '{x', argsError: 'Unexpected token x' })
      return r
    }
    const { turn, history } = await runTurn(m, e, tools, [], 'go')
    expect(turn.end).toBe('answered')
    expect(turn.steps[0].results.map((r) => [r.name, r.ok])).toEqual([['boom', false], ['nope', false], ['ghost', false], ['nope', false]])
    const texts = turn.steps[0].results.map((r) => r.text)
    expect(texts[0]).toContain('boom failed: the disk fell over')
    expect(texts[1]).toBe('refused: say a plane')
    expect(texts[2]).toMatch(/^there is no tool ghost; the tools are boom, nope/)
    expect(texts[3]).toContain("didn't parse: Unexpected token x")
    // The model saw them on the next step.
    const second = (m as unknown as { seen: ModelRequest[] }).seen[1].messages
    expect(toolMsgs(second).map((x) => x.content)).toEqual(texts)
    wellFormed(history)
  })

  it('a result past ~8k tokens is cut with a line saying how to narrow', async () => {
    const big = tool('big', 'read', async () => ({ ok: true, text: 'x'.repeat(40_000) }))
    const { turn } = await runTurn(stubModel([{ calls: [{ name: 'big', args: {} }] }, { answer: 'ok' }]), env(), [big], [], 'go')
    const t = turn.steps[0].results[0].text
    expect(t.length).toBeLessThan(25_000)
    expect(t).toContain('narrow it')
  })
})

describe('the step budget', () => {
  it('25 by default; the last step is asked to answer with the tools listed but off; its calls do not run', async () => {
    const m = stubModel(Array.from({ length: 40 }, () => ({ calls: [{ name: 'where_am_i', args: {} }] })))
    const { turn, history } = await runTurn(m, env(), AGENT_TOOLS, [], 'loop forever')
    expect([STEP_BUDGET, turn.steps.length, turn.end]).toEqual([25, 25, 'budget'])
    expect(m.seen.slice(0, 24).every((r) => r.toolChoice === undefined)).toBe(true)
    const last = m.seen[24]
    expect(last.toolChoice).toBe('none')
    expect(last.tools.length).toBe(AGENT_TOOLS.length)
    expect(last.messages[last.messages.length - 1]).toEqual({ role: 'system', content: FINAL_STEP_NOTE })
    expect(turn.steps[24].results).toEqual([])
    expect(turn.steps[23].results).toHaveLength(1)
    wellFormed(history)
  })

  it('an answer on the forced step is kept (the turn still says budget)', async () => {
    const { turn } = await runTurn(stubModel([{ calls: [{ name: 'where_am_i', args: {} }] }, { calls: [{ name: 'where_am_i', args: {} }] }, { answer: 'what I found so far' }]), env(), AGENT_TOOLS, [], 'x', { stepBudget: 3 })
    expect([turn.end, turn.answer, turn.steps.length]).toEqual(['budget', 'what I found so far', 3])
  })
})

describe('stopping', () => {
  it('a stop during a step: the turn ends stopped with what was done; nothing after runs', async () => {
    const ac = new AbortController()
    const ran: string[] = []
    const slow = tool('slow', 'read', async () => {
      ran.push('slow')
      ac.abort()
      return { ok: true, text: 'done' }
    })
    const m = stubModel([{ calls: [{ name: 'slow', args: {} }] }, { calls: [{ name: 'slow', args: {} }] }, { answer: 'never' }])
    const { turn, history } = await runTurn(m, env(), [slow], [], 'x', { signal: ac.signal })
    expect([turn.end, turn.steps.length, ran.length, m.seen.length]).toEqual(['stopped', 1, 1, 1])
    wellFormed(history)
  })

  it('a stop while the model answers: its calls are not run, each says so; the history stays well-formed', async () => {
    const ac = new AbortController()
    const write = vi.fn(async () => ({ ok: true, text: 'wrote' }))
    const m: AgentModel = {
      name: 'x',
      respond: async () => {
        ac.abort()
        return { text: '', toolCalls: [{ id: 'w1', name: 'w', args: {} }], usage: { input: 1, output: 1 }, stop: 'tool_calls' }
      },
    }
    const { turn, history } = await runTurn(m, env(), [tool('w', 'write', write)], [], 'x', { signal: ac.signal })
    expect([turn.end, write.mock.calls.length, turn.steps[0].results[0].text]).toEqual(['stopped', 0, 'not run: the person stopped the turn'])
    wellFormed(history)
  })

  it('a stop between two queued writes of one step: the second does not run and says so', async () => {
    const ac = new AbortController()
    const ran: string[] = []
    const w = (name: string) =>
      tool(name, 'write', async () => {
        ran.push(name)
        if (name === 'w1') ac.abort()
        return { ok: true, text: name }
      })
    const m = stubModel([{ calls: [{ name: 'w1', args: {} }, { name: 'w2', args: {} }] }, { answer: 'never' }])
    const { turn, history } = await runTurn(m, env(), [w('w1'), w('w2')], [], 'x', { signal: ac.signal })
    expect(ran).toEqual(['w1'])
    expect(turn.steps[0].results.map((r) => [r.name, r.ok, r.text])).toEqual([['w1', true, 'w1'], ['w2', false, 'not run: the person stopped the turn']])
    expect([turn.end, m.seen.length]).toEqual(['stopped', 1])
    wellFormed(history)
  })

  it('an abort thrown by the model ends the turn stopped, not error', async () => {
    const ac = new AbortController()
    const m: AgentModel = {
      name: 'x',
      respond: async () => {
        ac.abort()
        const e = new Error('Stopped.')
        e.name = 'AbortError'
        throw e
      },
    }
    const { turn } = await runTurn(m, env(), AGENT_TOOLS, [], 'x', { signal: ac.signal })
    expect([turn.end, turn.error]).toEqual(['stopped', undefined])
  })
})

describe('parallel calls in one step', () => {
  it('reads run at once; writes and UI moves one after the other in the order given; results in call order', async () => {
    let now = 0
    let most = 0
    const log: string[] = []
    const read = (name: string, ms: number) =>
      tool(name, 'read', async () => {
        most = Math.max(most, ++now)
        await sleep(ms)
        now--
        log.push(name)
        return { ok: true, text: name }
      })
    const write = (name: string, ms: number) =>
      tool(name, 'write', async () => {
        log.push(`${name}:start`)
        await sleep(ms)
        log.push(`${name}:end`)
        return { ok: true, text: name }
      })
    const tools = [read('r1', 30), read('r2', 30), read('r3', 30), write('w1', 25), write('w2', 1)]
    const m = stubModel([{ calls: ['w1', 'r1', 'w2', 'r2', 'r3'].map((name) => ({ name, args: {} })) }, { answer: 'ok' }])
    const { turn } = await runTurn(m, env(), tools, [], 'x')
    expect(most).toBe(3)
    expect(log.filter((x) => x.startsWith('w'))).toEqual(['w1:start', 'w1:end', 'w2:start', 'w2:end'])
    expect(turn.steps[0].results.map((r) => r.name)).toEqual(['w1', 'r1', 'w2', 'r2', 'r3'])
  })
})

describe('history upkeep', () => {
  it('old tool results are cleared past keep + slack, in steps; the last ones stay whole', async () => {
    const big = tool('big', 'read', async () => ({ ok: true, text: `RESULT ${'y'.repeat(2000)}` }))
    const m = stubModel([...Array.from({ length: 14 }, () => ({ calls: [{ name: 'big', args: {} }] })), { answer: 'ok' }])
    const { history } = await runTurn(m, env(), [big], [], 'x')
    const results = toolMsgs(history)
    const full = results.filter((r) => r.content.startsWith('RESULT'))
    expect(results).toHaveLength(14)
    expect(full.length).toBeGreaterThanOrEqual(KEEP_RESULTS)
    expect(full.length).toBeLessThanOrEqual(KEEP_RESULTS + 4)
    expect(results[0].content).toMatch(/^\[an earlier result of big, ~\d+ tokens, cleared/)
    expect(results[results.length - 1].content.startsWith('RESULT')).toBe(true)
    // What the model was sent on its last step had the notes too.
    expect(toolMsgs(m.seen[m.seen.length - 1].messages).filter((r) => r.content.startsWith('[an earlier')).length).toBeGreaterThan(0)
    wellFormed(history)
  })

  it('clearOldResults leaves short results and does nothing under the threshold', () => {
    const msgs: ModelMessage[] = Array.from({ length: 9 }, (_, i) => ({ role: 'tool' as const, callId: `c${i}`, name: 'get', content: i % 2 ? 'short' : 'z'.repeat(500) }))
    expect(clearOldResults(msgs)).toBe(0)
  })

  it('compaction: past the size, older turns keep only their ask and answer; the last two whole; a note in front', async () => {
    const turnOf = (i: number): ModelMessage[] => [
      { role: 'user', content: `ask ${i}` },
      { role: 'assistant', content: '', toolCalls: [{ id: `k${i}`, name: 'get', args: {} }], providerItems: [{ type: 'reasoning', encrypted_content: 'e'.repeat(3000) }] },
      { role: 'tool', callId: `k${i}`, name: 'get', content: 'r'.repeat(3000) },
      { role: 'assistant', content: `answer ${i}` },
    ]
    const history = Array.from({ length: 6 }, (_, i) => turnOf(i)).flat()
    const out = compactHistory(history, { maxTokens: 100_000 })
    expect(out[0]).toMatchObject({ role: 'system', content: expect.stringMatching(/^Earlier in this chat: 4 turns compacted/) })
    expect(out.slice(1, 9).map((m) => m.content)).toEqual(['ask 0', 'answer 0', 'ask 1', 'answer 1', 'ask 2', 'answer 2', 'ask 3', 'answer 3'])
    expect(out.slice(9)).toEqual(history.slice(16))
    wellFormed(out)
    // Too big even so: the oldest turns go, and the note says so.
    const wordy = history.map((m) => (m.role === 'assistant' && !m.toolCalls ? { ...m, content: `${m.content} ${'w'.repeat(3000)}` } : m))
    const tight = compactHistory(wordy, { maxTokens: 9000 })
    expect(tight[0].content).toMatch(/the oldest 2 turns left out entirely/)
    expect(tight.filter((m) => m.role === 'user').map((m) => m.content)).toEqual(['ask 2', 'ask 3', 'ask 4', 'ask 5'])
    wellFormed(tight)
    // Through the loop: a history past compactAt is compacted before the model sees it.
    const m = stubModel([{ answer: 'ok' }])
    const r = await runTurn(m, env(), AGENT_TOOLS, history, 'next', { compactAt: 5000 })
    expect(m.seen[0].messages.some((x) => x.role === 'system' && x.content.startsWith('Earlier in this chat'))).toBe(true)
    expect(r.history.length).toBeLessThan(history.length + 2)
    wellFormed(r.history)
  })
})

describe('writes go as the agent', () => {
  it('a tool that asks to apply as anyone else still applies as the agent', async () => {
    const e = env()
    const spy = vi.spyOn(e, 'apply')
    const sneaky = tool('sneaky', 'write', async (en) => {
      const r = await en.apply([{ op: 'x', label: 'x', writes: [], ids: {} }], { actor: 'person' } as never)
      return { ok: r.ok, text: 'tried' }
    })
    await runTurn(stubModel([{ calls: [{ name: 'sneaky', args: {} }] }, { answer: 'ok' }]), e, [sneaky], [], 'x')
    expect(spy.mock.calls.map((c) => c[1].actor)).toEqual(['agent'])
  })

  it('the change tool\'s apply records meta.actor agent: one undo step, the agent\'s', async () => {
    const e = env()
    const spy = vi.spyOn(e, 'apply')
    const m = stubModel([{ calls: [{ name: 'change', args: { ops: [{ op: 'create_card', args: { type: 'idea', plane: 'p3', title: 'Bread club' } }] } }] }, { answer: 'Added.' }])
    const { turn } = await runTurn(m, e, AGENT_TOOLS, [], 'add an idea')
    expect(turn.steps[0].results[0].ok).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][1]).toMatchObject({ actor: 'agent' })
    expect(e.steps.map((s) => s.actor)).toEqual(['agent'])
  })
})

describe('a model error ends the turn cleanly', () => {
  it('cut short (length): the partial text is kept as the answer', async () => {
    const { turn } = await runTurn(stubModel([{ answer: 'The list goes on: c1, c2', stop: 'length' }]), env(), AGENT_TOOLS, [], 'x')
    expect([turn.end, turn.answer]).toEqual(['length', 'The list goes on: c1, c2'])
  })

  it('a throw: end error with why, no throw out of the loop, the ask kept in the history', async () => {
    const { turn, history } = await runTurn(stubModel([{ calls: [{ name: 'where_am_i', args: {} }] }, { fail: 'OpenAI had a problem (500)' }]), env(), AGENT_TOOLS, [], 'x')
    expect([turn.end, turn.error, turn.steps.length]).toEqual(['error', 'the model failed: OpenAI had a problem (500)', 1])
    expect(history[0]).toEqual({ role: 'user', content: 'x' })
    wellFormed(history)
  })

  it('stop error in a response: its calls do not run, the half answer stays out of the history', async () => {
    const run = vi.fn(async () => ({ ok: true, text: 'x' }))
    const m: AgentModel = { name: 'x', respond: async (): Promise<ModelResponse> => ({ text: 'half', toolCalls: [{ id: 'q', name: 't', args: {} }], usage: { input: 3, output: 2 }, stop: 'error', error: 'the stream broke' }) }
    const { turn, history } = await runTurn(m, env(), [tool('t', 'write', run)], [], 'x')
    expect([turn.end, turn.error, run.mock.calls.length, turn.usage.input]).toEqual(['error', 'the stream broke', 0, 3])
    expect(history).toEqual([{ role: 'user', content: 'x' }])
  })
})

describe('the context and what the UI hears', () => {
  it('system prompt, map, notes, chat so far, where the person is (last), the ask; the map byte-identical across steps', async () => {
    const e = makeEnv(loadFixture('medium'), { view: { focus: realOf('medium', 'p3') } })
    const past: ModelMessage[] = [{ role: 'user', content: 'before' }, { role: 'assistant', content: 'earlier' }]
    const m = stubModel([{ calls: [{ name: 'where_am_i', args: {} }] }, { answer: 'ok' }])
    await runTurn(m, e, AGENT_TOOLS, past, 'now', { notes: 'We call stalls "booths".' })
    const [a, b] = m.seen.map((r) => r.messages)
    expect(a.map((x) => x.role)).toEqual(['system', 'system', 'system', 'user', 'assistant', 'system', 'user'])
    expect(a[0].content).toBe(systemPrompt({ workspaceName: e.getWs().workspace.name }))
    expect(a[1].content.startsWith('# Workspace map')).toBe(true)
    expect(a[2].content).toBe('## Agent notes\nWe call stalls "booths".')
    expect(a[5].content.startsWith('## Where the person is now')).toBe(true)
    expect(a[5].content).toContain('in focus: p3')
    expect(a[6]).toEqual({ role: 'user', content: 'now' })
    // The second step's prefix is the first step's messages, byte for byte.
    expect(b.slice(0, a.length)).toEqual(a)
    // No notes: no notes block.
    const m2 = stubModel([{ answer: 'ok' }])
    await runTurn(m2, env(), AGENT_TOOLS, [], 'x')
    expect(m2.seen[0].messages.map((x) => x.role)).toEqual(['system', 'system', 'system', 'user'])
  })

  it('events: steps with labels, args in brief, times; text deltas when the model streams; usage; the transcript', async () => {
    const events: LoopEvent[] = []
    const streaming: AgentModel = {
      name: 'streamer',
      respond: async () => {
        throw new Error('not used')
      },
      async *stream(req) {
        const done = req.messages.some((x) => x.role === 'tool')
        if (!done) {
          yield { type: 'done', response: { text: '', toolCalls: [{ id: 'v1', name: 'view', args: { piece: 'p3' } }, { id: 's1', name: 'search', args: { query: 'bread' } }], usage: { input: 100, output: 5, cached: 0 }, stop: 'tool_calls' } }
          return
        }
        yield { type: 'text', delta: 'Pazar has ' }
        yield { type: 'text', delta: 'bread.' }
        yield { type: 'done', response: { text: 'Pazar has bread.', toolCalls: [], usage: { input: 120, output: 6, cached: 100 }, stop: 'end' } }
      },
    }
    const transcript: Transcript = { model: 'streamer', startedAt: 0, turns: [] }
    const { turn } = await runTurn(streaming, env(), AGENT_TOOLS, [], 'x', { onEvent: (ev) => events.push(ev), transcript })
    expect(turn.answer).toBe('Pazar has bread.')
    expect(events.map((x) => x.type)).toEqual(['turn_started', 'step_started', 'usage', 'tool_started', 'tool_started', 'tool_finished', 'tool_finished', 'step_finished', 'step_started', 'text', 'text', 'usage', 'step_finished', 'turn_finished'])
    const step = events.find((x) => x.type === 'step_finished') as Extract<LoopEvent, { type: 'step_finished' }>
    expect(step.tools.map((t) => t.label)).toEqual([expect.stringMatching(/^reading ".+"…$/), 'searching "bread"…'])
    expect(step.tools[0]).toMatchObject({ name: 'view', args: '{"piece":"p3"}', ok: true, ms: expect.any(Number) })
    const u = events.filter((x) => x.type === 'usage') as Extract<LoopEvent, { type: 'usage' }>[]
    expect(u[1].total).toEqual({ input: 220, output: 11, cached: 100, reasoning: 0 })
    expect([transcript.turns.length, transcript.system?.startsWith('## Who you are'), transcript.toolsHash]).toEqual([1, true, expect.stringMatching(/^[0-9a-f]{8}$/)])
  })

  it('labels read like steps', () => {
    const e = env()
    const ws = e.getWs()
    const l = (name: string, args: Record<string, unknown>) => stepLabel({ name, args }, ws, e.ids)
    expect(l('get', { ids: ['c58'] })).toMatch(/^reading ".+"…$/)
    expect(l('get', { ids: ['c1', 'c2'] })).toBe('reading 2 items…')
    expect(l('query', { kind: 'card', type: 'problem' })).toBe('listing problems…')
    expect(l('change', { ops: [{}, {}], summary: '' })).toBe('changing: 2 changes…')
    expect(l('change', { ops: [{}], summary: 'add idea "Bread club"' })).toBe('changing: add idea "Bread club"…')
    expect(l('focus', { plane: null })).toBe('back to the canvas…')
    expect(l('get', { ids: ['nothing like it'] })).toBe('reading "nothing like it"…')
    expect(l('mystery_tool', {})).toBe('mystery tool…')
  })
})

describe('the change tool: no coordinates, short signatures', () => {
  it('x, y, by, a text\'s w/h and arrange\'s stick are left out of the op lines and refused with a fix', async () => {
    const { OPS_LINES, TYPE_LINES, NO_COORDS } = await import('../../src/agent/tools')
    const line = (op: string) => OPS_LINES.split('\n').find((l) => l.startsWith(`- ${op} `))!
    expect(line('update_card')).not.toMatch(/\bx\?|\by\?/)
    expect(line('duplicate')).not.toMatch(/\bby\?/)
    expect(line('arrange')).not.toMatch(/\bby\?|\bstick\?/)
    expect(line('create_text')).not.toMatch(/\bw\?|\bh\?/)
    // An order is not a coordinate: these keep `by`.
    expect(line('move_canvas')).toMatch(/by: 'up'\|'down'/)
    expect(line('arrange')).toContain("'spread-x'|'spread-y', where")
    expect(line('update_timeline')).toMatch(/by card\. \(A task's days: update_task start\/due\.\)$/)
    for (const l of OPS_LINES.split('\n')) expect((l.match(/\(/g) ?? []).length, l).toBe((l.match(/\)/g) ?? []).length)
    expect(Object.keys(NO_COORDS).sort()).toEqual(['arrange', 'create_text', 'duplicate', 'update_card', 'update_text'])
    // Shapes are typed and named once.
    expect(line('create_card')).toMatch(/fields\?: Fields, where\?: \{near\?: str\}, links\?: Link\[\]/)
    expect(line('create_card')).toContain('handle?: "$a"')
    expect(TYPE_LINES).toMatch(/- Rule = \{field: 'plane'\|'type'/)
    expect(TYPE_LINES).toMatch(/- Matrix = \{template\?: .*rows\?: Axis, cols\?: Axis/)
    const e = env()
    const change = AGENT_TOOLS.find((t) => t.def.name === 'change')!
    const say = async (op: string, args: Record<string, unknown>) => change.run(e, { ops: [{ op, args }] })
    for (const [op, args] of [
      ['update_card', { card: 'c58', x: 100, y: 200 }],
      ['arrange', { items: ['c58'], by: [50, 0] }],
      ['duplicate', { ids: ['c58'], to: 'p3', by: [10, 10] }],
      ['create_text', { kind: 'paragraph', plane: 'p3', text: 'hi', w: 400 }],
    ] as [string, Record<string, unknown>][]) {
      const r = await say(op, args)
      expect(r.ok, op).toBe(false)
      expect(r.text).toMatch(/coordinate the agent never gives; say where by meaning instead: arrange with layout/)
    }
    expect(e.steps).toHaveLength(0)
    expect((await say('arrange', { items: ['c58'], layout: 'grid', where: { at: 'clear' } })).ok).toBe(true)
  })
})
