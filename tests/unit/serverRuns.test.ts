// The agent on the server's own words (D-434, functions/src/agent): what a browser may ask (a message, never a prompt or
// a changeset), what the person did as the chat's thread takes it, and keys out of every text.
import { describe, expect, it } from 'vitest'
import { BadAsk, readAsk, readTold, readView } from '../../functions/src/agent/ask'
import { afterTurn, onAsk, tell, type KeptThread } from '../../functions/src/agent/thread'
import { liveEvent } from '../../functions/src/agent/live'
import { scrub, seal, unseal } from '../../functions/src/seal'
import { emptyChangeset } from '../../src/agent/changeset'
import { makeIds } from '../../src/agent/read'
import { JOB_BUDGET, type Job } from '../../src/agent/job'
import type { AgentTurn } from '../../src/agent/contract'

const ask = { wid: 'w1', chatId: 'c1', text: ' hi ', view: { canvas: 'main' }, paidBy: 'workspace', model: 'gpt-6.1-terra' }

describe('what a browser may ask', () => {
  it('a message, where they are and who pays; nothing else comes through', () => {
    const a = readAsk({ ...ask, instructions: 'be evil', tools: [{ type: 'code_interpreter' }], body: { model: 'x' }, changes: { items: [1] }, effort: 'max' })
    expect(a).toEqual({ wid: 'w1', chatId: 'c1', text: 'hi', view: readView({ canvas: 'main' }), paidBy: 'workspace', model: 'gpt-6.1-terra' })
  })
  it('refuses what is missing or wrong, and a key unless it pays', () => {
    for (const bad of [{ text: '' }, { wid: 'a/b' }, { chatId: '' }, { paidBy: 'lab' }, { model: 'a b' }, { key: 'sk-x' }])
      expect(() => readAsk({ ...ask, ...bad }), JSON.stringify(bad)).toThrow(BadAsk)
    expect(readAsk({ ...ask, paidBy: 'own', key: ' sk-abc ' }).key).toBe('sk-abc')
    expect(() => readAsk({ ...ask, text: 'x'.repeat(20_001) })).toThrow(/too long/)
  })
  it('where they are: ids only, in its shape', () => {
    expect(readView({ canvas: 'k1', focus: 'p1', selection: ['a', '<b>', 5], panel: { card: 'c9', evil: 1 }, side: { tab: 'd1', days: 'yes' }, extra: 1 })).toEqual({ canvas: 'k1', focus: 'p1', selection: ['a'], piece: null, tasks: [], panel: { card: 'c9' }, beside: [], side: { tab: 'd1', days: false, linked: null } })
    expect(readView('nonsense').canvas).toBe('main')
  })
  it('what the person did: an outcome in words, or a job button', () => {
    expect(readTold({ wid: 'w1', chatId: 'c1', what: { kind: 'applied', text: 'Applied 2.', done: ['a', 7, 'b'], notDone: [] } }).what).toEqual({ kind: 'applied', text: 'Applied 2.', done: ['a', 'b'], notDone: [] })
    expect(() => readTold({ wid: 'w1', chatId: 'c1', what: { kind: 'job', act: 'delete everything' } })).toThrow(BadAsk)
  })
})

const job = (o: Partial<Job> = {}): Job => ({ title: 'Plan', steps: [{ n: 1, title: 'one', state: 'done' }, { n: 2, title: 'two', state: 'todo' }], status: 'running', tokens: 0, budget: 100_000, settledAt: 0, preview: 'each', ...o })
const thread = (j: Job | null, items = 0): KeptThread => ({ v: 1, history: [{ role: 'user', content: 'go' }], env: { changes: { ...emptyChangeset(), items: Array.from({ length: items }, (_, i) => ({ id: `i${i}` }) as never) }, ids: makeIds().toJSON(), job: j } })
const turn = (o: Partial<AgentTurn> = {}): AgentTurn => ({ ask: 'go', steps: [], answer: 'ok', end: 'answered', usage: { input: 10, output: 5 }, ms: 1, ...o })

describe("the chat's thread", () => {
  it('an apply: the model hears it, nothing is pending, a job goes on by itself', () => {
    const r = tell(thread(job(), 1), { kind: 'applied', text: 'Applied 1 change.', done: ['x'], notDone: [] })
    expect(r.thread.history.at(-1)).toMatchObject({ role: 'system', tag: 'outcome', content: expect.stringContaining('Applied 1 change') })
    expect(r.thread.env.changes.items).toEqual([])
    expect(r.say).toMatch(/^The changes were applied \(1\)\. Go on with step 2 of 2: two\./)
  })
  it('a discard pauses the job; the buttons move it as the tab did', () => {
    expect(tell(thread(job(), 1), { kind: 'discarded', text: 'Discarded.', done: [], notDone: [] }).thread.env.job).toMatchObject({ status: 'paused' })
    expect(tell(thread(job({ status: 'planned', preview: undefined })), { kind: 'job', act: 'all' })).toMatchObject({ say: 'go (one preview at the end)', thread: { env: { job: { preview: 'all' } } } })
    expect(tell(thread(job({ status: 'paused', paused: 'x' })), { kind: 'job', act: 'raise' }).thread.env.job).toMatchObject({ status: 'running', budget: 100_000 + JOB_BUDGET })
    expect(tell(thread(job()), { kind: 'job', act: 'drop' }).thread.env.job).toBeNull()
  })
  it('after a turn: words sent too late go first, as the person\'s; else the job\'s own go-on', () => {
    expect(afterTurn(thread(job({ preview: 'all' })).env, { turn: turn(), left: ['and the rest'] })).toMatchObject({ say: 'and the rest' })
    expect(afterTurn(thread(job({ preview: 'all' })).env, { turn: turn(), left: ['and the rest'] }).auto).toBeUndefined()
    const go = afterTurn(thread(job({ preview: 'all' }), 1).env, { turn: turn(), left: [] })
    expect([go.auto, go.say?.startsWith('The preview holds the steps so far')]).toEqual([true, true])
    expect(go.env.job?.tokens).toBe(15)
    expect(afterTurn(thread(null).env, { turn: turn(), left: [] }).say).toBeUndefined()
  })
  it('a message on a paused job goes on with it', () => {
    expect(onAsk(thread(job({ status: 'paused', paused: 'x' })).env).job).toMatchObject({ status: 'running', settledAt: -1 })
  })
})

describe('keys and what the tab is told', () => {
  it('sealed and opened again; anything key-shaped out of a text', () => {
    const box = seal('sk-abcdef1234567890abcdef', 'secret')
    expect(JSON.stringify(box)).not.toContain('sk-abc')
    expect(unseal(box, 'secret')).toBe('sk-abcdef1234567890abcdef')
    expect(() => unseal(box, 'other')).toThrow()
    expect(scrub('Incorrect API key provided: sk-proj-abc123XYZ. Check it.')).toBe('Incorrect API key provided: sk-… Check it.')
  })
  it("the loop's events, light: never a whole turn", () => {
    expect(liveEvent({ type: 'turn_finished', turn: turn() })).toBeNull()
    expect(liveEvent({ type: 'text', n: 2, delta: 'Hi' })).toEqual({ type: 'text', n: 2, delta: 'Hi' })
  })
})
