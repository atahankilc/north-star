// Every lesson of the onboarding (D-315), as data: drawn by one renderer
// per format (onboarding.md §4), linted by `npm run check:lessons` (scripts/check-lessons.mjs, onboarding.md §8.2).
// Plain data: no React, no Firebase, only `import type` (erased), so a Node script (type stripping) and vitest load it.
//
// How the words are written:
// - `…` in backticks is a key or an on-screen word as the app writes it (`⌘F`, `esc`, `0`, `done`): drawn as a chip.
// - `{owner}` (the workspace's maker), `{peer}` (a person here), `{piece}` (the piece the event is about): filled in
//   when shown.
// - A title ≤ 6 words, a body ≤ 40 (its `extra` line counted in), ≤ 6 pages for anyone (D-349). Never "board" or "kanban" on
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
  'console-shown': ['kind', 'editing'],
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
export const FORMATS = ['welcome', 'guide', 'lesson', 'empty'] as const
export type Format = (typeof FORMATS)[number]
// The names a lesson's words may fill in.
export const PLACEHOLDERS = ['owner', 'peer', 'piece'] as const
// What a page may wait for: the side nav's tasks button (shown while the canvas has a deck or a timeline, TasksTool.tsx).
export const PAGE_IFS = ['has-tasks-button'] as const

// An event's payload must match: a value, or one of a list.
export type Match = Record<string, string | boolean | readonly string[]>
export type Trigger = { event: LessonEvent; when?: Match }

export type Page = {
  title: string
  body: string
  // Its tab in the modal's row of pages: one short word (else the title's last word, words.ts tabFor).
  tab?: string
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
  // Stays a moment after its anchor goes (its menu closed): no lead, until closed or the person's next doing ≥ 2.5 s
  // later (Lesson.tsx). Only the right-click's lesson: what it teaches is tried on the menu, which is up for a second.
  linger?: boolean
}
export type PagedLesson = Base & { format: 'welcome' | 'lesson'; pages: readonly Page[] }
export type GuideLesson = Base & { format: 'guide'; rows: readonly GuideRow[] }
export type LineLesson = Base & { format: 'empty'; line?: string; choices?: readonly Choice[] }
export type Lesson = PagedLesson | GuideLesson | LineLesson

const ALL: readonly Role[] = ['owner', 'editor', 'viewer']
const EDITORS: readonly Role[] = ['owner', 'editor']
const OWNERS: readonly Role[] = ['owner']
const VIEWERS: readonly Role[] = ['viewer']
// The pieces that open in a window or lie unframed (D-206, D-228); a document unframes too (D-234).
const LENSES = ['matrix', 'table', 'kanban', 'timeline', 'documents']
const STICKING = ['matrix', 'table', 'kanban', 'timeline']

