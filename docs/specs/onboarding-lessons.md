# Onboarding: every lesson

_The content of [onboarding.md](onboarding.md) (D-315): every lesson, its trigger, its words and its demo. This is
the source `src/onboarding/lessons.ts` is written from. The words are a first draft. The builder may tighten them,
but it keeps the limits (title ≤ 6 words, body ≤ 25 words, ≤ 4 pages) and the app's voice: plain, short, lowercase
actions, keys as the app writes them. **Never "board" or "kanban" on screen: "plane", "deck".**_

How to read an entry:
- **`id`** · format (`welcome`, `guide` = the kind guide, `lesson`, `nudge`, `empty`) · roles (all / E+ / O / V) ·
  `since` = the decision that made the feature as it is now (a later release that changes it bumps the version and
  arms it as `NEW`, onboarding.md §4.4).
- **when**: the event that shows it (onboarding.md §5.5). **done**: the event that retires it unshown. **anchor**: the
  `data-learn` it sits beside. **after**: while one of these is queued or showing, this one waits for it to close
  (onboarding.md §5.4); the general lesson first when one event triggers two. **within**: the busy surface it shows on
  (a wizard, the finder, a menu, setup, settings, threads, following, typing; onboarding.md §5.4).
- Names filled in: `{owner}` (the workspace's maker), `{peer}` (a person here), `{piece}` (the piece it's about).
- Pages marked (E+) / (V) are only for those roles; a viewer never gets editing words.
- Pages: **title**: body · `scene`.

Inventory rows (file:line, central functions) for each are in [onboarding-inventory.md](onboarding-inventory.md).

---

## 1. Start

### `welcome` · welcome · all · D-174
when `canvas-open` (first canvas, new or invited person) · done — · anchor — (middle)
1. **This is your canvas**: Everything for your startup lives on this canvas. Drag to move around, scroll to zoom,
   `0` shows everything. · `canvas-fit` (the cursor drags the canvas, zooms in on a plane, then clicks the side nav's
   fit button: the camera glides out until everything fits)
   _Invited into a filled workspace:_ **{owner} started this workspace**: Everything for this startup lives on this
   canvas. Drag to move, scroll to zoom, press `0` to see it all. · `canvas-fit`
2. **Pieces hold the work**: Planes hold cards: customers, problems, competitors, ideas, features, linked into one
   chain. Tables, matrices, decks and timelines read them. · `pieces-tour`
3. (E+) **Add anything with +**: The magenta `+` adds a piece. The first time you meet something, a short note
   explains it. · `plus-adds-plane` (the cursor goes to the side nav's `+`, clicks: the real menu builds; it moves
   down the rows, picks plane: a plane appears in the middle in edit mode)
   (V) **Find your way**: `⌘F` finds anything. Double-click a piece to go inside it; `esc` comes back out. · `finder-go`
4. **Together, live**: Who's here shows bottom left. Right-click anything to comment. `?` shows any note again. ·
   `peers-comment`
   _(V adds: "As a viewer you read, comment and keep your own documents.")_

### `side-nav` · lesson · all (`+` page E+) · D-178, D-202, D-196, D-314
when the pointer first rests on the side nav (≥ 600 ms), after `welcome` · anchor `sidenav`
Each page's scene is the real side nav at the stage's left edge, the canvas beside it, the cursor clicking one tool.
1. (E+) **Add**: `+` adds a piece: a plane, a table, a deck… · `sidenav-plus` (click → the menu opens → a row picked
   → the piece appears)
2. **Fit**: Shows everything on the canvas at once. Key: `0`. · `sidenav-fit` (the camera zoomed into a corner; click
   → it glides out to everything)
3. **Find**: Find any card, heading or task, and go there. Key: `⌘F`. · `sidenav-find` (click → the finder; `riv`
   typed; Enter → the camera glides there)
4. **Decks and days**: Opens tasks beside you, from anywhere. Key: `t`. · `sidenav-side` (only while the side nav's
   tasks button shows, i.e. the canvas has a deck or a timeline: `if: 'has-tasks-button'`; click → the side view opens
   on the right)

### `empty-canvas` · empty · E+ · D-176
when `canvas-open` with no pieces, after `welcome` · done `piece-made` · anchor `plus` (an arrow toward it)
Faint, centred: **press + to add your first piece** · no scene.

