# Decisions (current)

What holds today, by topic: one line per rule, its D-numbers as anchors. The full entries (why, alternatives, what the
user said, how it was verified) are in [decisions-log.md](decisions-log.md) (`grep -n '^### D-108' memory-bank/decisions-log.md`).
Superseded decisions appear only there.

New decision: append its `### D-xxx` entry to the log, then add or edit its line here (edit the line it replaces, don't
stack a second one). Spec detail belongs in `/docs`, not here.

**1.0 is gone (D-177, D-248):** the canvas with its pieces is live, besides landing, workspaces, settings and presence.
1.0's code is deleted (in git at `493bf87`: `git show 493bf87:src/archive/<path>`) and its data unsupported; only old
reports move to documents. Its rules are in [decisions-1.0.md](decisions-1.0.md) (not auto-loaded): read them when a
feature comes back as a piece, and check them with the user then.

---

## Product
- Startup-ideation workspace for any kind of startup (B2B, B2C, anything); web only, sign-in required (D-008, D-043).
  Name North Star; Firebase project `north-star-db` (D-017).
- Card types: customer, problem, competitor (+ its features), idea, feature (D-007, D-040, D-041, D-042); chain order
  everywhere customers → problems → competitors → ideas → features (D-045).
- Customers, problems and ideas have a status (hypothesis, testing, validated, invalidated) and evidence (kind, text,
  supports/contradicts, source, date, link); the card reads `testing +2 −1`, `!` when they disagree (D-137).
- Customers are the segments: a `for` link tags a card with a customer; the FOR filter shows only theirs (D-044, D-119);
  `for` and `relates` lines are hidden by default, shown for the selected card (D-128).
- No domains: headings name areas and are places to go to (D-048, D-050); sections frame them (D-130).
- Tags group cards within a type, competitors too: white `#chips`, TAG filter (D-056).
- Competitors have regions (`US`, `Germany`, `Europe`, `Global`; known names + aliases, free text allowed), first on the
  card's meta line; the REGION filter narrows competitors only, a place counting inside the bigger ones (D-145).

## Stack, hosting, backend
- Static React SPA on GitHub Pages, deployed by Actions; three.js via @react-three/fiber for the backdrop (D-001, D-003).
- No app server: the browser talks to Firebase directly (Auth, Firestore, RTDB europe-west1); rules enforce security
  (D-002, D-014). The only server code: Cloud Functions for the workspace key, waiting for Blaze (D-079).
- Plain paths (`/workspaces/<id>`, `?focus=<id>`, `beside=`), BrowserRouter, index.html copied to 404.html; signing out
  goes to `/`; a link opened signed out continues after sign-in; paths only via `src/app/paths.ts` (D-070, D-174, D-248).
- Local dev and tests on emulators: a `demo-` project, test users Alice/Bob/Carol, RTDB on 9010 (D-020).

## Accounts, sharing, roles
- Google sign-in only, popup (D-011).
- Roles `owner | editor | viewer`, several owners, never none; `ownerId` is only the creator. Owners: people, roles,
  codes, invites, requests, workspace key, delete. Editors: all content. Viewers: read, own documents, own-key calls;
  the app locked for them (`editLocked`, tracked writes refused) (D-098).
- Joining: a code only *asks* and an owner approves in Settings, or an owner invites an email (no mail sent); a new
  code revokes the old (D-062).
- Owners delete a workspace (client-side cascade); anyone but the last owner may leave (D-023, D-098). People list
  `members/{uid}`, written by each member on open, paged 20 at a time (D-098).

## Data layer
- All DB access in `src/data/`; every write through `tracked()`: undo/redo by document snapshots (a cascade is one step;
  typing in a field and one drag merge), ⌘Z / ⇧⌘Z, local to the tab (D-046). Last write wins per field, no locks, no
  Yjs (D-071).
- No 1.0 data (D-248): cards and text always have a space (`pieceId`), threads a space (`planeId`) and a component;
  `domains`, `groups` (D-048, D-049), old `planes`/`placements`, `attachments`, `board` pieces, old presence views and
  1.0 exports are refused by the rules. Old `reports` (summary + `content/body`, private until `shared`, D-090) are only
  read and deleted, until moved to documents (D-232).
- Only the workspace's content loads up front; documents, people and usage load where shown, paged (`usePaged`), with a
  `Loading` line (D-083, D-098).

