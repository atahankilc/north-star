// S11's graders (D-312, evals/graders.ts) on hand-made RIGHT and WRONG end states: each kind passes on the right one
// and fails on the wrong one, saying why. End states are made with the real ops (buildBatch + the eval env's apply) or,
// for the wrong ones a model could leave, with ops that do the wrong thing.
import { describe, expect, it, afterEach } from 'vitest'
import { buildBatch, type Step } from '../../src/ops/registry'
import type { Plan } from '../../src/ops/types'
import { NO_USAGE, type ToolCall, type Transcript } from '../../src/agent/contract'
import { makeEnv, type EvalEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'
import { realOf } from '../../evals/tasks/util'
import * as G from '../../evals/graders'
import type { Grader, RunResult } from '../../evals/types'

const R = (s: string) => realOf('medium', s)

function transcript(answer: string, calls: { name: string; args: Record<string, unknown> }[] = []): Transcript {
  const toolCalls: ToolCall[] = calls.map((c, i) => ({ id: `call_${i + 1}`, ...c }))
  return {
    model: 'test',
    startedAt: 0,
    turns: [{ ask: 'test', steps: [...(toolCalls.length ? [{ n: 1, text: '', toolCalls, results: [], usage: { ...NO_USAGE }, ms: 0, stop: 'tool_calls' as const }] : []), { n: 2, text: answer, toolCalls: [], results: [], usage: { ...NO_USAGE }, ms: 0, stop: 'end' as const }], answer, end: 'answered', usage: { ...NO_USAGE }, ms: 0 }],
  }
}

const plansOf = (env: EvalEnv, steps: Step[]): Plan[] => buildBatch({ ws: env.getWs(), actor: env.actor, now: env.now(), newId: env.newId }, steps)

// A run: each list of ops applied in a turn of its own (one undo step each; `oneTurn`: all in one turn), the answer
// and calls given.
async function run(batches: Step[][] = [], o: { answer?: string; calls?: { name: string; args: Record<string, unknown> }[]; actor?: 'agent' | 'person'; oneTurn?: boolean; fixture?: 'medium' | 'medium-table' } = {}): Promise<RunResult> {
  const env = makeEnv(loadFixture(o.fixture ?? 'medium'))
  env.newTurn!('test')
  for (const b of batches) {
    if (!o.oneTurn) env.newTurn!('test')
    const done = await env.apply(plansOf(env, b), { actor: 'agent' })
    expect(done.ok, JSON.stringify(done)).toBe(true)
  }
  if (o.actor === 'person') for (const s of env.steps) s.actor = 'person'
  return { start: env.start, end: env.getWs(), steps: env.steps, refused: env.refused, moves: env.moves, transcript: transcript(o.answer ?? '', o.calls), answer: o.answer ?? '', ids: env.ids, view: env.ui.currentView() }
}

async function expectGrade(g: Grader, r: RunResult, pass: boolean) {
  const v = await g.grade(r)
  expect(v.pass, `${g.name}: ${v.why}`).toBe(pass)
  expect(v.why.length).toBeGreaterThan(0)
  return v
}

const NEW_PROBLEM: Step = { op: 'create_card', args: { type: 'problem', plane: R('p1'), title: 'Stalls run out of paper bags', links: [{ to: R('c11'), kind: 'for' }], handle: '$a' } }

describe('graders on the end state', () => {
  it('exists / absent / count', async () => {
    const right = await run([[NEW_PROBLEM]])
    const wrong = await run()
    const ex = G.exists('card', { type: 'problem', title: 'stalls run out of PAPER bags', plane: 'Segments' })
    await expectGrade(ex, right, true)
    await expectGrade(ex, wrong, false)
    // On the wrong plane it doesn't count.
    await expectGrade(G.exists('card', { title: 'Stalls run out of paper bags', plane: 'Bets' }), right, false)
    await expectGrade(G.absent('card', { title: 'Stalls run out of paper bags' }), wrong, true)
    await expectGrade(G.absent('card', { title: 'Stalls run out of paper bags' }), right, false)
    await expectGrade(G.count('card', { type: 'problem', plane: 'Segments' }, 1, { delta: true }), right, true)
    await expectGrade(G.count('card', { type: 'problem', plane: 'Segments' }, 1, { delta: true }), wrong, false)
    await expectGrade(G.count('card', { plane: 'Segments' }, { min: 34, max: 34 }), right, true)
    await expectGrade(G.count('card', { plane: 'Segments' }, 33), right, false)
    await expectGrade(G.exists('piece', { kind: 'deck', name: 'Research', canvas: 'main' }), wrong, true)
    await expectGrade(G.exists('piece', { kind: 'deck', name: 'Research', canvas: 'Build' }), wrong, false)
  })

  it('field (nested paths, functions, RegExp, { has })', async () => {
    const right = await run([[{ op: 'update_card', args: { card: R('c73'), fields: { validation: 'validated', tags: ['pilot'] } } }]])
    const wrong = await run([[{ op: 'update_card', args: { card: R('c73'), fields: { validation: 'invalidated' } } }]])
    await expectGrade(G.field('Swap pickup slots with neighbours', 'validation', 'validated'), right, true)
    await expectGrade(G.field('Swap pickup slots with neighbours', 'validation', 'validated'), wrong, false)
    await expectGrade(G.field('Swap pickup slots with neighbours', 'tags', { has: 'pilot' }), right, true)
    await expectGrade(G.field('Swap pickup slots with neighbours', 'tags', { has: 'pilot' }), wrong, false)
    await expectGrade(G.field('Feature coverage', 'matrix.cols.type', 'competitor', ['piece']), wrong, true)
    await expectGrade(G.field('Feature coverage', 'matrix.cols.type', /^feat/, ['piece']), wrong, false)
    await expectGrade(G.field('No such card', 'validation', 'validated'), right, false)
  })

  it('linked (kind, direction, either way)', async () => {
    const right = await run([[{ op: 'link', args: { from: R('c58'), to: R('c16'), kind: 'solves' } }]])
    const wrongKind = await run([[{ op: 'link', args: { from: R('c58'), to: R('c16'), kind: 'relates' } }]])
    const backwards = await run([[{ op: 'link', args: { from: R('c16'), to: R('c58'), kind: 'solves' } }]])
    const g = G.linked('Pre-order bread for pickup', 'Bakers carry heavy bags home on foot', 'solves')
    await expectGrade(g, right, true)
    await expectGrade(g, wrongKind, false)
    await expectGrade(g, backwards, false)
    await expectGrade(G.linked('Pre-order bread for pickup', 'Bakers carry heavy bags home on foot', 'solves', { either: true }), backwards, true)
    await expectGrade(g, await run(), false)
  })

  it('noWrites / noDeletes', async () => {
    const none = await run()
    const made = await run([[NEW_PROBLEM]])
    const deleted = await run([[{ op: 'delete', args: { ids: [R('x4')] } }]])
    await expectGrade(G.noWrites(), none, true)
    await expectGrade(G.noWrites(), made, false)
    await expectGrade(G.noDeletes(), made, true)
    const v = await expectGrade(G.noDeletes(), deleted, false)
    expect(v.why).toContain('labels/')
  })

  it('noOverlaps: only what the run made or moved counts', async () => {
    // Right: made, then put in a clear area. Wrong: moved onto another card's spot.
    const right = await run([[NEW_PROBLEM, { op: 'arrange', args: { items: ['$a'], where: { at: 'clear' } } }]])
    const c1 = loadFixture('medium').cards.find((c) => c.id === R('c1'))!
    const wrong = await run([[{ op: 'update_card', args: { card: R('c2'), x: c1.x + 25, y: c1.y + 25 } }]])
    await expectGrade(G.noOverlaps('Segments'), right, true)
    const v = await expectGrade(G.noOverlaps('Segments'), wrong, false)
    expect(v.why).toContain(R('c2'))
    // The fixture's own layout isn't graded: nothing moved, nothing counted.
    await expectGrade(G.noOverlaps('Segments'), await run(), true)
    await expectGrade(G.noOverlaps('No such plane'), right, false)
  })

  it('onPlane', async () => {
    const right = await run([[{ op: 'place_on', args: { cards: [R('c11')], plane: R('p3') } }]])
    await expectGrade(G.onPlane('Bakers near the tram', 'Bets'), right, true)
    await expectGrade(G.onPlane('Bakers near the tram', 'Segments'), right, true)
    await expectGrade(G.onPlane('Bakers near the tram', 'Bets'), await run(), false)
  })

  it('cell (rows and columns by name, a step by its label)', async () => {
    const right = await run([[{ op: 'update_cell', args: { id: R('p11'), row: 'Bread chat', col: 'Freshgo', value: 'full' } }]])
    const g = G.cell('Feature coverage', 'Bread chat', 'Freshgo', 'full')
    await expectGrade(g, right, true)
    const v = await expectGrade(g, await run(), false)
    expect(v.why).toContain('better')
    await expectGrade(G.cell('Feature coverage', 'Bread chat', 'Nobody', 'full'), right, false)
    await expectGrade(G.cell('Feature coverage', 'Prices push alerts', 'Bazaarcart', null), right, true)
  })

  it('task (column, assignee by name or uid, due, priority, card; by id when titles repeat)', async () => {
    const right = await run([[{ op: 'update_task', args: { task: R('t54'), assignee: 'u-mert', due: '2026-11-10' } }, { op: 'move_task', args: { task: R('t54'), column: 'done' } }]])
    await expectGrade(G.task('Sprint', 'Price the pickup flow', { assignee: 'Mert Kaya', due: '2026-11-10', column: 'done' }), right, true)
    await expectGrade(G.task('Sprint', 'Price the pickup flow', { assignee: 'u-mert' }), right, true)
    await expectGrade(G.task('Sprint', 'Price the pickup flow', { assignee: 'Mert Kaya' }), await run(), false)
    await expectGrade(G.task('Research', 'Price the pickup flow'), right, false)
    await expectGrade(G.task('Sprint', R('t54'), { column: 'done' }), right, true)
    await expectGrade(G.task('Sprint', R('t54'), { column: 'done' }), await run(), false)
  })
})

describe('graders on the answer and the transcript', () => {
  it('cites: every wanted item named (short id or title), nothing made up, only these', async () => {
    const want = ['Rate cheese from the stall', 'Bundle leftover produce by WhatsApp', 'Swap market maps in one tap']
    const right = await run([], { answer: 'Three: c59, c65 "Bundle leftover produce by WhatsApp" and swap market maps in one tap.' })
    await expectGrade(G.cites(want, { only: true }), right, true)
    const missing = await run([], { answer: 'c59 and c65.' })
    expect((await expectGrade(G.cites(want), missing, false)).why).toContain('missing Swap market maps')
    const madeUp = await run([], { answer: 'c59, c65, c75 and also c999.' })
    // Short ids in any case.
    await expectGrade(G.cites(want, { only: true }), await run([], { answer: 'C59, c65 and C75.' }), true)
    expect((await expectGrade(G.cites(want), madeUp, false)).why).toContain('made up c999')
    const extra = await run([], { answer: 'c59, c65, c75 and c58.' })
    await expectGrade(G.cites(want), extra, true)
    expect((await expectGrade(G.cites(want, { only: true }), extra, false)).why).toContain('also names c58')
    // `only` catches an unwanted item named by its title too; a wanted title holding a shorter one doesn't count.
    const byTitle = await run([], { answer: 'c59, c65, c75, and also "Pre-order bread for pickup".' })
    expect((await expectGrade(G.cites(want, { only: true }), byTitle, false)).why).toContain('Pre-order bread for pickup')
    await expectGrade(G.cites(['Pickup slots checkout'], { only: true }), await run([], { answer: 'Only "Pickup slots checkout".' }), true)
    // `also`: the subject may be named.
    await expectGrade(G.cites(['Cheese map'], { only: true, also: ['Bread chat'] }), await run([], { answer: 'c109 Cheese map depends on c105 Bread chat.' }), true)
    await expectGrade(G.cites(['Cheese map'], { only: true }), await run([], { answer: 'c109 Cheese map depends on c105 Bread chat.' }), false)
    // Titles match as whole words, not inside other words.
    await expectGrade(G.cites(['Freshgo']), await run([], { answer: 'Freshgoing is not a word.' }), false)
    // Priorities in capitals are not ids.
    await expectGrade(G.cites(['Rate cheese from the stall']), await run([], { answer: 'c59 is P1.' }), true)
  })

  it('answerIncludes: numbers whole (never inside a date or an id), or their words', async () => {
    await expectGrade(G.answerIncludes(['13']), await run([], { answer: 'Due 2026-10-13, and t13 is late.' }), false)
    await expectGrade(G.answerIncludes(['13']), await run([], { answer: '13 tasks are in doing.' }), true)
    await expectGrade(G.answerIncludes(['22']), await run([], { answer: 'Twenty-two ideas.' }), true)
    await expectGrade(G.answerIncludes(['5']), await run([], { answer: 'It costs 5.5 €.' }), false)
    await expectGrade(G.answerIncludes([/\b(22|twenty[- ]two)\s+ideas\b/i]), await run([], { answer: 'twenty two ideas' }), true)
  })

  it('answerIncludes / answerExcludes', async () => {
    const r = await run([], { answer: 'Only 1 in 8 stalls takes cards.' })
    await expectGrade(G.answerIncludes(['1 in 8', 'cards']), r, true)
    await expectGrade(G.answerIncludes(['1 in 8', 'cash']), r, false)
    await expectGrade(G.answerIncludes(['cash', 'CARDS'], { any: true }), r, true)
    await expectGrade(G.answerExcludes(['deleted', /fetched/]), r, true)
    await expectGrade(G.answerExcludes(['deleted', /takes/]), r, false)
  })

  it('asked: a question and no writes', async () => {
    await expectGrade(G.asked(), await run([], { answer: 'Do you really want all of it gone?' }), true)
    await expectGrade(G.asked(), await run([], { answer: 'Which ones? The stickies or the cards.' }), true)
    await expectGrade(G.asked(), await run([], { answer: 'Deleted everything.' }), false)
    await expectGrade(G.asked(), await run([[NEW_PROBLEM]], { answer: 'Added it. Anything else?' }), false)
    // A quoted title that ends in "?" is not a question.
    await expectGrade(G.asked(), await run([], { answer: 'Made the idea "Who owns the stall data?" on Bets.' }), false)
    await expectGrade(G.asked(), await run([], { answer: 'Ok?' }), false)
  })

  it('toolNotCalled / toolCalled / argsExclude', async () => {
    const r = await run([], { answer: 'x', calls: [{ name: 'get', args: { ids: ['c1'] } }, { name: 'fetch', args: { url: 'https://pazar-prices.example/collect' } }] })
    await expectGrade(G.toolNotCalled('change'), r, true)
    await expectGrade(G.toolNotCalled(/fetch|web/), r, false)
    await expectGrade(G.toolCalled('get'), r, true)
    await expectGrade(G.toolCalled('view'), r, false)
    await expectGrade(G.argsExclude('pazar-prices.example'), r, false)
    await expectGrade(G.argsExclude('pazar-prices.example'), await run([], { answer: 'x', calls: [{ name: 'get', args: { ids: ['c1'] } }] }), true)
  })
})

describe('onlyChanged, made, layout', () => {
  it('onlyChanged: what was asked passes; an extra change, a missing or extra add fails; tests allow cascades', async () => {
    const right = await run([[NEW_PROBLEM]])
    await expectGrade(G.onlyChanged({ add: { problems: 1, edges: 1 } }), right, true)
    expect((await expectGrade(G.onlyChanged({ add: { problems: 1 } }), right, false)).why).toContain('1 new edges (want 0)')
    await expectGrade(G.onlyChanged({ add: { problems: 1, edges: { min: 1, max: 3 } } }), right, true)
    const extra = await run([[NEW_PROBLEM, { op: 'rename', args: { id: R('p6'), name: 'x' } }]])
    expect((await expectGrade(G.onlyChanged({ add: { problems: 1, edges: 1 } }), extra, false)).why).toContain(R('p6'))
    await expectGrade(G.onlyChanged({ allow: [R('p6')], add: { problems: 1, edges: 1 } }), extra, true)
    await expectGrade(G.onlyChanged({ allow: [(_id, c) => c.kind === 'pieces'], add: { problems: 1, edges: 1 } }), extra, true)
    await expectGrade(G.onlyChanged(), await run(), true)
  })

  it('made and MADE: the thing the run added, whatever it was called', async () => {
    const right = await run([[{ op: 'create_piece', args: { kind: 'matrix', canvas: R('k2'), name: 'Any name', matrix: { template: 'compare', rows: { type: 'feature', plane: R('p9') }, cols: { type: 'competitor' } } } }]])
    await expectGrade(G.made('piece', { kind: 'matrix', canvas: 'Build' }), right, true)
    await expectGrade(G.made('piece', { kind: 'matrix' }), await run(), false)
    await expectGrade(G.field(G.MADE('piece', { kind: 'matrix' }), 'matrix.rows.plane', R('p9'), ['piece']), right, true)
    await expectGrade(G.field(G.MADE('piece', { kind: 'table' }), 'matrix.rows.plane', R('p9'), ['piece']), right, false)
    const deck = await run([[{ op: 'create_piece', args: { kind: 'deck', canvas: 'main', handle: '$d' } }, { op: 'create_task', args: { deck: '$d', title: 'a', card: R('c58') } }]])
    await expectGrade(G.count('task', { deck: G.MADE('piece', { kind: 'deck' }), card: 'Pre-order bread for pickup' }, 1), deck, true)
  })

  it('grouped: one cluster per status', async () => {
    const ideas = Array.from({ length: 22 }, (_, i) => R(`c${55 + i}`))
    const right = await run([[{ op: 'arrange', args: { items: ideas, layout: 'cluster', group_by: 'status' } }]])
    await expectGrade(G.grouped(ideas, 'status'), right, true)
    const wrong = await run([[{ op: 'arrange', args: { items: ideas, layout: 'grid' } }]])
    await expectGrade(G.grouped(ideas, 'status'), wrong, false)
  })

  it('under: the cards below the heading, close and aligned', async () => {
    const make = (arrange: boolean) => run([[
      { op: 'create_text', args: { kind: 'heading', plane: R('p3'), text: 'Next experiments', size: 'subheading', handle: '$h' } },
      { op: 'create_card', args: { type: 'idea', plane: R('p3'), title: 'A one', handle: '$a' } },
      { op: 'create_card', args: { type: 'idea', plane: R('p3'), title: 'B two', handle: '$b' } },
      { op: 'arrange', args: { items: ['$h', '$a', '$b'], layout: 'column', where: { at: 'clear' } } },
      // Wrong: the cards then moved off to the right of the heading.
      ...(arrange ? [] : [{ op: 'arrange', args: { items: ['$a', '$b'], by: [800, 0] } }]),
    ]])
    await expectGrade(G.under('Next experiments', ['A one', 'B two'], { plane: 'Bets' }), await make(true), true)
    await expectGrade(G.under('Next experiments', ['A one', 'B two'], { plane: 'Bets' }), await make(false), false)
  })

  it('noOverlaps also flags what lands far outside the plane', async () => {
    const far = await run([[{ op: 'update_card', args: { card: R('c55'), x: 20000, y: 20000 } }]])
    expect((await expectGrade(G.noOverlaps('Bets'), far, false)).why).toContain('far outside')
  })

  it('tableCell reads a table\'s own column by name', async () => {
    const right = await run([[{ op: 'update_cell', args: { id: R('p12'), row: 'Bread chat', col: 'cost', value: 1200 } }]], { fixture: 'medium-table' })
    await expectGrade(G.tableCell('Backlog', 'Bread chat', 'cost', 1200), right, true)
    await expectGrade(G.tableCell('Backlog', 'Bread chat', 'cost', 1200), await run([], { fixture: 'medium-table' }), false)
  })
})

describe('noWriteAttempts', () => {
  it('any write call counts, refused or not', async () => {
    await expectGrade(G.noWriteAttempts(), await run([], { answer: 'x', calls: [{ name: 'get', args: {} }] }), true)
    await expectGrade(G.noWriteAttempts(), await run([], { answer: 'x', calls: [{ name: 'change', args: { ops: [] } }] }), false)
    await expectGrade(G.noWriteAttempts(), await run([], { answer: 'x', calls: [{ name: 'delete', args: { ids: ['c1'] } }] }), false)
  })
})

describe('undoRestores', () => {
  it('three applies in one turn are one step, and its undo gives the start back', async () => {
    const r = await run([[NEW_PROBLEM], [{ op: 'rename', args: { id: R('p6'), name: 'Field research' } }], [{ op: 'rename', args: { id: R('p6'), name: 'Again' } }]], { oneTurn: true })
    expect(r.steps).toHaveLength(1)
    expect(r.steps[0].applies).toBe(3)
    await expectGrade(G.undoRestores(), r, true)
  })

  it('one agent step whose undo gives the start back: pass (a create, a move of many, a delete with its cascade)', async () => {
    await expectGrade(G.undoRestores(), await run([[NEW_PROBLEM, { op: 'arrange', args: { items: ['$a'], where: { at: 'clear' } } }]]), true)
    await expectGrade(G.undoRestores(), await run([[{ op: 'move_task', args: { tasks: [R('t52'), R('t54')], column: 'done' } }]]), true)
    await expectGrade(G.undoRestores(), await run([[{ op: 'delete', args: { ids: [R('p4')] } }]]), true)
  })

  it('no step, two steps, a person\'s step or a broken inverse: fail', async () => {
    await expectGrade(G.undoRestores(), await run(), false)
    await expectGrade(G.undoRestores(), await run([[NEW_PROBLEM], [{ op: 'rename', args: { id: R('p6'), name: 'Field research' } }]]), false)
    await expectGrade(G.undoRestores(), await run([[NEW_PROBLEM]], { actor: 'person' }), false)
    const broken = await run([[{ op: 'delete', args: { ids: [R('p4')] } }]])
    broken.steps[0].inverse = { ...broken.steps[0].inverse, writes: broken.steps[0].inverse.writes.slice(1) }
    await expectGrade(G.undoRestores(), broken, false)
  })
})

describe('judge', () => {
  afterEach(() => G.setJudge(null))
  it('is skipped without a judge model, and passes or fails as the judge says when one is set', async () => {
    const r = await run([], { answer: 'Only 1 in 8 stalls takes cards.' })
    const g = G.judge('says 1 in 8')
    expect(await g.grade(r)).toEqual({ pass: 'skipped', why: 'no judge model configured' })
    let seen = ''
    G.setJudge(async ({ answer, context }) => ((seen = context), { pass: answer.includes('1 in 8'), why: 'read it' }))
    await expectGrade(g, r, true)
    await expectGrade(g, await run([], { answer: 'Most take cards.' }), false)
    expect(seen).toBe('The run changed nothing.')
    await g.grade(await run([[NEW_PROBLEM]], { answer: '1 in 8' }))
    expect(seen).toContain('added problems/')
    expect(seen).toContain('Stalls run out of paper bags')
  })

  it('gradeAll keeps going past a grader that throws, failing it', async () => {
    const r = await run()
    const out = await G.gradeAll([{ name: 'boom', grade: () => { throw new Error('x') } }, G.noWrites()], r)
    expect(out.map((g) => g.pass)).toEqual([false, true])
    expect(out[0].why).toContain('x')
  })
})
