# Shared code: the repeats left above the kit (D-361)

The kit (D-326), the cards (D-358) and the windows (D-359) are done: what is drawn is shared. What is left is a floor
up: the same *behaviour* or *logic* written two or more times (drag, pan, cell keys, panel sections, small pure
helpers). Found 2026-11-02 by reading the code in four areas (canvas, piece kinds, panels and pages, data/model/ops);
line numbers are from that day.

Rule for every step: one home per thing, the copies import it; where copies had drifted, pick the right behaviour,
write it down here, and note any visible change. A step touching a component still ships its gallery (D-324).
Files another session is editing are left until it's done (memory: concurrent sessions).

## Group 1: small, low risk, copies already drifted (do first)

| # | What | Where | Home |
|---|------|-------|------|
| 1.1 | "Is the person typing?" six ways, each checking a different list (`select`, `[role=listbox]`, `[role=menu]`, `contenteditable` vs `=true`, `dialog` vs `[role=dialog]`), so a key fires in one place and is swallowed in another | canvas/useEditKeys.ts, CanvasView.tsx ×2, plane/PlaneCards.tsx, canvas/MoveToCanvas.tsx, plane/PackPick.tsx | `isTyping(t)` in ui/foundation/focus.ts |
| 1.2 | A document's summary (words, bytes, excerpt) three times; `mdExcerpt` drops images, `excerptOf` doesn't | data/documents.ts, model/notes.ts, ops/document.ts | model/notes.ts |
| 1.3 | Deck/timeline logic copied into the agent's read layer, rules drifted (`stuckTo` only a plane, `canvasOf` vs `\|\| 'main'`, no `only`) | agent/read/derive.ts vs data/tasks.ts | model/tasks.ts (pure), data/tasks.ts re-exports |
| 1.4 | "Finished columns" built five ways | data/tasks.ts, agent/read/derive.ts, deck/Kanban.tsx, deck/Timeline.tsx | `doneCols`, `isFinished` in model/tasks.ts |
| 1.5 | `pagesOf` twice | table/Table.tsx, documents/Documents.tsx | model/paging.ts |
| 1.6 | Views re-writing model functions: `stuckChain`; align and spread | canvas/CanvasView.tsx; panels/CardPanel.tsx | model/pieceMoves.ts; model/layout.ts |
| 1.7 | Lists and limits re-declared: P1–P3 five times, statuses and kinds in the agent's tools, numbers in clean.ts that limits.ts has, `BATCH_WRITES` | model/cards.ts, data/tasks.ts, ops/tasks.ts, agent/read/tools.ts, model/clean.ts, data/importWorkspace.ts | model/shapes.ts, model/limits.ts |
| 1.8 | Id builders that exist but aren't used (`cellKey`, `placeId`), and none yet for a canvas spot or a comparison | ops/pieces.ts, ops/merge.ts, data/importWorkspace.ts, data/cards.ts, data/canvases.ts, ops/features.ts, data/competitorFeatures.ts, agent/tools.ts | model/matrix.ts, model/placement.ts, `spotId`, `comparisonId` |
| 1.9 | Small words: `plural` ~20 times (one `> 1` drift), first name split four ways, the invite code's look four times | many | ui/foundation/words.ts, model/tasks.ts, data/workspaces.ts |
| 1.10 | Dead: `freeSpot`; a bug: DrawSection has no `pointercancel` | model/placement.ts, canvas/DrawSection.tsx | delete; add |

## Group 2: many lines, each step closes on its own

- **Grid cells (matrix, table):** the selection key, arrows, focus moving and the key listener copied (~150 lines; the
  matrix's guard lacks `[role=listbox]`). `useGridCursor({ live, layer, rows, cols, keyOf, onKey })` and `CellInput`
  in canvas/; each kind passes only its own keys.
- **Panel sections:** tag editor ×3 (one rebuilds AddField by hand), linked-card row ×8, picking toggle + CardPicker
  ×6, notes ×2. `TagEditor`, `PanelLinkRow`, `usePicker`, `NotesSection` in panels/. CardPicker uses `useDismiss`.
  Decide once: does an add field keep what's typed on blur (the checklist does, AddField doesn't)?
- **Pick menus:** threads' `@` menu re-does the agent's `/` menu keys and misses `isComposing`. `usePromptPick` in
  ui/foundation. The agent's Box and Column prompts: `useAgentPrompt`.
- **Paging's look:** one `Pager` + page sizes (the table shows `1 / 1`, documents don't; sizes `[10,25,50,100]` vs
  `[10,20,50]`).
- **Filter stores:** planeFilter.ts and kanbanFilter.ts the same zustand shape: `makeHeldStore`; the drawers one way.
- **Unframed CSS:** the same block in four kinds: `PieceLayer.module.css` with `composes:`.
- **ops' "write that returns a value":** 15 hand-written wrappers: `runUiWith<T>` in ops/firestore.ts.
- **Bounding boxes:** 14+ copies: `boundsOf` and `cardsBox` in model/layout.ts.
- **Measured size into a store:** `useMeasuredSize` (Kanban, CardKanban, Documents, DocumentPiece).
- **Smaller:** `useStickToBottom` (threads gain the agent's: don't jump while reading up), `useBusy`,
  `useWorkspaceMembers`, `keepLocal`, `inBatches`, one `CONTENT_COLLECTIONS`.

## Group 3: bigger, across files (a plan of its own each)