## Design language (DESIGN.md has the spec)
- 3D ASCII, mostly black and white with vivid accents (D-004); Geist for titles and long reading, Geist Mono for the
  rest, self-hosted (D-013, D-093). WebGL only behind; readable or editable text is DOM, never under the ASCII effect
  (D-009, D-019).
- Tokens only, no raw colours, sizes or tracking (D-069, D-093, D-097); `Frame.module.css` is the one framed surface
  (D-024); shared `Page.module.css`, `fieldLabel`, `small` buttons (D-093). Actions lowercase, labels uppercase; no
  native `<select>` (`src/ui/Select.tsx`) (D-093). `▸`/`▾` only open or fold something, never lead a row of actions (D-189).
- Defaults always dark theme, full motion, background on, whatever the OS; changed only in Settings → display (D-063,
  D-069). Light theme via tokens under `[data-theme='light']` and `usePalette()`, bg `#f5f5f5`, no-flash script (D-069).
- HUD (D-027): the breadcrumb top left, fixed margins; the rest becomes a left side nav. Bottom left, top to bottom:
  people here, threads button, a rule, your square, the gear, `--space-3` from the edges, other bottom-left tools
  `--corner-h` above (D-175, D-193). The side nav's tools at the middle of the left edge; its `+` an unframed drawn
  20 px magenta `+`, its menu opening right (D-178).
- Menus, pickers and right-click are a **prompt** (D-222; an empty heading is a plain rule, D-291): a `>` line narrowing the list (Enter picks the first), `#
  section` lines, rows `› [p] ▦ label  hint`, a letter puts its item first, a counting foot; Select: `•` current, the
  `>` line past 7 options.
