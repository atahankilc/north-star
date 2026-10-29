// Context (agent.md §8, 6 tasks): "this", "here", "these" mean what the person has selected, focused, open beside or
// in the panel. Graded on the right thing being touched and nothing else. Each wrong script touches a plausible
// neighbour (the card next to the selected one, the other deck, the plane's other piece).
import { count, exists, field, linked, noOverlaps, onlyChanged, task, tableCell, undoRestores, absent } from '../graders'
import type { Task } from '../types'
import { answer, call, change, realOf } from './util'
import { loadFixture } from '../fixtures'

const R = (s: string) => realOf('medium', s)
// The Backlog table's cost column id, read from the fixture.
const costCol = () => loadFixture('medium-table').pieces.find((p) => p.id === R('p12'))!.table!.cols.find((c) => c.name === 'cost')!.id

export const CONTEXT: Task[] = [
  {
    id: 'ctx-01-this-selected',
    group: 'context',
    set: 'regression',
    fixture: 'medium',
    view: { focus: R('p3'), selection: [R('c58')] },
    ask: 'Mark this validated.',
    graders: [field('Pre-order bread for pickup', 'validation', 'validated'), onlyChanged({ allow: [R('c58')] }), undoRestores()],
    reference: [call('where_am_i'), change([['update_card', { card: 'c58', fields: { validation: 'validated' } }]]), answer('c58 "Pre-order bread for pickup" is now validated. It has no evidence yet, so it will show `!` until something backs it.')],
    wrong: [call('where_am_i'), change([['update_card', { card: 'c57', fields: { validation: 'validated' } }]]), answer('Marked it validated.')],
  },
  {
    id: 'ctx-02-here-focused',
    group: 'context',
    set: 'regression',
    fixture: 'medium',
    view: { focus: R('p2') },
    ask: 'Add a competitor called Kiezkorb here.',
    graders: [exists('card', { type: 'competitor', title: 'Kiezkorb', plane: 'Rivals' }), count('card', { title: 'Kiezkorb' }, 1), onlyChanged({ add: { competitors: 1 } }), noOverlaps('Rivals'), undoRestores()],
    reference: [call('where_am_i'), change([['create_card', { type: 'competitor', plane: 'p2', title: 'Kiezkorb' }]]), answer('Added the competitor Kiezkorb on p2 Rivals.')],
    wrong: [change([['create_card', { type: 'competitor', plane: 'p1', title: 'Kiezkorb' }]]), answer('Added Kiezkorb here.')],
  },
  {
    id: 'ctx-03-deck-open-beside',
    group: 'context',
    set: 'capability',
    fixture: 'medium',
    view: { focus: R('p9'), side: { tab: R('p13'), days: false, linked: R('p9') } },
    ask: "Add a task 'Write the pickup FAQ' here.",
    graders: [task('Sprint', 'Write the pickup FAQ', { column: 'todo' }), absent('task', { deck: 'Research', title: 'Write the pickup FAQ' }), onlyChanged({ add: { tasks: 1 } }), undoRestores()],
    reference: [call('where_am_i'), change([['create_task', { deck: 'p13', title: 'Write the pickup FAQ' }]]), answer('Added "Write the pickup FAQ" to todo on p13 Sprint, the deck you have open.')],
    wrong: [change([['create_task', { deck: 'p6', title: 'Write the pickup FAQ' }]]), answer('Added it here.')],
  },
  {
    id: 'ctx-04-task-panel',
    group: 'context',
    set: 'regression',
    fixture: 'medium',
    view: { panel: { task: R('t41') }, side: { tab: R('p13'), days: false, linked: null } },
    ask: 'Move this to review.',
    graders: [task('Sprint', R('t41'), { column: 'review' }), count('task', { deck: 'Sprint', column: 'review' }, 12), onlyChanged({ allow: [R('t41')] }), undoRestores()],
    reference: [call('where_am_i'), change([['move_task', { task: 't41', column: 'review' }]]), answer('Moved t41 "Ship Saturday pilot" to review on p13 Sprint.')],
    // The task next to it in the list.
    wrong: [change([['move_task', { task: 't35', column: 'review' }]]), answer('Moved it to review.')],
  },
  {
    id: 'ctx-05-these-selected',
    group: 'context',
    set: 'capability',
    fixture: 'medium',
    view: { focus: R('p3'), selection: [R('c55'), R('c57'), R('c60')] },
    ask: "Link these as solving 'Stall owners carry heavy bags home on foot'.",
    graders: [
      linked('Map prices by WhatsApp', 'Stall owners carry heavy bags home on foot', 'solves'),
      linked('Pre-order market maps at a discount', 'Stall owners carry heavy bags home on foot', 'solves'),
      linked('Swap the weekly basket the night before', 'Stall owners carry heavy bags home on foot', 'solves'),
      onlyChanged({ add: { edges: 3 } }),
      // Three change calls in one turn are still one undo step (§7.2 point 2).
      undoRestores(),
    ],
    reference: [
      call('where_am_i'),
      change([['link', { from: 'c55', to: 'c53', kind: 'solves' }]]),
      change([['link', { from: 'c57', to: 'c53', kind: 'solves' }]]),
      change([['link', { from: 'c60', to: 'c53', kind: 'solves' }]]),
      answer('Linked c55, c57 and c60 —solves→ c53 "Stall owners carry heavy bags home on foot".'),
    ],
    // One of the three swapped for a card that isn't selected.
    wrong: [change(['c55', 'c57', 'c58'].map((c) => ['link', { from: c, to: 'c53', kind: 'solves' }] as [string, Record<string, unknown>])), answer('Linked the three.')],
  },
  {
    id: 'ctx-06-table-beside',
    group: 'context',
    set: 'capability',
    fixture: 'medium-table',
    view: { focus: R('p9'), beside: [R('p12')] },
    ask: 'In this table, put 1200 in the cost column for Bread chat.',
    graders: [tableCell('Backlog', 'Bread chat', 'cost', 1200), onlyChanged({ allow: [(id) => id === `${R('p12')}_${R('c105')}_${costCol()}`] }), undoRestores()],
    reference: [call('where_am_i'), call('view', { piece: 'p12' }), change([['update_cell', { id: 'p12', row: 'Bread chat', col: 'cost (€)', value: 1200 }]]), answer('Put 1200 € in the cost column for c105 Bread chat in p12 Backlog.')],
    // The wrong row.
    wrong: [change([['update_cell', { id: 'p12', row: 'Cheese map', col: 'cost', value: 1200 }]]), answer('Done.')],
  },
]