- **One record per piece kind** (canvas/pieceKinds.tsx): its view, focused view, setup panel (title, open, toggle),
  content bounds. Replaces `kind ===` chains in CanvasView (setup ×2, bounds, views, five `Focused*` wrappers),
  Beside, shownBox, findIndex, FindPreview. First the matrix's setup state takes the table's and deck's shape
  (`setup: pieceId | null` + `tab`).
- **Wizards' skeleton** (matrix, table, deck): `useDraftWizard` + `<StartFrom>`; previews stay per kind.
- **Setup panel shell:** `<SetupShell>`.
- **Cascades:** cards' `rehome` and the same writes inside `pieceCascade` (and pieces' rehome twice) into one each, so
  the two delete paths can't disagree; a `refsTo(ws, ids)` list shared by merge and cascade.

## Group 4: after the drag work in progress (another session, 2026-11-02)

- The drag on a plane (cards, text, a selection) on one `startMove` (being built), then: the 0.8 carried style
  (`carriedStyle`, `useCarried`; the piece's `transition: none` vs cards easing: on purpose?), `useLanding`/`useHeld`.
- `pressDrag` beside `dragPointer` (window listeners, no capture, a still press stays a click) for the piece drag,
  link drag, box select, draw section.
- Panning three times (canvas, focus, beside): `panPointer`; zoom round the pointer: `zoomAt` in feel.ts; screen ↔
  plane maths: `planeMiddle`, `toPlane`.
- The decks' drag start (Kanban, CardKanban, Timeline): `useBoardDrag`.

## Kept apart on purpose

Text resize vs a piece's (turned paragraphs, own limits); box select vs drawing a section (only the plumbing);
`LabelItem.select` vs `setSelection` (canvas text); matrix heads vs table names; card vs task title; one vs several
in the panels; table rules, plane filter, deck filter and the agent's query (different data); the clear-spot finders
(spacing differs on purpose); Menu / ContextMenu / InPlaceMenu / PromptOverlay (already thin shells); thread messages
vs agent chat; rule checking in ops vs cleaning on import (share limits, not code).

## Done

(each step: date, what moved, what changed on screen, how checked)

- **Group 1, 1.1–1.8 and 1.10's dead code (2026-11-02).**
  - 1.1: `isTyping` (a text field or editable text; checkbox, radio, range and button inputs aren't typing) and
    `keysTaken(t, { docked })` (also a menu, a list, a modal, a hazard, a lesson; `docked` adds a docked
    `role="dialog"`) in ui/foundation/focus.ts. `docked` is on for the plane's keys, the matrix, the table and the
    workspaces page; off for undo, the canvas's keys, ⌥1–9, package picking, a deck (it can live in the tasks side
    view, an EdgeColumn) and the console. Settled drift: Settings is a modal, so the canvas's keys and undo step aside
    there (they checked the native `<dialog>` no longer used); the matrix now skips an open list as the table did; ⌥1–9
    and package picking skip menus and modals. Coach.tsx's `editable` is `isTyping`.
  - 1.2: `markdownSummary` in model/notes.ts for an uploaded .md, the agent's document and the notes; one `excerptOf`
    (images dropped, as the upload's did: the agent's documents read `!alt` before); `mdExcerpt`, `words` and two
    `bytes` deleted; `AUTHOR_NAME_MAX` in limits.ts (tested against validDoc).
  - 1.3, 1.4: `timelineKanbans`, `timelineOf`, `shownTasks`, `finished`, `taskTally`, `untested` in model/tasks.ts
    (data/tasks.ts re-exports); `doneCols` + `isFinished`. The agent's read layer uses them: its `doneCols` is the one
    `deck|column` set, it keeps only its rule that a deck narrows to a plane still there; timeline decks now match the
    app's (`only` too).
  - 1.5: `pagesOf` in model/paging.ts. 1.6: CanvasView imports `stuckChain`; the card panel's line up and space out
    are model/layout.ts' `alignTo`/`spreadTo`.
  - 1.7: one `PRIORITIES` (model/cards.ts; `FEATURE_PRIORITIES`, `TASK_PRIORITIES` and ops' are it), `ALL_STATUSES`;
    the agent's query lists import the model's and ops' (its piece kinds' order now the ops'); clean.ts reads 30
    limits by name; the import's batch size is `WRITE_BATCH_MAX`. Left raw in clean.ts (no named limit yet): tags'
    60, an edge kind's 40, text's 4000/200, a colour's 20, list sizes 200, rules 12 and their values, documents
    setup kinds, a box's col/row ids, the report body's sizes.
  - 1.8: `spotId` (model/canvases.ts), `comparisonId` (model/shapes.ts), `cellIdOf` (model/matrix.ts); every
    hand-built place, spot, cell and comparison id uses them (requests and invites keep theirs: one place each).
  - 1.10: `freeSpot` deleted. DrawSection's `pointercancel` went with group 4 (the drag plumbing).
  - Nothing else changes on screen. Checked: tsc, vitest (all but evalRunner's two, from another session's eval
    task in progress), evals regression on the stub (all pass), check:kit/tokens/gallery 0.
- **1.9 (2026-11-02):** model/words.ts: `plural(n, one, many?)`, `people(n)`, `firstName`, `codeText` (the invite
  code's `ABCD-EFGH`). The five local plural helpers (agent loop and stub, DocContent, CanvasSwitch, WorkspaceLayout,
  cardFacts, ops/deck) and the `> 1` ones (card panel's kinds, the fold menu, the agent's cells check) use it; the
  person/people counts on the workspaces page and in a document piece; the invite code in four places; first names in
  people settings, the agent's chats and the coach. Left as written: one-off inline `x === 1 ? '' : 's'` in sentences
  (new code uses `plural`); TextItems' sticky tag (another session's file then). Nothing changes on screen.
- **Group 4, all four (2026-11-02, north-star-48; on D-358's `startMove`).**
  - The carried look: `CARRIED` and `carriedStyle(shift, origin)` in ui/primitives/Marks.tsx (cards, a package's
    frame, text, a piece carried by a section; the decks' and timeline's held copies use `CARRIED`); `useLanding(id, x,
    y)` in canvas/selection.ts (cards, text). `useCarried`/`useHeld` not made: each caller reads its own `dragShift`
    already, and a piece's held box is its own (pieces save through their op). The piece's `transition: none` was not
    on purpose: a section carrying planes eased and its planes snapped; a carried piece now eases its scale as cards
    and text do (the one change on screen, only while it's picked up).
  - `pressDrag(move, end)` in ui/foundation/dragPointer.ts (window, no capture, cancel heard): the piece drag, the
    link drag, the box select, `startMove`, a text's width. DrawSection on `dragPointer` (held, its `pointercancel`
    now heard: a cancelled draw makes nothing and leaves no listener).
  - `panPointer` (dragPointer.ts: `lazy` for a press on a cell, `end(moved)`) for the canvas, the focus and beside;
    `zoomAt` in feel.ts for the three wheels; `toPlane`, `planeMiddle` in state/canvasView.ts (SideNav's two,
    `pasteSame`, BringCards, the box select).
  - `useBoardDrag` + `holdOnBoard` in deck/boardDrag.ts: Kanban's and CardKanban's press, the timeline's state and
    scale (its own day maths and edge scroll stay).
  - Checked: tsc; vitest (all but evalRunner's two then failing on HEAD, since fixed in 54409bc); every check; build;
    the same 14 gestures (pan and wheel zoom on the canvas, in focus, beside; a click that lets go; a box select; a
    link drawn; a deck task, a card deck's card, a timeline bar; a section drawn; a plane moved in edit mode) in old and
    new in headless Chrome, pixel-identical while held and after (three first differed by the camera's first fit,
    re-shot settled: 0).
- **Group 2, panel sections (2026-11-02).** In src/views/workspace/panels/, each with its gallery:
  - `TagList`: chips + the kit's AddField, cleaned once (trimmed, `#` dropped, cut, never twice, `room`),
    `suggest` as you type; used by a card's tags, several cards' tags, a task's labels (with its deck's labels
    offered) and a competitor's regions (`inlineAdd`, no `#`). A card's tags had their own field by hand.
  - `NotesSection`: a card's and a task's notes.
  - `PanelRow`: a link row (swatch, kind) or a tree row (depth, mark), the name a link, a quiet word, `×` on hover;
    links, planes, a package's holds, parts, rests on (and its `· solves` rows), matched by.
  - `usePicker`: a section's `+ card` and its CardPicker (links, holds, parent, parts, rests on, a task's card;
    `toggle` for planes' `+ place on`). CardPicker's press outside is `useDismiss`.
  - Settled drift: a section's `+` hides while its field or picker is open (only the task panel did); a row with
    nothing to say after its name no longer keeps an empty span.
  - Left: the checklist's add field keeps what's typed on blur while AddField drops it (to decide); `CheckField` as a
    CommitField option.
- **Group 2, grid cells (2026-11-03).** canvas/gridCursor.ts: `cellSel(prefix)` (the selection key, `cell|` for a
  matrix, `tcell|` for a table), `useGridCursor({ sel, piece, live, rows, cols, layer, onKey })` (the selected cell, the
  arrows kept inside with the focus going along, letting go when its row or column goes, the guard and the window
  listener), `CELL_SEL` (the card panel follows a cell's card). canvas/CellInput.tsx (with its gallery): a number or
  text typed in a cell. Each grid keeps only its own keys (matrix: `-`, steps, rolled; table: Space on a check).
  Checked: tsc, vitest, checks 0; in the gallery a click, → and ↓ move the cell and Escape lets go, in both.

- **Group 2, bounding boxes and the ops' writes that give back a value (2026-11-03, north-star-48).**
  - Bounding boxes: model/layout.ts' `boundsOf` (it was already there) for every copy: the agent's picture, a plane's
    cards (`cardBounds`), the demo's camera, a package's frame, placement's `boxOf`, the summary's picture, a section
    round text, `moveToCanvas`'s bounds (its own copy deleted), the canvas's fit, the move's guides, a space's bounds.
  - ops/firestore.ts: `runUiWith<T>` (the value once the server has the write) and `startUiWith<T>` (the value at once,
    `applied` to wait for), on one builder: no workspace, a refused builder (the toast), nothing to do, a refused
    write all give `none`. `opts` can read the value (the undo key on a new id). `runUi` stands on it. Moved onto them:
    addPiece, placeDocument, addCard, addPackageOp, copyCardsOp, addLabel, addTask, createEdgeOp, addCanvas,
    moveToCanvas, alsoOnCanvas, bringIn, takeOff, removeHere, a table's and a matrix's named row.
  - Settled drift: a write refused by validate (a viewer, the demo) now gives `none` everywhere: addCard and addLabel
    gave the id of nothing, takeOff the count, removeHere the cards; a duplicate refused by its builder says so in the
    toast (it threw).
- **Group 2, pick menus (2026-11-03, north-star-48).** ui/foundation/usePromptPick.ts: a list picked from inside a
  typing field keeps the field's keys (↑ ↓ round the ends, Enter or Tab picks, Escape closes the list only, the first
  row again as what's typed changes); the agent's `/` skills and a thread's `@` people stand on it. Settled drift: the
  `@` list no longer picks on an Enter that ends an IME's word or on shift+Enter, and its Escape stops there.
  tests/unit/promptPick.test.ts. Not seen live: the gallery has no people to mention (members come from Firestore).
- **Group 2, paging's look (2026-11-03).** model/paging.ts: one `PAGE_SIZES` (10, 25, 50, 100) and `pageSizesWith(size)`
  (a size kept from before stays offered); canvas/Pager.tsx (with its gallery): `PageArrows` (`‹ 2 / 5 ›`) and
  `PageSize` (a Select for an editor, `25 a page` for anyone else), in the table's and the documents list's docks; the
  table's setup tab offers the same sizes. Settled drift: the arrows show only past one page (the table showed
  `1 / 1`); the documents list offers 25 and 100, not 20 (one set at 20 keeps it).
- **Group 2, unframed CSS (2026-11-03).** canvas/PieceLayer.module.css: the layer (fills, clips, the pointer through it
  until live, nothing cut when opened onto the canvas), the world, and `shade` (D-277's ink under each part when
  unframed; a matrix's `data-sub` rows share their card's). The table's, matrix's, documents list's and deck's `.layer`,
  `.world` and shaded parts compose them. Checked: their unframed, on-the-canvas and in-focus gallery states in both
  themes pixel-identical to before (a second old shot as noise, the one differing state re-shot: 0).

- **Group 2, the smaller ones (2026-11-03, north-star-48).**
  - data/batches.ts `inBatches`: apply's and undo's batches (sent at once) and a workspace's delete (one after the
    other); import keeps its own (it cuts by bytes too).
  - One list of content collections: a workspace's delete takes model/fromDocs' `WS_COLLECTIONS` (threads apart), so
    a new collection is never left behind.
  - canvas/useMeasuredSize.ts: a piece's drawn size into its store, for CardKanban and the documents list. Left:
    Kanban.tsx (another session was in it); DocumentPiece measures more than its box (its cut, its height), kept.
  - data/workspaces.ts `useWorkspaceMembers`: the first `MEMBERS_LISTED` (100, limits.ts) by name, only those still
    in the workspace; a task's given to (one and several) and a thread's `@`. Settled drift: `@` loaded only the first
    20 people. Left: KanbanFilterDock.tsx (another session was in it).
  - state/local.ts `readLocal`, `readLocalJson`, `keepLocal` (never throwing): the split, guides, the threads panel's
    height, display, motion, theme, the change log, the suggested order, the tasks side view, folded lanes. Fixed: the
    change log read storage unguarded as it loaded, so a browser refusing storage stopped the module loading. Left:
    Kanban.tsx's `SOON` fold, the agent's settings, onboarding (its own merge).
  - Not done: `useBusy` (each copy handles its error its own way; a hook would save three lines and hide that) and
    `useStickToBottom` (Agent.tsx was being edited; next).
- **Group 2, filter stores (2026-11-03).** canvas/heldStore.ts: `makeHeldStore(key, fallback, oldPrefix)` (each piece's
  passing look in this tab, `use`/`get`/`set`, held while a dock is open and let go a moment after none is, the old
  browser copies taken away once); planeFilter.ts and kanbanFilter.ts are thin names on it (their exports and store
  shapes as before). canvas/filterPick.ts: `flip`, `named`, `pickRows` (an `any` row, then tick rows) for both filter
  docks; the deck's dock reads the model's `ALL_TYPES`. Kept apart: the drawers' open state (the plane's dock holds
  three drawers, one at a time, on one shelf; a deck's one per piece). Checked: both filter docks' gallery states in
  both themes pixel-identical to before (but the field's blinking caret).
- **Group 3, wizards' skeleton (2026-11-03).** canvas/useDraftWizard.ts: `useDraftWizard(templates, base)` (the step,
  the template picked, none once anything's changed by hand, the draft; `edit`, `patch` dropping fields set to
  undefined, `start` for the first step), `makeFromWizard` (close, put it at the canvas's middle, edit mode) and
  `firstFew`; canvas/StartFrom.tsx (with its gallery): the first step's templates and `my own`. The matrix's, table's and
  deck's wizards keep only their steps' editors and their previews.
- **Group 3, cascades (2026-11-03).** ops/cards.ts' `rehome(ctx, card, except)` takes one plane or the planes going,
  and pieceCascade uses it (it had the same writes inline); ops/pieces.ts' `pieceRehome` for a piece taken off its home
  canvas and for a canvas deleted. Kept apart: a shared `refsTo` for merge and cascade (each does something else with
  each kind of reference: merge points it at the kept card, the cascade deletes it or leaves it unread, D-141; a list
  would save little and hide that).

- **Group 3, one record per piece kind (2026-11-03, north-star-48).**
  - Step 1: the matrix's setup state took the table's and deck's shape (`setup` its id, `tab`), 2470763.
  - Step 2: canvas/pieceKinds.tsx, a record per kind that isn't a plane (matrix, table, documents, document, deck,
    timeline): its view (memoised, framed, open on the canvas or in focus), its own focus (a document's page), its
    contents' bounds, fitted or at its size, its setup (store, toggle, title, panel), its focus-dock tools and its
    console tools; `useSetupOn`, `useOpenSetups`, `closeSetups`, `closeOneSetup`. CanvasView's kind branches 48 → 17
    (those left are how kinds relate: a deck's timeline, a list's open documents, a delete's words), five `Focused*`
    wrappers one `FocusedLens`, six memo wrappers gone; Beside reads it for bounds, setup and dock tools. A plane stays
    the canvas's own (its cards and text). Checked: 17 galleries' states old vs new, pixel-identical (three needed 30 s
    for the camera's first fit); every dock's buttons, the console's on unframed pieces, setup and Escape in focus, on
    the canvas and beside, the same in both.
  - Step 3: the finder on the record: a kind's `find` (its matches, what a row says it is, the heads a landing keeps
    clear of) for the table, matrix and documents list, its bounds for every kind; the preview draws a match through
    the kind's view (`page` passed). The deck's tasks and a document's pages stay the finder's own (their rows are
    shaped apart). Checked: ten queries' rows and hints the same old vs new, their previews pixel-identical (one run
    caught the canvas behind mid-glide; again, identical).
  - Kept apart: shownBox.ts (an open piece's box: measured for the deck and lists, worked out for a matrix or table;
    it sits on the import-cycle-sensitive path, D-287).
- **Follow-ups (2026-11-03, north-star-48).** Kanban.tsx on `useMeasuredSize` and `readLocal`/`keepLocal` (its SOON
  fold), the deck's filter on `useWorkspaceMembers`; ui/foundation/useStickToBottom.ts for the agent's chat and a
  thread (`STICK_PX` in feel.ts). Settled drift: a thread no longer pulls you down to a new message while you read
  further up; it opens at its newest and sending takes you back down, as the agent's chat did.
  tests/unit/stickToBottom.test.ts.

---

# Round 2: what a second read found (2026-11-16)

A list of findings and of ways to keep repeats from coming back, for the user to pick from. Built so far: R1.1–R1.4
and R1.10 (D-388, under *Done, round 2* at the end); the rest is not started or decided. Found by a copy-paste detector (jscpd: exact copies are 0.3 % of TS, 0.5 % of CSS), an unused-code
finder (knip) and four full reads (the kit, the workspace views, the logic layers, demo/onboarding/gallery/scripts).
Line numbers are from that day. *Checked* = the drift was looked at again by hand after the read.

Where the repeats are now: not in what is drawn (the kit holds), but in behaviour, between layers, and in the folders
the checks skip. About 1,500–2,000 lines could go; what matters more is that several copies no longer agree.

**Not read, so unknown, not clean:** `src/three`, threads (Threads.tsx, ThreadInbox.tsx), most of CardPanel.tsx and
CanvasView.tsx, Agent.module.css (1,112 lines), presence, `database.rules.json`, most gallery and scene files (seen
only by grep).

## R1: copies that have drifted (do first)

| # | What | Where | Drift | Home |
|---|------|-------|-------|------|
| R1.1 | Limits kept by hand in four layers | firestore.rules, model/clean.ts, ops/*, data/* | A tag's length: `TAG_MAX` 40, clean.ts:38 takes 60. Tags a card: the rules 30, ops/merge.ts:105 keeps 20. A workspace's name is cut at a raw 200 in data/workspaces.ts and ops/validate.ts: not a drift (the fields cap at 80 on purpose, the rules keep older names up to 200), only an unnamed number. Raw copies of named limits in ops/table.ts, matrix.ts, lens.ts, text.ts, tasks.ts, validate.ts; agent/chats.ts:63 beside job.ts:46-47 | model/limits.ts for every number; the test in R4.2 |
| R1.2 | A table's sort and a field's text, twice | table/Table.tsx:95-155; agent/read/view.ts:205-263 | The agent reads another order than the person sees (step, number, check vs number, step, text, check); evidence `+2` vs `+2 −0`; regions joined ` · ` vs `, `; the agent cuts plane names at 20 before sorting | model/table.ts: `fieldText`, `sortedRows`, `cellsByKey` (the cell map is built five times); one fixture test for both readers |
| R1.3 | Saving while typing, three times | text/TextItems.tsx:630-652 (`useWhilePaused`); documents/DocEditor.tsx:205-233; ui/primitives/AutosaveField.tsx | AutosaveField's own `SAVE_AFTER_MS = 400` beside feel.ts `AUTOSAVE_MS = 500` (*checked*), and it doesn't save on a hidden tab (D-330 says it does) | `useWhilePaused` in ui/foundation, all three on it |
| R1.4 | Escape outside the one Escape stack | ui/patterns/Console.tsx:139 (`useEscapeCloses`, used by useDrawer, FilterDock, KanbanFilterDock); PeopleHere.tsx:34-63; WizardShell.tsx:47-54 | Who wins is who registered first, not what opened last (*checked*: an own capture listener) | `useEscapeLayer({ fields: false })` |
| R1.5 | The setup panel's shell, three times, its state in three stores | matrix/MatrixSetup.tsx:77-94; table/TableSetup.tsx:73-95; deck/KanbanSetup.tsx:57-70; `useMatrixUi`, `useTableUi`, `useKanbanUi` | Leaving focus closes any matrix's setup, a table's own only, a deck's never; the matrix's toggle resets the tab, the others don't. Round 1's `<SetupShell>` was never built | canvas/SetupShell.tsx + canvas/setupStore.ts (`{ piece, tab }`) |
| R1.6 | A value typed over where it's shown | Kit: InlineEdit, InlineField, CommitField (+ useCommit), AutosaveField, AddField. By hand: panels/TaskPanel.tsx:545 (`CheckField`), documents/Documents.tsx:397, deck/Kanban.tsx:733 and :768, canvas/CanvasView.tsx:1780 | Escape undoes four ways (a ref guard, a store check on blur, two kinds of rAF); none of the hand ones keeps what's typed on unmount | CommitField with a `bare` look and select-on-focus; InlineEdit and InlineField become it; AutosaveField draws `Field` |
| R1.7 | A document's page and its actions | Page: DocumentPiece.tsx:93-131 and :216-255, DocReader.tsx:81-85, find/FindPreview.tsx:181-221. Actions: Documents.tsx:353-394, DocumentPiece.tsx:257-271, DocReader.tsx:86-112 | `edit` is in the row and the window, not in the page beside the list nor a document's focus; share and delete are missing from the window; "is editor" three ways | documents/docActions.ts (`useDocActions(d)`), one `<DocPage>` |
| R1.8 | A piece kind's colour, three places | canvas/CanvasView.tsx:1430-1438; CanvasView.module.css:114-119; views/workspaces/WorkspacePicture.tsx:16-24 | A timeline is `--link-competes` on the canvas, `--link-draws` in the workspaces page's picture (*checked*) | `PIECE_TONE` beside `CARD_TONE` in ui/foundation |
| R1.9 | tokens.ts mirrors tokens.css by hand | styles/tokens.ts:4-5 | `fgDim #6b6b6b`, `fg #e8e8e8` vs `#8a8a8a`, `#ededed` (*checked*): D-337's greys never reached it; read only by agent/picture.ts | the test in R4.2 |
| R1.10 | Two drivers run a big job | agent/ui/agentStore.ts:212-232, :600-625; evals/run.ts:174-233 | The eval never handles a `pause` move and decides "a preview per step" itself; weakens D-341's "what is measured is what ships" | `afterTurn`, `afterApply` in agent/job.ts |
| R1.11 | Window drags by hand beside `pressDrag` | deck/Kanban.tsx:403-425; deck/Timeline.tsx:463-491; documents/Documents.tsx:465-493 | Thresholds 4, 4.5 and 5 px beside `DRAG_PX`; the deck's box select selects on a cancel and lets Escape through, the plane's drops it | `pressDrag` + `DRAG_PX`; one `boxDrag` in canvas/selection.ts |
| R1.12 | Link kinds listed six ways | model/edges.ts:7; ops/edges.ts:7; agent/read/lines.ts:21; model/planeFilter.ts:17; plane/PlaneLinks.tsx:34; panels/CardPanel.tsx:94 | The panel says `inspired`, the others `inspired by` (*checked*) | one record in model/edges.ts (kind, label, group, order), the type from it |
| R1.13 | "Follow what was just added" | matrix/Matrix.tsx:205-230; table/Table.tsx:77, :246-262 | A row added to a matrix from its setup, or beside a plane, isn't glided to; a table's is | `useFollowAdded` beside gridCursor.ts |
| R1.14 | Canvases and spots have no cleaner | data/importWorkspace.ts:63-107; ops/validate.ts:244-248; firestore.rules:355-366 | Import fills a missing `order` with 0, validate refuses it | `cleanCanvas`, `cleanSpot` in model/clean.ts |
| R1.15 | The agent's dates beside the model's | agent/read/lines.ts:93, :195, view.ts:348, tools.ts:433, :718, :306, :822; agent/ui/suggest.ts:19 | `due_before: 2026-13-45` passes the query (`isDay` checks the calendar); suggest.ts takes today in UTC and calls a finished task late | `overdue(t, finished, today)`, `isDay` in model/tasks.ts |
| R1.16 | Storage read outside state/local.ts | agent/ui/Agent.tsx:88 (no guard, in a layout effect; *checked*), agent/ui/settings.ts, agent/usage.ts, data/onboarding.ts, ui/patterns/panelWidth.ts | A browser refusing storage: the crash round 1 fixed for the change log | `readLocal`, `keepLocal` |

## R2: repeats that still agree

**Views**
- A piece in a pane (view + setup + dock tools) four times beside the kind record: CanvasView.tsx:1024 and :2033,
  Beside.tsx:153-200 (still `kind === 'matrix' ? … : …`), deck/TasksSide.tsx:243-268. Home: `<LensPane>` reading
  `PIECE_KINDS`.
- Kanban vs CardKanban: the view wrapper, `dist()`, folds, `vars`, the ghost (Kanban.tsx:206-260, :335, :459, :570 vs
  CardKanban.tsx:49-106, :138, :227). Home: deck/boardDrag.ts, `useFolds`. The `.layer > .world` JSX is also in Matrix,
  Table, Timeline and Documents: a `<PieceLayer>` component (round 1 shared only its CSS).
- A name typed or a card picked for an axis: matrix/MatrixSetup.tsx:231-301 (`AddPill`, arrow keys) vs
  Matrix.tsx:684-751 (`AddEntry`, none). Home: `usePromptPick`.
- `entriesOf` (model/matrix.ts:146) and `rowsOf` (model/source.ts:86) share their merge; their UI twin, the "added by
  hand" pills, MatrixSetup.tsx:164-186 vs TableSetup.tsx:138-159.
- Small: a textarea as tall as its text by hand (TextItems.tsx:584, :811) beside `useAutoGrow`; a name's leading number
  regex three times (TextItems.tsx:94, CanvasView.tsx:1424, CardPanel.tsx:932); table/rows.ts:61 `ORDER` is
  model/graph.ts `CHAIN`; the last order in a column five times; `Toggle` and `Choices` (MatrixSetup.tsx:110-117) only
  rename Checkbox and Options.
- CSS: a cell's inside, Matrix.module.css:303-346 vs Table.module.css:218-262; a peer's name tag,
  collab.module.css:28 vs DocEditor.module.css:167; Crash.module.css:3 vs WorkspaceLayout.module.css:82.

**Kit**
- `ResizeEdge` and `SplitLine` are one component twice (a line at rest or not). Home: one `DragLine`.
- `PeopleHere` rebuilds a menu, a tip, Button's hover and outside-press by hand, and reads a view's context; it belongs
  in views/workspace on Menu, Avatar and `useDismiss`.
- `Tip` re-does `Popover`'s measure-then-place (and doesn't follow a scroll); `Menu` hangs by CSS, so it can be clipped
  where a Select isn't.
- The round surface with a line in about six CSS files (PromptFrame, Window, HazardConfirm, Tip; Toast, PeopleHere and
  Settings compose the old square Frame and override it). Home: one `surface` class.
- `NAME ──── count` by hand in FilterColumn.tsx:74 and PromptRow.tsx:111 beside `Rule`; Label's five declarations
  repeated in five modules.
- The close button, the window title's style, and Settings' avatar by hand (Settings.tsx:134) though `Avatar` exists.
- "Is this a text field" three ways (focus.ts:42, useEscapeLayer.ts:14, WizardShell.tsx:20) plus CanvasView.tsx:453.
- Arrow keys round a group twice (Tabs.tsx:40, Options.tsx:47); `usePromptNav` and `usePromptPick` overlap.
- Three rAF loops beside `tween()` (Appear.tsx:27, DecodeText.tsx:20, HazardConfirm.tsx:105) with raw durations.
- The agent's answer is a third light Markdown (agent/ui/Agent.tsx:815-927 beside LightMarkdown and Markdown).

**Logic**
- Text cut to n with `…`: about 14 local copies (agent/loop.ts:147, picture.ts:36, chats.ts:74, changeset.ts:740,
  preview.ts:166, ops/document.ts:22, ops/merge.ts:35…). Home: `cut`, `flat` in model/words.ts.
- Twins of helpers that have a home: agent/read/text.ts `count` is `plural`, its `norm` is model/lens.ts'; ops/arrange.ts
  `snapTo` is model/grid.ts `snap`; `clone` six times; deep equal five; slug four. Home: model/words.ts, a small
  model/util.ts.
- The two provider adapters: the same error class, `abortError` (`'Stopped.'` vs `'stopped'`), tool shape, sources,
  `respond()`; anthropic.ts:334 sums usage by hand and drops `reasoning`; the model regexes in three files. Home:
  agent/provider.ts. Retry and usage counting stay per provider.
- Value lists re-declared in clean.ts (:134–:450) and ops/registry.ts though named in ops/text.ts, ops/deck.ts,
  data/tasks.ts, model/pieces.ts; lanes four times. Home: model/shapes.ts.
- Import's batching (data/importWorkspace.ts:265-283) is now `wholeBatches` (round 1's reason to keep it went with
  D-369); data/liveTransport.ts:87-104 hand-rolls `inBatches`.
- A markdown document made three ways (data/documents.ts:176, :203; ops/document.ts:30); `'agent-notes'` for `NOTES_ID`.
- Collection maps: agent/changeset.ts:479 and preview.ts:200 the same; io/bundle.ts `BUNDLE_COLLECTIONS` is
  `WS_COLLECTIONS` less threads by hand.
- "Who am I" as a name about 12 times, `'Someone'` and `'someone'`. Home: `authorName(user)`.
- Renaming a piece three times in ops (pieces.ts, table.ts:192, matrix.ts:306).
- 37 inline `=== 1 ? '' : 's'` left; new ones since round 1.
- functions/src/index.ts: a second SSE parser, `scrub` covering only `sk-`, and 1.0's request shape (today's agent
  request would not pass `cleanBody`). Parked until Blaze; then test `cleanBody` against `requestBody()`.

**Demo, gallery, scripts**
- demo/fixtures kit.ts and o10–o13.ts, split by build step: the scene's CSS injector five times, `NO_HUD` twice,
  `wizardCss` twice, `glideTo` twice, a cubic ease seven times (motionTokens has `easeInOut`). Home: one demo/stage.ts.
- scenes/peers-comment.ts keeps its own copy of o13.ts's and kit.ts's helpers (~90 lines).
- The same made-up threads in demo/scenes/threads-panel.ts:18-45 and gallery/panels.tsx:15-48.
- The real screen's arrangement copied by hand: WorkspaceLayout.tsx:108-176 into demo/views.tsx:35-92 (gallery reuses
  the copy), so a HUD change doesn't reach lessons or the gallery. Home: a pure `WorkspaceScreen` all three mount.
- Stage (demo) and Mount (gallery) share the provider stack and a `Boundary`; made-up pointer input five times; a
  document's text filled by two copies (o12.ts:43, gallery/canvas.tsx:96).
- Gallery files: `none` in 20 files, `TITLE`, `day(n)`, a base task, `wizard(then)`, a `Live` holder. Home:
  gallery/samples.ts.
- scripts: `walk()` five times, the baseline code twice, the list of checks twice, covered folders in three places.
  Home: scripts/lib.mjs. check-tokens.mjs:16 `sources` names src/ui/cardTone.ts and src/ui/motionTokens.ts, which moved
  to foundation/ (*checked*); check-scenes.mjs has no npm script and isn't in CI.

## R3: unused

- `ui/primitives/Swatches.tsx`: only its own gallery uses it (*checked*).
- Reported unused, to confirm before deleting: Frame.module.css `.dashed`, `.interactive`, `.label`; `Empty`'s
  `tone="dim"` (both tones are one colour); exports named nowhere else: `labelClass`, `countText`, `initialOf`,
  `turnUsage`, `byReading`, `canvasOfLabel`, `hasChecks`, `matrixAxes`, `DOC_FIELDS`, `canvasRef`, `posRef`,
  `changeLogOn`, `removeComparison`, `kindOfType`, `edgeRef`, `snapshotWith`, `snapPoint`.
- data/regions.ts: a re-export nothing imports. plane/cardInside.ts, deck/kanbanCards.ts: two-line re-exports of model/.
- onboarding/devMount.tsx, devGuides.tsx: imported by nothing, driven from the console; ask the user before deleting.
- Not a real repeat: jscpd's 100-line clone inside TextItems.tsx (its line ranges don't hold; only ~8 lines of the
  title's layout are alike, on purpose).

## R4: keeping repeats from coming back (ideas, none decided)

Why they got in: the checks see what is drawn, not behaviour; they skip `src/demo`, `src/gallery`, `*.gallery.tsx`,
`scripts` and the inside of `src/ui`; the rules file can't import and only ~30 numbers are tested against it; a new
kind is made by copying its nearest sibling; the gallery shows components, not hooks or helpers; "left, another
session was in it" notes stay left.

1. **Checks for behaviour**, in check:kit with the same baseline that only shrinks: a `window.addEventListener` for
   keys or the pointer outside ui/foundation; a `requestAnimationFrame` loop outside `tween()`; `localStorage` outside
   state/local.ts; a bare `.slice(0, n)` or `length > n` in model/, ops/, data/; a raw `<button>`/`<input>` inside
   src/ui.
2. **Tests where copies can't merge** (as limits.test.ts): the rules' `onlyKeys` and `in [...]` lists against clean.ts
   and shapes.ts; tokens.ts against tokens.css; `BUNDLE_COLLECTIONS` against `WS_COLLECTIONS`; the app's and the
   agent's reading of one table fixture.
3. **Two ready tools in CI**: jscpd failing above today's share; knip failing on a new unused export or file.
4. **A same-name check**: the hook warns when a new export's name already exists in another file with another body
   (`norm`, `clone`, `usageOf`, `tableRows`, `effortFor` got in this way).
5. **The skipped folders covered**: scripts/lib.mjs, demo/stage.ts, and check:kit reading demo and gallery.
6. **Fewer near-twins in the kit** (five in-place fields to two), a "which one when" page in the gallery, and an index
   page for foundation's hooks and model's helpers.
7. **A new piece kind only through `PIECE_KINDS`**, once `SetupShell` and `LensPane` exist: nothing left to copy.

Suggested order: R1.1–R1.4 and R1.10 (they change behaviour), then R4.1–R4.4 so nothing new gets in, then the big
merges (R1.5–R1.7, the demo) and R3.

## Done, round 2

- **R1.1, R1.2, R1.3, R1.4, R1.10 (2026-11-16, D-388).**
  - R1.1: `TAGS_MAX`, `REGIONS_MAX`, `WORKSPACE_NAME_KEPT_MAX` in model/limits.ts, tested against the rules; clean.ts
    cuts a tag at `TAG_MAX` and a region at `REGION_MAX` (one helper cut both at 60), a label's text by `textMax`, a
    column's limit by `LIMIT_MAX`; the raw copies of named limits in ops/{table,matrix,lens,text,tasks,validate,merge}.ts
    and data/workspaces.ts import them; agent/chats.ts reads job.ts' `JOB_TITLE_MAX`, `MAX_STEPS`, `JOB_PAUSED_MAX`.
    Settled drift: a tag is at most 40 for import and the agent too (was 60); a merge keeps 30 tags (was 20).
    Left: the numbers with no name yet (a package's 60 members, ids' 128, a member's email 320 and photo 2000, a
    thread's preview, clean.ts' list sizes, rules, box ids and report sizes), and R4.2's test of field and value lists.
  - R1.2: model/table.ts `fieldText(ctx, card, field)`, `sortKey`, `sortedRows`, `cellsByKey`; Table.tsx' `useFieldText`
    and `tableRows` and the agent's `tableValues` stand on them. Settled drift: the agent's order is the person's; it
    reads evidence as `+2` and regions with ` · `. tests/unit/tableRead.test.ts holds the two orders equal on every
    fixture table. Left: Matrix.tsx' two cell maps (built from a list already filtered).
  - R1.3: ui/foundation/pausedSave.ts; TextItems' own `useWhilePaused` deleted, DocEditor's timer and AutosaveField's
    `SAVE_AFTER_MS` gone. Settled drift: AutosaveField waits 500 ms (was 400) and saves on a hidden tab.
    tests/unit/pausedSave.test.ts. Left: `TitleFields`' own `saved` ref (TextItems.tsx), R2's textarea height.
  - R1.4: `useEscapeCloses` is `useEscapeLayer(close, { on: open })`; PeopleHere's list on `useDismiss`, its
    stop-following on a `first` layer. The stack gained: a rootless layer steps aside only for a menu, a list or a
    modal; `first`. Settled drift: what opened last closes first, whatever registered first. Left: WizardShell's Enter
    listener (not Escape), the three "is this a text field" selectors (R2, kit), the rest of PeopleHere (R2, kit).
  - R1.10: agent/job.ts `takeMove`, `moveAfterTurn`; agentStore.ts' `moveJob` and `afterTurn` and evals/run.ts' two
    spots call them. Settled drift: the eval takes a pause as the app does (the job goes `paused` with why).
  - Checked: tsc; vitest 1099/0; the stub evals 59/59; check:tokens, kit, gallery, lessons 0; build; headless Chrome on
    the gallery (Escape on both filter docks' drawers, the people list, stopping a follow, a self-saving field; the
    acting examples of the filter docks and the table). Not seen in the real app; no paid eval run.