### `workspaces-empty` · empty · all · D-062
when the workspaces page with no workspaces · done `ws-made` or `join-requested`
Three framed choices: `create a workspace` (a name, then you're in) · `join with a code` (an owner lets you in) ·
`import a .zip` (a workspace someone exported).

### `join-pending` · lesson · all · D-062
when `join-requested` · anchor the pending row
1. **Waiting for an owner**: Your code asked to join. An owner lets you in from Settings; this page updates by itself.

---

## 2. The `+` and the pieces

### `kind-guide` · guide · E+ · D-176, D-301
when `plus-open` (until every row has been seen, or `hide guide`) · anchor the open `+` menu (a column glued to it) ·
within menu
One entry per row; the row under the pointer or keys shows its scene and two lines.

| row | lines | scene |
|---|---|---|
| plane | A space for cards. Customers, problems, competitors, ideas and features live here, linked. | `kind-plane` |
| matrix… | Score one list against another: competitors × features, ideas × criteria. Cells hold scales, numbers or text. | `kind-matrix` |
| table… | Cards as rows, chosen by rules (type, status, tag, plane). Add your own columns to compare them. | `kind-table` |
| documents | Your files: notes, research, reports. Private until you share them. | `kind-documents` |
| deck… | Columns of tasks, or cards sorted by a field. Drag between columns; give tasks to people and days. | `kind-deck` |
| timeline | Tasks on a strip of days. Drag to move them; draw to plan a new one. | `kind-timeline` |
| heading | A big title on the canvas. Headings are places: the finder takes you to them. | `kind-heading` |
| paragraph | A block of text, light Markdown. For notes that belong next to the work. | `kind-paragraph` |
| sticky note | A quick paper note in a colour. It shows who wrote it and when. | `kind-sticky` |
| section | Draw a frame round things; it carries what's inside when moved. | `kind-section` |
| project title | Your workspace's name and what you're building, big. Once per workspace. | `kind-title` |
| _in a plane:_ customer | Who has the problem. Other cards say who they're `for`. | `card-customer` |
| problem | What hurts. Give it a status and evidence for or against it. | `card-problem` |
| competitor | Who else solves it. Their features sit inside the card. | `card-competitor` |
| idea | How you might solve it. Test it; log what you learn. | `card-idea` |
| feature | What you'd build. Parts, must-haves, and what it rests on. | `card-feature` |
| package | Group cards into one bundle. It has a name and a rating. | `kind-package` |
| existing card… | Bring a card from another plane. It's the same card, in two places. | `kind-existing` |

### `piece-made` · lesson · E+ · D-180, D-182
when `piece-made` (first piece of any kind) · done `edit-off` · anchor the new piece
1. **It's in edit mode**: Drag it to move, pull an edge to resize, type its name in the top edge. · `edit-move-resize`
2. **Done when you're done**: Press `done` on its console. Pieces only move in edit mode, so nothing shifts by
   accident. · `edit-done`

### `piece-console` · lesson · all · D-264
when the first piece's console shows after `piece-made` (or the first console for someone who didn't make one) · done `focus-in` · anchor `console`
1. **Every piece has a console**: Point at a piece and its console appears: go inside, edit, link it, see its
   comments. · `console-appear`
2. **Go inside with focus**: Press `focus` or double-click. Inside, the piece is yours to work in; `esc` comes back.
   · `focus-ink`

### `focus-plane` · lesson · all · D-184, D-185
when `focus-in {kind: plane}` (first) · anchor `dock`
1. (E+) **You're inside the plane**: Drag to look around. `+` (or right-click) adds cards here. `esc` or `unfocus` goes
   back. · `plane-inside`
   (V) **You're inside the plane**: Drag to look around; click a card to read it. `esc` or `unfocus` goes back. ·
   `plane-inside`
2. (E+) **Make your first card**: `+` → customer, problem, competitor, idea or feature. Type its name, Enter keeps
   it. · `card-make-name`

### `empty-plane` · empty · E+ · D-187
when `focus-in {kind: plane, empty}` · done `card-made` · after `focus-plane`
Faint, centred: **press + or right-click to add a card** · no scene (onboarding.md §4.7).

