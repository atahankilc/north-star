// Every lesson of the onboarding (D-315), as data: written from docs/specs/onboarding-lessons.md, drawn by one renderer
// per format (onboarding.md §4), linted by `npm run check:lessons` (scripts/check-lessons.mjs, onboarding.md §8.2).
// Plain data: no React, no Firebase, only `import type` (erased), so a Node script (type stripping) and vitest load it.
//
// How the words are written:
// - `…` in backticks is a key or an on-screen word as the app writes it (`⌘F`, `esc`, `0`, `done`): drawn as a chip.
// - `{owner}` (the workspace's maker), `{peer}` (a person here), `{piece}` (the piece the event is about): filled in
//   when shown.
// - A title ≤ 6 words, a body ≤ 25 (its `extra` line counted in), ≤ 4 pages for anyone. Never "board" or "kanban" on
//   screen: "plane", "deck" (D-180, D-301). Payload values in `when` are the code's names (`kind: 'kanban'`), never shown.
//
// A changed feature bumps its lesson's `v` (and a line in releases.ts): it then shows once more, as `NEW`.
import type { Role } from '../data/model'
import type { Audience } from './seenMerge'

export type { Audience, Role }

// Every event a lesson listens for (onboarding.md §5.5). events.ts emits them all.
export const EVENTS = [
  // Workspace open + the curtain revealed; the workspaces page.
  'canvas-open', 'workspaces-open', 'ws-made', 'join-requested',
  // useCanvasView.
  'focus-in', 'focus-out', 'edit-on', 'edit-off', 'card-selected', 'cards-multi', 'link-selected', 'linking',
  'drawing-section', 'packing', 'bringing', 'to-canvas', 'confirming', 'beside-open', 'console-shown', 'piece-moved',
  'card-moved', 'cell-picked', 'axis-unfold', 'parts-folded',
  // Writes (tracked() / the store): what this tab made or changed.
  'piece-made', 'card-made', 'text-made', 'link-made', 'task-made', 'package-made', 'stuck', 'unstuck', 'unframed',
  'framed', 'brought', 'canvas-made', 'moved-canvas', 'evidence-added', 'status-set', 'doc-uploaded', 'undo', 'deleted',
  'task-for-card', 'task-moved',
  // Other stores.
  'wizard', 'setup-open', 'finder-open', 'threads-open', 'thread-open', 'side-view', 'following', 'filter-open',
  'filter-set', 'doc-reader', 'settings-open', 'task-given', 'peer-joined', 'edit-refused',
  // The URL.
  'canvas-switch',
  // One-line hooks.
  'plus-open', 'context-menu', 'menu-open', 'crumb-open', 'sidenav-rest', 'guide-open',
  // The queue: ≥ 3 min in the workspace and 10 s without input (onboarding.md §4.5), for nudges.
  'idle',
] as const
export type LessonEvent = (typeof EVENTS)[number]

// The payload each event carries (what `when` may match). `kind` is always "what kind of thing": a piece kind, a card
// type, a text kind, a link kind, a filter.
export const PAYLOADS: Record<LessonEvent, readonly string[]> = {
  'canvas-open': ['first', 'empty'],
  'workspaces-open': ['empty'],
  'ws-made': [],
  'join-requested': [],
  'focus-in': ['kind', 'empty', 'holds'],
  'focus-out': ['kind'],
  'edit-on': ['kind'],
  'edit-off': ['kind'],
  'card-selected': ['kind'],
  'cards-multi': ['count'],
  'link-selected': ['kind'],
  linking: [],
  'drawing-section': [],
  packing: [],
  bringing: [],
  'to-canvas': ['share'],
  confirming: ['kind', 'shared'],
  'beside-open': ['kind'],
  'console-shown': ['kind'],
  'piece-moved': ['kind', 'editing'],
  'card-moved': ['focus'],
  'cell-picked': ['kind', 'framed'],
  'axis-unfold': [],
  'parts-folded': [],
  'piece-made': ['kind', 'holds'],
  'card-made': ['kind'],
  'text-made': ['kind'],
  'link-made': ['kind'],
  'task-made': [],
  'package-made': [],
  stuck: ['kind'],
  unstuck: ['kind'],
  unframed: ['kind', 'holds'],
  framed: ['kind'],
  brought: [],
  'canvas-made': [],
  'moved-canvas': ['share'],
  'evidence-added': [],
  'status-set': [],
  'doc-uploaded': [],
  undo: [],
  deleted: ['confirmed', 'shared'],
  'task-for-card': [],
  // A task's column changed; `done`: it landed in the deck's finished column.
  'task-moved': ['done'],
  wizard: ['kind'],
  'setup-open': ['kind'],
  'finder-open': ['headings'],
  'threads-open': [],
  'thread-open': ['kind'],
  'side-view': [],
  following: [],
  'filter-open': ['kind'],
  'filter-set': ['kind'],
  'doc-reader': [],
  'settings-open': ['page'],
  'task-given': ['byOther'],
  'peer-joined': [],
  'edit-refused': [],
  'canvas-switch': [],
  'plus-open': ['plane'],
  'context-menu': ['kind'],
  'menu-open': [],
  'crumb-open': [],
  'sidenav-rest': [],
  'guide-open': [],
  idle: ['pieces', 'cards', 'seen', 'decks', 'peerFor'],
}

// What a lesson sits beside: `data-learn="<anchor>"` in the app (O6). None: the middle of the screen.
export const ANCHORS = [
  'sidenav', 'plus', 'plus-menu', 'pending-row', 'workspaces-empty', 'piece', 'console', 'console-unframe', 'dock', 'dock-view', 'toast',
  'bond', 'split', 'prompt', 'card', 'card-panel', 'panel-status', 'panel-for', 'link-bar', 'package-band',
  'filter-strip', 'menu', 'text-bar', 'sticky', 'crosshair', 'heading', 'wizard', 'cell-bar', 'axis', 'setup',
  'side-view', 'tasks', 'people', 'follow-label', 'thread', 'threads', 'finder', 'crumb', 'settings-menu',
  'settings-people',
] as const
export type Anchor = (typeof ANCHORS)[number]

