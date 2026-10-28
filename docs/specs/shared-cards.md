# Spec: one card on many planes

Status: **agreed (D-281, 2026-10-28); sessions 1–2 done (D-282, D-283).** Split into sessions; every session must be able to start from this
file alone. The user: "planedeki cardlara başka planelerde oluşturulan cardları eklemek. Buna bütün cardlar dahil. Ya yeni
card ekleyebiliyorsun da existing cardlardan search yapıp ekleyebiliyorsun".

## How to run a session

1. Read this file, then `memory-bank/state.md`. The first session below not marked **done** is yours.
2. Check `git status` and `ListAgents` first: other sessions work on this repo too.
3. Do only that session's scope; anything else goes under "Found along the way" at the bottom.
4. Before finishing: verify in headless Chrome on the emulators (state.md's notes), `npm run test:rules` after a rules
   change, `npm run build`.
5. Write the decision (`D-xxx`, next free number) in `decisions-log.md` and `decisions.md`, mark the session **done**
   here, update state.md, `npm run check:memory`. Commit only your own hunks; deploy rules only if changed
   (`npx firebase deploy --only firestore:rules,firestore:indexes,database --project north-star-db`).
6. Tell the user in plain words what to look at.

## What the user chose (2026-10-28)

- **The same card, not a copy.** A card can be on several planes, at its own spot on each; title, status, evidence,
  tags, tasks, links, comments are one. Moving it to a plane (off the one it came from) is offered too.
- **Delete on a card that's also elsewhere takes it off this plane** (toast `still on 02 Rivals`, ⌘Z). On its only
  plane Delete deletes, as today. `delete everywhere` is in the right-click and the panel, through the hazard confirm
  (`on 3 planes`).
- **Parts and members come along:** bringing a feature (or customer, problem, idea) brings its `part of` tree; bringing a
  package brings its members with their parts; their layout kept. A part can still be brought alone.
- **Extras in the first version:** a `⧉ N` mark on cards on more than one plane; `≈ … [use that one]` while naming a new
  card; folding per plane; a `PLANES` section in the card's panel.
- Only cards (the five types + packages). Not text, sticky notes, competitor features (those live inside their
  competitor and come with it). ⌘C/⌘V stays a copy.

## Data

- A card keeps `pieceId` + `x`/`y`: its home. Every other plane it's on is a doc in **`places/{planeId}_{cardId}`**:
  `{ planeId, cardId, type, x, y, folded?, createdAt }`. The id makes a card on one plane twice impossible. Not the old
  name `placements`: 1.0's docs still sit in old workspaces under it (D-248).
- The user never sees "home": taking a card off its home plane while it's on another moves the home there (the card's
  `pieceId`/`x`/`y`/`folded` from that place, the place deleted), one undo step.
- `folded` per plane: the card's own for its home, the place's elsewhere (a fold changes a card's height; shared, it
  would push cards over each other on other planes).
- Rules: editors write; keys only these; the id is `planeId_cardId`; `type` a card type; x/y numbers. Viewers read
  only. Whether the plane and the card exist is *not* checked (D-282): a batch's rules may read at most 20 documents,
  and placing a tree of parts or undoing a plane's delete writes more; the app skips a place whose card or plane is gone.
