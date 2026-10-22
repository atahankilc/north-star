# Decisions (current)

What holds today, by topic. One line per rule, its D-number as the anchor. The full entries (why, alternatives, what the
user said, how it was verified) are in [decisions-log.md](decisions-log.md): read one there with
`grep -n '^### D-108' memory-bank/decisions-log.md` when you need the background. Superseded decisions appear only there.

New decision: append the full `### D-xxx` entry to the log, then add or edit its line here (edit the line it replaces,
don't stack a second one). Spec detail belongs in `/docs`, not here.

**Archived (D-177):** branch `refactor/north-star-1.5` keeps only landing, workspaces, settings (you, general, people),
presence squares and the canvas live. Everything under Board, Other views, Assistant and Export/import below, and most of
Data layer, describes code now in `src/archive/` (out of the build). Those lines stand for when a feature comes back as a
piece; check them with the user then.

---

## Product
- Startup-ideation workspace for any kind of startup (B2B, B2C, anything); web only, sign-in required (D-008, D-043).
- Name: North Star; the Firebase project is `north-star-db` (D-017).
- Item types: customer, problem, competitor (+ its features), idea, feature, all on one board (D-007, D-040, D-041, D-042).
- Customers, problems and ideas have a status you set (hypothesis, testing, validated, invalidated) and evidence in their
  panel (kind, text, supports/contradicts, source, date, link); the card reads `testing +2 −1`, `!` when they disagree (D-137).
- Customers are the segments: a `for` edge tags an item with a customer, a chip on the card and a line; the
  `for:` filter shows only the chosen customers' cards (D-044, D-119). The lines are their own LINKS group; it and
  `relates` are hidden by default (still shown for the selected card) (D-128).
- Chain order everywhere: customers → problems → competitors → ideas → features (D-045).
- No domains; text labels name areas and are the places you jump to (D-048, D-050); sections frame and group them (D-130).
- Tags group cards within a type: white `#chips`, TAG filter, Table column; competitors have tags too (D-056).
- Competitors have regions where they operate (`US`, `Germany`, `Europe`, `Global`; known names + aliases, free text allowed),
  first on the card's meta line; REGION filter (filter bar + matrix footer) narrows competitors only, a place counts inside
  the bigger ones (Germany → Europe, Global everywhere); the assistant reads and writes them (D-145).
- Built-in example workspace "Tablebook" with invented competitor names (D-052).

## Stack, hosting, backend
- Static React SPA on GitHub Pages, deployed by Actions; three.js via @react-three/fiber (D-001, D-003).
- No app server: the browser talks to Firebase directly (Auth, Firestore, RTDB europe-west1); rules enforce security (D-002, D-014).
- Only server code: Cloud Functions for the workspace key (needs Blaze, not deployed yet) (D-079).
- Plain paths (`/workspaces/<id>/table?item=<id>`), BrowserRouter; build copies index.html to 404.html; old hash links upgraded;
  signing out goes to `/`; a link opened signed out continues after sign-in (D-070). Paths only via `src/app/paths.ts`.
- Local dev and tests on emulators with a `demo-` project and test users Alice/Bob/Carol; RTDB emulator on 9010 (D-020).

## Accounts, sharing, roles
- Google sign-in only (popup) (D-011).
- Roles `owner | editor | viewer`; several owners, never none; `ownerId` is only the creator. Owners: people, roles, codes,
  invites, requests, workspace key, delete. Editors: all content. Viewers: read, own reports, own-key calls (D-098).
- Joining: a code only *asks*, an owner approves in Settings; or an owner invites an email (no mail sent); new code revokes (D-062).
- Owners delete a workspace (client-side cascade); others leave; anyone but the last owner may leave (D-023, D-098).
- People list `members/{uid}` written by each member on open; Settings → people pages it 20 at a time (D-098).
- Viewers get the app in a locked mode (previewLock viewer mode, `editLocked`, tracked writes refused) (D-098).

## Data layer
- All DB access in `src/data/`; every write through `tracked()` for undo/redo by document snapshots (cascades = one step;
  typing in a field and one drag merge). ⌘Z / ⇧⌘Z, Delete key; local to the tab (D-046).
- Concurrent edits: last write wins per field, no locks, no Yjs (D-071).
- Retired collections (`domains`, `groups`) stay readable/deletable; old fields tolerated and ignored (D-048, D-049).
- Nothing beyond the workspace's items loads up front: reports, people, usage, attachment files load where shown, paged
  (`usePaged`), with a `Loading` line (D-098, D-083).
- Reports: summary doc + `content/body`; private to the author until `shared` (D-090, D-098).

## Design language (DESIGN.md has the spec)
- 3D ASCII, mostly black and white with vivid accents (D-004). Fonts: Geist for titles and long reading, Geist Mono for the rest, self-hosted (D-013, D-093).
- Hybrid rendering: WebGL scene, readable/editable text in the DOM; the ASCII effect never covers text (D-009, D-019).
- One framed surface (`Frame.module.css`) for panels, cards, forms, chips (D-024). One HUD on every page with fixed margins (D-027).
- The HUD becomes a left side nav piece by piece; first, you and settings stacked bottom left (rule, your square, gear),
  `--space-3` from the edges, bottom-left tools kept `--corner-h` above (D-175). The side nav's tools sit at the middle of
  the left edge; its `+` is an unframed icon like the gear, a drawn 20 px `+` in magenta, the tabs' bar under it when open (D-178).
- Tokens only, no raw colours, sizes or tracking (`--text-*`, `--track-*`, `--measure`, `--fg-muted`, `--diff-*`, `--link-*`)
  (D-069, D-093, D-097). `src/ui/Page.module.css`, `fieldLabel`, `small` buttons shared (D-093).
- No magenta `▸` before a row of actions (consoles, bars); `▸`/`▾` only to open or fold something (D-189).
- Actions lowercase, uppercase only for labels (D-093). No native `<select>`: `src/ui/Select.tsx` (D-093).
- Menus, pickers and right-click are a **prompt** (D-222): `>` line on top that narrows the list (Enter picks the first), `# section`
  lines, rows `› [p] ▦ label  hint`, letters put an item first, a counting foot; Select: `•` current, `>` line past 7 options.
- One column header for Flow/Table/Matrix/Reports (`TableHead.module.css`, 40 px) (D-107). One thin square scroll bar (D-105).
- Views as plain tabs with a sliding magenta bar; filters framed as `LABEL │ value ▾`, lit cyan when narrowing; dropdowns 30 px (D-066).
- Defaults always dark theme, full motion, background on, whatever the OS; changed only in Settings → display (D-063, D-069).
- Light theme via tokens under `[data-theme='light']` and `usePalette()`; light bg `#f5f5f5`; no-flash script (D-069).

## Motion and backdrop
- One entrance everywhere: cell-by-cell build-up in random order, all at once, starting at `revealed`; components 320 ms,
  headline 400, page reveal 400, text decode 260 (D-034, D-035). `<Appear>`, `src/ui/cellReveal.ts`.
- Loading = the flowing backdrop itself, then a cell-by-cell rebuild; nothing in the backdrop may depend on per-canvas state (D-025).
- Backdrop flows by itself (no pointer), lives in generations every ~9 s (D-026, D-028). Welcome intro: stars + sunrise +
  north star, 10 s; light theme landing gets a night sky with tone sweeps (D-072).
- Backdrop 30 fps on demand, one texel per cell, low-power; board renders on demand (D-063). A cell is 9 device px, so a 2x
  screen gets half-size glyphs and a finer field, the same on every screen move; stars by a sine-free hash, light ink near-black (D-172). Dimmed to 8% in workspaces (D-110).
- Motion setting `full | reduced | system` (default full); everything reads `useMotion().reduced` (D-030, D-063). Background on/off (D-063).

## Board
- 2.5D: flat board, perspective camera that pans and zooms, no rotation; zoom 9–150 (D-018, D-050).
- Flat cards, same rectangle for all; type = left border + label in the type colour; no notes on cards (D-055, D-057).
  Inside, 0.06 padding: header (type, then status/regions/priority with evidence cells), title ≤3 lines, a facts line,
  tag chips (D-152).
- Create only from the `+` menu (no double-click); cards don't lift, nor scale on hover/selection (D-053, D-061).
- Opening frames everything; fit-all button and `0`; view kept between tabs (D-060).
- On planes (D-225) a competitor's features are small cards inside it, shown as it grows on hover (a strip of cells while
  closed), and a folded feature holds its parts as a tree inside it; the old board's looks below stand for that board.
