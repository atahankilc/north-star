// Small edits (agent.md §8, 8 tasks): one or two ops, graded on the end state: what was asked is there, nothing else
// changed (`onlyChanged`), one undo step that gives the start back. Each has a plausible wrong script (the wrong card,
// the wrong column, the wrong direction, an extra write) so `--wrong` tests precision.
import { cell, count, exists, field, linked, noDeletes, noOverlaps, onlyChanged, task, undoRestores } from '../graders'
import type { Task } from '../types'
import { answer, call, change, realOf } from './util'

const R = (s: string) => realOf('medium', s)
const OVERDUE_REVIEW = ['t52', 't54', 't46', 't44', 't45']

export const EDIT: Task[] = [
  {
    id: 'edit-01-add-problem-for',
    group: 'edit',
    set: 'regression',
    fixture: 'medium',
    ask: "Add a problem 'Stalls run out of paper bags' for the customer Bakers near the tram, on Segments.",
    graders: [
      exists('card', { type: 'problem', title: 'Stalls run out of paper bags', plane: 'Segments' }),
      linked('Stalls run out of paper bags', 'Bakers near the tram', 'for'),
      count('card', { title: 'Stalls run out of paper bags' }, 1),
      onlyChanged({ add: { problems: 1, edges: 1 } }),
      noOverlaps('Segments'),
      undoRestores(),
    ],
    reference: [
      call('get', { ids: ['c11'] }),
      change(
        [
          ['create_card', { type: 'problem', plane: 'p1', title: 'Stalls run out of paper bags', links: [{ to: 'c11', kind: 'for' }] }],
        ],
        'add a problem for Bakers near the tram',
      ),
      answer('Added the problem "Stalls run out of paper bags" on p1 Segments, tagged for c11 Bakers near the tram.'),
    ],
    // Tagged for the wrong customer (c13 "Office lunch groups new to the city").
    wrong: [
      change([
        ['create_card', { type: 'problem', plane: 'p1', title: 'Stalls run out of paper bags', links: [{ to: 'c13', kind: 'for' }] }],
      ]),
      answer('Added it, for Bakers near the tram.'),
    ],
  },
  {
    id: 'edit-02-validate-with-interview',
    group: 'edit',
    set: 'regression',
    fixture: 'medium',
    ask: "Mark the idea 'Swap pickup slots with neighbours' validated, with this interview: six of eight stall owners said they would swap slots.",
    graders: [
      field('Swap pickup slots with neighbours', 'validation', 'validated'),
      exists('evidence', { card: 'Swap pickup slots with neighbours', kind: 'interview', stance: 'supports', textHas: 'six of eight' }),
      onlyChanged({ allow: ['Swap pickup slots with neighbours'], add: { evidence: 1 } }),
      undoRestores(),
    ],
    reference: [
      call('get', { ids: ['c73'] }),
      change(
        [
          ['update_card', { card: 'c73', fields: { validation: 'validated' } }],
          ['create_evidence', { card: 'c73', kind: 'interview', text: 'Six of eight stall owners said they would swap slots.', stance: 'supports' }],
        ],
        'validate Swap pickup slots with neighbours',
      ),
      answer('c73 "Swap pickup slots with neighbours" is now validated, with the interview logged as supporting evidence.'),
    ],
    // The evidence logged on the idea next to it (c70).
    wrong: [
      change([
        ['update_card', { card: 'c73', fields: { validation: 'validated' } }],
        ['create_evidence', { card: 'c70', kind: 'interview', text: 'Six of eight stall owners said they would swap slots.', stance: 'supports' }],
      ]),
      answer('Done.'),
    ],
  },
  {
    id: 'edit-03-overdue-review-to-done',
    group: 'edit',
    set: 'regression',
    fixture: 'medium',
    ask: 'Move the overdue tasks in review on the Sprint deck to done.',
    graders: [
      // By id: titles repeat on the deck ("Map five stall owners" is in done twice).
      ...OVERDUE_REVIEW.map((t) => task('Sprint', R(t), { column: 'done' })),
      count('task', { deck: 'Sprint', column: 'review' }, 6),
      onlyChanged({ allow: OVERDUE_REVIEW.map(R) }),
      undoRestores(),
    ],
    reference: [
      call('query', { kind: 'task', deck: 'Sprint', column: 'review', overdue: true }),
      change([['move_task', { tasks: OVERDUE_REVIEW, column: 'done' }]], 'overdue review tasks to done'),
      answer('Moved 5 overdue tasks from review to done on p13 Sprint: t52, t54, t46, t44 and t45.'),
    ],
    // One overdue task from doing instead of the last one in review.
    wrong: [change([['move_task', { tasks: ['t52', 't54', 't46', 't44', 't41'], column: 'done' }]]), answer('Moved the 5 overdue review tasks to done.')],
  },
  {
    id: 'edit-04-score-freshgo',
    group: 'edit',
    set: 'regression',
    fixture: 'medium',
    ask: 'In the Feature coverage matrix, score Freshgo full on Bread chat.',
    graders: [cell('Feature coverage', 'Bread chat', 'Freshgo', 'full'), cell('Feature coverage', 'Cheese map', 'Freshgo', 'full'), onlyChanged({ allow: [(id) => id === `${R('p11')}_${R('c105')}_${R('c36')}`] }), undoRestores()],
    reference: [
      call('view', { piece: 'p11' }),
      change([['update_cell', { id: 'p11', row: 'Bread chat', col: 'Freshgo', value: 'full' }]], 'Freshgo × Bread chat: full'),
      answer('Done: c36 Freshgo × c105 Bread chat on p11 Feature coverage is now "full" (it was "better", marked as inferred).'),
    ],
    // The right row, the wrong competitor.
    wrong: [change([['update_cell', { id: 'p11', row: 'Bread chat', col: 'Hasatclub', value: 'full' }]]), answer('Freshgo is now full on Bread chat.')],
  },
  {
    id: 'edit-05-rename-deck',
    group: 'edit',
    set: 'regression',
    fixture: 'medium',
    ask: "Rename the Research deck to 'Field research'.",
    graders: [field(R('p6'), 'name', 'Field research', ['piece']), exists('piece', { kind: 'documents', name: 'Research' }), count('task', { deck: 'Field research' }, 20), onlyChanged({ allow: [R('p6')] }), undoRestores()],
    reference: [call('query', { kind: 'piece', type: 'deck', title: 'Research' }), change([['rename', { id: 'p6', name: 'Field research' }]]), answer('Renamed the deck p6 to "Field research"; its 20 tasks are unchanged.')],
    // The other deck renamed (a plausible mix-up between decks).
    wrong: [change([['rename', { id: 'p13', name: 'Field research' }]]), answer('Renamed the Research deck to "Field research".')],
  },
  {
    id: 'edit-06-give-task',
    group: 'edit',
    set: 'capability',
    fixture: 'medium',
    ask: "Give 'Price the pickup flow' to Mert, due 10 November.",
    graders: [task('Sprint', 'Price the pickup flow', { assignee: 'Mert Kaya', due: '2026-11-10' }), onlyChanged({ allow: [R('t54')] }), undoRestores()],
    reference: [
      call('search', { query: 'Price the pickup flow', kinds: ['task'] }),
      change([['update_task', { task: 't54', assignee: 'u-mert', due: '2026-11-10' }]]),
      answer('t54 "Price the pickup flow" on p13 Sprint is now given to Mert Kaya, due 2026-11-10.'),
    ],
    // The wrong person.
    wrong: [change([['update_task', { task: 't54', assignee: 'u-jonas', due: '2026-11-10' }]]), answer('Given to Mert, due 2026-11-10.')],
  },
  {
    id: 'edit-07-link-solves',
    group: 'edit',
    set: 'regression',
    fixture: 'medium',
    ask: "The idea 'Pre-order bread for pickup' solves 'Bakers carry heavy bags home on foot': link them.",
    graders: [linked('Pre-order bread for pickup', 'Bakers carry heavy bags home on foot', 'solves'), onlyChanged({ add: { edges: 1 } }), noDeletes(), undoRestores()],
    reference: [call('get', { ids: ['c58', 'c16'] }), change([['link', { from: 'c58', to: 'c16', kind: 'solves' }]]), answer('Linked c58 "Pre-order bread for pickup" —solves→ c16 "Bakers carry heavy bags home on foot".')],
    // Turned round.
    wrong: [change([['link', { from: 'c16', to: 'c58', kind: 'solves' }]]), answer('Linked them.')],
  },
  {
    id: 'edit-08-add-task-for-card',
    group: 'edit',
    set: 'capability',
    fixture: 'medium',
    ask: "Add a P1 task 'Call the Freshgo founder' to the Research deck, for Freshgo.",
    graders: [task('Research', 'Call the Freshgo founder', { priority: 'P1', card: 'Freshgo', column: 'todo' }), count('task', { deck: 'Research' }, 21), onlyChanged({ add: { tasks: 1 } }), undoRestores()],
    reference: [call('get', { ids: ['c36', 'p6'] }), change([['create_task', { deck: 'p6', title: 'Call the Freshgo founder', card: 'c36', priority: 'P1' }]]), answer('Added the task "Call the Freshgo founder" (P1, for c36 Freshgo) to todo on p6 Research.')],
    // On the other deck.
    wrong: [change([['create_task', { deck: 'p13', title: 'Call the Freshgo founder', card: 'c36', priority: 'P1' }]]), answer('Added it to Research.')],
  },
]
