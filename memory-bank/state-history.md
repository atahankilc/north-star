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


## Done (2026-10-18): multi-select lines up, nudges, shows the whole selection to others (D-124)
- Panel `line up` (align 6 ways, space ↔ ↕), arrows nudge 0.25 / shift 1 (a run is one undo step), presence `more`.
  RTDB rules deployed. Verified: rules tests 247, `npm run build`, headless Chrome on the emulators (positions after each
  button, nudges, one ⌘Z, the presence node); not tried with two people at once.

## Done (assistant board design + focus view, 2026-10-18)
- **D-125** organising: `arrange_area` layout (columns/rows/grid/line/hub), sections (`within`), `beside` + side, more room,
  areas packed ~1.7:1 (`src/ai/arrange.ts` rewritten). Checked in node on the example board (26 cards, no overlaps).
- **D-126** organising, second step: crossing-reducing column sweeps, areas placed by link length + compactness, one
  existing area tidied in place, `layoutReport` back to the model (may revise once). vite-node + jsdom checks. Neither
  tried with a real model yet.
- **D-127** focus view: `/focus?on=<id>`, the board with one card's chain + its competitors, in place; picker, panel
  `[◎ focus]`, right-click. Checked in headless Chrome on the emulators.

## Done (2026-10-18, pushed together: D-124–D-131, side-panel fields, group drag fix, board speed)
- Not committed: side-panel text fields grow with their text, never scroll (card title, notes, competitor name/description/notes,
  their-feature description, matrix cell notes, workspace description; `src/ui/autoGrow.ts`, `AutosaveField` `wrap`). Checked in
  headless Chrome.
- Not committed: group drag fix (`groupDrag.ts`: one `setDraggingMany` + one batched `streamMany` write per move instead of one
  per piece; carried pieces snap, not glide; held at the drop until `endMoveMany` lands). Checked in headless Chrome.
- Board speed (committed): links drawn with `BoardLine.tsx` (keeps its geometry and material; drei `<Line>` disposed them
  every render, so three recompiled the line shaders ~200× per few seconds of hover/pan/drag); `NodeCard`/`EdgeLine` memoised,
  stable `onLinkDrop`; link hit bands `visible={false}` (461 → 361 draws a frame). 40 cards + 100 links in headless Chrome:
  hover/pan/drag p95 33 → 16.8 ms, long tasks 160–870 ms → 0. Use `BoardLine`, never drei `<Line>`, on the board.
- Not committed: D-128, customer-tag (`for`) lines are their own LINKS group; it and `relates` hidden by default (build only, not tried in a browser).
- Not committed: D-129 (`arrange_area` layouts `cycle`, `orbit`, `tree`, `quadrant`) and D-131 (areas drawn as section frames,
  section ops) in `src/ai/arrange.ts`, `tools.ts`, prompts, plus small hunks in `context.ts`/`chat.ts`; checked in node with
  pictures and a synthetic workspace, not tried with a real model. D-131 builds on D-130: commit after (or with) it.