### `focus-lens` · lesson · all · D-206
when `focus-in` a matrix, table, deck, timeline or documents (first of any) · anchor `dock`
1. **Working in a window**: This piece opened in the middle. Its tools are in the dock below; `esc` goes back. ·
   `lens-focus`

### `hazard-undo` · lesson · E+ · D-182
when the first `undo`-able delete closes the hazard confirm · anchor the toast
1. **⌘Z brings it back**: Every change can be undone with `⌘Z`, and done again with `⇧⌘Z`. · no scene

### `unframe` · lesson · E+ · D-228, D-289
when `edit-on` of a lens kind or a document (first) · done `unframed` · anchor the console's `unframe` · after
`piece-made`
1. **Framed or unframed**: Framed, it's a window. Unframed, it lies on the canvas at its own size and you work on it
   right there. · `unframe`

### `unframed` · lesson · E+ · D-228
when `unframed` (first) · anchor the piece
1. **Live on the canvas**: No focus needed: click and type in it here. `frame` in edit mode puts it back in a window.
   · `unframed-live`

### `stick-hint` · lesson · E+ · D-210
when the first drag of a matrix, table, deck or timeline in edit mode ends · done `stuck` · anchor the piece
1. **Stick it to a plane**: Drop it near a plane's edge and it links: it then reads only that plane's cards. Hold
   `alt` to stay free. · `stick`

### `stuck` · lesson · E+ · D-210, D-211, D-300, D-303
when `stuck` (first) · anchor the bond line
1. **Linked to the plane**: It now follows that plane: rules read its cards, and it moves with it. · `stick-follow`
2. (a table or matrix) **Open it beside**: In the plane's focus, `⇆ {piece}` opens it next to the plane. Pick a row,
   the plane shows the card. · `beside`
   (a deck) **Open it in the side view**: In the plane's focus, `⇆ deck` opens it in the side view, with only this
   plane's tasks. · `side-view`
   (a timeline: no page 2)

### `beside` · lesson · all · D-211
when `beside-open` (first) · anchor the split line
1. **Side by side**: Drag the line to share the screen. Each side has its own dock; `esc` closes the side. · `beside`

### `move-canvas` · lesson · E+ · D-306, D-307, D-313
when `to-canvas` (first) · anchor the prompt · within menu
1. **Move or share a piece**: `move to canvas…` takes it to another canvas. `also on canvas…` puts the same piece
   there too; `⧉ 2` says where. · `canvases-share`
2. **Deleting a shared piece**: Delete then asks: `only from here` keeps it on the other canvases, `delete everywhere`
   removes it from all. · no scene

---

## 3. Planes and cards

### `card-made` · lesson · E+ · D-250
when `card-made` (first) · done — · anchor the card panel · within typing
1. **Name it here**: Enter keeps it. Tab makes the next one of its type. `esc` with nothing typed takes it away. ·
   `card-make-name`
2. **Its panel**: What it is, what backs it, its links, tags and notes, all edited here. · `card-panel`
3. **Link it**: Point at a card, drag its `›` onto another. The link's kind says what it means. · `link-draw`

### `card-panel` · lesson · all · D-221
when `card-selected` (first, for someone who skipped `card-made`) · anchor the panel
1. **Everything about a card**: What it is, what backs it, its links by meaning, tags and notes. `esc` closes it. ·
   `card-panel`

### `status-evidence` · lesson · E+ · D-137
when the first status set or `evidence-added` · anchor the panel's status section
1. **Is it true?**: Hypothesis, testing, validated, invalidated. Evidence for and against shows on the card:
   `testing +2 −1`. · `evidence`

### `link-made` · lesson · E+ · D-207
when `link-made` (first) · anchor the link bar
1. **What does it mean?**: Pick its kind: solves, for, competes, depends on… Give it a label, or turn it round. ·
   `link-bar`

### `for-links` · lesson · all · D-044, D-128
when the first `for` link made (`link-made {kind: for}`) or the first `FOR` filter (`filter-set {kind: for}`) ·
anchor the panel's `for` rows · after `link-made`
1. **Who it's for**: A `for` link tags a card with a customer. The filter's FOR shows one customer's cards. ·
   `for-filter`

### `multi-select` · lesson · E+ · D-227
when `cards-multi` (first) · anchor the panel
1. **Several at once**: Shift-click or alt-drag a box. Move them together, copy, line up, tag or package them. ·
   `multi-select`

