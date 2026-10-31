// D-328 (docs/specs/agent-bugs.md item 28): a big job as state and steering. job.ts' plan, progress and the one rule
// that decides whether the app goes on; the plan and progress tools on an env; the workflow turning a message sent while
// a turn runs into steering; the loop handing it to the model between steps; the job's checklist in the context.
import { describe, expect, it } from 'vitest'
import { finished, JOB_BUDGET, jobText, MAX_STEPS, nextMove, nextStep, planJob, progressJob, settled, type Job } from '../../src/agent/job'
import { step as wfStep, initialWorkflow } from '../../src/agent/workflow'
import { runTurn, STEER } from '../../src/agent/loop'
import { stubModel } from '../../src/agent/stubModel'
import { AGENT_TOOLS, TOOL_NAMES } from '../../src/agent/tools'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'
import { pickScript } from '../../src/agent/devStub'

const plan = (steps = ['Read the plane', 'Split the rivals off', 'Package the bets']) => planJob({ title: 'Organise Pazar', steps: steps.map((title) => ({ title })) }, null) as Job

describe('the plan as state', () => {
  it('a plan: a title and 2–12 titled steps, all todo, waiting for go; bad plans say why', () => {
    const j = plan()
    expect(j).toMatchObject({ title: 'Organise Pazar', status: 'planned', tokens: 0, budget: JOB_BUDGET, settledAt: 0 })
    expect(j.steps.map((s) => [s.n, s.state])).toEqual([[1, 'todo'], [2, 'todo'], [3, 'todo']])
    expect(planJob({ steps: [{ title: 'a' }, { title: 'b' }] }, null)).toEqual({ error: expect.stringMatching(/needs a title/) })
    expect(planJob({ title: 't', steps: [{ title: 'a' }] }, null)).toEqual({ error: expect.stringMatching(/at least two steps/) })
    expect(planJob({ title: 't', steps: Array.from({ length: MAX_STEPS + 1 }, (_, i) => ({ title: `s${i}` })) }, null)).toEqual({ error: expect.stringMatching(/at most 12/) })
    expect(planJob({ title: 't', steps: [{ title: 'a' }, { title: '' }] }, null)).toEqual({ error: 'step 2 has no title' })
  })

  it('progress: doing starts the job; done and skipped (with why) settle steps; the last one ends it', () => {
    let j = progressJob(plan(), { step: 1, state: 'doing' }) as Job
    expect([j.status, nextStep(j)?.n]).toEqual(['running', 1])
    j = progressJob(j, { step: 1, state: 'done' }) as Job
    expect(progressJob(j, { step: 2, state: 'skipped' })).toEqual({ error: expect.stringMatching(/needs why/) })
    j = progressJob(j, { step: 2, state: 'skipped', why: 'already apart' }) as Job
    expect([settled(j), finished(j), j.status]).toEqual([2, false, 'running'])
    j = progressJob(j, { step: 3, state: 'done' }) as Job
    expect([finished(j), j.status]).toEqual([true, 'done'])
    expect(progressJob(j, { step: 9, state: 'done' })).toEqual({ error: expect.stringMatching(/no step 9/) })
    expect(progressJob(null, { step: 1, state: 'done' })).toEqual({ error: expect.stringMatching(/call plan first/) })
  })

  it('a changed plan keeps what was done (by title) and keeps running', () => {
    let j = progressJob(progressJob(plan(), { step: 1, state: 'doing' }) as Job, { step: 1, state: 'done' }) as Job
    j = planJob({ title: 'Organise Pazar', steps: [{ title: 'Read the plane' }, { title: 'Make a flow of the chain' }, { title: 'Split the rivals off' }] }, j) as Job
    expect(j.status).toBe('running')
    expect(j.steps.map((s) => [s.title, s.state])).toEqual([['Read the plane', 'done'], ['Make a flow of the chain', 'todo'], ['Split the rivals off', 'todo']])
  })

  it('the checklist the model reads: marks, what is next, waiting for go', () => {
    expect(jobText(plan())).toMatch(/^## The job: Organise Pazar \(planned; 0\/3 settled\)\n\[ \] 1\. Read the plane/)
    expect(jobText(plan())).toMatch(/Waiting for the person to say go\.$/)
    const j = progressJob(plan(), { step: 1, state: 'doing' }) as Job
    expect(jobText(j)).toMatch(/\[>\] 1\. Read the plane[\s\S]*Next: step 1\.$/)
  })
})

describe('whether the app goes on', () => {
  const running = () => progressJob(progressJob(plan(), { step: 1, state: 'doing' }) as Job, { step: 1, state: 'done' }) as Job

  it('after an apply with a step settled: go on with the next, saying what was applied', () => {
    expect(nextMove(running(), { applied: 3 })).toEqual({ go: 'The changes were applied (3). Go on with step 2 of 3: Split the rivals off.' })
    expect(nextMove(running(), {})).toEqual({ go: 'Go on with step 2 of 3: Split the rivals off.' })
  })

  it('pauses with why: no progress since the last go-on, the budget, stop after, a question, a stop, a discard', () => {
    const j = running()
    expect(nextMove({ ...j, settledAt: 1 }, { applied: 1 })).toEqual({ pause: 'no step was finished since the last go-on' })
    expect(nextMove({ ...j, tokens: JOB_BUDGET }, {})).toEqual({ pause: expect.stringMatching(/budget \(2000k tokens\) is used up/) })
    expect(nextMove({ ...j, stopAfter: true }, {})).toEqual({ pause: 'stopped after the step, as asked' })
    expect(nextMove(j, { asked: true })).toEqual({ pause: "waiting for the person's answer" })
    expect(nextMove(j, { stopped: true })).toEqual({ pause: 'stopped by the person' })
    expect(nextMove(j, { discarded: true })).toEqual({ pause: "the step's changes were discarded" })
  })

  it('nothing to do: no job, a plan waiting for go, a job done or paused', () => {
    expect(nextMove(null, { applied: 1 })).toBeNull()
    expect(nextMove(plan(), { applied: 1 })).toBeNull()
    expect(nextMove({ ...running(), status: 'paused' }, {})).toBeNull()
    expect(nextMove({ ...running(), status: 'done' }, {})).toBeNull()
  })
})

describe('the tools and the workflow', () => {
  it('plan and progress are tools; they write the job on the env and answer with the checklist', async () => {
    expect(TOOL_NAMES).toEqual(expect.arrayContaining(['plan', 'progress']))
    const env = makeEnv(loadFixture('medium'))
    const tool = (n: string) => AGENT_TOOLS.find((t) => t.def.name === n)!
    const r = await tool('plan').run(env, { title: 'Organise', steps: [{ title: 'one' }, { title: 'two' }] })
    expect(r).toEqual({ ok: true, text: expect.stringMatching(/^## The job: Organise \(planned/) })
    expect((await tool('progress').run(env, { step: 1, state: 'doing' })).text).toMatch(/\[>\] 1\. one/)
    expect(env.job!.get()!.status).toBe('running')
    expect(await tool('progress').run(env, { step: 3, state: 'done' })).toEqual({ ok: false, text: expect.stringMatching(/no step 3/) })
    const bare = { ...env, job: undefined }
    expect((await tool('plan').run(bare, { title: 'x', steps: [{ title: 'a' }, { title: 'b' }] })).ok).toBe(false)
  })

  it('a message sent while a turn runs is steering: queued for the model, the turn goes on (no error)', () => {
    const running = wfStep(initialWorkflow(), { type: 'send', text: 'organise it' }).state
    const r = wfStep(running, { type: 'send', text: 'skip the stickies' })
    expect(r.state).toEqual(running)
    expect(r.effects).toEqual([{ type: 'steer', text: 'skip the stickies' }])
  })

  it('the dev stub plays a job: "job demo", then go or the app\'s go-on', () => {
    expect(pickScript('job demo')).toBe('job')
    expect(pickScript('The changes were applied (1). Go on with step 2 of 3: Add the second idea.')).toBe('job')
    expect(pickScript('go', 'Say go and I will do it step by step: each step waits in the preview for you.')).toBe('job')
  })
})

describe('the loop: steering between steps, the job in the context', () => {
  it('words sent while it works reach the model at its next step, as the person\'s message, kept in the history', async () => {
    const queue = ['also tag them #rival']
    const m = stubModel([{ calls: [{ name: 'where_am_i', args: {} }] }, { calls: [{ name: 'where_am_i', args: {} }] }, { answer: 'done' }])
    const { history } = await runTurn(m, makeEnv(loadFixture('medium')), AGENT_TOOLS, [], 'organise', { steer: () => queue.splice(0) })
    expect(m.seen[0].messages.some((x) => x.role === 'user' && x.content.includes('#rival'))).toBe(false)
    const second = m.seen[1].messages
    expect(second[second.length - 1]).toEqual({ role: 'user', content: STEER('also tag them #rival') })
    expect(history.filter((x) => x.role === 'user').map((x) => x.content)).toEqual(['organise', STEER('also tag them #rival')])
  })

  it('the job is read with where the person is, every turn', async () => {
    const env = makeEnv(loadFixture('medium'))
    env.job!.set(plan())
    const m = stubModel([{ answer: 'ok' }])
    await runTurn(m, env, AGENT_TOOLS, [], 'go')
    const where = m.seen[0].messages.find((x) => x.role === 'system' && x.content.startsWith('## Where the person is now'))!
    expect(where.content).toMatch(/## The job: Organise Pazar \(planned; 0\/3 settled\)/)
  })
})

describe('the job saved with the chat (firestore.rules: body.job)', () => {
  it('saved as plain values the rule takes; a running one reopens paused; the body check knows the field', async () => {
    const { chatDocs, chatProblems, reopenedJob, savedJob } = await import('../../src/agent/chats')
    const j: Job = { ...(progressJob(plan(), { step: 1, state: 'doing' }) as Job), paused: undefined, stopAfter: undefined, tokens: 1234.6 }
    const saved = savedJob(j)!
    expect(Object.values(saved).includes(undefined)).toBe(false)
    expect('paused' in saved || 'stopAfter' in saved).toBe(false)
    expect(saved.tokens).toBe(1235)
    expect(savedJob(null)).toBeUndefined()
    const { summary, body } = chatDocs({ uid: 'u', model: 'm', turns: [], ids: { v: 1, next: {}, ids: {} }, now: 1, job: j })
    expect(body.job?.status).toBe('running')
    expect(chatProblems(summary as never, body as never)).toEqual([])
    expect(chatProblems(summary as never, { ...body, job: { ...saved, status: 'hacked' } } as never)).toEqual(['body: job'])
    expect(reopenedJob(saved)).toMatchObject({ status: 'paused', paused: 'the chat was reopened' })
    expect(reopenedJob({ ...saved, status: 'done' })?.status).toBe('done')
    expect(reopenedJob(undefined)).toBeNull()
  })
})