- Not committed: D-130 sections (frames that hold what's inside them, kept in focus); checked in headless Chrome; Firestore rules deployed. Files:
  `sections.ts`, `BoardSection.tsx`, `focusField.ts` (new) + Board, BoardView, BoardMenu, LabelBar, groupDrag, guides,
  arrange, clipboard, titleBlock, DetailPanel (one hunk), labels/model/bundle, rules + tests, ai/context, tools, chat.

## Done (D-132 project title resizes and folds, 2026-10-18)
- Right edge drags the title block's width (5–30, `w` on the label, one undo step, kept by export/import).
- Zoomed out past the description's readable size it folds, animated (320 ms, instant with reduced motion): the name
  grows to the biggest size that fits the unfolded block (troika `getTextRenderInfo`, binary search), the block shrinks
  to what's left; narrow blocks shrink the name rather than break a word.
- Assistant placement and layouts use the unfolded size (`titleFullHalf`, `labelRoom`).
- Verified in headless Chrome on the emulators (resize, ⌘Z, fold/unfold screencast, narrow block); `npm run build`.

## Done (D-133 matrix criteria and white space, 2026-10-19)
- Examined the user's BUBBLES workspace; findings and the slice plan in `docs/specs/usefulness.md` (Phase 6 in ROADMAP).
- Slice 1: features list criteria, cells score them (`met|part|no`), cells show blocks, `◇ N open` white space,
  editors in the feature and cell panels, TSV and export/import carry them, the assistant reads them.
- Verified in headless Chrome on the emulators (add, score, remove + ⌘Z); rules tests (6 new); `npm run build`.

## Done (D-134 the assistant writes criteria, 2026-10-19)
- `set_criteria` proposal op (one row per feature: criteria + every competitor's scores), `do: 'criteria'` write with
  stale-score cleanup, preview, mode `/criteria`.
- Verified in headless Chrome on the emulators with a fake OpenAI (propose, preview, apply, trim keeps a kept criterion's
  scores, ⌘Z); `npm run build`. Not tried with a real model.

## Done (D-135 competitor lines off by default, 2026-10-19)
- `competes` LINKS group hidden by default (filters v4), shown on hover/selection; competitor cards `vs N`; link labels
  only in focus. Verified in headless Chrome on the emulators; `npm run build`.

## Done (D-136 not relevant and confidence in the matrix, 2026-10-19)
- Cells: `notRelevant` (`—`, out of readings and counts) and `confidence` (`~` inferred, `?` guess); panel rows, TSV,
  export/import, assistant (`set_matrix_cell`, `set_criteria`). Verified in headless Chrome on the emulators (also with a
  fake OpenAI); rules tests (3 new); `npm run build`.

## Done (D-137 status and evidence, 2026-10-19)
- `validation` on customers/problems/ideas, `evidence` collection; panel status row + evidence list, card meta
  `testing +2 −1` / `!`; cascade, workspace delete, export/import; assistant brief, `add_evidence`, `update_card.validation`,
  /validate and /gaps. Verified in headless Chrome on the emulators (and a fake OpenAI); rules tests (7 new); build.

## Done (D-138 priorities, 2026-10-19)
- Impact on features; confidence from the chain's status; priorities tab (impact × effort, suggested order); `/prioritize`.
  Verified in headless Chrome on the emulators; rules tests; `npm run build`.

## Done (D-140 planes on the board, 2026-10-19)
- Plane switcher, placements, `existing ▾`, panel `planes` row, ⌫ = take off plane, plane text/sections, presence per
  plane, export/import. Verified in headless Chrome on the emulators; rules tests (9 new); `npm run build`.

## Done (D-141 packages, 2026-10-19)
- `package` card type, `package these`, home plane frame, panel (holds, confidence, open its plane), priorities, export/
  import, links. Verified in headless Chrome on the emulators; rules tests (5 new); `npm run build`.

## Done (D-142 the assistant on planes, 2026-10-19)
- Proposals land on their plane; brief lists planes and packages; five plane/package rows; `/organize` may propose planes.
  Verified in headless Chrome on the emulators with a fake OpenAI; `npm run build`. Not tried with a real model.

## Done (D-143 plane filter in the other views, 2026-10-19)
- One remembered plane per workspace; Flow, Table, Matrix, Priorities filter by it. Verified in headless Chrome on the
  emulators; `npm run build`.

## Done (D-144 overview, 2026-10-19)
- Overview tab first, opened from the workspaces list; deterministic reading; next steps prefill the assistant's mode.
  Verified in headless Chrome on the emulators; rules test; `npm run build`.

## Done (D-156–D-159 text, sections, sticky notes, comment threads, 2026-10-20)
- Mockup shown first (a local HTML page: four text looks, four section looks, two sticky looks, threads); the user picked
  A as shown, section look 1 for every section (top or left, colour on line and name), the dark ASCII sticky, and threads
  on anything selectable.
- Built: `richText.ts` + `TextBlock.tsx` (paragraphs as a canvas texture), `BoardLabel.tsx` (headings, paragraphs, sticky
  notes, turns, width grip, editors), `BoardSection.tsx` (name in the edge), `stickyNote.ts`, `data/threads.ts`,
  `Threads.tsx` (pins + panel), footer list, right-click `comment`. Rules for labels' new fields and `threads/messages`.
- Verified headless on fresh emulators (port 5181): screenshots of each; rules tests 326/326 against the running
  emulators; `npm run build`. Old firestore/database emulator processes from 2026-10-18 (no parent) were stopped.


## Done (2026-10-20, D-164: competitor features as names, parts fold, motion)
- Mocks on a local page first (scratchpad, port 5188): squares / spines / strip / names beside the competitor card;
  for parts a row / nested dots / tree / names. The user picked names for both.
- Built: `SideList.tsx` (rows, captions and tray that glide; `featureSpots`, `partSpots`), Board.tsx (open on hover or
  select, closed while dragged; parts tree from `part of`, fold tops, rows as link ends), NodeCard.tsx (`[−] N parts`
  button, folding into a row, no plates), `setFolded` / `setMatch` in data/nodes.ts, right-click `fold parts`, panel
  fields (availability, source, matches our feature). `FeatureChip.tsx` deleted. Rules + tests for `folded`,
  `availability`, `url`; bundle carries them. Fixed: leaving a card through its `›` handle kept its hover.
- Verified headless on emulators (port 5190, example workspace + seeded `part of` links): screenshots of closed, hover,
  open, closing, selected re-click, drag, a 2-level fold mid-frame and done, unfold by a row, the panel. `tsc`; rules
  tests 335/335.

## Done (moved out of state.md 2026-10-22)
- Drops land at once (2026-10-20, committed): a dropped piece is held where let go until its data gets there (`land` in
  canvasStore), no glide; before, the drag's streamed writes came back from the IndexedDB cache one by one and the card replayed them.
- Backdrop cell = 9 device px (D-172): finer field on 2x screens, nothing changes moving between screens. 2026-10-20.

## Done (moved out of state.md 2026-10-22, later)
- Card layout: 0.06 padding, header with status + evidence cells, facts line, tag chips; `›` link handle (D-152), 2026-10-19.

## Done (2026-10-20, moved from state.md 2026-10-22)
- Competitor feature list opens on click only, category names in grey caps over un-indented rows, no tray, drawn over everything (D-173). 2026-10-20.

## Done (2026-10-21, moved from state.md 2026-10-22)
- Focus dock on the bottom edge + plane console inside its bottom-right corner, no `▸` (D-189), committed 2026-10-21.

## Done (2026-10-22): piece names (D-223)
- The name in a plane's, matrix's or table's top edge is held at 11–15 px on screen whatever the zoom, `--fg` caps with
  the kind faint after it; edit mode a cyan-framed field with `>` and a count. Verified headless on emulators (10 % zoom
  computes 11 px, cut `PAZAR…`; 100 % full; edit field types); tsc, build.

## Done (2026-10-20, moved from state.md 2026-10-22): board speed
- Board speed with many competitors (committed): hidden feature rows / folded-part rows are no longer mounted
  (they mount to open and unmount after closing), lists memoised, row decorations skip raycasts. Hover stalls 918 → 102 ms.

## Done (2026-10-22): documents (D-232)
- `documents/` (summary + content/body) for .md, images, PDFs and old reports (moved over once by each author's browser);
  the documents list piece (table or shelf, from its console), a document on its own (a window, by zoom full/title/bars,
  scroll + outline in focus), a document opened beside the list in its focus, the share question before a private one
  goes on the canvas, a row's grip to drag one out, .md dropped on the canvas. Verified: rules 419 pass; headless on the
  emulators (upload, both views, drag out + ask + place, reader, a seeded report moved and read, focus scroll + outline);
  build.

## Done (2026-10-19, moved from state.md 2026-10-22): grid marks
- Grid `+` stays a thin `+` zoomed out, thinning to every 4th instead of turning to dots (D-151), 2026-10-19.

## Done (2026-10-22): packages on planes (D-239)
- `package these` from a selection; unfolded a blue frame with a band (drags its members, opens its panel), folded a card
  holding them as rows; panel with rating, holds, confidence. Verified headless (make, drag, fold, drag folded, unfold,
  panel, undo).
- (Moved from state.md) Card hover/selection as corner marks, dragged card shrinks to 0.8 with its corners on where it
  lands, 5 px drag threshold (D-150), 2026-10-19.
- (Moved from state.md) Piece names readable at any zoom, edit as a cyan field with `>` and a count (D-223), 2026-10-22, committed.

## Done (2026-10-22, moved from state.md 2026-10-26): finder (D-236)
- Finder (D-236): ⌘F / compass, one finder in the middle with a real preview; replaces the find bar and go to's menu. 2026-10-22, committed.

## Done (2026-10-22, moved from state.md 2026-10-27): heads open panels (D-247)
- A card's head in a matrix or table opens its right panel on one click; a cell keeps it on its one card (D-247), 2026-10-22, committed.

## Done (moved from state.md 2026-10-27): matrix, packages, menus
- Matrix as a generic canvas piece (D-204): templates, card/typed axes, scale/number/text cells, setup in focus. 2026-10-21, committed, Firestore rules deployed; not pushed. A resizable window on the canvas, no marks (D-208), its own focus (D-206), 2026-10-22. Cards-crossed look, wizard + tabbed setup, totals options (D-212), 2026-10-22, committed, Firestore rules deployed. Fit, sticky heads, centring (D-214); long names, setup pills (D-216); pan from cells, heads nearer the left (D-217).
- Packages on planes (D-239–D-245): from a selection or `+` (pick), parts come along; a frame + band unfolded, a card folded. 2026-10-22, committed.
- Menus as a prompt (D-222): `+`, go to, start over from, right-click and every Select; `>` line, letters; one click outside closes. 2026-10-22, committed.
- Competitor regions (D-145): where a competitor operates, REGION filter (bar + matrix footer), assistant fields; committed 2026-10-19.
- LINKS filter: one group per kind (D-146), each with its own colour, solid lines (D-147), 2026-10-19.

## Done (moved from state.md 2026-10-27): sticky notes
- Sticky notes look like sticky notes (D-257): paper in their colour, dark ink, a glue band, no tilt; 6 × 5 steps, growing down, foldable (D-259). 2026-10-27; rules deployed.

## Done (moved from state.md 2026-10-27, the cleanup after the merge to main)
state.md as it stood before the cleanup, verbatim from "Live vs not yet" to "Known issues". Everything in it was committed,
merged to main and pushed by 2026-10-27; the 1.0 items (board ideas, the assistant tries, the board's filter bar) went with D-248.

### Live vs not yet
- Live at https://atahankilc.github.io/north-star/; every push to `main` redeploys. Firestore + RTDB rules and indexes deployed
  (latest: Firestore rules 2026-10-20 for D-155–D-159; RTDB 2026-10-18 for D-124's `more`; rules 253 tests incl. sections and text setting (D-130); reports readable while not saved yet, so a save shows at once; research written twice keeps only the newest).
- Waiting for Blaze: Cloud Functions (workspace key D-079, model enforcement D-104, cleanup trigger), Storage (documents'
  files, D-232; `storage.rules` allow nothing yet).
- **All rules deployed 2026-10-26 (D-248–D-251)**, the user's call: live 1.0 can't write its old shapes. Until Blaze,
  deploy without Storage: `npx firebase deploy --only firestore:rules,firestore:indexes,database --project north-star-db`.
- Tried with a real key: chat, proposals, [web], agent loop, deep research, reports. Only with a fake OpenAI: `/analyze` (D-099),
  `edit_link` / `add_note` (D-108). Not tried in the app at all: `update_project` (D-120), D-122's edits, D-123's text and moves, D-125/D-126/D-129's layouts, D-131's frames.

### In progress
- 2026-10-19 fix, pushed: deleting a workspace with ~10+ reports was refused (a batch's rules may read ≤ 20 docs;
  each report body's delete reads its summary twice), so `deleteWorkspace` now takes reports 6 to a batch; rules test
  added. Reports "out of order": the code sorts right; two live workspaces hold reports written with made-up `createdAt`
  (2026-10-19 12:00:00.0xx), so reports made that morning sat below them. Flaky uploads: not reproduced.
- Phase 6 (docs/specs/usefulness.md), from examining the user's BUBBLES workspace: slice 1, matrix criteria (D-133), built,
  committed, rules deployed 2026-10-19. Slice 2, the assistant writes criteria (D-134), committed;
  try `/criteria` on BUBBLES with a real key. Slice 3, competitor lines off by default (D-135), committed.
  Slice 4, not relevant + confidence (D-136), committed, rules deployed 2026-10-19.
  Slice 5, status + evidence (D-137), committed, rules deployed 2026-10-19.
  Slice 6, priorities (D-138), committed, rules deployed 2026-10-19. Planes and packages (D-139, docs/specs/planes.md): step 1, planes (D-140), committed, rules deployed 2026-10-19.
  Step 2, packages (D-141), committed, rules deployed 2026-10-19. Step 3, the assistant on planes (D-142), committed
  (no rules change). Step 4, plane filter in other views (D-143), committed. Planes spec done. Slice 8,
  overview (D-144), committed, rules deployed, pushed 2026-10-19. Phase 6 plan done.
- Board grid (D-148, D-149) and zoomed-out titles (D-153), 2026-10-19.
- Links: smaller chips, a new link opens ready to label, panel rows with label/reverse and the new one marked (D-154);
  bend points the user puts on a selected link (D-155; app-routed elbows tried and dropped). 2026-10-19, committed.
- Text and notes (2026-10-20, committed, not pushed; main is ahead of origin): headings with a small line + fading rule,
  paragraphs, quarter turns (D-156); section names in the frame's edge, top or left (D-157); sticky notes (D-158);
  comment threads on anything selectable or a spot, viewers too (D-159). Fixes after trying them (D-160). Not tried by the user yet; the assistant
  doesn't write paragraphs' width, turns, small lines or sticky notes.
- Competitor features as names beside the card (full list on hover/select), availability + source + "matches ours",
  parts folding into the parent as names, all gliding 280 ms (D-164). 2026-10-20, committed, not pushed;
  rules deployed. Assistant doesn't write availability/source yet.
- People here as overlapping squares + `+N` list; live cursors smoothed on the receiving side (D-169); following opens what they open (D-170). 2026-10-20.
- Go to back for every space (D-196): compass in the side nav under fit, no keys (D-201), planes' places folded (D-200); canvas (planes' insides too) and focused plane. 2026-10-21, not committed.
- Threads panel as list + thread halves, nothing on the canvas, cell-by-cell build/break for the tab and each half, go there an icon in the header (D-199). 2026-10-21, committed.
- Plane back to the old board's power, step by step (asked 2026-10-21): step 1, card motion (D-203); step 2, card inside
  (D-205, shown only, nothing sets it yet). Step 3, links (D-207); step 4, the right
  panel's look (D-219), filled for every card type (D-221).
  Step 5, inside cards (D-225, D-226); step 6, multi-select (D-227, D-229, D-230); step 7, guides (D-231); step 8, filters (D-233, D-235). Next: right-click. Fixed 2026-10-21:
  reloading in focus was black (the fit ran before the screen was measured: zoom 0.1 at 0, 0); it now waits, then sits at once.
- Kanban (D-251): a canvas piece of tasks in columns (assignee, due, card, checklist), drag, panel. 2026-10-26, committed, rules deployed. Look: the ledger (D-252). Grown in docs/specs/kanban.md's 8 sessions (D-252–D-262, done 2026-10-27, rules deployed); the timeline is a piece (D-262). Priorities plan done: cards on a kanban (D-268), rows and named boxes (D-269), the template, suggested order and one confidence rule (D-271), 2026-10-27, rules deployed.
- Criteria back on the matrix (D-249): an axis unfolds features into what they're judged on, scored in its cells, `◇ open`; panel `must do` → `judged on`. 2026-10-26, committed. Priorities as a kanban holding cards (D-253): done (D-268, D-269, D-271).
- Enter makes / Escape cancels what's just made, cards and text; add + name one undo step; Tab next card; wizards' Enter (D-250). 2026-10-26, not committed.
- **One look and behaviour across the canvas (D-263–D-267), agreed 2026-10-27: docs/specs/consistency.md, six sessions.
  All six sessions done 2026-10-27 (D-270, D-272–D-276), and ink + one family of lines (D-277). Merged to main
  (fast-forward, 141 commits) and pushed 2026-10-27; GitHub Pages deployed; rules tests 413/0.**
- Lenses: table (D-209), sticking (D-210), beside the plane in focus (D-211), table pages (D-213), links shown and made from a dropdown (D-215), 2026-10-22, rules deployed. Follows adds, column widths (D-224). Open on the canvas (D-228), committed, rules deployed 2026-10-22. Canvas speed: pieces' contents memoised (pan no longer draws them again; keep their props stable), matrix cells memoised with hover in its own store; in focus a matrix's cells and heads and a table's rows are made only when they change, not per frame; only what's on screen is drawn (`visible.ts`), and a matrix too small to read is squares on one canvas (`CellDots`).
- Documents (D-232, docs/specs/documents.md): .md/images/PDFs/old reports (moved once) in `documents/`, private until shared;
  a list piece (table or shelf) and one on its own (asks first), both unframe (D-234). .md only until Blaze; next: files, writing.
- Redesign started (2026-10-20): no pages, one canvas per workspace, the board at `/board` (D-174); the HUD moves to a
  left side nav piece by piece, you + settings bottom left first (D-175); planes (D-180, first called boards) placed on the canvas from the side
  nav's `+` (D-176, `pieces`), renamed/moved/resized in edit mode from their console (D-179, D-180); terminal look with corner marks (D-181);
  delete asks with hazard tape, 25 px snapping (D-182, D-183); `focus` spreads a plane over the screen like ink (D-184, D-185).
  Cards on planes (D-187); text anywhere, canvas or plane (D-188, D-190); cursors, total follow, selection marks (D-191);
  comment threads (D-192); text's old look back: section names, kickers, turns, the title's sizes and fold (D-194;
  what else was lost is in D-194's *Not yet*). The old code was archived (D-177), then deleted (D-248); features come back as pieces. Not pushed; RTDB + Firestore rules deployed 2026-10-20. Next: the board's cards
  inside its piece (each board its own items: maybe a plane per board, D-139), then tables etc.; pieces in the export.

### Next steps
- **Agreed order (2026-10-22):** export/import complete, done (D-246, bundle v2; Settings → export, workspaces → import);
  the v1 step was dropped for D-248 (1.0 gone, old reports still moved); merged to main and pushed 2026-10-27 (rules
  already deployed 2026-10-26, unchanged since).
0. **Board ideas after D-108 (suggested to the user, not started; ask which first):**
   - Try `edit_link` / `add_note` with a real key.
   - Link chips already hide when too small (D-111); left: draw them at a constant screen size.
   - Lines crossing cards or other links' chips: nudge chips apart (parallel links between a pair are done, D-113).
   - Formatting in card notes (the chat's light Markdown, D-089).
   - `add_note` notes can overlap a link chip: offset or left-align them.
1. Finish the workspace key (D-079) once Blaze goes through: user runs
   `npx firebase functions:secrets:set AI_KEY_SECRET --project north-star-db`, then `npm run deploy:functions`, set
   `WORKSPACE_KEYS_LIVE = true`, push, try with a real key as owner + member (also the workspace-delete cleanup).

### Blockers
- Blaze: the user's payments profile was refused once (OR_BAOOC_15, likely profile country vs German card); retrying.

### Known issues
- Rules tests: "owner/member reads workspace-key usage" fail (also on the committed rules, seen 2026-10-19).
- At 390 px the board's filter bar overlaps the top of the side panel.
- Emulators only: after a Storage URL fetch, a tab's next Firestore write can queue ~55 s in Chrome (HTTP/1.1 connection limit).
- Dev only: drei `<Html>` logs "synchronously unmount a root" when the board unmounts with one shown. Harmless.
- The bundle is about 1.6 MB (three + drei + firebase). Code-split views later.


## Done (2026-10-27): memory bank and docs cleanup
- state.md cut to a snapshot (stale "not committed" items, 1.0 notes and dev hooks out); decisions.md regrouped by the
  canvas's topics, similar lines merged (consistency sessions, comments, cursors, focus, finder, priorities), contradictions
  fixed (cursor rate, plane minimum, panel on click, LINKS filter); 1.0's rules moved to `decisions-1.0.md` (not
  auto-loaded; `check-memory.mjs` reads both). Docs checked against the code and decisions: ROADMAP rewritten, PRODUCT's
  views and entities, ARCHITECTURE's data model, rendering, presence, AI (1.0, shortened) and repo layout, DESIGN's marks,
  pieces, HUD, comments, grid, menus and motion; 1.0 specs marked. Unused `@react-three/drei` and `troika-three-text`
  removed; the HUD's unused view tabs (`views` prop, CSS) removed.

## Done (2026-10-27): zoom lag (D-278)
- Zooming the canvas crawled (user report: "zoom in/out yapamayacak derecede"). Measured in the user's busiest
  workspace (15 pieces, 7.5k nodes, 2560 px at 2×): 131 ms a wheel step. Three causes, all from D-272 on: (1) the
  Marks' L's transitioned top/left/width/height, all `× --zs`, so each step started ~4000 transitions; (2) kanbans,
  tables, matrices, timelines and lists read the camera's zoom in React for `--zs`, so each step drew them again with
  every task, row and cell; (3) each step wrote `--z`/`--zs` on every piece and text, restyling all 7.5k nodes (~60 ms).
  Fixes: L's move by unscaled `@property --mo/--ml`; spaces' `--zs` from the piece's `--z` in CSS (`zsIn`); CanvasView's
  `useShownZoom` (the camera's zoom 120 ms after it stops, at once on a pointerdown via flushSync) for everything at
  screen size; the timeline memoised like the other pieces' contents. After: 10 ms a step, frames 7 ms (120 Hz).
- Verified: CPU profile and trace on the emulators with a copy of that workspace (deleted after); in the user's Chrome
  on their dev server; names and L's back to screen size (16.5 / 18 px) once settled; a text dragged 20 ms after a
  zoom lands exactly (200, 100 px); L's rest/hover/press/spring/leave unchanged. Build.

## Done (2026-10-27): pans redraw nothing (D-279), and a performance survey
- Asked for: find D-278-like bottlenecks elsewhere, measured before and after, nothing visible changed. Emulators,
  headless Chrome 2560 × 1300 at 2×, a seeded workspace (3 planes × 25 cards + links + text, matrix, table and kanban
  unframed, timeline, documents list with 6 documents, ~6k nodes), dev for render counts (a devtools hook counting
  fibers that rendered), a production build (`vite build` + `vite preview`) for times.
- Fixed (D-279): a focused plane's pan restyled and redrew everything in it (style 152 → 10 ms, script 83 → 44 ms per
  60 steps; 5.2 → 1.7 ms a step); kanban pan script 115 → 42, timeline 90 → 49; the canvas pan no longer draws
  CanvasView and the pieces (script 77 → 45; the frame there is mostly Layerize, ~1.8 ms, and the backdrop).
- Measured, not changed:
  - Zoom in a focus: one `--zs` write costs 18.7 ms of style in a focused table, 10.6 in a matrix, 1.3 in a kanban
    (Marks: 450 / 1800 L's in the table). Fix = D-278's settle in focus; visible, asked.
  - One Firestore write (a card's title, from another tab) draws ~1,100 components: every plane's cards, the table's
    rows, the matrix heads, every task; 12–15 ms script, 20–32 ms main thread on the watching page (prod).
  - Load: one 2.66 MB chunk (778 KB gzip): firebase 230 KB, three 187 + r3f 59, workspace views 173, react 79, motion
    45 (gzip). Landing ready 185 ms unthrottled, ~1.2 s at 10 Mbps + 4× CPU (JS download ~0.75 s, script ~0.35 s).
  - Backdrop idle in a workspace: ~30 ms/s main thread, ~10 ms/s script, ~30 ms/s GPU process (headless); off: ~1.
  - Memory: 13 focus in/out cycles with zooms: heap 22.8 → 24.3 MB, flat (+0.3) over the last five; nodes and
    listeners flat. No leak found.
- Verified: pixel-identical screenshots before/after (canvas, focused plane, kanban, timeline; light theme; reduced
  motion); card drag after a zoom, alt box select (2 selected), pan, task drag to another column, a task's click opens
  its panel; canvas zoom settle 16.5 / 18 px; a text dragged 20 ms after a zoom moves 200.4, 100.2 px. Build.
- Then, asked and approved (D-280): zoom in a focus settles like the canvas's. Prod, 60 wheel steps: table main thread
  1924 → 461 ms (style 971 → 48, no dropped frames), matrix 1089 → 217, plane 312 → 123, kanban 304 → 123. L's 12 →
  17.2 px while zooming, 11.98 settled, at once on a press; settled screenshots identical; interactions as above.

## Done (2026-10-28): one card on many planes (D-281–D-286)
- Asked for: cards from other planes added to a plane, all kinds of card, by search as well as new ones; the gaps and
  edge cases found first. Planned with the user (D-281, docs/specs/shared-cards.md): the same card, not a copy; Delete
  takes it off this plane when it's elsewhere too; parts and members come along; `⧉ N`, `use that one`, folding per plane,
  a PLANES section.
- Built in five sessions, each verified in headless Chrome on the emulators and committed:
  - D-282 data and rules: `places/{planeId}_{cardId}`, `src/data/places.ts`, deletes and a plane's delete keeping shared
    cards, export/import; rules tests 429/0; 26 checks through the app's modules. Rules deployed 2026-10-28.
  - D-283 planes draw and move placed cards; Delete / `take off this plane` / `delete everywhere` (hazard confirm); a pan
    redraws no card (180 components over 60 steps on a plane with placed cards and on one without). 22 checks.
  - D-284 `existing card…` in the `+` and the right-click: the list where the menu was, ↵ / ⇧↵ / ⌥↵. 20 checks.
  - D-285 `⧉ N`, the panel's PLANES (go there, ×, `+ place on`), `use that one` while naming. 23 checks.
  - D-286 matrix, table, kanban, tasks, finder, comments, the panel's lists via `card.planes` / `isOnPlane`. 12 checks.
- Testing note: from a workspace tab the emulators can take tens of seconds to receive a write (state.md's known
  issue); the checks wait for each write, and a ⌘Z pressed before a write lands undoes it as soon as it does.

## Done (2026-10-29): a write draws what it changed; the workspace's code split (D-287)
- Asked for: D-279's *Not yet* (one write drew every piece; the one-chunk bundle). Measured first, each layer after.
- How it was measured: emulators, a workspace of 3 planes × 25 cards + links + 4 headings each, a matrix (features ×
  competitors), a table (every card), a kanban (12 tasks), a timeline; one write from outside the tab (the emulator's REST
  API as owner) — an idea renamed, a feature renamed, a heading retyped on plane 3 — on the canvas and in plane 1's focus.
  Dev: components rendered per commit, counted as React DevTools does (`__REACT_DEVTOOLS_GLOBAL_HOOK__`, skipping
  bailed-out subtrees). Production (`vite build` with `VITE_USE_EMULATORS=true`, `vite preview`): CDP ScriptDuration
  between the write and the new text in the page, backdrop off (`north-star.background` = off), three runs.
- Steps and counts (canvas, idea renamed): 918; stable docs/cards/lists alone 918 (every card read `useWs()`); selective
  `useWs` 842; `useWsNow` in the card 742; matrix/table rows kept 622; `CardBox` memo 551; table rows memo 210; heads
  memo 210 (feature: 330 → 215); kanban tasks memo 186. Final (after the table's two-part rows): 194 / 208 / 95, focus
  243 / 257 / 109.
- Code split: main 2.22 MB + workspace 467 KB; a deploy simulated with two builds (the chunk renamed) on a small server.
- A crash found on the way: the landing in the split build (`SCALES` read before defined: matrix ↔ pieces ↔ table
  cycle); fixed by `src/data/scales.ts`.

## Done (2026-10-29): frames and library chunks (D-288)
- D-287's leftovers: `PieceBox` memoised (its console count read every card: every frame drew on any card change);
  three.js, Firebase and React in content-named chunks of their own, so a deploy keeps them cached. Heading retyped
  elsewhere 95 → 51 components, a card renamed 186 → 145. Screenshots identical to the build before D-287; split and
  behaviour checks pass. Measured on a fresh workspace: the old one's live updates had stopped on the 8080 emulator.

## Done (2026-10-29): small details, unframed and focus surfaces (D-289)
- Unframed pieces on the page's black (feathered), held things on `--piece-card`; their boxes exactly their contents
  (a kanban read its window's size; `sizes.ts` holds the measured stores); the timeline unframes (rules: `open` on
  timelines) and lost `shows ▾` (the linked kanban, else every kanban); a plane, kanban or timeline in focus and a pane
  beside it on black; dock dropdowns plain text (`Menu` `plain`). Headless dark/light checks, rules tests 430/0, the
  production build loads. Rules change **not deployed**.


## Done (2026-10-29): one card on many planes, the leftovers (D-290)
- ⇧⌘V and the right-click's `the same card here` bring the cards copied as the same cards (laid out as where copied);
  a card's thread in the threads list says where the card is (`+N`) and goes there. Checked in a worktree holding only
  these changes, since another session (north-star-69, D-289) was editing CanvasView and others at the same time;
  committed with only this session's hunks staged.

## Done (2026-10-29): plane details (D-291)
- The cards-to-bring list scrolls (the right-click menu closed on any wheel). `existing card…` is last under a rule.
  Card faces are a dark tone of their type. A paragraph's landing L's are on the grid. A section or open package shrinks
  as one while dragged. Checked headless on the emulators with mid-drag screenshots, dark and light.

## Done (2026-10-29): link bend points dropped (D-292)
- At the user's word: `bends` gone from the Edge type, reversing, rules and import; docs and the plan say links are
  straight. Rules tests 427/0. Committed after D-291's memory-bank entry (another session's) so the log has no gap.

## Done (2026-10-29): hidden while zooming (D-293)
- Each world sets `data-zooming` while its zoom isn't the shown one; `[data-zooming] [data-screen-sized]` is hidden in
  `global.css` (marks, handles, consoles, comment chips, text's and links' bars, a matrix cell's bar, bond lines,
  guides; piece names stay). Checked in headless Chrome on the emulators (canvas and focus: hidden 40 ms into a wheel,
  back 400 ms later); build clean. Not committed.

## Done (2026-10-29): card faces on kanbans and tables, headings on the grid (D-294)
- Kanban card sheets and a table's card names are tinted like plane cards (tasks aren't). Headings' L's are on their
  edges, and where one lands is rounded up to the grid. Checked headless on the emulators.

## Done (2026-10-29): readable text on tinted cards (D-295)
- Greys, type labels and the clash `!` lean to the ink inside tinted cards and kanban card sheets; a competitor's
  feature rows stand apart. Measured with a contrast script in headless Chrome, dark and light: everything ≥ 4.5 but
  an empty card's placeholder.

## Done (2026-10-29): competitor-feature links dropped (D-296)
- At the user's word: links to a competitor's features and dropping a link on a small card won't be built; a
  competitor's features meet ours through the match. Plan, Rejected, PRODUCT.md and ROADMAP.md updated; no code.
  The table's small leftovers (last page's height, arrows across pages, a viewer's `+` column, the faint name) dropped too.

## Done (2026-10-29): focus in/out together (D-297)
- The view glides to its fit as the ink starts (not after); `.focused`'s `--bg` eases graphite ↔ black with the ink.
  Sampled per frame headless on the emulators. D-293's hide made lighter (Marks marked only when drawn). Not committed.

## Done (2026-10-29): a plane carries its kanban's timeline; go there stays on the timeline (D-298)
- `stuckChain` (CanvasView) for what a plane carries; `goToTask` stays on a timeline's focus that draws the task
  (`showOnTimeline`, the finder closed). Checked in a worktree (other sessions had uncommitted changes in CanvasView);
  committed with only this session's hunks.

## Done (2026-10-29): canvases themselves (D-305, D-302's session 1)
- `canvases/` + `canvasId` on pieces and canvas text, rules + tests (446/0), `?canvas=`, the breadcrumb's prompt (new,
  rename, move, delete with the hazard confirm and undo), break and build between canvases with a camera each, the
  finder's three scopes and going across canvases, presence's `canvas`. Verified in headless Chrome on the emulators
  (two scripts: switching + finder; new/rename/delete/undo); details in D-305.

## Done (2026-10-29): the timeline as a strip (D-304)
- Tasks' `start` (rules + 2 tests, the panel's `when`), the strip in Timeline.tsx (yours per tab, scales, pinch, overview,
  edges, drawn `+`, lanes in px, late hatched), filling focus / panes / its window at its own size, go to via
  `stripReveal.ts`. Verified in headless Chrome on the emulators with a seeded workspace (two decks, 14 tasks): wheel,
  pinch, scales, edge resize, move, draw, tray drop, beside a deck, the canvas picture; details in D-304.

## Done (2026-10-29): pieces move to another canvas (D-306, D-302's session 2)
- `move to canvas…` on a piece's right-click and `[move to…]` in its edit console (and the canvas's text): the other
  canvases or a new one; what's stuck comes along, a section takes what it holds; cell-by-cell leaving, a toast with
  `[go there]`, one undo step. Verified in headless Chrome on the emulators (details in D-306).

## Done (2026-10-29): one piece on several canvases (D-307, D-302's session 3)
- `pieceSpots/` + rules (457/0), `piecesOn`, `⧉ 2` in the name and the console's where-list, `also on canvas…`, Delete
  takes a shared piece off this canvas, `delete everywhere` through the confirm. Verified in headless Chrome (D-307).

## Done (2026-10-29): canvases all round (D-309, D-302's session 4)
- Plane names with their canvas in pickers and PLANES, threads going across canvases and `on this canvas`, following
  onto someone's canvas, ⌥1–⌥9, canvases and spots in export/import. Verified in headless Chrome (D-309).

## Done (2026-10-29): canvases checked again (D-311)
- An independent read of D-305–D-309 found 4 bugs and a few small ones (a shared piece's focus on `main`, a section
  with a spot inside, deleting `main`, a workspace delete's leftovers; new pieces over spots…): fixed, checked in
  headless Chrome (D-311).

## Done (2026-10-29): a shared piece's delete asks which (D-313)
- Delete on a piece on several canvases: the hazard confirm with `[only from here]` (focused) and `[delete
  everywhere]`. Verified in headless Chrome (D-313).

## Done (2026-10-29): the audit's P1–P3 (docs/audit-2026-10-29.md; D-317–D-323)
- Decisions K1–K6 + the invitee read written as D-317–D-323 (27a2881). P1 bugs (2bf01db, f494abe): task marks kept the
  threads read, a deleted newest message hands the preview back, long threads deleted to the end, the timeline keeps
  a task's person, one `focusOff()` for a plane's focus, `Choice` `clearable`, small ones. P2 (2bf01db, 7848a70):
  thread preview bound to its writer, `invites/{wid}_{email}` (the invitee never reads the workspace), members-only
  presence with Google photos, workspace names checked, viewers never use the workspace key, cleanup takes documents.
  P3 (0aeb28c, a5797d5, 581b5b9): CI runs test/check:lessons/lint/functions build, ESLint (react-hooks, warnings),
  fonts and indexes dropped, Functions/Storage lazy, dead exports, stale words, `usePalette()`.
- Verified: tsc, vitest 413, rules 515/0 on private emulators (copies of firebase.json and the tests on ports +10000,
  in the session's scratchpad; the new tests fail on the old rules), the committed HEAD in a worktree (tsc, tests,
  check:lessons, lint, functions build, vite build). Headless Chrome on a dev server at 5181 on those emulators:
  Settings choices, the timeline drop (old code lost the name), the invite flow with an old invite backfilled, the
  backdrop in dark, light and light + reduced motion.
- Not done: `keys().hasOnly` (reading the live fields was refused; without them old docs and undo could be locked),
  author fields (`givenBy` bound to its writer would refuse undoing someone else's assignment), `kindOfType`
  (documents.ts open in the onboarding run). Not reproduced headless: the link left selected (only reachable while
  following plane → plane) and InlineEdit's save after Escape (the old code didn't save in Settings either).
