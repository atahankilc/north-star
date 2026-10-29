# The agent: action inventory (D-312, Phase 1, step S1)

_2026-10-29. Made for the parity rule in [agent.md](agent.md) §4.10; the ops it names are §4.4's `change` ops; the
gaps it finds are §5's R1–R12._

**What this is.** A list of every change a person can make to a workspace's content in the app today. For each one:
where you do it, which function in `src/data/` it calls now, and the op the agent will use for the same thing once
`src/ops/` exists. If a row has no op, the parity gate fails.

**How to read the Notes column.** It marks problems the ops layer must fix:
- **R1**: the function uses the canvas on screen (a module global in `canvases.ts`), not one it is given.
- **R2**: one action makes several undo steps, or two writes that should be one.
- **R4**: fire and forget: it returns ids before the write lands.
- **R5**: the caller passes lists (edges, places, cells…) for a cascade; one forgotten means a silent half delete.
- **R7**: real logic lives in a component (what moves along, where a thing lands, what a new thing is called…).
- **no UI caller**: exported from `src/data/` and never called from the UI.

Paths: views are in `src/views/workspace/` unless a full path is given; data functions are `file.ts:function` in
`src/data/`. Line numbers are from 2026-10-29 (`8651c9b` + the uncommitted tree).

---

## 1. Cards

