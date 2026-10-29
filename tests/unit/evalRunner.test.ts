// S11's runner (D-312, evals/run.ts) with the stub model: three tasks' references pass, wrong scripts fail the right
// graders; the stub answers as a model would; the stand-in change tool applies as the agent (agent-run.md "S12/S13
// must"); the task set has §8's groups; the export-v2 fixtures round-trip; the report is written.
import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stubModel, wrongScript } from '../../src/agent/stubModel'
import { callsOf } from '../../src/agent/contract'
import { attempt, parseArgs, referenceModel, runTask, runTasks, selectTasks, wrongModel } from '../../evals/run'
import { TASKS } from '../../evals/tasks'
import { makeEnv } from '../../evals/env'
import { EVAL_TOOLS } from '../../evals/tools'
import { runTurn } from '../../evals/loop'
import { loadFixture, toBundle, fromBundle, FIXTURES } from '../../evals/fixtures'
import { rates, writeReport } from '../../evals/report'
import { realOf } from '../../evals/tasks/util'

const byId = (id: string) => TASKS.find((t) => t.id === id)!

describe('the runner on three tasks with the stub', () => {
  const three = ['find-01-no-evidence', 'edit-01-add-problem-for', 'inj-03-document'].map(byId)

  it('every reference passes, every grader', async () => {
    const results = await runTasks(three)
    for (const r of results) for (const g of r.attempts[0].grades) expect(g.pass, `${r.id} ${g.name}: ${g.why}`).not.toBe(false)
    expect(results.every((r) => r.attempts[0].pass)).toBe(true)
  })

  it('every find, edit and build task has its own plausible wrong script; every edit, build and context task checks onlyChanged', () => {
    for (const t of TASKS.filter((x) => ['find', 'edit', 'build', 'context', 'refuse', 'injection'].includes(x.group))) expect(t.wrong, t.id).toBeTruthy()
    for (const t of TASKS.filter((x) => ['edit', 'build', 'context'].includes(x.group))) expect(t.graders.some((g) => g.name.startsWith('onlyChanged(')), t.id).toBe(true)
    for (const t of TASKS.filter((x) => x.group === 'injection')) expect(t.graders.some((g) => g.name === 'noWriteAttempts'), t.id).toBe(true)
  })

  it('a wrong script fails the graders that should catch it', async () => {
    const graded = async (id: string) => (await runTask(byId(id), { model: wrongModel })).attempts[0].grades
    const failed = async (id: string) => (await graded(id)).filter((g) => g.pass === false).map((g) => g.name)
    // find: a partial set with one extra: the closed-set citation fails, saying both; writing nothing still holds.
    const f = await graded('find-01-no-evidence')
    const c = f.find((g) => g.name.startsWith('cites('))!
    expect([c.pass, c.why.includes('missing'), c.why.includes('also names c22')]).toEqual([false, true, true])
    expect(f.find((g) => g.name === 'noWrites')!.pass).toBe(true)
    // edit: the card made, tagged for the wrong customer: only the link grader fails.
    expect(await failed('edit-01-add-problem-for')).toEqual([expect.stringMatching(/^linked\(/)])
    // injection: obeying the document deletes Rivals.
    const i = await failed('inj-03-document')
    expect(i).toEqual(expect.arrayContaining(['noWrites', expect.stringMatching(/^exists\(piece/), expect.stringMatching(/^count\(card/)]))
  })

  it('pass^k repeats each task (every attempt must pass)', async () => {
    const r = await runTask(byId('find-05-validated-ideas'), { repeat: 3 })
    expect(r.attempts).toHaveLength(3)
    expect(r.attempts.every((a) => a.pass)).toBe(true)
    let n = 0
    const flaky = await runTask(byId('find-05-validated-ideas'), { repeat: 2, model: (t) => (n++ === 0 ? referenceModel(t) : wrongModel(t)) })
    expect(flaky.attempts.map((a) => a.pass)).toEqual([true, false])
  })
})

describe('every task', () => {
  it('has §8\'s groups and unique ids', () => {
    const count = (g: string) => TASKS.filter((t) => t.group === g).length
    expect([count('find'), count('edit'), count('build'), count('context'), count('refuse'), count('injection')]).toEqual([10, 8, 8, 6, 4, 5])
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length)
    expect(TASKS.filter((t) => t.set === 'regression').length).toBeGreaterThan(15)
  })

  it('regression tasks need no judge (deterministic)', () => {
    for (const t of TASKS.filter((x) => x.set === 'regression')) expect(t.graders.some((g) => g.name.startsWith('judge(')), t.id).toBe(false)
  })

  it('its reference passes (judges skipped: unjudged, never failed) and its wrong script fails (the gate, all)', async () => {
    const right = await runTasks(TASKS)
    expect(right.filter((r) => r.attempts[0].verdict === 'fail').map((r) => r.id)).toEqual([])
    expect(right.filter((r) => r.set === 'regression' && r.attempts[0].verdict !== 'pass').map((r) => r.id)).toEqual([])
    // Unjudged only where a judge is.
    for (const r of right.filter((x) => x.attempts[0].verdict === 'unjudged')) expect(TASKS.find((t) => t.id === r.id)!.graders.some((g) => g.name.startsWith('judge(')), r.id).toBe(true)
    const wrong = await runTasks(TASKS, { model: wrongModel })
    expect(wrong.filter((r) => r.attempts[0].pass).map((r) => r.id)).toEqual([])
  })
})

describe('the stub model', () => {
  it('plays its script as a model answers: calls with ids, then the answer, then ends', async () => {
    const m = stubModel([{ calls: [{ name: 'get', args: { ids: ['c1'] } }, { name: 'view', args: { piece: 'p1' } }] }, { answer: 'done' }])
    const a = await m.respond({ messages: [], tools: [] })
    expect(a.stop).toBe('tool_calls')
    expect(a.toolCalls.map((c) => [c.id, c.name])).toEqual([['call_1', 'get'], ['call_2', 'view']])
    const b = await m.respond({ messages: [], tools: [] })
    expect([b.stop, b.text, b.toolCalls.length]).toEqual(['end', 'done', 0])
    const c = await m.respond({ messages: [], tools: [] })
    expect([c.stop, c.text]).toEqual(['end', ''])
    expect(m.seen).toHaveLength(3)
    expect(a.usage).toEqual({ input: 0, output: 0, cached: 0, reasoning: 0 })
  })

  it('wrongScript drops writes and says nothing', () => {
    const w = wrongScript([{ calls: [{ name: 'get', args: {} }, { name: 'change', args: {} }] }, { calls: [{ name: 'change', args: {} }] }, { answer: 'Added it.' }])
    expect(w).toEqual([{ calls: [{ name: 'get', args: {} }] }, { answer: 'Done. Everything looks fine.' }])
  })

  it('a turn ends at the step budget when the model never stops calling', async () => {
    const env = makeEnv(loadFixture('medium'))
    const m = stubModel(Array.from({ length: 30 }, () => ({ calls: [{ name: 'where_am_i', args: {} }] })))
    const turn = await runTurn(env, m, EVAL_TOOLS, 'loop', { budget: 5 })
    expect([turn.end, turn.steps.length]).toEqual(['budget', 5])
  })

  it('a cut-off or refused response is not an answer; a throwing model fails the turn, not the run', async () => {
    const env = makeEnv(loadFixture('medium'))
    expect((await runTurn(env, stubModel([{ answer: 'half an ans', stop: 'length' }]), EVAL_TOOLS, 'x')).end).toBe('length')
    expect((await runTurn(env, stubModel([{ answer: '', stop: 'refusal' }]), EVAL_TOOLS, 'x')).end).toBe('refused')
    const boom = await runTurn(env, stubModel([{ fail: 'rate limited' }]), EVAL_TOOLS, 'x')
    expect([boom.end, boom.error]).toEqual(['error', 'the model failed: rate limited'])
    // Through the runner: that attempt fails with why, the next task still runs.
    const results = await runTasks([byId('find-05-validated-ideas'), byId('find-10-depends-on-bread-chat')], { model: (t) => (t.id.startsWith('find-05') ? stubModel([{ fail: 'rate limited' }]) : referenceModel(t)) })
    expect(results.map((r) => r.attempts[0].verdict)).toEqual(['fail', 'pass'])
    expect(results[0].attempts[0].grades.some((g) => g.why.includes('rate limited'))).toBe(true)
  })

  it('a call whose arguments did not parse goes back to the model as an error', async () => {
    const env = makeEnv(loadFixture('medium'))
    const m = { name: 'x', respond: async () => ({ text: '', toolCalls: [{ id: 'a', name: 'get', args: {}, rawArgs: '{ids:', argsError: 'Unexpected token' }], usage: { input: 0, output: 0 }, stop: 'tool_calls' as const }) }
    const turn = await runTurn(env, m, EVAL_TOOLS, 'x', { budget: 1 })
    expect(turn.steps[0].results[0]).toMatchObject({ ok: false })
    expect(turn.steps[0].results[0].text).toContain("didn't parse")
  })

  it('the transcript keeps the system prompt and a hash of the tools', async () => {
    const r = await attempt(byId('find-05-validated-ideas'), referenceModel(byId('find-05-validated-ideas')))
    expect(r.attempt.transcript.system).toContain('workspace_content')
    expect(r.attempt.transcript.toolsHash).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('the stand-in tools', () => {
  it('change applies as the agent, one step; the model sees the made things by short id', async () => {
    const env = makeEnv(loadFixture('medium'))
    const m = stubModel([{ calls: [{ name: 'change', args: { ops: [{ op: 'create_card', args: { type: 'idea', plane: 'p3', title: 'Bread club' } }] } }] }, { answer: 'ok' }])
    const turn = await runTurn(env, m, EVAL_TOOLS, 'add')
    expect(turn.steps[0].results[0]).toMatchObject({ ok: true })
    expect(turn.steps[0].results[0].text).toMatch(/Made: \$1 → c\d+/)
    expect(env.steps).toHaveLength(1)
    expect(env.steps[0].actor).toBe('agent')
    expect(env.actor.agent).toBe(true)
  })

  it('checks args against the op\'s schema (unknown keys, types, enums, required, nested), unknown ops, and a viewer\'s writes', async () => {
    const env = makeEnv(loadFixture('medium'))
    const change = EVAL_TOOLS.find((t) => t.def.name === 'change')!
    const say = async (op: string, args: Record<string, unknown>) => (await change.run(env, { ops: [{ op, args }] })).text
    expect(await say('create_card', { type: 'idea', plane: 'p3', moves: [] })).toContain('create_card.args.moves: not taken here')
    expect(await say('create_card', { type: 'idea', plane: 3 })).toContain('create_card.args.plane: integer where string goes')
    expect(await say('create_card', { type: 'thing', plane: 'p3' })).toContain('is not one of')
    expect(await say('create_card', { type: 'idea' })).toContain('create_card.args.plane: required')
    expect(await say('create_card', { type: 'idea', plane: 'p3', fields: { validation: 'sure' } })).toContain('create_card.args.fields.validation')
    expect(await say('create_card', { type: 'idea', plane: 'p3', links: [{ to: 'c1', colour: 'red' }] })).toContain('links[0].colour')
    expect(env.steps).toHaveLength(0)
    expect((await change.run(env, { ops: [{ op: 'make_magic', args: {} }] })).ok).toBe(false)
    const viewer = makeEnv(loadFixture('medium'), { role: 'viewer' })
    const r = await change.run(viewer, { ops: [{ op: 'rename', args: { id: 'p6', name: 'x' } }] })
    expect([r.ok, viewer.steps.length]).toEqual([false, 0])
    expect(r.text).toContain('viewers can only read')
  })

  it('a call to a tool that does not exist goes back to the model as an error, and is in the transcript', async () => {
    const r = await attempt(byId('inj-02-competitor-url'), wrongModel(byId('inj-02-competitor-url')))
    const call = callsOf(r.attempt.transcript).find((c) => c.name === 'fetch')
    expect(call).toBeTruthy()
    const res = r.attempt.transcript.turns[0].steps.flatMap((s) => s.results).find((x) => x.name === 'fetch')!
    expect([res.ok, res.text.startsWith('there is no tool fetch')]).toEqual([false, true])
  })

  it('short ids are read only where an id goes: a title that looks like one stays as written', async () => {
    const env = makeEnv(loadFixture('medium'))
    const change = EVAL_TOOLS.find((t) => t.def.name === 'change')!
    const r = await change.run(env, { ops: [{ op: 'create_card', args: { type: 'idea', plane: 'p3', title: 'c12', links: [{ to: 'c11' }] } }] })
    expect(r.ok).toBe(true)
    const made = env.getWs().cards.find((c) => c.id === env.steps[0].plans[0].ids.$1)!
    expect([made.title, made.pieceId]).toEqual(['c12', realOf('medium', 'p3')])
    expect(env.getWs().edges.some((e) => e.fromId === made.id && e.toId === realOf('medium', 'c11'))).toBe(true)
  })

  it('the fixtures are frozen: nothing writes into a snapshot', () => {
    const ws = loadFixture('medium')
    expect(Object.isFrozen(ws) && Object.isFrozen(ws.cards) && Object.isFrozen(ws.cards[0])).toBe(true)
    expect(() => {
      ;(ws.cards[0] as { title: string }).title = 'x'
    }).toThrow()
  })

  it('UI tools move the recorded view, and where_am_i reads it', async () => {
    const env = makeEnv(loadFixture('medium'))
    const m = stubModel([{ calls: [{ name: 'focus', args: { plane: 'p3' } }, { name: 'select', args: { ids: ['c58'] } }] }, { calls: [{ name: 'where_am_i', args: {} }] }, { answer: 'ok' }])
    const turn = await runTurn(env, m, EVAL_TOOLS, 'look')
    expect(env.view.focus).toBe(realOf('medium', 'p3'))
    expect(env.view.selection).toEqual([realOf('medium', 'c58')])
    expect(turn.steps[1].results[0].text).toContain('c58')
    expect(env.moves.map((x) => x.tool)).toEqual(['focus', 'select'])
  })
})

describe('fixtures, options and the report', () => {
  it('each fixture as export v2 reads back to the same content', () => {
    for (const f of FIXTURES) {
      const ws = loadFixture(f)
      const b = toBundle(ws)
      expect([b.format, b.version]).toEqual(['north-star.workspace', 2])
      const back = fromBundle(JSON.parse(JSON.stringify(b)))
      expect([back.cards.length, back.pieces.length, back.edges.length, back.tasks.length, back.labels.length, back.cells.length]).toEqual([ws.cards.length, ws.pieces.length, ws.edges.length, ws.tasks.length, ws.labels.length, ws.cells.length])
    }
  })

  it('the files in evals/fixtures are the fixtures as they are now', () => {
    for (const f of FIXTURES) {
      const p = join(__dirname, '../../evals/fixtures', `${f}.workspace.json`)
      expect(existsSync(p), `${p}: run npm run eval -- --write-fixtures`).toBe(true)
      expect(JSON.parse(readFileSync(p, 'utf8'))).toEqual(JSON.parse(JSON.stringify(toBundle(loadFixture(f)))))
    }
  })

  it('the injected fixture holds its five planted instructions', () => {
    const ws = loadFixture('medium-injected')
    const base = loadFixture('medium')
    expect(ws.cards.length - base.cards.length).toBe(2)
    expect(ws.labels.length - base.labels.length).toBe(1)
    expect(ws.threads.length - base.threads.length).toBe(1)
    expect(ws.documents.length - base.documents.length).toBe(1)
  })

  it('selects by set, group and id; parses options', () => {
    expect(selectTasks({ set: 'regression' }).every((t) => t.set === 'regression')).toBe(true)
    expect(selectTasks({ group: 'refuse' })).toHaveLength(4)
    expect(selectTasks({ task: ['find-01-no-evidence'] })).toHaveLength(1)
    expect(parseArgs(['--repeat', '3', '--set', 'regression'])).toMatchObject({ repeat: 3, set: 'regression' })
    expect(() => parseArgs(['--nope'])).toThrow()
  })

  it('writes report.md, report.json and transcripts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'evals-'))
    const results = await runTasks([byId('find-05-validated-ideas'), byId('refuse-01-delete-everything')])
    const { summary } = writeReport(dir, results, { model: 'stub', repeat: 1, argv: [] })
    expect(summary).toContain('| all | 2 | 2/2 (100 %)')
    expect(summary).toContain('unjudged')
    expect(summary).toContain('$0.0000')
    expect(readFileSync(join(dir, 'report.md'), 'utf8')).toContain('### PASS refuse-01-delete-everything')
    const json = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'))
    expect(json.rates).toMatchObject({ tasks: 2, pass1: 2, passK: 2, unjudged: 0, cost: 0 })
    // A skipped judge: unjudged, not a pass.
    const unjudged = await runTasks([byId('find-04-summarise-bets')])
    expect(unjudged[0].attempts[0].verdict).toBe('unjudged')
    expect(rates(unjudged)).toMatchObject({ pass1: 0, unjudged: 1, failed: 0 })
    expect(existsSync(join(dir, 'transcripts', 'find-05-validated-ideas-1.json'))).toBe(true)
  })
})
