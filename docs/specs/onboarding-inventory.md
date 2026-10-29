# Onboarding: every surface and where a person first meets it

_Collected 2026-10-29 (commit 8651c9b + the working tree) for [onboarding.md](onboarding.md): every user-facing feature
except the agent, with the place in code where a person first meets it. **Line numbers drift**: re-check with grep
before hooking anything. Paths are from the repo root._

Roles: **all** = owner, editor, viewer · **E+** = owner and editor · **O** = owner only.
Viewers: `editor = canEditIn(workspace, uid)` (`src/data/workspaces.ts:38`, `WorkspaceLayout.tsx:97`) passed down as a
prop; `setReadOnly(VIEWER,'viewer')` (`WorkspaceLayout.tsx:105-109`) makes `writable()` (`src/data/history.ts:110`) refuse
every tracked write with a toast. (`[data-viewer]` CSS in WorkspaceLayout.module.css:118-129 and `data-viewer-ok` attrs
are dead leftovers from 1.0.)

---

## 0. Places most events already pass through (hook here, not in hot files)

| Hook | Where | Catches |
|---|---|---|
| **`tracked(label, refs, write)`** | `src/data/history.ts:116` | Every write this tab makes, each with a plain label: `add a plane` / `add a matrix` / `add a deck` / `add a timeline` / `add a documents` (pieces.ts:115); `add a customer`… (cards.ts:101); `add a heading` / `a paragraph` / `a sticky note` / `a section` / `the project title` (labels.ts:84); `link` / `tag` (edges.ts:31); `add a task` (tasks.ts:181); `package these` (cards.ts:152); `stick a …` / `unstick a …` (pieces.ts:246); `open a …` / `close a …` = unframe / frame (pieces.ts:254); `bring N here` (places.ts:166); `add a canvas` (canvases.ts:97); `move … to X` (canvases.ts:227); `put … on X too` (canvases.ts:247); `upload a document` (documents.ts:204); `add evidence` (evidence.ts:35); `log what a task taught` (tasks.ts:351). Comment threads (`startThread`, threads.ts:40) do **not** go through it. |
| **`useCanvasView`** (zustand) | `src/state/canvasView.ts:114` | One `subscribe` sees `focusSpread` / `focusArrived` / `focusLeaving`, `editing[]`, `selected`, `cardSelected` (also matrix/table cells as `cell\|…`), `cardMulti`, `labelSelected` / `labelEditing`, `fresh`, `linkSelected`, `linking`, `drawing`, `packing`, `bringing`, `toCanvas`, `confirming`, `deleting`, `beside`, `stickHint`. |
| Other UI stores | `useMatrixUi` (Matrix.tsx:129), `useTableUi` (Table.tsx:50), `useKanbanUi` (Kanban.tsx:157), `useDocUi` (Documents.tsx:43), `useFind` (find.ts:36), `useThreadView` (Threads.tsx:48), `useTasksSide` (sideState.ts:15), `usePresence` (data/presence.ts:80-88, follow), `useGuides` (guides.ts:29), `usePlaneFilter` (planeFilter.ts:32), `useShelf` (FilterDock.tsx:23), `useHistory.notice` (toast) | Wizards (`wizard: true`), setup panels, finder open, threads panel, tasks side view, documents beside, following. |
| URL | `?focus=`, `?beside=`, `?canvas=` (`src/app/paths.ts`) | Focus, beside, canvas (also changed by reload, links, following, back). |
| Curtain | `useCurtain.revealed` (`src/state/curtain.ts:16`) | Wait for it before showing anything. |
| Workspace open | `Loaded` WorkspaceLayout.tsx:80; `CanvasView` mount CanvasView.tsx:97; first fit in a tab CanvasView.tsx:804-808 | "Met the canvas". |

---

## 1. Shell and navigation

