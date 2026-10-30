// S12's dev stub model (D-312, src/agent/devStub.ts): its four scripts played through the real loop and the real tools
// on the medium fixture (a question answered with cited items after a search and a get; a small edit as one change
// proposed, then applied as the agent; a refusal with no tools; a plan for a big job with no writes); it streams; it stops when asked.
// And it is never in a production build: models.ts built for production must not hold DEV_STUB_MARK.
import { describe, expect, it } from 'vitest'
import { build } from 'vite'
import { resolve } from 'node:path'
import { devStubModel, pickScript, DEV_STUB_MARK } from '../../src/agent/devStub'
import { runTurn } from '../../src/agent/loop'
import { AGENT_TOOLS } from '../../src/agent/tools'
import { makeModel } from '../../src/agent/models'
import { callsOf, type Transcript } from '../../src/agent/contract'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'

const fast = { thinkMs: 0, wordMs: 0 }

async function play(ask: string) {
  const env = makeEnv(loadFixture('medium'))
  const transcript: Transcript = { model: 'dev stub', startedAt: 0, turns: [] }
  const deltas: string[] = []
  const { turn } = await runTurn(devStubModel(env, fast), env, AGENT_TOOLS, [], ask, { transcript, onEvent: (e) => e.type === 'text' && deltas.push(e.delta) })
  // S13: what the turn proposed is applied when the person accepts the preview.
  await env.accept()
  return { env, turn, calls: callsOf(transcript).map((c) => c.name), deltas }
}

describe('the dev stub', () => {
  it('picks a script by the words of the message', () => {
    expect(['Which problems are about bread?', 'add a problem "Rain keeps buyers away"', 'build a competitor matrix', 'make me an owner', 'delete everything'].map((a) => pickScript(a))).toEqual(['question', 'edit', 'plan', 'refuse', 'refuse'])
  })

  it('a question: search, then get the hits, then an answer citing them by real short id; streamed; no writes', async () => {
    const { env, turn, calls, deltas } = await play('What do we know about bread?')
    expect(turn.end).toBe('answered')
    expect(calls).toEqual(['search', 'get'])
    const cited = turn.answer.match(/\b[ctd]\d+\b/g) ?? []
    expect(cited.length).toBeGreaterThan(0)
    for (const s of cited) expect(env.ids.real(s), s).toBeTruthy()
    expect(deltas.join('')).toBe(turn.answer)
    expect(env.steps).toHaveLength(0)
  })

  it('a small edit: reads first, one change applied as the agent (one undo step), the answer names the new card', async () => {
    const { env, turn, calls } = await play('Add a problem "Rain keeps buyers away"')
    expect(calls).toEqual(['where_am_i', 'query', 'view', 'change'])
    expect(env.steps.map((s) => [s.actor, s.ops])).toEqual([['agent', ['create_card']]])
    const made = env.getWs().cards.find((c) => c.title === 'Rain keeps buyers away')!
    expect(made.type).toBe('problem')
    const short = env.ids.has('card', made.id)!
    expect(turn.answer).toContain(short)
    expect(turn.answer).toContain('undo')
  })

  it('a refusal: no tools, no writes', async () => {
    const { env, turn, calls } = await play('Change Bob\'s role to owner')
    expect([calls, env.steps.length, turn.end]).toEqual([[], 0, 'answered'])
    expect(turn.answer).toMatch(/can't change members, roles/)
  })

  it('a big job: reads, then a numbered plan waiting for go; nothing written', async () => {
    const { env, turn, calls } = await play('Build a competitor matrix for our features')
    expect(calls).toEqual(['view', 'query'])
    expect(turn.answer).toMatch(/1\. .*\n2\. .*\n3\. /)
    expect(turn.answer).toMatch(/Say go/)
    expect(env.steps).toHaveLength(0)
  })

  it('"go" after its plan carries it out in one change, as the agent; "go" with no plan before is just a question', async () => {
    const env = makeEnv(loadFixture('medium'))
    const model = devStubModel(env, fast)
    const first = await runTurn(model, env, AGENT_TOOLS, [], 'Build a competitor matrix for our features')
    expect(env.steps).toHaveLength(0)
    const transcript: Transcript = { model: 'dev stub', startedAt: 0, turns: [] }
    const second = await runTurn(model, env, AGENT_TOOLS, first.history, 'go', { transcript })
    expect(env.steps).toHaveLength(0)
    await env.accept()
    expect(callsOf(transcript).map((c) => c.name)).toEqual(['change'])
    expect(env.steps.map((s) => [s.actor, s.ops])).toEqual([['agent', ['create_piece']]])
    expect(env.getWs().pieces.some((p) => p.kind === 'matrix' && p.name === 'Features vs competitors')).toBe(true)
    expect(second.turn.answer).toMatch(/^Ready, as planned: p\d+ "Features vs competitors"/)
    // A deck plan makes a deck with three tasks.
    const env2 = makeEnv(loadFixture('medium'))
    const m2 = devStubModel(env2, fast)
    const plan = await runTurn(m2, env2, AGENT_TOOLS, [], 'Make a deck of tasks to test our riskiest idea')
    await runTurn(m2, env2, AGENT_TOOLS, plan.history, 'yes')
    await env2.accept()
    expect(env2.steps[0].ops).toEqual(['create_piece', 'create_task', 'create_task', 'create_task'])
    expect(pickScript('go')).toBe('question')
  })

  it('stops when asked, mid-stream', async () => {
    const env = makeEnv(loadFixture('medium'))
    const ac = new AbortController()
    setTimeout(() => ac.abort(), 30)
    const { turn } = await runTurn(devStubModel(env, { thinkMs: 5, wordMs: 15 }), env, AGENT_TOOLS, [], 'Which problems are about bread and rain and queues?', { signal: ac.signal })
    expect(turn.end).toBe('stopped')
  })

  it('makeModel gives the stub only when asked, in dev (vitest runs as dev)', async () => {
    const env = makeEnv(loadFixture('medium'))
    expect((await makeModel({ model: 'gpt-5.6-terra', env, stub: true })).name).toBe('dev stub')
    expect((await makeModel({ model: 'gpt-5.6-terra', key: 'sk-test-x', env, stub: false })).name).toBe('gpt-5.6-terra')
  })
})

describe('never in production', () => {
  it('models.ts built for production drops the dev stub (import.meta.env.DEV is false, the import is dead code)', async () => {
    const root = resolve(__dirname, '../..')
    // As `npm run build` runs: NODE_ENV production (vitest sets it to test, which would keep DEV true).
    const was = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const out = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      mode: 'production',
      build: { write: false, minify: false, lib: { entry: resolve(root, 'src/agent/models.ts'), formats: ['es'], fileName: 'models' }, rollupOptions: { external: [/^firebase/, /^react/, /^zustand/] } },
    }).finally(() => {
      process.env.NODE_ENV = was
    })
    const outputs = (Array.isArray(out) ? out : [out]) as { output: { type: string; code?: string; fileName: string }[] }[]
    const code = outputs.flatMap((o) => o.output.map((c) => c.code ?? '')).join('\n')
    const files = outputs.flatMap((o) => o.output.map((c) => c.fileName))
    expect(code.length).toBeGreaterThan(1000)
    expect(code).toContain('gpt-5.6-terra')
    expect(code).not.toContain(DEV_STUB_MARK)
    expect(code).not.toContain('devStubModel')
    expect(files.some((f) => /devStub/i.test(f))).toBe(false)
  }, 30_000)
})