- One look and behaviour across the canvas (consistency.md; agreed D-263–D-267, built D-270, D-272–D-277):
  - Surface (D-263, D-274, D-289): pieces graphite (`--piece*`, white in light) with a 2 px band in their kind's colour
    on top; inside a framed piece `--bg`/`--bg-raised`/`--grid-mark` map to that surface. In focus, beside it and
    unframed the page's black (`--bg`), what's held still `--piece-card`.
  - Console (D-264, D-275): where it is, shown only while pointed at (cells in 170 / out 90 ms), in edit mode, with its
    setup open or the keyboard in it; fresh comments keep a small tab; grows as the canvas zooms out (`--cs`, ≤ 1.4 ×);
    on touch a first tap shows it, a second focuses.
  - `Marks` (D-265, D-270, D-272; `src/ui/Marks.tsx`) on everything selectable: three tiers in screen px (a step down
    when small), distance = state, tone = what it is, cyan = what you can do, press 70 ms, release a spring; a drag goes
    0.8 round the point held with `<Landing>` L's where it lands (a kanban opens a gap); `<BoxSelect>`; others'
    selections as L's + a name tag in every view.
  - Resize (D-273): cyan handles on the ring, only when selected (paragraph, sticky, title: the right bar; section:
    right, bottom, corner; a piece in edit mode: every corner and edge; a table column: its head's edge); the moving
    edges lit and the size shown; pieces and sections move at 0.8 with landing L's.
  - Names and lines (D-266, D-276, D-277): two voices (system mono caps, user Geist); numbers magenta (a piece name's
    leading number, kanban columns, panel sections); containers edged, the name cut in (16 lead, 8 clear), held things
    banded; text's shade line by line (`src/ui/Ink.tsx`); lines: straight holds, fading opens, dashed separates rows, a
    magenta lead starts something numbered.
  - Framed = a window, unframed = ink (D-267, D-276, D-289): on a black page feathered at its edge, rows on hugging
    shades, the name a small line (`04 ── RIVALS · TABLE`), the console hanging under; framing turns cell by cell in
    320 ms. Dropdowns in a console or dock are plain text like the link `Select` (`Menu`'s `plain`).

## Motion and backdrop
- One entrance everywhere: cell-by-cell build-up in random order, all at once from `revealed`; components 320 ms,
  headline and page 400, text decode 260 (D-034, D-035); `<Appear>`, `src/ui/cellReveal.ts`.
- Loading = the flowing backdrop, then a cell-by-cell rebuild; nothing in the backdrop depends on per-canvas state (D-025).
- Backdrop: flows by itself (no pointer) in generations every ~9 s (D-026, D-028); 30 fps on demand, one texel per cell
  (D-063); a cell is 9 device px, stars by a sine-free hash, light ink near-black (D-172); dimmed to 8 % in workspaces
  (D-110). Welcome intro: stars, sunrise, the north star, 10 s; the light landing gets a night sky with tone sweeps (D-072).
- Motion `full | reduced | system` (default full), read through `useMotion().reduced`; background on/off (D-030, D-063).

## Canvas and pieces
- A workspace is one canvas (`/workspaces/<id>`, D-174): backdrop at full strength, no pages, no view tabs; 1.0's views
  come back as pieces (D-177, D-248). Settings keep you, general, people and export.
- Pieces (D-176): `pieces/{id}`, x/y/w/h in canvas px, a name. The side nav's `+` puts one at the screen's middle or the
  nearest clear spot, in edit mode (D-238). Drag pans, the wheel zooms round the pointer (0.1–4); over a plane too,
  out of focus (D-186). Fit (side nav, `0`; at once on a workspace's first open in a tab) frames all planes (D-202).
- Edit mode (D-180, D-182, D-183): a press on a piece is its own; only in edit mode does it move, resize (snapped to the
  canvas's 25 px grid, alt free, ≥ 325 × 200), take a name or get deleted; edit stays on until pressed off. Deleting
  asks in the hazard confirm (`src/ui/HazardConfirm.tsx`: dark screen, `╱╱╱` tape round the box once, ~1.5 s; cancel
  focused; ⌘Z brings it back; reduced motion: the tape just there).
- Planes (D-180, D-181, D-189): never "board" again (`kind: 'plane'`); terminal look, the name in the top edge, the console
  a tab on the bottom edge in the bottom-right corner (`[focus] [edit]`; editing: `EDIT 960 × 600 [delete] [done]`), no
  name or zoom in it (D-186); old looks (D-179) replaced by the surface, Marks and resize above.
- While zooming only the canvas's (or a focus's view's) transform changes; what's at screen size settles 120 ms after
  it stops (D-278, D-280), hidden till then except piece names (`data-zooming` on the world, `data-screen-sized` on
  each, D-293). A pan, on the canvas or in a focus, redraws and restyles nothing inside the world; per-step values never go on an
  element that holds the contents (D-279).
- A write draws what it changed (D-287): unchanged docs and cards keep their objects; `useWs()` redraws a component only
  when a field it read changes (`useWsNow()` for handlers); cards, table rows, matrix heads and kanban tasks are memoised
  on what they show, their handlers through a ref, a piece's frame too (D-288). The workspace's code is its own chunk
  (fetched ahead, one reload after a deploy); three.js, Firebase and React are files of their own that keep their names
  across deploys (D-288).
- Piece names (D-223): in the top edge of every piece, 13 px × zoom on screen (11–15), `--fg` caps weight 500, the kind
  faint after it (`PAZAR · PLANE`); the kind gives way first, then `…`, all of it on hover. Edit mode: a cyan-framed
  field, a `>` and `17/80`.
- Focus (D-184, D-185, D-189): `[focus]` or a double-click (D-198) makes a plane the view (`?focus=<id>`); the plane
  spreads like ink, cell by cell on the 9 px grid (820 ms in, 700 out, Esc or `[unfocus]`), its view gliding to its fit
  as the ink spreads and home as it draws back, the page easing graphite ↔ black with it (D-297); reduced motion: no
  transition. In focus: the focus dock, a tab on the bottom edge's middle, `[unfocus]
  esc` last; the breadcrumb ends with the plane's name; no `+`; the plane's own view (`planeCam`), fitted on arrival
  (D-186). The right of the screen stays free, except what's beside it (D-211) and the right panel.
- Finder (D-196, D-200, D-201, D-236): ⌘F or the side nav's compass, a prompt in the middle. Empty, the places: planes
  (their headings and sections folded under `[▸ N inside]`), the project title, H1/H2 headings, named sections, in
  reading order; typed, matches grouped by space (`here`, Tab `everywhere`) with a live preview of where you'll land.
  Enter or a double-click goes: it glides there, into a plane's focus first.
- Right panel (D-219): every panel on the right is a terminal column flush with its space's right edge, 400 px, full
  height, magenta corner marks, kind + `[×] esc`, a Geist title, `01 NAME ──` sections, a `[verb]` foot; cell by cell.

## Cards and links on planes
- Plane details (D-291, D-294): a card's face is `--card-tint` of its type's colour (16 %, light 9 %), on kanbans and a
  table's card names too (not tasks); `existing card…` last under a rule; a section or unfolded package dragged shrinks
  with what it holds as one, only its landing L's shown; text's L's on its edges, a heading's or paragraph's landing
  rounded up to the grid. Inside a tinted face the greys and the type's colour lean to the ink, every line ≥ 4.5 (D-295).
- Cards (D-187, D-205): in their own collections with `pieceId`, x/y in plane px, 200 × 100 (8 × 4 marks). Inside: type
  edge and label, status/regions/priority with evidence cells, Geist title ≤ 3 lines, facts, tag chips; smaller on
  screen, the title alone in whole words, then bars (D-152, D-153). On the canvas a plane shows a fitted picture; in
  focus click selects, drag moves (snapped, alt free), Delete removes. Deleting a plane takes its cards, links and text (cards also on another plane stay there, D-282).
- Made and named (D-250): `+` in focus makes a card at the view's middle with its panel open for the title (never typed
  on the card, D-221); Enter keeps it (Tab makes the next of its type beside it), Escape or nothing typed takes it away;
  making and naming are one undo step; paragraphs and sticky notes keep ⌘Enter. Wizards: Enter next, last makes it.
- Motion (D-150, D-203): arriving cards build cell by cell; drag at 0.8 with landing marks.
- A card's panel (D-221): what it is → what backs it → links by meaning → tags → notes, edited in place; `for` as link
  rows; a competitor's features by category, `≈ our`; a feature's plan, parts tree, must-haves, rests on + confidence,
  `≈ theirs`; a part shows its parent. Its pickers (and a task's card) are the prompt in place: `# suggested` first
  (a task's: its kanban's cards, its plane's; a card's: nearest), every card by type with its planes, scrolling (D-299).
- Links (D-207): `edges` drawn when both cards are on the plane; straight, arrowhead, kind colours, a chip (its own
  label in focus), side by side; drawn from a hovered card's `›` with its label ready; a bar: kind, label, reverse,
  remove. Always straight (no bend points, D-292); cards only (a competitor's features are matched, not linked, D-296).
- Parts (D-225, D-226): a competitor's features are small cards inside it, shown as it grows on hover (a strip of cells
  closed), open while selected; a folded feature, customer, problem or idea holds its parts as a tree inside it.
- One card on many planes (D-281; built D-282, D-283, D-284, D-285, D-286, D-290;
  docs/specs/shared-cards.md): the same card brought in by search (`existing card…` in the `+` and the right-click: the
  menu turns into the list where it was; ↵ bring, ⇧↵ more, ⌥↵ move here), its own spot per plane (`places/{planeId}_{cardId}`), parts and members along; Delete takes it off
  this plane when it's elsewhere too (a toast says where it still is; `delete everywhere` through the hazard confirm); `⧉ N` on the card;
  a `PLANES` panel section (go there, `×` off one, `+ place on`); naming a new card offers `≈ … [use that one]`; folding
  per plane; matrix, table, kanban, finder and comments count a card on every plane it's on (`isOnPlane`, D-286); ⇧⌘V
  brings the cards copied as the same cards, and a card's thread is where the card is (D-290).
- Several at once (D-227, D-229, D-230): shift+click, alt+drag a box, text too; drag together, arrows, ⌘C/⌘V/⌘D, Delete,
  Escape; the panel's `N selected` lines up, spaces out, tags all; others see it (`sel` + `more`), a follower takes it;
  a pan keeps it, only a click on the plane lets go.
- Focus dock tools: guides (D-231: magenta lines while dragging; `a` guides, `g` snapping, per browser, in `[view ▾]`,
  with comments `c`); `[filter]` (D-233: `SHOW FOR TAG REGION LINKS`, `for`/`relates`/`competes` hidden to start, per
  plane and browser, the canvas picture following); `[linked · N]` (D-235: the pieces stuck to it); strips stack 8 px
  over the dock.
- Right-click in a focused plane (D-237): a card's open / fold / copy / duplicate / delete; text's edit / copy /
  duplicate / delete; a link's label / turn round / kind / remove; several's copy / duplicate / delete; the plane's
  paste and add here.
- Packages (D-239, D-240, D-241, D-242, D-243, D-244, D-245): made from a selection (`package these`) or the `+`'s `package` (click or box cards, Enter); a
  member brings its parts; unfolded, a blue frame on the grid's marks round its members with a band on top that is the
  package (name, rating, cells, `[−]`; drags them all), others inside it faint; folded, a blue card of rows, a bar in
  each card's colour, a step in per level, `[+] N inside`; packages nest; links inside a fold hidden; a member's panel
  says `in package ↑`; its own panel: rating, holds, links, tags, notes, confidence from what it holds.

## Text on the canvas
- Text anywhere (D-188): `labels` with `pieceId` (`canvas` or a plane), x/y top-left in that space's px; from `+` in
  both; live on the canvas, in a plane only in focus; click, drag (snapped), double-click types, Delete; a bar under the
  selected one (sizes, B/I/AA, colours, delete). Canvas sections sit over planes.
- Kinds and looks (D-194, as 1.0 set them): headings H1–H3 (48/29/22 px, H1's rule fading right) with an optional small
  line (`02 ── WHO WE BEAT`); paragraphs (light Markdown, S/M/L, a left hairline, width from the right edge); any of
  them turns ±90; sections (drawn with a crosshair, the name a heading in the top or left edge, a number only when typed,
  carry what's fully inside, resized from the corner); the project title (the workspace's name and description, one per
  workspace, canvas only; name 92 px, star + PROJECT, folding round the name below 6 px, `titleLayout.ts`).
- Typed or not it reads the same (D-190): no frame, the item's face and size; the feathered shade only while typing (D-277).
- Sticky notes (D-158, D-162, D-257, D-259): `kind: 'sticky'`, paper in its colour (dark ink; pastel in light), a glue band
  with `ATAHAN · 2m`, never tilted, yellow default; 150 × 125 growing down with its text, folded back from `▾`
  (`folded`, shared); mono text S/M/L; from `+` or right-click; not a place.

## Matrix and table
- Matrix (D-204, D-212, D-216): made in a wizard (`+ → matrix…`: start from, rows, columns, cells, a preview). Axes:
  every card of a type (one plane or all), typed names, single cards; `×` hides or drops. Cells one kind per matrix: a
  scale of editable steps, a number (unit) or text, with a note, `—` doesn't apply, `~ ?` how sure, totals (heads, ends
  or both; squares, number or line). Looks: heads as plane cards, typed names mono over a dashed rule, a scale's cell a
  square filled to its step; each axis ends in a dashed card to add to. Cells in `cells/{matrixId}_{row}_{col}`.
- A cell can be `not relevant` (`—`, left out of readings, unlike `none`) and has a confidence `documented | inferred |
  guess` (`~` / `?`) (D-136).
- Criteria (D-133, D-249): a feature lists ≤ 8 it's `judged on`; an axis with `unfold` opens them as rows under it,
  scored in ordinary cells; the feature's cell reads from them; `◇ N open` = scored, met nowhere (white space); the panel
  says `met by N`.
- Table (D-209, D-213, D-218, D-224), the first lens: from `+ → table…` (every card, features, competitors, blank). Rows
  from rules (plane, type, status, tag, title; is / is not) + cards and names by hand; columns: the name, the cards'
  fields (read-only), its own (scale, number, text, check); a head's click sorts; widths dragged (48–640, shared);
  paged `‹ 2 / 5 ›` (rows a page shared, the page yours).
- Both as windows (D-206, D-208, D-214, D-217): on the canvas the whole table fitted in a window; focus glides the table to
  the middle while the page builds behind it, no ink; in focus heads stick when panned past, what you add is glided to,
  a drag from a cell pans; live: click, again steps, 1–9, arrows, Backspace, `-`, Enter; `[setup]` (a tabbed panel) in
  the dock.
- Unframed (D-228, D-289): matrix, table, documents, document, kanban, timeline; edit mode's `[unframe]` lays it on the
  canvas at its own size, live there, `[frame]` back (`open`, shared); its box exactly its contents' (`shownBox.ts`,
  measured ones in `sizes.ts`), the stored w/h the window's; it only moves.
- Sticking (D-210, D-215): moved within 48 screen px of a plane's edge it snaps one step out and is linked (`stuckTo`; alt
  free): a table's rule becomes `plane is …`, a matrix's typed axes the plane. Shown quietly (faint `· ›` touching, a
  thin line apart, under the pieces); the console's `⇆ 01 Pazar ▾` links and unlinks; the plane carries it.
- Beside (D-211): a plane's focus dock has `[⇆ kind · name]` for each piece stuck to it, opening it on the right (the
  screen split, `beside=`), each part its own view and dock; the line drags (25–75 %); a card selected lights its row,
  a row picked glides the plane to its card.
- A card's head in a matrix or table opens its panel on one click, the head lit; it follows a cell picked next whose
  row or column is a card (D-247).

## Documents
- Documents (D-232, D-234, docs/specs/documents.md): every file is a document (`markdown | image | pdf | report`; old
  reports moved over once), private until shared. A `documents` list piece (table or shelf) and a `document` piece (one,
  in a window; a private one asks first); both unframe (a document at most 6000 px, then `[continue reading ↗]`). Open
  beside the list: the list pinned left, "on this page", zoom 50–200 %, several side by side. Files need Storage (`.md`
  only until Blaze).

## Kanban, priorities, timeline
- Kanban (D-251, D-252): a piece (`+ → kanban…`) in the ledger look: columns as `01 TODO ──── 5` rules (renamed by
  double-click, `‹ › ✓ ×` on hover, `+ column`, one finished), tasks as sheets edged in their card's colour (title, given
  to, due, card, checklist, notes; in `tasks`); drag between columns (a cyan line where it lands), `+ task` types them,
  a click opens its panel; overdue magenta.