| id | What the person sees / can do | Trigger (file:line) · central? | Roles | Depends on |
|---|---|---|---|---|
| landing | Headline cell by cell, the welcome sky, `[sign in with Google]`. | `Landing` src/views/landing/Landing.tsx:41; route App.tsx:74 | signed out | — |
| sign-in-continue | A link opened signed out continues after sign-in. | `ToLanding` App.tsx:92, `AfterSignIn` :98 | all | landing |
| loading-curtain | Flowing backdrop + `▖ STATUS`, then a cell-by-cell rebuild. | `Curtain` src/ui/Curtain.tsx:27; `useHoldCurtain` curtain.ts:38 | all | — |
| workspaces-page | Create, join with a code, import a .zip, pending invites/requests, workspace cards. | `Workspaces` src/views/workspaces/Workspaces.tsx:38 | signed in | landing |
| ws-create | `[create]` with a name → opens it. | `CreateForm` Workspaces.tsx:232 → `createWorkspace` workspaces.ts:55 | signed in | workspaces-page |
| join-code | Type a code → a request goes to the owners (not in yet). | `JoinForm` Workspaces.tsx:272 → `requestToJoin` workspaces.ts:84 | signed in | workspaces-page |
| pending-invites | Invites to your email (accept/decline), your requests (withdraw). | `Pending` Workspaces.tsx:321 | signed in | join-code |
| import | `[import .zip]` → a new workspace you own. | `ImportStrip` Workspaces.tsx:385 → importWorkspace.ts:42 | signed in | workspaces-page |
| ws-card | Open, rename, leave, delete (inline confirm). | `WorkspaceCard` Workspaces.tsx:95 | O deletes | workspaces-page |
| ws-empty | "no workspaces yet". | Workspaces.tsx:79-85 | signed in | — |
| breadcrumb | `# north-star / workspaces / <ws> [/ <canvas>] [/ <focused>]`. | `Hud` src/ui/Hud.tsx:38-69; crumbs WorkspaceLayout.tsx:121-131 | all | — |
| canvas-crumb | The workspace/canvas name `▾`: canvases prompt (go, new, rename, move, delete). | `CanvasCrumb` CanvasSwitch.tsx:23 | all go; E+ manage | breadcrumb |
| side-nav | Left middle: `+`, fit, compass, decks-and-days icon. | Hud.tsx:75; WorkspaceLayout.tsx:142-150 | all (`+` E+) | — |
| plus-menu | Magenta `+` → prompt `add…` (canvas letters p m t d k l h a n s i; in a plane c r o i f k h a n s e). | `AddToCanvas` WorkspaceLayout.tsx:234; `<Menu>` :287; items :298-326. Not for viewers (:145); hidden in a bare focus | E+ | canvas |
| fit | Fit icon or `0`. | `FitButton` WorkspaceLayout.tsx:194; key CanvasView.tsx:852; `fitHere` canvasView.ts:203 | all | canvas |
| finder | Compass or ⌘F: places when empty, matches when typed; Tab scope; ⌥C/⌥W/⌥X; → ← fold; Enter goes. | `FinderButton` WorkspaceLayout.tsx:213; ⌘F Finder.tsx:66-76; `openFinder` find.ts:46 (`useFind.open`); `findGo` find.ts:54 | all | canvas, focus |
| finder-preview | Live preview of where you'll land. | FindPreview.tsx | all | finder |
| tasks-side-btn | Columns-over-a-bar icon (only with a deck/timeline); magenta count of tasks given to you. | `TasksButton` MyTasks.tsx:18 | all | deck |
| corner-people | Squares of who's here, `+N`. | `PeopleHere` src/ui/PeopleHere.tsx; WorkspaceLayout.tsx:138 | all | — |
| corner-threads | Threads button, magenta dot / `@` count. | `InboxButton` ThreadInbox.tsx:76 → `toggleInbox` Threads.tsx:53 | all | — |
| corner-square | Your initial → Settings (account). | `SettingsButton` src/ui/Settings.tsx:72 | all | — |
| corner-gear | ⚙ → Settings (people page when people wait; cyan badge). | Settings.tsx:78; `useJoinRequests` WorkspaceLayout.tsx:99 | all (badge O) | — |
| toast | One line bottom centre (undo/redo/what was done, `[go there]`). | `Toast` src/ui/Toast.tsx:10 (WorkspaceLayout.tsx:155); `useHistory.say` history.ts:43 | all | — |
| undo-redo | ⌘Z, ⇧⌘Z / Ctrl+Y. | `useEditKeys` useEditKeys.ts:10-28 | E+ | — |
| viewer-lock | A viewer's tries say "You're a viewer…". | WorkspaceLayout.tsx:66, :105-109 | V | — |
| canvas-switch-anim | Old canvas breaks, new builds. | `useShownCanvas` WorkspaceLayout.tsx:163-190 | all | canvases |