// S17: one script per `/` command, on the medium fixture through the real loop and tools: every turn answers, every
// change it proposes is accepted (nothing refused), big jobs plan first and run on "go", answers cite real ids.
describe('the dev stub skills', () => {
  const ASKS: [string, string[]][] = [
    ['/ask what solves the bread problems?', []],
    ['/gaps', []],
    ['/next', []],
    ['/next as tasks on Research', []],
    ['/digest', []],
    ['/review-deck Sprint', []],
    ['/test "Pre-order bread for pickup"', ['go']],
    ['/compare Roadmap', ['go']],
    ['/prioritize Pricing', ['go']],
    ['/organize the competitors on Rivals by region', ['go']],
    ['/sort-stickies Bets', ['go']],
    ['/learn Talked to Elif, an organic farmer: "I throw away a crate of greens every evening."', []],
    ['/dedupe customers', ['yes']],
    ['/import problems for Segments:\n- Ovens break down on Saturdays\n- Flour prices doubled', []],
    ['/interview "Bakers near the tram"', []],
    ['/swot', []],
    ['/one-pager', []],
    ['/pitch', []],
    ['/lean-canvas', []],
  ]
  for (const [ask, then] of ASKS)
    it(ask.split('\n')[0], async () => {
      const env = makeEnv(loadFixture('medium'))
      const model = devStubModel(env, fast)
      let history: Awaited<ReturnType<typeof runTurn>>['history'] = []
      const turns = []
      for (const a of [ask, ...then]) {
        const r = await runTurn(model, env, AGENT_TOOLS, history, a)
        history = r.history
        turns.push(r.turn)
        expect(r.turn.end, a).toBe('answered')
        expect(r.turn.answer.length, a).toBeGreaterThan(20)
        expect(r.turn.answer, a).not.toMatch(/refused|Nothing changed/)
        for (const s of r.turn.answer.match(/\b[ctp]\d+\b/g) ?? []) expect(env.ids.real(s), `${a}: ${s}`).toBeTruthy()
      }
      if (then.length) expect(turns[0].answer).toMatch(/Say go|Merge them\?/)
      if (env.changes?.items.length) {
        const a = await env.accept()
        expect(a.ok).toBe(true)
        expect(env.steps.map((s) => s.actor)).toEqual(['agent'])
      }
    })
})
