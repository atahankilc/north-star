# Spec: several canvases in a workspace

Status: **agreed (D-302, 2026-10-29); session 1 done (D-305).** Split into sessions; every session must be able to start from this
file alone. The user: "bir marketin canvası farklı olabilir, bir engineering canvası … bu workspaceler kendi içlerinde de
sectionlara ayrılabilse … default olarak bir section olur ancak başka bir section eklemek isteyen için"; then "canvaslar
arası dokuman ya da sayfa/pano transferi olmalı … bir canvasdan diğerine component taşıma olsun … Finder'daki tabı 3'e
bölelim, burası, bütün canvas ve everywhere … adı canvas olsun, ve ortaklıklar component ve itemlar olarak olabilir".

## How to run a session

1. Read this file, then `memory-bank/state.md`. The first session below not marked **done** is yours.
2. Check `git status` and `ListAgents` first: other sessions work on this repo too.
3. Do only that session's scope; anything else goes under "Found along the way" at the bottom.
4. Before finishing: verify in headless Chrome on the emulators (state.md's notes), `npm run test:rules` after a rules
   change, `npm run build`.
5. Write the decision (`D-xxx`, next free number) in `decisions-log.md` and `decisions.md`, mark the session **done**
   here, update state.md, `npm run check:memory`. Commit only your own hunks; deploy rules only if changed.
6. Tell the user in plain words what to look at.

## What the user chose (2026-10-29)

- **A workspace has one or more canvases.** It starts with one; nothing changes for someone who never adds a second.
  Named **canvas** (not "section": that's the framed text, D-130). Not pages or view tabs (D-174 stays in spirit): you
  switch from the breadcrumb.
- **What's shared is the workspace's, not the canvas's.** Items (cards, links, packages, tasks, documents' files,
  evidence, threads) belong to the workspace; a card can already sit on planes on different canvases (D-281).
  **Components (pieces) can be shared too:** the same piece on several canvases, at its own spot on each.
- **Components move between canvases** (a plane, a document, a table, a deck…), and can be put on another canvas as
  well (the same piece, not a copy).
- **The finder has three scopes:** `here` (the plane in focus) · `this canvas` · `everywhere` (every canvas). Out of
  focus `here` is the canvas, so only `this canvas | everywhere`; with one canvas `everywhere` is not shown (out of focus
  then there are no tabs; in focus `here | this canvas`).
- **Not in the first version:** who may see or edit a canvas (everyone in the workspace sees all; roles stay per
  workspace); loading only the open canvas's content (everything loads up front as now).

## Data

- `workspaces/{wid}/canvases/{id}`: `{ name, order, createdAt, createdBy }`. The first canvas is **`main`**, implied: a
  workspace without canvas docs has only `main`, named `Main` (with one canvas the breadcrumb shows the workspace's name). Its doc is written the first time it is
  renamed or a second canvas is made (so old workspaces need no move).
- `pieces/{id}` and canvas text (`labels` with `pieceId: 'canvas'`) get **`canvasId`**: their home canvas. Missing =
  `main`. Text on a plane has no `canvasId` (it goes where its plane goes).
- A piece on more canvases than its home: **`pieceSpots/{canvasId}_{pieceId}`** `{ canvasId, pieceId, x, y, createdAt }`
  (like cards' `places/`, D-281; size and frame stay the piece's own). The id makes a piece twice on one canvas
  impossible. Taking a piece off its home while it's elsewhere too moves the home there (one undo step), as D-281.
- One helper `piecesOn(canvasId)` (memoised per canvas, unchanged pieces keep their objects, D-279/D-287) gives the
  pieces with their spot there; one writer `movePieceOn(canvas, …)` for spots.
- Rules: editors write `canvases`, `canvasId`, `pieceSpots` (keys only these, id `canvasId_pieceId`, x/y numbers);
  viewers read. Existence of the canvas/piece not checked (the 20-read limit, as D-282); the app skips a dangling one.
- Path: `?canvas=<id>` beside `?focus=`, left out for `main`; only through `src/app/paths.ts`. An old link (no
  `canvas=`) with `focus=<plane>` opens the canvas that plane is on.
- Presence gets `canvas` (RTDB rules + test). Each browser keeps its camera per canvas; fit at once on a canvas's
  first open in a tab (D-202).

## How it looks and works

- **Breadcrumb:** `North Star ▾` while there is one canvas (the `▾` quiet); with more `North Star / Pazarlama ▾`. Its
  click is the prompt (D-222): the canvases in order (`•` current, `⧉` count of shared pieces as a hint), `# ──`,
  `+ new canvas`, `rename`, `reorder`, `delete`. A letter puts one first; Enter goes.
- **Switching:** the backdrop stays; the old canvas breaks and the new one builds cell by cell (one entrance, D-034);
  reduced motion: at once. ⌘1–⌘9 go to the nth canvas.
- **New canvas:** named in place (`>` field, Enter), then opened empty with the side nav's `+` lit.
- **Delete a canvas** (editors; never the last): the hazard confirm (`4 pieces go, 2 stay on other canvases`); cards
  on its planes that are on planes elsewhere stay (D-282's rule); ⌘Z brings it back.
- **Moving and sharing a component:** a piece's right-click and its edit console: `move to canvas ▸` and `also on
  canvas ▸`, each the prompt list of the other canvases + `+ new canvas`. Several selected move together. A piece
  takes what's stuck to it (`stuckTo`, D-210) and, for a plane, its cards, text and links (they're the plane's); a
  section of canvas text takes what's fully inside it. It lands at the same x/y on the target, or the nearest clear
  spot (D-238). A toast: `moved to Engineering [go there]`, ⌘Z. One undo step.
- **A shared piece:** `⧉ 2` after its kind in its name (`PAZAR · PLANE ⧉ 2`); Delete takes it off this canvas (toast
  says where it still is), `delete everywhere` through the hazard confirm; its console lists `CANVASES` (go there, `×`
  off one). Edits are one: a plane's cards, a table's cells are the same on every canvas.
- **Items across canvases:** `existing card…` and the card pickers (D-299) list every card, grouped by canvas then
  plane; a card's `PLANES` panel section says `Engineering / 02 Build` when the plane is on another canvas.
- **Finder:** the three scopes above; Tab steps through them; `everywhere` groups `# canvas / space · kind`; going to
  something on another canvas switches canvas first (the cell build-up), then glides as today.
- **Presence:** people here stay workspace-wide; someone on another canvas is a faint square with the canvas's name on
  hover; cursors only on the same canvas. Following crosses canvases. Others' selections only where they are.
- **Threads panel:** `whole workspace` / `on this canvas` / `inside "<plane>"`.
- **Export/import:** canvases, `canvasId` and `pieceSpots` go in the zip (v2 stays; a file without them is all `main`);
  ids remapped like the rest.

## Sessions

1. **done (D-305)** **Canvases themselves:** data, rules + tests, `?canvas=`, the breadcrumb prompt (new, rename, reorder, delete),
   switching with the build-up, presence `canvas`, camera per canvas, finder's `this canvas` / `everywhere`.
2. **Moving components:** `move to canvas`, with what it carries, toast, undo; several at once.
3. **Shared components:** `pieceSpots`, `also on canvas`, `⧉ N`, delete here vs everywhere, `CANVASES` in the console.
4. **Around it:** pickers and `PLANES` grouped by canvas, threads panel scope, following across canvases, ⌘1–⌘9,
   export/import.

## Found along the way

- (session 1) A thread on text or a plane on another canvas: the threads panel no longer calls it gone, but its go-to
  glides on the canvas shown; it should go to that canvas first, as the finder does (session 4, threads).
- (session 1) The breadcrumb's prompt has no ⌘1–⌘9 yet; its `[1]`…`[9]` letters work inside it (session 4).
