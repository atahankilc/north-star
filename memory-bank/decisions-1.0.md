# Decisions: 1.0, for when a feature returns

Not auto-loaded. The rules of North Star 1.0, whose code is deleted (D-177, D-248; in git at `493bf87`: `git show
493bf87:src/archive/<path>`). They are not current: read them when a feature comes back as a piece, and check them with the
user then. Current rules are in [decisions.md](decisions.md), full entries in [decisions-log.md](decisions-log.md). When a
feature comes back, its line moves to decisions.md (rewritten for the canvas) and leaves here.

### The old board
- Built-in example workspace "Tablebook" with invented competitor names (D-052); gone with 1.0, no example since D-177.
- 2.5D: flat board, perspective camera that pans and zooms, no rotation; zoom 9–150 (D-018, D-050).
- Flat cards, same rectangle for all; type = left border + label in the type colour; no notes on cards (D-055, D-057).
  Inside, 0.06 padding: header (type, then status/regions/priority with evidence cells), title ≤3 lines, a facts line,
  tag chips (D-152).
- Create only from the `+` menu (no double-click); cards don't lift, nor scale on hover/selection (D-053, D-061).
- Opening frames everything; fit-all button and `0`; view kept between tabs (D-060).
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

### The old pages
- One column header for Flow/Table/Matrix/Reports (`TableHead.module.css`, 40 px) (D-107). One thin square scroll bar (D-105).
- Views as plain tabs with a sliding magenta bar; filters framed as `LABEL │ value ▾`, lit cyan when narrowing; dropdowns 30 px (D-066).
- Overview (D-144): the workspace read on one screen (next steps that prefill the assistant's mode, solid
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
- Reports tab: table alone, 10 a page with numbered pages, KIND/BY/SEEN BY filters + upload square in its top row; a report
  opens beside it (`?report=`), nothing opens by itself (D-103, D-106). Upload your own `.md` (≤512 KB), round-trips the download (D-091).
- Selections shown in every view: board rings, Flow rings, Table bars, Matrix cells (`PeerMarks.tsx`) (D-067, D-068).

### Comments on the old board
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

### Assistant (its server side, D-079, is kept in `functions/`)
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
