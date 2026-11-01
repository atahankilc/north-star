// Small edits (agent.md §8, 8 tasks; S13 added 5 on the preview: tick off, a delete in the preview, revise, dry run, a person's untick): one
// or two ops, graded on the end state: what was asked is there, nothing else
// changed (`onlyChanged`), one undo step that gives the start back. Each has a plausible wrong script (the wrong card,
// the wrong column, the wrong direction, an extra write) so `--wrong` tests precision.
import { absent, answerIncludes, cell, count, dryRunOnly, exists, field, linked, noDeletes, noOverlaps, onlyChanged, proposedIn, rowBelow, task, undoRestores } from '../graders'
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
      exists('evidence', { card: 'Swap pickup slots with neighbours', kind: 'interview', stance: 'supports', text: /\b(six|6)\b.*\b(eight|8)\b/i }),
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
  // ---- S13: the preview (agent.md §4.5, §4.10): an item ticked off by a note, a delete in the preview (with its why),
  // a revision during the preview, a dry run.
  {
    id: 'edit-09-untick-third',
    group: 'edit',
    set: 'regression',
    fixture: 'medium',
    ask: "Add three ideas to Bets: 'Bread club', 'Cheese club' and 'Olive club'.",
    followUps: ["Don't add the third card."],
    graders: [
      proposedIn(1, { n: 3, ops: ['create_card', 'create_card', 'create_card'] }),
      proposedIn(2, { n: 2 }),
      exists('card', { type: 'idea', title: 'Bread club', plane: 'Bets' }),
      exists('card', { type: 'idea', title: 'Cheese club', plane: 'Bets' }),
      absent('card', { title: 'Olive club' }),
      onlyChanged({ add: { ideas: 2 } }),
      noOverlaps('Bets'),
      undoRestores(),
    ],
    reference: [
      call('view', { piece: 'p3' }),
      change([
        ['create_card', { type: 'idea', plane: 'p3', title: 'Bread club' }],
        ['create_card', { type: 'idea', plane: 'p3', title: 'Cheese club' }],
        ['create_card', { type: 'idea', plane: 'p3', title: 'Olive club' }],
      ], 'three clubs'),
      answer('Proposed three ideas on p3 Bets: "Bread club", "Cheese club" and "Olive club". They wait in the preview.'),
      change([], undefined, { drop: ['i3'] }),
      answer('Took "Olive club" off; the preview now holds "Bread club" and "Cheese club".'),
    ],
    // The note ignored: all three land.
    wrong: [
      change([
        ['create_card', { type: 'idea', plane: 'p3', title: 'Bread club' }],
        ['create_card', { type: 'idea', plane: 'p3', title: 'Cheese club' }],
        ['create_card', { type: 'idea', plane: 'p3', title: 'Olive club' }],
      ]),
      answer('Proposed three ideas.'),
      answer('Done, only two.'),
    ],
  },
  // D-333 (agent-bugs 17): a delete asked for goes straight into the preview with its why; accepting it is the yes,
  // and the app never reads the chat's words for one. Asking "shall I?" first is the wrong path now.
  {
    id: 'edit-10-delete-in-preview',
    group: 'edit',
    set: 'regression',
    autoGo: false,
    fixture: 'medium',
    ask: "Delete Jonas's 'Cash only is a big deal' sticky note on Rivals.",
    // Two stickies say it (x8 Ayşe, x9 Jonas): the ask names which.
    graders: [
      proposedIn(1, { n: 1, ops: ['delete'], deletesWithWhy: true }),
      absent('text', { id: R('x9') }),
      exists('text', { id: R('x8') }),
      onlyChanged({ allow: [R('x9')] }),
      undoRestores(),
    ],
    reference: [
      call('search', { query: 'Cash only is a big deal', kinds: ['text'], scope: 'Rivals' }),
      change([['delete', { ids: ['x9'] }, "Jonas's copy of x8's words on Rivals, as asked"]], 'delete a duplicate sticky'),
      answer("Proposed deleting x9 (Jonas's sticky; x8, Ayşe's, stays): it waits in the preview, struck, with the reason."),
    ],
    // Asks for a yes it doesn't need, and proposes nothing.
    wrong: [call('search', { query: 'Cash only is a big deal', kinds: ['text'], scope: 'Rivals' }), answer('Shall I delete x9? Say yes and I will.')],
  },
  {
    id: 'edit-14-delete-plane-in-preview',
    group: 'edit',
    set: 'capability',
    autoGo: false,
    fixture: 'medium',
    ask: 'Delete the Interviews plane.',
    // Only removals (the plane and what's only on it), and cards also on another plane taking a new home there.
    // Gone: the plane, its text and what lives only on it (with their links, evidence, places, cells); a card also on
    // another plane stays, homed there.
    graders: [
      proposedIn(1, { ops: ['delete'], deletesWithWhy: true }),
      absent('piece', { id: R('p4') }),
      exists('card', { title: 'Neighbourhood cooks with big families', plane: 'Rivals' }),
      exists('card', { title: 'Bread chat', plane: 'Roadmap' }),
      onlyChanged({
        allow: [
          (id, c, r) => {
            const P4 = R('p4')
            if (c.change !== 'removed') return (c.fields ?? []).every((f) => ['pieceId', 'planes', 'updatedAt', 'x', 'y'].includes(f))
            if (c.kind === 'pieces') return id === P4
            if (c.kind === 'labels') return r.start.labels.find((l) => l.id === id)?.pieceId === P4
            const card = r.start.cards.find((x) => x.id === id)
            return card ? card.pieceId === P4 && !(card.planes ?? []).some((p) => p !== P4) : true
          },
        ],
      }),
      undoRestores(),
    ],
    reference: [
      call('view', { piece: 'p4' }),
      change([['delete', { ids: ['p4'] }, 'asked to delete the Interviews plane']], 'delete Interviews'),
      answer('Proposed deleting p4 Interviews with its 21 cards and 4 texts (c105 Bread chat stays on Roadmap): it waits in the preview; applying it is one undo step.'),
    ],
    // Asks for a yes it doesn't need, and proposes nothing.
    wrong: [call('view', { piece: 'p4' }), answer('p4 Interviews holds 21 cards. Delete it with all of that? Yes or no?')],
  },
  // agent-bugs 6: a long one-line paragraph is as tall as it's drawn (labelBox wraps it at its width), so placing it
  // next to a card keeps it off the rows below; counted one line high, it fitted a gap and ran over the next row.
  {
    id: 'edit-15-long-paragraph-clear',
    group: 'edit',
    set: 'regression',
    fixture: 'medium',
    ask: "On Bets, put this note as a paragraph next to 'Office lunch groups throw away unsold greens every evening': Office lunch groups decide by eleven what they will eat, and most of them already order through one person in a WhatsApp group: if the stall posts what is left at half past ten, the person who orders can pre-book a box for the group, the stall stops throwing greens away in the evening, and the group gets a better price than walking past at noon. We tried it with two groups in Kreuzberg in the pilot week and both ordered twice; the third group never answered because nobody in it owned the ordering.",
    graders: [exists('text', { kind: 'paragraph', plane: 'Bets', textHas: 'Office lunch groups decide by eleven' }), noOverlaps('Bets'), onlyChanged({ add: { labels: 1 } }), undoRestores()],
    reference: [
      call('get', { ids: ['c49'] }),
      change([['create_text', { kind: 'paragraph', plane: 'p3', text: "Office lunch groups decide by eleven what they will eat, and most of them already order through one person in a WhatsApp group: if the stall posts what is left at half past ten, the person who orders can pre-book a box for the group, the stall stops throwing greens away in the evening, and the group gets a better price than walking past at noon. We tried it with two groups in Kreuzberg in the pilot week and both ordered twice; the third group never answered because nobody in it owned the ordering.", where: { near: 'c49' } }]], 'the lunch groups note'),
      answer('Proposed the note as a paragraph on p3 Bets next to c49 "Office lunch groups throw away unsold greens every evening": it waits in the preview.'),
    ],
    // On another plane.
    wrong: [change([['create_text', { kind: 'paragraph', plane: 'p2', text: "Office lunch groups decide by eleven what they will eat, and most of them already order through one person in a WhatsApp group: if the stall posts what is left at half past ten, the person who orders can pre-book a box for the group, the stall stops throwing greens away in the evening, and the group gets a better price than walking past at noon. We tried it with two groups in Kreuzberg in the pilot week and both ordered twice; the third group never answered because nobody in it owned the ordering.", where: { near: 'c49' } }]]), answer('Added the note on Bets.')],
  },
  // agent-bugs 10: rearranging a canvas. A row asked below a heading landed above it (the push clear went back across the
  // heading when the stuck matrix met the Working area); view now takes a canvas.
  {
    id: 'edit-16-canvas-row',
    group: 'edit',
    set: 'regression',
    fixture: 'medium',
    // The fixture already had them in that row (Sonnet rightly changed nothing): Bets starts out of it.
    setup: (ws) => ({ ...ws, pieces: ws.pieces.map((p) => (p.id === R('p3') ? { ...p, y: p.y + 1500 } : p)) }),
    ask: "On the Discovery canvas, line the four planes up in one row below the 'Open questions' heading.",
    graders: [rowBelow([R('p1'), R('p2'), R('p3'), R('p4')], R('x28')), onlyChanged({ allow: [(_, c) => c.kind === 'pieces' && (c.fields ?? []).every((f) => ['x', 'y', 'updatedAt'].includes(f))] }), undoRestores()],
    reference: [
      call('view', { piece: 'k1' }),
      change([['arrange', { items: ['p1', 'p2', 'p3', 'p4'], layout: 'row', where: { near: 'x28', side: 'below' } }]], 'the planes in a row'),
      answer('Proposed p1 Segments, p2 Rivals, p3 Bets and p4 Interviews in one row below x28 "Open questions" (p5 Pain map moves with p1, stuck to it): it waits in the preview.'),
    ],
    // Above the heading.
    wrong: [change([['arrange', { items: ['p1', 'p2', 'p3', 'p4'], layout: 'row', where: { near: 'x28', side: 'above' } }]]), answer('Lined them up below the heading.')],
  },
  {
    id: 'edit-11-revise-in-preview',
    group: 'edit',
    set: 'regression',
    fixture: 'medium',
    ask: "Add a problem 'Cheese goes off in summer' for Bakers near the tram, on Segments.",
    followUps: ['Actually make it for Young parents on Saturdays (core) instead.'],
    graders: [
      proposedIn(1, { n: 1, line: /for: problem "Cheese goes off in summer" → customer "Bakers near the tram"/ }),
      linked('Cheese goes off in summer', 'Young parents on Saturdays (core)', 'for'),
      count('card', { title: 'Cheese goes off in summer' }, 1),
      onlyChanged({ add: { problems: 1, edges: 1 } }),
      undoRestores(),
    ],
    reference: [
      call('get', { ids: ['c11'] }),
      change([['create_card', { type: 'problem', plane: 'p1', title: 'Cheese goes off in summer', links: [{ to: 'c11', kind: 'for' }] }]]),
      answer('Proposed the problem "Cheese goes off in summer" on p1 Segments, for c11; it waits in the preview.'),
      change([['create_card', { type: 'problem', plane: 'p1', title: 'Cheese goes off in summer', links: [{ to: 'c12', kind: 'for' }] }]], undefined, { drop: ['i1'] }),
      answer('Changed it: the problem is now for c12 "Young parents on Saturdays (core)" instead of c11; the preview holds only that.'),
    ],
    // A second card added instead of the first one revised.
    wrong: [
      change([['create_card', { type: 'problem', plane: 'p1', title: 'Cheese goes off in summer', links: [{ to: 'c11', kind: 'for' }] }]]),
      answer('Proposed.'),
      change([['create_card', { type: 'problem', plane: 'p1', title: 'Cheese goes off in summer', links: [{ to: 'c12', kind: 'for' }] }]]),
      answer('Changed it.'),
    ],
  },
  {
    id: 'edit-12-dry-run',
    group: 'edit',
    set: 'regression',
    autoGo: false,
    fixture: 'medium',
    ask: "Check whether moving the overdue tasks in review on Sprint to done would work and how many would move, but don't change anything yet.",
    graders: [dryRunOnly(), answerIncludes(['5']), onlyChanged({})],
    reference: [
      call('query', { kind: 'task', deck: 'Sprint', column: 'review', overdue: true }),
      change([['move_task', { tasks: OVERDUE_REVIEW, column: 'done' }]], undefined, { dry_run: true }),
      answer('It would work: 5 overdue tasks in review on p13 Sprint (t52, t54, t46, t44, t45) would move to done. Nothing is changed or proposed; say go to propose it.'),
    ],
    // Proposed for real.
    wrong: [change([['move_task', { tasks: OVERDUE_REVIEW, column: 'done' }]]), answer('5 would move.')],
  },
  {
    id: 'edit-13-person-unticks',
    group: 'edit',
    set: 'regression',
    fixture: 'medium',
    ask: "Add three ideas to Bets: 'Bread club', 'Cheese club' and 'Olive club'.",
    // The person unticks one in the preview (no turn), then accepts.
    followUps: [{ untick: '"Olive club"' }],
    graders: [
      proposedIn(1, { n: 3 }),
      exists('card', { type: 'idea', title: 'Bread club', plane: 'Bets' }),
      exists('card', { type: 'idea', title: 'Cheese club', plane: 'Bets' }),
      absent('card', { title: 'Olive club' }),
      onlyChanged({ add: { ideas: 2 } }),
      undoRestores(),
    ],
    reference: [
      call('view', { piece: 'p3' }),
      change([
        ['create_card', { type: 'idea', plane: 'p3', title: 'Bread club' }],
        ['create_card', { type: 'idea', plane: 'p3', title: 'Cheese club' }],
        ['create_card', { type: 'idea', plane: 'p3', title: 'Olive club' }],
      ], 'three clubs'),
      answer('Proposed three ideas on p3 Bets: "Bread club", "Cheese club" and "Olive club". They wait in the preview.'),
    ],
    // Only two made, and the wrong two: the untick finds nothing to take off, and Cheese club is missing.
    wrong: [
      change([
        ['create_card', { type: 'idea', plane: 'p3', title: 'Bread club' }],
        ['create_card', { type: 'idea', plane: 'p3', title: 'Olive clubs' }],
      ]),
      answer('Proposed the ideas.'),
    ],
  },
]
