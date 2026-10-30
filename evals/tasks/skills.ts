// Skills (S17, D-312; agent.md §4.10, §6 Phase 9's gate "each skill has ≥ 3 eval tasks passing"): three tasks per
// shipped `/` command, ids `skill-<name>-0n`, on the medium fixture ("Pazar"). Graded like the rest, on the end state:
// what was made or changed, the cards an answer cites (real ones, the right ones), and for the document skills the
// document's text: every card it mentions is real and named with its own title (docWritten). Big jobs (agent.md §4.10)
// plan first and change nothing until "go" (`followUps`, `noWritesInTurn(1)`). Each has a plausible wrong script. The judge rides on a twin of the first task for /gaps, /next and the five document skills (`-04-judged`, capability, JUDGED below), so the stub's pass counts stay model-free.
import { MADE, allSet, docSectionCards, judge, sameLine, answerExcludes, answerIncludes, absent, cell, cites, citesSome, count, docWritten, exists, field, grouped, linked, made, noDeletes, noOverlaps, noWriteAttempts, noWritesInTurn, onPlane, onlyChanged, task, toolCalled, undoRestores, type ChangeTest } from '../graders'
import { NOW } from '../fixtures'
import type { Grader, Task } from '../types'
import type { AgentWs } from '../../src/agent/contract'
import type { Card } from '../../src/model/cards'
import { project } from '../../src/ops/project'
import { updateNotes } from '../../src/ops/notes'
import { answer, call, calls, change, realOf } from './util'

const R = (s: string) => realOf('medium', s)
const H = 3_600_000
const DECK = MADE('piece', { kind: 'deck' })
const MATRIX = MADE('piece', { kind: 'matrix' })
const hasDay = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

// A change log (as mem-02's): Jonas changed a customer and moved a task yesterday; Mert made a card three days ago; the
// agent, through Ayşe, this morning.
const withLog = (ws: AgentWs): AgentWs => ({
  ...ws,
  changeLog: [
    { by: 'u-mert', at: NOW - 72 * H, kinds: ['customers'], ids: [R('c8')], op: 'create_card', actor: 'person' },
    { by: 'u-jonas', at: NOW - 20 * H, kinds: ['customers'], ids: [R('c3')], op: 'update_card', actor: 'person' },
    { by: 'u-jonas', at: NOW - 19 * H, kinds: ['tasks'], ids: [R('t41')], op: 'move_task', actor: 'person' },
    { by: 'u-ayse', at: NOW - 3 * H, kinds: ['problems'], ids: [R('c20')], op: 'update_card', actor: 'agent' },
  ],
})

// The agent notes saying something (as a person would have written them).
const withNotes = (line: string) => (ws: AgentWs): AgentWs => project(ws, [updateNotes({ ws, actor: { uid: 'u-ayse', role: 'owner', name: 'Ayşe Demir' }, now: NOW - 24 * H, newId: () => 'unused' }, { add: [line] })]) as AgentWs

// A near-duplicate of c16 (in the run's map it is c55: the short ids after it move up by one) "Bakers carry heavy bags home on foot" on Bets, with its own evidence and a task on Research.
const DUP = 'dupe0000000000000001'
const withDup = (ws: AgentWs): AgentWs => {
  const bets = R('p3')
  const card = { id: DUP, type: 'problem', pieceId: bets, title: 'Bakers carry heavy bags home on foot.', x: 1500, y: 1200, validation: 'hypothesis', createdAt: NOW - 48 * H, updatedAt: NOW - 48 * H } as unknown as Card
  return {
    ...ws,
    cards: [...ws.cards, card],
    evidence: [...ws.evidence, { id: 'dupev000000000000001', nodeId: DUP, nodeType: 'problem', kind: 'interview', text: 'Lena carries 15 kg of flour home every Saturday', stance: 'supports', createdAt: NOW - 48 * H, updatedAt: NOW - 48 * H } as never],
    tasks: [...ws.tasks, { id: 'duptk000000000000001', pieceId: R('p6'), col: 'todo', order: 99, title: 'Ask bakers about carts', uid: 'u-ayse', cardId: DUP, cardType: 'problem', createdAt: NOW - 48 * H, updatedAt: NOW - 48 * H } as never],
  }
}
const withoutPriorities = (ws: AgentWs): AgentWs => ({ ...ws, pieces: ws.pieces.filter((p) => p.id !== R('p14')) })

// A markdown document by create_document.
const doc = (title: string, lines: string[], o: { share?: boolean } = {}) => change([['create_document', { title, text: lines.join('\n'), ...(o.share ? { share: true } : {}) }]], title)
const DOC_ONLY = onlyChanged({ add: { documents: 1 } })
const docSaid = (what: string) => answer(`I wrote ${what} as a document; it's private to you and waits in the preview: apply it to keep it.`)


// Only docs that name one of these cards changed (a merge's cascade, nothing else).
const touchesOnly = (...cards: string[]): ChangeTest => (id, c, r) => {
  const real = cards.map(R)
  const item = c.was ?? [...r.end.cards, ...r.end.edges, ...r.end.places, ...r.end.pieces, ...r.end.cells, ...r.end.evidence, ...r.end.tasks, ...r.end.comparisons].find((x) => (x as { id?: string }).id === id)
  const json = JSON.stringify(item ?? {})
  return real.some((x) => json.includes(x))
}
// Impact/effort written as the cards' facts allow, not every gap filled as the best case (high impact, small effort).
const notAllBestCase = (cards: string[]): Grader => ({
  name: `notAllBestCase(${cards.join(', ')})`,
  grade: (r) => {
    const got = cards.map((s) => r.end.cards.find((c) => c.id === R(s)))
    const best = got.filter((c) => c && (c.impact === 'high' || !c.impact) && (c.effort === 'S' || !c.effort)).length
    return { pass: best < cards.length, why: `${best} of ${cards.length} are high/S` }
  },
})
const JUDGE_DOC = judge('The document is useful for its purpose and follows its method; every claim about the workspace names its card, and nothing is invented.')
const JUDGE_GAPS = judge('Each gap is real (the cited cards show it) and comes with a concrete fix the agent could propose; nothing was changed.')
const JUDGE_NEXT = judge('Three concrete, well-chosen actions tied to cited cards or tasks, each with why now.')

const RIVALS = { TR: ['c37', 'c38', 'c48'], DE: ['c36', 'c41', 'c42', 'c45', 'c47'], EU: ['c35', 'c39', 'c40', 'c43', 'c44', 'c46'] }
const regionOf = (c: Card) => (['Turkey'].includes(c.regions?.[0] ?? '') ? 'TR' : ['Germany', 'DACH'].includes(c.regions?.[0] ?? '') ? 'DE' : 'EU')
const IDEAS_ON_BETS = Array.from({ length: 22 }, (_, i) => `c${55 + i}`)
const IDEAS_ON_PRICING = ['c133', 'c134', 'c135', 'c136', 'c137', 'c138', 'c139', 'c140']
const ROADMAP_GAPS = ['c97', 'c98', 'c99', 'c101', 'c103', 'c104', 'c107', 'c108', 'c111', 'c115', 'c117', 'c119', 'c120', 'c122']

