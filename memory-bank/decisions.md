# Decisions (current)

What holds today, by topic. One line per rule, its D-number as the anchor. The full entries (why, alternatives, what the
user said, how it was verified) are in [decisions-log.md](decisions-log.md): read one there with
`grep -n '^### D-108' memory-bank/decisions-log.md` when you need the background. Superseded decisions appear only there.

New decision: append the full `### D-xxx` entry to the log, then add or edit its line here (edit the line it replaces,
don't stack a second one). Spec detail belongs in `/docs`, not here.

---

## Product
- Startup-ideation workspace for any kind of startup (B2B, B2C, anything); web only, sign-in required (D-008, D-043).
- Name: North Star; the Firebase project is `north-star-db` (D-017).
- Item types: customer, problem, competitor (+ its features), idea, feature, all on one board (D-007, D-040, D-041, D-042).
- Customers, problems and ideas have a status you set (hypothesis, testing, validated, invalidated) and evidence in their
  panel (kind, text, supports/contradicts, source, date, link); the card reads `testing +2 −1`, `!` when they disagree (D-137).
- Customers are the segments: a `for` edge tags an item with a customer, a chip on the card and a grey dashed line; the
  `for:` filter shows only the chosen customers' cards (D-044, D-119). The lines are their own LINKS group; it and
  `relates` are hidden by default (still shown for the selected card) (D-128).
- Chain order everywhere: customers → problems → competitors → ideas → features (D-045).
- No domains; text labels name areas and are the places you jump to (D-048, D-050); sections frame and group them (D-130).
- Tags group cards within a type: white `#chips`, TAG filter, Table column; competitors have tags too (D-056).
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
- Tokens only, no raw colours, sizes or tracking (`--text-*`, `--track-*`, `--measure`, `--fg-muted`, `--diff-*`, `--link-*`)
  (D-069, D-093, D-097). `src/ui/Page.module.css`, `fieldLabel`, `small` buttons shared (D-093).
- Actions lowercase, uppercase only for labels (D-093). No native `<select>`: `src/ui/Select.tsx` (D-093).
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
- Backdrop 30 fps on demand, one texel per cell, low-power; board renders on demand (D-063). Dimmed to 8% in workspaces (D-110).
- Motion setting `full | reduced | system` (default full); everything reads `useMotion().reduced` (D-030, D-063). Background on/off (D-063).

## Board
- 2.5D: flat board, perspective camera that pans and zooms, no rotation; zoom 9–150 (D-018, D-050).
- Flat cards, same rectangle for all; type = left border + label in the type colour; no notes on cards (D-055, D-057).
- Create only from the `+` menu (no double-click); cards don't lift or scale; dragged card sits under the pointer (D-053, D-061).
- Opening frames everything; fit-all button and `0`; view kept between tabs (D-060).
- Competitor features stack behind it and fan out once the click is released (D-058).
- Links: straight, arrowhead, kind written on a solid chip; colour by meaning in 4 groups (violet solves/part of, salmon
  competes/contradicts, sand inspired/depends, grey relates/for); hover/selection dims others; click a link → bar (kind,
  label, reverse, remove); LINKS filter (D-059, D-108). Several links between two cards sit side by side, chips staggered (D-113).
- `competes` lines are their own LINKS group, hidden by default, shown for the hovered or selected card; competitor cards say
  `vs N`; a link's own label shows on its chip only while it's hovered, selected or the selected card's (D-135).
- A competitor in focus (hovered, selected) lights the links to its features as well (D-115).
- Multi-select (shift+click, alt+drag box), group drag, "N selected" panel; ⌘C/⌘V/⌘D in-tab clipboard; `○` link handle (D-108).
  The panel lines up (align 6 ways, space out ↔ ↕), arrows nudge 0.25 (shift 1), presence `more` sends the whole selection (D-124).
- Sections: a named frame (label `kind: 'section'`, w/h), drawn with a crosshair (press, drag, release; never placed),
  holding by position whatever is inside it (cards, text, smaller sections); drag the band or edge carries it all, corner
  resizes, delete leaves contents, never copied; name set like text (H1–H3, B/I/AA), not scaled; kept in the focus view
  round the chain's cards (D-130).
- Labels: text on the board, sizes H1/H2/H3/note (heading/subheading/minor/note), bold/italic/caps, colour (D-130); jump list `go to` (headings and subheadings, not
  notes) with 1–9 and a search field inside the dropdown (D-050, D-108, D-116).
- Project title block: one per board from `+`, a `kind: 'title'` label showing the workspace's name + description (edited in
  place or from its right-click menu, same fields as Settings), star + `PROJECT`, rule, corner brackets (D-118).
  Its right edge drags its width (5–30, text rewraps, height follows); too far out to read the description it folds
  (animated): the name grows to fill the block, which shrinks only to what's left; the assistant keeps clear of it unfolded (D-132).
- Grid: `+` turns to dots and fades by camera distance (D-110). Depth range follows the camera; text and card detail by
  on-screen pixel size (full / compact / far) (D-111).
- Drags snap centres to a 0.25 grid (group drags keep their layout, alt = free); switch beside fit-all + `g`, on by default (D-112).
- Alignment guides: a dragged card pulls to other cards' edges/centres within 6 px, magenta lines; own switch + `a`, on by
  default. Right-click menu on cards, text, links, empty board (a right drag still pans) (D-117).
- Filters SHOW / FOR / TAG / LINKS, remembered per workspace (D-053, D-056, D-108).

## Other views
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

## Collaboration
- Real-time collaboration with presence and live cursors is in scope (D-005).
- Presence in RTDB `presence/{wid}/{uid}`, readable by any signed-in user, own node writable; whole-node writes (D-016, D-065).
- Live cursors on the board in world units; people chips in the HUD; follow someone (view + cursor, Esc stops) (D-065, D-067).
- Colours by join order (no clash up to 5), stored as dark hex, drawn with `themeAccent` (D-067, D-069).
- Selections shown in every view: board rings, Flow rings, Table bars, Matrix cells (`PeerMarks.tsx`) (D-067, D-068).
- No typing indicator (D-071).

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
- Chat window sliding in from the right (D-081). Saving whole chats (reports instead) (D-090).
- OpenAI deep-research models (need stored answers) (D-088). MCP for tools (no server) (D-074).
- Comma CSV for the matrix (D-080). A copy button for the TSV (D-080).
- Accordion-style dropdown look (D-093). An ASCII-glyph scroll bar component (D-105).
- Reports as a centred column; `show more` paging; a report opening by itself (D-093, D-102, D-106).