- Parts of the same type for customers, problems and ideas too, folded the same way; a competitor stays open while
  selected (D-226).
- Multi-select on planes (D-227): shift+click, alt+drag box; drag together, arrows, ⌘C/⌘V/⌘D, Delete, Escape; the
  right panel's `N selected` lines up, spaces out, tags all.
- The selection takes text too, everything on the plane moves together, and what's let go stays put until its data's
  back (D-229).
- Others see a selection of several (`sel` + `more`), a follower takes it; a pan on a plane keeps the selection and its
  right panel, only a click on the plane lets go (D-230).
- Alignment guides on planes (D-231): magenta lines while dragging; snapping on shows, off (`g`, alt) pulls within 6 px;
  `a` guides, `g` snapping, kept per browser; in the focus dock's `[view ▾]` (arrange, and show: comments `c`).
- Plane filters (D-233): one `[filter]` in the focus dock opens a console-look strip on it holding the old filter bar
  (`SHOW ▾ FOR ▾ TAG ▾ REGION ▾ LINKS ▾`, each its own menu) (`for`/`relates`/`competes` hidden to start); per plane, per browser; the canvas picture follows it.
- What's linked to a plane (D-235): `[linked · N]` in the focus dock opens a strip over it with the `⇆` buttons; strips
  stack 8 px over the dock, linked nearest, each within the plane's own part.
- Right-click in a focused plane (D-237): a card's open / fold / copy / duplicate / delete, text's edit / copy / duplicate /
  delete, a link's label / turn round / kind / remove, several's copy / duplicate / delete; on the plane, paste and add here.
- Packages on planes (D-239): made from a selection (`package these`) or the `+`'s `package` (D-240: click or box cards, Enter); a member brings its parts; unfolded, a blue frame round its members with
  a band on top that is the package (name, rating, cells, `[−]`; drags them all, opens its panel); folded, a blue card
  holding them as rows, `[+] N inside`; panel: rating, holds, links, tags, notes, confidence from what it holds.
- A competitor's features are names beside its card (first four, `+N more`, in the open list's order); selected (never on hover), the full list:
  each category's name in grey caps over its rows, no tray, not indented, rows drawn like cards (no edge, corner marks), a cyan bar when it matches ours and its
  availability; open or closing, it sits over every card and list, on a soft page-coloured shade (no blur: it lagged); rows open it in the panel and take links (D-164, D-173). Competitor features have availability and a source; "matches our feature" is the matrix cell's their feature (D-164).