// The surfaces the queue counts as busy (onboarding.md §5.4) that a lesson may show on top of: it is about that surface,
// so that one busy source (and typing inside it) doesn't hold it back.
export const WITHIN = ['wizard', 'finder', 'menu', 'setup', 'settings', 'threads', 'following', 'typing'] as const
export type Within = (typeof WITHIN)[number]

export const ROLES = ['owner', 'editor', 'viewer'] as const satisfies readonly Role[]
export const AREAS = ['start', 'canvas', 'planes', 'links', 'text', 'lenses', 'documents', 'decks', 'together', 'canvases', 'settings'] as const
export type Area = (typeof AREAS)[number]
export const FORMATS = ['welcome', 'guide', 'lesson', 'nudge', 'empty'] as const
export type Format = (typeof FORMATS)[number]
// The names a lesson's words may fill in.
export const PLACEHOLDERS = ['owner', 'peer', 'piece'] as const
// What a page may wait for: the side nav's tasks button (shown while the canvas has a deck or a timeline, MyTasks.tsx).
export const PAGE_IFS = ['has-tasks-button'] as const

// An event's payload must match: a value, one of a list, or at least a number (counts the queue gives `idle`).
export type Match = Record<string, string | boolean | readonly string[] | { min: number }>
export type Trigger = { event: LessonEvent; when?: Match }

export type Page = {
  title: string
  body: string
  // The demo (`src/demo/scenes/<scene>.tsx`). None: words only.
  scene?: string
  // Only for these roles (default: the lesson's).
  roles?: readonly Role[]
  // Only for this audience (the welcome's page 1).
  audience?: Audience
  // Only while this is true when shown.
  if?: (typeof PAGE_IFS)[number]
  // Only when the trigger's `kind` is one of these (a stuck table opens beside, a stuck deck in the side view).
  kinds?: readonly string[]
  // A line added after the body for these roles (the viewer's on the welcome's last page).
  extra?: { roles: readonly Role[]; line: string }
}

// A row of the kind guide (onboarding.md §4.2): `key` is the `+` menu's row key, `label` its words.
export type GuideRow = {
  key: string
  label: string
  v: number
  // What it is, when to use it.
  lines: readonly [string, string]
  scene: string
  // Which `+` menu shows it: the canvas's, a focused plane's, or both.
  where: 'canvas' | 'plane' | 'both'
}

// An empty state's framed choice (the workspaces page).
export type Choice = { label: string; line: string }

type Base = {
  id: string
  v: number
  roles: readonly Role[]
  area: Area
  // The decision(s) that made the feature as it is now (`### D-xxx` in decisions-log.md).
  since: string
  // Any of these shows it (the first time).
  trigger: readonly Trigger[]
  // Any of these retires it unshown (onboarding.md §5.4).
  doneWhen?: readonly Trigger[]
  anchor?: Anchor
  // While one of these is queued or showing, this one waits until it closes or is retired, then shows after the
  // calm/cooldown (onboarding.md §5.4). The general lesson goes first when one event triggers both.
  after?: readonly string[]
  // Already taught by these: seen, this one is retired.
  unless?: readonly string[]
  // The busy surface it may show on (it's about it).
  within?: Within
}
export type PagedLesson = Base & { format: 'welcome' | 'lesson'; pages: readonly Page[] }
export type GuideLesson = Base & { format: 'guide'; rows: readonly GuideRow[] }
export type LineLesson = Base & { format: 'nudge' | 'empty'; line?: string; choices?: readonly Choice[] }
export type Lesson = PagedLesson | GuideLesson | LineLesson

const ALL: readonly Role[] = ['owner', 'editor', 'viewer']
const EDITORS: readonly Role[] = ['owner', 'editor']
const OWNERS: readonly Role[] = ['owner']
const VIEWERS: readonly Role[] = ['viewer']
// The pieces that open in a window or lie unframed (D-206, D-228); a document unframes too (D-234).
const LENSES = ['matrix', 'table', 'kanban', 'timeline', 'documents']
const STICKING = ['matrix', 'table', 'kanban', 'timeline']