### `package-made` · lesson · E+ · D-239
when `package-made` (first) · anchor the package band
1. **A package**: It bundles cards under one name. Drag its band to move them all; `−` folds it into one card. ·
   `package`

### `brought` · lesson · E+ · D-281
when `brought` (first) or `bringing` · anchor the card · within menu
1. **The same card, twice**: Edit it here or there: it's one card. `⧉ 2` says where else it is. · `shared-card`
2. **Deleting a shared card**: Delete takes it off this plane only; it stays on the others. `delete everywhere`
   removes it from every plane. · no scene

### `competitor-features` · lesson · all · D-225
when a competitor card first selected (`card-selected {kind: competitor}`) · anchor the card · after `card-panel`
1. (E+) **Their features inside**: Point at a competitor to see its features; open it to add them and match them to
   ours. · `competitor-features`
   (V) **Their features inside**: Point at a competitor to see its features; select it to keep them open. ·
   `competitor-features`

### `parts` · lesson · E+ · D-226
when the first `part of` link or a folded tree first shown · anchor the card · after `link-made`
1. **Parts fold inside**: A feature can hold parts. `−` folds them into the card as a tree. · `parts`

### `plane-filter` · lesson · all · D-233, D-308
when `filter-open` on a plane (first) · anchor the filter strip
1. **Filters pass**: Show only some types, one customer, a tag or a region. Leaving the plane clears it. ·
   `plane-filter`

### `guides-snap` · lesson · E+ · D-231
when the first card drag in a focus ends · anchor `dock`'s `view`
1. **Lines up by itself**: Magenta guides show while dragging. `g` turns snapping off, `a` the guides; `alt` moves
   freely. · `guides`

### `right-click` · lesson · all · D-237, D-222
when `context-menu` (first) · anchor the menu · within menu
1. **Right-click is a prompt**: Type to narrow it, Enter picks the first, a letter jumps. Every menu works like this.
   · `prompt-type`

---

## 4. Text

### `text-made` · lesson · E+ · D-188, D-190
when `text-made {heading|paragraph}` (first) · anchor the text bar · within typing
1. **Writing on the canvas**: Double-click to type, `⌘Enter` to finish. The bar under it changes size, style and
   colour. · `text-edit`

### `sticky-made` · lesson · E+ · D-257
when `text-made {sticky}` (first) · anchor the sticky · within typing
1. **A sticky note**: Paper in a colour, with who wrote it and when. `▾` folds it to one line. · `sticky`

### `section-draw` · lesson · E+ · D-130
when `drawing-section` (first) · anchor the crosshair hint
1. **Draw a section**: Drag a frame round things. Name it; it carries what's inside when it moves. · `section`

### `headings-places` · lesson · all · D-050, D-196
when the first heading made or `finder-open` with headings · anchor the heading · after `text-made`, `finder` ·
within finder
1. **Headings are places**: The finder lists them; Enter glides you there. · `finder-go`

---

## 5. Matrix and table

### `matrix-wizard` · lesson · E+ · D-216
when `wizard {matrix}` (first) · anchor the wizard's side · within wizard
1. **Four questions**: What to start from, rows, columns, and what a cell holds. The preview shows it as you choose.
   · `matrix-wizard`

### `matrix-keys` · lesson · all · D-212
when `focus-in {matrix}` or the first cell picked (unframed) · anchor the cell bar · after `focus-lens`
1. (E+) **Scoring cells**: Click a cell, click again to step it, or type `1`–`9`. Arrows move, `-` means doesn't
   apply. · `matrix-keys`
   (V) **Reading the scores**: Each cell scores a row against a column. `~` is inferred, `?` a guess, `—` doesn't
   apply. · `matrix-keys`
2. (E+) **How sure?**: `~` inferred, `?` a guess. A note explains the score. · `matrix-sure`

### `matrix-criteria` · lesson · E+ · D-133, D-249
when the first `unfold` of a feature axis · anchor the axis
1. **Judged on**: A feature's criteria open as rows. Score them; the feature's cell reads from them. · `criteria`

### `table-wizard` · lesson · E+ · D-209
when `wizard {table}` (first) · anchor the wizard · within wizard
1. **Rows by rules**: A table picks its rows by rules: a plane, a type, a status. New cards join by themselves. ·
   `table-rules`