- Parts (D-164): `part of` between features; `[−] 3 parts` folds them (and theirs) into the parent as indented names, per
  plane, shared; a row unfolds them; links to a folded part end at its row; a folded card carries its parts when dragged, nudged or lined up. Rows, tray and folding cards glide 280 ms, eased both ends.
- Links: straight; the selected link bends through points the user puts on it (drag a piece, drag a point, double-click
  to take out, `straighten`), kept relative to its cards' middle; nothing moves them by itself (D-155). Arrowhead,
  kind on a small framed chip (a card's small-text size, D-154); hover/selection dims others;
  click a link → bar (kind, label, reverse, remove); a link just drawn is selected with the cursor in its label; panel rows
  edit kind, label, reverse, remove, the one just added marked and lit on the board; menu `add label` (D-154); LINKS
  filter, one row per kind (D-059, D-108, D-146). Each kind its own clearly different colour, all
  solid lines: violet solves, sky part of, orange competes, raspberry contradicts, gold inspired, moss depends, grey
  relates, near-white for (D-147). Several links between two cards sit side by side, chips staggered (D-113).
- `competes` lines are their own LINKS group, hidden by default, shown for the hovered or selected card; competitor cards say
  `vs N`; a link's own label shows on its chip only while it's hovered, selected or the selected card's (D-135).
- A competitor in focus (hovered, selected) lights the links to its features as well (D-115).
- Multi-select (shift+click, alt+drag box), group drag, "N selected" panel; ⌘C/⌘V/⌘D in-tab clipboard; `›` link handle right of a hovered card (D-108, D-152).
  The panel lines up (align 6 ways, space out ↔ ↕), arrows nudge 0.25 (shift 1), presence `more` sends the whole selection (D-124).
- Planes (D-139, spec planes.md): one set of cards placed on many planes; All shows every card (today's board, no
  migration); per-plane placements, sections and text; links drawn when both ends are on the plane; packages are cards.
- On the board (D-140): `PLANE ▾` switcher, `existing ▾` to bring cards in, ⌫ takes cards off a plane (delete stays
  everywhere), cards made on a plane also land right of All, `on N planes` / `+N off-plane`, cursors per plane.
- Packages (D-141): a blue card type made with `package these` (home plane: the open one, or a new one from All), a
  frame round its members there, rated in priorities with confidence from its members; members by id, never cleaned up.
- The assistant on planes (D-142): a proposal lands on the plane open when it was made (moves → placements, new cards
  there + All's right column, text there); brief lists planes and packages; rows `add_plane`, `place_on_plane`,
  `take_off_plane`, `add_package`, `edit_package`; `/organize` may propose planes.
- Plane filter (D-143): one remembered plane per workspace, the board's open one; Flow and Table (filter bar), Matrix and
  Priorities (footer) show only its cards; a matrix with none of its competitors shows them all.
- Sticky notes (D-158, D-162): a label `kind: 'sticky'`, quieter than a card (darker paper, thin colour bar, yellow default),
  card width, as tall as its text, signed on a small top line (`uid`, `author`), mono text S/M/L under a card title; grows as
  you type; from `+` or right-click; not a place; the brief lists them.
- Sections look (D-157): thin frame, no fill, the name set into the top edge or up the left one (`side`), the line
  breaking round it, a number before it; a colour goes to the line and the name only.
- Sections: a named frame (label `kind: 'section'`, w/h), drawn with a crosshair (press, drag, release; never placed),
  holding by position whatever is inside it (cards, text, smaller sections); drag the band or edge carries it all, corner
  resizes, delete leaves contents, never copied; name set like text (H1–H3, B/I/AA), not scaled; kept in the focus view
  round the chain's cards (D-130).
- Labels: text on the board, sizes H1/H2/H3/¶ (heading/subheading/minor/note), bold/italic/caps, colour (D-130); jump list `go to` (headings and subheadings, not
  notes) with 1–9 and a search field inside the dropdown (D-050, D-108, D-116).
- Text look (D-156): headings left-aligned on their centre, optional small line over them (number in magenta), H1 rule
  fading right; `¶` is a paragraph (≤ 4000, light Markdown, wraps at a width dragged on its right edge, canvas texture);
  any text turns 90 / −90; hovered or selected, a card's corner marks; a paragraph's or note's width drags by a strip
  down its right side (D-163).
- Headings and paragraphs never turn into each other; paragraphs S/M/L 0.13/0.165/0.2, L the default, all under an H3 (`scale`, D-161, D-162); headings and section names drawn at any
  zoom; text editors follow the zoom; section hover/selection = a card's corner marks, the line keeps its colour (D-160).
- Project title block: one per board from `+`, a `kind: 'title'` label showing the workspace's name + description (edited in
  place or from its right-click menu, same fields as Settings), star + `PROJECT`, rule, corner brackets (D-118).
  Its right edge drags its width (5–30, text rewraps, height follows); too far out to read the description it folds
  (animated): the name grows to fill the block, which shrinks only to what's left; the assistant keeps clear of it unfolded (D-132).
- Grid: zoomed out a `+` stays a thin `+` (3 px arms, 1 px stroke, never a dot), every other then all but every fourth fade as
  they crowd, all gone before the zoom limit (D-110, D-151). Depth range follows the camera; text and card detail by
  on-screen pixel size (full / compact / far) (D-111): compact = the title alone, Geist 0.3, top, ≤3 lines cut at a
  whole word; far = the card stays, each title line a grey bar; no stars (D-153).
- `+` marks every 0.625 (cards 2.5 × 1.25 = 4 × 2 marks); a box's top-left corner snaps to a mark or one of the four even
  steps between two marks (0.125, not drawn; arrows nudge 0.125, shift 0.625) (D-149); on a mark a card's corners all sit on marks; marks drawn without perspective shift; with snapping on, guides only show
  lines (no pull); cards have no grey edge (D-148). Group drags keep their layout, alt =
  free; switch beside fit-all + `g`, on by default (D-112).
- Hover and selection are corner marks, no rim: grey a little out on hover, on the corners just inside the card in the type colour
  when pressed, just outside once selected. A press turns into a drag after 5 px; a dragged card goes 0.8 round the
  point held and follows the pointer, its corners on where it lands at full size (D-150).
- Alignment guides: a dragged card pulls to other cards' edges/centres within 6 px, magenta lines; own switch + `a`, on by
  default. Right-click menu on cards, text, links, empty board (a right drag still pans) (D-117).
- Filters SHOW / FOR / TAG / REGION / LINKS, remembered per workspace (D-053, D-056, D-108, D-145).

## Other views
- The old implementation is in `src/archive/` (paths mirror `src/`, out of the build, README there); features come back
  piece by piece onto the canvas; old paths open the canvas; settings keep you + general + people (D-177).
- No pages any more: a workspace is one canvas (`/workspaces/<id>`, D-174), backdrop at full strength, no grid, no view
  tabs, no assistant; the old pages become pieces placed on it. The board is at `/board`; other views by their paths for now.
- Pieces (D-176): `pieces/{id}` (x/y/w/h in canvas px, name); side nav `+` (D-178, opens right) puts one at the screen's
  middle, or the nearest clear spot round it, in edit mode to be moved (D-238); pan by drag, wheel zooms round the pointer (0.1–4). Each piece has its own
  background: a plane's is solid `--bg` with `+` marks every 25 px (`--grid-mark`), no backdrop.
- The first piece is a **plane** (D-180): never "board" again, in the UI or the code (`kind: 'plane'`; old docs say
  `board`, still allowed by the rules). A press on a plane is the plane's (the canvas doesn't pan); only in edit mode does
  it move, resize (≥ 320 × 200) and take a name (the name is a field), and Delete removes it; edit stays on until
  pressed off (D-180).