export const LESSONS: readonly Lesson[] = [
  // 1. Start: the canvas's welcome, the workspaces page, asking to join. The welcome is about the canvas only: what's
  // inside a piece is taught when that piece is first opened (D-349).
  {
    id: 'welcome', v: 2, format: 'welcome', roles: ALL, area: 'start', since: 'D-174, D-349',
    trigger: [{ event: 'canvas-open', when: { first: true } }],
    pages: [
      { audience: 'new', title: 'This is your canvas', tab: 'canvas', body: "A canvas is an endless surface for your startup's work. Drag the empty space to move around, scroll to zoom round the pointer, press `0` to see everything at once.", scene: 'canvas-fit' },
      { audience: 'invited', title: '{owner} started this workspace', tab: 'canvas', body: "You're on its canvas: an endless surface for this startup's work. Drag the empty space to move around, scroll to zoom, press `0` to see everything at once.", scene: 'canvas-fit' },
      { title: 'Tools on the left', tab: 'tools', body: 'The side nav holds the canvas tools: fit shows everything, the compass finds anything, `?` opens this guide again. A decks button joins them once the canvas has a deck.', scene: 'sidenav-fit' },
      { roles: EDITORS, title: 'Add pieces with +', tab: 'add', body: "Everything on a canvas is a piece: a plane for your cards, a table, a matrix, a deck of tasks, a timeline, documents, or text. Press the magenta `+` and pick one.", scene: 'plus-adds-plane' },
      { roles: VIEWERS, title: "You're here to read", tab: 'reading', body: 'As a viewer you look around, comment, and keep your own documents. Changing the work stays with owners and editors; ask one if you need to edit.', scene: 'lens-focus' },
      { title: 'Every piece has a console', tab: 'piece', body: 'Point at a piece and a bar appears on its bottom edge: go inside, edit it, link it, read its comments. Pieces only move in edit mode, so nothing shifts by accident.', scene: 'console-appear' },
      { title: 'Go inside a piece', tab: 'inside', body: 'Double-click a piece, or press `focus` on its console, to work inside it on the whole screen. `esc` brings you back out to the canvas.', scene: 'focus-ink' },
      { title: 'Find it, together', tab: 'people', body: 'Who is here shows as squares bottom left. Right-click anything to comment on it. `⌘F` finds any card, heading or task. `?` shows every note again and all the shortcuts.', scene: 'peers-comment' },
    ],
  },
  {
    id: 'workspaces', v: 1, format: 'lesson', roles: ALL, area: 'start', since: 'D-338, D-345, D-349',
    trigger: [{ event: 'workspaces-open' }],
    pages: [
      { title: 'Your workspaces', tab: 'workspaces', body: "A workspace is one startup: its canvases, cards, tasks and people. The one you worked in last sits on top, with what changed since you left and who's in it now." },
      { title: 'Start, join or bring one', tab: 'start', body: "Type a name in the line at the top to start one. Paste a teammate's code there to ask to join theirs. Drop an exported .zip anywhere on the page to bring one in." },
      { title: 'Each one', tab: 'actions', body: "Open a workspace with a click. Its `⋯`, or a right-click on it, holds the rest: rename it, copy its invite code, leave or delete it. What needs you shows on this page too." },
    ],
  },
  {
    id: 'empty-canvas', v: 1, format: 'empty', roles: EDITORS, area: 'start', since: 'D-176',
    trigger: [{ event: 'canvas-open', when: { empty: true } }], doneWhen: [{ event: 'piece-made' }], anchor: 'plus', after: ['welcome'],
    line: 'press + to add your first piece',
  },
  {
    id: 'workspaces-empty', v: 3, format: 'empty', roles: ALL, area: 'start', since: 'D-062, D-338',
    trigger: [{ event: 'workspaces-open', when: { empty: true } }], doneWhen: [{ event: 'ws-made' }, { event: 'join-requested' }], anchor: 'workspaces-empty', after: ['workspaces'],
    choices: [
      { label: 'Start one', line: 'Type its name in the line above.' },
      { label: "Join a teammate's", line: 'Paste the code they gave you above. An owner lets you in.' },
      { label: 'Bring one in', line: 'A .zip exported from North Star: drop it anywhere on this page.' },
    ],
  },
  {
    id: 'join-pending', v: 2, format: 'lesson', roles: ALL, area: 'start', since: 'D-062, D-349',
    trigger: [{ event: 'join-requested' }],
    pages: [{ title: 'Waiting for an owner', body: 'Your code asked to join. An owner lets you in from Settings, under people. This page updates by itself the moment they do; meanwhile you can close it.' }],
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
    id: 'piece-made', v: 2, format: 'lesson', roles: EDITORS, area: 'canvas', since: 'D-180, D-182, D-210, D-228, D-289, D-349',
    trigger: [{ event: 'piece-made' }],
    pages: [
      { title: "It's in edit mode", tab: 'edit', body: 'A new piece starts in edit mode. Drag it to move it, pull an edge or a corner to resize it, and type its name in its top edge. Hold `alt` to move off the grid.', scene: 'edit-move-resize' },
      { kinds: [...LENSES, 'document'], title: 'Framed or unframed', tab: 'frame', body: "Framed, it's a window you open to work in. `unframe` on its console lays it on the canvas at its own size, live: click and type in it right there. `frame` puts it back.", scene: 'unframe' },
      { kinds: STICKING, title: 'Stick it to a plane', tab: 'stick', body: "Drop it near a plane's edge and it sticks: it reads only that plane's cards and moves with it. The `⇆` on its console unsticks it; hold `alt` while dropping to stay free.", scene: 'stick' },
      { title: "Done when you're done", tab: 'done', body: 'Press `done` on its console to leave edit mode. Pieces only move in edit mode, so nothing shifts by accident; `edit` on the console brings it back.', scene: 'edit-done' },
      { title: 'Nothing is lost', tab: 'undo', body: 'Deleting a piece asks first, and takes what it holds with it. Every change, a delete too, can be undone with `⌘Z` and done again with `⇧⌘Z`.' },
    ],
  },
  {
    id: 'beside', v: 2, format: 'lesson', roles: ALL, area: 'canvas', since: 'D-211, D-349',
    trigger: [{ event: 'beside-open' }],
    pages: [
      { title: 'Side by side', tab: 'beside', body: 'A piece stuck to the plane opens beside it, sharing the screen. Drag the line between them to give one side more room. Each side has its own dock.', scene: 'beside' },
      { title: 'They follow each other', tab: 'follow', body: 'Pick a row beside, and the plane glides to its card. Select a card on the plane, and its row lights up. `esc` closes the side.', scene: 'beside-pick' },
    ],
  },

  // 3. Planes and cards
  {
    id: 'focus-plane', v: 2, format: 'lesson', roles: ALL, area: 'planes', since: 'D-184, D-185, D-187, D-207, D-227, D-233, D-349',
    trigger: [{ event: 'focus-in', when: { kind: 'plane' } }],
    pages: [
      { title: "You're inside a plane", tab: 'plane', body: 'A plane is a space for cards. Drag to look around, scroll to zoom, `0` fits it all. The dock at the bottom holds its tools; `esc` goes back to the canvas.', scene: 'plane-inside' },
      { roles: EDITORS, title: 'Five kinds of card', tab: 'kinds', body: 'Customers have problems. Competitors solve them today; your ideas solve them better; features build the ideas. Add a card with `+`, or right-click the plane.', scene: 'kind-plane' },
      { roles: EDITORS, title: 'Make a card', tab: 'make', body: 'Pick a type: the card appears with its panel open. Type its name; Enter keeps it, Tab keeps it and starts the next of its type, `esc` takes it away.', scene: 'card-make-name' },
      { roles: EDITORS, title: 'Link cards', tab: 'links', body: "Point at a card and drag its `›` onto another. The link's kind says what it means: solves, for, competes, depends on. Links make the chain from customer to feature.", scene: 'link-draw' },
      { roles: EDITORS, title: 'Several at once', tab: 'many', body: 'Shift-click cards, or hold `alt` and drag a box round them. Move them together, copy, duplicate, line them up, tag them, or bundle them into a package.', scene: 'multi-select' },
      { roles: VIEWERS, title: 'Read a card', tab: 'cards', body: 'Click a card to open its panel on the right: what it is, the evidence for and against it, its links and notes.', scene: 'card-panel' },
      { title: 'Show only some', tab: 'filter', body: "The dock's filter shows only some types, one customer's cards, a tag or a region. It passes: leaving the plane clears it.", scene: 'plane-filter' },
    ],
  },
  {
    id: 'empty-plane', v: 1, format: 'empty', roles: EDITORS, area: 'planes', since: 'D-187',
    trigger: [{ event: 'focus-in', when: { kind: 'plane', empty: true } }], doneWhen: [{ event: 'card-made' }], after: ['focus-plane'],
    line: 'press + or right-click to add a card',
  },
  {
    id: 'card-panel', v: 2, format: 'lesson', roles: ALL, area: 'planes', since: 'D-221, D-137, D-044, D-225, D-226, D-254, D-349',
    trigger: [{ event: 'card-selected' }],
    pages: [
      { title: 'Everything about a card', tab: 'panel', body: 'The panel on the right holds what a card is, what backs it, its links by meaning, its tags and notes, all edited in place. `esc` closes it.', scene: 'card-panel' },
      { title: 'Is it true?', tab: 'evidence', body: 'Customers, problems and ideas have a status: hypothesis, testing, validated, invalidated. Evidence for or against shows on the card as cells, filled for, hollow against; `!` when they disagree.', scene: 'evidence' },
      { title: "Who it's for", tab: 'for', body: "A `for` link tags a card with a customer, so each customer is a segment. The plane's filter, FOR, then shows only that customer's cards.", scene: 'for-filter' },
      { kinds: ['competitor'], title: 'Their features inside', tab: 'features', body: "A competitor holds its features as small cards inside it. Point at it to see them; open its panel to add more and match them to ours.", scene: 'competitor-features' },
      { kinds: ['feature'], roles: EDITORS, title: 'Parts fold inside', tab: 'parts', body: 'A feature can hold parts, linked as part of. `−` folds them into the card as a tree; a part’s panel shows its parent.', scene: 'parts' },
      { roles: EDITORS, title: 'Tasks test cards', tab: 'tasks', body: 'The panel lists a card’s tasks and adds new ones. A card being tested offers `+ test it`; once that task is done, `+ log what it taught` turns its result into evidence.', scene: 'task-learned' },
    ],
  },
  {
    id: 'link-made', v: 2, format: 'lesson', roles: EDITORS, area: 'links', since: 'D-207, D-128, D-233, D-349',
    trigger: [{ event: 'link-made' }],
    pages: [
      { title: 'What does it mean?', tab: 'kind', body: 'The bar under a selected link picks its kind: solves, for, competes, depends on, part of. Give it a label, turn it round, or remove it.', scene: 'link-bar' },
      { title: 'Shown when it matters', tab: 'shown', body: "`for` and `relates` links stay hidden until one of their cards is selected, so the plane stays readable. The filter's LINKS shows them all.", scene: 'for-filter' },
    ],
  },
  {
    id: 'package-made', v: 2, format: 'lesson', roles: EDITORS, area: 'planes', since: 'D-239, D-245, D-349',
    trigger: [{ event: 'package-made' }],
    pages: [
      { title: 'A package', tab: 'package', body: 'A package bundles cards under one name and a rating. Drag its band to move them all; `−` folds it into one card listing what it holds, `+` opens it again.', scene: 'package' },
      { title: 'Packages in a plan', tab: 'plan', body: 'Packages nest, and their confidence comes from what they hold. A priorities deck ranks features and packages side by side.', scene: 'priorities' },
    ],
  },
  {
    id: 'brought', v: 2, format: 'lesson', roles: EDITORS, area: 'planes', since: 'D-281, D-349',
    trigger: [{ event: 'brought' }],
    pages: [
      { title: 'The same card, twice', tab: 'shared', body: "It's one card in two places: edit it here or there and both change. `⧉ 2` on it, and its panel's PLANES, say where else it is.", scene: 'shared-card' },
      { title: 'Deleting a shared card', tab: 'delete', body: 'Delete takes it off this plane only; it stays on the others. `delete everywhere` removes it from every plane.' },
    ],
  },

  // 4. Text
  {
    id: 'text-made', v: 3, format: 'lesson', roles: EDITORS, area: 'text', since: 'D-188, D-190, D-330, D-050, D-196, D-349',
    trigger: [{ event: 'text-made', when: { kind: ['heading', 'paragraph'] } }],
    pages: [
      { title: 'Writing on the canvas', tab: 'writing', body: 'Double-click text to type in it. It saves as you type; `esc` or a click away ends it. The bar under selected text sets its size, style and colour.', scene: 'text-edit' },
      { kinds: ['heading'], title: 'Headings are places', tab: 'places', body: 'Every heading shows in the finder as a place to go: pick it and the canvas glides there. Use them to name the areas of your canvas.', scene: 'finder-heading' },
    ],
  },
  {
    id: 'sticky-made', v: 2, format: 'lesson', roles: EDITORS, area: 'text', since: 'D-257, D-349',
    trigger: [{ event: 'text-made', when: { kind: 'sticky' } }],
    pages: [{ title: 'A sticky note', body: 'Paper in a colour, with who wrote it and when on its band. It grows with its text; `▾` folds a long one back to its first lines.', scene: 'sticky' }],
  },
  {
    id: 'section-draw', v: 2, format: 'lesson', roles: EDITORS, area: 'text', since: 'D-130, D-349',
    trigger: [{ event: 'text-made', when: { kind: 'section' } }],
    pages: [{ title: 'A section', body: 'A section frames things that belong together. Name it in its edge. Moving it carries everything fully inside it; its corner resizes it.', scene: 'section' }],
  },

  // 5. Matrix and table: taught when first made or opened, wizard and setup included (D-349).
  {
    id: 'matrix', v: 1, format: 'lesson', roles: ALL, area: 'lenses', since: 'D-204, D-212, D-216, D-133, D-249, D-349',
    trigger: [{ event: 'piece-made', when: { kind: 'matrix' } }, { event: 'focus-in', when: { kind: 'matrix' } }], after: ['piece-made'],
    pages: [
      { title: 'A matrix', tab: 'matrix', body: 'A matrix scores one list against another: competitors against features, ideas against criteria. Its rows and columns come from your cards, typed names, or single cards.', scene: 'kind-matrix' },
      { title: 'Working in a window', tab: 'window', body: '`focus` opens it in the middle with its dock below; `esc` goes back. Unframed, it lies on the canvas and you work on it right there.', scene: 'lens-focus' },
      { roles: EDITORS, title: 'Scoring cells', tab: 'score', body: "Click a cell, click again to step it, or type `1`–`9`. Arrows move between cells, `-` means it doesn't apply, Backspace clears it.", scene: 'matrix-keys' },
      { roles: VIEWERS, title: 'Reading the scores', tab: 'reading', body: "Each cell scores a row against a column. `—` means it doesn't apply. Totals, when shown, add up a row or a column.", scene: 'matrix-keys' },
      { title: 'How sure?', tab: 'sure', body: 'A score can say how sure it is: documented, `~` inferred, or `?` a guess, with a note that explains it.', scene: 'matrix-sure' },
      { roles: EDITORS, title: 'Judged on', tab: 'judged', body: "A feature can list what it's judged on. Unfold its axis and those criteria open as rows; score them and the feature's cell reads from them.", scene: 'criteria' },
      { roles: EDITORS, title: 'Change it any time', tab: 'setup', body: "`setup` in the dock has every choice the wizard asked, and more: the axes, what a cell holds, totals.", scene: 'matrix-wizard' },
    ],
  },
  {
    id: 'table', v: 1, format: 'lesson', roles: ALL, area: 'lenses', since: 'D-209, D-213, D-218, D-224, D-349',
    trigger: [{ event: 'piece-made', when: { kind: 'table' } }, { event: 'focus-in', when: { kind: 'table' } }], after: ['piece-made'],
    pages: [
      { title: 'A table', tab: 'table', body: 'A table lists cards as rows, picked by rules: a plane, a type, a status, a tag. New cards that match join it by themselves.', scene: 'table-rules' },
      { title: 'Working in a window', tab: 'window', body: '`focus` opens it in the middle with its dock below; `esc` goes back. Unframed, it lies on the canvas and you work on it right there.', scene: 'lens-focus' },
      { roles: EDITORS, title: 'Working in cells', tab: 'cells', body: "Click a cell; Enter or a double-click types in it. Arrows move, `space` ticks a check. A head's click sorts; drag its edge to widen the column.", scene: 'table-keys' },
      { roles: VIEWERS, title: 'Reading a table', tab: 'reading', body: "Each row is a card. Click a head to sort by it; click a card's name to open its panel.", scene: 'table-keys' },
      { roles: EDITORS, title: 'Your own columns', tab: 'columns', body: "`setup` in the dock adds columns of your own beside the cards' fields: a scale, a number, a few words, a check. It changes the rules too.", scene: 'table-setup' },
    ],
  },

  // 6. Documents
  {
    id: 'documents', v: 2, format: 'lesson', roles: ALL, area: 'documents', since: 'D-232, D-349',
    trigger: [{ event: 'focus-in', when: { kind: 'documents' } }, { event: 'piece-made', when: { kind: 'documents' } }], after: ['piece-made'],
    pages: [
      { title: 'Your files', tab: 'files', body: "A documents list holds notes, research and reports. Upload `.md` files or drop them on it. Each one is private until you share it.", scene: 'documents' },
      { title: 'Read beside', tab: 'beside', body: 'In focus, a click opens a document next to the list, to read as a page, with its headings to jump between. Open several side by side.', scene: 'doc-beside' },
    ],
  },
  {
    id: 'doc-place', v: 2, format: 'lesson', roles: EDITORS, area: 'documents', since: 'D-234, D-349',
    trigger: [{ event: 'piece-made', when: { kind: 'document' } }], after: ['piece-made'],
    pages: [{ title: 'A document on the canvas', body: 'A placed document is a window anyone here can read. Unframe it to read it on the canvas itself.', scene: 'doc-place' }],
  },

  // 7. Decks and days
  {
    id: 'deck', v: 2, format: 'lesson', roles: ALL, area: 'decks', since: 'D-252, D-256, D-300, D-349',
    // A deck of tasks: a deck holding cards has its own lesson (card-deck).
    trigger: [
      { event: 'piece-made', when: { kind: 'kanban', holds: 'tasks' } },
      { event: 'focus-in', when: { kind: 'kanban', holds: 'tasks' } },
      { event: 'unframed', when: { kind: 'kanban', holds: 'tasks' } },
    ],
    after: ['piece-made'],
    pages: [
      { title: 'A deck of tasks', tab: 'deck', body: 'Columns are steps, and each task sits in one. Drag a task to another column to move it along; a cyan line shows where it lands.', scene: 'deck-drag' },
      { roles: EDITORS, title: 'Adding tasks', tab: 'add', body: '`+ task` under a column types one. Enter adds it and keeps the field open for the next.', scene: 'deck-add' },
      { title: "A task's panel", tab: 'task', body: 'Click a task to open it: who it is given to, its due day, its card, a checklist and notes. Overdue days turn magenta.', scene: 'task-panel' },
      { title: 'Only some tasks', tab: 'filter', body: "The dock's filter shows tasks given to someone, due soon, for a card, or with a label. `lanes` splits the deck by person or by card.", scene: 'deck-filter' },
      { title: 'Decks beside you', tab: 'beside', body: "The side nav's decks button opens your decks beside whatever you are on, from anywhere. A deck's `days ›` puts its tasks on days.", scene: 'side-view' },
    ],
  },
  {
    id: 'card-deck', v: 2, format: 'lesson', roles: EDITORS, area: 'decks', since: 'D-253, D-271, D-349',
    trigger: [{ event: 'piece-made', when: { kind: 'kanban', holds: 'cards' } }, { event: 'focus-in', when: { kind: 'kanban', holds: 'cards' } }], after: ['piece-made'],
    pages: [
      { title: 'Cards on a deck', tab: 'cards', body: "Here the columns are one field's values: status, impact, effort or priority. Drop a card in a column and that field changes.", scene: 'card-deck' },
      { title: 'Suggested order', tab: 'order', body: '`order` ranks cards by impact × confidence ÷ effort, as P1–P3. It only suggests: it never writes anything.', scene: 'priorities' },
    ],
  },
  {
    id: 'side-view', v: 2, format: 'lesson', roles: ALL, area: 'decks', since: 'D-300, D-314, D-349',
    trigger: [{ event: 'side-view' }],
    pages: [
      { title: 'Decks and days, beside you', tab: 'side view', body: "This opens from anywhere, beside what you are on: the plane, its deck, then the deck's days with `days ›`. The tabs are the canvas's decks.", scene: 'side-view' },
      { title: 'Yours', tab: 'mine', body: '`MINE` lists the tasks given to you, from every deck. `ALL · DAYS` puts every deck on days.', scene: 'side-mine' },
    ],
  },
  {
    id: 'timeline', v: 2, format: 'lesson', roles: ALL, area: 'decks', since: 'D-262, D-304, D-314, D-349',
    trigger: [{ event: 'focus-in', when: { kind: 'timeline' } }, { event: 'piece-made', when: { kind: 'timeline' } }], after: ['piece-made'],
    pages: [
      { title: 'Days without end', tab: 'days', body: "A timeline shows a deck's tasks on a strip of days. Drag sideways through time; pinch, or pick day, week, month or quarter.", scene: 'timeline-scroll' },
      { roles: EDITORS, title: 'Plan by drawing', tab: 'draw', body: 'Draw across days on a row, then pick its card: that makes a task. Drag a task to move it, or its ends to change its days.', scene: 'timeline-draw' },
    ],
  },
  {
    id: 'empty-timeline', v: 1, format: 'empty', roles: EDITORS, area: 'decks', since: 'D-304',
    trigger: [{ event: 'focus-in', when: { kind: 'timeline', empty: true } }], doneWhen: [{ event: 'task-made' }], anchor: 'piece', after: ['timeline'],
    line: 'no tasks yet: draw across days to plan one',
  },
  {
    id: 'tasks-given', v: 2, format: 'lesson', roles: ALL, area: 'decks', since: 'D-261, D-349',
    trigger: [{ event: 'task-given', when: { byOther: true } }],
    pages: [{ title: 'A task for you', body: "Someone gave you a task. The count by the decks button is tasks given to you since you last looked; `MINE` in the side view lists them all." }],
  },

  // 8. Together
  {
    id: 'people-here', v: 3, format: 'lesson', roles: ALL, area: 'together', since: 'D-169, D-331, D-067, D-191, D-349',
    trigger: [{ event: 'peer-joined' }],
    pages: [
      { title: '{peer} is here', tab: 'here', body: 'Their square is bottom left, their cursor on the canvas, their selection marked in their colour. A faint square means they are away.', scene: 'peers-cursors' },
      { title: 'Follow them', tab: 'follow', body: 'Click their square to see what they see, wherever they go, into a plane and out. `esc`, a pan of your own, or their square again stops it.', scene: 'follow' },
    ],
  },
  {
    id: 'comment', v: 2, format: 'lesson', roles: ALL, area: 'together', since: 'D-192, D-197, D-349',
    trigger: [{ event: 'thread-open' }, { event: 'threads-open' }], within: 'threads',
    pages: [
      { title: 'Comments stay on things', tab: 'comments', body: 'Right-click a plane, card, text, link or task and pick `comment`. A chip under it counts the messages; magenta means new, `@` means you were mentioned.', scene: 'thread' },
      { title: 'Every conversation', tab: 'threads', body: "The threads tab at the bottom lists them all: new, mentions, resolved. In a thread, `on the canvas ↗` takes you to what it's about.", scene: 'threads-panel' },
    ],
  },

  // 9. Canvases and settings
  {
    id: 'canvases', v: 2, format: 'lesson', roles: ALL, area: 'canvases', since: 'D-302, D-305, D-306, D-307, D-313, D-349',
    // After the menu closes (no `within`): a modal never covers an open menu.
    trigger: [{ event: 'crumb-open' }, { event: 'canvas-made' }, { event: 'canvas-switch' }, { event: 'to-canvas' }],
    pages: [
      { title: 'More than one canvas', tab: 'canvases', body: "Big work splits into canvases. The workspace's name at the top left lists them; pick one to go there, or make a new one.", scene: 'canvases' },
      { roles: EDITORS, title: 'Move or share a piece', tab: 'move', body: '`move to canvas…` takes a piece to another canvas. `also on canvas…` puts the same piece there too; `⧉ 2` says it is on two.', scene: 'canvases-share' },
      { roles: EDITORS, title: 'Deleting a shared piece', tab: 'delete', body: 'Delete then asks: `only from here` keeps it on the other canvases, `delete everywhere` removes it from all of them.' },
    ],
  },
  {
    id: 'settings', v: 3, format: 'lesson', roles: ALL, area: 'settings', since: 'D-097, D-348, D-349',
    // Shown once Settings closes: it's a native dialog, nothing shows over it (D-349).
    trigger: [{ event: 'settings-open' }],
    pages: [
      { title: 'Settings', tab: 'you', body: 'YOU holds your account and the display: theme, motion, the background and its strength, the size of the tools. It is kept in this browser.' },
      { title: 'This workspace', tab: 'workspace', body: 'WORKSPACE holds its name and what you are building, the people in it, and export: the whole workspace as a .zip.' },
    ],
  },
  {
    id: 'people-settings', v: 2, format: 'lesson', roles: OWNERS, area: 'settings', since: 'D-062, D-098, D-349',
    trigger: [{ event: 'settings-open', when: { page: 'people' } }], after: ['settings'],
    pages: [
      { title: "Who's in", tab: 'people', body: 'Owners let people in with a code or an email invite, and choose who edits and who only reads. A new code turns the old one off.' },
      { title: 'Asking to join', tab: 'asking', body: 'Someone who enters your code waits under `asking to join`. `let in` adds them as an editor; `deny` turns them away.' },
    ],
  },
  {
    id: 'viewer', v: 2, format: 'lesson', roles: VIEWERS, area: 'settings', since: 'D-098, D-349',
    trigger: [{ event: 'edit-refused' }],
    pages: [{ title: "You're reading here", body: 'As a viewer you can look, comment and keep your own documents, but not change the work. Ask an owner to make you an editor.' }],
  },
]

// A lesson by id.
export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id)
