// Find & answer (agent.md §8, 10 tasks): questions about the workspace. Graded on the items cited (they exist and are
// the right set: `only` on every closed set) and words in the answer; the judge reads the answer once a model is
// configured. Each has a plausible wrong script (a partial set, a wrong item, a wrong count) so `--wrong` tests
// precision, not only that something was said.
import { answerIncludes, cites, judge, noWrites } from '../graders'
import type { Task } from '../types'
import { answer, call, realOf } from './util'

const R = (s: string) => realOf('medium', s)

const NO_EVIDENCE = ['c15', 'c16', 'c17', 'c18', 'c19', 'c20', 'c21', 'c25', 'c26', 'c27', 'c28', 'c29', 'c30', 'c31', 'c34', 'c49', 'c50', 'c51', 'c52', 'c87', 'c88', 'c90', 'c93', 'c94', 'c95', 'c96']
// Short ids are the chat's; graders take real ids or titles, so the lists below name cards by title.
const T = {
  c15: 'Restaurant buyers never know prices before they arrive',
  c16: 'Bakers carry heavy bags home on foot',
  c17: "Young parents can't take card payments",
  c18: 'Students throw away unsold greens every evening',
  c19: 'Restaurant buyers pay too much at the supermarket instead',
  c20: 'Bakers never know prices before they arrive',
  c21: "Retired regulars can't tell what is in season this week",
  c25: 'Organic farmers throw away unsold greens every evening',
  c26: 'Students carry heavy bags home on foot',
  c27: 'Retired regulars throw away unsold greens every evening',
  c28: "Organic farmers can't take card payments",
  c29: 'Restaurant buyers miss the market when it rains',
  c30: 'Students wait in long queues at the cheese stall',
  c31: "Stall owners can't take card payments",
  c34: "Neighbourhood cooks can't tell what is in season this week",
  c49: 'Office lunch groups throw away unsold greens every evening',
  c50: "Bakers can't take card payments",
  c51: 'Restaurant buyers have no way to reserve the last loaves',
  c52: 'Neighbourhood cooks pay too much at the supermarket instead',
  c87: 'Organic farmers pay too much at the supermarket instead',
  c88: 'Restaurant buyers lose regulars when they move away',
  c90: 'Office lunch groups pay too much at the supermarket instead',
  c93: "Young parents can't tell what is in season this week",
  c94: 'Stall owners throw away unsold greens every evening',
  c95: 'Neighbourhood cooks miss the market when it rains',
  c96: 'Stall owners have no way to reserve the last loaves',
} as Record<string, string>

// Every competitor the region filter counts for Germany (itself, DACH, Europe-wide, global): a closed set.
const GERMANY = ['Freshgo', 'Tarlamate', 'Localmate', 'Hasatdrop', 'Sepetbox', 'Sepetnow', 'Marketclub', 'Bazaarcart', 'Hasatclub', 'Localrun', 'Bazaarrun', 'Stallbox']
// Ayşe's tasks not in a finished column (by id: titles repeat).
const MY_OPEN = ['t5', 't7', 't12', 't30', 't38', 't36', 't35', 't26', 't39', 't43']