- Piece names (D-223): set into the top edge of a plane, matrix or table, held on the screen at 13 px × zoom (11–15 px),
  `--fg`, weight 500, caps, its kind faint after it (`PAZAR · PLANE`; unnamed: the kind alone, faint); the kind gives way
  first, then the name is cut with `…`, all of it while hovered. Edit mode: a cyan-framed field on the edge, a cyan `>`, the count `17/80`.
- Plane look (D-179, D-181): terminal style (picked from four on a preview): name set into the top edge, the console a
  tab inside the bottom-right corner on the bottom edge, magenta marks on its top corners (D-189), `[focus] [edit]`, no `▸` before them (no name, no zoom: D-186);
  the cards' corner marks, grey on hover; edit mode = the plane's own edge (no dashed line), cyan L grips just inside the corners that resize (a section's, D-194), short
  bars at the edge middles, and the console a cyan status line `EDIT 960 × 600 [delete] [done]` (D-182, D-189).
- Focus (D-184, D-185): `[focus]` (or a double-click on the plane, not in edit mode, D-198) makes a plane the view, `?focus=<id>` (back leaves, reload stays). Going in, the plane
  spreads over the screen like ink, cell by cell on the 9 px grid, nearest first with a ragged edge (820 ms, eased both
  ends); nothing zooms and its `+` marks never move (the layer carries them on the plane's grid at the canvas's zoom).
  `[unfocus]` or Esc draws it back into the plane (700 ms). The plane's console goes the moment it starts; in focus, once
  arrived, the focus dock: a tab on the screen's bottom edge, in the middle, `[unfocus] esc` last, other actions before
  it, no plane name (the breadcrumb has it) (D-189). Keep the right of the screen free, except for what's opened beside
  the plane (D-211). Breadcrumb ends with the
  plane's name; no `+` in focus. Reduced motion: no transition. What's different inside: the user will say.
- Pan and zoom (D-186): out of focus, drags and the wheel are always the canvas's, over a plane too (only edit mode
  takes the drag); in focus they're the plane's own view (`planeCam`), which glides home as focus leaves. A plane always
  shows its contents centred and fitted to its box; fit (side nav icon under `+`, key `0`; and at once on a workspace's first open in a tab, D-202) frames all planes on the
  canvas (≤ 1, 96 px round), or in focus the plane's contents (empty for now: its starting view); arriving in focus fits.
- Cards on planes (D-187): customer, problem, competitor, idea, feature in their old collections with `pieceId` (the
  old board's cards, without it, aren't shown), x/y in plane px, 200 × 100 (8 × 4 marks), D-152's look (type edge and
  label, Geist title ≤ 3 lines). Made from the side nav's `+` in focus (card types) at the view's middle, title typed at
  once; in focus click selects (corner marks), drag moves (snapped, alt free), Delete removes; the title is typed in
  its panel, never on the card (D-221);
  on the canvas they're a picture fitted in the plane, its marks following. Deleting a plane takes its cards.