### `table-keys` · lesson · all · D-218
when `focus-in {table}` (first) · anchor `dock` · after `focus-lens`
1. (E+) **Working in a table**: Click a cell to type, arrows move, a head sorts. Drag a head's edge to widen it. ·
   `table-keys`
   (V) **Reading a table**: Each row is a card, picked by the table's rules. Drag to look around; `esc` goes back. ·
   `table-keys`
2. (E+) **Your own columns**: `setup` adds a scale, a number, text or a check. · `table-setup`

### `setup-open` · lesson · E+ · D-217
when `setup-open` (first, any kind) · anchor the setup panel · within setup
1. **Change it any time**: Setup has every choice the wizard asked, and more. · no scene

---

## 6. Documents

### `documents` · lesson · all · D-232
when `focus-in {documents}` or `piece-made {documents}` (first) · anchor the piece · after `focus-lens`,
`piece-made`
1. **Your files**: Upload `.md` notes or drop them here. They're private until you share them. · `documents`
2. **Read beside**: In focus, a click opens a document next to the list; open several side by side. ·
   `doc-beside`

### `doc-place` · lesson · E+ · D-234
when the first document placed on the canvas (`piece-made {document}`) · anchor the document piece · after
`piece-made`
1. **On the canvas**: A placed document is a window anyone here can read. Unframe it to read it on the canvas. ·
   `doc-place`

---

## 7. Decks and days

### `deck-wizard` · lesson · E+ · D-251, D-268
when `wizard {kind: kanban}` (first) · anchor the wizard · within wizard
1. **Tasks or cards**: A deck holds tasks, or your cards sorted by a field: status, impact, effort. · `deck-kinds`

### `deck` · lesson · all · D-252
when `focus-in {deck}` (first) or the first deck unframed · done `task-moved` (a task dragged to another column) · anchor `dock` · after `focus-lens`, `unframed`
1. (E+) **Moving work along**: Drag tasks between columns. `+ add a task` types one; Enter keeps typing the next. ·
   `deck-drag`
   (V) **Where the work is**: Each column is a step; each task sits in one. Click a task to read who has it, its day
   and card. · `deck-drag`
2. (E+) **A task's panel**: Click a task: give it to someone, a due day, a card, a checklist. · `task-panel`

### `task-card` · lesson · E+ · D-254
when the first task given a card · anchor the task panel
1. **Tasks test cards**: A task for a card shows on it: `☐ 2/5`. Finished, log what it taught as evidence. ·
   `task-learned`

### `card-deck` · lesson · E+ · D-253, D-271
when the first card deck made (`piece-made {kind: kanban, holds: cards}`, `priorities` too) · anchor the deck · after
`piece-made`
1. **Cards on a deck**: Columns are one field's values. Drop a card in a column and the field changes. · `card-deck`
2. **Suggested order**: `order` ranks by impact × confidence ÷ effort, as P1–P3. It never writes anything. ·
   `priorities`

### `side-view` · lesson · all · D-300, D-314
when `side-view` (first) · anchor the side view
1. **Decks and days, beside you**: `t` opens this from anywhere: plane, deck, then days, left to right. · `side-view`
2. **Yours**: `MINE` lists the tasks given to you; `ALL · DAYS` puts every deck on days. · `side-mine`

### `timeline` · lesson · all · D-304, D-314
when `focus-in {timeline}` or `piece-made {timeline}` (first) · anchor the piece · after `focus-lens`, `piece-made`
1. **Days without end**: Drag sideways through time; pinch or pick day, week, month, quarter. · `timeline-scroll`
2. (E+) **Plan by drawing**: Draw on a row to make a task; drag its ends to change its days. · `timeline-draw`

### `empty-timeline` · empty · E+ · D-304
when `focus-in {kind: timeline, empty}` · done `task-made` · anchor the piece · after `timeline`
Faint, on the strip: **no tasks yet: draw across days to plan one** · no scene.
_(An empty deck already says `· nothing yet` in each column with `+ add a task` under it (Kanban.tsx), and an empty
documents list says "No documents yet. Drop .md files here, or [upload] below." (Documents.tsx): no entry for them.)_