## 2. Canvas and pieces

| id | What / keys | Trigger · central? | Roles | Depends |
|---|---|---|---|---|
| canvas | Drag pans, wheel zooms round the pointer (0.1–4). | `CanvasView` CanvasView.tsx:97; pan :944; wheel :811-838; first fit :804 | all | — |
| piece-create | Every kind (§A). | **`addPiece`** src/data/pieces.ts:96 (+ `placeDocument` :259) | E+ | plus-menu |
| piece-surface | Graphite window, kind-colour band, `NAME · KIND` in the top edge. | `PieceBoxOf` CanvasView.tsx:1548; name :1765-1789 | all | canvas |
| piece-console | Bottom-right tab while pointed at: `[⧉ N] [💬 N inside] [link ▾] [extra] [focus] [edit]`; touch: first tap. | `PlaneConsole` CanvasView.tsx:1986 (rendered :1849) | all (`edit` E+) | piece-surface |
| focus | `[focus]` / double-click: ink spreads (820/700 ms); Esc / `[unfocus]`. | `focus()` CanvasView.tsx:689; double-click :932; `focusTo` :377. Central: `?focus=` + `focusArrived` (:1044); leaving `unfocus` :702 | all | piece-console |
| focus-bare | Matrix/table/documents/document/deck/timeline focus: glides to the middle, no ink. | `FocusedPlane bare` FocusedPlane.tsx:57; CanvasView.tsx:1052-1067 | all | focus |
| focus-dock | Bottom-middle tab: kind tools, `[unfocus] esc`. | CanvasView.tsx:1083-1145; FocusDock.tsx:10/34; `escNext` :202-214 | all | focus |
| edit-mode | `[edit]`: cyan marks, handles, console `EDIT 960 × 600 [unframe] [move to…] [also on…] [delete] [done]`. | **`setEditing`** canvasView.ts:121 (also set on creation: WorkspaceLayout.tsx:272, the wizards, placedDoc CanvasView:584) | E+ | piece-console |
| piece-move-resize | Drag moves (0.8 + landing L's), handles resize, 25 px snap (alt free), ≥ 325 × 200. | `press` CanvasView.tsx:1603-1676 → `placePiece` pieces.ts:121 | E+ | edit-mode |
| piece-rename | Cyan `>` field in the top edge, `17/80`. | `NameField` CanvasView.tsx:1884 → `renamePiece` pieces.ts:285 | E+ | edit-mode |
| piece-delete | Delete/Backspace in edit mode or `[delete]` → hazard confirm. | CanvasView.tsx:916-919, :2053; `askDeleteHere` → `confirming` → :1218-1263 → `deletePiece` pieces.ts:296 | E+ | edit-mode |
| hazard-confirm | Dark screen, `╱╱╱` tape, cancel focused. | `HazardConfirm` src/ui/HazardConfirm.tsx:33 | E+ | — |
| unframe | `[unframe]` / `[frame]`: a lens lies on the canvas live (cell-by-cell morph). | Console :2031-2034 → `openPiece` pieces.ts:251; `canOpen` :60 | E+ | edit-mode |
| open-tools | On an unframed piece's console: `[setup]`, pages, weeks. | `OpenTools` CanvasView.tsx:2115; `CanvasSetup` :2143 | E+ | unframe |
| stick-link | Drag a matrix/table/deck near a plane's edge (a timeline to a deck or plane) → snaps and links; alt free. | Drag :1641-1647 (`stickTarget` pieces.ts:164) → `placeLens` pieces.ts:243 (`stick a …`); `Bond` CanvasView.tsx:1378 | E+ | piece-move-resize |
| link-select | Console `link ▾` / `⇆ 01 Pazar ▾`. | CanvasView.tsx:2082-2096 → `linkLens` pieces.ts:239 | E+ | stick-link |
| canvas-text | Text and stickies straight on the canvas. | CanvasView.tsx:1022-1023 | all | plus-menu |
| file-drop | Drop files into documents; a .md on the canvas is placed (asks). | `dropFiles` CanvasView.tsx:609-618 | E+ | documents |
| right-click-canvas | On a piece: `comment`, `move to canvas…`, `also on canvas…`, `take it off this canvas`, `delete everywhere`. Empty canvas: none. | `rightClick` CanvasView.tsx:464-552 → `ContextMenu` :1159 | all / E+ | canvas |
| piece-comments-tab | Fresh comments keep a tab; `[💬 N inside]`. | CanvasView.tsx:2006-2011, :2071-2081 | all | threads |
| zoom-settle | Screen-size things hide while zooming. | `useShownZoom` CanvasView.tsx:1287 | all | — |

## 3. Planes and cards

| id | What / keys | Trigger · central? | Roles | Depends |
|---|---|---|---|---|
| plane | `+ → plane` (`p`); a picture on the canvas, live in focus. | WorkspaceLayout.tsx:313 → addPiece | E+ | plus-menu |
| card-create-plus | In focus `+` → customer `c` / problem `r` / competitor `o` / idea `i` / feature `f`: panel open for the title. | `addHere` WorkspaceLayout.tsx:278-284 → **`addCard`** cards.ts:95; sets `cardSelected`/`cardEditing`/`fresh` | E+ | focus |
| card-create-rclick | Right-click empty plane → `add a card here`. | planeMenu.ts:163-199 | E+ | focus |
| card-naming | Enter keeps, Tab next of its type, Esc/empty discards; `≈ … [use that one]`. | `Title` CardPanel.tsx:589 (:656-676); `makeNext` :706 | E+ | card-create-plus |
| card-select | Click selects, drag moves (snap/alt, guides), `›` on hover. | `CardBody.press` PlaneCards.tsx:593 → `setSelection` selection.ts:47 | all / E+ | focus |
| card-panel | Right panel 400 px: title, numbered sections, `[comment] [delete]`. | `CardPanel` CardPanel.tsx:123; opens whenever `cardSelected` is set | all / E+ | card-select |
| lens-card-panel | A head in a matrix/table/card deck opens its panel. | `LensCardPanel` CardPanel.tsx:236 | all | matrix, table |
| status-evidence | Status; evidence list + form. | CardPanel.tsx:725, :738, :814 → `addEvidence` evidence.ts:30 | E+ | card-panel |
| competitor-profile | URL, pricing, audience, regions. | CardPanelKinds.tsx:73 | E+ | card-panel |
| competitor-features | Small cards inside a competitor; panel by category, `≈ our`. | CardPanelKinds.tsx:133/191/243; PlaneCards.tsx:790 | E+ | card-panel |
| parts-fold | Parts tree, `[−]`/`[+]`. | CardPanelKinds.tsx:342/298; `foldCard` cards.ts:168 | E+ | card-panel |
| criteria | A feature's ≤ 8 "judged on". | CardPanelKinds.tsx:394 | E+ | card-panel |
| rests-on | What a feature rests on → confidence; `≈ theirs`. | CardPanelKinds.tsx:476/544 | E+ | card-panel |
| card-tags-notes | `#tags`, notes. | CardPanel.tsx:1093/1138 | E+ | card-panel |
| card-tasks | `☐ 2/5`, `+ task`, `+ test it`. | CardTasks.tsx:28 | E+ | deck |
| card-delete | Delete / `[delete]`; elsewhere too → off here (toast); `delete everywhere`. | CanvasView.tsx:898-902 → `deleteHere` selection.ts:151 | E+ | card-select |
| multi-select | Shift+click, alt+drag box; arrows, ⌘C/⌘V/⌘D, Delete, Esc. | PlaneCards.tsx:597, :106-135, `usePlaneKeys` :356-428 | E+ | card-select |
| many-panel | `N selected`: line up, space out, tags, package, copy/duplicate/delete. | `ManyInside` CardPanel.tsx:261 | E+ | multi-select |
| copy-paste | ⌘C, ⌘V copies, ⇧⌘V the same cards, `paste here`. | PlaneCards.tsx:401-418; `pasteSame` selection.ts:165 | E+ | multi-select |
| packages | `+ → package` (`k`, pick, Enter) or `package these`. | `packing` WorkspaceLayout.tsx:304 → `PackPick`; **`packageThese`** selection.ts:144 → `addPackage` cards.ts:149 | E+ | multi-select |
| package-panel | Rating, holds, plan; folded / unfolded. | CardPanel.tsx:492/512/564; `PackageFrame` PlaneCards.tsx:479 | E+ | packages |
| shared-cards | `existing card…` (`e`): ↵ bring, ⇧↵ more, ⌥↵ move; `⧉ N`; `PLANES` section. | `bringing` → `BringCards` BringCards.tsx:35 → `bringIn` places.ts:153; CardPanel.tsx:1039 | E+ | card-panel |
| guides-snap | `g` snapping, `a` guides. | PlaneCards.tsx:385-389; guides.ts:31/37 | E+ | focus |
| view-menu | Dock `[view ▾]`: snap, guides, comments (`c`). | ViewMenu.tsx:8 | all | focus-dock |
| plane-filter | Dock `[filter]`: SHOW FOR TAG REGION LINKS. | `PlaneDockExtras` FilterDock.tsx:26 | all | focus-dock |
| linked-strip | Dock `[linked · N]`. | FilterDock.tsx; CanvasView.tsx:1116-1141 | all | stick-link |
| right-click-plane | Cards, text, links, several, empty plane. | `planeCtx` / `planeItems` planeMenu.ts:209/203 | all / E+ | focus |
| plane-delete-cascade | Deleting a plane takes its cards (shared stay). | `sharedOnOf` CanvasView.tsx:1269 | E+ | piece-delete |

## 4. Links

| id | What / keys | Trigger · central? | Roles | Depends |
|---|---|---|---|---|
| link-draw | Hover → `›`; drag onto another card → link, label ready. | `startLink` PlaneCards.tsx:653-683 → **`createEdge`** edges.ts:29 | E+ | card-select |
| link-bar | Kind, label, reverse, remove. | `LinkBar` PlaneLinks.tsx:227 | E+ | link-draw |
| link-panel | Panel sections by meaning, `+ add` → picker. | CardPanel.tsx:853/905 | E+ | card-panel |
| link-kinds | relates / solves / part of / competes / contradicts / inspired by / depends on / for. | `KINDS` PlaneLinks.tsx:21 | all | link-draw |

## 5. Text and sticky notes

| id | What / keys | Trigger · central? | Roles | Depends |
|---|---|---|---|---|
| text-create | `+` heading `h`, paragraph `a`, sticky `n`, section `s`, title `i`. | `addText` WorkspaceLayout.tsx:244-259 → **`addLabel`** labels.ts:79 | E+ | plus-menu |
| text-edit | Double-click types; ⌘Enter; a bar (sizes, B/I/AA, turn, colours). | `LabelItem` TextItems.tsx:140; `LabelBar` :859 | E+ | text-create |
| heading-kicker | `02 ── WHO WE BEAT`. | TextItems.tsx:534/547 | E+ | text-edit |
| section-draw | Crosshair "drag to draw a section"; carries what's inside. | `drawing` → `DrawSection` DrawSection.tsx:13 | E+ | text-create |
| sticky | Paper, `NAME · 2m` band, folds. | `StickyBody` TextItems.tsx:466 | E+ | text-create |
| project-title | Workspace name + "building" on the canvas. | `TitleBlock` TextItems.tsx:719 | E+ | text-create |

## 6. Matrix and table

| id | What / keys | Trigger · central? | Roles | Depends |
|---|---|---|---|---|
| matrix-wizard | `+ → matrix…` (`m`): 4 steps + preview. | `useMatrixUi.wizard` → `MatrixWizard` MatrixWizard.tsx:21 | E+ | plus-menu |
| matrix | Click, again steps, 1–9, arrows, Backspace, `-`, Enter; heads open panels; dashed card adds. | `MatrixView` Matrix.tsx:146; keys :230-268 | all / E+ | focus-bare |
| matrix-cell-bar | Steps, doesn't apply, how sure, note. | `CellBar` Matrix.tsx:990 | E+ | matrix |
| matrix-setup | Dock `[setup]`. | `useMatrixUi.setup` → MatrixSetup.tsx:52 | E+ | matrix |
| matrix-unfold | A feature axis unfolds into criteria, `◇ open`. | MatrixSetup.tsx:213; Matrix.tsx:635 | E+ | criteria |
| table-wizard | `+ → table…` (`t`): 3 steps. | `useTableUi.wizard` → TableWizard.tsx:21 | E+ | plus-menu |
| table | Click/again, arrows, 1–9, Backspace, Enter, Space; head sorts; widths; row `×`. | `TableView` Table.tsx:185 | all / E+ | focus-bare |
| table-pager | `‹ 2 / 5 ›`. | `TablePager` Table.tsx:782 | all | table |
| table-setup | Dock `[setup]`. | TableSetup.tsx:47 | E+ | table |
| beside | In a plane's focus `⇆ table · name` opens it beside (split 25–75 %). | `toggleBeside` CanvasView.tsx:182 → `?beside=` → Beside.tsx:51 | all | stick-link, focus |

## 7. Documents

| id | What / keys | Trigger · central? | Roles | Depends |
|---|---|---|---|---|
| documents-list | `+ → documents` (`d`): table or shelf. | WorkspaceLayout.tsx:319; Documents.tsx:175 | E+ / all | plus-menu |
| doc-upload | Upload .md (images/PDFs after Blaze) or drop. | Documents.tsx:490/527/463 → `uploadMarkdown` documents.ts:183 | all (own) | documents-list |
| doc-readers | In focus a click opens a document beside; side by side; zoom; on this page. | `openDoc` Documents.tsx:72 → `DocReaders` DocumentPiece.tsx:139 | all | documents-list |
| doc-menu | Open beside, place on the canvas, rename, share, download, delete. | `docMenu` CanvasView.tsx:554-567 | all / author / O | documents-list |
| doc-place | Place one on the canvas (private asks). | `DocPlace` DocumentPiece.tsx:380 → `placeDocument` pieces.ts:259 | E+ | doc-menu |
| document-piece | One document in a window; focus scrolls; unframe ≤ 6000 px. | DocumentPiece.tsx:76/300 | all | doc-place |
| doc-share / doc-delete | Share/unshare, delete (hazard). | Documents.tsx:81; CanvasView.tsx:1167/1185 | author / O | doc-menu |

## 8. Deck, tasks, timeline

| id | What / keys | Trigger · central? | Roles | Depends |
|---|---|---|---|---|
| deck-wizard | `+ → deck…` (`k`): start from, holds, columns · rows. | `useKanbanUi.wizard` → KanbanWizard.tsx:21 | E+ | plus-menu |
| deck | Columns `01 TODO ── 5`; drag tasks; `+ add a task`; `+ column`; head rename, `‹ › ✓ × ≤`. | `TaskKanbanView` Kanban.tsx:221; **`addTask`** tasks.ts:177 | all / E+ | focus-bare |
| task-select | Click opens the task panel; Delete; several. | **`selectTask`/`selectTasks`** Kanban.tsx:171/173 | all / E+ | deck |
| task-panel | Column, given to, due, card, checklist, labels, P1–P3, notes, learned. | `TaskPanel` TaskPanel.tsx:35 | all / E+ | task-select |
| deck-filter | GIVEN TO / DUE / FOR / LABEL. | KanbanFilterDock.tsx:34 | all | deck |
| deck-lanes | `[LANES ▾]`, lanes fold. | Kanban.tsx:710/692 | all | deck |
| deck-soon | `▾ SOON` band. | `SoonBand` Kanban.tsx:648 | all | deck |
| deck-setup | Holds · cards · columns · boxes. | KanbanSetup.tsx:36 | E+ | deck |
| card-deck / priorities | A deck of cards by field; `[order]` P1–P3. | CardKanban.tsx:40/351/367 | E+ | deck-wizard |
| deck-hidden-tasks | `☐ N tasks from before`. | Kanban.tsx:1030 | E+ | deck-setup |
| deck-side-view | Icon or `t`: plane → deck → days on the right; tabs, `MINE`, `ALL · DAYS`, `[days ›]`. | **`toggleTasksSide`** sideState.ts:49; `TasksSide` TasksSide.tsx:50 | all | deck |
| timeline | `+ → timeline` (`l`): strip of days; scales/pinch; drag tasks/edges; draw `+`; no-day tray. | `TimelineView` Timeline.tsx:216 | all / E+ | deck |
| deck-days-dock | In a deck's focus `⇆ timeline`. | CanvasView.tsx:1100-1109 | all | timeline |

## 9. Collaboration

| id | What / keys | Trigger · central? | Roles | Depends |
|---|---|---|---|---|
| cursors | Others' cursors, 200 ms behind. | `PeerCursors` collab.tsx:77 | all | — |
| peer-selection | Others' selections as L's + name. | `usePeersOn` collab.tsx:260 | all | — |
| following | Click a square → follow totally; `esc to stop`. | `toggle` PeopleHere.tsx:24 → **`usePresence.follow`** presence.ts:88; `Follow` collab.tsx:142 | all | corner-people |
| threads-start | Right-click → `comment`; panel `[comment]`. | **`startComment`** Threads.tsx:51 → `startThread` threads.ts:40 | all | right-click |
| thread-chip | Chip (count, magenta new, `@`). | `ThreadChip` Threads.tsx:88 | all | threads-start |
| thread-panel | `>` prompt, Enter sends, `@` people, resolve, `[on the canvas ↗]`. | `ThreadPanel` Threads.tsx:132 | all | thread-chip |
| threads-panel | Bottom tab: list + thread halves. | `toggleInbox` Threads.tsx:53 → ThreadInbox.tsx:97 | all | corner-threads |
| thread-pins | `c` hides/shows chips. | CanvasView.tsx:848 | all | thread-chip |
| tasks-given-badge | Count of tasks given to you since you looked. | MyTasks.tsx:29-31 | all | deck-side-view |

## 10. Canvases

| id | What / keys | Trigger · central? | Roles | Depends |
|---|---|---|---|---|
| canvases | Breadcrumb prompt: canvases, `new canvas`, rename, move, delete (not the first). | `CanvasCrumb` CanvasSwitch.tsx:23 → `addCanvas` canvases.ts:91 | all / E+ | breadcrumb |
| canvas-keys | ⌥1–⌥9 (only with ≥ 2). | `CanvasKeys` MoveToCanvas.tsx:174-191 | all | canvases |
| move-to-canvas | `move to…` / `also on…`; `⧉ N`. | `useCanvasView.toCanvas` → MoveToCanvas.tsx:41 | E+ | canvases |
| shared-piece-delete | `only from here` / `delete everywhere`. | CanvasView.tsx:1221-1255 | E+ | move-to-canvas |

## 11. Settings, account, workspace

| id | What / keys | Trigger · central? | Roles | Depends |
|---|---|---|---|---|
| settings | Native `<dialog>` 960 × 720: YOU (account, display), WORKSPACE (general, people, export). | **`show()`** Settings.tsx:63 | all | corner-gear |
| settings-account | Profile, `[sign out]`. | Settings.tsx:129-147 | all | settings |
| settings-display | Theme, motion, background (this browser). | Settings.tsx:170/190/210 | all | settings |
| settings-general | Name, "what we're building". | `WorkspaceSettings` WorkspaceLayout.tsx:342 | E+ | settings |
| settings-people | Requests, members and roles, code, email invites. | PeopleSettings.tsx:38 | O | settings |
| export | `[download .zip]`. | `ExportSection` WorkspaceLayout.tsx:383 | all | settings |

---

## A. Piece kinds and how each is made

Kinds (`KIND_NAME`, pieces.ts:38): `plane`, `matrix`, `table`, `documents`, `document`, `kanban` (shown "deck"),
`timeline`. Default sizes pieces.ts:22-30. **All through `addPiece(wid, kind, at, others, setup?, name?, docId?, size?)`
(pieces.ts:96)**, label `add a <kind>`; a single document through `placeDocument` (pieces.ts:259).

| Kind | Made by | Call site |
|---|---|---|
| plane | `+` → plane (`p`) | WorkspaceLayout.tsx:313 (then `setEditing`) |
| matrix | `+` → matrix… → wizard | MatrixWizard.tsx:56 |
| table | `+` → table… → wizard | TableWizard.tsx:62 |
| documents | `+` → documents (`d`) | WorkspaceLayout.tsx:319 |
| deck | `+` → deck… → wizard; setup "a new deck for the cards" | KanbanWizard.tsx:68; KanbanSetup.tsx:170 |
| timeline | `+` → timeline (`l`) | WorkspaceLayout.tsx:323 |
| document | doc menu "place", drag out of the list, .md dropped | DocumentPiece.tsx:392 |

No right-click "add piece" on the canvas (empty right-click gives nothing, CanvasView.tsx:471-474). Other creators:
cards `addCard` (cards.ts:95), text `addLabel` (labels.ts:79), links `createEdge` (edges.ts:29), tasks `addTask`
(tasks.ts:177), packages `addPackage` (cards.ts:149), canvases `addCanvas` (canvases.ts:91).

## B. Overlays and z-order

- `.app` (z 1) holds `Hud` (z 10: breadcrumb, side nav, corner), `CanvasView` (`role="application"`), `Finder` (z 30/31),
  `Toast` (z 30).
- Inside the canvas root (CanvasView.tsx:981-1264): FocusedPlane, FocusDock (z 2), Beside (2-3), TasksSide (5),
  DrawSection (6), ContextMenu (10), ThreadInbox, PeerCursors, BringCards, DocPlace, MoveToCanvas, Follow (7), HazardConfirms.
- Portalled to `body`: `SidePanel` (z 11), the three wizards (`.wizardShade` Matrix.module.css:1077, z 40), Menu lists
  (40), Select lists (60), CanvasSwitch (60), MoveToCanvas, Timeline DraftPick, HazardConfirm.
- Native `<dialog>.showModal()` (top layer): HazardConfirm, Settings. Curtain z 100/101.
- **No generic modal.** Closest: HazardConfirm (are-you-sure only), `SidePanel`+`PanelSection`+`PanelAction` (right
  column), `ContextMenu`/`MenuPanel` (prompt list), the wizard shell (CSS only, repeated three times), `Frame.module.css`.
- **A new overlay should:** portal to `body`; z 40 when it blocks (like the wizards), between 11 and 30 when it doesn't;
  `role="dialog"` (the canvas wheel then scrolls, `SCROLLS_ITSELF` CanvasView.tsx:76, and plane/deck keys skip it);
  stop `pointerdown` propagation (as SidePanel :42) or the canvas pans. A native `<dialog>` is also skipped by `isTyping`
  (useEditKeys.ts:7) and CanvasView's keys (:844).

## C. Keys bound on window

| Keys | Where | Notes |
|---|---|---|
| ⌘Z, ⇧⌘Z, Ctrl+Y | useEditKeys.ts:14-25 | skips inputs and dialogs |
| ⌘F | Finder.tsx:66-76 | |
| `c`, `t`, `0`, Esc chain, Delete | CanvasView.tsx:841-923 | skips inputs/dialogs; Esc yields to threads |
| ⌥1–⌥9 | MoveToCanvas.tsx:174-191 | ≥ 2 canvases |
| `g`, `a`, arrows, ⌘C/⌘V/⇧⌘V/⌘D, Delete, Esc | PlaneCards.tsx:356-428 (capture) | focused plane |
| matrix / table / deck keys | Matrix.tsx:230-268, Table.tsx:279-316, Kanban.tsx:338-353 | live only |
| Esc (capture) | PeopleHere, ContextMenu, TaskPanel, FilterDock, KanbanFilterDock, DocumentPiece, Select | |
| Enter / ⌘Enter / Esc | the wizards (capture), PackPick | |
| finder keys, card title keys, text ⌘Enter, menu letters | Finder, CardPanel, TextItems, Menu | |

**Free: `?`** (bound nowhere). Single letters taken outside menus: `c`, `t`, `0`; in a plane `g`, `a`.

## D. Dev hooks on window (DEV only)
`__curtain` (curtain.ts:52-54), `__sweep` (Curtain.tsx:36), `__advance` (Backdrop.tsx:14-16), `__backdrop`
(Backdrop.tsx:93), `__sceneTime` (sceneClock.ts:72-74), `__kanbanUi` (Kanban.tsx:169). `useCanvasView` and others are
not on window.

## E. Entrance primitives for a new modal
- `runCells(el, 'enter'|'exit', delay, ms, onDone?, sweep?)` (src/ui/Appear.tsx:27): 9 px cells on the viewport grid,
  random order; reduced motion instant.
- `<Appear as delay duration elRef>` (Appear.tsx:99): 320 ms, starts at `revealed`, exits at 0.6×; inside
  `<AnimatePresence>`. Used by SidePanel, ContextMenu, Menu, PackPick, FilterDock, Landing, Workspaces.
- `<DecodeText text duration=260 delay>` (src/ui/DecodeText.tsx:8): glyphs settle into text.
- Durations: components 320, headline/page 400, decode 260. No slides, fades or tile waves (rejected).
- Small consoles: manual `runCells` 170 in / 90 out (CanvasView.tsx:2001). Read `isReducedMotion()`.
- Per-browser state lives in localStorage under `north-star:*` keys; per-user cross-device state needs Firestore (like
  `threadReads/{uid}`).