- Card inside on planes as D-152/D-153 (D-205): status/regions/priority + evidence cells, title, facts (link counts 0
  until links), tag chips; by size on screen the title alone in whole words, then bars. Only shown until the panel.
- Links on planes (D-207): old `edges`, drawn when both cards are on the plane; straight, arrowhead, kind colours, chip
  (own label in focus), side by side; made from a hovered card's `›` (default kind, label ready), bar: kind, label,
  reverse, remove; hover shows its label; right-click → comment; deleting a card or plane takes its links. Bends, LINKS
  filter, hidden groups, competitor-feature links: later (the user's call).
- Card motion on planes as D-150 (D-203): arriving cards build cell by cell, corner marks grey out on hover, in the
  type colour just outside selected and on the corners pressed; a drag goes 0.8 under the pointer, marks where it lands.
  No side panel on a card click until it's refactored (the user's call).
- Matrix (D-204, D-206, D-208, D-212, D-214, D-216, D-217): a canvas piece made in a wizard from `+ → matrix…` (start from a template
  or my own, rows, columns, cells, a preview; D-212). Rows and columns: every card of a type (any plane or one) + typed
  names + single cards; `×` hides a type's card or drops a typed one. Cells one kind per matrix: a scale of editable
  steps, a number (unit) or text; a note; options doesn't apply (—), guesses (~ ?), totals (in the heads, at the ends or
  both; squares, a number or a line). Looks like cards crossed (D-212): heads drawn as plane cards (type colour, no type
  name), typed names mono over a dashed rule, a scale's cell a square filled to its step (or its glyph), corner marks
  for hover and selection, a note's fold and `~ ?` in the cell's corners; each axis ends in a dashed card to type a name
  or pick a card. `[setup]` opens a tabbed panel (rows · columns · cells · options, start over from) at the bottom of
  its space. On the canvas the window fits the whole table; in focus the heads stick to the screen's top and left
  when panned past, a row or column just added glides to the middle, the add field is unframed (D-214). Long head names take up to three or four lines; the setup's added-by-hand is pills plus one field
  that finds a card or takes a name (D-216). In focus a drag that starts on a cell pans (after 5 px; a click
  still selects); held row heads sit 56 px from the left, the side nav's shade fading meanwhile (D-217). On the canvas a window: a plane's edge, fill, name in the top edge and
  console, moved and resized in edit mode, no `+` marks (D-208), the whole table fitted in it (D-214); focus glides the table to the middle while the page builds cell by cell behind it, no ink (D-206). Live in focus (click, again steps, 1–9, arrows, Backspace, `-`, Enter;
  a bar under the cell); `[setup]` in the focus dock. Setup on the piece, cells in `cells/{matrixId}_{row}_{col}`.
- Table (D-209), the first lens: a canvas piece from `+` (templates every card, features, competitors, blank), a window
  like the matrix's (D-208, D-206's focus). Rows: a rule list (plane, type, status, tag, title; is / is not; any of the
  values; none required) + cards and names by hand; `×` hides or drops. Columns: the name first, then the cards' fields
  (read-only) and its own (scale, number + unit, text, check); a head's click sorts. Live in focus like the matrix;
  `[setup]` in the dock. Made in a wizard from `+ → table…` and set up in a tabbed panel (rows · columns · view), as
  the matrix (D-218). Paged (D-213): `‹ 2 / 5 ›` + rows a page (all, 10/25/50/100; shared) in its dock, the page yours.
  A row or column you add is followed in, the matrix's glide (D-214); a column's width drags from its head's right edge
  (48–640, shared, double-click resets) (D-224).
- Open on the canvas (D-228): edit mode's `[unframe]` takes a matrix or table out of its window (`[frame]` back) (shared, `open`): no edge or
  fill, its contents at their own size a grid step in, on a feathered page, live there (cells, adds, a table's pages and
  `[setup]` in its console); its box its contents' (`shownBox.ts`), the stored w/h the window's; it only moves; heads
  don't stick; not live in edit mode or while a plane's in focus; a cell's selection names its piece.