### `deck-filter` · lesson · all · D-256, D-308
when `filter-open` on a deck (first) · anchor the strip
1. **Only some tasks**: Given to, due, for a card, a label. It lasts while the deck is open. · `deck-filter`

### `tasks-given` · nudge-like lesson · all · D-261
when the first task given to this person by someone else · anchor `tasks` (side nav)
1. **Given to you**: The count by the side nav is tasks given to you since you last looked. · no scene

---

## 8. Together

### `people-here` · lesson · all · D-169
when another person first appears in this workspace · anchor `people`
1. **{peer} is here**: Their square is bottom left, their cursor on the canvas. Click the square to follow them. ·
   `peers-cursors`

### `following` · lesson · all · D-067, D-191
when `following` (first) · anchor the follow frame's label · within following
1. **Following**: You see what they see, wherever they go. `esc` or a click stops. · `follow`

### `comment` · lesson · all · D-192
when the first thread started or opened · anchor the thread panel · within threads
1. **Comments stay on things**: A chip marks what's been talked about. `@` tells someone; resolve it when it's
   done. · `thread`

### `threads-panel` · lesson · all · D-197
when `threads-open` (first) · anchor the panel · within threads
1. **Every conversation**: New, mentions, resolved. In a thread, `on … ↗` (or `go there ↗`) takes you to what it's
   about. · `threads-panel`

---

## 9. Finding, canvases, settings

### `finder` · lesson · all · D-196, D-236
when `finder-open` (first) · anchor the finder · within finder
1. **Find anything**: Empty, it lists places. Type to find cards, text, tasks. Tab widens to every canvas. ·
   `finder-go`

### `canvases` · lesson · all · D-302, D-305
when the crumb's prompt first opens (`crumb-open`) · anchor `crumb` · within menu
1. **More than one canvas**: Split big work into canvases. `⌥1`–`⌥9` jump between them. · `canvases`

### `settings` · lesson · all · D-097
when `settings-open` (first) · anchor the dialog's menu · within settings
1. **Settings**: You: account and display (theme, motion, background). Workspace: name, people, export. · no scene

### `people-settings` · lesson · O · D-062, D-098
when `settings-open {people}` (first, owner) · anchor the page · after `settings` · within settings
1. **Who's in**: Owners let people in with a code or an email invite, and choose who edits and who only reads. · no
   scene
2. **Asking to join**: Someone who enters your code waits under `asking to join`. `let in` adds them as an editor;
   `deny` turns them away. · no scene

### `viewer` · lesson · V · D-098
when the viewer's first try to change something (the "You're a viewer" toast) · anchor the toast
1. **You're reading here**: You can look, comment and keep your own documents. Ask an owner to edit. · no scene

---

## 10. Nudges (at most one per session, onboarding.md §4.5)

| id | line | when it may show | retired by |
|---|---|---|---|
| `nudge-focus` | double-click a piece to go inside · × | ≥ 1 piece, never focused | `focus-in` |
| `nudge-finder` | `⌘F` finds anything · × | ≥ 15 cards, finder never opened | `finder-open` |
| `nudge-help` | `?` shows every note again · × | ≥ 5 lessons seen, `?` never opened | `guide-open` |
| `nudge-side` | `t` opens decks and days beside you · × | a deck exists, side view never opened | `side-view` |
| `nudge-follow` | click {peer}'s square to follow them · × | someone else here ≥ 1 min, never followed | `following` |

---

## 11. What's new: a **sample** release for the tests (not shipped; at launch everyone starts as new, Q-026)

| item | line | scene | lessons armed | go |
|---|---|---|---|---|
| Decks and days | `t` opens plane → deck → days beside you, from anywhere. | `side-view` | side-view, tasks-given | open the side view |
| Timeline as a strip | Days without end: drag through time, pinch to change the scale, draw tasks. | `timeline-scroll` | timeline | — |
| Several canvases | Split the work into canvases; a piece can be on more than one. | `canvases` | canvases, move-canvas | open the crumb's prompt |
| Filters that pass | A filter lasts while its view is open, and new things always show. | `plane-filter` | plane-filter, deck-filter | — |
| Card faces | Cards tinted by type everywhere: on decks and in tables too. | `card-deck` | — | — |

