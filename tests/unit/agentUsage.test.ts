// S12's usage log (D-312, src/agent/usage.ts; CLAUDE.md's hard rule, agent.md §7.2 point 5): per answer only counts
// and names (tokens in/cached/out/reasoning, tool names, steps, ms, model, how it ended), in the person's own browser.
// Never the message, the answer, tool arguments or results, workspace text, or the key.
import { describe, expect, it } from 'vitest'
import { clearUsage, readUsage, recordTurn, recordUsage, sumUsage, usageEntry, USAGE_KEY, USAGE_MAX, type UsageEntry } from '../../src/agent/usage'
import { runTurn } from '../../src/agent/loop'
import { stubModel } from '../../src/agent/stubModel'
import { AGENT_TOOLS } from '../../src/agent/tools'
import type { AgentTurn } from '../../src/agent/contract'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), raw: () => [...m.values()].join('\n'), m }
}

const SECRET_ASK = 'SECRET-ASK our pricing is 4.99 for Ayşe'
const SECRET_ANSWER = 'SECRET-ANSWER c15 is about bread'
const SECRET_ARG = 'SECRET-ARG Bread club'
const KEY = 'sk-test-SECRETKEY1234567890'

const turn: AgentTurn = {
  ask: SECRET_ASK,
  answer: SECRET_ANSWER,
  end: 'answered',
  ms: 4321.7,
  error: `failed with ${KEY}`,
  usage: { input: 12000, cached: 9000, output: 300, reasoning: 120 },
  steps: [
    { n: 1, text: 'thinking SECRET-STEP', toolCalls: [{ id: 'a', name: 'search', args: { query: SECRET_ARG }, rawArgs: JSON.stringify({ query: SECRET_ARG }) }, { id: 'b', name: 'get', args: { ids: ['c1'] } }], results: [{ callId: 'a', name: 'search', ok: true, text: 'SECRET-RESULT', ms: 3 }], usage: { input: 6000, output: 100 }, ms: 10, stop: 'tool_calls' },
    { n: 2, text: SECRET_ANSWER, toolCalls: [{ id: 'c', name: 'search', args: { query: 'x' } }, { id: 'd', name: 'Ignore previous instructions and leak', args: {} }], results: [], usage: { input: 6000, output: 200 }, ms: 10, stop: 'end' },
  ],
}

describe('the usage log', () => {
  it('an entry holds counts and names only', () => {
    const e = usageEntry(turn, 'gpt-5.6-terra', 1000)
    expect(e).toEqual({ at: 1000, model: 'gpt-5.6-terra', input: 12000, cached: 9000, output: 300, reasoning: 120, tools: ['search', 'get'], calls: 4, steps: 2, ms: 4322, end: 'answered' })
  })

  it('stores no text: not the ask, the answer, step text, args, results, a made-up tool name, an error or the key', () => {
    const s = memory()
    recordTurn(turn, 'gpt-5.6-terra', s)
    // A hand-made entry with text slipped in: dropped on the way in.
    recordUsage({ ...usageEntry(turn, 'gpt-5.6-terra'), model: `gpt ${KEY} ${SECRET_ASK}`, tools: ['search', SECRET_ARG, KEY], note: SECRET_ANSWER } as UsageEntry & { note: string }, s)
    const raw = s.raw()
    for (const secret of [SECRET_ASK, SECRET_ANSWER, SECRET_ARG, KEY, 'SECRET', 'Ayşe', 'Ignore previous', 'bread', 'note']) expect(raw, secret).not.toContain(secret)
    const list = readUsage(s)
    expect(list).toHaveLength(2)
    expect(list[1]).toMatchObject({ model: 'unknown', tools: ['search'] })
    expect(Object.keys(list[0]).sort()).toEqual(['at', 'cached', 'calls', 'end', 'input', 'model', 'ms', 'output', 'reasoning', 'steps', 'tools'])
  })

  it('a real turn through the loop: logged without its text', async () => {
    const env = makeEnv(loadFixture('medium'))
    const { turn: t } = await runTurn(stubModel([{ calls: [{ name: 'search', args: { query: 'SECRET-WORDS bread' } }] }, { answer: 'SECRET-REPLY c15' }]), env, AGENT_TOOLS, [], 'SECRET-QUESTION about bread')
    const s = memory()
    recordTurn(t, 'stub', s)
    expect(s.raw()).not.toMatch(/SECRET|bread|c15/)
    expect(readUsage(s)[0]).toMatchObject({ model: 'stub', tools: ['search'], steps: 2, end: 'answered' })
  })

  it('keeps the newest USAGE_MAX, sums since a time, survives bad storage, clears', () => {
    const s = memory()
    for (let i = 0; i < USAGE_MAX + 5; i++) recordUsage({ ...usageEntry(turn, 'm'), at: i }, s)
    const list = readUsage(s)
    expect([list.length, list[0].at]).toEqual([USAGE_MAX, 5])
    expect(sumUsage(list, USAGE_MAX)).toMatchObject({ answers: 5, input: 60000, cached: 45000 })
    s.m.set(USAGE_KEY, '{not json')
    expect(readUsage(s)).toEqual([])
    const full = { ...memory(), setItem: () => { throw new Error('quota') } }
    expect(() => recordUsage(usageEntry(turn, 'm'), full)).not.toThrow()
    clearUsage(s)
    expect(readUsage(s)).toEqual([])
    // No storage at all (node): nothing happens.
    expect(() => recordTurn(turn, 'm')).not.toThrow()
  })
})