export const SKILL_TASKS: Task[] = [
  // ---- /ask
  {
    id: 'skill-ask-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/ask what does Freshgo compete with?',
    graders: [cites([R('c68'), R('c65'), R('c134')]), noWriteAttempts()],
    reference: [call('get', { ids: ['c36'] }), answer('c36 Freshgo competes with three cards: c68 "Bundle loyalty stamps for pickup", c65 "Bundle leftover produce by WhatsApp" and c134 "Map recipes at a discount". It also contradicts c5 "Stall owners new to the city".')],
    wrong: [call('get', { ids: ['c36'] }), answer('Freshgo competes with c47 "Localmate" and c40 "Localrun".')],
  },
  {
    id: 'skill-ask-02',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/ask what solves "Weekend shoppers sell out by 10am and turn people away"?',
    graders: [cites([R('c60'), R('c71'), R('c76')]), noWriteAttempts()],
    reference: [call('neighbours', { id: 'c24' }), answer('Three ideas solve c24 "Weekend shoppers sell out by 10am and turn people away": c60 "Swap the weekly basket the night before", c71 "Share market maps the night before" and c76 "Remind about cheese from the stall" (invalidated).')],
    wrong: [call('neighbours', { id: 'c24' }), answer('c137 "Swap stall reviews in one tap" and c59 "Rate cheese from the stall" solve it.')],
  },
  {
    id: 'skill-ask-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/ask which ideas are for Young parents on Saturdays (core)?',
    graders: [cites([R('c65'), R('c66')]), noWriteAttempts()],
    reference: [call('get', { ids: ['c12'] }), answer('Two ideas are for c12 "Young parents on Saturdays (core)": c65 "Bundle leftover produce by WhatsApp" (validated) and c66 "Bundle market maps for pickup". The rest tagged for it are a problem and two features.')],
    wrong: [call('get', { ids: ['c12'] }), answer('c87 "Organic farmers pay too much at the supermarket instead" is for them.')],
  },

  // ---- /gaps
  {
    id: 'skill-gaps-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/gaps',
    graders: [cites([R('c2'), R('c5'), R('c9')]), answerIncludes([/untested/i, /unlinked/i, /\bfix\b|propose/i]), noWriteAttempts()],
    reference: [
      calls(['query', { kind: 'card', contradicting: true }], ['query', { kind: 'card', type: 'problem', status: 'hypothesis', no_evidence: true }]),
      answer(
        [
          'Unbacked (validated with no evidence, `!`): c2 "Organic farmers in Beşiktaş (early)", c5 "Stall owners new to the city", c9 "Organic farmers who pay cash". Fix: find the interview behind each, or set them back to testing.',
          'Untested problems (hypotheses with no evidence): c15 "Restaurant buyers never know prices before they arrive", c16 "Bakers carry heavy bags home on foot". Fix: a "test it" task each.',
          'Unlinked: c88 "Restaurant buyers lose regulars when they move away" has no customer. Fix: link it for c82 "Restaurant buyers on Saturdays".',
          "Say which to fix and I'll propose the changes.",
        ].join('\n'),
      ),
    ],
  },
  {
    id: 'skill-gaps-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/gaps on Interviews',
    graders: [cites([R('c87'), R('c90'), R('c93'), R('c88')]), citesSome(4, { onPlane: 'Interviews' }), noWriteAttempts()],
    reference: [
      calls(['query', { kind: 'card', plane: 'p4', contradicting: true }], ['query', { kind: 'card', plane: 'p4', no_evidence: true }]),
      answer(
        [
          'On p4 Interviews:',
          '- status and evidence disagree (`!`): c87 "Organic farmers pay too much at the supermarket instead" (validated, no evidence), c90 "Office lunch groups pay too much at the supermarket instead" and c93 "Young parents can\'t tell what is in season this week" (invalidated, no evidence). Fix: add the evidence, or fix the status.',
          '- unlinked: c88 "Restaurant buyers lose regulars when they move away" and c94 "Stall owners throw away unsold greens every evening" name no customer. Fix: a for link each.',
          '- untested: c79 "Neighbourhood cooks near the tram (early)" and c82 "Restaurant buyers on Saturdays" are hypotheses with nothing behind them. Fix: an interview task.',
          "Say which to fix and I'll propose the changes.",
        ].join('\n'),
      ),
    ],
    wrong: [call('query', { kind: 'card', contradicting: true }), answer('Gaps: c2 "Organic farmers in Beşiktaş (early)", c5 "Stall owners new to the city", c9 "Organic farmers who pay cash" and c87 "Organic farmers pay too much at the supermarket instead".')],
  },
  {
    id: 'skill-gaps-03',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/gaps',
    followUps: ['yes, link c88 to its customer c82 "Restaurant buyers on Saturdays"'],
    graders: [noWritesInTurn(1), linked(R('c88'), R('c82'), 'for'), onlyChanged({ add: { edges: 1 } }), undoRestores()],
    reference: [
      call('query', { kind: 'card', contradicting: true }),
      answer('Unbacked: c2 "Organic farmers in Beşiktaş (early)" (validated, no evidence). Unlinked: c88 "Restaurant buyers lose regulars when they move away" has no customer; fix: link it for c82 "Restaurant buyers on Saturdays". Say which to fix.'),
      call('get', { ids: ['c88', 'c82'] }),
      change([['link', { from: 'c88', to: 'c82', kind: 'for' }]], 'c88 for c82'),
      answer('Proposed: c88 "Restaurant buyers lose regulars when they move away" for c82 "Restaurant buyers on Saturdays". It waits in the preview.'),
    ],
    wrong: [
      call('query', { kind: 'card', contradicting: true }),
      answer('Unlinked: c88 "Restaurant buyers lose regulars when they move away". Say which to fix.'),
      change([['link', { from: 'c88', to: 'c80', kind: 'for' }]]),
      answer('Linked it.'),
    ],
  },

  // ---- /next
  {
    id: 'skill-next-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/next',
    graders: [citesSome(3), answerIncludes([/^\s*1[.)]/m, /^\s*3[.)]/m]), answerExcludes([/^\s*4[.)]/m]), noWriteAttempts()],
    reference: [
      calls(['query', { kind: 'card', contradicting: true }], ['query', { kind: 'task', overdue: true }]),
      answer(
        [
          'The next three:',
          '1. Back or drop c2 "Organic farmers in Beşiktaş (early)": validated with no evidence; one interview this week settles it.',
          '2. Finish t1 "Visit five stall owners": two weeks late and it feeds c61 "Reserve stall opening hours with neighbours".',
          '3. Test c58 "Pre-order bread for pickup": a hypothesis that four features lean on; a one-week pilot at one stall.',
          'Want these as tasks on a deck?',
        ].join('\n'),
      ),
    ],
    wrong: [answer('1. Talk to customers.\n2. Ship features.\n3. Raise money.\n4. Hire.\n5. Market it.')],
  },
  {
    id: 'skill-next-02',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/next as tasks on the Research deck',
    graders: [count('task', { deck: 'Research', cardId: (v: unknown) => !!v, due: hasDay }, 3, { delta: true }), onlyChanged({ add: { tasks: 3 } }), undoRestores()],
    reference: [
      calls(['query', { kind: 'card', contradicting: true }], ['view', { piece: 'p6' }]),
      change(
        [
          ['create_task', { deck: 'p6', title: 'Find the evidence behind c2', card: 'c2', due: '2026-11-07' }],
          ['create_task', { deck: 'p6', title: 'Interview two restaurant buyers', card: 'c88', due: '2026-11-10' }],
          ['create_task', { deck: 'p6', title: 'One-week pre-order pilot', card: 'c58', due: '2026-11-14' }],
        ],
        'the next three, as tasks',
      ),
      answer('Three tasks for p6 Research wait in the preview: evidence for c2 "Organic farmers in Beşiktaş (early)" (due Nov 7), two interviews for c88 "Restaurant buyers lose regulars when they move away" (Nov 10), a pilot for c58 "Pre-order bread for pickup" (Nov 14).'),
    ],
    wrong: [
      change([
        ['create_task', { deck: 'p6', title: 'Find evidence' }],
        ['create_task', { deck: 'p6', title: 'Interview buyers' }],
        ['create_task', { deck: 'p6', title: 'Run a pilot' }],
      ]),
      answer('Added three tasks.'),
    ],
  },
  {
    id: 'skill-next-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/next for Pricing',
    view: { focus: R('p10') },
    graders: [citesSome(3, { onPlane: 'Pricing', kind: 'card' }), noWriteAttempts()],
    reference: [
      call('view', { piece: 'p10' }),
      answer(
        [
          '1. Settle c138 "Share stall opening hours every Friday": invalidated with no evidence (`!`); write down why, or take it back to testing.',
          '2. Turn c140 "Reserve leftover produce from the stall" (testing +2) into a pilot: it solves four problems.',
          '3. Interview c131 "Students near the tram (core)": a core segment that is still only a hypothesis.',
        ].join('\n'),
      ),
    ],
    wrong: [call('view', { piece: 'p10' }), answer('1. Test c58 "Pre-order bread for pickup".\n2. Back c2 "Organic farmers in Beşiktaş (early)".\n3. Finish c140 "Reserve leftover produce from the stall".')],
  },

  // ---- /digest
  {
    id: 'skill-digest-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    setup: withLog,
    ask: '/digest since yesterday',
    graders: [toolCalled('whats_new'), cites([R('c3'), R('t41'), R('c20')]), sameLine([['Jonas', R('c3')], ['Jonas', R('t41')], [/\bagent\b|Ayşe/, R('c20')]], [['Jonas', R('c20')], [/\bagent\b/, R('c3')]]), noWriteAttempts()],
    reference: [
      call('whats_new', { since: '2026-11-02' }),
      answer('Since yesterday:\n- Jonas Weber changed c3 "Office lunch groups in Kreuzberg" and moved t41 "Ship Saturday pilot".\n- The agent (for Ayşe) changed c20 "Bakers never know prices before they arrive".\nNothing waits on you.'),
    ],
    // Everything put on Jonas.
    wrong: [call('whats_new', { since: '2026-11-02' }), answer('Since yesterday Jonas Weber changed c3 "Office lunch groups in Kreuzberg", moved t41 "Ship Saturday pilot" and changed c20 "Bakers never know prices before they arrive".')],
  },
  {
    id: 'skill-digest-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/digest',
    graders: [toolCalled('whats_new'), cites([R('c67'), R('c57'), R('t12')]), answerExcludes([/\bc65\b/, /\bt41\b/, /\bt60\b/]), noWriteAttempts()],
    reference: [
      call('whats_new', { since: '2026-11-02' }),
      answer('Since yesterday (who is not known without the change log):\n- p3 Bets: c67 "Share stall opening hours from the stall" and c57 "Pre-order market maps at a discount" changed.\n- p6 Research: t12 "Write Saturday pilot" changed.\n- d2 "Pricing research" was edited.'),
    ],
    wrong: [call('whats_new', { since: '2026-10-27' }), answer('This week: c65 "Bundle leftover produce by WhatsApp", t41 "Ship Saturday pilot" and t60 "Ship the order email" changed, and c67 "Share stall opening hours from the stall".')],
  },
  {
    id: 'skill-digest-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    setup: withLog,
    ask: '/digest since last week',
    graders: [toolCalled('whats_new'), cites([R('c8'), R('c3'), R('t41')]), answerIncludes(['Mert', 'Jonas']), noWriteAttempts()],
    reference: [
      call('whats_new', { since: '2026-10-27' }),
      answer('Since last week:\n- Mert Kaya made c8 "Retired regulars on Saturdays (core)".\n- Jonas Weber changed c3 "Office lunch groups in Kreuzberg" and moved t41 "Ship Saturday pilot".\n- The agent (for Ayşe) changed c20 "Bakers never know prices before they arrive".'),
    ],
    wrong: [call('whats_new', { since: '2026-11-02' }), answer('Since last week Jonas Weber changed c3 "Office lunch groups in Kreuzberg" and moved t41 "Ship Saturday pilot".')],
  },

  // ---- /review-deck
  {
    id: 'skill-review-deck-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/review-deck Research',
    graders: [toolCalled('view'), cites([R('t1'), R('t4'), R('t5'), R('t7'), R('t13')]), noWriteAttempts()],
    reference: [
      call('view', { piece: 'p6' }),
      answer(
        [
          'p6 Research:',
          '- Late: t1 "Visit five stall owners", t4 "Write the WhatsApp bot", t5 "Draft the stall onboarding", t7 "Price Saturday pilot", t13 "Interview the stall onboarding".',
          '- Given to no one and late: t1 and t13. Suggest: give them to someone this week, or drop t13 (review has six already).',
          '- Doing is 3/5: fine. t8 "Test Saturday pilot" has no due day.',
          'Want me to propose those moves?',
        ].join('\n'),
      ),
    ],
    wrong: [call('view', { piece: 'p6' }), answer('Late: t1 "Visit five stall owners" and t4 "Write the WhatsApp bot". The rest look fine.')],
  },
  {
    id: 'skill-review-deck-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/review-deck Sprint',
    graders: [cites(['t41', 't52', 't54', 't46', 't34', 't44', 't27', 't45'].map(R)), answerIncludes([/13\s*\/\s*5|over (its|the) limit/i]), noWriteAttempts()],
    reference: [
      calls(['view', { piece: 'p13' }], ['query', { kind: 'task', deck: 'p13', overdue: true }]),
      answer(
        [
          'p13 Sprint is stuck: doing holds 13/5, far over its limit.',
          '- Late (8): t41 "Ship Saturday pilot", t52 "Map five stall owners", t54 "Price the pickup flow", t46 "Visit the Kreuzberg market", t34 "Ship the stall onboarding", t44 "Test the WhatsApp bot", t27 "Ship three restaurants", t45 "Test the Kreuzberg market".',
          '- Given to no one and late: t54, t46, t45.',
          'Suggest: move half of doing back to todo, give t54, t46 and t45 an owner, split t41 into "pilot" and "write-up".',
        ].join('\n'),
      ),
    ],
    wrong: [call('view', { piece: 'p13' }), answer('Late: t41 "Ship Saturday pilot", t52 "Map five stall owners" and t27 "Ship three restaurants".')],
  },
  {
    id: 'skill-review-deck-03',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/review-deck Research',
    followUps: ['yes: give the two late tasks nobody has to Jonas and move them to doing'],
    graders: [noWritesInTurn(1), task('Research', R('t1'), { assignee: 'Jonas Weber', column: 'doing' }), task('Research', R('t13'), { assignee: 'Jonas Weber', column: 'doing' }), onlyChanged({ allow: [R('t1'), R('t13')] }), undoRestores()],
    reference: [
      call('view', { piece: 'p6' }),
      answer('Late and given to no one: t1 "Visit five stall owners" and t13 "Interview the stall onboarding". Suggest: give them to someone and move them to doing. Want me to?'),
      call('get', { ids: ['t1', 't13'] }),
      change(
        [
          ['update_task', { task: 't1', assignee: 'Jonas Weber' }],
          ['update_task', { task: 't13', assignee: 'Jonas Weber' }],
          ['move_task', { task: 't1', column: 'doing' }],
          ['move_task', { task: 't13', column: 'doing' }],
        ],
        'late tasks to Jonas',
      ),
      answer('Proposed: t1 and t13 given to Jonas Weber and moved to doing (doing becomes 5/5). It waits in the preview.'),
    ],
    wrong: [
      call('view', { piece: 'p6' }),
      answer('Late and given to no one: t1 and t13. Want me to?'),
      change([
        ['update_task', { task: 't1', assignee: 'Jonas Weber' }],
        ['update_task', { task: 't5', assignee: 'Jonas Weber' }],
        ['move_task', { task: 't1', column: 'doing' }],
        ['move_task', { task: 't5', column: 'doing' }],
      ]),
      answer('Done.'),
    ],
  },

  // ---- /test
  {
    id: 'skill-test-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/test "Pre-order bread for pickup"',
    followUps: ['go'],
    graders: [
      noWritesInTurn(1),
      made('piece', { kind: 'deck' }),
      count('task', { deck: DECK, card: R('c58'), start: hasDay, due: hasDay }, { min: 3, max: 6 }),
      field(R('c58'), 'validation', 'testing', ['card']),
      onlyChanged({ allow: [R('c58')], add: { pieces: 1, tasks: { min: 3, max: 6 } } }),
      undoRestores(),
    ],
    reference: [
      call('get', { ids: ['c58'] }),
      answer(
        [
          'Plan for c58 "Pre-order bread for pickup" (for c13 "Office lunch groups new to the city"):',
          '1. Hypothesis: office lunch groups will pre-order bread the evening before if pickup is on their way.',
          '2. Signal: 15 pre-orders in one week at one stall; under 5, we stop.',
          '3. A deck "Test: Pre-order bread for pickup" on k1 Discovery with four tasks for c58, Nov 4 to Nov 14.',
          '4. c58 goes from hypothesis to testing.',
          'Say go, or tell me what to change in the plan.',
        ].join('\n'),
      ),
      change(
        [
          ['create_piece', { kind: 'deck', canvas: 'k1', name: 'Test: Pre-order bread for pickup', handle: '$d' }],
          ['create_task', { deck: '$d', title: 'Pick one stall and agree the pilot', card: 'c58', start: '2026-11-04', due: '2026-11-05' }],
          ['create_task', { deck: '$d', title: 'Put up the pre-order sign and WhatsApp link', card: 'c58', start: '2026-11-05', due: '2026-11-06' }],
          ['create_task', { deck: '$d', title: 'Run the pre-order week', card: 'c58', start: '2026-11-07', due: '2026-11-13' }],
          ['create_task', { deck: '$d', title: 'Count pre-orders and write down what we learned', card: 'c58', start: '2026-11-14', due: '2026-11-14' }],
          ['update_card', { card: 'c58', fields: { validation: 'testing' } }],
        ],
        'test Pre-order bread for pickup',
      ),
      answer('The test waits in the preview: the deck "Test: Pre-order bread for pickup" with four dated tasks for c58, and c58 set to testing.'),
    ],
    wrong: [
      call('get', { ids: ['c58'] }),
      answer('Plan: a deck with three tasks. Say go, or tell me what to change in the plan.'),
      change([
        ['create_piece', { kind: 'deck', canvas: 'k1', name: 'Test', handle: '$d' }],
        ['create_task', { deck: '$d', title: 'Ask', card: 'c58' }],
        ['create_task', { deck: '$d', title: 'Pilot', card: 'c58' }],
        ['create_task', { deck: '$d', title: 'Count', card: 'c58' }],
      ]),
      answer('Made it.'),
    ],
  },
  {
    id: 'skill-test-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/test c72',
    followUps: ['go'],
    graders: [noWritesInTurn(1), made('piece', { kind: 'deck' }), count('task', { deck: DECK, card: R('c72'), due: hasDay }, { min: 3, max: 6 }), field(R('c72'), 'validation', 'testing', ['card']), onlyChanged({ add: { pieces: 1, tasks: { min: 3, max: 6 } } }), undoRestores()],
    reference: [
      call('get', { ids: ['c72'] }),
      answer('Plan for c72 "Remind about market maps every Friday" (testing +1, solves c25 "Organic farmers throw away unsold greens every evening"):\n1. Hypothesis: a Friday reminder brings back 3 in 10 regulars.\n2. Signal: 30 % open-and-come on two Fridays.\n3. A deck "Test: Friday reminders" on k1 Discovery with three dated tasks for c72.\nSay go, or tell me what to change in the plan.'),
      change(
        [
          ['create_piece', { kind: 'deck', canvas: 'k1', name: 'Test: Friday reminders', handle: '$d' }],
          ['create_task', { deck: '$d', title: 'Write the Friday message', card: 'c72', start: '2026-11-04', due: '2026-11-05' }],
          ['create_task', { deck: '$d', title: 'Send it on two Fridays', card: 'c72', start: '2026-11-06', due: '2026-11-13' }],
          ['create_task', { deck: '$d', title: 'Count who came back', card: 'c72', due: '2026-11-14' }],
        ],
        'test Friday reminders',
      ),
      answer('Waiting in the preview: the deck "Test: Friday reminders" with three dated tasks for c72 (it stays testing).'),
    ],
    wrong: [
      call('get', { ids: ['c72'] }),
      answer('Plan: a deck of three tasks. Say go, or tell me what to change in the plan.'),
      change([
        ['create_piece', { kind: 'deck', canvas: 'k1', name: 'Test: Friday reminders', handle: '$d' }],
        ['create_task', { deck: '$d', title: 'Write the message', card: 'c71', due: '2026-11-05' }],
        ['create_task', { deck: '$d', title: 'Send it', card: 'c71', due: '2026-11-13' }],
        ['create_task', { deck: '$d', title: 'Count', card: 'c71', due: '2026-11-14' }],
      ]),
      answer('Made it.'),
    ],
  },
  {
    id: 'skill-test-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/test',
    view: { focus: R('p10'), selection: [R('c133')] },
    followUps: ['go'],
    graders: [noWritesInTurn(1), made('piece', { kind: 'deck' }), count('task', { deck: DECK, card: R('c133'), due: hasDay }, { min: 3, max: 6 }), field(R('c133'), 'validation', 'testing', ['card']), onlyChanged({ allow: [R('c133')], add: { pieces: 1, tasks: { min: 3, max: 6 } } }), undoRestores()],
    reference: [
      calls(['where_am_i', {}], ['get', { ids: ['c133'] }]),
      answer('Plan for the selected c133 "Deliver loyalty stamps with neighbours":\n1. Hypothesis: neighbours will carry a stamp card for each other.\n2. Signal: 10 shared stamp cards in two weeks.\n3. A deck "Test: Deliver loyalty stamps with neighbours" on k2 Build, three dated tasks for c133; c133 to testing.\nSay go, or tell me what to change in the plan.'),
      change(
        [
          ['create_piece', { kind: 'deck', canvas: 'k2', name: 'Test: Deliver loyalty stamps with neighbours', handle: '$d' }],
          ['create_task', { deck: '$d', title: 'Print 30 shared stamp cards', card: 'c133', due: '2026-11-06' }],
          ['create_task', { deck: '$d', title: 'Hand them out on two Saturdays', card: 'c133', start: '2026-11-07', due: '2026-11-14' }],
          ['create_task', { deck: '$d', title: 'Count shared cards and write it down', card: 'c133', due: '2026-11-17' }],
          ['update_card', { card: 'c133', fields: { validation: 'testing' } }],
        ],
        'test c133',
      ),
      answer('Waiting in the preview: the deck with three dated tasks for c133, and c133 set to testing.'),
    ],
    wrong: [
      call('where_am_i', {}),
      answer('Plan: a deck. Say go, or tell me what to change in the plan.'),
      change([
        ['create_piece', { kind: 'deck', canvas: 'k2', name: 'Test', handle: '$d' }],
        ['create_task', { deck: '$d', title: 'Try it', due: '2026-11-06' }],
        ['create_task', { deck: '$d', title: 'Count', due: '2026-11-14' }],
        ['create_task', { deck: '$d', title: 'Write it down', due: '2026-11-17' }],
      ]),
      answer('Made it.'),
    ],
  },

  // ---- /compare
  {
    id: 'skill-compare-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/compare',
    followUps: ['go'],
    graders: [
      noWritesInTurn(1),
      made('piece', { kind: 'matrix' }),
      field(MATRIX, 'matrix.rows.plane', R('p9'), ['piece']),
      field(MATRIX, 'matrix.cols.type', 'competitor', ['piece']),
      cell(MATRIX, 'Bread pickup slots', 'Tarlamate', 'full'),
      cell(MATRIX, 'Market maps chat', 'Bazaarmate', 'full'),
      cell(MATRIX, 'Cheese map', 'Freshgo', null),
      onlyChanged({ add: { pieces: 1, cells: 7 } }),
      undoRestores(),
    ],
    reference: [
      calls(['view', { piece: 'p9' }], ['query', { kind: 'card', type: 'competitor', limit: 20 }]),
      answer('Plan:\n1. A matrix on k2 Build: the features on p9 Roadmap as rows, every competitor as columns (none / partial / full / better).\n2. Fill only the 7 cells where a competitor feature matches ours; leave the rest empty (unknown, a ?).\nSay go, or tell me what to change in the plan.'),
      change(
        [
          ['create_piece', { kind: 'matrix', canvas: 'k2', name: 'Roadmap vs competitors', matrix: { template: 'compare', rows: { type: 'feature', plane: 'p9' }, cols: { type: 'competitor' } }, handle: '$m' }],
          ...(
            [
              ['c97', 'c41'],
              ['c97', 'c43'],
              ['c97', 'c44'],
              ['c111', 'c35'],
              ['c112', 'c38'],
              ['c113', 'c44'],
              ['c123', 'c42'],
            ] as const
          ).map(([row, col]) => ['update_cell', { id: '$m', row, col, value: 'full', note: 'a feature of theirs matches ours' }] as [string, Record<string, unknown>]),
        ],
        'Roadmap vs competitors',
      ),
      answer('Waiting in the preview: the matrix "Roadmap vs competitors" with 7 cells filled from matched competitor features (c97 "Bread pickup slots" is covered by three rivals). Every other cell is a ?: the workspace says nothing about it yet.'),
    ],
    // Every unknown cell written as "none": a gap made to look known.
    wrong: [
      call('view', { piece: 'p9' }),
      answer('Plan: a matrix. Say go, or tell me what to change in the plan.'),
      change([
        ['create_piece', { kind: 'matrix', canvas: 'k2', name: 'Roadmap vs competitors', matrix: { template: 'compare', rows: { type: 'feature', plane: 'p9' }, cols: { type: 'competitor' } }, handle: '$m' }],
        ['update_cell', { id: '$m', row: 'c97', col: 'c43', value: 'full' }],
        ['update_cell', { id: '$m', row: 'c112', col: 'c38', value: 'full' }],
        ['update_cell', { id: '$m', row: 'c109', col: 'c36', value: 'none' }],
      ]),
      answer('Made it.'),
    ],
  },
  {
    id: 'skill-compare-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/compare our Pricing features',
    followUps: ['go'],
    graders: [noWritesInTurn(1), made('piece', { kind: 'matrix' }), field(MATRIX, 'matrix.rows.plane', R('p10'), ['piece']), cell(MATRIX, 'Seasonal boxes QR codes', 'Sepetbox', 'full'), cell(MATRIX, 'The weekly basket map', 'Bazaarrun', 'full'), onlyChanged({ add: { pieces: 1, cells: 3 } }), undoRestores()],
    reference: [
      calls(['view', { piece: 'p10' }], ['query', { kind: 'card', type: 'competitor', limit: 20 }]),
      answer('Plan:\n1. A matrix on k2 Build: the features on p10 Pricing × every competitor.\n2. Fill the 3 cells where a competitor feature matches ours; the rest stay ?.\nSay go, or tell me what to change in the plan.'),
      change(
        [
          ['create_piece', { kind: 'matrix', canvas: 'k2', name: 'Pricing vs competitors', matrix: { template: 'compare', rows: { type: 'feature', plane: 'p10' }, cols: { type: 'competitor' } }, handle: '$m' }],
          ['update_cell', { id: '$m', row: 'c146', col: 'c42', value: 'full' }],
          ['update_cell', { id: '$m', row: 'c146', col: 'c43', value: 'full' }],
          ['update_cell', { id: '$m', row: 'c147', col: 'c44', value: 'full' }],
        ],
        'Pricing vs competitors',
      ),
      answer('Waiting in the preview: "Pricing vs competitors", 3 cells filled (c146 "Seasonal boxes QR codes" by Sepetbox and Tarlamate, c147 "The weekly basket map" by Bazaarrun); the rest are ?.'),
    ],
    wrong: [
      call('view', { piece: 'p10' }),
      answer('Plan: a matrix. Say go, or tell me what to change in the plan.'),
      change([
        ['create_piece', { kind: 'matrix', canvas: 'k2', name: 'Pricing vs competitors', matrix: { template: 'compare', rows: { type: 'feature' }, cols: { type: 'competitor' } }, handle: '$m' }],
        ['update_cell', { id: '$m', row: 'c146', col: 'c42', value: 'full' }],
      ]),
      answer('Made it.'),
    ],
  },
  {
    id: 'skill-compare-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/compare our Roadmap features with Bazaarmate and Sepetbox only',
    followUps: ['go'],
    graders: [
      noWritesInTurn(1),
      made('piece', { kind: 'matrix' }),
      field(MATRIX, 'matrix.cols.items', (v: unknown) => Array.isArray(v) && v.length === 2 && [R('c38'), R('c42')].every((id) => v.some((i: { cardId?: string }) => i.cardId === id)), ['piece']),
      field(MATRIX, 'matrix.cols.type', undefined, ['piece']),
      cell(MATRIX, 'Market maps chat', 'Bazaarmate', 'full'),
      cell(MATRIX, 'Pickup slots checkout', 'Sepetbox', 'full'),
      onlyChanged({ add: { pieces: 1, cells: 2 } }),
      undoRestores(),
    ],
    reference: [
      calls(['get', { ids: ['c38', 'c42'] }], ['view', { piece: 'p9' }]),
      answer('Plan:\n1. A matrix on k2 Build: the features on p9 Roadmap × two columns, c38 Bazaarmate and c42 Sepetbox.\n2. Fill the 2 matched cells; the rest stay ?.\nSay go, or tell me what to change in the plan.'),
      change(
        [
          ['create_piece', { kind: 'matrix', canvas: 'k2', name: 'Roadmap vs Bazaarmate and Sepetbox', matrix: { template: 'compare', rows: { type: 'feature', plane: 'p9' }, cols: { cards: ['c38', 'c42'] } }, handle: '$m' }],
          ['update_cell', { id: '$m', row: 'c112', col: 'c38', value: 'full' }],
          ['update_cell', { id: '$m', row: 'c123', col: 'c42', value: 'full' }],
        ],
        'Roadmap vs two rivals',
      ),
      answer('Waiting in the preview: the matrix with two columns, c38 Bazaarmate and c42 Sepetbox; c112 "Market maps chat" and c123 "Pickup slots checkout" are matched, the rest ?.'),
    ],
    wrong: [
      call('view', { piece: 'p9' }),
      answer('Plan: a matrix. Say go, or tell me what to change in the plan.'),
      change([
        ['create_piece', { kind: 'matrix', canvas: 'k2', name: 'Roadmap vs Bazaarmate and Sepetbox', matrix: { template: 'compare', rows: { type: 'feature', plane: 'p9' }, cols: { type: 'competitor' } }, handle: '$m' }],
        ['update_cell', { id: '$m', row: 'c112', col: 'c38', value: 'full' }],
        ['update_cell', { id: '$m', row: 'c123', col: 'c42', value: 'full' }],
      ]),
      answer('Made it.'),
    ],
  },

  // ---- /prioritize
  {
    id: 'skill-prioritize-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/prioritize Pricing',
    followUps: ['go'],
    graders: [noWritesInTurn(1), allSet('card', { type: 'feature', plane: 'Pricing' }, ['impact', 'effort']), field(R('c142'), 'impact', /^(medium|high)$/, ['card']), field(R('c147'), 'effort', /^(M|L)$/, ['card']), notAllBestCase(['c142', 'c146', 'c147']), onlyChanged({ allow: [R('c142'), R('c146'), R('c147')] }), citesSome(3), undoRestores()],
    reference: [
      calls(['view', { piece: 'p10' }], ['view', { piece: 'p14' }]),
      answer('Plan:\n1. Fill what p14 Priorities needs on p10 Pricing: c142 "Recipes ratings" has no impact, c146 "Seasonal boxes QR codes" and c147 "The weekly basket map" no effort.\n2. Then explain the order.\nSay go, or tell me what to change in the plan.'),
      change(
        [
          ['update_card', { card: 'c142', fields: { impact: 'medium' } }],
          ['update_card', { card: 'c146', fields: { effort: 'M' } }],
          ['update_card', { card: 'c147', fields: { effort: 'L' } }],
        ],
        'impact and effort on Pricing',
      ),
      answer('In the preview: c142 "Recipes ratings" impact medium (two customers, no evidence yet), c146 "Seasonal boxes QR codes" effort M, c147 "The weekly basket map" effort L.\nOrder (impact × confidence ÷ effort): first c144 "Cheese catalogue" and c141 "Market maps reminder" (shipped, small), then c146; last c147 (big, unproven). Suggest c146 P2 → P1.'),
    ],
    wrong: [
      call('view', { piece: 'p10' }),
      answer('Plan: fill the gaps. Say go, or tell me what to change in the plan.'),
      // Every gap filled as the best case: high impact, small effort.
      change([
        ['update_card', { card: 'c142', fields: { impact: 'high' } }],
        ['update_card', { card: 'c146', fields: { effort: 'S' } }],
        ['update_card', { card: 'c147', fields: { effort: 'S' } }],
      ]),
      answer('Done: c142 "Recipes ratings", c146 "Seasonal boxes QR codes", c147 "The weekly basket map" are all quick wins.'),
    ],
  },
  {
    id: 'skill-prioritize-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/prioritize Roadmap',
    followUps: ['go'],
    graders: [noWritesInTurn(1), allSet('card', { type: 'feature', plane: 'Roadmap' }, ['impact', 'effort']), onlyChanged({ allow: ROADMAP_GAPS.map(R) }), citesSome(3), undoRestores()],
    reference: [
      calls(['view', { piece: 'p9' }], ['view', { piece: 'p14' }]),
      answer(`Plan:\n1. Fill impact or effort on the 14 features of p9 Roadmap that lack one (${ROADMAP_GAPS.join(', ')}), from what their cards and links say.\n2. Explain the order.\nSay go, or tell me what to change in the plan.`),
      change(
        [
          ['update_card', { card: 'c97', fields: { effort: 'M' } }],
          ['update_card', { card: 'c98', fields: { impact: 'medium' } }],
          ['update_card', { card: 'c99', fields: { effort: 'M' } }],
          ['update_card', { card: 'c101', fields: { effort: 'L' } }],
          ['update_card', { card: 'c103', fields: { effort: 'M' } }],
          ['update_card', { card: 'c104', fields: { effort: 'S' } }],
          ['update_card', { card: 'c107', fields: { impact: 'medium', effort: 'M' } }],
          ['update_card', { card: 'c108', fields: { impact: 'low' } }],
          ['update_card', { card: 'c111', fields: { effort: 'S' } }],
          ['update_card', { card: 'c115', fields: { effort: 'M' } }],
          ['update_card', { card: 'c117', fields: { impact: 'low' } }],
          ['update_card', { card: 'c119', fields: { impact: 'low' } }],
          ['update_card', { card: 'c120', fields: { impact: 'medium' } }],
          ['update_card', { card: 'c122', fields: { effort: 'M' } }],
        ],
        'impact and effort on Roadmap',
      ),
      answer('In the preview: impact or effort on 14 features. Top: c113 "Stall opening hours pickup slots" (high, S), c109 "Cheese map" (high, M), c114 "Seasonal boxes push alerts" (high, L, planned). Bottom: c119 "Stall reviews price list" and c120 "Stall opening hours reminder" (low/medium, L).'),
    ],
    wrong: [
      call('view', { piece: 'p9' }),
      answer('Plan: fill a few. Say go, or tell me what to change in the plan.'),
      change([
        ['update_card', { card: 'c97', fields: { effort: 'M' } }],
        ['update_card', { card: 'c98', fields: { impact: 'medium' } }],
        ['update_card', { card: 'c107', fields: { impact: 'medium', effort: 'M' } }],
      ]),
      answer('Top: c113 "Stall opening hours pickup slots", c109 "Cheese map", c114 "Seasonal boxes push alerts".'),
    ],
  },
  {
    id: 'skill-prioritize-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    setup: withoutPriorities,
    ask: '/prioritize',
    followUps: ['go'],
    graders: [noWritesInTurn(1), made('piece', { kind: 'deck' }), field(DECK, 'kanban.holds', 'cards', ['piece']), field(DECK, 'kanban.colField', 'effort', ['piece']), field(DECK, 'kanban.rowField', 'impact', ['piece']), onlyChanged({ add: { pieces: 1 } }), undoRestores()],
    reference: [
      calls(['query', { kind: 'piece', type: 'deck' }], ['query', { kind: 'card', type: 'feature', limit: 5 }]),
      answer('Plan: there is no priorities deck yet.\n1. Make one on k2 Build (template priorities: features and packages, effort × impact, corners named).\n2. Then explain the order from what is filled in.\nSay go, or tell me what to change in the plan.'),
      change([['create_piece', { kind: 'deck', canvas: 'k2', name: 'Priorities', deck: { template: 'priorities' } }]], 'a priorities deck'),
      answer('In the preview: the deck "Priorities" on k2 Build, features and packages by effort × impact. Quick wins first: c113 "Stall opening hours pickup slots" and c100 "Stall opening hours price list".'),
    ],
    wrong: [
      call('query', { kind: 'piece', type: 'deck' }),
      answer('Plan: a deck. Say go, or tell me what to change in the plan.'),
      change([['create_piece', { kind: 'deck', canvas: 'k2', name: 'Priorities' }]]),
      answer('Made it.'),
    ],
  },

  // ---- /organize
  {
    id: 'skill-organize-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/organize the competitors on Rivals by region',
    followUps: ['go'],
    graders: [noWritesInTurn(1), grouped(Object.values(RIVALS).flat().map(R), regionOf), noOverlaps('Rivals'), count('text', { kind: 'heading', plane: 'Rivals' }, 3, { delta: true }), noDeletes(), onlyChanged({ allow: Object.values(RIVALS).flat().map(R), add: { labels: 3 } }), undoRestores()],
    reference: [
      call('view', { piece: 'p2' }),
      answer('Plan for p2 Rivals:\n1. Three groups by where they work: Turkey, Germany and DACH, Europe and global.\n2. A heading over each; the pains section and notes stay put.\nSay go, or tell me what to change in the plan.'),
      change(
        [
          [
            'arrange',
            {
              items: Object.values(RIVALS).flat(),
              layout: 'cluster',
              group_by: [
                { name: 'Turkey', items: RIVALS.TR },
                { name: 'Germany and DACH', items: RIVALS.DE },
                { name: 'Europe and global', items: RIVALS.EU },
              ],
              headings: true,
            },
          ],
        ],
        'Rivals by region',
      ),
      answer('In the preview: the 14 competitors on p2 Rivals in three groups under headings: Turkey (c37 Bazaarcart, c38 Bazaarmate, c48 Kioskgo), Germany and DACH (5), Europe and global (6).'),
    ],
    wrong: [call('view', { piece: 'p2' }), answer('Plan: group them. Say go, or tell me what to change in the plan.'), change([['arrange', { items: Object.values(RIVALS).flat(), layout: 'grid' }]]), answer('Organised.')],
  },
  {
    id: 'skill-organize-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/organize the ideas on Bets by status',
    followUps: ['go'],
    graders: [noWritesInTurn(1), grouped(IDEAS_ON_BETS.map(R), 'status'), noOverlaps('Bets'), count('text', { kind: 'heading', plane: 'Bets' }, { min: 4, max: 5 }, { delta: true }), onlyChanged({ allow: IDEAS_ON_BETS.map(R), add: { labels: { min: 0, max: 4 } } }), undoRestores()],
    reference: [
      call('view', { piece: 'p3' }),
      answer('Plan for p3 Bets:\n1. The 22 ideas in four groups by status (hypothesis, testing, validated, invalidated), a heading over each.\n2. The pains section and the sticky notes stay.\nSay go, or tell me what to change in the plan.'),
      change([['arrange', { items: IDEAS_ON_BETS, layout: 'cluster', group_by: 'status', headings: true }]], 'ideas on Bets by status'),
      answer('In the preview: the 22 ideas on p3 Bets grouped by status under four headings.'),
    ],
    wrong: [call('view', { piece: 'p3' }), answer('Plan: group by status. Say go, or tell me what to change in the plan.'), change([['arrange', { items: IDEAS_ON_BETS, layout: 'cluster', group_by: 'type', headings: true }]]), answer('Organised.')],
  },
  {
    id: 'skill-organize-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/organize the ideas here by status',
    view: { focus: R('p10') },
    followUps: ['go'],
    graders: [noWritesInTurn(1), grouped(IDEAS_ON_PRICING.map(R), 'status'), noOverlaps('Pricing'), noDeletes(), onlyChanged({ allow: IDEAS_ON_PRICING.map(R), add: { labels: { min: 0, max: 3 } } }), undoRestores()],
    reference: [
      calls(['where_am_i', {}], ['view', { piece: 'p10' }]),
      answer('Plan for p10 Pricing (in focus):\n1. Its 8 ideas in groups by status (hypothesis, testing, invalidated), a heading over each.\n2. The two sections stay.\nSay go, or tell me what to change in the plan.'),
      change([['arrange', { items: IDEAS_ON_PRICING, layout: 'cluster', group_by: 'status', headings: true }]], 'ideas on Pricing by status'),
      answer('In the preview: the 8 ideas on p10 Pricing in three groups by status, each under a heading.'),
    ],
    wrong: [call('view', { piece: 'p10' }), answer('Plan: group them. Say go, or tell me what to change in the plan.'), change([['arrange', { items: IDEAS_ON_PRICING, layout: 'row' }]]), answer('Organised.')],
  },

  // ---- /sort-stickies
  {
    id: 'skill-sort-stickies-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/sort-stickies Bets',
    followUps: ['go'],
    graders: [
      noWritesInTurn(1),
      exists('card', { type: 'idea', title: 'Who owns the stall data?', plane: 'Bets' }),
      exists('card', { type: 'idea', title: 'Maybe start with bread', plane: 'Bets' }),
      made('text', { kind: 'section', plane: 'Bets' }),
      exists('text', { id: R('x13') }),
      exists('text', { id: R('x14') }),
      onlyChanged({ add: { ideas: 2, labels: 1 } }),
      noOverlaps('Bets'),
      undoRestores(),
    ],
    reference: [
      call('query', { kind: 'text', type: 'sticky', plane: 'p3' }),
      answer('Plan for p3 Bets\' two sticky notes:\n1. x13 "Who owns the stall data?" and x14 "Maybe start with bread" become ideas in their words.\n2. A section "From the sticky notes" around them; the notes stay.\nSay go, or tell me what to change in the plan.'),
      change(
        [
          ['create_card', { type: 'idea', plane: 'p3', title: 'Who owns the stall data?', handle: '$a' }],
          ['create_card', { type: 'idea', plane: 'p3', title: 'Maybe start with bread', handle: '$b' }],
          ['create_text', { kind: 'section', plane: 'p3', text: 'From the sticky notes', around: ['$a', '$b'] }],
        ],
        'stickies on Bets → ideas',
      ),
      answer('In the preview: two ideas from the sticky notes in a section "From the sticky notes"; x13 and x14 stay (say if they should go).'),
    ],
    wrong: [
      call('query', { kind: 'text', type: 'sticky', plane: 'p3' }),
      answer('Plan: ideas. Say go, or tell me what to change in the plan.'),
      change([
        ['create_card', { type: 'idea', plane: 'p3', title: 'Who owns the stall data?' }],
        ['create_card', { type: 'idea', plane: 'p3', title: 'Maybe start with bread' }],
        ['delete', { ids: ['x13', 'x14'] }, 'they are cards now'],
      ]),
      answer('Done.'),
    ],
  },
  {
    id: 'skill-sort-stickies-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/sort-stickies Interviews',
    followUps: ['go'],
    graders: [noWritesInTurn(1), exists('card', { type: 'idea', title: 'Who owns the stall data?', plane: 'Interviews' }), absent('card', { titleHas: 'Rain = no market' }), cites([R('c92')]), onlyChanged({ add: { ideas: 1, labels: { min: 0, max: 1 } } }), undoRestores()],
    reference: [
      calls(['query', { kind: 'text', type: 'sticky', plane: 'p4' }], ['search', { query: 'rain market', limit: 8 }]),
      answer('Plan for p4 Interviews:\n1. x26 "Who owns the stall data?" becomes an idea.\n2. x27 "Rain = no market?" repeats c92 "Stall owners miss the market when it rains", already here: no new card.\nSay go, or tell me what to change in the plan.'),
      change([['create_card', { type: 'idea', plane: 'p4', title: 'Who owns the stall data?' }]], 'a sticky on Interviews → an idea'),
      answer('In the preview: the idea "Who owns the stall data?" on p4 Interviews. "Rain = no market?" is already c92 "Stall owners miss the market when it rains", so I made no second card.'),
    ],
    wrong: [
      call('query', { kind: 'text', type: 'sticky', plane: 'p4' }),
      answer('Plan: two cards. Say go, or tell me what to change in the plan.'),
      change([
        ['create_card', { type: 'idea', plane: 'p4', title: 'Who owns the stall data?' }],
        ['create_card', { type: 'problem', plane: 'p4', title: 'Rain = no market?' }],
      ]),
      answer('Made two cards; c92 "Stall owners miss the market when it rains" is similar.'),
    ],
  },
  {
    id: 'skill-sort-stickies-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/sort-stickies Segments',
    followUps: ['go'],
    graders: [noWritesInTurn(1), exists('card', { type: 'idea', title: 'Maybe start with bread', plane: 'Segments' }), exists('card', { type: 'problem', title: 'Cash only is a big deal', plane: 'Segments' }), onlyChanged({ add: { ideas: 1, problems: 1, labels: { min: 1, max: 2 } } }), noOverlaps('Segments'), undoRestores()],
    reference: [
      call('query', { kind: 'text', type: 'sticky', plane: 'p1' }),
      answer('Plan for p1 Segments:\n1. x4 "Maybe start with bread" → an idea; x5 "Cash only is a big deal" → a problem.\n2. A section around each new card.\nSay go, or tell me what to change in the plan.'),
      change(
        [
          ['create_card', { type: 'idea', plane: 'p1', title: 'Maybe start with bread', handle: '$a' }],
          ['create_card', { type: 'problem', plane: 'p1', title: 'Cash only is a big deal', handle: '$b' }],
          ['create_text', { kind: 'section', plane: 'p1', text: 'From the sticky notes', around: ['$a', '$b'] }],
        ],
        'stickies on Segments → cards',
      ),
      answer('In the preview: an idea and a problem from the two notes, in a section "From the sticky notes".'),
    ],
    wrong: [
      call('query', { kind: 'text', type: 'sticky', plane: 'p1' }),
      answer('Plan: ideas. Say go, or tell me what to change in the plan.'),
      change([
        ['create_card', { type: 'idea', plane: 'p1', title: 'Maybe start with bread' }],
        ['create_card', { type: 'idea', plane: 'p1', title: 'Cash only is a big deal' }],
      ]),
      answer('Done.'),
    ],
  },

  // ---- /learn
  {
    id: 'skill-learn-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/learn Talked to Elif, an organic farmer at the Beşiktaş market, on Saturday: "I throw away a crate of greens every evening." She only takes cash.',
    graders: [exists('evidence', { card: R('c25'), stance: 'supports', text: /crate/i }), exists('evidence', { card: R('c28'), stance: 'supports' }), onlyChanged({ add: { evidence: 2 } }), answerIncludes([/validated|status/i]), undoRestores()],
    reference: [
      calls(['search', { query: 'organic farmers greens', limit: 8 }], ['search', { query: 'organic farmers card payments', limit: 8 }]),
      change(
        [
          ['create_evidence', { card: 'c25', kind: 'quote', text: 'I throw away a crate of greens every evening.', stance: 'supports', source: 'Elif, organic farmer, Beşiktaş, Saturday' }],
          ['create_evidence', { card: 'c28', kind: 'interview', text: 'She only takes cash.', stance: 'supports', source: 'Elif, organic farmer, Beşiktaş, Saturday' }],
        ],
        'Elif\'s interview',
      ),
      answer('In the preview: two pieces of evidence from Elif: her quote on c25 "Organic farmers throw away unsold greens every evening" and "cash only" on c28 "Organic farmers can\'t take card payments". c25 is still a hypothesis: with this it could go to testing; say if you want the status changed.'),
    ],
    wrong: [
      call('search', { query: 'greens', limit: 8 }),
      change([
        ['create_evidence', { card: 'c27', kind: 'quote', text: 'I throw away a crate of greens every evening.', stance: 'supports' }],
        ['create_evidence', { card: 'c17', kind: 'interview', text: 'She only takes cash.', stance: 'supports' }],
      ]),
      answer('Added the evidence; the status could be validated.'),
    ],
  },
  {
    id: 'skill-learn-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: "/learn Three stall owners told me rain doesn't matter: their regulars come anyway.",
    graders: [count('evidence', { card: R('c92'), stance: 'contradicts' }, 1, { delta: true }), onlyChanged({ add: { evidence: 1 } }), answerIncludes([/invalidated|contradict/i]), undoRestores()],
    reference: [
      call('search', { query: 'stall owners rain', limit: 8 }),
      change([['create_evidence', { card: 'c92', kind: 'interview', text: "Three stall owners said rain doesn't matter: their regulars come anyway.", stance: 'contradicts' }]], 'rain evidence'),
      answer('In the preview: evidence against c92 "Stall owners miss the market when it rains" (testing +2 −1 → +2 −2). It now contradicts as much as it supports; if more owners say so, it may be invalidated.'),
    ],
    wrong: [call('search', { query: 'rain', limit: 8 }), change([['create_evidence', { card: 'c92', kind: 'interview', text: "Rain doesn't matter.", stance: 'supports' }]]), answer('Added; it supports c92, not contradicts it.')],
  },
  {
    id: 'skill-learn-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/learn from d1',
    graders: [toolCalled('read_document'), exists('evidence', { card: R('c94'), stance: 'supports', text: /4 crates/i }), onlyChanged({ add: { evidence: { min: 1, max: 4 } } }), undoRestores()],
    reference: [
      calls(['read_document', { id: 'd1' }], ['search', { query: 'stall owners greens', limit: 8 }]),
      change([['create_evidence', { card: 'c94', kind: 'interview', text: 'Said she throws away 4 crates of greens a week.', stance: 'supports', source: 'd1 Interview notes — stall owners' }]], 'evidence from the stall owner interviews'),
      answer('In the preview: from d1 "Interview notes — stall owners", "throws away 4 crates of greens a week" supports c94 "Stall owners throw away unsold greens every evening". The notes\' other lines (WhatsApp groups, no new app) fit no card yet; c94 could move to testing.'),
    ],
    wrong: [call('read_document', { id: 'd1' }), change([['create_evidence', { card: 'c25', kind: 'interview', text: 'Said she throws away 4 crates of greens a week.', stance: 'supports' }]]), answer('Added it.')],
  },

  // ---- /dedupe
  {
    id: 'skill-dedupe-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/dedupe customers',
    followUps: ['yes, merge them'],
    graders: [noWritesInTurn(1), absent('card', { id: R('c2') }), exists('card', { id: R('c7') }), linked(R('c61'), R('c7'), 'for'), linked(R('c7'), R('c131'), 'relates'), onlyChanged({ allow: [R('c2'), R('c7'), touchesOnly('c2', 'c7')] }), undoRestores()],
    reference: [
      call('query', { kind: 'card', type: 'customer', limit: 40 }),
      answer('One near-duplicate: c2 "Organic farmers in Beşiktaş (early)" and c7 "Organic farmers in Beşiktaş". Keep c7 (tags, testing, two cards for it); fold c2 into it, its links coming along. Merge them?'),
      call('get', { ids: ['c2', 'c7'] }),
      change([['merge_cards', { keep: 'c7', merge: ['c2'] }, 'the same segment twice; c2 was the early wording']], 'merge c2 into c7'),
      answer('In the preview: c2 merged into c7 "Organic farmers in Beşiktaş": its link to c131 and c61\'s for link move to c7, then c2 goes.'),
    ],
    // Deleted instead of merged: its links are lost.
    wrong: [
      call('query', { kind: 'card', type: 'customer', limit: 40 }),
      answer('c2 and c7 are the same. Merge them?'),
      // Merged, but it also tagged another card nobody asked about.
      change([['merge_cards', { keep: 'c7', merge: ['c2'] }, 'the same segment twice'], ['update_card', { card: 'c9', fields: { tags: ['organic'] } }]]),
      answer('Merged; I also tagged c9 as organic.'),
    ],
  },
  {
    id: 'skill-dedupe-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    setup: withDup,
    ask: '/dedupe problems',
    followUps: ['yes'],
    graders: [noWritesInTurn(1), absent('card', { id: DUP }), exists('evidence', { card: R('c16'), text: /15 kg/ }), count('task', { card: R('c16') }, 1, { delta: true }), onPlane(R('c16'), 'Bets'), onPlane(R('c16'), 'Segments'), undoRestores()],
    reference: [
      call('query', { kind: 'card', type: 'problem', title: 'heavy bags' }),
      answer('A near-duplicate: c55 "Bakers carry heavy bags home on foot." on p3 Bets repeats c16 "Bakers carry heavy bags home on foot" on p1 Segments. Keep c16 (older, two ideas solve it); the copy\'s evidence and task move to it and c16 shows on Bets too. Merge them?'),
      change([['merge_cards', { keep: 'c16', merge: ['c55'] }, 'the same problem twice, one on Bets']], 'merge the heavy bags duplicate'),
      answer('In the preview: the copy merged into c16 "Bakers carry heavy bags home on foot" (its evidence and task move; c16 is shown on Bets where the copy was).'),
    ],
    wrong: [
      call('query', { kind: 'card', type: 'problem', title: 'heavy bags' }),
      answer('A duplicate of c16. Merge them?'),
      change([['delete', { ids: ['c55'] }, 'a duplicate of c16']]),
      answer('Done.'),
    ],
  },
  {
    id: 'skill-dedupe-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/dedupe competitors',
    autoGo: false,
    graders: [noWriteAttempts(), answerIncludes([/\bno (near-)?duplicates?\b|\bnone\b/i])],
    reference: [
      call('query', { kind: 'card', type: 'competitor', limit: 20 }),
      answer('No near-duplicates among the 14 competitors: c37 Bazaarcart, c38 Bazaarmate and c44 Bazaarrun share a start but are different companies (other regions, other features). Nothing to merge.'),
    ],
    wrong: [call('query', { kind: 'card', type: 'competitor', limit: 20 }), change([['merge_cards', { keep: 'c38', merge: ['c37'] }, 'both Bazaar…']]), answer('Merged Bazaarcart into Bazaarmate.')],
  },

  // ---- /import
  {
    id: 'skill-import-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/import problems for "Bakers near the tram":\n- Ovens break down on busy Saturdays\n- Flour prices doubled this year\n- No one covers the stall at noon',
    graders: [
      ...['Ovens break down on busy Saturdays', 'Flour prices doubled this year', 'No one covers the stall at noon'].map((t) => linked(t, R('c11'), 'for')),
      count('card', { type: 'problem', plane: 'Segments' }, 3, { delta: true }),
      onlyChanged({ add: { problems: 3, edges: 3 } }),
      undoRestores(),
    ],
    reference: [
      calls(['get', { ids: ['c11'] }], ['search', { query: 'ovens flour noon', limit: 8 }]),
      change(['Ovens break down on busy Saturdays', 'Flour prices doubled this year', 'No one covers the stall at noon'].map((title) => ['create_card', { type: 'problem', plane: 'p1', title, links: [{ to: 'c11', kind: 'for' }] }] as [string, Record<string, unknown>]), 'three problems for bakers'),
      answer('In the preview: three problems on p1 Segments, each for c11 "Bakers near the tram". None was there already.'),
    ],
    wrong: [change(['Ovens break down on busy Saturdays', 'Flour prices doubled this year', 'No one covers the stall at noon'].map((title) => ['create_card', { type: 'problem', plane: 'p1', title, links: [{ to: 'c11', kind: 'relates' }] }] as [string, Record<string, unknown>])), answer('Imported.')],
  },
  {
    id: 'skill-import-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/import tasks for the Research deck:\ntask | due\nCall five bakers | 2026-11-06\nPrint flyers for Saturday | 2026-11-08',
    graders: [task('Research', 'Call five bakers', { due: '2026-11-06' }), task('Research', 'Print flyers for Saturday', { due: '2026-11-08' }), onlyChanged({ add: { tasks: 2 } }), undoRestores()],
    reference: [
      call('view', { piece: 'p6' }),
      change(
        [
          ['create_task', { deck: 'p6', title: 'Call five bakers', due: '2026-11-06' }],
          ['create_task', { deck: 'p6', title: 'Print flyers for Saturday', due: '2026-11-08' }],
        ],
        'two tasks for Research',
      ),
      answer('In the preview: two tasks in p6 Research\'s todo, due Nov 6 and Nov 8.'),
    ],
    wrong: [change([['create_task', { deck: 'p6', title: 'Call five bakers' }], ['create_task', { deck: 'p6', title: 'Print flyers for Saturday' }]]), answer('Imported.')],
  },
  {
    id: 'skill-import-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/import competitors for Rivals: Freshgo, Kiezkorb, Marktfee',
    graders: [count('card', { type: 'competitor', title: 'Freshgo' }, 1), exists('card', { type: 'competitor', title: 'Kiezkorb', plane: 'Rivals' }), exists('card', { type: 'competitor', title: 'Marktfee', plane: 'Rivals' }), onlyChanged({ add: { competitors: 2 } }), answerIncludes(['Freshgo']), undoRestores()],
    reference: [
      call('search', { query: 'Freshgo Kiezkorb Marktfee', limit: 8 }),
      change(
        [
          ['create_card', { type: 'competitor', plane: 'p2', title: 'Kiezkorb' }],
          ['create_card', { type: 'competitor', plane: 'p2', title: 'Marktfee' }],
        ],
        'two competitors',
      ),
      answer('In the preview: Kiezkorb and Marktfee on p2 Rivals. Freshgo is already there (c36 Freshgo), so I skipped it.'),
    ],
    wrong: [change(['Freshgo', 'Kiezkorb', 'Marktfee'].map((title) => ['create_card', { type: 'competitor', plane: 'p2', title }] as [string, Record<string, unknown>])), answer('Imported all three, Freshgo too.')],
  },

  // ---- /interview
  {
    id: 'skill-interview-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/interview "Bakers near the tram"',
    graders: [docWritten({ cites: [R('c11'), R('c49')], words: [/last time/i], excludes: [/would you (use|pay|buy)/i] }), DOC_ONLY, undoRestores()],
    reference: [
      calls(['get', { ids: ['c11'] }], ['neighbours', { id: 'c11' }]),
      doc('Interview script: Bakers near the tram', [
        '# Interview script: Bakers near the tram',
        '',
        '## Who and why',
        '- c11 "Bakers near the tram" (testing +3): we want to know if the pain is real enough to pay for.',
        '- Beliefs to test: c49 "Office lunch groups throw away unsold greens every evening" (their buyers), c70 "Remind about pickup slots in one tap".',
        '',
        '## Warm-up',
        '- What does a normal Saturday look like for you?',
        '- When do you open, and when does it get busy?',
        '',
        '## The past, specifically',
        '- Tell me about the last time you had bread left at closing. What did you do with it? (tests c49 "Office lunch groups throw away unsold greens every evening")',
        '- When did a customer last ask to reserve something? How did you handle it? (tests c70 "Remind about pickup slots in one tap")',
        '- What do you use today to tell regulars what you have?',
        '',
        '## Listen for',
        '- Money or time lost, workarounds, things they already pay for.',
        '',
        '## Ask for',
        '- A one-week pre-order pilot at their stall.',
      ]),
      docSaid('an interview script for c11 "Bakers near the tram" (questions about the past, each tied to the card it tests)'),
    ],
    wrong: [doc('Interview: bakers', ['# Interview', '- c11 "Bakers near the tram"', '- Would you use an app to pre-order bread?', '- Would you pay 2 € for it?', '- c49 "Office lunch groups throw away unsold greens every evening"']), answer('Wrote it.')],
  },
  {
    id: 'skill-interview-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/interview c92',
    graders: [docWritten({ cites: [R('c92'), R('c69')], min: 2, words: [/last time|when did/i] }), DOC_ONLY, undoRestores()],
    reference: [
      calls(['get', { ids: ['c92'] }], ['neighbours', { id: 'c92' }]),
      doc('Interview script: rain and stall owners', [
        '# Interview script: rain and stall owners',
        '- Testing c92 "Stall owners miss the market when it rains" (testing +2 −1) and whether c69 "Deliver stall opening hours for pickup" would help.',
        '',
        '## Questions',
        '- When did rain last keep you from setting up? What did you lose that day?',
        '- What did your regulars do the last time it rained? (c92 "Stall owners miss the market when it rains")',
        '- How do you tell them you are closed today? (c69 "Deliver stall opening hours for pickup")',
        '',
        '## Ask for',
        '- Their WhatsApp group, to see what they post on rainy days.',
      ]),
      docSaid('an interview script for c92 "Stall owners miss the market when it rains"'),
    ],
    wrong: [doc('Interview: rain', ['# Interview', '- c92 "Stall owners can\'t take card payments"', '- When did rain last stop you?', '- c69 "Deliver stall opening hours for pickup"']), answer('Wrote it.')],
  },
  {
    id: 'skill-interview-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/interview Office lunch groups near the tram',
    graders: [docWritten({ cites: [R('c85'), R('c49')], words: [/last time|when did/i], excludes: [/would you (use|pay|buy)/i] }), DOC_ONLY, undoRestores()],
    reference: [
      calls(['get', { ids: ['c85'] }], ['neighbours', { id: 'c85' }]),
      doc('Interview script: Office lunch groups near the tram', [
        '# Interview script: Office lunch groups near the tram',
        '- c85 "Office lunch groups near the tram" is validated (+3); we test the problems tagged for them.',
        '',
        '## Questions',
        '- Walk me through the last time your team bought lunch at the market. Who went, when, what did it cost?',
        '- When did you last find the stall sold out? (c87 "Organic farmers pay too much at the supermarket instead")',
        '- What happens to what you don\'t eat? (c49 "Office lunch groups throw away unsold greens every evening")',
        '- How do you order today? (c123 "Pickup slots checkout")',
      ]),
      docSaid('an interview script for c85 "Office lunch groups near the tram"'),
    ],
    wrong: [doc('Interview', ['# Interview', '- c85 "Office lunch groups near the tram"', '- Would you pay for pre-orders?', '- c49 "Office lunch groups throw away unsold greens every evening"', '- c87 "Organic farmers pay too much at the supermarket instead"']), answer('Wrote it.')],
  },

  // ---- /swot
  {
    id: 'skill-swot-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/swot',
    graders: [
      docWritten({ words: ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'], cites: [R('c65'), R('c47')], min: 6 }),
      docSectionCards(/strength|weakness/i, (c) => c.type !== 'competitor', 'no competitor under strengths or weaknesses'),
      docSectionCards(/threat/i, (c) => c.type === 'competitor' || c.validation !== 'validated', 'nothing of ours that is validated under threats'),
      DOC_ONLY,
      noDeletes(),
      undoRestores(),
    ],
    reference: [
      calls(['query', { kind: 'card', status: 'validated', limit: 30 }], ['query', { kind: 'card', status: 'invalidated', limit: 30 }], ['query', { kind: 'card', type: 'competitor', limit: 20 }]),
      doc('SWOT: Pazar', [
        '# SWOT: Pazar',
        '',
        '## Strengths',
        '- c65 "Bundle leftover produce by WhatsApp" is validated with three pieces of evidence.',
        '- c75 "Swap market maps in one tap" is validated (+3).',
        '- c86 "Young parents in Kadıköy (core)" is a validated segment (+3).',
        '',
        '## Weaknesses',
        '- c62 "Deliver bread at a discount" was invalidated.',
        '- c2 "Organic farmers in Beşiktaş (early)" is marked validated with no evidence behind it.',
        '',
        '## Opportunities',
        '- c33 "Retired regulars never know prices before they arrive" is a validated problem (+2).',
        '- c91 "Restaurant buyers wait in long queues at the cheese stall" is validated (+2 −1).',
        '',
        '## Threats',
        '- c47 "Localmate" (Germany) competes on six of our cards.',
        '- c40 "Localrun" (global) competes on five.',
        '',
        '## So what',
        '- Lead with leftovers (c65 "Bundle leftover produce by WhatsApp"); back c2 "Organic farmers in Beşiktaş (early)" or drop it; watch Localmate in Berlin.',
      ]),
      docSaid('a SWOT of Pazar (14 points, every one tied to its card)'),
    ],
    // Every card real and named right, but placed wrong: a rival as our strength, our validated idea as a threat.
    wrong: [doc('SWOT: Pazar', ['# SWOT', '## Strengths', '- c47 "Localmate" is strong in Germany.', '- c75 "Swap market maps in one tap"', '## Weaknesses', '- c62 "Deliver bread at a discount"', '## Opportunities', '- c33 "Retired regulars never know prices before they arrive"', '## Threats', '- c65 "Bundle leftover produce by WhatsApp" could be copied.', '- c40 "Localrun"']), answer('Wrote the SWOT.')],
  },
  {
    id: 'skill-swot-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/swot for Pricing',
    graders: [docWritten({ words: ['Strengths', 'Threats'], onPlane: 'Pricing', min: 5 }), DOC_ONLY, undoRestores()],
    reference: [
      call('view', { piece: 'p10' }),
      doc('SWOT: Pricing', [
        '# SWOT: Pricing',
        '## Strengths',
        '- c132 "Students in Neukölln" is a validated segment (+2).',
        '- c140 "Reserve leftover produce from the stall" is testing well (+2) and solves four problems.',
        '## Weaknesses',
        '- c138 "Share stall opening hours every Friday" was invalidated with no evidence written down.',
        '## Opportunities',
        '- c130 "Office lunch groups in Beşiktaş" is validated (+1) and has a feature made for it.',
        '- c139 "Remind about stall opening hours for pickup" is testing +2.',
        '## Threats',
        '- c134 "Map recipes at a discount" faces Freshgo and Bazaarrun, and its evidence is split (+1 −1).',
      ]),
      docSaid('a SWOT of the Pricing plane'),
    ],
    wrong: [doc('SWOT: Pricing', ['# SWOT', '## Strengths', '- c65 "Bundle leftover produce by WhatsApp"', '- c132 "Students in Neukölln"', '## Threats', '- c47 "Localmate"', '- c134 "Map recipes at a discount"', '- c138 "Share stall opening hours every Friday"']), answer('Wrote it.')],
  },
  {
    id: 'skill-swot-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/swot and share it with the team',
    graders: [docWritten({ words: ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'], shared: true }), DOC_ONLY, undoRestores()],
    reference: [
      call('query', { kind: 'card', status: 'validated', limit: 30 }),
      doc(
        'SWOT: Pazar',
        [
          '# SWOT: Pazar',
          '## Strengths',
          '- c65 "Bundle leftover produce by WhatsApp" (validated +3).',
          '## Weaknesses',
          '- c62 "Deliver bread at a discount" (invalidated).',
          '## Opportunities',
          '- c33 "Retired regulars never know prices before they arrive" (validated +2).',
          '## Threats',
          '- c47 "Localmate" competes on six of our cards.',
        ],
        { share: true },
      ),
      answer('A SWOT of Pazar waits in the preview, shared with everyone in the workspace once you apply it.'),
    ],
    wrong: [doc('SWOT: Pazar', ['# SWOT', '## Strengths', '- c65 "Bundle leftover produce by WhatsApp"', '## Weaknesses', '- c62 "Deliver bread at a discount"', '## Opportunities', '- c33 "Retired regulars never know prices before they arrive"', '## Threats', '- c47 "Localmate"']), answer('Wrote and shared it.')],
  },

  // ---- /one-pager
  {
    id: 'skill-one-pager-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/one-pager',
    graders: [docWritten({ words: ['Pazar', /next steps/i], cites: [R('c58')], min: 5 }), DOC_ONLY, undoRestores()],
    reference: [
      calls(['query', { kind: 'card', type: 'customer', status: 'validated' }], ['query', { kind: 'card', type: 'idea', limit: 30 }], ['query', { kind: 'card', type: 'competitor', limit: 20 }]),
      doc('Pazar in one page', [
        '# Pazar in one page',
        'Pre-orders from neighbourhood market stalls, picked up on the way home.',
        '## For whom',
        '- c85 "Office lunch groups near the tram" and c86 "Young parents in Kadıköy (core)", both validated.',
        '## The problem',
        '- c24 "Weekend shoppers sell out by 10am and turn people away" (testing +2).',
        '## Our approach',
        '- c58 "Pre-order bread for pickup" (a hypothesis) and c65 "Bundle leftover produce by WhatsApp" (validated +3).',
        '## Competitors',
        '- c47 "Localmate" in Germany, c38 "Bazaarmate" in Turkey.',
        '## Next steps',
        '- Pilot c58 "Pre-order bread for pickup" at one stall for a week.',
      ]),
      docSaid('a one-pager for Pazar'),
    ],
    wrong: [doc('Pazar', ['# Pazar', 'We help markets.', '## Next steps', '- Grow.']), answer('Wrote it.')],
  },
  {
    id: 'skill-one-pager-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/one-pager on Roadmap for a new teammate',
    graders: [docWritten({ words: ['Roadmap'], onPlane: 'Roadmap', min: 4 }), DOC_ONLY, undoRestores()],
    reference: [
      call('view', { piece: 'p9' }),
      doc('Roadmap in one page', [
        '# Roadmap in one page',
        '## Shipped',
        '- c102 "Seasonal boxes dashboard" and c107 "The weekly basket onboarding".',
        '## Building now',
        '- c109 "Cheese map" (P1, impact high) and c99 "Prices pickup slots".',
        '## Planned next',
        '- c114 "Seasonal boxes push alerts" (P1, impact high).',
        '## Packages',
        '- c127 "Cheese bundle" holds four features.',
      ]),
      docSaid('a one-pager on the Roadmap plane'),
    ],
    wrong: [doc('Roadmap', ['# Roadmap', '- c102 "Seasonal boxes dashboard"', '- c58 "Pre-order bread for pickup"', '- c109 "Cheese map"', '- c114 "Seasonal boxes push alerts"']), answer('Wrote it.')],
  },
  {
    id: 'skill-one-pager-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    setup: withNotes('We only sell in Berlin for now.'),
    ask: '/one-pager',
    graders: [docWritten({ words: ['Berlin'], min: 3 }), DOC_ONLY, undoRestores()],
    reference: [
      call('query', { kind: 'card', type: 'customer', status: 'validated' }),
      doc('Pazar in one page', [
        '# Pazar in one page',
        'Pre-orders from neighbourhood market stalls, picked up on the way home; for now only in Berlin (the agent notes).',
        '## For whom',
        '- c85 "Office lunch groups near the tram" (validated +3).',
        '## Approach',
        '- c65 "Bundle leftover produce by WhatsApp" (validated +3).',
        '## Competitors in Berlin',
        '- c47 "Localmate" (Germany).',
      ]),
      docSaid('a one-pager for Pazar, Berlin only as the agent notes say'),
    ],
    wrong: [doc('Pazar in one page', ['# Pazar', '- c85 "Office lunch groups near the tram"', '- c65 "Bundle leftover produce by WhatsApp"', '- c47 "Localmate"', 'We sell in Istanbul and Berlin.'.replace('Berlin', 'Munich')]), answer('Wrote it.')],
  },

  // ---- /pitch
  {
    id: 'skill-pitch-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/pitch',
    graders: [docWritten({ words: ['Problem', 'Solution', 'Traction'], min: 5 }), DOC_ONLY, undoRestores()],
    reference: [
      calls(['query', { kind: 'card', status: 'validated', limit: 30 }], ['query', { kind: 'card', type: 'competitor', limit: 20 }]),
      doc('Pitch: Pazar', [
        '# Pitch: Pazar',
        'For office lunch groups who find stalls sold out, Pazar is a pre-order service that holds their food until they pass by; unlike Localmate, it runs on the WhatsApp the stalls already use.',
        '## Problem',
        '- c24 "Weekend shoppers sell out by 10am and turn people away" (testing +2).',
        '- c33 "Retired regulars never know prices before they arrive" (validated +2).',
        '## Solution',
        '- c58 "Pre-order bread for pickup" and c65 "Bundle leftover produce by WhatsApp".',
        '## Traction',
        '- c65 "Bundle leftover produce by WhatsApp" validated with three pieces of evidence; c85 "Office lunch groups near the tram" validated (+3).',
        '## Competition',
        '- c47 "Localmate" (Germany).',
        '## The ask',
        '- A pilot partner market in Berlin.',
      ]),
      docSaid('a pitch outline for Pazar'),
    ],
    wrong: [doc('Pitch', ['# Pitch', '## Problem', '- Markets are hard.', '## Solution', '- An app.', '## Traction', '- 10,000 users.']), answer('Wrote it.')],
  },
  {
    id: 'skill-pitch-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/pitch with the positioning sentence first',
    graders: [docWritten({ words: [/^\s*(#.*\n+)?\s*For .+ who /m, /\bunlike\b/i], min: 3 }), DOC_ONLY, undoRestores()],
    reference: [
      call('query', { kind: 'card', status: 'validated', limit: 30 }),
      doc('Pitch: Pazar', [
        '# Pitch: Pazar',
        'For young parents who can\'t get to the market early, Pazar is a pre-order service that keeps a basket for them; unlike Freshgo, it uses the stalls they already trust.',
        '## Problem',
        '- c24 "Weekend shoppers sell out by 10am and turn people away".',
        '## Who',
        '- c86 "Young parents in Kadıköy (core)" (validated +3).',
        '## Traction',
        '- c65 "Bundle leftover produce by WhatsApp" (validated +3).',
      ]),
      docSaid('a pitch for Pazar that opens with its positioning'),
    ],
    wrong: [doc('Pitch: Pazar', ['# Pitch', '## Problem', '- c24 "Weekend shoppers sell out by 10am and turn people away"', '## Who', '- c86 "Young parents in Kadıköy (core)"', '## Traction', '- c65 "Bundle leftover produce by WhatsApp"']), answer('Wrote it.')],
  },
  {
    id: 'skill-pitch-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/pitch built on our validated ideas',
    graders: [docWritten({ cites: [R('c59'), R('c65'), R('c75')] }), DOC_ONLY, undoRestores()],
    reference: [
      call('query', { kind: 'card', type: 'idea', status: 'validated' }),
      doc('Pitch: what is proven', [
        '# Pitch: what is proven',
        '## Traction: three validated ideas',
        '- c65 "Bundle leftover produce by WhatsApp" (+3).',
        '- c75 "Swap market maps in one tap" (+3).',
        '- c59 "Rate cheese from the stall" (+1).',
        '## The ask',
        '- Help to turn c65 "Bundle leftover produce by WhatsApp" into a paid weekly basket.',
      ]),
      docSaid('a pitch built on the three validated ideas'),
    ],
    wrong: [doc('Pitch', ['# Pitch', '- c65 "Bundle leftover produce by WhatsApp"', '- c75 "Swap market maps in one tap"', '- c62 "Deliver bread at a discount"']), answer('Wrote it.')],
  },

  // ---- /lean-canvas
  {
    id: 'skill-lean-canvas-01',
    group: 'skills',
    set: 'regression',
    fixture: 'medium',
    ask: '/lean-canvas',
    graders: [docWritten({ words: ['Problem', 'Customer segments', 'Unique value proposition', 'Solution', 'Channels', 'Revenue streams', 'Cost structure', 'Key metrics', 'Unfair advantage'], min: 4 }), DOC_ONLY, undoRestores()],
    reference: [
      calls(['query', { kind: 'card', type: 'problem', status: 'validated' }], ['query', { kind: 'card', type: 'customer', status: 'validated' }]),
      doc('Lean canvas: Pazar', [
        '# Lean canvas: Pazar',
        '## 1. Problem',
        '- c23 "Office lunch groups sell out by 10am and turn people away" (validated).',
        '- c33 "Retired regulars never know prices before they arrive" (validated).',
        '## 2. Customer segments',
        '- c85 "Office lunch groups near the tram" (validated); early adopters c86 "Young parents in Kadıköy (core)".',
        '## 3. Unique value proposition',
        '- Your market order, held until you pass by.',
        '## 4. Solution',
        '- c58 "Pre-order bread for pickup" (hypothesis).',
        '## 5. Channels',
        '- unknown: find out how stalls reach regulars today (WhatsApp groups?).',
        '## 6. Revenue streams',
        '- unknown: no pricing card yet.',
        '## 7. Cost structure',
        '- unknown.',
        '## 8. Key metrics',
        '- Pre-orders a week per stall.',
        '## 9. Unfair advantage',
        '- unknown.',
      ]),
      docSaid('a lean canvas for Pazar, nine boxes, unknowns marked'),
    ],
    wrong: [doc('Lean canvas', ['# Lean canvas', '## Problem', '- c23 "Office lunch groups sell out by 10am and turn people away"', '## Solution', '- c58 "Pre-order bread for pickup"', '## Revenue streams', '- 5 € a month', '- c85 "Office lunch groups near the tram"', '- c33 "Retired regulars never know prices before they arrive"']), answer('Wrote it.')],
  },
  {
    id: 'skill-lean-canvas-02',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/lean-canvas for "Young parents on Saturdays (core)"',
    graders: [docWritten({ cites: [R('c12'), R('c87')], words: ['unknown'] }), DOC_ONLY, undoRestores()],
    reference: [
      calls(['get', { ids: ['c12'] }], ['neighbours', { id: 'c12' }]),
      doc('Lean canvas: young parents on Saturdays', [
        '# Lean canvas: young parents on Saturdays',
        '## 1. Problem',
        '- c87 "Organic farmers pay too much at the supermarket instead" (tagged for them).',
        '## 2. Customer segments',
        '- c12 "Young parents on Saturdays (core)" (a hypothesis).',
        '## 4. Solution',
        '- c65 "Bundle leftover produce by WhatsApp" and c66 "Bundle market maps for pickup".',
        '## 5. Channels',
        '- unknown.',
        '## 6. Revenue streams',
        '- unknown.',
      ]),
      docSaid('a lean canvas for c12 "Young parents on Saturdays (core)"'),
    ],
    wrong: [doc('Lean canvas', ['# Lean canvas', '- c12 "Young parents on Saturdays (core)"', '- c65 "Bundle leftover produce by WhatsApp"', '- c66 "Bundle market maps for pickup"', '## Channels', '- Instagram']), answer('Wrote it.')],
  },
  {
    id: 'skill-lean-canvas-03',
    group: 'skills',
    set: 'capability',
    fixture: 'medium',
    ask: '/lean-canvas and share it',
    graders: [docWritten({ words: ['Unfair advantage', 'Key metrics'], shared: true }), DOC_ONLY, undoRestores()],
    reference: [
      call('query', { kind: 'card', status: 'validated', limit: 30 }),
      doc(
        'Lean canvas: Pazar',
        [
          '# Lean canvas: Pazar',
          '## Problem',
          '- c23 "Office lunch groups sell out by 10am and turn people away".',
          '## Customer segments',
          '- c85 "Office lunch groups near the tram".',
          '## Solution',
          '- c65 "Bundle leftover produce by WhatsApp".',
          '## Key metrics',
          '- Pre-orders a week per stall.',
          '## Unfair advantage',
          '- unknown.',
        ],
        { share: true },
      ),
      answer('A lean canvas waits in the preview, shared with everyone here once you apply it.'),
    ],
    wrong: [doc('Lean canvas: Pazar', ['# Lean canvas', '- c23 "Office lunch groups sell out by 10am and turn people away"', '- c85 "Office lunch groups near the tram"', '- c65 "Bundle leftover produce by WhatsApp"', '## Key metrics', '## Unfair advantage']), answer('Wrote it.')],
  },
]

// The judged twins: the first task of each skill whose quality only a reader can tell, again, with an LLM judge on top
// (skipped on the stub: unjudged, never failed).
const JUDGED: [string, Grader][] = [
  ['gaps', JUDGE_GAPS],
  ['next', JUDGE_NEXT],
  ['interview', JUDGE_DOC],
  ['swot', JUDGE_DOC],
  ['one-pager', JUDGE_DOC],
  ['pitch', JUDGE_DOC],
  ['lean-canvas', JUDGE_DOC],
]
for (const [name, j] of JUDGED) {
  const first = SKILL_TASKS.find((t) => t.id === `skill-${name}-01`)!
  SKILL_TASKS.push({ ...first, id: `skill-${name}-04-judged`, set: 'capability', graders: [...first.graders, j] })
}