**Who / tracked:** editors only; every write tracked (undo; one step per row today, except rows marked R2).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| `+` → card of a type, in a focused plane (WorkspaceLayout.tsx:302, `addHere` :278) | `cards.ts:addCard` | `create_card` | R3: writes an empty title; the name comes later through the panel. Position = view's middle (R7). |
| Right-click empty plane → `add a card here` → type (planeMenu.ts:189, `card` :167) | `cards.ts:addCard` | `create_card` | Same as above, at the pointer. |
| Name a new card: Enter keeps it (CardPanel.tsx:645, `Title` :589) | `cards.ts:retitleCard` (`fresh`) | `create_card` (title given) | R2/R3: make + name are two writes merged only by the `fresh` flag. |
| Name a new card: Escape or empty takes it away (CardPanel.tsx:629, :642) | `cards.ts:discardCard` → `history.ts:discardNew` | none (part of `create_card`) | Internal to make + name; an op makes the card whole in one go. |
| Name a new card: Tab makes the next of its type beside it (CardPanel.tsx:648, `makeNext` :704) | `cards.ts:addCard` | `create_card` | R7: "a step right of this one" is computed in the panel. |
| `≈ … [use that one]` while naming (CardPanel.tsx:624, `useThat`) | `cards.ts:discardCard` + `places.ts:bringIn` | `place_on` | R2: two writes; R7. |
| Card picker: typed name → new card (`CardPicker.make`, CardPanel.tsx:942; `addCard` :945, `retitleCard` :947) | `cards.ts:addCard` + `cards.ts:retitleCard` | `create_card` (then `link`/`update_task` with `$a`) | R2: up to three steps (make, name, then the pick: a link or a task's card). R3. |
| Retitle in the panel (CardPanel.tsx:612 → :645) | `cards.ts:retitleCard` | `update_card` | |
| Retitle a card row in a table (Table.tsx:406) | `cards.ts:retitleCard` | `update_card` | |
| Status pills: customer/problem/idea (CardPanel.tsx:730, `StatusSection` :725) | `cards.ts:updateCard` | `update_card` | |
| Feature plan: priority, status, impact, effort (CardPanel.tsx:569, `PlanSection` :564) | `cards.ts:updateCard` | `update_card` | |
| Package rating: impact, effort (CardPanel.tsx:497, `PackagePlan` :492) | `cards.ts:updateCard` | `update_card` | |
| Competitor profile: description, audience, pricing, url (CardPanelKinds.tsx:77) | `cards.ts:updateCard` | `update_card` | |
| Competitor regions (CardPanelKinds.tsx:78) | `cards.ts:updateCard` | `update_card` | |
| Tags: add, remove (CardPanel.tsx:1098, `TagsSection` :1093) | `cards.ts:updateCard` | `update_card` | |
| Notes (CardPanel.tsx:1141, `NotesSection` :1138) | `cards.ts:updateCard` | `update_card` | |
| `judged on` criteria: add, rename (CardPanelKinds.tsx:398, `Criteria` :394) | `cards.ts:updateCard` | `update_card` | |
| `judged on`: remove one (CardPanelKinds.tsx:415–421) | `competitorFeatures.ts:dropCriterionScores` | `delete` | R5/R7: the component builds the card write (`also`) and the cell refs (`gone`) and passes the comparisons. |
| Rename a criterion from a matrix's unfolded head (Matrix.tsx:282, `renameSub`) | `cards.ts:updateCard` | `update_card` | R7: criteria list rebuilt in the matrix. |
| Several selected: tag / untag all (CardPanel.tsx:302, `ManyInside` :261) | `cards.ts:updateCards` | `update_card` (one per card, one batch) | |
| Card deck: drop a card in a column/box (CardKanban.tsx:140) | `cards.ts:updateCards` | `update_card` | R7: `boxPatch` turns a box into field values in the component. |
| Drag a card on a plane (PlaneCards.tsx:645) | `cards.ts:moveCard` | `arrange` | |
| Drag a folded card with its parts (PlaneCards.tsx:645) | `cards.ts:moveCards` | `arrange` | R7: which parts ride along is worked out in PlaneCards. |
| Fold / unfold parts: card's `[−]/[+]` (PlaneCards.tsx:854) or right-click `fold` (planeMenu.ts:115) | `cards.ts:foldCard` | `update_card` (`folded`, per plane) | Per plane (D-281). |
| Delete one card: panel `delete` (CardPanel.tsx:215) | `cards.ts:deleteCard` | `delete` | R5: edges and places passed by the caller. |
| Delete / take off: ⌫ in focus (CanvasView.tsx:901), right-click (planeMenu.ts:123, :126), several (planeMenu.ts:85, PlaneCards.tsx:394, CardPanel.tsx:174) | `selection.ts:deleteHere` → `places.ts:removeHere` | `delete` (only here) / `take_off` | R7: `deleteHere` splits "take off" from "delete" and writes the toast; R5: edges, places, pieces passed. |
| `delete everywhere` (planeMenu.ts:54, CardPanel.tsx:207 → hazard confirm CanvasView.tsx:1214) | `cards.ts:deleteCards` | `delete` (`everywhere: true`) | R5: edges, places passed; `labels` passed as `[]`. |
| Duplicate: ⌘D (PlaneCards.tsx:418), right-click (planeMenu.ts:76, :120), panel (CardPanel.tsx:166) | `cards.ts:copyCards` | `duplicate` | R4: returns ids before the write. Copies the cards' fields (title, tags, status, plan, profile, regions, criteria, notes, folded), the links *between* copied cards, a package's members (remapped to the copies when copied with it, else the same cards), and selected text. Not copied: evidence, competitor features and matches, tasks, parts or links to cards outside the selection, places on other planes. In focus only. |
| Paste ⌘V (PlaneCards.tsx:381), `paste here` (planeMenu.ts:181) | `cards.ts:copyCards` | `duplicate` (from a list of ids, to a plane) | R7: the tab's clipboard and the `pasted` step live in selection.ts. Copy (⌘C, planeMenu.ts:70/117/139, CardPanel.tsx:165) writes nothing. |

## 2. Links

**Who / tracked:** editors only; every write tracked (undo; one step per row today, except rows marked R2).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| Draw from a card's `›` onto another (PlaneCards.tsx:678, `startLink`) | `edges.ts:createEdge` | `link` | R4: returns the id before it lands. Kind = `defaultKind`. |
| Panel section `+ customer / problem / idea / feature / link / tag a card` (CardPanel.tsx:860, `LinkSection` :853) | `edges.ts:createEdge` | `link` | R7: direction and kind chosen by the section (`add.from`, `add.kind`). R4. |
| Parts: `+` a part (CardPanelKinds.tsx:382), set a parent (:316) | `edges.ts:createEdge` (`part-of`) | `link` (kind `part-of`) | R4. |
| Rests on: `+` (CardPanelKinds.tsx:534) | `edges.ts:createEdge` (`inspired-by`) | `link` | R4. |
| Unlink: panel `×` (CardPanel.tsx:879), parts detach (CardPanelKinds.tsx:370), parent detach (:333), rests on (:498) | `edges.ts:deleteEdge` | `unlink` | |
| Remove: link bar (PlaneLinks.tsx:294), right-click (planeMenu.ts:157), ⌫ on a selected link (CanvasView.tsx:877) | `edges.ts:deleteEdge` | `unlink` | |
| Label: link bar (PlaneLinks.tsx:240); right-click `add a label` opens it (planeMenu.ts:153) | `edges.ts:updateEdge` | `update_link` | |
| Kind: link bar (PlaneLinks.tsx:256), right-click kinds (planeMenu.ts:156) | `edges.ts:updateEdge` | `update_link` | |
| Turn round: link bar (PlaneLinks.tsx:284), right-click (planeMenu.ts:154) | `edges.ts:reverseEdge` | `update_link` (`reverse: true`) | |

## 3. Evidence

**Who / tracked:** editors only; every write tracked (undo; one step per row today, except rows marked R2).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| `+ evidence` (CardPanel.tsx:758, `EvidenceSection` :738) | `evidence.ts:addEvidence` | `create_evidence` (or inside `create_card`) | |
| Edit a piece of evidence (CardPanel.tsx:776) | `evidence.ts:updateEvidence` | `update_evidence` | |
| Flip supports ↔ contradicts (CardPanel.tsx:787) | `evidence.ts:updateEvidence` | `update_evidence` | |
| Remove (CardPanel.tsx:793) | `evidence.ts:removeEvidence` | `delete` | |
| A finished task: `+ log what it taught` (TaskPanel.tsx:387, `Learned` :358) | `tasks.ts:logLearned` | `create_evidence` | One batch (evidence + the task's `learned`). |

## 4. Competitor features and matches

**Who / tracked:** editors only; every write tracked (undo; one step per row today, except rows marked R2).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| `+ feature` on a competitor, with an optional `≈ our` (CardPanelKinds.tsx:181, `NewFeature` :191) | `competitorFeatures.ts:addCompetitorFeature` | `create_competitor_feature` | |
| Edit name, description, category, offered, url (CardPanelKinds.tsx:245, `FeatureDetails` :243) | `competitorFeatures.ts:updateCompetitorFeature` | `update_competitor_feature` | |
| `≈ our` select on a feature (CardPanelKinds.tsx:269) | `competitorFeatures.ts:matchOurs` | `update_competitor_feature` | R5: comparisons passed. |
| `×` not a match, from our feature's `matched by` (CardPanelKinds.tsx:561, `MatchedBy` :544) | `competitorFeatures.ts:matchOurs` (null) | `update_competitor_feature` (`ours: null`) | R5. |
| Remove a competitor's feature (CardPanelKinds.tsx:284) | `competitorFeatures.ts:removeCompetitorFeature` | `delete` | R5: comparisons passed. |
| (none) | `competitorFeatures.ts:removeComparison` | `update_competitor_feature` (`ours: null`) | **no UI caller**. |

## 5. Places (one card on many planes)

**Who / tracked:** editors only; every write tracked (undo; one step per row today, except rows marked R2).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| `existing card…` in the `+` (WorkspaceLayout.tsx:309) or right-click (planeMenu.ts:198) → pick (BringCards.tsx:82); ↵ bring, ⇧↵ more, ⌥↵ move here | `places.ts:bringIn` | `place_on` (`move: true` for ⌥↵) | R4: returns ids and box at once. Parts and members come along. |
| Panel `PLANES` → `+ place on` (CardPanel.tsx:1062, `PlanesSection` :1039) | `places.ts:bringIn` | `place_on` | R7: "right of what's there" computed in the panel. |
| Panel `PLANES` → `×` off one plane (CardPanel.tsx:1055) | `places.ts:takeOff` | `take_off` | R5: places passed. |
| ⇧⌘V the same cards (PlaneCards.tsx:409), right-click `the same card here` (planeMenu.ts:187) | `selection.ts:pasteSame` → `places.ts:bringIn` | `place_on` | R7: clipboard and toast in selection.ts. |
| Take off this plane (see Cards: `deleteHere`) | `places.ts:removeHere` | `take_off` | |
| (inside `deletePiece`) | `places.ts:planeGoes` | none (part of `delete` of a plane) | **no UI caller**: called only by `pieces.ts:deletePiece`. |

## 6. Packages

**Who / tracked:** editors only; every write tracked (undo; one step per row today, except rows marked R2).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| Right-click `package these` (planeMenu.ts:74), panel `package these` (CardPanel.tsx:372), `+` → `package` then pick + Enter (WorkspaceLayout.tsx:304 → PackPick.tsx:22) | `selection.ts:packageThese` → `cards.ts:addPackage` | `create_package` | R7: the name (`n` = how many packages) and the spot live in selection.ts:144. R4: sync id. |
| Fold / lay out a package: band `[−]` (PlaneCards.tsx:514), card `[+] N inside` (:854), right-click (planeMenu.ts:106) | `cards.ts:foldPackage` | `update_card` (`folded`) | |
| Drag a package by its band (members move) (PlaneCards.tsx:~497 → selection.ts:128) | `labels.ts:moveMany` | `arrange` | R7: members + carried parts gathered in the view. |
| Holds: `+ card`, `×` take one out (CardPanel.tsx:519, `Holds` :512) | `cards.ts:updateCard` (`memberIds`) | `update_card` (`members`) | R7: the subtree to take out is computed in the panel. |
| Package rating (see Cards) | `cards.ts:updateCard` | `update_card` | |

## 7. Text, labels, sections, sticky notes, the project title

**Who / tracked:** editors only; every write tracked (undo; one step per row today, except rows marked R2). Except the project title's name and description: untracked (see §17).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| `+` → heading / paragraph / sticky note / project title, on the canvas or in a plane (WorkspaceLayout.tsx:262–267, `addText` :244) | `labels.ts:addLabel` | `create_text` | R1: canvas text gets the canvas on screen (`canvasField`). R3: empty text, typed after. |
| Right-click empty plane → heading / paragraph / sticky (planeMenu.ts:192–194, `text` :171) | `labels.ts:addLabel` | `create_text` | |
| `+` → section, then draw it (WorkspaceLayout.tsx:265 → DrawSection.tsx:44) | `labels.ts:addLabel` (`kind: 'section'`) | `create_text` (`kind: section`, `around: ids`) | R1. The agent gives what it goes round, never a rectangle. |
| Type a heading's text and small line (TextItems.tsx:573) | `labels.ts:updateLabel` | `update_text` | |
| Type a paragraph / sticky (TextItems.tsx:643) | `labels.ts:updateLabel` | `update_text` | |
| A new text left empty, or Escape (TextItems.tsx:566, :642, `discard` :676) | `labels.ts:discardLabel` | none (part of `create_text`) | Internal to make + type. |
| Empty heading/paragraph on leaving (TextItems.tsx:567, :642) | `labels.ts:deleteLabel` | `delete` | |
| Text bar: H1–H3 / S M L, bold, italic, caps, turn ±90, section side, colour (TextItems.tsx:868–921, `LabelBar` :862) | `labels.ts:updateLabel` | `update_text` | |
| Sticky note fold `▾` (TextItems.tsx:420) | `labels.ts:updateLabel` (`folded`) | `update_text` (`folded`) | Shared data. |
| Resize: paragraph/sticky/title width, section box (TextItems.tsx:264) | `labels.ts:updateLabel` | `resize` | |
| Drag text (TextItems.tsx:226) | `labels.ts:moveMany` | `arrange` | |
| Drag a section with what it holds (text, cards; on the canvas the pieces) (TextItems.tsx:194–231) | `labels.ts:moveMany` | `arrange` (a section carries what's inside) | R7: what's inside is computed in TextItems; on the canvas it moves pieces by their refs (spot-aware) but not what's stuck to a carried plane unless inside too (to check). |
| Delete: bar `delete` (TextItems.tsx:928), right-click (planeMenu.ts:143), ⌫ (CanvasView.tsx:865) | `labels.ts:deleteLabel` | `delete` | |
| Duplicate / paste text in a focused plane (planeMenu.ts:142, ⌘D PlaneCards.tsx:416, ⌘V :410) | `cards.ts:copyCards` (`labels`) | `duplicate` | In focus only: the keys return without `?focus=` (PlaneCards.tsx:375–416). Canvas text has no duplicate or paste in the UI (the op may offer it); `copyCards`' CANVAS branch (R1, `canvasField`) is unreachable from the UI. |
| Edit the project title: name and description (TextItems.tsx:798–799) | `workspaces.ts:renameWorkspace` + `describeWorkspace` | `rename` (workspace) + `update_workspace` | R2: two writes, **neither tracked** (no undo). |
| Right-click `edit` (planeMenu.ts:138) | none (opens typing) | `update_text` | |

## 8. Several at once (cards and text on a plane)

**Who / tracked:** editors only; every write tracked (undo; one step per row today, except rows marked R2).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| Drag the selection (selection.ts:128, `startGroupDrag`) | `labels.ts:moveMany` | `arrange` | Refs come from the view's `onPlane.items` registry (R7, R9). |
| Arrows nudge, ⇧ ×4 (PlaneCards.tsx:396–404) | `labels.ts:moveMany` | `arrange` (`by`) | R7/R9. |
| Panel: line up left/centre/right/top/middle/bottom, space out (CardPanel.tsx:280, `moveTo`/`spread`) | `labels.ts:moveMany` | `arrange` (`layout: align-left…`, `spread-x/y`) | R7: the maths is in the panel. R10. |
| Tag all, package, duplicate, delete | see Cards, Packages | `update_card`, `create_package`, `duplicate`, `delete`/`take_off` | |

## 9. Pieces

**Who / tracked:** editors only; every write tracked (undo; one step per row today, except rows marked R2).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| `+` → plane / documents / timeline (WorkspaceLayout.tsx:313, :319, :323 → `add` :269) | `pieces.ts:addPiece` | `create_piece` | R1: `canvasField()` and `nearClear` read the canvas on screen. |
| Matrix wizard → make (MatrixWizard.tsx:56) | `pieces.ts:addPiece` (`setup`, name) | `create_piece` (`kind: matrix`, setup) | R1. Name `rows × cols` made in the wizard (R7). |
| Table wizard → make (TableWizard.tsx:62) | `pieces.ts:addPiece` | `create_piece` (`kind: table`) | R1. |
| Deck wizard → make (KanbanWizard.tsx:68) | `pieces.ts:addPiece` | `create_piece` (`kind: deck`) | R1. |
| Rename in edit mode (CanvasView.tsx:1766) | `pieces.ts:renamePiece` | `rename` | |
| Move / resize in edit mode (CanvasView.tsx:1597–1680) | `pieces.ts:placePiece` | `arrange` / `resize` | R7: the followers (what's stuck, a deck's timeline) and their boxes are computed in `press`; R1: `posRef`/`spotted` read the module's spots. |
| Move a matrix/table/deck/timeline near a plane's edge: sticks (CanvasView.tsx:1638–1666) | `pieces.ts:placeLens` | `arrange` + `update_piece` (`stuck_to`) | R7: `stickTarget` only runs in the drag. |
| Console `⇆ 01 Pazar ▾`: link / unlink (CanvasView.tsx:1862) | `pieces.ts:linkLens` | `update_piece` (`stuck_to: plane or null`) | |
| Edit mode `[unframe]` / `[frame]` (CanvasView.tsx:1864) | `pieces.ts:openPiece` | `update_piece` (`framed`) | Shared (`open`). |
| Delete (hazard confirm CanvasView.tsx:1260; from console :1854, ⌫ in edit mode :918, right-click `delete everywhere` :545, MoveToCanvas.tsx:165) | `pieces.ts:deletePiece` | `delete` | R5: seven lists passed (cards, labels, cells, edges, tasks, places, spots). |
| `only from here` / `take it off this canvas` (CanvasView.tsx:544, :1222; MoveToCanvas.tsx:164) | `canvases.ts:takeOffCanvas` (via `MoveToCanvas.tsx:takeOffHere`) | `take_off` | R5: spots passed; toast in the component. |
| Documents list setup: sort by a head, kinds, page size, table/shelf (Documents.tsx:420, :567, :577, :583) | `pieces.ts:setDocumentsSetup` | `update_documents_list` | Shared on the piece. |
| Place a document on the canvas (see Documents) | `pieces.ts:placeDocument` | `create_piece` (`kind: document`) | |
| (none) | `canvases.ts:setShownHere` | none | Module state for `nearClear` (R1), not a write; goes away with R1. |

## 10. Canvases and spots

**Who / tracked:** editors only; every write tracked (undo; one step per row today, except rows marked R2).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| Breadcrumb prompt: `new canvas` / make "…" (CanvasSwitch.tsx:36) | `canvases.ts:addCanvas` | `create_canvas` | |
| Rename (CanvasSwitch.tsx:71) | `canvases.ts:renameCanvas` | `rename` | |
| Move it up / down (CanvasSwitch.tsx:57–58) | `canvases.ts:moveCanvas` | `move_canvas` | |
| Delete a canvas (CanvasSwitch.tsx:133) | `canvases.ts:deleteCanvas` | `delete` (canvas) | R5: the whole content passed (`now()`). The first canvas never goes. |
| `move to canvas…` (right-click CanvasView.tsx:529, console `onMove` :1857) → MoveToCanvas.tsx:89 | `canvases.ts:moveToCanvas` | `move_to_canvas` | R7: what goes along (stuck pieces, what a section holds) is worked out in MoveToCanvas.go; R5. |
| `also on canvas…` (CanvasView.tsx:541, console :1858, MoveToCanvas.tsx:163) → MoveToCanvas.tsx:73 | `canvases.ts:alsoOnCanvas` | `place_on` | R7 as above. |
| A new canvas typed in the move prompt (MoveToCanvas.tsx:111) | `canvases.ts:addCanvas` then move | `create_canvas` + `move_to_canvas` (`$a`) | R2: two steps. |
| Take off this canvas | `canvases.ts:takeOffCanvas` | `take_off` | See Pieces. |
| (none) | `canvases.ts:setCanvasHere` (WorkspaceLayout.tsx:166) | none | R1: the module global itself; removed by R1. |

## 11. Matrix

**Who / tracked:** editors only; every write tracked (undo; one step per row today, except rows marked R2).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| Cell: click steps, 1–9, Backspace, `-`, typed number/text (Matrix.tsx:196–305) | `matrix.ts:setCell` | `update_cell` (by axis names) | |
| Cell bar: step, clear, `—` doesn't apply, `~ ?` confidence, note (Matrix.tsx:1033–1077) | `matrix.ts:setCell` | `update_cell` | |
| Dashed card: add a typed name (Matrix.tsx:737) | `matrix.ts:addNamed` | `axis_add` (row/col, a name) | S7: op. |
| Dashed card: add a card (Matrix.tsx:749) | `matrix.ts:addCardEntry` | `axis_add` (row/col, a card) | S7: op. |
| Head `×`: hide a card / drop a name with its cells (Matrix.tsx:271) | `matrix.ts:removeEntry` | `axis_remove` | R5 solved (S7): the op reads the cells from the snapshot; the list passed is ignored. |
| Head rename (typed name) (Matrix.tsx:378) | `matrix.ts:renameEntry` | `axis_update` (name) | Unfolded criteria: `update_card` (Cards). |
| Unfold / fold a card's criteria (Matrix.tsx:278) | `matrix.ts:setOpen` | `update_matrix` | |
| Setup: rows/cols axis (type, plane, by hand, called, unfold), cells (kind, steps, unit), options (`—`, guesses, totals) (MatrixSetup.tsx:56) | `matrix.ts:setPart` | `update_matrix` | R7 mostly solved (S7): an axis whose only change is one entry added goes through `axis_add` (entries someone else added since left aside); other parts are still written whole as the editors give them. |
| Setup: take a hand-added item out (MatrixSetup.tsx:60) | `matrix.ts:removeEntry` | `axis_remove` | R5 solved (S7). |
| Setup: `start over from` a template (MatrixSetup.tsx:61) | `matrix.ts:setSetup` | `update_matrix` (template) | |
| (none) | `Matrix.tsx:addCard` (export, :1087) → `matrix.ts:addCardEntry` | `axis_add` | **no caller** (dead export in a view). |

## 12. Table

**Who / tracked:** editors only; every write tracked (undo; one step per row today, except rows marked R2).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| Cell: click steps / flips, 1–9, Backspace, Enter, typed (Table.tsx:223–308, :403) | `matrix.ts:setCell` | `update_cell` | |
| `+` named row (Table.tsx:450) | `table.ts:addNamedRow` | `axis_add` (rows, a name) | S7: op. |
| Rename a row (typed name) (Table.tsx:407) | `table.ts:renameRow` | `axis_update` (rows, name) | A card row: `update_card` (Cards). |
| Row `×` (Table.tsx:409), setup take out (TableSetup.tsx:85) | `table.ts:removeRow` | `axis_remove` (rows) | R5 solved (S7): cells read from the snapshot. |
| Head click sorts (Table.tsx:323) | `table.ts:setTablePart` (`sort`) | `update_table` | Shared. |
| Column width drag / reset (Table.tsx:487, :489) | `table.ts:setColumnWidth` | `axis_update` (cols, `width`) | |
| Page size (Table.tsx:812; setup view TableSetup.tsx:332) | `table.ts:setTablePart` (`pageSize`) | `update_table` | Shared; the page you're on is yours. |
| Setup rows: rules, cards on/off, by hand, bring back (TableSetup.tsx:102–150) | `table.ts:setTablePart` (`rows`) | `update_table` (`rules`, `manual`, `bring_back`) / `axis_add` (a card or name) | R7 partly solved (S7): one row added (rows someone else added since left aside) goes through `axis_add`; rule edits and bring back still rewrite `rows` whole. |
| Setup columns: field on/off, own column (scale, number, text, check), rename, kind, unit, steps, move left/right (TableSetup.tsx:222–310) | `table.ts:setTablePart` (`cols`) | `axis_add` (cols), `axis_update` (name, kind, unit, steps, width, move) | R7 solved for one change (S7): the editor's list is compared with what's there now, columns someone else added since left aside (`editorChange`), and one add, edit or move goes through the axis op; a removal is never guessed (real removes are `removeColumn`). Anything else is still written whole, and can still lose a concurrent edit. |
| Setup column `×` (TableSetup.tsx:88) | `table.ts:removeColumn` | `axis_remove` (cols) | R5 solved (S7): cells and the sort read from the snapshot. |
| Setup sort (TableSetup.tsx:342, :351) | `table.ts:setTablePart` (`sort`) | `update_table` | |
| Setup `start over from` a template (TableSetup.tsx:60) | `table.ts:setTable` | `update_table` (template) | |
| (none) | `table.ts:setRows` | `update_table` / `axis_add` | Called only inside table.ts (= `setTablePart('rows')`). |
| (none) | `table.ts:addCardRow` | `axis_add` (rows, a card) | Used now: the op behind a row added in the setup (S7). |
| (none) | `table.ts:addColumn` | `axis_add` (cols) | Used now: the op behind a column added in the setup (S7). |
| (none) | `table.ts:editColumn` | `axis_update` (cols) | Used now: the op behind a column edited in the setup (S7). |
| (none) | `table.ts:moveColumn` | `axis_update` (cols, move) | Used now: the op behind a column moved in the setup (S7). |

## 13. Decks (kanban) and tasks

**Who / tracked:** editors only; every write tracked (undo; one step per row today, except rows marked R2).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| `+ task` typed at a column's foot (Kanban.tsx:505, `add` :499) | `tasks.ts:addTask` | `create_task` | R4: sync id. R7: order and the lane's field set in the component. |
| A card's panel `+ task` / `+ test it` (CardTasks.tsx:54, `make` :48; `testIt` :56) | `tasks.ts:addTask` | `create_task` (`card`) | R7: which deck (last used), first column, order; the `Test:` title. |
| Drag tasks between columns / lanes (Kanban.tsx:411) | `tasks.ts:moveTasks` | `move_task` | R7: order maths and lane patch (person/card) in the component. |
| Task panel: column select (TaskPanel.tsx:263) | `tasks.ts:moveTask` | `move_task` | |
| Several: move to a column (TaskPanel.tsx:190) | `tasks.ts:moveTasks` | `move_task` | |
| Title (TaskPanel.tsx:152) | `tasks.ts:updateTask` | `update_task` | |
| Given to (TaskPanel.tsx:298); several (TaskPanel.tsx:215) | `tasks.ts:updateTask` / `updateTasks` | `update_task` | |
| First day, due day, clear (TaskPanel.tsx:312–313, :340); several due / clear (:227, :231) | `tasks.ts:updateTask` / `updateTasks` | `update_task` | |
| Priority P1–P3 (TaskPanel.tsx:407) | `tasks.ts:updateTask` | `update_task` | |
| Labels (TaskPanel.tsx:418) | `tasks.ts:updateTask` | `update_task` | |
| Its card: pick (TaskPanel.tsx:528), let go `×` (:512) | `tasks.ts:updateTask` | `update_task` | |
| Checklist: add, tick, rename, remove (TaskPanel.tsx:545, `Checklist` :539) | `tasks.ts:setChecks` | `update_task` (`checks`) | |
| Notes (TaskPanel.tsx:635) | `tasks.ts:updateTask` | `update_task` | |
| `not now` (don't log) (TaskPanel.tsx:393) | `tasks.ts:updateTask` (`learned: skip`) | `update_task` | |
| Log what it taught (TaskPanel.tsx:387) | `tasks.ts:logLearned` | `create_evidence` | See Evidence. |
| Delete: panel (TaskPanel.tsx:132) | `tasks.ts:deleteTask` | `delete` | |
| Delete several: panel (TaskPanel.tsx:99), ⌫ on the deck (Kanban.tsx:348) | `tasks.ts:deleteTasks` | `delete` | |
| Column: add, rename (double-click), move `‹ ›`, limit, mark finished `✓` (Kanban.tsx:488–553) | `tasks.ts:setKanbanCols` | `create_deck_column`, `rename`, `move_deck_column`, `update_deck_column` (limit, done) | R7: the whole columns array rewritten from the component. |
| Column `×` with its tasks (Kanban.tsx:546) | `tasks.ts:deleteColumn` | `delete` | R5: tasks passed. |
| `[LANES ▾]` by person / card / none (Kanban.tsx:726–727) | `tasks.ts:setKanbanRows` | `update_deck` (`lanes`) | |
| Card deck: rows by a field / none (Kanban.tsx:718–719; setup KanbanSetup.tsx:130) | `tasks.ts:setKanbanSetup` (`rowField`) | `update_deck` | |
| Setup: holds tasks/cards, which cards (rules), columns from, box names (KanbanSetup.tsx:44 via `KanbanEditor` :78) | `tasks.ts:setKanbanSetup` | `update_deck` | |
| Switch to cards with tasks on it: `[move the tasks to ▾]` (KanbanSetup.tsx:162, `moveTo` :151) | `tasks.ts:moveTasksAway` | `update_deck` (`move_tasks_to: deck`) | R7: column matching by name and order in the component. |
| … `[make a new deck for cards]` (KanbanSetup.tsx:170, `makeNew` :166) | `pieces.ts:addPiece` | `create_piece` (`kind: deck`, holds cards) | R7, R2: new deck then open its setup; R1. |
| `[hold tasks again]` (KanbanSetup.tsx:211) | `tasks.ts:setKanbanSetup` (`holds`) | `update_deck` | |
| Lane fold, `SOON` fold (Kanban.tsx:271; localStorage) | none | none (view) | Yours, per browser. |

## 14. Timeline

**Who / tracked:** editors only; every write tracked (undo; one step per row today, except rows marked R2).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| Draw days `+` → card prompt → make (Timeline.tsx:621, `make` :608) | `tasks.ts:addTask` | `create_task` (`start`, `due`, `card`) | R7: which deck (`deckFor(row)`) and first unfinished column in the component; R4. |
| Drag a task's bar, or its first/due edge (Timeline.tsx:449) | `tasks.ts:updateTask` | `update_task` (days; row's person/card) | |
| Drag from the no-day tray onto a day (Timeline.tsx:656) | `tasks.ts:updateTask` | `update_task` | |
| `rows` by deck / person / card (Timeline.tsx:1064, `TimelineRowsMenu`) | `tasks.ts:setTimeline` | `update_timeline` | Shared. Scale, position, overview are yours (view). |

## 15. Documents

**Who / tracked:** rename, share/unshare: the document's author only; delete: its author, or an owner for a shared one; upload: anyone, viewers too (a viewer writes only their own documents); place on the canvas: editors. Tracked.

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| `[upload]` (Documents.tsx:497–506), files dropped on a list or the canvas (CanvasView.tsx:604–614) | `Documents.tsx:uploadFiles` → `documents.ts:uploadMarkdown` | `create_document` (later, §4.4) | R7: refusal and progress in the view. `.md` only until Storage. |
| Rename (Documents.tsx:372; row :341, right-click CanvasView.tsx:562) | `documents.ts:renameDocument` | `rename` (document) | Author only. |
| Share / unshare (row Documents.tsx:346, right-click CanvasView.tsx:563, dock DocumentPiece.tsx:282 → `shareOrAsk` Documents.tsx:81) | `documents.ts:shareDocument` | `update_document` | Author only. |
| Unshare one that's on the canvas (confirm CanvasView.tsx:1181) | `documents.ts:unshareDocument` | `update_document` (`shared: false`) | R5: piece and spot refs passed. |
| Delete (confirm CanvasView.tsx:1196; from row :359, right-click :565, dock DocumentPiece.tsx:285) | `documents.ts:deleteDocument` | `delete` (document) | R5: piece and spot refs passed. |
| Place on the canvas (row Documents.tsx:351, right-click CanvasView.tsx:560, dock DocumentPiece.tsx:283, dragged out CanvasView.tsx:~593 → DocumentPiece.tsx:392) | `pieces.ts:placeDocument` | `create_piece` (`kind: document`) | R1. Shares a private one in the same write. |
| Download .md (Documents.tsx:355, DocumentPiece.tsx:284, CanvasView.tsx:564) | `documents.ts:downloadDocument` | none (a read: `read_document`) | Writes nothing. |
| (automatic on open, CanvasView.tsx:622) | `documents.ts:moveReports` | none | One-time move of 1.0 reports; no person action. |

## 16. Comments and threads

**Who / tracked:** anyone, viewers too, on their own messages; a thread is deleted by its author or an owner. **Untracked** (no undo; can't join a preview's undo step).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| Right-click `comment` (CanvasView.tsx:510), panel `comment` (CardPanel.tsx:198) → first message (Threads.tsx:191) | `threads.ts:startThread` | `create_thread` (later, §4.4) | Not tracked by design (no undo). |
| Reply (Threads.tsx:190) | `threads.ts:reply` | `create_message` | |
| Edit a message (Threads.tsx:210) | `threads.ts:editMessage` | `update_message` | |
| Delete a message (Threads.tsx:309) | `threads.ts:deleteMessage` | `delete` | |
| Resolve / reopen (Threads.tsx:275) | `threads.ts:setResolved` | `update_thread` | |
| Delete a thread (Threads.tsx:280) | `threads.ts:deleteThread` | `delete` | |
| Open is read; `mark all read` (Threads.tsx:162, ThreadInbox.tsx:181) | `threads.ts:markSeen` | none | Your read marker, not content. |
| Opening the tasks side view (TasksSide.tsx:310) | `threads.ts:markTasksSeen` | none | Your read marker. |

## 17. Workspace meta

**Who / tracked:** editors. **Untracked** (no undo, no read-only check; can't join a preview's undo step).

| UI action (where) | Today: data fn (file) | Op | Notes |
|---|---|---|---|
| Settings → general → name (WorkspaceLayout.tsx:358); workspaces page rename (src/views/workspaces/Workspaces.tsx:129) | `workspaces.ts:renameWorkspace` | `rename` (workspace) | **Not tracked** (no undo, no read-only check). |
| Settings → general → what we're building (WorkspaceLayout.tsx:370) | `workspaces.ts:describeWorkspace` | `update_workspace` | **Not tracked**. |
| Project title on the canvas | see §7 | `rename` + `update_workspace` | |

---

## Out of scope (never an op)

**Never, by the parity rule (§4.10):**

| What | Data fn (file) | Where |
|---|---|---|
| Sign in / out | `auth.ts:signInWithGoogle`, `signInAsTestUser`, `signOut` | landing, Settings |
| Make, import a workspace | `workspaces.ts:createWorkspace`, `importWorkspace.ts:importWorkspace` | src/views/workspaces/Workspaces.tsx:242, :398 |
| Export the workspace | `exportWorkspace.ts:exportWorkspace` | WorkspaceLayout.tsx:395 (a read; maybe a read tool later, never a `change` op) |
| Join requests | `workspaces.ts:requestToJoin`, `withdrawJoinRequest`, `approveJoinRequest`, `denyJoinRequest` | Workspaces.tsx:284, :371; PeopleSettings.tsx:64, :67 |
| Members and roles | `workspaces.ts:ensureMemberEntry`, `setRole`, `removeMember` | WorkspaceLayout.tsx:102; PeopleSettings.tsx:122, :137 |
| Invite codes and emails | `workspaces.ts:renewInviteCode`, `inviteEmail`, `uninviteEmail`, `acceptInvite`, `declineInvite` | PeopleSettings.tsx:217, :236, :265; Workspaces.tsx:354, :360 |
| Keys | (functions/ `setWorkspaceKey`; own keys in browser storage) | none in the client today |
| Delete / leave a workspace | `workspaces.ts:deleteWorkspace`, `leaveWorkspace` | Workspaces.tsx:136 |

**Not content (no op; internal or yours):**

| What | Data fn (file) | Why |
|---|---|---|
| Undo / redo (useEditKeys.ts:20–23) | `history.ts:undo`, `redo` | The person's; the agent's batch is one step they can undo. |
| Read-only while previewing (WorkspaceLayout.tsx:107–108) | `history.ts:setReadOnly` | The preview's own lock (§4.5). |
| Make + name helpers | `history.ts:discardNew`, `cards.ts:discardCard`, `labels.ts:discardLabel` | Internal to create + name; ops create whole things. |
| Presence session (WorkspaceLayout.tsx:111) | `presence.ts:usePresenceSession` | Writes your presence node and its onDisconnect; live state, not content. |
| Batch helper | `places.ts:runOps` (`export const runOps = commit`, places.ts:234) | Internal, **no UI caller** (used by `deletePiece`): the R2 plan + apply pattern to grow from. |
| Presence | `presence.ts:setCursor`, `setPresencePlane`, `setPresenceSelection`, `setPresenceDrag`, `setPresenceTasks` | Live state in RTDB (collab.tsx, MyTasks.tsx). |
| Read markers | `threads.ts:markSeen`, `markTasksSeen` | Yours. |
| Canvas on screen | `canvases.ts:setCanvasHere`, `setShownHere` | R1 module state; removed by R1. |
| 1.0 reports move | `documents.ts:moveReports` | Automatic, once. |
| Display (theme, motion, background) | localStorage, `src/ui/Settings.tsx` | Yours, per browser. |

**View state → UI tools (§4.4: never write data):**

| Person's action (where) | UI tool |
|---|---|
| Finder ⌘F / compass, Enter or double-click (Finder.tsx); a link row or `PLANES` row in a panel (CardPanel.tsx:874, :1069); `[on the canvas ↗]` in threads (CanvasView.tsx:629 `goTo`); a timeline task's go | `go_to(id)` |
| Canvas switch in the breadcrumb, ⌥1–⌥9 (CanvasSwitch.tsx:26) | `go_to(canvas)` |
| Pan, zoom, fit `0` (CanvasView.tsx:852) | `go_to` (the app frames it; never coordinates) |
| `[focus]`, double-click a plane, `[unfocus]` / Esc (CanvasView.tsx:931, FocusDock.tsx) | `focus(plane)` / `focus(null)` |
| Click, shift+click, alt+box, Escape (selection.ts), deck task picks (Kanban.tsx:484), matrix/table cell picks | `select(ids)` |
| Right-click `open` (planeMenu.ts:101), a matrix/table head click (D-247), a task click, `+` threads list | `open_panel(id)` |
| Plane dock `[⇆ kind · name]` (D-211), documents `open beside` (CanvasView.tsx:556), tasks side view `t` and its icon, `[days ›]`, a plane's `⇆ deck` (TasksSide.tsx) | `show_beside(piece)` |
| `[filter]` on a plane (FilterDock.tsx) or a deck (KanbanFilterDock.tsx): passing, per tab (D-308) | none: the agent reads with `query` instead |
| `[view ▾]`: snap `g`, guides `a`, comments `c` (ViewMenu.tsx:16–21) | none |
| Edit mode on/off (console `[edit]`, `[done]`) | none: ops don't need edit mode |
| `[setup]` open, its tab (MatrixSetup.tsx:67, TableSetup.tsx:66, KanbanSetup.tsx:62) | none: `update_matrix`/`update_table`/`update_deck` write directly |
| Table page `‹ 2 / 5 ›` (yours), documents page, document zoom (DocumentPiece.tsx:52–56) | none |
| Timeline scale, sideways position, overview; lane and `SOON` folds | none |
| ⌘C copy (tab clipboard) | none: `duplicate` takes ids |

---

## Summary

### Rows per group

| Group | Rows | Without a UI caller |
|---|---|---|
| 1. Cards | 29 | 0 |
| 2. Links | 9 | 0 |
| 3. Evidence | 5 | 0 |
| 4. Competitor features and matches | 6 | 1 (`removeComparison`) |
| 5. Places | 6 | 1 (`planeGoes`, internal) |
| 6. Packages | 5 | 0 |
| 7. Text, labels, sections, stickies, title | 16 | 0 |
| 8. Several at once | 4 | 0 |
| 9. Pieces | 14 | 1 (`setShownHere`, not a write) |
| 10. Canvases and spots | 9 | 1 (`setCanvasHere`, not a write) |
| 11. Matrix | 11 | 1 (`Matrix.tsx:addCard`) |
| 12. Table | 17 | 5 (`setRows`, `addCardRow`, `addColumn`, `editColumn`, `moveColumn`) |
| 13. Decks and tasks | 26 | 0 |
| 14. Timeline | 4 | 0 |
| 15. Documents | 8 | 0 |
| 16. Comments and threads | 8 | 0 |
| 17. Workspace meta | 3 | 0 |
| **Total** | **180** | **10** |

### The ops (deduplicated, alphabetical)

**Naming rule.** `create_*` makes a new thing and returns its `$id`; `update_*` changes fields of a thing that exists;
`delete` removes anything that has an id (cards, text, links, tasks, pieces, canvases, documents, evidence, competitor
features, criteria, deck and table columns, typed table rows, threads, messages); it always asks and reads its own
cascade. Named exceptions, because they mean something else: `link` / `unlink` (a link between two cards), `place_on`
/ `take_off` (the same card on another plane, or the same piece on another canvas: nothing is made or deleted),
`axis_add` / `axis_remove` / `axis_update` (a matrix's rows and columns, a table's rows and columns: a card brought
by the type or rules is hidden, not deleted; a typed entry goes with its cells; typed names renamed here), `rename` (the
name of anything: piece, canvas, document, workspace, deck column; a card's title is `update_card`), `move_*` (order or container, not position), `arrange` / `resize` (where things are and how big,
laid out by the app, never coordinates), `duplicate` (copies).

**Decks.** The model only ever sees `deck`: `create_piece(kind: deck)`, `update_deck`, `create_deck_column`,
`move_deck_column`, `update_deck_column`. Inside the ops this maps to `kind: 'kanban'` and `tasks.ts`, as the code and
data keep calling it (D-301).

| Op | Sketch |
|---|---|
| `axis_add` | `(matrix or table, rows or cols, card or name or column: {field} or {name, kind, unit?, steps?}) → $id`: a hidden card of the type (or rules) comes back |
| `axis_remove` | `(matrix or table, rows or cols, entry: key or name)`: a card the type or rules bring is hidden (cells kept); one added by hand, or a table column, goes with its cells |
| `axis_update` | `(matrix or table, rows or cols, entry, {name?; columns: kind?, unit?, steps?, width?, move?: left or right})` |
| `arrange` | `(items, layout: near or align-left/centre/right/top/middle/bottom or spread-x/y or grid or by:[dx,dy], where?)`: positions only; carries folded parts, package members, section contents, stuck pieces |
| `create_canvas` | `(name) → $id` |
| `create_card` | `(type, plane, title, fields?, links?, parts?, evidence?, near?) → $id` (one undo step with its name) |
| `create_competitor_feature` | `(competitor, {name, description?, category?, availability?, url?}, ours?) → $id` |
| `create_deck_column` | `(deck, name, limit?, done?) → $id` |
| `create_document` | `(title, markdown) → $id` (later, §4.4's `write_document`) |
| `create_evidence` | `(card, {kind, text, stance, source?, date?, url?}, from_task?) → $id`: with `from_task`, the task is marked learned (today's `logLearned`) |
| `create_message` | `(thread, text, mentions?) → $id` (later; a reply) |
| `create_package` | `(cards, name?) → $id` |
| `create_piece` | `(kind: plane or matrix or table or deck or timeline or documents or document, name?, matrix?: {template?, rows?/cols?: {type?, plane?, cards?, names?, noun?, unfold?}, cell?, scale? or steps?, unit?, not_relevant?, confidence?, totals?, totals_at?, totals_as?, marks?}, table?: {template?, rules?, manual?, cards?, names?, columns?, sort?, page_size?}, setup? (deck, timeline, documents), stuck_to?, doc?, canvas, near?) → $id` |
| `create_task` | `(deck, title, column?, card?, assignee?, start?, due?, priority?, labels?, checks?, before? or after?) → $id` |
| `create_text` | `(where: plane or canvas, {kind: heading or paragraph or sticky or section or title, text, size?, colour?}, near? or around?: ids) → $id` |
| `create_thread` | `(on: id, text, mentions?) → $id` (later; §4.4's `comment`) |
| `delete` | `(ids, everywhere?)`: see the rule; always asks |
| `duplicate` | `(ids, to: plane, by?)`: copies, not the same cards (see §1 for what is copied) |
| `link` | `(from, to, kind?, label?) → $id` |
| `move_canvas` | `(canvas, up or down)` |
| `move_deck_column` | `(deck, column, left or right)` |
| `move_task` | `(tasks, column, deck?, lane?, before? or after?)` |
| `move_to_canvas` | `(pieces and text, canvas)`: with what's stuck and what a section holds |
| `place_on` | `(cards, plane, move?, near?)` or `(pieces, canvas)`: the same thing in one more place, with parts, members, what's stuck |
| `rename` | `(id, name)` |
| `resize` | `(id, size)`: piece, section, paragraph/sticky/title width |
| `take_off` | `(cards, plane)` or `(piece, canvas)`: off one place, still on the others |
| `unlink` | `(link)` |
| `update_card` | `(card, {title?, status/validation?, priority?, impact?, effort?, tags?, notes?, regions?, profile fields?, criteria?, members?, folded? (per plane)})` |
| `update_cell` | `(matrix or table, row: key or name, col: key or name, {value?, note?, not_relevant?, confidence?} or clear)`: names are a card's title, a typed name, `Feature › criterion`, a column's name; unclear → refused with the candidates |
| `update_competitor_feature` | `(feature, {name?, description?, category?, availability?, url?, ours?: feature or null})` |
| `update_deck` | `(deck, {holds?, source?, colField?, rowField?, names?, lanes?, move_tasks_to?: deck or new_deck})`: D-300's question decided by the op |
| `update_deck_column` | `(deck, column, {limit?, done?})` |
| `update_document` | `(document, {shared})` |
| `update_documents_list` | `(piece, {sort?, kinds?, pageSize?, view?})` |
| `update_evidence` | `(evidence, fields)` |
| `update_link` | `(link, {kind?, label?, reverse?})` |
| `update_matrix` | `(matrix, {template?, name?, cell?, scale? or steps?, unit?, not_relevant?, confidence?, totals?, totals_at?, totals_as?, marks?, rows?/cols?: {type?, plane?, noun?, unfold?, open?, fold?, bring_back?}})` |
| `update_message` | `(thread, message, text)` (later) |
| `update_piece` | `(piece, {stuck_to?, framed?})` |
| `update_table` | `(table, {template?, name?, rules?, manual?, sort?, page_size?, bring_back?})` |
| `update_task` | `(task, {title?, assignee?, start?, due?, priority?, labels?, card?, checks?, notes?, learned?})` |
| `update_text` | `(text, {text?, kicker?, size?, scale?, bold?, italic?, caps?, rotate?, side?, colour?, folded?})` |
| `update_thread` | `(thread, {resolved})` (later) |
| `update_timeline` | `(timeline, {rows})` |
| `update_workspace` | `({description})` (the name goes through `rename`) |

46 ops (S7 merged the six matrix/table entry ops into `axis_add` / `axis_remove` / `axis_update`). Five are for later
rows (`create_thread`, `create_message`, `update_message`, `update_thread`, `create_document`); the other 41 cover what a person can do today. §4.4's first set maps as: `create_card`,
`update_card`, `link`, `unlink`, `edit_link` → `update_link`, `place_on`, `take_off`, `create_piece`, `set_cell` →
`update_cell`, `table_*` → `axis_add`, `axis_remove`, `axis_update`, `update_table`, `delete`; `create_task`, `update_task`, `move_task`, `add_text` → `create_text`,
`package` → `create_package`, `arrange`, `rename`, `delete`.

### Gaps found (no clean data function, or the logic sits in a component)

1. **Make + name is two writes** (R2, R3): `addCard` writes an empty card, `retitleCard(fresh)` names it, `discardCard`
   takes it back. The card picker's "new card" is three steps (make, name, link or task). `≈ use that one` is
   `discardCard` + `bringIn`. Text is the same (`addLabel` + `updateLabel(fresh)` / `discardLabel`).
2. **Where new things land is in components** (R7, R10): `addHere` (view's middle), `makeNext` (a step right),
   `PlanesSection.placeOn` (right of what's there), `CardPicker.make` (under this card), `packageThese` (top-left of
   the members), wizards (screen middle).
3. **Package these** (R7, R4): the name number and spot are in `selection.ts:144`; `addPackage` returns its id before
   the write.
4. **Delete on a plane** (R7, R5): `selection.ts:deleteHere` decides "take off" vs "delete" and writes the toast;
   `deleteCard`, `deleteCards`, `removeHere` take edges, places (and labels) from the caller.
5. **Deleting a piece takes seven lists** (R5): `deletePiece(cards, labels, cells, kind, edges, tasks, places, spots)`;
   `deleteCanvas` takes the whole content; `deleteColumn` takes tasks; `removeEntry`/`removeRow`/`removeColumn` take
   cells; `matchOurs`/`removeCompetitorFeature` take comparisons; `unshareDocument`/`deleteDocument` take piece and
   spot refs.
6. **Removing a criterion** (R5, R7): `CardPanelKinds.tsx:415` builds the card write and the cell refs itself and hands
   them to `dropCriterionScores`. **Solved (S7):** taking a criterion off a feature is `update_card` with its criteria;
   the op deletes its matrix cells and comparison scores from the snapshot, and the passed batch and refs are ignored.
7. **Moving a plane carries its followers** (R7, R1): the followers and their boxes are computed in
   `CanvasView.tsx` `press` (~1611–1631); `stickTarget` only runs inside the drag; `placePiece` uses `posRef`/`spotted`,
   the module's spots.
8. **A section carries what's inside it** (R7): `TextItems.tsx:194–197` finds the text, cards and pieces inside and
   moves them by ref with `moveMany`; pieces stuck to a carried plane come only if inside too (to check).
9. **Moves from the view's registry** (R7, R9): group drag, nudges, a package's band and line up / space out all read
   refs and boxes from `onPlane` (selection.ts) or compute them in CardPanel; a folded card's parts ride along by
   PlaneCards' own list.
10. **Copy and paste** (R4, R1, R7): `copyCards` returns ids at once; canvas text copies take the canvas on screen; the
    clipboard and the paste offset live in `selection.ts`.
11. **Fire and forget** (R4): `createEdge`, `copyCards`, `addPackage`, `bringIn`, `addTask` return before the write lands.
12. **The canvas on screen** (R1): `addPiece` (`canvasField`, `nearClear`), `addLabel` and `copyCards` (canvas text),
    `placeDocument`, `placePiece`/`moveMany` refs through `posRef`.
13. **Task order and lanes** (R7): `orderBetween`, "after the last in that column" and the lane's field patch are
    computed in Kanban.tsx, TaskPanel.tsx, CardTasks.tsx and Timeline.tsx, four times.
14. **Which deck a new task goes to** (R7): CardTasks remembers the last deck in a module variable; Timeline's
    `deckFor(row)` and "first unfinished column" are in the component.
15. **Deck: move tasks or new deck** (R7, R2): `KanbanSetup.tsx:151–171` matches columns by name, orders the tasks,
    and for a new deck makes it then opens its setup.
16. **Whole-array rewrites from components** (R7): deck columns (`setKanbanCols`), matrix parts (`setPart`), table
    `rows`/`cols` (`setTablePart`) are rebuilt by the editors and written whole; two people editing at once lose one
    edit. **Matrix and table partly solved (S7):** one add, edit or move in the editor's list goes through the axis ops,
    with what someone else added since left aside; anything else is still written whole (decks: S8).
17. **Unused data functions**: `table.ts:addCardRow`, `addColumn`, `editColumn` (only via `setColumnWidth`),
    `moveColumn`, `setRows` (internal); `competitorFeatures.ts:removeComparison`; `places.ts:planeGoes` (internal to
    `deletePiece`); the view export `Matrix.tsx:addCard`. The table's setup does the same work through
    `setTablePart('cols')`: the ops should use one path. **S7:** `addCardRow`, `addColumn`, `editColumn`, `moveColumn`
    are the same ops (`axis_add`, `axis_update`) that the setup's one-change writes use now.
18. **Moving to a canvas** (R7, R2): what goes along (stuck pieces, what a section holds wholly) is worked out in
    `MoveToCanvas.tsx` `go`; a canvas typed in the prompt is made first, then the move: two steps.
19. **Workspace name and description aren't tracked**: `renameWorkspace`/`describeWorkspace` write directly (no undo,
    no read-only check during a preview); the project title writes both, two writes.
20. **Uploading** (R7): `Documents.tsx:uploadFiles` holds the refusal check and progress; only `.md` until Storage.
21. **Threads aren't tracked** (by design): comments have no undo, so the agent's `create_thread` can't be in a preview's
    one undo step; it needs its own rule (Phase 5 or later).
22. **Card deck drops** (R7): `CardKanban.tsx` `boxPatch` turns a box into field values in the component.

### How completeness was checked

```sh
# 1. Every exported function in src/data/ (then the write ones listed by hand):
for f in src/data/*.ts; do grep -nE '^export (async )?function|^export const [a-zA-Z]+ = (async )?\(' $f; done

# 2. Each write function's callers outside src/data/ (fns.txt = the 125 write-function names):
for f in $(cat fns.txt); do echo "## $f"; grep -rnw "$f" src --exclude-dir=data | grep -v ':import'; done

# 3. Writes outside src/data/ (expect none but imports):
grep -rln -e "tracked(" -e setDoc -e updateDoc -e writeBatch -e deleteDoc src | grep -v '^src/data/'

# 4. Every file importing from src/data/ (non-type imports), each read for handlers:
grep -rn "from '[./]*data/[a-zA-Z]*'" src | grep -v '^src/data/' | grep -v "import type" | awk -F: '{print $1}' | sort | uniq -c
```

---

## Notes for S3–S8 (from the review)

- **Merge same-shaped ops**, toward ~35: one `setup(piece, patch)` for `update_matrix`, `update_table`,
  `update_deck`, `update_timeline`, `update_documents_list`, `update_piece`; one `axis_add` / `axis_remove` /
  `axis_rename` for matrix entries, table rows and table columns; one `rename` for everything named.
- **Typed short ids** for evidence, competitor features, deck columns and checklist items (like `c12`, `t40`), so
  `delete` and `update_*` cover them instead of special ops.
- **Ops that skills need with no UI action today:** `merge_cards` (for `/dedupe`: links, evidence, places kept),
  `arrange` grid and cluster layouts (for `/organize`, `/sort-stickies`), changing a card's type.
- **The read layer must expose members** (name → uid) for task assignees and `@` mentions.
- **`create_task` and `move_task` take `before` / `after`** and run `orderBetween` inside the op (today it's done four
  times in components, gap 13).
- **A UI-only `filter` tool** (D-308: a passing view, never stored) so the agent can show a person a filtered plane or
  deck.
- **Route table setup through the fine-grained `table.ts` functions** (`addColumn`, `editColumn`, `moveColumn`,
  `addCardRow`) instead of whole-array `setTablePart`, which overwrites a concurrent edit by someone else (gap 16).
  Done in S7 by detecting one change: `setTablePart`/`setPart` compare the editor's list with what's there now
  (what someone else added since left aside, `editorChange` in src/model/lens.ts) and send one add, edit or move
  through the axis op; anything else is still written whole.

