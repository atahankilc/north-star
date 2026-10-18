# State History

What was done and verified, session by session, moved out of state.md on 2026-10-18 (verbatim). Not auto-loaded.
Append a `## Done (<topic>, <date>)` section here when work finishes; state.md keeps only the current snapshot.

## Done
- **Phase 0**: specs, memory bank, scaffold, ASCII design language, GitHub Pages workflow (commit `e114f34`)
- Backend: Firebase project `north-star-db` (Google auth, Firestore, RTDB europe-west1); `.env.local` filled; rules deployed
- **Rules verified**: `tests/rules.test.mjs`, 33 checks on the emulators (membership, invite-code join, roles, presence)
- **Emulator dev mode** (`npm run dev:emu`) with test users Alice/Bob/Carol (D-020)
- **Workspaces page**: live list, create (with invite code), join by code (case and dash insensitive), error states
- **Idea canvas** (`src/views/canvas/`):
  - R3F board: pan (drag empty board), zoom to cursor, faint `+` grid, dimmed ASCII backdrop
  - Cards: lit slabs, accent strip, SDF title/notes/tags, hover lift, stable layering
  - Create: double-click the board or `[ + IDEA ]` (nearest free spot)
  - Drag to move: live local position, writes streamed every 120 ms (collaborators see moves), smooth damping for remote moves
  - Shift+drag card → card to link; curved dashed animated edges; duplicates prevented
  - Detail panel: title, notes, tags, colour, links (change kind, remove, jump), two-step delete (also deletes its edges)
  - Invite chip copies the code; non-members see "not found or not a member"
- Verified end to end in Chrome on the emulators (create, edit, drag, link, join as Bob, Carol refused)

## Done (UI feedback rounds, committed in `76ff572`)
- Loading: flowing background + corner status, then a cell-by-cell top-left → bottom-right rebuild (D-025)
- Background flows like a fluid with no mouse influence (D-026)
- Fix: a single click on a card now opens the panel (the board underneath was deselecting it)
- One HUD with breadcrumbs and consistent margins on every page (D-027)
- Workspace card rename mode (`[save] [cancel]`), and message/actions split in every card footer
- Living background in generations; fixed the uniform bug that had kept it static (D-028)
- Removed the floating post-its (also fixes the post-it flash on reload)
- Pixelated wave on mount/unmount for forms, workspace cards, empty state, detail panel, invite chip, landing CTA (D-029)
- In-app motion setting in the HUD (D-030)
- Removed the magenta edge from the page-load reveal (D-031); idea cards wave in on the board (D-032)
- One entrance everywhere: cell-by-cell build-up (D-034), including the landing headline after sign-out; waves and rise removed
- Random cell order, everything animates together, faster (D-035: 320/400/260 ms)
- Workspace rename (card action + canvas header), delete for owners (cascades ideas, links, invite code), leave for editors (D-023)
- Consistent framed surfaces everywhere (D-024)
- Rules: 41 tests pass; deployed

## Done (Phase 2 first pass, checkpoint commit)
- Workspace layout route loads all collections once; HUD tabs `[ideas] features competitors matrix` (D-036)
- Data layer: generic `nodes.ts` (create/update/move/cascading delete), `edges.ts`, `comparisons.ts`; `ideas.ts` removed
- Board/cards/detail panel generic over `idea | feature`; features board with priority/status/effort; idea → "To feature" (D-037)
- Camera position remembered per board; `?n=<id>` selects and focuses a node from any link
- LinkList with a "+ link" picker across all node types; links into other views navigate there
- Competitors: rail + profile (autosave fields) + features grouped by category (D-038)
- Matrix: features × competitors, click to select / click again or 1–4 to set coverage, notes, "their version", verdict (gap / table stakes / mixed)
- Rules: collection allowlist + shape validation; 56 tests pass. **Not deployed yet** (old rules still allow everything for members, so the client works either way)
- Verified on emulators with headless Chrome (tabs, promote, jump, competitors, matrix)

## Done (Phase 2b step 1, 2026-10-17)
- Spec accepted with the user: customers are items and double as segments (`for` edges drawn as card labels), user-created,
  any kind of startup; Flow order Customers → Problems → Competitors → Ideas → Features (D-042 to D-045)
- Data: `domains`, `customers`, `problems` collections; `domainId` / `domainIds[]` on items; competitors get `x, y`;
  `src/data/domains.ts` (create, rename, delete → items become unsorted). Rules + 10 new tests (66 pass). Rules deployed 2026-10-17; step 1 pushed.
- One board (`/w/:wid`) with all five types, each with its own card shape (customer: rounded + `@`, problem: magenta band + `!`,
  competitor: wide double rim, feature: `◆`). Competitors without a position get a free spot on first view.
- HUD domain tabs (`[all] … + domain`, click the current tab to rename, `×` → `delete?`), filter bar (types + `for:` customers),
  view switch bottom-right (`board`, `matrix`). Filters and last `+` type remembered per workspace (`src/state/workspaceView.ts`).
- Side panel for every type with domain and `for` pickers; competitors open their profile there (`CompetitorProfile.tsx`, formerly the competitors page).
  Selecting a customer highlights its tagged items and shows those lines. Shift+drag picks a sensible link kind (`solves`, `competes-with`, `for`…).