- Loads with the workspace (`workspaceData.ts`), beside the cards. A place whose card or plane is gone is skipped.
- One helper for "the cards on plane P with their spot there", `cardsOn(plane)`, memoised per plane so unchanged cards
  keep the same object (D-279: the plane's contents are memoised; new objects per snapshot would redraw everything).
  Card ids stay unique on a plane, so selection, Marks, presence and links keep working by card id.
- One writer for spots: `moveOn(plane, …)` writes the card's x/y on its home, the place's elsewhere (drag, group drag,
  arrows, line up / space out, landing). `updateDoc`, never `setDoc`, so a place someone just took off isn't brought back.

## Edge cases (all must hold)

1. Delete a plane: its cards that are also on another plane stay (home moves there), with their links; places on it go.
   The confirm says `5 cards go, 2 stay on other planes`. One undo step.
2. Delete a card (everywhere): its places go with it (cascade, like its links).
3. Links: already the workspace's, drawn when both ends are on the plane; a card brought in shows its links to the cards
   there with nothing more.
4. Comments: a card's thread shows its chip on every plane the card is on; a new comment's `planeId` is the plane it's
   made on.
5. Everything that asks "the cards on this plane" counts places: the plane's picture on the canvas and fit, the matrix's
   one-plane axis, the table's `plane is` rule and its plane column (`Pazar, Rivals`), a kanban or timeline stuck to a
   plane, the finder (a card under each plane it's on, `here` first), packages "on its plane", a competitor's `≈ our`
   features, guides, filters, box select. Grep `pieceId ===` / `pieceId !==` for cards; each one is either "home" (rare)
   or "on" (most).
6. Made from the panel (CardPicker's `make`, `+ test it` …): the new card goes on the plane being looked at, near the
   card's spot *there*, not its home.
7. Packages: `memberIds` are ids, fine; a package unfolded frames only its members on this plane; packaging cards some of
   which are places makes the package at home on this plane.
8. Someone takes a card off a plane while another drags it there: the drag's write fails quietly (no doc), nothing comes back.
9. Following and others' selections: per plane, as now (a card on two planes selected on A shows no L's on B).
10. Export/import: `places` travel, ids remapped; a place whose card or plane isn't in the file is left out.
11. Undo: placing (with parts) is one step; taking off one step; moving here (place + take off there) one step.

## Session 1: data, rules, writes · **done (D-282, 2026-10-28)**

- `src/data/places.ts`: `cardsOn` (memoised per place), `planesOf`, `onPlane`, `withParts`, `landing`, `bringIn` (with
  parts/members, layout kept, clear of the plane's cards; `move` moves the home), `takeOff` (the home move), `planeGoes`.
  `cards.ts`: `placeRef`; `moveCard(s)`, `foldPackage` and the new `foldCard` write a placed card's place (`card.on`);
  `deleteCard(s)` take places. `pieces.ts` `deletePiece` keeps cards also elsewhere. `workspaceData` loads `places`.
- Rules + 16 tests; export/import carry `places`.
- For session 2: callers pass `places` to the deletes already, but nothing draws placed cards yet (no `cardsOn` in
  the views), and Delete still deletes everywhere; folding a feature still calls `updateCard(…{ folded })`, switch it
  to `foldCard`.

## Session 2: planes draw and move placed cards · **done (D-283, 2026-10-28)**

- Plane drawing, focus, canvas picture, fit, drag/select/box/arrows/guides through `cardsOn`/`moveOn`; folding per plane;
  Delete per the user's rule (toast), right-click `take off this plane` / `delete everywhere`.
- Measure a pan and a drag as D-279 did: no new redraws.
- Built: CanvasView's per-plane lists from `cardsByPlane`; `planeCtx`, fit, `+`, the finder's preview, Beside's glide
  through `cardsOn`; group moves (`moveMany`, `spotRef`) and folds write the place; `deleteHere` (selection.ts) for
  Delete, the menu and the panel's several; the menu's `take off this plane` / `delete everywhere`, the panel's
  `delete everywhere` and the hazard confirm (`useCanvasView.deleting`); the plane delete's confirm counts what stays;
  a package is made at home on the plane it's made on; others' selections by `planeOf`; LensCardPanel doesn't open a
  second panel for a placed card. Left for session 5: the `pieceId` filters in CardPanelKinds, CardPanel's making
  (543, 649), matrix, table, kanbanCards, findIndex, source.ts.

## Session 3: bringing cards in · not started

- `+` in focus: `existing card…` (letter `e`) under the five types; the same in the right-click's `add a card here`.
- A D-222 prompt: `>` narrows by title (then tags), `# customers …` sections, rows `› ▦ Crewly   02 RIVALS` (the planes
  it's on, faint), `with 4 parts` when it brings some; cards already here left out. Enter places, ⇧Enter places and keeps
  it open, ⌥Enter moves here (hint in the foot). Lands at the view's middle, clear; glided to, selected; arrives cell by cell.

## Session 4: the panel and the marks · not started

- `PLANES` section: `01 Pazar · 02 Rivals` (a click goes there, into its focus), `[+ place on ▾]`, `[take off this plane]`.
- `⧉ N` at the end of the card's facts line when on more than one plane (number magenta, D-276).
- Naming a new card (D-250): titles matching other planes' cards of that type show under the field as
  `≈ Crewly · 02 RIVALS [use that one]`; picking it places that card here instead and drops the new one (one undo step).

## Session 5: the rest of the app · not started

- Edge cases 4, 5, 6, 7: comments, matrix, table, kanban, timeline, finder, packages, panel kinds.

## Found along the way

_Nothing yet._