export const LESSONS: readonly Lesson[] = [
  // 1. Start
  {
    id: 'welcome', v: 1, format: 'welcome', roles: ALL, area: 'start', since: 'D-174',
    trigger: [{ event: 'canvas-open', when: { first: true } }],
    pages: [
      { audience: 'new', title: 'This is your canvas', body: 'Everything for your startup lives on this canvas. Drag to move around, scroll to zoom, `0` shows everything.', scene: 'canvas-fit' },
      { audience: 'invited', title: '{owner} started this workspace', body: 'Everything for this startup lives on this canvas. Drag to move, scroll to zoom, press `0` to see it all.', scene: 'canvas-fit' },
      { title: 'Pieces hold the work', body: 'Planes hold cards: customers, problems, competitors, ideas, features, linked into one chain. Tables, matrices, decks and timelines read them.', scene: 'pieces-tour' },
      { roles: EDITORS, title: 'Add anything with +', body: 'The magenta `+` adds a piece. The first time you meet something, a short note explains it.', scene: 'plus-adds-plane' },
      { roles: VIEWERS, title: 'Find your way', body: '`⌘F` finds anything. Double-click a piece to go inside it; `esc` comes back out.', scene: 'finder-go' },
      {
        title: 'Together, live', body: "Who's here shows bottom left. Right-click anything to comment. `?` shows any note again.", scene: 'peers-comment',
        extra: { roles: VIEWERS, line: 'As a viewer you read, comment and keep your own documents.' },
      },
    ],
  },
  {
    id: 'side-nav', v: 1, format: 'lesson', roles: ALL, area: 'canvas', since: 'D-178, D-202, D-196, D-314',
    trigger: [{ event: 'sidenav-rest' }], anchor: 'sidenav', after: ['welcome'],
    pages: [
      { roles: EDITORS, title: 'Add', body: '`+` adds a piece: a plane, a table, a deck…', scene: 'sidenav-plus' },
      { title: 'Fit', body: 'Shows everything on the canvas at once. Key: `0`.', scene: 'sidenav-fit' },
      { title: 'Find', body: 'Find any card, heading or task, and go there. Key: `⌘F`.', scene: 'sidenav-find' },
      { if: 'has-tasks-button', title: 'Decks and days', body: 'Opens tasks beside you, from anywhere. Key: `t`.', scene: 'sidenav-side' },
    ],
  },
  {
    id: 'empty-canvas', v: 1, format: 'empty', roles: EDITORS, area: 'start', since: 'D-176',
    trigger: [{ event: 'canvas-open', when: { empty: true } }], doneWhen: [{ event: 'piece-made' }], anchor: 'plus', after: ['welcome'],
    line: 'press + to add your first piece',
  },
  {
    id: 'workspaces-empty', v: 1, format: 'empty', roles: ALL, area: 'start', since: 'D-062',
    trigger: [{ event: 'workspaces-open', when: { empty: true } }], doneWhen: [{ event: 'ws-made' }, { event: 'join-requested' }], anchor: 'workspaces-empty',
    choices: [
      { label: 'create a workspace', line: "a name, then you're in" },
      { label: 'join with a code', line: 'an owner lets you in' },
      { label: 'import a .zip', line: 'a workspace someone exported' },
    ],
  },
  {
    id: 'join-pending', v: 1, format: 'lesson', roles: ALL, area: 'start', since: 'D-062',
    trigger: [{ event: 'join-requested' }], anchor: 'pending-row',
    pages: [{ title: 'Waiting for an owner', body: 'Your code asked to join. An owner lets you in from Settings; this page updates by itself.' }],
  },

  // 2. The `+` and the pieces
  {
    id: 'kind-guide', v: 1, format: 'guide', roles: EDITORS, area: 'canvas', since: 'D-176, D-301',
    trigger: [{ event: 'plus-open' }], anchor: 'plus-menu', within: 'menu',
    rows: [
      { key: 'plane', label: 'plane', v: 1, where: 'canvas', scene: 'kind-plane', lines: ['A space for cards.', 'Customers, problems, competitors, ideas and features live here, linked.'] },
      { key: 'matrix', label: 'matrix…', v: 1, where: 'canvas', scene: 'kind-matrix', lines: ['Score one list against another: competitors × features, ideas × criteria.', 'Cells hold scales, numbers or text.'] },
      { key: 'table', label: 'table…', v: 1, where: 'canvas', scene: 'kind-table', lines: ['Cards as rows, chosen by rules (type, status, tag, plane).', 'Add your own columns to compare them.'] },
      { key: 'documents', label: 'documents', v: 1, where: 'canvas', scene: 'kind-documents', lines: ['Your files: notes, research, reports.', 'Private until you share them.'] },
      { key: 'kanban', label: 'deck…', v: 1, where: 'canvas', scene: 'kind-deck', lines: ['Columns of tasks, or cards sorted by a field.', 'Drag between columns; give tasks to people and days.'] },
      { key: 'timeline', label: 'timeline', v: 1, where: 'canvas', scene: 'kind-timeline', lines: ['Tasks on a strip of days.', 'Drag to move them; draw to plan a new one.'] },
      { key: 'heading', label: 'heading', v: 1, where: 'both', scene: 'kind-heading', lines: ['A big title on the canvas.', 'Headings are places: the finder takes you to them.'] },
      { key: 'paragraph', label: 'paragraph', v: 1, where: 'both', scene: 'kind-paragraph', lines: ['A block of text, light Markdown.', 'For notes that belong next to the work.'] },
      { key: 'sticky', label: 'sticky note', v: 1, where: 'both', scene: 'kind-sticky', lines: ['A quick paper note in a colour.', 'It shows who wrote it and when.'] },
      { key: 'section', label: 'section', v: 1, where: 'both', scene: 'kind-section', lines: ['Draw a frame round things.', "It carries what's inside when moved."] },
      { key: 'title', label: 'project title', v: 1, where: 'canvas', scene: 'kind-title', lines: ["Your workspace's name and what you're building, big.", 'Once per workspace.'] },
      { key: 'customer', label: 'customer', v: 1, where: 'plane', scene: 'card-customer', lines: ['Who has the problem.', "Other cards say who they're `for`."] },
      { key: 'problem', label: 'problem', v: 1, where: 'plane', scene: 'card-problem', lines: ['What hurts.', 'Give it a status and evidence for or against it.'] },
      { key: 'competitor', label: 'competitor', v: 1, where: 'plane', scene: 'card-competitor', lines: ['Who else solves it.', 'Their features sit inside the card.'] },
      { key: 'idea', label: 'idea', v: 1, where: 'plane', scene: 'card-idea', lines: ['How you might solve it.', 'Test it; log what you learn.'] },
      { key: 'feature', label: 'feature', v: 1, where: 'plane', scene: 'card-feature', lines: ["What you'd build.", 'Parts, must-haves, and what it rests on.'] },
      { key: 'package', label: 'package', v: 1, where: 'plane', scene: 'kind-package', lines: ['Group cards into one bundle.', 'It has a name and a rating.'] },
      { key: 'existing', label: 'existing card…', v: 1, where: 'plane', scene: 'kind-existing', lines: ['Bring a card from another plane.', "It's the same card, in two places."] },
    ],
  },
  {
    id: 'piece-made', v: 1, format: 'lesson', roles: EDITORS, area: 'canvas', since: 'D-180, D-182',
    trigger: [{ event: 'piece-made' }], doneWhen: [{ event: 'edit-off' }], anchor: 'piece',
    pages: [
      { title: "It's in edit mode", body: 'Drag it to move, pull an edge to resize, type its name in the top edge.', scene: 'edit-move-resize' },
      { title: "Done when you're done", body: 'Press `done` on its console. Pieces only move in edit mode, so nothing shifts by accident.', scene: 'edit-done' },
    ],
  },
  {
    id: 'piece-console', v: 1, format: 'lesson', roles: ALL, area: 'canvas', since: 'D-264',
    trigger: [{ event: 'console-shown' }], doneWhen: [{ event: 'focus-in' }], anchor: 'console',
    pages: [
      { title: 'Every piece has a console', body: 'Point at a piece and its console appears: go inside, edit, link it, see its comments.', scene: 'console-appear' },
      { title: 'Go inside with focus', body: 'Press `focus` or double-click. Inside, the piece is yours to work in; `esc` comes back.', scene: 'focus-ink' },
    ],
  },
  {
    id: 'focus-plane', v: 1, format: 'lesson', roles: ALL, area: 'planes', since: 'D-184, D-185',
    trigger: [{ event: 'focus-in', when: { kind: 'plane' } }], anchor: 'dock',
    pages: [
      { roles: EDITORS, title: "You're inside the plane", body: 'Drag to look around. `+` (or right-click) adds cards here. `esc` or `unfocus` goes back.', scene: 'plane-inside' },
      { roles: VIEWERS, title: "You're inside the plane", body: 'Drag to look around; click a card to read it. `esc` or `unfocus` goes back.', scene: 'plane-inside' },
      { roles: EDITORS, title: 'Make your first card', body: '`+` → customer, problem, competitor, idea or feature. Type its name, Enter keeps it.', scene: 'card-make-name' },
    ],
  },
  {
    id: 'empty-plane', v: 1, format: 'empty', roles: EDITORS, area: 'planes', since: 'D-187',
    trigger: [{ event: 'focus-in', when: { kind: 'plane', empty: true } }], doneWhen: [{ event: 'card-made' }], after: ['focus-plane'],
    line: 'press + or right-click to add a card',
  },
  {
    id: 'focus-lens', v: 1, format: 'lesson', roles: ALL, area: 'canvas', since: 'D-206',
    trigger: [{ event: 'focus-in', when: { kind: LENSES } }], anchor: 'dock',
    pages: [{ title: 'Working in a window', body: 'This piece opened in the middle. Its tools are in the dock below; `esc` goes back.', scene: 'lens-focus' }],
  },
  {
    id: 'hazard-undo', v: 1, format: 'lesson', roles: EDITORS, area: 'canvas', since: 'D-182',
    trigger: [{ event: 'deleted', when: { confirmed: true } }], anchor: 'toast',
    pages: [{ title: '⌘Z brings it back', body: 'Every change can be undone with `⌘Z`, and done again with `⇧⌘Z`.' }],
  },
  {
    id: 'unframe', v: 1, format: 'lesson', roles: EDITORS, area: 'canvas', since: 'D-228, D-289',
    trigger: [{ event: 'edit-on', when: { kind: [...LENSES, 'document'] } }], doneWhen: [{ event: 'unframed' }], anchor: 'console-unframe', after: ['piece-made'],
    pages: [{ title: 'Framed or unframed', body: "Framed, it's a window. Unframed, it lies on the canvas at its own size and you work on it right there.", scene: 'unframe' }],
  },
  {
    id: 'unframed', v: 1, format: 'lesson', roles: EDITORS, area: 'canvas', since: 'D-228',
    trigger: [{ event: 'unframed' }], anchor: 'piece',
    pages: [{ title: 'Live on the canvas', body: 'No focus needed: click and type in it here. `frame` in edit mode puts it back in a window.', scene: 'unframed-live' }],
  },
  {
    id: 'stick-hint', v: 1, format: 'lesson', roles: EDITORS, area: 'canvas', since: 'D-210',
    trigger: [{ event: 'piece-moved', when: { kind: STICKING, editing: true } }], doneWhen: [{ event: 'stuck' }], anchor: 'piece',
    pages: [{ title: 'Stick it to a plane', body: "Drop it near a plane's edge and it links: it then reads only that plane's cards. Hold `alt` to stay free.", scene: 'stick' }],
  },
  {
    id: 'stuck', v: 1, format: 'lesson', roles: EDITORS, area: 'canvas', since: 'D-210, D-211, D-300, D-303',
    trigger: [{ event: 'stuck' }], anchor: 'bond',
    pages: [
      { title: 'Linked to the plane', body: 'It now follows that plane: rules read its cards, and it moves with it.', scene: 'stick-follow' },
      { kinds: ['table', 'matrix'], title: 'Open it beside', body: "In the plane's focus, `⇆ {piece}` opens it next to the plane. Pick a row, the plane shows the card.", scene: 'beside-pick' },
      { kinds: ['kanban'], title: 'Open it in the side view', body: "In the plane's focus, `⇆ deck` opens it in the side view, with only this plane's tasks.", scene: 'side-view' },
    ],
  },
  {
    id: 'beside', v: 1, format: 'lesson', roles: ALL, area: 'canvas', since: 'D-211',
    trigger: [{ event: 'beside-open' }], anchor: 'split',
    pages: [{ title: 'Side by side', body: 'Drag the line to share the screen. Each side has its own dock; `esc` closes the side.', scene: 'beside' }],
  },
  {
    id: 'move-canvas', v: 1, format: 'lesson', roles: EDITORS, area: 'canvases', since: 'D-306, D-307, D-313',
    trigger: [{ event: 'to-canvas' }], anchor: 'prompt', within: 'menu',
    pages: [
      { title: 'Move or share a piece', body: '`move to canvas…` takes it to another canvas. `also on canvas…` puts the same piece there too; `⧉ 2` says where.', scene: 'canvases-share' },
      { title: 'Deleting a shared piece', body: 'Delete then asks: `only from here` keeps it on the other canvases, `delete everywhere` removes it from all.' },
    ],
  },

  // 3. Planes and cards
  {
    id: 'card-made', v: 1, format: 'lesson', roles: EDITORS, area: 'planes', since: 'D-250',
    trigger: [{ event: 'card-made' }], anchor: 'card-panel', within: 'typing',
    pages: [
      { title: 'Name it here', body: 'Enter keeps it. Tab makes the next one of its type. `esc` takes it away again.', scene: 'card-make-name' },
      { title: 'Its panel', body: 'What it is, what backs it, its links, tags and notes, all edited here.', scene: 'card-panel' },
      { title: 'Link it', body: "Point at a card, drag its `›` onto another. The link's kind says what it means.", scene: 'link-draw' },
    ],
  },
  {
    id: 'card-panel', v: 1, format: 'lesson', roles: ALL, area: 'planes', since: 'D-221',
    trigger: [{ event: 'card-selected' }], anchor: 'card-panel', unless: ['card-made'],
    pages: [{ title: 'Everything about a card', body: 'What it is, what backs it, its links by meaning, tags and notes. `esc` closes it.', scene: 'card-panel' }],
  },
  {
    id: 'status-evidence', v: 1, format: 'lesson', roles: EDITORS, area: 'planes', since: 'D-137',
    trigger: [{ event: 'status-set' }, { event: 'evidence-added' }], anchor: 'panel-status',
    pages: [{ title: 'Is it true?', body: 'Hypothesis, testing, validated, invalidated. Evidence shows on the card as cells: filled for it, hollow against.', scene: 'evidence' }],
  },
  {
    id: 'link-made', v: 1, format: 'lesson', roles: EDITORS, area: 'links', since: 'D-207',
    trigger: [{ event: 'link-made' }], anchor: 'link-bar', within: 'typing',
    pages: [{ title: 'What does it mean?', body: 'Pick its kind: solves, for, competes, depends on… Give it a label, or turn it round.', scene: 'link-bar' }],
  },
  {
    id: 'for-links', v: 1, format: 'lesson', roles: ALL, area: 'links', since: 'D-044, D-128',
    trigger: [{ event: 'link-made', when: { kind: 'for' } }, { event: 'filter-set', when: { kind: 'for' } }], anchor: 'link-bar', within: 'typing', after: ['link-made'],
    pages: [{ title: "Who it's for", body: "A `for` link tags a card with a customer. The filter's FOR shows one customer's cards.", scene: 'for-filter' }],
  },
  {
    id: 'multi-select', v: 1, format: 'lesson', roles: EDITORS, area: 'planes', since: 'D-227',
    trigger: [{ event: 'cards-multi' }], anchor: 'card-panel',
    pages: [{ title: 'Several at once', body: 'Shift-click or alt-drag a box. Move them together, copy, line up, tag or package them.', scene: 'multi-select' }],
  },
  {
    id: 'package-made', v: 1, format: 'lesson', roles: EDITORS, area: 'planes', since: 'D-239',
    trigger: [{ event: 'package-made' }], anchor: 'package-band',
    pages: [{ title: 'A package', body: 'It bundles cards under one name. Drag its band to move them all; `−` folds it into one card.', scene: 'package' }],
  },
  {
    id: 'brought', v: 1, format: 'lesson', roles: EDITORS, area: 'planes', since: 'D-281',
    trigger: [{ event: 'brought' }], anchor: 'card',
    pages: [
      { title: 'The same card, twice', body: "Edit it here or there: it's one card. `⧉ 2` says where else it is.", scene: 'shared-card' },
      { title: 'Deleting a shared card', body: 'Delete takes it off this plane only; it stays on the others. `delete everywhere` removes it from every plane.' },
    ],
  },
  {
    id: 'competitor-features', v: 1, format: 'lesson', roles: ALL, area: 'planes', since: 'D-225',
    trigger: [{ event: 'card-selected', when: { kind: 'competitor' } }], anchor: 'card', after: ['card-panel'],
    pages: [
      { roles: EDITORS, title: 'Their features inside', body: 'Point at a competitor to see its features; open it to add them and match them to ours.', scene: 'competitor-features' },
      { roles: VIEWERS, title: 'Their features inside', body: 'Point at a competitor to see its features; select it to keep them open.', scene: 'competitor-features' },
    ],
  },
  {
    id: 'parts', v: 1, format: 'lesson', roles: EDITORS, area: 'planes', since: 'D-226',
    trigger: [{ event: 'link-made', when: { kind: 'part-of' } }, { event: 'parts-folded' }], anchor: 'card', after: ['link-made'],
    pages: [{ title: 'Parts fold inside', body: 'A feature can hold parts. `−` folds them into the card as a tree.', scene: 'parts' }],
  },
  {
    id: 'plane-filter', v: 1, format: 'lesson', roles: ALL, area: 'planes', since: 'D-233, D-308',
    trigger: [{ event: 'filter-open', when: { kind: 'plane' } }], anchor: 'filter-strip',
    pages: [{ title: 'Filters pass', body: 'Show only some types, one customer, a tag or a region. Leaving the plane clears it.', scene: 'plane-filter' }],
  },
  {
    id: 'guides-snap', v: 1, format: 'lesson', roles: EDITORS, area: 'planes', since: 'D-231',
    trigger: [{ event: 'card-moved', when: { focus: true } }], anchor: 'dock-view',
    pages: [{ title: 'Lines up by itself', body: 'Magenta guides show while dragging. `g` turns snapping off, `a` the guides; `alt` moves freely.', scene: 'guides' }],
  },
  {
    id: 'right-click', v: 1, format: 'lesson', roles: ALL, area: 'canvas', since: 'D-237, D-222',
    trigger: [{ event: 'context-menu' }], anchor: 'menu', within: 'menu',
    pages: [{ title: 'Right-click is a prompt', body: 'Type to narrow it, Enter picks the first, a letter jumps. Every menu works like this.', scene: 'prompt-type' }],
  },

  // 4. Text
  {
    id: 'text-made', v: 1, format: 'lesson', roles: EDITORS, area: 'text', since: 'D-188, D-190',
    trigger: [{ event: 'text-made', when: { kind: ['heading', 'paragraph'] } }], anchor: 'text-bar', within: 'typing',
    pages: [{ title: 'Writing on the canvas', body: 'Double-click to type; `Enter` ends a heading, `⌘Enter` a paragraph. The bar under it sets size, style and colour.', scene: 'text-edit' }],
  },
  {
    id: 'sticky-made', v: 1, format: 'lesson', roles: EDITORS, area: 'text', since: 'D-257',
    trigger: [{ event: 'text-made', when: { kind: 'sticky' } }], anchor: 'sticky', within: 'typing',
    pages: [{ title: 'A sticky note', body: 'Paper in a colour, with who wrote it and when. `▾` folds a long one back to its first lines.', scene: 'sticky' }],
  },
  {
    id: 'section-draw', v: 1, format: 'lesson', roles: EDITORS, area: 'text', since: 'D-130',
    trigger: [{ event: 'drawing-section' }], anchor: 'crosshair',
    pages: [{ title: 'Draw a section', body: "Drag a frame round things. Name it; it carries what's inside when it moves.", scene: 'section' }],
  },
  {
    id: 'headings-places', v: 1, format: 'lesson', roles: ALL, area: 'text', since: 'D-050, D-196',
    trigger: [{ event: 'text-made', when: { kind: 'heading' } }, { event: 'finder-open', when: { headings: true } }], anchor: 'heading', after: ['text-made', 'finder'], within: 'finder',
    pages: [{ title: 'Headings are places', body: 'The finder lists them; Enter glides you there.', scene: 'finder-heading' }],
  },

  // 5. Matrix and table
  {
    id: 'matrix-wizard', v: 1, format: 'lesson', roles: EDITORS, area: 'lenses', since: 'D-216',
    trigger: [{ event: 'wizard', when: { kind: 'matrix' } }], anchor: 'wizard', within: 'wizard',
    pages: [{ title: 'Four questions', body: 'What to start from, rows, columns, and what a cell holds. The preview shows it as you choose.', scene: 'matrix-wizard' }],
  },
  {
    id: 'matrix-keys', v: 1, format: 'lesson', roles: ALL, area: 'lenses', since: 'D-212',
    trigger: [{ event: 'focus-in', when: { kind: 'matrix' } }, { event: 'cell-picked', when: { kind: 'matrix', framed: false } }], anchor: 'dock', after: ['focus-lens'],
    pages: [
      { roles: EDITORS, title: 'Scoring cells', body: "Click a cell, click again to step it, or type `1`–`9`. Arrows move, `-` means doesn't apply.", scene: 'matrix-keys' },
      { roles: VIEWERS, title: 'Reading the scores', body: 'Each cell scores a row against a column. `~` is inferred, `?` a guess, `—` doesn\'t apply.', scene: 'matrix-keys' },
      { roles: EDITORS, title: 'How sure?', body: '`~` inferred, `?` a guess. A note explains the score.', scene: 'matrix-sure' },
    ],
  },
  {
    id: 'matrix-criteria', v: 1, format: 'lesson', roles: EDITORS, area: 'lenses', since: 'D-133, D-249',
    trigger: [{ event: 'axis-unfold' }], anchor: 'axis',
    pages: [{ title: 'Judged on', body: "A feature's criteria open as rows. Score them; the feature's cell reads from them.", scene: 'criteria' }],
  },
  {
    id: 'table-wizard', v: 1, format: 'lesson', roles: EDITORS, area: 'lenses', since: 'D-209',
    trigger: [{ event: 'wizard', when: { kind: 'table' } }], anchor: 'wizard', within: 'wizard',
    pages: [{ title: 'Rows by rules', body: 'A table picks its rows by rules: a plane, a type, a status. New cards join by themselves.', scene: 'table-rules' }],
  },
  {
    id: 'table-keys', v: 1, format: 'lesson', roles: ALL, area: 'lenses', since: 'D-218',
    trigger: [{ event: 'focus-in', when: { kind: 'table' } }], anchor: 'dock', after: ['focus-lens'],
    pages: [
      { roles: EDITORS, title: 'Working in a table', body: "Click a cell; `Enter` or a double-click types. Arrows move, a head sorts, a head's edge widens.", scene: 'table-keys' },
      { roles: VIEWERS, title: 'Reading a table', body: "Each row is a card, picked by the table's rules. Drag to look around; `esc` goes back.", scene: 'table-keys' },
      { roles: EDITORS, title: 'Your own columns', body: '`setup` adds columns of its own: a mark, a number, a few words, a check.', scene: 'table-setup' },
    ],
  },
  {
    id: 'setup-open', v: 1, format: 'lesson', roles: EDITORS, area: 'lenses', since: 'D-217',
    trigger: [{ event: 'setup-open' }], anchor: 'setup', within: 'setup',
    pages: [{ title: 'Change it any time', body: 'Setup has every choice the wizard asked, and more.' }],
  },

  // 6. Documents
  {
    id: 'documents', v: 1, format: 'lesson', roles: ALL, area: 'documents', since: 'D-232',
    trigger: [{ event: 'focus-in', when: { kind: 'documents' } }, { event: 'piece-made', when: { kind: 'documents' } }], anchor: 'piece', after: ['focus-lens', 'piece-made'],
    pages: [
      { title: 'Your files', body: "Upload `.md` notes or drop them here. They're private until you share them.", scene: 'documents' },
      { title: 'Read beside', body: 'In focus, a click opens a document next to the list, to read as a page.', scene: 'doc-beside' },
    ],
  },
  {
    id: 'doc-place', v: 1, format: 'lesson', roles: EDITORS, area: 'documents', since: 'D-234',
    trigger: [{ event: 'piece-made', when: { kind: 'document' } }], anchor: 'piece', after: ['piece-made'],
    pages: [{ title: 'On the canvas', body: 'A placed document is a window anyone here can read. Unframe it to read it on the canvas.', scene: 'doc-place' }],
  },

  // 7. Decks and days
  {
    id: 'deck-wizard', v: 1, format: 'lesson', roles: EDITORS, area: 'decks', since: 'D-251, D-268',
    trigger: [{ event: 'wizard', when: { kind: 'kanban' } }], anchor: 'wizard', within: 'wizard',
    pages: [{ title: 'Tasks or cards', body: 'A deck holds tasks, or your cards sorted by a field: status, impact, effort.', scene: 'deck-kinds' }],
  },
  {
    id: 'deck', v: 1, format: 'lesson', roles: ALL, area: 'decks', since: 'D-252',
    // A deck of tasks: a deck holding cards has its own lesson (card-deck).
    trigger: [{ event: 'focus-in', when: { kind: 'kanban', holds: 'tasks' } }, { event: 'unframed', when: { kind: 'kanban', holds: 'tasks' } }], doneWhen: [{ event: 'task-moved' }], anchor: 'dock', after: ['focus-lens', 'unframed'],
    pages: [
      { roles: EDITORS, title: 'Moving work along', body: 'Drag a task to another column: that is its step now.', scene: 'deck-drag' },
      { roles: EDITORS, title: 'Adding tasks', body: '`+ add a task` under a column types one; Enter adds it and keeps the field for the next.', scene: 'deck-add' },
      { roles: VIEWERS, title: 'Where the work is', body: "Each column is a step; each task sits in one. Click a task to read who has it, its day and card.", scene: 'deck-drag' },
      { roles: EDITORS, title: "A task's panel", body: 'Click a task: give it to someone, a due day, a card, a checklist.', scene: 'task-panel' },
    ],
  },
  {
    id: 'task-card', v: 1, format: 'lesson', roles: EDITORS, area: 'decks', since: 'D-254',
    trigger: [{ event: 'task-for-card' }], anchor: 'card-panel',
    pages: [{ title: 'Tasks test cards', body: 'A task for a card is listed on it. Finished, `+ log what it taught` puts what it found on the card, as evidence.', scene: 'task-learned' }],
  },
  {
    id: 'card-deck', v: 1, format: 'lesson', roles: EDITORS, area: 'decks', since: 'D-253, D-271',
    trigger: [{ event: 'piece-made', when: { kind: 'kanban', holds: 'cards' } }], anchor: 'piece', after: ['piece-made'],
    pages: [
      { title: 'Cards on a deck', body: "Columns are one field's values. Drop a card in a column and the field changes.", scene: 'card-deck' },
      { title: 'Suggested order', body: '`order` ranks by impact × confidence ÷ effort, as P1–P3. It never writes anything.', scene: 'priorities' },
    ],
  },
  {
    id: 'side-view', v: 1, format: 'lesson', roles: ALL, area: 'decks', since: 'D-300, D-314',
    trigger: [{ event: 'side-view' }], anchor: 'side-view',
    pages: [
      { title: 'Decks and days, beside you', body: '`t` opens your decks beside what you are on, from anywhere; a deck\'s `days ›` adds its days.', scene: 'side-view' },
      { title: 'Yours', body: '`MINE` lists the tasks given to you; `ALL · DAYS` puts every deck on days.', scene: 'side-mine' },
    ],
  },
  {
    id: 'timeline', v: 1, format: 'lesson', roles: ALL, area: 'decks', since: 'D-304, D-314',
    trigger: [{ event: 'focus-in', when: { kind: 'timeline' } }, { event: 'piece-made', when: { kind: 'timeline' } }], anchor: 'piece', after: ['focus-lens', 'piece-made'],
    pages: [
      { title: 'Days without end', body: 'Drag sideways through time; pinch or pick day, week, month, quarter.', scene: 'timeline-scroll' },
      { roles: EDITORS, title: 'Plan by drawing', body: 'Draw across days on a row, then pick its card: a task. Drag its ends to change its days.', scene: 'timeline-draw' },
    ],
  },
  {
    id: 'empty-timeline', v: 1, format: 'empty', roles: EDITORS, area: 'decks', since: 'D-304',
    trigger: [{ event: 'focus-in', when: { kind: 'timeline', empty: true } }], doneWhen: [{ event: 'task-made' }], anchor: 'piece', after: ['timeline'],
    line: 'no tasks yet: draw across days to plan one',
  },
  {
    id: 'deck-filter', v: 1, format: 'lesson', roles: ALL, area: 'decks', since: 'D-256, D-308',
    trigger: [{ event: 'filter-open', when: { kind: 'kanban' } }], anchor: 'filter-strip',
    pages: [{ title: 'Only some tasks', body: 'Given to, due, for a card, a label. It lasts while the deck is open.', scene: 'deck-filter' }],
  },
  {
    id: 'tasks-given', v: 1, format: 'lesson', roles: ALL, area: 'decks', since: 'D-261',
    trigger: [{ event: 'task-given', when: { byOther: true } }], anchor: 'tasks',
    pages: [{ title: 'Given to you', body: 'The count by the side nav is tasks given to you since you last looked.' }],
  },

  // 8. Together
  {
    id: 'people-here', v: 1, format: 'lesson', roles: ALL, area: 'together', since: 'D-169',
    trigger: [{ event: 'peer-joined' }], anchor: 'people',
    pages: [{ title: '{peer} is here', body: 'Their square is bottom left, their cursor on the canvas. Click the square to follow them.', scene: 'peers-cursors' }],
  },
  {
    id: 'following', v: 1, format: 'lesson', roles: ALL, area: 'together', since: 'D-067, D-191',
    trigger: [{ event: 'following' }], anchor: 'follow-label', within: 'following',
    pages: [{ title: 'Following', body: 'You see what they see, wherever they go. `esc`, a pan of your own, or their square again stops it.', scene: 'follow' }],
  },
  {
    id: 'comment', v: 1, format: 'lesson', roles: ALL, area: 'together', since: 'D-192',
    trigger: [{ event: 'thread-open' }], anchor: 'thread', within: 'threads',
    pages: [{ title: 'Comments stay on things', body: "A chip marks what's been talked about. `@` tells someone; resolve it when it's done.", scene: 'thread' }],
  },
  {
    id: 'threads-panel', v: 1, format: 'lesson', roles: ALL, area: 'together', since: 'D-197',
    trigger: [{ event: 'threads-open' }], anchor: 'threads', within: 'threads',
    pages: [{ title: 'Every conversation', body: "New, mentions, resolved. In a thread, `on … ↗` (or `go there ↗`) takes you to what it's about.", scene: 'threads-panel' }],
  },

  // 9. Finding, canvases, settings
  {
    id: 'finder', v: 1, format: 'lesson', roles: ALL, area: 'canvas', since: 'D-196, D-236',
    trigger: [{ event: 'finder-open' }], anchor: 'finder', within: 'finder',
    pages: [{ title: 'Find anything', body: 'Empty, it lists places. Type to find cards, text, tasks. Tab widens it: here, this canvas, everywhere.', scene: 'finder-go' }],
  },
  {
    id: 'canvases', v: 1, format: 'lesson', roles: ALL, area: 'canvases', since: 'D-302, D-305',
    trigger: [{ event: 'crumb-open' }], anchor: 'crumb', within: 'menu',
    pages: [{ title: 'More than one canvas', body: 'Big work splits into canvases: this name lists them. `⌥1`–`⌥9` jump between them.', scene: 'canvases' }],
  },
  {
    id: 'settings', v: 1, format: 'lesson', roles: ALL, area: 'settings', since: 'D-097',
    trigger: [{ event: 'settings-open' }], anchor: 'settings-menu', within: 'settings',
    pages: [{ title: 'Settings', body: 'You: account and display (theme, motion, background). Workspace: name, people, export.' }],
  },
  {
    id: 'people-settings', v: 1, format: 'lesson', roles: OWNERS, area: 'settings', since: 'D-062, D-098',
    trigger: [{ event: 'settings-open', when: { page: 'people' } }], anchor: 'settings-people', after: ['settings'], within: 'settings',
    pages: [
      { title: "Who's in", body: 'Owners let people in with a code or an email invite, and choose who edits and who only reads.' },
      { title: 'Asking to join', body: 'Someone who enters your code waits under `asking to join`. `let in` adds them as an editor; `deny` turns them away.' },
    ],
  },
  {
    id: 'viewer', v: 1, format: 'lesson', roles: VIEWERS, area: 'settings', since: 'D-098',
    trigger: [{ event: 'edit-refused' }], anchor: 'toast',
    pages: [{ title: "You're reading here", body: 'You can look, comment and keep your own documents. Ask an owner to edit.' }],
  },

  // 10. Nudges: at most one a session (onboarding.md §4.5), retired by doing the thing.
  {
    id: 'nudge-focus', v: 1, format: 'nudge', roles: ALL, area: 'canvas', since: 'D-184',
    trigger: [{ event: 'idle', when: { pieces: { min: 1 } } }], doneWhen: [{ event: 'focus-in' }], anchor: 'sidenav',
    line: 'double-click a piece to go inside',
  },
  {
    id: 'nudge-finder', v: 1, format: 'nudge', roles: ALL, area: 'canvas', since: 'D-196',
    trigger: [{ event: 'idle', when: { cards: { min: 15 } } }], doneWhen: [{ event: 'finder-open' }], anchor: 'finder',
    line: '`⌘F` finds anything',
  },
  {
    id: 'nudge-help', v: 1, format: 'nudge', roles: ALL, area: 'start', since: 'D-315',
    trigger: [{ event: 'idle', when: { seen: { min: 5 } } }], doneWhen: [{ event: 'guide-open' }], anchor: 'sidenav',
    line: '`?` shows every note again',
  },
  {
    id: 'nudge-side', v: 1, format: 'nudge', roles: ALL, area: 'decks', since: 'D-300, D-314',
    trigger: [{ event: 'idle', when: { decks: { min: 1 } } }], doneWhen: [{ event: 'side-view' }], anchor: 'tasks',
    line: '`t` opens decks and days beside you',
  },
  {
    id: 'nudge-follow', v: 1, format: 'nudge', roles: ALL, area: 'together', since: 'D-067, D-191',
    trigger: [{ event: 'idle', when: { peerFor: { min: 60_000 } } }], doneWhen: [{ event: 'following' }], anchor: 'people',
    line: "click {peer}'s square to follow them",
  },
]

// A lesson by id.
export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id)