- Matrix follows the domain tab. Old `/features` and `/competitors` routes redirect to the board. Links use `?n=<id>` (+ `&f=` for a competitor's feature).
- Verified on emulators with headless Chrome (seeded workspace; add/rename/delete domain, create + tag, customer highlight, competitor panel, matrix, redirects).

## Done (Phase 2b steps 2–3, 2026-10-17)
- **Table** (`/w/:wid/table`, `src/views/table/`): rows grouped by domain (multi-domain items show in each; unsorted last), sortable headers,
  inline name, domain/for pickers in portal popovers, feature priority/status selects, "linked to" summary; type opens the side panel.
- **Flow** (`/w/:wid/flow`, `src/views/flow/`): columns in chain order (D-045), one row per problem (its customers, competitors of it or its ideas,
  ideas, features), then ideas without a problem, customers with neither, and a "not linked yet" row; gaps read `(none researched)` etc.
- Both use the filter bar, domain tab and the shared side panel (`useSelectionScope` in `src/views/workspace/graph.ts`). View switch: board flow table matrix.
- Verified on emulators with headless Chrome (sort, tag via popover, inline rename, domain filter, flow rows and panel).

## Done (undo, 2026-10-17)
- Undo/redo + Delete key + toast (D-046). Verified on emulators: edit undo/redo, Delete-key cascade delete restored
  (competitor + its feature + matrix cell + link), create undone, a drag undone in one step.

## Done (groups, 2026-10-17; removed later the same day, D-049)
- Groups as frames on the board (D-047): `+ Group`, drag label to move with contents (one undo step), corner resize, group panel,
  Delete key, domain-aware. Rules + 3 tests (69 pass), deployed and pushed 2026-10-17. Verified on emulators (move with members, outside card
  untouched, undo, double-click inside creates a card, resize, delete keeps cards).

## Done (board rework, 2026-10-17)
- Removed domains (D-048) and groups (D-049) from UI, data layer and rules (retired collections stay readable/deletable).
- Text labels on the board + "go to" jump list with 1–9 keys and camera glide (D-050); zoom-out to 260.
- Per-type card silhouettes (D-051). Example workspace button (D-052).
- Rules: 69 pass. Verified on emulators: example creates, jumps, zoom-out, typing text on the board, undo of a new label,
  Flow/Table/Matrix with the example. Rules deployed and pushed 2026-10-17.

## Done (controls + settings, 2026-10-17)
- Zoom-out no longer clips cards (far plane 1000, limit 150). One `+` create menu, `show`/`for`/`go to` dropdowns,
  views as a menu bar beside the breadcrumb (D-053). Settings modal with account, workspace invite code, motion, later-phase
  placeholders (D-054). Verified on emulators with headless Chrome. Pushed later with the flat-card change.

## Done (flat cards + tags, 2026-10-17)
- Flat cards with type-colour left border + label, no colour picker (D-055); tags as grouping with TAG filter and Table column,
  competitor tags (D-056); breadcrumb name not editable. Rules: 71 pass, **not deployed**. Not pushed.

## Done (cards, panels, links, 2026-10-17)
- No notes on cards; `for` dropdown and tag picker in panels; "To feature" removed (D-057). Competitor feature stack that fans
  out (D-058). Links with arrows and kind labels (D-059). Fit-all on open; Matrix full height (D-060).
- Dev hook `window.__boardItems` (board items with ids) for automation.
- Verified on emulators with headless Chrome; rules 71 pass. **Rules (competitor tags) not deployed, nothing pushed.**

## Done (calmer board, 2026-10-17)
- No double-click create; cards don't lift/scale and drop exactly under the pointer; dimmer backdrop in workspaces (D-061; slowing it was reverted).

## Done (safer joining, 2026-10-17)
- D-062: a code no longer joins anyone by itself. It sends a join request the owner approves or denies in Settings
  (count on the Settings button, "· N waiting" on the card). Owners can also invite by email (no mail sent; the invite waits on the
  invitee's workspaces page) and make a new code. "Waiting" strip on the workspaces page for invites and your own requests.
- Rules: 108 pass, deployed and pushed 2026-10-17. The new client needs the new rules (joinRequests) and the old direct join is now refused, so
  deploy rules and push together. Verified on emulators with headless Chrome (Bob asks → Alice lets in; Carol invited by email → joins;
  duplicate request message; new code).

## Done (settings redesign, 2026-10-17)
- D-064: account chip + ⚙ icon button side by side; settings modal with a side menu (account / workspace / app) and pages on the right; tabs on narrow screens.
  Verified with headless Chrome on the emulators (all three pages, 390 px width). Ships the D-063 background on/off control. Pushed 2026-10-17.

## Done (motion default + background switch + GPU, 2026-10-17)
- Full motion by default, `background: on | off` in Settings → app (signed-in pages only), field at one texel per cell,
  backdrop 30 fps on demand + low-power context, board on demand (D-063). `postprocessing` packages removed.
- Verified with headless Chrome on emulators: landing 30 renders/s, idle board 0 draws, panning draws, background off removes
  the canvas, the landing still flows after sign-out; same frame as before at a pinned clock (glyphs a touch crisper). Not committed.

## Done (go-to fix, 2026-10-17)
- "go to" jumps glide every time: `flyTo` now asks the on-demand board (D-063) for a frame, so the glide starts by itself; before,
  it only moved if something else happened to draw a frame. Verified headless: jump, pan, jump again (and to other labels).

## Done (presence + live cursors, 2026-10-17)
- D-065: `src/data/presence.ts` (session hook, throttled whole-node writes, heartbeat, stale filter), `PeerCursors.tsx` (cursor reporter +
  remote cursors with glide and cell trail), peer-selection rim on cards, `PeopleHere` in the HUD.
- RTDB rules tightened (field types, view list, no unknown fields, `ts <= now`); 116 rule tests pass; **rules deployed** 2026-10-17.
- Verified with two headless Chromes on the emulators (Alice sees Bob's cursor and name at the right spot, his selection rim,
  "Bob · table" after he switches views, gone after he closes the tab). **Not committed or pushed.**

## Done (view tabs, 2026-10-17)
- D-066: views as unframed tabs with a sliding magenta underline; dropdown triggers a fixed 30px tall (`go to` was shorter);
  breadcrumb collapses to `#` below 760px. Unframed gear (magenta bar while open), rule before the account chip. Filters: `LABEL │ value`,
  type-colour squares for SHOW, lit (cyan) when narrowing. Verified headless on emulators at 1280 and 390 px. Not committed.

## Done (follow + typing + colours, 2026-10-17)
- D-067: follow a person (view + cursor, framed page, Esc), one ring + name per person on a shared card, `Bob ✎ title` on the card /
  panel strip / field outline, join-order colours (no clashes up to 5), own colour on the account chip, cursor trail removed.
- Rules (+ `edit`, `field`, `since`): 118 pass, **deployed** 2026-10-17 (a superset, safe for the live client).
- Verified with three headless Chromes on emulators (rings + names, `Bob ✎ title` outline in Carol's panel, distinct colours,
  Alice follows Bob to x=30 and into Table, Esc stops). Not committed.

## Done (selections in every view, 2026-10-17)
- D-068: Flow rings + names, Table colour bar + names, Matrix cell rings + names (cell selection broadcast), header tags for selected
  features/competitors. Verified with three headless Chromes on emulators. Light-mode prep: tags use `var(--on-accent, #000)`, washes use
  `--wash-*` tokens with the old values as fallbacks (tokens come with light mode, D-069, other session). Committed and pushed.
- Known dev-only console warning: drei `<Html>` (cursor tags, card name tags) logs "synchronously unmount a root" when the board unmounts
  while one is shown. Harmless.

## Done (readable URLs, 2026-10-17)
- D-070: `/workspaces/<id>/table?item=<id>` instead of `/#/w/<id>/table?n=<id>`; sign-out lands on `/`; a link opened while signed
  out continues after sign-in; old hash links are upgraded; build writes `404.html`. Verified headless on emulators (old link → `/`
  → Alice continues to it; example → table tab → reload deep link; sign out → `/` with nothing remembered → Bob lands on `/workspaces`;
  `?item=` selects the card and opens its panel). Not committed. First push: check a deep link on the live site loads (404.html).

## Done (light theme, 2026-10-17)
- D-069: `theme: dark | light | system` in Settings → app (default dark), tokens + WebGL palettes, a printed ASCII backdrop on paper,
  theme-aware presence colours, no-flash script in index.html, neutral grey light background (#f5f5f5; warm off-white rejected). The motion switch is removed from the landing (user request). CLAUDE.md: defaults are always dark / full motion / background on; changes only in Settings.
- Verified headless on emulators in both themes (landing, workspaces, board + panel, table, flow, matrix, settings); dark looks unchanged. Not committed.

## Done (Phase 3 wrap-up, 2026-10-17)
- D-071: removed the typing indicator (`edit`/`field` writes, `Bob ✎ …` on cards, field outline); the panel strip says `Bob is here`.
  Following across views verified on the new `/workspaces/…` routes (D-070). Not committed.

## Done (welcome intro, 2026-10-17)
- D-072: stars fill the sky while a red-orange sunrise glows low from the lower left (from the bottom edge; the landing's headline scrim
  fades in only as the intro ends), the north star last (upper right), then a slow melt into the flow (first 10 s of the backdrop).
  Galaxy, nebula, Milky Way and shooting stars removed (user). "North" r/t no longer touch.
  Light theme: the ASCII pass now blends ink in sRGB, so stars, the north star, the orange glow and the flow print as strongly as dark
  shows them (they were nearly invisible). Verified headless (dark timeline 1.5–11 s; light at 5.5 s and 12 s; light example workspace
  on emulators: cards still read fine over the 14% backdrop). Committed and pushed 2026-10-17 (`1f7688b`).
- Light night sky (D-072, after `1f7688b`): signed out only, the landing's light-theme intro is a dark-blue sky with white stars, a
  brighter sunrise and light text; it sweeps in with the page's entrances as eight tones crossing diagonally from the bottom left
  (0.8 s) and goes out the same direction from 8.4 s; text follows the sweep. Signed-in pages see the intro on paper. Verified headless (light reveal / 3 / 8.7 / 8.8 / 9.3 s, signed-in /workspaces in
  light on emulators: no night). Committed and pushed 2026-10-17.

## Done (Phase 4.1: assistant orb + chat, 2026-10-17)
- D-073: ASCII orb with eyes bottom-right in workspaces → chat panel; OpenAI key in Settings → ai or in the chat; gpt-6-luna; read-only
  workspace brief per message. Build passes. Verified headless on emulators with OpenAI mocked (key check, streaming answer, brief contents,
  Escape closes). The user tried it with a real key: works. Committed and pushed 2026-10-17 (`5e68424`).

## Done (Phase 4.2a: proposals, 2026-10-17)
- D-074: `propose_changes` tool, `[ref]`s in the brief, checklist under the answer (dependencies, live validity), apply = one batch +
  one undo step, new cards placed in their type's column. Verified headless on emulators with OpenAI mocked (9 rows incl. a bad ref,
  unticking an idea drops its links, apply → cards in their columns, next turn carries the outcome, one Ctrl+Z removes all).
  The user tried it with a real key: works.
- D-075: deletes and unlinks in proposals (cascade like a hand delete, one undo step, clashing rows off); prompt wires new items into
  the chain, adds a missing customer/problem, commits to judgements. Verified headless on emulators (delete ShiftGrid: its 9 mentions
  gone from the brief, a real unlink, a clashing matrix row off, a not-linked unlink disabled; one Ctrl+Z brings all back).
  The user tried it with a real key: works. Committed and pushed 2026-10-17.

## Done (Phase 4.2b: web research, 2026-10-17)
- D-076: `[web]` switch in the chat (off by default, remembered), OpenAI `web_search` tool, search status + queries, numbered clickable
  sources, links in answers, `Sources:` in proposed competitor notes and `sources:` on checklist rows. Verified headless on emulators with
  OpenAI mocked (tool sent only when on, prompt matches, sources and links render, proposal shows domains, switch survives reload).
  The user tried it with a real key: works. Committed and pushed 2026-10-17.

## Done (competitor fan-out fix, 2026-10-17)
- D-058 refined: a competitor's features stay stacked while it is pressed or dragged and fan out when the click is released
  (`pressing` in `canvasStore`). Links to a stacked feature always show, drawn to the competitor card (one line per card pair).
  Verified headless on emulators (example workspace, stacked and fanned). Committed and pushed 2026-10-17.

## Done (Phase 4.2c: model per task, 2026-10-17)
- D-077: Settings → ai → models: chat and research pickers (4 listed models + any id; prices removed by D-079), checked against the key before saved,
  research used while [web] is on, header shows the model in use. Verified headless on emulators (research → gpt-6.1-sol saved; bogus id
  refused with "Still using …"; requests go to gpt-6-luna with web off and gpt-6.1-sol with web on). Committed 2026-10-17 with D-079.
  **Phase 4 is done.**

## Done (orb redesign, 2026-10-17)
- D-078: bigger orb (88 px), Grok-style eyes, six hover moods, ten idle antics + sleep, chat reactions (curious, thinking,
  yapping via the new `talking` mood, tired, sad/dead on close, revive), no tooltip. Dev hooks `__orbAntic`, `__orbFace`, `__orbReact`.
  Verified headless with a temporary preview page (every expression captured). Committed 2026-10-17.

## Done (Phase 4.3: workspace key + usage log, 2026-10-17)
- D-079: `functions/` (setWorkspaceKey, aiMembers, ai streaming proxy, cleanUpWorkspaceAi), rules for `ai/config`, `aiUsage`, `aiSecrets`
  (142 rule tests pass), `callAi` wrapper logging every call, Settings → ai → keys / usage, key choice per workspace, prices removed from
  the UI (estimates only in the log). CLAUDE.md key rule updated (user approved). Verified end to end on emulators with two headless
  Chromes and a fake OpenAI (key stored encrypted only; Bob refused, then allowed; his call reaches OpenAI with Alice's key and store:false;
  server-written log; Bob sees his, Alice sees Bob by person; Bob's own-key call logged by him and invisible to Alice).
  Committed and pushed with the rules deployed 2026-10-17; the workspace-key section is hidden on the live site
  (`WORKSPACE_KEYS_LIVE = false` in src/data/ai.ts) until functions deploy. **To finish: Blaze (the user's payments profile
  was refused once, OR_BAOOC_15; retrying after 24 h, likely a profile country vs German card mismatch), `AI_KEY_SECRET`,
  `npm run deploy:functions`, flip the flag, try with a real key.** Workspace-delete cleanup trigger not exercised yet.

## Done (Phase 5 part 1: export, import, TSV, PNG, 2026-10-17)
- D-080: Settings → workspace → export (.zip bundle, matrix .tsv, board .png without the grid); "import" strip on the workspaces page. `src/io/` (bundle, tsv),
  `src/data/importWorkspace.ts`, `src/views/matrix/reading.ts`, `Snapshot` in Board.tsx. New dependency: `fflate`. No rule change.
- Verified headless on emulators in dark and light: example → zip/tsv/png downloaded; zip imported as a new workspace whose re-export has
  the same counts, the same links and the same matrix cells by name, with new ids; a non-export file is refused. Build passes. Committed and pushed 2026-10-17.

## Done (assistant window, 2026-10-17)
- D-081: the chat is a resizable full-height window on the right; the app (`[data-app]`, `contain: layout`) makes room; the orb
  glides into its header; framed composer; full screen below 760px. Verified headless on emulators with OpenAI mocked
  (1440 dark, 1280 light, 390 narrow: open, streamed answer, close with the sad/dead reaction).
- D-081 second pass: instant app width + board keeps its left edge + FLIP glides (glide.ts), window lifted up by the orb,
  black see-through window, orb glides around side panels with bumped/free reactions. Verified with a timestamped CDP screencast
  on emulators (open, close, side panel in and out: no board jump). Committed 2026-10-17 (not pushed).

## Done (small cleanups, 2026-10-17)
- PeerMarks (Flow rings, Table bars, Matrix cells, name tags) draw presence colours in the theme's shade: `usePeersOn` maps them
  through `themeAccent` (D-069). Retired `edit`/`field` dropped from database.rules.json (D-071); rules 145 pass, **deployed** 2026-10-17. Committed 2026-10-17 (not pushed).

## Done (assistant knows the startup, 2026-10-17)
- D-082: the prompt says North Star is the app, never the startup; brief starts with `WHAT WE'RE BUILDING` and is wrapped in
  `<workspace>` tags; Settings → workspace → building edits `workspace.description` (example and import fill it). Rules: 145 pass,
  Firestore rules deployed (database.rules.json left alone: another session's `edit`/`field` removal). Verified headless on
  emulators with OpenAI mocked (field shows the example text; an edit reaches the next request's instructions). Committed and pushed 2026-10-17.

## Done (assistant agent loop, 2026-10-17)
- D-084: up to 6 steps per answer, `get_items` (read items in full), proposals report bad rows back and can be redone in the
  same answer, last step `tool_choice: none`. Each answer lists its steps live (searched / read / proposed / thinking). Proxy whitelist passes `include` + `tool_choice` (not deployed). Verified on
  emulators with a fake OpenAI. Committed (not pushed). The user tried it with a real key: works, including a [web] answer that
  also calls a tool (`web_search_call` items are accepted back with store:false; checked 2026-10-18).
- D-085: analysis modes (`/validate /interview /swot /gaps /next /pitch`) in the empty chat and a `/` menu; a mode uses the
  selected card when it fits. Caret only while text streams. Verified on emulators with a fake OpenAI.
- D-086: board organising: `arrange_area` / `rename_label` / `delete_label` rows, layout in `src/ai/arrange.ts`, `/organize`
  mode; one undo step. Verified on emulators with a fake OpenAI.
- D-087 (2026-10-18): preview a proposal in the app (`[preview]` in the checklist): every view shows the ticked rows as if applied,
  with new/edited/moved/deleted marks; a bare screen (no HUD/filters/tools, own view tabs) where nothing is editable; Esc closes. Functional only: the user will redesign the assistant UI
  and the preview's look later. Verified on emulators with a fake OpenAI.
- D-088 (2026-10-18): deep research (`/research <topic>`): plan → pick questions → up to 3 web researchers at once → one report
  with sources, a proposal and `download report .md`. Verified on emulators with a fake OpenAI; the user tried it with a real key: works.
- D-078 to D-088 committed and **pushed 2026-10-18** (live deploy green; deep links serve the app via 404.html).
- D-089 (2026-10-18): research reports are structured (`write_report`) and open on a report screen (answer, sections with
  numbered sources, implications with item links, open questions, sources, .md); light Markdown (lists, bold) in answers.
  Verified on emulators with a fake OpenAI. The user ran a real `/research` with D-088 + D-089: works. Committed and pushed (`576d826`).
- D-090 (2026-10-18): reports tab (`/workspaces/<id>/reports`): research reports saved at once for their author, `share` shows
  them to the workspace; any chat can be written up as a report on request (`make_report`), saved when you press save.
  Rules: 191 pass. Verified on emulators with headless Chrome, two users and a fake OpenAI. Firestore + RTDB rules **deployed** 2026-10-18
  (a superset, safe for the live client). D-091: `upload .md` on the reports tab (own Markdown reports, parsed to the same
  shape; round-trips the report screen's download); rules 193 pass, deployed 2026-10-18. Committed and **pushed 2026-10-18** (`a86583c`, live deploy green). The user tried reports with a real key 2026-10-18: works.
- Assistant roadmap with the user (in order): agent loop, analysis modes, board layout, preview, deep research, saved
  reports (all done; whole chats stay unsaved, the user chose reports instead) → the user's
  own redesign of the assistant UI and the preview (started: D-094) → reading attachments (after D-083).

## Done (orb easter egg, 2026-10-18)
- D-092: once in a long while the idle orb turns into a pomegranate (squat fruit shape, small dark calyx, speckled skin, an open slice of seeds) for 28–45 s, then bursts into seeds and the plain orb builds back;
  typing `nar` outside a text field turns it (and back). Verified headless with a temporary preview page (dark + light, `__orbPom()`;
  `nar` in an input does nothing, `Nar` on the page turns it, `nar` again turns it back). Build passes. Committed and pushed 2026-10-18.
- Fix (2026-10-18): a second `nar` after the burst turned nothing red (`popped` stayed true after the burst, so `pomK` never
  grew again); it's reset when the plain orb is back. Typecheck passes; not checked in a browser. Committed.

## Done (Phase 5: attachments, 2026-10-17, on the emulators only)
- D-083: images, SVGs and PDFs on every card and competitor (`src/data/attachments.ts`, `src/views/workspace/Attachments.tsx`):
  thumbnails + lightbox, file rows, attach button + drop on panel, progress, undoable remove, `N files` on the card, names in the
  assistant brief, export/import with files. `storage.rules` (new), `firestore.rules` (`attachments`), `cors.json`, storage emulator
  on 9199. Hidden on the live site (`ATTACHMENTS_LIVE = false`). Rules: 165 pass. Build passes. Committed 2026-10-18 (`350243b`), pushed 2026-10-18 (still hidden on the live site).
  Firestore rules deployed 2026-10-18 (`--only firestore:rules`); storage.rules wait for Blaze.
- Verified headless on emulators: an 18 MB 4000×3000 PNG became a 289 KB 2560×1920 WebP with a 320×240 thumbnail; PDF and SVG rows;
  `.exe` and an 11 MB PDF refused in plain words; lightbox opens the full image, Esc closes it (panel stays); SVG shown through `<img>`;
  PDF link opens a new tab; card meta `3 files`; Bob (joined by email invite) sees the files live, and a remove + undo by Alice live;
  Carol refused ("not a member"); Storage rules (outsider, 11 MB, .exe, delete) in the rule tests.
- Also verified (2026-10-18): delete an item with three attachments → its records go with it → one Ctrl+Z brings the item and all three
  files back (alone, and with Bob watching it go and come back); export zip holds `attachments/<id>/<name>` (records without path/uid);
  import puts the files on the same item under new ids (thumbnail remade); light theme and 390 px (no horizontal scroll) screenshots.
- **Emulator-only slowness, not a bug in the app:** after a reload, once a panel has asked Storage for a file URL, that tab's next
  Firestore write can sit ~55 s *in Chrome's queue* before it's sent (CDP timing: stalled 55 002 ms, server 82 ms; another tab's write
  at the same moment took 45 ms). The emulators speak HTTP/1.1, so Chrome's per-host connection limit queues the request; the live
  Firestore and Storage use HTTP/2, which doesn't queue like this. Watch for it once attachments are live anyway.
- At 390 px the board's filter bar overlaps the top of the side panel (was already so; not from attachments).

## Done (consistent pages, 2026-10-18)
- D-093: audit (headless screenshots, dark/light/390) of board + panel, flow, table, reports, report screen, Settings; the assistant
  chat left out on purpose. New tokens (`--text-lg`, `--text-heading`, `--text-hero`, `--track-*`, `--measure`), `src/ui/Page.module.css`
  (page, toolbar, title), `fieldLabel` (Frame), `small` `[verb]` button (AsciiButton.module.css) replacing five hand-made copies.
  Reports left-aligned with its header in the filter row's place; table fills the width with "…" names; one Settings label column;
  stale "coming later" removed; phone side panel covers the filters. No raw font sizes or letter-spacing outside AiChat.
  Follow-ups: all actions lowercase (uppercase only for labels); workspace-card hover regression fixed.
  Later the same day: `src/ui/Select.tsx` replaces every native `<select>`, and `+ link` opens as a dropdown instead of spreading
  inside the panel (`src/ui/floating.ts`); verified headless, dark, light and 390. Committed and pushed 2026-10-18.
  Build passes; verified headless on emulators (no horizontal scroll at 390, light theme). Committed and pushed 2026-10-18.

## Done (assistant redesign, step 1, 2026-10-18)
- D-094: chat restyled as a terminal log; window builds up cell by cell; a preview or report opens a stage on the right while
  the chat glides to the left (stageMotion.ts, stage.ts). Verified headless on emulators, dark and light. Committed and pushed 2026-10-18.
- D-095: empty chat = small box that rises from below and lifts the orb onto its edge; the first message grows it tall and
  the orb drops behind the edge to peek; header = model + clear + close (perch.ts). Verified headless, dark and light. Committed and pushed 2026-10-18.
  Follow-up: in the tall chat the orb rests in the middle, wanders off to peek now and then, and when the column crosses to a
  preview it slides, is shaken, composes itself and walks back (perch.ts springs; `shaken`/`composed` in AiOrb). Verified headless.
  Second round of fixes (orb back to its corner on close, no command list in the empty box, eased `/` menu, side panels end
  above the small box, side panels glide when the tall chat closes). Verified headless.
  Then: a side panel knocks the orb aside on the small box; the tall chat slides whole on open/close; the orb is 1.5× on the
  tall chat. Verified headless.
- D-096: the preview's look: diff signs and colours (`--diff-*`) instead of name tags, deleted items grey and struck, moved
  cards' ghosts, new links in the new colour, `was` + old values under edits, frame-all on open, a stepper (`‹ n/N ›`, n/p)
  and rows lit both ways between chat and stage, the stage as one box with its title in the top edge. Verified headless,
  dark and light. Committed and pushed 2026-10-18.
- Next in the redesign (with the user): the report screen's look on the stage, the steps/streaming states, narrow screens
  (below 760 px the chat still covers the stage).

## Done (settings reorganised, 2026-10-18)
- D-097: grouped menu (you: account, display · workspace: general, people, export · assistant: keys, usage), page title +
  description, framed sections with notes at the foot, rows with the name and a readable hint beside the control, `--fg-muted`
  for help text, `Choice bare`, dialog 960 × 720. Verified headless on emulators: every page in dark and light at 1440 and dark
  at 390 (tabs clear of the close button). Build passes. Committed (not pushed).

## Done (roles + load on demand, 2026-10-18)
- D-098: owner/editor/viewer with several owners, a people list (members directory) with role pickers and remove, reports
  as summary + body, reports/people/usage paged 20 at a time and loaded only where shown, loading lines. Rules 232 pass.
  Verified headless on emulators (seeded 25 members, 25 reports, 25 calls; 18 checks: viewer lock and toast, live role
  change, co-owner unlocks stepping down, paging, report body loading state, usage totals). Build passes.
  **Deployed 2026-10-18:** indexes (built, READY) then Firestore + RTDB rules, and pushed (live deploy green; the live
  bundle has the new code). Storage rules still wait for Blaze. Functions changed too (roles, aiMembers removed),
  deployed later with D-079.

## Done (assistant builds the board from a report, 2026-10-18)
- D-099: the report open on the report screen goes into the brief in full (`OPEN REPORT`), the brief's other reports get a
  `[report:…]` handle and `get_report` reads one in full (`src/ai/readTools.ts`, `fetchReport` in src/data/reports.ts); the
  agent loop runs tools async now. `/analyze` (`build from a report`) turns the open (or named) report into a proposal:
  new items wired into the chain, edits with `Sources:`, links, matrix cells, an area. The `/` menu says `on <report>`.
  Verified headless on emulators with a fake OpenAI (uploaded .md → opened → `/analyze`: the brief has the report in full
  with its sources' URLs, get_report reads it by handle, a bad handle is a warn step, the proposal shows). Build passes.
  Committed (not pushed). Not tried with a real key yet.

## Done (reports: tab page, chat report on the stage, table + reader, 2026-10-18)
- D-100: reports from the tab open as a page of the tab (`ReportPage`), the chat's own report stays on the stage; shared
  body `ReportDocument`. Verified headless on emulators (upload → page, no stage; back link and browser back; chat opened
  beside it stays on the right; 390 px no horizontal scroll). Build passes.
- D-106: reports tab = table alone (filters + upload in its top row), 10 a page with numbered pages, nothing opens by
  itself, a report opens beside the table with the cell effect. Verified headless on emulators with 23 seeded reports
  (pages 10/10/3, kind filter 8, side by side dark + light, Esc closes, 390 px no horizontal scroll). Build passes.
  Indexes deployed 2026-10-18.
- D-106 follow-up: reports tab lined up with the other views (filters on the backdrop in the filter row's place, frames
  48 px under the HUD, no empty band). Verified headless on emulators (filters 56 px / frame 104 px like Table; beside a
  report; 390 px no horizontal scroll). Then: Matrix and Reports frames as tall as their content, capped at the page
  (verified: matrix 64–365, a short report 104–554, a long one stops at 884 of 900). The matrix's key hints follow the legend on the left (were pushed right). D-107: one column header (TableHead.module.css) in Flow, Table, Matrix, Reports. Build passes. Committed (not pushed).
- D-103: upload on the reports tab is a solid magenta icon square like the board's `+`. Verified headless (dark, hover, light).
- D-102: reports tab redone (user: didn't look like other pages, empty right side, animation behind the text): one
  solid full-width frame, list left, reader right with a scroll-following outline; newest opens on wide screens; phones
  list → report. Verified headless on emulators (dark + light 1440, 1920, 390 with no horizontal scroll) in a worktree of
  HEAD + these files, because another session's in-progress `src/ai/settings.ts` change (models) doesn't typecheck in
  the main folder then.
- D-101: the chat's report refactored like the preview: shared `StageBox` (preview uses it too), section stepper, card rows
  lit both ways with the stage, `open in reports`. Verified headless on emulators (dark + light 1440: card, stage, n/p,
  row click open and closed, Esc; preview still draws with the shared box). Build passes.

## Done (model selection, 2026-10-18)
- D-104: models belong to the key that pays: own key (default + per-workspace overrides, this browser), workspace key
  (owners' picks + allowed list, enforced by the proxy, `checkWorkspaceModel`), a per-chat switch in the chat header,
  deep research as its own task, an "in <workspace>" summary in Settings → assistant → keys. Verified on emulators with
  the functions and a fake OpenAI (19 browser checks + 3 server checks). Rules 237 pass. Firestore + RTDB rules deployed
  and pushed 2026-10-18 (live deploy green). The functions (proxy enforcement, checkWorkspaceModel) wait for Blaze (D-079).

## Done (scroll bars, 2026-10-18)
- D-105: one thin square scroll bar for the whole app (global.css; hover brighter, cyan while dragged; Firefox via the
  standard properties). Verified headless on emulators, dark/light 1440 and 390. Committed and pushed 2026-10-18.

## Done (board editing, 2026-10-18)
- D-108: links coloured by meaning (4 groups) on solid framed chips, hover/selection focus dims the rest, click a link → bar
  (kind, label, reverse, remove), `LINKS` filter; shift+click / alt+drag multi-select, group drag, "N selected" panel (shared
  tags, duplicate, delete); ⌘C/⌘V/⌘D; a `○` link handle on hovered cards; text sizes H1/H2/note + colour via a label bar.
  Rules: `labels.size` (239 pass), deployed 2026-10-18 (optional field; old rules accept labels with it already since they don't
  list fields, so the live client works either way). Build passes. Verified headless on emulators, dark and light. Committed, pushed and rules deployed 2026-10-18 (live deploy green).
- D-108 follow-up: the assistant can edit a link (`edit_link`: kind, label, direction) and add a note (`add_note`);
  notes are their own list in the brief and no longer act as area names. Verified with a fake OpenAI on emulators. Build passes.
- Ideas left from the same talk: formatting in card notes, snap/alignment guides, a right-click menu.

## Done (assistant scope line, 2026-10-18)
- D-109: `working on …` line above the chat's prompt (card / report / whole workspace). Committed.
  The `N cards` case + the brief listing a multi-selection went in with D-108 (d1f8cc3).

## Done (backdrop + grid, 2026-10-18)
- D-110: workspace backdrop 8% (was 14%); the board's `+` grid turns into dots and fades out by camera distance, gone before the
  zoom-out limit. Verified headless on emulators (dark, 1728 × 1117). Committed.

## Done (small UI requests, 2026-10-18)
- Workspace cards: no hover tooltip; `created <date>` is a muted line under the name. Board: a framed fit-all button beside `+`
  (also the `0` key; viewers get it too) glides back to the whole board as the filters show it, like opening (D-060;
  `canvasStore.fitAll`). Settings: no "Settings" title above the menu. Reports table on the shared frame surface like the
  other tables (was solid `--bg`, D-102); the report reader stays solid. Verified headless on emulators (fit button and `0`). Committed.

## Done (link handle + reports entrance, 2026-10-18)
- The `○` link handle (D-108) no longer flickers: the card ignores a pointer-out while the pointer is still on one of its own
  parts, and the handle has a wider invisible hit circle (0.2) carrying its handlers. Verified headless on emulators: a sweep
  across the handle gives one leave and one enter (was a dozen), presses on the handle start a link.
- The reports table builds up cell by cell on entering the tab like the other views (`Appear` gained `elRef` for the open/close rebuild).
  Verified headless (clip-path runs right after the tab switch). Typecheck passes.

## Done (board depth + level of detail, 2026-10-18)
- D-111: near/far follow the camera (no more z-fighting: flicker, link colours over text during fit-all); what's drawn
  depends on on-screen size: cards full / compact (big centred title) / far (stars in the type colour, built up cell by
  cell), competitor feature chips the same (big name / small stars beside the competitor's star), link chips, notes and
  headings left out when too small. Verified headless on emulators: dark 1440 × 900 and 2560 × 1440, light 1440 × 900,
  fit-all glide frames, a competitor's chips at three distances. Committed and pushed 2026-10-18.

## Done (snap to grid, 2026-10-18)
- D-112: drags snap card/label centres to a 0.25 grid (group drags too, alt = free), a switch beside fit-all + `g`, on by
  default and remembered; quarter dots on the grid close up while on. Verified headless on emulators. Committed (6600505), pushed.

## Done (assistant steps + phones, 2026-10-18)
- D-114: steps as a live log with times (`t0`/`t1` stamped in `begin`, chat.ts), `thinking` / `writing the answer` as the last
  line, folded into `▸ N steps · 8.1s` once answered; on phones a `chat · preview|report` switch beside a stage, the chat
  shrinking to its header along the bottom; the phone's chat solid. Verified headless (1440 dark, 390). Build passes.

## Done (go to: search, no notes, 2026-10-18)
- D-116: `go to` lists headings and subheadings only (notes left it, 1–9 follow); `Menu` got an optional `search` field
  (focused on open, Enter picks the first match, `No match`). Cross-workspace paste and a minimap rejected. Verified headless
  on emulators (example workspace): field focused, "road" → ROADMAP with its `5`, Enter picks it and closes the menu, Escape closes. tsc passes.

## Done (2026-10-18): D-118 project title block on the board
- `+` → "project title": one block per board (a `kind: 'title'` label) showing the workspace's name and description, edited
  in place or from its right-click menu (edit name / edit description); star + `PROJECT`, magenta-led rule, corner brackets.
  The counts row was tried and dropped at the user's request. Rules allow `kind: 'title'` (245 tests), deployed.
- Verified in headless Chrome on the emulators: placement clear of the headings, rename (breadcrumb follows), description
  edit (caret at the end, field at full height), right-click menu. `npm run build` passes.

## Done (2026-10-18): D-119 `for` links as lines, `for:` filter hides the other customers
- `for` edges drawn like any link (grey dashed, LINKS `relates · for` hides them); under a `for:` filter only the chosen
  customers' cards stay (`useVisibleItems`, so board, Flow and Table). Verified: `tsc -b` passes; not checked on screen by
  Claude, the user committed after their own look.

## Done (2026-10-18): empty chat without the invitation; a gap above the `/` menu's scope line (D-095 tweak)
- The empty chat's two text lines are gone; with no messages the log hides (`.log:empty`), so the box is only the prompt.
  The `/` list's bottom margin is now `--space-3`, and `ModeMenu` measures it into its height (offsetHeight left it out, so
  the list sat right on `working on …`). Verified in headless Chrome on the emulators (empty box and `/` open).

## Done (2026-10-18): the assistant edits the project and competitor features (D-120, D-122)
- `update_project` (name/description, the project block), new cards kept clear of the block, an empty label name matches
  nothing; workspace-doc undo restores only name/description, merged. `update_competitor_feature`, matrix `their_feature`
  and `not assessed`, `""` empties fields. Verified with a node script (vite-node + jsdom in the scratchpad) on
  parseProposal/toWrites/simulate and `npm run build`; not tried with a real key, in the browser or on the emulator's undo.

## Done (2026-10-18): the assistant writes board text and moves single cards (D-123)
- `add_label`, `edit_label` (replaces `rename_label`), `move_card`; brief shows label size/colour. Verified with the
  scratchpad node script and `npm run build`; not tried with a real key or in the browser.