- Tasks and cards (D-254): a card's panel lists its tasks and adds one; the facts line ends `☐ 2/5`; a card still being
  tested offers `+ test it`, and its finished task `+ log what it taught` → evidence.
- Stuck to a plane (D-255): only that plane's tasks (`[this plane only · N hidden]`), beside it in its focus.
- More (D-256, D-258): `[filter]` (GIVEN TO, DUE, FOR, LABEL; per browser); `#labels`, `P1`–`P3`; column limits (`4/3`
  magenta); `[LANES ▾]` by person or card (dropping sets it), lanes fold; several at once like on planes.
- Together (D-260, D-261): picked tasks are your presence selection, a held one a ghost in your colour (`drag`);
  comments on tasks; `☐` by your square counts tasks given to you since you last looked (`givenAt`/`givenBy`,
  `threadReads.tasks`); the finder finds tasks.
- Timeline (D-262, D-289, D-298): a piece showing the tasks of the kanban it's linked to (else every kanban; no `shows`)
  on two weeks of days (rows by kanban, person or card; a drag sets the due day; late on today magenta; a no-day tray),
  stuck to a kanban and beside it; a kanban's `SOON` band. A plane carries its kanban and that kanban's timeline; going
  to a task from a timeline's focus that draws it stays there.
- Cards on a kanban (D-253, D-268, D-269): it holds tasks or cards (`holds`); cards from a source (the table's rules);
  columns one field's values (status, impact, effort, priority), rows another's, `no value` first; a drop sets the
  fields (one undo step); boxes can be named (`good` green, `bad` magenta).
- Priorities (D-271, as 1.0's D-138 on a kanban): template `priorities` (features + packages, effort × impact, corners named) with the suggested order
  beside it: impact × confidence ÷ effort, thirds as P1–P3, `P2 → P1` yellow, never written. One confidence rule
  (`cardFacts.ts`): validated 2, testing 1, share ≥ 0.75 high, ≥ 0.34 medium, else low; invalidated → broken.

## Collaboration
- Real-time collaboration with presence and live cursors (D-005); presence in RTDB `presence/{wid}/{uid}`, readable by
  any signed-in user, own node whole-node writes (D-016, D-065).
- Cursors (D-065, D-169, D-191): in your space's px (`plane` = the plane in focus); sent 10× a second, drawn 200 ms
  behind on a curve (D-193). Following (D-067, D-170, D-191) is total: into the plane they focus and out, their cursor
  kept in your middle (gliding only past ±22 %), their selection and panel yours until you click; a frame in their
  colour + `following … · esc to stop`; zooming doesn't stop it.
- Others' selections as L's in their colour with their name (D-191, D-272). Colours by join order (no clash up to 5),
  stored dark, drawn with `themeAccent` (D-067, D-069). People here: squares, never names, overlapping, `+N` past four
  (D-169). No typing indicator (D-071).
- Comments on components only (D-192, D-193, D-195): right-click a plane, card, text, link or task → `comment`; one open
  conversation per component; its chip under its bottom-right corner (mark + count, magenta new, `@` mention); a plane's
  own chip apart from what's inside it (`[💬 N inside]` on its console). Threads keep their space (`planeId`).
- Threads panel (D-197, D-199, D-220): one wide tab on the bottom edge, right of the corner's buttons; the list and the
  thread are two halves, each building and breaking cell by cell; a chip opens only the thread, `[all threads]` the
  list; it says what it shows (`whole workspace` or `inside "<plane>"`); `[on the canvas ↗]` goes there.

## Settings
- A modal from the gear or your square: YOU (account, display), WORKSPACE (general: name and "building" description;
  people; export); framed sections, rows with name + hint, notes at the foot; 960 × 720. The assistant's keys and usage
  come back with it (D-064, D-082, D-097, D-177).

## Export and import
- Export (D-080, D-246): a `.zip` (`north-star.workspace` v2, Settings → export) of every piece, card, link, text, cell,
  evidence, competitor feature, match, package, task (D-251) and the documents you can see with their content; never
  members, codes, threads or AI. Import (workspaces page) makes a new workspace with new ids, every reference
  following; 1.0 files refused (D-248).
- Attachments (D-083) went with 1.0; files come back as documents' files once Storage is live (D-232).

---

## Rejected: don't propose again
Tried or asked for and turned down by the user. Details in the log under the D-number.
- InstantDB (shutting down), Convex, Supabase as backend (D-010, D-014).
- Coloured tile waves for entrances, the blur "rise", a magenta edge on the page reveal, staggered/diagonal reveals (D-029, D-031, D-033, D-035).
- Floating post-its / 3D objects in the backdrop (D-028). Slowing the backdrop (D-061).
- Per-type 3D card silhouettes; per-card colour picker; notes on cards; "To feature" button (D-051, D-055, D-057).
- Domains (D-048); the old `groups` collection (D-049, frames are now sections, D-130). Double-click to create (D-061). Card lift on hover/drag (D-061).
- Cursor trail; typing indicator (D-067, D-071).
- Copy/paste across tabs and workspaces via the system clipboard; a minimap for big boards (D-116).
- A motion/theme control on the landing or outside Settings (D-069). Warm off-white light background (D-069).
- Intro: galaxy, nebula, Milky Way, shooting stars, Little Dipper lines, aurora; fades/fronts for the night sky (D-072).
- Orb: glossy anime eyes, eyes with pupils, pink blush on hover, kaomoji faces, glyph-cell faces; pomegranate as a "red
  queen with a crown"; `/nar` in the chat (D-078, D-092).
- The threads panel sliding up from the edge, its halves sliding their width; a new kind of motion (D-199): cells only.
- Chat window sliding in from the right (D-081). Saving whole chats (reports instead) (D-090).
- OpenAI deep-research models (need stored answers) (D-088). MCP for tools (no server) (D-074).
- Comma CSV for the matrix (D-080). A copy button for the TSV (D-080).
- Accordion-style dropdown look (D-093). An ASCII-glyph scroll bar component (D-105).
- Reports as a centred column; `show more` paging; a report opening by itself (D-093, D-102, D-106).
- Links routed by the app as right-angle elbows with lanes: lines shifted as others showed and hid, shape not the user's (D-155).
- Bend points on links, the user's own (1.0's D-155): not wanted, links stay straight (D-292).
- Links to a competitor's features; dropping a link on a small card (D-207/D-225's *Not yet*): not wanted (D-296).
- The table's paging and spacing leftovers (last page's height, arrows onto the next page, a viewer's `+` column, the
  faint `untitled`): not important (D-296).
- Competitor features as squares, spines or a strip beside the card; parts as nested dots, a tree or a frame; a separate competitor page (D-164).
- A real blur behind the open feature list (drew the board twice a frame and lagged) (D-173).
- Melting drips (ASCII running down the screen and from under the box) in the delete confirm: too much (D-182).
- A `!! FAULT 0x…` line on the confirm: not needed (D-183).
- Focus that zooms: the plane scaling up with its marks, the canvas behind scaling and fading, warp streaks; the marks slid
  about and it looked bad (D-185). Nothing on the right of the screen during or in focus (kept free for something else),
  except what's stuck to the plane, opened beside it (D-211).
- Piece surfaces tinted by kind, an ASCII texture, smoked glass, light paper (D-263). A scale readout on framed pieces (D-267).
- The console in the corner (or on the edge) nearest the pointer; focus in the top edge as a window title bar (D-264).
- Framed as a 3D block with a hatched thickness and unframed in a clearing of cells; unframed printed on a light sheet (D-267).
