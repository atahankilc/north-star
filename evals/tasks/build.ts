// Big builds (agent.md §8, 8 tasks): several ops in one change, graded on the end state: what was made found by its
// kind (`MADE`, never by the name the reference happened to give it), nothing else changed, no overlaps where things
// were made or moved, groups and headings laid out as asked, links wired, one undo step; the judge (capability only)
// for what only a reader can tell. Each has a plausible wrong script. A big job (a new piece filled with things, agent.md
// §4.10) is two turns: a plan that writes nothing, then "go" (`followUps`, `noWritesInTurn(1)`).
import { MADE, count, exists, field, grouped, judge, linked, made, noOverlaps, noWritesInTurn, onPlane, onlyChanged, under, undoRestores } from '../graders'
import type { Task } from '../types'
import { answer, call, change, realOf } from './util'

const R = (s: string) => realOf('medium', s)
const IDEAS_ON_BETS = Array.from({ length: 22 }, (_, i) => `c${55 + i}`)
const MATRIX = MADE('piece', { kind: 'matrix' })
const DECK = MADE('piece', { kind: 'deck' })
const TABLE = MADE('piece', { kind: 'table' })
const rulesHold = (type: string) => (rules: unknown) => Array.isArray(rules) && rules.some((x: { field?: string; values?: string[]; not?: boolean }) => x.field === 'type' && !x.not && !!x.values?.includes(type))

