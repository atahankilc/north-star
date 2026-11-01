// The agent pipeline (docs/specs/agent-pipeline.md, src/agent/pipeline.ts): a turn's role from what is known before
// it runs, a model per role, one provider per pipeline; the evals run it turn by turn and record which model and role
// ran each turn; a model's own items never go to another model; the run record sums cost by model and role.
import { describe, expect, it } from 'vitest'
import { modelFor, pipelineProblems, roleOf, routed, single, planThenCheap } from '../../src/agent/pipeline'
import { planJob, progressJob, type Job } from '../../src/agent/job'
import { stubModel } from '../../src/agent/stubModel'
import { runTurn } from '../../src/agent/loop'
import { AGENT_TOOLS } from '../../src/agent/tools'
import { attempt, pipelineFor } from '../../evals/run'
import { TASKS } from '../../evals/tasks'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'
import { summarise } from '../../evals/records'
import type { AgentModel, ModelMessage } from '../../src/agent/contract'

const plan = () => planJob({ title: 'T', steps: [{ title: 'a' }, { title: 'b' }] }, null) as Job

describe('roles and models', () => {
  it('a turn\'s role: a job under way → executor, a plan skill → planner, else chat (never the words)', () => {
    expect(roleOf({ message: 'how many problems?', job: null })).toBe('chat')
    expect(roleOf({ message: '/compare our Pricing features', job: null })).toBe('planner')
    expect(roleOf({ message: '/gaps', job: null })).toBe('chat')
    expect(roleOf({ message: 'go', job: plan() })).toBe('executor')
    expect(roleOf({ message: 'go on', job: progressJob(plan(), { step: 1, state: 'doing' }) as Job })).toBe('executor')
    expect(roleOf({ message: 'thanks', job: { ...plan(), status: 'done' } })).toBe('chat')
  })

  it('a model per role, falling back to chat\'s; one provider per pipeline', () => {
    const r = routed('openai:gpt-5.4-mini', 'openai:gpt-5.6-terra')
    expect([modelFor(r, 'chat'), modelFor(r, 'planner'), modelFor(r, 'executor'), modelFor(r, 'reviewer')]).toEqual(['openai:gpt-5.4-mini', 'openai:gpt-5.6-terra', 'openai:gpt-5.6-terra', 'openai:gpt-5.4-mini'])
    expect(modelFor(planThenCheap('a', 'b'), 'executor')).toBe('a')
    expect(modelFor(single('x'), 'planner')).toBe('x')
    expect(pipelineProblems(r)).toEqual([])
    expect(pipelineProblems(routed('openai:gpt-5.4-mini', 'anthropic:claude-sonnet-5-5'))).toEqual(['planner is on anthropic, chat on openai: one provider per pipeline', 'executor is on anthropic, chat on openai: one provider per pipeline'])
    expect(() => pipelineFor('routed', 'openai:a')).toThrow(/needs --strong/)
  })
})

describe('the evals run a pipeline turn by turn', () => {
  it('a plan skill: the planner plans, the go turn runs on the executor; each turn says which model and role', async () => {
    const task = TASKS.find((t) => t.id === 'skill-test-01')!
    // One script, played by whichever model the turn picks: the turns' models are what is checked.
    const script = stubModel(task.reference)
    const named = (name: string): AgentModel => ({ name, respond: (req) => script.respond(req) })
    const models = { chat: named('cheap'), planner: named('strong'), executor: named('worker'), reviewer: named('cheap') }
    const { attempt: a } = await attempt(task, models.chat, { pick: (role) => models[role] })
    expect(a.transcript.turns.map((t) => [t.role, t.model])).toEqual([
      ['planner', 'strong'],
      ['chat', 'cheap'],
    ])
    expect(a.pass).toBe(true)
  })

  it('the record sums cost by model and by role', () => {
    const turn = (model: string, role: string, input: number) => ({ ask: '', steps: [], answer: '', end: 'answered' as const, usage: { input, output: 0 }, ms: 0, model, role })
    const s = summarise([{ id: 't', group: 'edit', set: 'regression', ask: '', attempts: [{ pass: true, cost: 3, usage: { input: 2_000_000, output: 0 }, transcript: { model: 'gpt-5.4-mini', startedAt: 0, turns: [turn('gpt-5.4-mini', 'chat', 1_000_000), turn('gpt-5.6-terra', 'executor', 1_000_000)] } } as never] }], 'gpt-5.4-mini')
    expect(s.all).toMatchObject({ attempts: 1, passed: 1, cost: 3 })
    expect(s.models['gpt-5.4-mini'].cost).toBeCloseTo(0.75)
    expect(s.models['gpt-5.6-terra'].cost).toBeCloseTo(2)
    expect(Object.keys(s.roles).sort()).toEqual(['chat', 'executor'])
  })
})

describe('a model\'s own items go back only to that model', () => {
  it('after a switch, the other model\'s reasoning items are left out; its text and calls stay', async () => {
    const e = makeEnv(loadFixture('medium'))
    const first = stubModel([{ answer: 'one' }], { name: 'model-a' })
    const t1 = await runTurn({ ...first, provider: 'openai', respond: async (req) => ({ ...(await first.respond(req)), providerItems: [{ type: 'reasoning', id: 'rs_1' }] }) } as AgentModel, e, AGENT_TOOLS, [], 'hi')
    const kept = t1.history.find((m) => m.role === 'assistant') as Extract<ModelMessage, { role: 'assistant' }>
    expect([kept.model, kept.providerItems?.length]).toEqual(['model-a', 1])
    const second = stubModel([{ answer: 'two' }], { name: 'model-b' })
    await runTurn({ ...second, provider: 'openai' } as AgentModel, e, AGENT_TOOLS, t1.history, 'again')
    const sent = second.seen[0].messages.find((m) => m.role === 'assistant') as Extract<ModelMessage, { role: 'assistant' }>
    expect([sent.content, sent.providerItems]).toEqual(['one', undefined])
  })
})
