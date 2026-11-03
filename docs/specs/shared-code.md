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