export const BUILD: Task[] = [
  {
    id: 'build-01-competitor-matrix',
    group: 'build',
    set: 'regression',
    fixture: 'medium',
    ask: 'Make a competitor matrix for our Roadmap features.',
    followUps: ['go'],
    graders: [
      noWritesInTurn(1),
      made('piece', { kind: 'matrix', canvas: 'Build' }),
      field(MATRIX, 'matrix.rows.type', 'feature', ['piece']),
      field(MATRIX, 'matrix.rows.plane', R('p9'), ['piece']),
      field(MATRIX, 'matrix.cols.type', 'competitor', ['piece']),
      onlyChanged({ add: { pieces: 1 } }),
      undoRestores(),
    ],
    reference: [
      call('view', { piece: 'p9' }),
      answer('Plan: 1. a matrix on k2 Build with the features on p9 Roadmap as rows and every competitor as columns (compare: none / partial / full / better); 2. it starts empty, and I can fill it from what the cards say after. Say go, or change the plan.'),
      change([['create_piece', { kind: 'matrix', canvas: 'k2', name: 'Roadmap vs competitors', matrix: { template: 'compare', rows: { type: 'feature', plane: 'p9' }, cols: { type: 'competitor' } } }]], 'competitor matrix for Roadmap'),
      answer('Made the matrix "Roadmap vs competitors" on k2 Build: the features on p9 Roadmap as rows, every competitor as columns, cells none / partial / full / better. It is empty; say if you want me to fill it from what we know.'),
    ],
    // Every feature on every plane, not Roadmap's.
    wrong: [change([['create_piece', { kind: 'matrix', canvas: 'k2', name: 'Roadmap vs competitors', matrix: { template: 'compare', rows: { type: 'feature' }, cols: { type: 'competitor' } } }]]), answer('Made it.')],
  },
  {
    id: 'build-02-stickies-to-cards',
    group: 'build',
    set: 'capability',
    fixture: 'medium',
    ask: 'Turn the sticky notes on Bets into idea cards and group them.',
    graders: [
      exists('card', { type: 'idea', title: 'Who owns the stall data?', plane: 'Bets' }),
      exists('card', { type: 'idea', title: 'Maybe start with bread', plane: 'Bets' }),
      made('card', { type: 'package', plane: 'Bets', memberIds: (v: unknown) => Array.isArray(v) && v.length === 2 }),
      onlyChanged({ add: { ideas: 2, packages: 1 } }),
      noOverlaps('Bets'),
      undoRestores(),
      judge('The two sticky notes became idea cards with their words, grouped together; the stickies were left alone or the person was asked before removing them.'),
    ],
    reference: [
      call('query', { kind: 'text', type: 'sticky', plane: 'Bets' }),
      change(
        [
          ['create_card', { type: 'idea', plane: 'p3', title: 'Who owns the stall data?', handle: '$a' }],
          ['create_card', { type: 'idea', plane: 'p3', title: 'Maybe start with bread', handle: '$b' }],
          ['create_package', { cards: ['$a', '$b'], plane: 'p3', name: 'From the sticky notes', handle: '$p' }],
        ],
        'sticky notes on Bets → ideas',
      ),
      answer('Made two ideas on p3 Bets from its sticky notes ("Who owns the stall data?" and "Maybe start with bread") and packaged them as "From the sticky notes". I left x13 and x14 where they are; say if they should go.'),
    ],
    // The stickies deleted without asking, and no package.
    wrong: [
      change([
        ['create_card', { type: 'idea', plane: 'p3', title: 'Who owns the stall data?' }],
        ['create_card', { type: 'idea', plane: 'p3', title: 'Maybe start with bread' }],
        ['delete', { ids: ['x13', 'x14'] }, 'they are cards now'],
      ]),
      answer('Turned the stickies into ideas.'),
    ],
  },
  {
    id: 'build-03-deck-to-test-idea',
    group: 'build',
    set: 'regression',
    fixture: 'medium',
    ask: 'Make a deck of tasks to test our idea "Pre-order bread for pickup".',
    followUps: ['go'],
    graders: [
      noWritesInTurn(1),
      made('piece', { kind: 'deck' }),
      count('task', { deck: DECK, card: 'Pre-order bread for pickup' }, { min: 3 }),
      count('task', { deck: DECK }, { min: 3, max: 10 }),
      count('task', { deck: DECK, column: 'todo' }, { min: 3 }),
      onlyChanged({ add: { pieces: 1, tasks: { min: 3, max: 10 } } }),
      undoRestores(),
    ],
    reference: [
      call('get', { ids: ['c58'] }),
      answer('Plan for c58 "Pre-order bread for pickup": 1. a deck "Test: Pre-order bread for pickup" on k1 Discovery; 2. three tasks in todo, each for c58: ask 5 bakers if they would take pre-orders, run a one-week pilot at one stall, count pickups vs no-shows. Say go, or change the plan.'),
      change(
        [
          ['create_piece', { kind: 'deck', canvas: 'main', name: 'Test: Pre-order bread for pickup', handle: '$d' }],
          ['create_task', { deck: '$d', title: 'Ask 5 bakers if they would take pre-orders', card: 'c58' }],
          ['create_task', { deck: '$d', title: 'Run a one-week pre-order pilot at one stall', card: 'c58' }],
          ['create_task', { deck: '$d', title: 'Count pickups vs no-shows', card: 'c58' }],
        ],
        'a deck to test Pre-order bread for pickup',
      ),
      answer('Made the deck "Test: Pre-order bread for pickup" on k1 Discovery with three tasks for c58: ask 5 bakers, run a one-week pilot at one stall, count pickups vs no-shows.'),
    ],
    // The tasks tied to the idea next to it (c57).
    wrong: [
      change([
        ['create_piece', { kind: 'deck', canvas: 'main', name: 'Test: Pre-order bread for pickup', handle: '$d' }],
        ['create_task', { deck: '$d', title: 'Ask 5 bakers', card: 'c57' }],
        ['create_task', { deck: '$d', title: 'Run a pilot', card: 'c57' }],
        ['create_task', { deck: '$d', title: 'Count pickups', card: 'c57' }],
      ]),
      answer('Made the deck.'),
    ],
  },
  {
    id: 'build-04-organise-bets',
    group: 'build',
    set: 'capability',
    fixture: 'medium',
    ask: 'Organise the ideas on Bets by status.',
    graders: [
      grouped(IDEAS_ON_BETS.map(R), 'status'),
      noOverlaps('Bets'),
      count('card', { plane: 'Bets' }, 28),
      count('text', { kind: 'heading', plane: 'Bets' }, { min: 4, max: 5 }, { delta: true }),
      onlyChanged({ allow: IDEAS_ON_BETS.map(R), add: { labels: { min: 0, max: 4 } } }),
      undoRestores(),
    ],
    reference: [
      call('view', { piece: 'p3' }),
      change([['arrange', { items: IDEAS_ON_BETS, layout: 'cluster', group_by: 'status', headings: true }]], 'ideas on Bets by status'),
      answer('Grouped the 22 ideas on p3 Bets by status, each group under its own heading; the problems section and the sticky notes stayed where they were.'),
    ],
    // Clustered by type: every idea in one block, statuses mixed.
    wrong: [change([['arrange', { items: IDEAS_ON_BETS, layout: 'cluster', group_by: 'type', headings: true }]]), answer('Organised the ideas by status.')],
  },
  {
    id: 'build-05-feature-table',
    group: 'build',
    set: 'capability',
    fixture: 'medium',
    ask: 'Make a table of every feature with its status and priority.',
    graders: [made('piece', { kind: 'table' }), field(TABLE, 'table.rows.rules', rulesHold('feature'), ['piece']), field(TABLE, 'table.cols', (v: unknown) => JSON.stringify(v).includes('"status"') && JSON.stringify(v).includes('"priority"'), ['piece']), onlyChanged({ add: { pieces: 1 } }), undoRestores()],
    reference: [
      change([['create_piece', { kind: 'table', canvas: 'k2', name: 'All features', table: { template: 'features' } }]], 'a table of every feature'),
      answer('Made the table "All features" on k2 Build: every feature card, with its status, priority, impact and effort.'),
    ],
    // A table of the competitors.
    wrong: [change([['create_piece', { kind: 'table', canvas: 'k2', name: 'All features', table: { template: 'competitors' } }]]), answer('Made the feature table.')],
  },
  {
    id: 'build-06-heading-and-ideas',
    group: 'build',
    set: 'regression',
    fixture: 'medium',
    ask: "On Bets, add a heading 'Next experiments' with three new ideas under it: Saturday bread club, Stall loyalty card, Rainy day delivery.",
    graders: [
      exists('text', { kind: 'heading', plane: 'Bets', text: 'Next experiments' }),
      exists('card', { type: 'idea', plane: 'Bets', title: 'Saturday bread club' }),
      exists('card', { type: 'idea', plane: 'Bets', title: 'Stall loyalty card' }),
      exists('card', { type: 'idea', plane: 'Bets', title: 'Rainy day delivery' }),
      under('Next experiments', ['Saturday bread club', 'Stall loyalty card', 'Rainy day delivery'], { plane: 'Bets' }),
      onlyChanged({ add: { ideas: 3, labels: 1 } }),
      noOverlaps('Bets'),
      undoRestores(),
    ],
    reference: [
      call('view', { piece: 'p3' }),
      change(
        [
          ['create_text', { kind: 'heading', plane: 'p3', text: 'Next experiments', size: 'subheading', handle: '$h' }],
          ['create_card', { type: 'idea', plane: 'p3', title: 'Saturday bread club', handle: '$a' }],
          ['create_card', { type: 'idea', plane: 'p3', title: 'Stall loyalty card', handle: '$b' }],
          ['create_card', { type: 'idea', plane: 'p3', title: 'Rainy day delivery', handle: '$c' }],
          ['arrange', { items: ['$h', '$a', '$b', '$c'], layout: 'column', where: { at: 'clear' } }],
        ],
        'Next experiments on Bets',
      ),
      answer('Added the heading "Next experiments" on p3 Bets with three ideas under it: Saturday bread club, Stall loyalty card and Rainy day delivery.'),
    ],
    // All made, but left where each op put them: not under the heading.
    wrong: [
      change([
        ['create_text', { kind: 'heading', plane: 'p3', text: 'Next experiments', size: 'subheading' }],
        ['create_card', { type: 'idea', plane: 'p3', title: 'Saturday bread club' }],
        ['create_card', { type: 'idea', plane: 'p3', title: 'Stall loyalty card' }],
        ['create_card', { type: 'idea', plane: 'p3', title: 'Rainy day delivery' }],
      ]),
      answer('Added the heading and three ideas under it.'),
    ],
  },
  {
    id: 'build-07-pilot-canvas',
    group: 'build',
    set: 'capability',
    fixture: 'medium',
    ask: "Start a canvas 'Pilot' with a plane 'Pilot week 3' that shows Bakers near the tram and Pre-order bread for pickup.",
    graders: [
      exists('canvas', { name: 'Pilot' }),
      exists('piece', { kind: 'plane', name: 'Pilot week 3', canvas: 'Pilot' }),
      onPlane('Bakers near the tram', 'Pilot week 3'),
      onPlane('Pre-order bread for pickup', 'Pilot week 3'),
      onPlane('Bakers near the tram', 'Segments'),
      onPlane('Pre-order bread for pickup', 'Bets'),
      onlyChanged({ allow: [R('c11'), R('c58')], add: { canvases: 1, pieces: 1, places: 2 } }),
      undoRestores(),
    ],
    reference: [
      call('get', { ids: ['c11', 'c58'] }),
      change(
        [
          ['create_canvas', { name: 'Pilot', handle: '$k' }],
          ['create_piece', { kind: 'plane', canvas: '$k', name: 'Pilot week 3', handle: '$p' }],
          ['place_on', { cards: ['c11', 'c58'], plane: '$p' }],
        ],
        'Pilot canvas',
      ),
      answer('Made the canvas "Pilot" with the plane "Pilot week 3"; c11 Bakers near the tram and c58 Pre-order bread for pickup are shown there too (still on Segments and Bets).'),
    ],
    // The cards moved there (taken off their planes) instead of shown there too.
    wrong: [
      change([
        ['create_canvas', { name: 'Pilot', handle: '$k' }],
        ['create_piece', { kind: 'plane', canvas: '$k', name: 'Pilot week 3', handle: '$p' }],
        ['place_on', { cards: ['c11', 'c58'], plane: '$p', move: true }],
      ]),
      answer('Done.'),
    ],
  },
  {
    id: 'build-08-three-competitors',
    group: 'build',
    set: 'regression',
    fixture: 'medium',
    ask: "Add three Berlin competitors to Rivals (Kiezkorb, Marktschwärmer, Frischepost), each competing on 'Stall owners can't take card payments'.",
    graders: [
      count('card', { type: 'competitor', plane: 'Rivals', regions: { has: 'Germany' } }, 3, { delta: true }),
      linked('Kiezkorb', "Stall owners can't take card payments", 'competes-with'),
      linked('Marktschwärmer', "Stall owners can't take card payments", 'competes-with'),
      linked('Frischepost', "Stall owners can't take card payments", 'competes-with'),
      onlyChanged({ add: { competitors: 3, edges: 3 } }),
      noOverlaps('Rivals'),
      undoRestores(),
    ],
    reference: [
      call('get', { ids: ['c31'] }),
      change(
        [
          ...['Kiezkorb', 'Marktschwärmer', 'Frischepost'].map((title) => ['create_card', { type: 'competitor', plane: 'p2', title, fields: { regions: ['Germany'] }, links: [{ to: 'c31', kind: 'competes-with' }] }] as [string, Record<string, unknown>]),
        ],
        'three Berlin competitors',
      ),
      answer('Added Kiezkorb, Marktschwärmer and Frischepost to p2 Rivals (region Germany), each competing on c31 "Stall owners can\'t take card payments".'),
    ],
    // Linked as `relates`, not competing.
    wrong: [
      change([
        ...['Kiezkorb', 'Marktschwärmer', 'Frischepost'].map((title) => ['create_card', { type: 'competitor', plane: 'p2', title, fields: { regions: ['Germany'] }, links: [{ to: 'c31', kind: 'relates' }] }] as [string, Record<string, unknown>]),
      ]),
      answer('Added the three.'),
    ],
  },
]