_This sample lives in a test fixture, to build and check what's new. The shipped `releases.ts` starts with only
`launch`; the first real entry comes with the first release after onboarding._

---

## 12. Scenes (≈ 35, `src/demo/scenes/`)

Each 3–8 s (≤ 8000 ms), one action, 1 s hold at the end, poster = the telling moment. Fixture: `pazar` unless said.

| scene | what happens | poster |
|---|---|---|
| canvas-fit | the whole screen (HUD, side nav, canvas): the cursor drags the canvas, zooms in on a plane, clicks the side nav's fit: the camera glides out to everything | fitted |
| sidenav-plus / sidenav-fit / sidenav-find / sidenav-side | the side nav at the left edge with the canvas beside it; the cursor clicks one tool and its real result plays (menu → piece; glide to fit; finder → glide; side view opens) | each result |
| pieces-tour | a plane's cards build in chain order with links; a table beside fills | both built |
| plus-adds-plane | the whole screen: cursor to the side nav's `+`, clicks, the real menu builds, moves down to plane, clicks; a plane appears in the middle in edit mode | the new plane |
| edit-move-resize | a piece in edit mode dragged (0.8, landing L's), then its corner pulled | resized |
| edit-done | `done` pressed, the marks go | after |
| console-appear | cursor over a piece, the console builds in its corner | console shown |
| focus-ink | `focus` pressed, ink spreads, the plane is the view | in focus |
| plane-inside | in focus: drag pans, `+` menu with card types | menu open |
| card-make-name | `+` → `r`, a problem card, the panel's title typed, Enter | named card |
| card-panel | a card clicked, the panel builds, sections scroll | panel |
| link-draw | `›` dragged from a problem onto an idea, the link and its label | linked |
| link-bar | a link picked, kind changed to `solves` | bar |
| evidence | a status set to testing, two evidence rows added, the card reads `testing +2 −1` | card |
| for-filter | FOR set to a customer, other cards fade | filtered |
| multi-select | alt-drag a box over 3 cards, they move together | moved |
| package | 3 cards selected → `package these`, the band appears, `−` folds it | folded |
| shared-card | `existing card…`, ↵, the card on a second plane with `⧉ 2` | both |
| competitor-features | a competitor hovered, its features grow out | grown |
| parts | a feature's parts fold into a tree | folded |
| plane-filter | `filter` → SHOW unticks ideas | filtered |
| guides | a card dragged, magenta guides line it up | guides |
| prompt-type | a right-click menu, `de` typed, the list narrows | narrowed |
| text-edit | double-click a heading, type, `⌘Enter`, bar H1 → H2 | edited |
| sticky | a sticky made, typed, folded | sticky |
| section | crosshair drag, a section named, moved with its contents | moved |
| matrix-wizard | the wizard's four steps with the preview | preview |
| matrix-keys | a cell clicked twice, `3` typed, arrows to the next | scored |
| matrix-sure | `~` then a note | marked |
| criteria | an axis unfolds into criteria rows | unfolded |
| table-rules / table-keys / table-setup | rules picked → rows fill; a head sorts; a scale column added | each end |
| unframe / unframed-live | a table window turns into a live table on the canvas, a cell typed | live |
| stick / stick-follow | a table dragged to a plane's edge snaps; the plane moves with it | stuck |
| beside | in focus `⇆ table` opens it beside; a row picked lights the card | split |
| deck-kinds / deck-drag / task-panel / task-learned | a task dragged across; its panel; a finished task's lesson → evidence | each end |
| card-deck / priorities | a card dropped into `validated`; `order` lists P1–P3 | each end |
| side-view / side-mine | `t`, plane → deck → days; `MINE` | open |
| timeline-scroll / timeline-draw | the strip dragged, scale to week; a task drawn | each end |
| deck-filter | GIVEN TO one person | filtered |
| documents / doc-beside / doc-place | list → a click opens one beside; placed on the canvas | each end |
| peers-cursors / follow / peers-comment / thread / threads-panel | two peers' cursors; following; right-click `comment`, a reply | each end |
| finder-go | `⌘F`, `riv` typed, Enter glides there | arrived |
| canvases / canvases-share | the crumb's prompt, `⌥2`; `also on` → `⧉ 2` | each end |
| kind-* / card-* | one per kind-guide row: the thing appearing and doing its one move | the thing |