- Sticking (D-210, D-215): a matrix or table moved (edit mode) within 48 screen px of a plane's edge snaps one grid step
  out from it, the edge lit cyan, and is linked (`stuckTo`; alt = free): a table gets `where plane is … · auto` (changed
  by hand it's yours), a matrix's typed axes the plane. Links show quietly, grey, cyan on hover, no motion (D-215): the
  console says which plane (`⇆ 01 Pazar ▾`; no prefix on its name); touching, faint `· ›` cells in the gap and a notch on
  the plane's edge; apart, a thin straight line, never dashed; both under the pieces. Linked or unlinked from that
  dropdown (`link ▾` / `⇆ 01 Pazar ▾`, every plane + `unlink`); dragging never unlinks. A plane moved or resized carries all of it.
- Beside (D-211): in a plane's focus the dock has `[⇆ kind · name]` for each piece stuck to it; on, it opens on the right
  (the screen split, more stacked), in the address (`beside=`); each part its own area (own view, fit, setup, dock); a
  pane's dock is the focus dock, named `TABLE · name | [setup] [close]`; `[unfocus]` always there; `esc` shows only
  on what Escape does next (a setup, the last pane's close, unfocus); the line drags (25–75 %, per browser), so do the lines between stacked panes; a card
  selected lights its table row, a row picked glides the plane to its card.
- Go to (D-196): the side nav's grey compass under fit, now the finder's (D-236: ⌘F too; with nothing typed ↓ lists the places); on the canvas its planes (each
  with its own headings and sections on a line under it, folded until its framed `[▸ N inside]` opens them, D-200, D-201), project title, H1/H2 headings and named sections, in a focused plane its
  headings and sections, in reading order; glides there (planes, sections, title framed whole; a heading at 100 % near
  the top); a place in a plane focuses the plane first, then glides.
- Text anywhere (D-188): headings H1–H3 (48/29/22 px, H1 with a rule fading right), paragraphs (light Markdown, S/M/L,
  width from the right edge), sticky notes (signed, colour bar, yellow default), sections (frame drawn with a crosshair,
  number + name in an edge, carries what's fully inside it, corner resizes) and the project title (workspace name and
  description, one per workspace). `labels` docs with `pieceId` (`canvas` or a plane's id), x/y top-left in that space's
  px; the old board's labels (none) aren't shown. From the side nav's `+` in both spaces; live on the canvas, in a plane
  only in focus; click, drag (snapped), double-click types, Delete; a bar under the selected one (sizes, B/I/AA, colours,
  delete) at screen size. Canvas sections sit over planes (no fill). A plane's delete takes its text.
- Text as the old board set it (D-194): a section's name is a heading (H1–H3, B/I/AA) in the top edge or up the left one,
  the line breaking round it, `…` when too long, `--fg` on an `--edge` grey line, a number only when typed (`kicker`); headings
  carry a small line (`02 ── WHO WE BEAT`); headings and paragraphs turn ±90 (top-left kept); paragraphs a left hairline;
  corner marks close in while pressed and take the item's colour (a section's 32 px, an L grip). Project title at the old
  sizes (name 92 px, 26 px description at 72 %, star + PROJECT, magenta-lead rule, 48 px edge-grey brackets as its marks, 800 wide) and
  folding round the name when the description is under 6 screen px (320 ms, `titleLayout.ts`). Sticky notes at the old
  sizes (text 6.8/8.4/10.4 px, `ATAHAN · 2m`, ▚▚▚ in its colour, `--card-behind` paper, `•` bullets); paragraphs and
  sticky notes widen by a thin strip just inside the right edge, shown only while hovered or dragged.
- Text reads the same typed or not (D-190): fields keep the item's face, size and layout (no frame, same placeholder);
  a soft feathered shade of the page sits behind headings, paragraphs and the title so the backdrop dims under them.
  The project title goes on the canvas only (not in a plane's `+`).
- Planes snap to the canvas's 25 px grid (their `+` step) when moved, resized or added; alt = free; min 325 × 200 (D-182).
- Deleting a plane (console `[delete]` or Delete in edit mode) asks first in the hazard confirm (`src/ui/HazardConfirm.tsx`,
  for anything that can't be taken lightly): the screen darkens, the box steps in, ASCII hazard tape `╱╱╱` wraps round it
  from the box out, runs once (~1.5 s) and stops; the text decodes; no fault code; cancel focused; ⌘Z brings it back;
  leaving breaks apart cell by cell. Reduced motion: the tape is just there (D-182, D-183).
- Overview (D-144, reached by its path since D-174): the workspace read on one screen (next steps that prefill the assistant's mode, solid
  ground vs still a guess, riskiest bets, white space, worth a look).
- Focus tab right of Board (`/focus?on=<id>`): the board with only the card's chain (customer → problem → idea → feature
  both ways, never turning back) + competitors linked to its problems/ideas/features, in place, magenta ring; sections holding chain cards stay, fitted round them (D-130); picker,
  `[◎ focus]` in panels, right-click; no creating; presence says board (D-127).
- Flow (columns in chain order, one row per problem), Table (sortable, inline edits), Matrix (features × competitors,
  coverage 1–4, verdict), Reports; all share the filter bar and side panel (D-040, D-045).
- Frames as tall as their content, capped at the page (D-106).
- Priorities tab (after matrix): features on impact × effort (3 × 3, corners named), confidence from the status of what
  each rests on (its chain; `!`/0 when something it rests on is invalidated), suggested order impact × confidence ÷
  effort beside the priority set; impact set in the feature's panel; `/prioritize` (D-138).
- Matrix criteria: a feature lists ≤ 8 must-haves, a cell scores each `met | part | no` and then reads from them (blocks per
  criterion); `◇ N open` = criteria nobody meets (white space); edited in the feature or cell panel (D-133).
- A cell can be `not relevant` (`—`, left out of readings and counts, unlike `none`) and has a confidence
  `documented | inferred | guess` (`~` / `?` in its corner) (D-136).
- Reports tab: table alone, 10 a page with numbered pages, KIND/BY/SEEN BY filters + upload square in its top row; a report
  opens beside it (`?report=`), nothing opens by itself (D-103, D-106). Upload your own `.md` (≤512 KB), round-trips the download (D-091).

- Documents (D-232, spec documents.md): every file is a document (`markdown | image | pdf | report`; old reports moved
  over once), private until shared; a `documents` list piece (table or shelf, switched in its focus dock, or its console once unframed; framed, `[focus] [edit]` only) and a `document`
  piece showing one in a window; a private one put on the canvas asks first; files need Storage (`.md` only until Blaze).
  Both unframe onto the canvas like D-228 (live there, their open size measured as drawn; a document at most 6000 px,
  then `[continue reading ↗]` into focus) (D-234). A document open
  beside the list: the list pinned top-left at its size, the document the rest, "on this page", zoom 50–200 %; several
  side by side, `[hide list]`, `[delete]`; from the canvas a click opens it full screen. Escape: closes the document;
  list put away → a framed list back, an unframed one to the canvas. Rows carry their actions as marks (rename …) (D-232).
- Finder (D-236): ⌘F or the side nav's compass: one prompt in the middle (go to too); empty, just its line; typed, it glides
  out to matches grouped by space (`here` folds other spaces, Tab `everywhere`) and a real preview of where you'll land; Enter goes
  (into a piece's focus when it's in one), matches lit there until Escape.
- Right panel (D-219), for every panel on the right: a terminal column flush with its space's right edge (a piece's view
  or its part in a split; the screen for the canvas), 400 px, full height over the HUD bar, magenta left corner marks, kind +
  `[×] esc`, Geist title, `01 NAME ──` sections, `[verb]` foot; builds and breaks cell by cell. First: plane cards.
- A plane card's panel (D-221): what it is → what backs it → links by meaning → tags → notes; a section's add at its
  rule's right end; `for` as link rows; a competitor's features by category, opening in place, `≈ our`; a feature's
  plan, parts tree, must-haves, rests on + confidence, `≈ theirs`; a part shows its parent. Edited in place.

## Collaboration
- Real-time collaboration with presence and live cursors is in scope (D-005).
- Presence in RTDB `presence/{wid}/{uid}`, readable by any signed-in user, own node writable; whole-node writes (D-016, D-065).
- Live cursors on the board in world units; follow someone (view + cursor, Esc stops) (D-065, D-067). On the canvas
  (D-191): presence `plane` = the plane in focus (none = canvas), cursor in that space's px; you see cursors of people in
  your space; following is total: into the plane they focus and out (with the ink), their cursor kept in your middle,
  their selection yours; a frame in their colour + `following … · esc to stop` at the top middle. Selection marks: a
  frame in the peer's colour with their name round the card, text or plane they've selected. Sent ~16 times a
  second, no more; smoothed only where watched: drawn 120 ms behind on a curve through what arrived (D-169).
- Following someone also takes their selection, so their side panel opens for you (not in matrix or reports); your
  own click holds until they pick something else (D-170).
- People here in the HUD: squares only, never names, overlapping, name on hover, `+N` past four
  opens a list of everyone (D-169).
- Colours by join order (no clash up to 5), stored as dark hex, drawn with `themeAccent` (D-067, D-069).
- Selections shown in every view: board rings, Flow rings, Table bars, Matrix cells (`PeerMarks.tsx`) (D-067, D-068).
- No typing indicator (D-071).
- Comments on components only (D-193): right-click a plane, card or text → a menu (only `comment` now; nothing on empty
  space); one open conversation per component (commenting again opens it); its chip under the component's bottom-right
  corner like a plane's console (mark + count, magenta new, `@` mention), at screen size. A comment on a plane and the
  comments inside it are kept apart (D-195): the plane's own has its chip under its corner; its console says `[💬 N
  inside]` (only what's inside) and opens the threads panel on them. The panel always says what it shows: `whole
  workspace`, or `inside "<plane>"` in cyan with `[whole workspace]` back. The panel is one wide tab flush with the bottom edge,
  right of the corner's buttons (D-197): the list left, the picked conversation right; its top edge sets its height
  (kept per browser). Nothing opens on the canvas itself: list and thread are two halves that open apart (D-199); a chip
  or right-click → comment opens only the thread, `[all threads]` in it opens the list beside; closing the list closes
  both, closing the thread (×, Esc) leaves the list. The tab, and each half on its own, builds cell by cell as it opens and
  breaks apart as it closes (D-034's cells, no other motion). Go there: the place in the thread's
  header is a bracketed action like the rest, `[on the canvas ↗]`, the `↗` a size up, cyan on hover; no icon (D-220). Bottom-left corner, top to bottom:
  people here (squares, a column, follow on click), threads button, a rule, your square, the gear; the threads panel
  sticks to the bottom left beside them. Cursors sent 10×/s, drawn 200 ms behind; following glides only when their cursor
  leaves the middle (±22 %), eased by time; zooming doesn't stop following.
- Comment threads on the canvas and in planes (D-192): `planeId` = the space (`canvas` or a plane's id; the old board's,
  without one, aren't shown); pins on cards, text or a spot, at screen size; right-click starts one; the threads panel
  opens from the side nav's comment icon (under fit) to the left of the screen; a row takes you to its space and opens it.
- Comment threads (D-159): pinned to any card, text, section, sticky note, link or a spot (right-click → comment); any
  member, viewers too, as themselves; resolve/reopen; `c` hides pins; not undone or exported;
  the open thread looks like the assistant's chat box (bracket actions, terminal log, `>` prompt).
- Comments (D-165, D-166, D-167): one comment icon (a square speech bubble with three dots); pins are framed chips, icon +
  count (magenta = new for you, `@` = mentions you); the threads panel opens from a square icon button right of `+` with a
  count of new mentions (all/new/mentions/resolved); the filter bar's `COMMENTS` only sets what pins show; full names,
  no person colours; only a message's writer deletes it (owners only with the whole thread); `@` mentions members; read
  marks per person in `threadReads/{uid}`. A thread opened from the panel switches the board to its plane (the open one if
  what it's on shows there, else where it began, else All); rows on another plane say `on <plane> ↗` (D-168). A thread on something deleted has
  no pin, stays in the panel marked so, and comes back with ⌘Z (D-171).

## Settings
- Modal from the gear / account chip; grouped menu: YOU (account, display) · WORKSPACE (general, people, export) ·
  ASSISTANT (keys, usage); framed sections, rows with name + hint, notes at the foot; 960 × 720 (D-064, D-097).
- Workspace "building" description edited in general (D-082).

## Assistant
- Keys: own key only in that browser, calls straight to OpenAI (`store: false`); a workspace key goes once to `setWorkspaceKey`,
  kept encrypted in `aiSecrets/`, used only through the `ai` proxy; flag `WORKSPACE_KEYS_LIVE` until Blaze (D-006, D-079).
- Usage log for every call through `callAi`, never message text; who sees what per D-079; no prices in the UI (D-079).
- Models belong to the key that pays: own key default + per-workspace overrides; owners pick and allow models on the
  workspace key, enforced by the proxy; per-chat switch in the header; tasks chat / web / deep research (D-104).
- Orb: ASCII sphere with rounded-square eyes, moods, antics, chat reactions; pomegranate easter egg (`nar`) (D-073, D-078, D-092).
- Orb pushed off the small chat box's end by a wide side panel: falls, crashes on the floor (dizzy, then cross), peeks
  around the box's left side, hops back up when there's room (`perch.ts`) (D-121).
- Chat: terminal log look; empty = small box with the orb perched; first message grows it into a column beside the app
  (`[data-app]` narrows); a preview or report opens a stage, the chat glides left (D-081, D-094, D-095). Phones (≤760 px):
  the chat covers the screen, solid; beside a stage a `chat · preview|report` switch, the stage shrinking the chat to its header (D-114).
- `working on …` scope line above the prompt (D-109).
- Brief: plain text in `<workspace>` tags, data not instructions; North Star is the app, never the startup (D-082).
- Agent loop: up to 6 steps, `get_items`, `get_report`, last step `tool_choice: none`; steps listed live with their times,
  folded into `▸ N steps · 4.7s` once answered (D-084, D-099, D-114).
- `update_project` proposes the workspace's name/description (the project block); undo restores only those two fields,
  merged; new cards placed clear of the block (D-120).
- Edits: `update_competitor_feature`; matrix cells take `their_feature` and `not assessed`; in update rows and cells null
  keeps a field, `""` empties it (never a title/name) (D-122).
- Board text and single cards: `add_label` (size, colour by name, above a card), `edit_label` (text, size, colour, above
  another card; replaces `rename_label`), `move_card` beside another card; no coordinates in the prompt (D-123).
- Proposals (`propose_changes`): checklist, tick and apply as one batch + one undo step; deletes, unlinks, `arrange_area`,
  label rows, `edit_link`, `add_note` (D-074, D-075, D-086, D-108).
- Organising: `arrange_area` takes a layout (columns, rows, grid, line, hub; null = the app picks), `within` (a section,
  subheading) and `beside` + side; areas pack ~1.7:1 with room for link chips, never one long row (D-125). Fewer
  crossings, areas placed by their links, a lone existing area tidied in place; the model gets a layout report and may revise once (D-126).
- More shapes: `cycle` (a loop), `orbit` (one card, what links to it, then what links to those), `tree` (top-down by links),
  `quadrant` (an area's first four sections as a 2 × 2) (D-129).
- Areas are section frames by default (`frame`; a reused heading stays one), their sections nested frames; frames that
  stay are kept clear; `add_section` / `edit_section` / `delete_section`; label and section text set bold/italic/caps, H1–H3; areas take a colour (D-131).
- `add_evidence` (on a customer, problem or idea) and `validation` in `update_card`; `/validate` logs what you learned,
  `/gaps` lists unbacked cards (D-137).
- `set_criteria`: one row per feature, its criteria and every competitor's scores; a criterion kept word for word keeps its
  scores, dropped ones leave the cells; mode `/criteria` scores the matrix from what the workspace shows (D-134).
- Preview: the app shows the ticked rows as if applied, nothing editable, diff signs/colours, `was` values, stepper (D-087, D-096).
- `[web]` switch (off by default) with numbered clickable sources (D-076). Modes `/validate /interview /swot /gaps /next
  /pitch /organize /research /analyze /criteria` (D-085, D-086, D-088, D-099, D-134).
- Deep research: plan → pick → ≤3 web researchers → `write_report` report on the stage (D-088, D-089). Chat write-ups via
  `make_report`, saved on request (D-090). The chat's report on a `StageBox` with a section stepper (D-101); reports from the
  tab open in the tab, not on the stage (D-100).

## Export, import, attachments
- Export `.zip` bundle (format `north-star.workspace` v1), matrix `.tsv` (not CSV), board `.png`; import makes a new
  workspace with new ids, rebuilt from known fields (D-080).
- Attachments: images, SVG, PDF ≤10 MB in Firebase Storage, thumbnails, files never downloaded up front; hidden on the
  live site (`ATTACHMENTS_LIVE`) until Blaze (D-083).

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
- Competitor features as squares, spines or a strip beside the card; parts as nested dots, a tree or a frame; a separate competitor page (D-164).
- A real blur behind the open feature list (drew the board twice a frame and lagged) (D-173).
- Melting drips (ASCII running down the screen and from under the box) in the delete confirm: too much (D-182).
- A `!! FAULT 0x…` line on the confirm: not needed (D-183).
- Focus that zooms: the plane scaling up with its marks, the canvas behind scaling and fading, warp streaks; the marks slid
  about and it looked bad (D-185). Nothing on the right of the screen during or in focus (kept free for something else),
  except what's stuck to the plane, opened beside it (D-211).