export const FIND: Task[] = [
  {
    id: 'find-01-no-evidence',
    group: 'find',
    set: 'regression',
    fixture: 'medium',
    ask: 'Which problems have no evidence yet?',
    graders: [noWrites(), cites(NO_EVIDENCE.map((s) => T[s]), { only: true }), answerIncludes(['26'])],
    reference: [
      call('query', { kind: 'card', type: 'problem', no_evidence: true, limit: 100 }),
      answer(`26 problems have no evidence yet: ${NO_EVIDENCE.join(', ')}. Most are still hypotheses; c26, c87, c90 and c93 carry a status that nothing backs.`),
    ],
    // A partial set (the first page of a paged query) plus one that has evidence.
    wrong: [call('query', { kind: 'card', type: 'problem', no_evidence: true, limit: 20 }), answer(`26 problems have no evidence yet: ${NO_EVIDENCE.slice(0, 20).join(', ')} and c22.`)],
  },
  {
    id: 'find-02-competitors-germany',
    group: 'find',
    set: 'regression',
    fixture: 'medium',
    ask: 'Who are our competitors in Germany?',
    graders: [noWrites(), cites(GERMANY, { only: true })],
    reference: [
      call('query', { region: 'Germany' }),
      answer(
        'In Germany itself: c36 Freshgo, c43 Tarlamate and c47 Localmate. Across DACH: c41 Hasatdrop, c42 Sepetbox and c45 Sepetnow. Europe-wide or global players that also reach Germany: c35 Marketclub, c37 Bazaarcart, c39 Hasatclub, c40 Localrun, c44 Bazaarrun, c46 Stallbox.',
      ),
    ],
    // Only the ones that say Germany, and one from Turkey.
    wrong: [call('query', { region: 'Germany' }), answer('c36 Freshgo, c43 Tarlamate, c47 Localmate and c48 Kioskgo.')],
  },
  {
    id: 'find-03-late-on-research',
    group: 'find',
    set: 'regression',
    fixture: 'medium',
    ask: "What's late on the Research deck?",
    graders: [noWrites(), cites(['t5', 't1', 't13', 't7', 't4'].map(R), { only: true }), answerIncludes(['5'])],
    reference: [
      call('query', { kind: 'task', deck: 'Research', overdue: true }),
      answer(
        '5 tasks on p6 Research are past due: t5 "Draft the stall onboarding" (due 2026-10-18, Ayşe), t1 "Visit five stall owners" (2026-10-19, nobody), t13 "Interview the stall onboarding" (2026-10-27, in review), t7 "Price Saturday pilot" (2026-10-28, Ayşe) and t4 "Write the WhatsApp bot" (2026-10-29, Jonas).',
      ),
    ],
    // One from the Sprint deck mixed in, one missing.
    wrong: [call('query', { kind: 'task', deck: 'Research', overdue: true }), answer('5 tasks are late: t5, t1, t13, t7 and t41 "Ship Saturday pilot".')],
  },
  {
    id: 'find-04-summarise-bets',
    group: 'find',
    set: 'capability',
    fixture: 'medium',
    ask: 'Summarise plane Bets for me.',
    graders: [
      noWrites(),
      answerIncludes([/\b(22|twenty[- ]two)\s+ideas\b/i, /\b(6|six)\s+problems\b/i]),
      cites(['Rate cheese from the stall', 'Bundle leftover produce by WhatsApp', 'Swap market maps in one tap']),
      judge('A short, faithful summary of the Bets plane: what it holds (problems and ideas), which ideas are validated or invalidated, and no claims the plane does not support.'),
    ],
    reference: [
      call('view', { piece: 'p3' }),
      answer(
        'p3 Bets holds 28 cards: six problems in the "Pains" section and twenty-two ideas under "What we build". Three ideas are validated (c59 Rate cheese from the stall, c65 Bundle leftover produce by WhatsApp, c75 Swap market maps in one tap); five are invalidated (c56, c62, c63, c67, c76); most of the rest are being tested. Two sticky notes ask who owns the stall data and suggest starting with bread.',
      ),
    ],
    // Wrong counts and a wrong validated idea.
    wrong: [call('view', { piece: 'p3' }), answer('p3 Bets holds 20 ideas and 8 problems. The validated ideas are c58 Pre-order bread for pickup and c59 Rate cheese from the stall.')],
  },
  {
    id: 'find-05-validated-ideas',
    group: 'find',
    set: 'regression',
    fixture: 'medium',
    ask: 'Which ideas are validated?',
    graders: [noWrites(), cites(['Rate cheese from the stall', 'Bundle leftover produce by WhatsApp', 'Swap market maps in one tap'], { only: true })],
    reference: [call('query', { kind: 'card', type: 'idea', status: 'validated' }), answer('Three: c59 "Rate cheese from the stall", c65 "Bundle leftover produce by WhatsApp" and c75 "Swap market maps in one tap".')],
    wrong: [call('query', { kind: 'card', type: 'idea', status: 'validated' }), answer('Three: c59 "Rate cheese from the stall", c65 "Bundle leftover produce by WhatsApp" and c73 "Swap pickup slots with neighbours".')],
  },
  {
    id: 'find-06-doing-on-sprint',
    group: 'find',
    set: 'capability',
    fixture: 'medium',
    ask: "Who is working on what in the Sprint deck's doing column?",
    graders: [noWrites(), cites(['t38', 't35'].map(R)), answerIncludes(['13'])],
    reference: [
      call('query', { kind: 'task', deck: 'Sprint', column: 'doing', limit: 50 }),
      answer('13 tasks are in doing on p13 Sprint (over its limit of 5). Ayşe has t38 "Call the landing page", t36, t35 "Write five stall owners", t39 and t43; the rest are spread across Jonas and Mert or given to nobody.'),
    ],
    // The first page only: a wrong count.
    wrong: [call('query', { kind: 'task', deck: 'Sprint', column: 'doing', limit: 5 }), answer('5 tasks are in doing on p13 Sprint: Ayşe has t38 "Call the landing page" and t35 "Write five stall owners".')],
  },
  {
    id: 'find-07-contradicting-interviews',
    group: 'find',
    set: 'regression',
    fixture: 'medium',
    ask: 'On Interviews, which cards have a status their evidence does not back?',
    graders: [noWrites(), cites(['Organic farmers pay too much at the supermarket instead', 'Office lunch groups pay too much at the supermarket instead', "Young parents can't tell what is in season this week"], { only: true })],
    reference: [
      call('query', { kind: 'card', plane: 'Interviews', contradicting: true }),
      answer('Three on p4 Interviews: c87 "Organic farmers pay too much at the supermarket instead" is validated with no evidence; c90 "Office lunch groups pay too much at the supermarket instead" and c93 "Young parents can\'t tell what is in season this week" are invalidated with nothing to show for it.'),
    ],
    wrong: [call('query', { kind: 'card', plane: 'Interviews', contradicting: true }), answer('Three: c87, c90 and c89 "Office lunch groups can\'t tell what is in season this week".')],
  },
  {
    id: 'find-08-my-tasks',
    group: 'find',
    set: 'capability',
    fixture: 'medium',
    ask: 'What tasks do I still have open?',
    graders: [noWrites(), cites(MY_OPEN.map(R), { only: true }), answerIncludes(['10'])],
    reference: [
      call('query', { kind: 'task', assignee: 'me', limit: 50 }),
      answer('You have 10 open tasks (5 more are done): on p6 Research t5 "Draft the stall onboarding" (overdue), t7 (overdue) and t12 (in review); on p13 Sprint t30 "Test three restaurants", t38 "Call the landing page", t36, t35, t26, t39 and t43.'),
    ],
    // A done task counted as open, one open task missing.
    wrong: [call('query', { kind: 'task', assignee: 'me', limit: 50 }), answer('You have 10 open tasks: t5, t7, t12, t30, t38, t36, t35, t26, t39 and t15 "Design the order email".')],
  },
  {
    id: 'find-09-pilot-report-cards',
    group: 'find',
    set: 'capability',
    fixture: 'medium',
    ask: 'What does the pilot week 2 report say about card payments?',
    graders: [noWrites(), answerIncludes(['1 in 8']), cites(['Pilot week 2 report']), judge('States that only 1 in 8 stalls takes cards, quoting or citing the report, and adds nothing the report does not say.')],
    reference: [call('search', { query: 'pilot week 2' }), call('read_document', { id: 'd3' }), answer('d3 "Pilot week 2 report" says only 1 in 8 stalls takes cards, and that most stalls run on cash and WhatsApp, so anything we build has to fit that first.')],
    wrong: [call('search', { query: 'pilot week 2' }), answer('d3 "Pilot week 2 report" says most stalls take cards now, about 1 in 2.')],
  },
  {
    id: 'find-10-depends-on-bread-chat',
    group: 'find',
    set: 'regression',
    fixture: 'medium',
    ask: 'Which features depend on Bread chat?',
    graders: [noWrites(), cites(['Cheese map', 'Stall opening hours price list'], { only: true, also: ['Bread chat'] })],
    reference: [call('neighbours', { id: 'c105', kinds: ['depends-on'] }), answer('Two features depend on c105 Bread chat: c109 "Cheese map" and c100 "Stall opening hours price list".')],
    // The link read the wrong way round: what Bread chat depends on counted as depending on it.
    wrong: [call('neighbours', { id: 'c105', kinds: ['depends-on'] }), answer('Two features depend on c105 Bread chat: c109 "Cheese map" and c117 "Leftover produce map".')],
  },
]
