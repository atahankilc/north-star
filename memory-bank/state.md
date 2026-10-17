# Project State

_Last updated: 2026-10-17 (welcome intro: sunrise instead of galaxy/shooting stars, D-072)_

## Phase
**Phase 2b done: one board** (spec: docs/specs/board.md, D-040 to D-052). Domains and groups were tried and removed (D-048, D-049);
text labels with a jump list replace them (D-050).
**Phase 3 done: collaboration** (sharing D-021/D-062, presence and cursors D-065, follow + shared selections D-067/D-068, no typing indicator
and last write wins D-071). Next: Phase 4 (settings + AI, BYOK).

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
  on emulators: cards still read fine over the 14% backdrop). Not committed.

## Done (Phase 4.1: assistant orb + chat, 2026-10-17)
- D-073: ASCII orb with eyes bottom-right in workspaces → chat panel; OpenAI key in Settings → ai or in the chat; gpt-6-luna; read-only
  workspace brief per message. Build passes. Verified headless on emulators with OpenAI mocked (key check, streaming answer, brief contents,
  Escape closes). **Not tried against the real OpenAI API yet** (no key here). Not committed.

## Next steps
1. Commit + push the open work (light theme D-069, routing D-070, D-071)
2. Small: PeerMarks colours through `themeAccent` (D-069); drop `edit`/`field` from database.rules.json once old tabs are gone
3. Try the assistant with a real OpenAI key; then Phase 4.2 (tools/MCP, preview + accept, per-feature model choice); Phase 5: files, export/import
5. ~~Deploy~~ done 2026-10-17: live at https://atahankilc.github.io/north-star/ (repo and local folder renamed `mind-map` → `north-star` on 2026-10-17; the old URL 404s) (Pages source = GitHub Actions; 5 `VITE_FIREBASE_*` repo variables set; github.io is an authorized domain). Every push to `main` redeploys.

## Blockers
- None

## Notes for future sessions
- In a hidden or background browser tab rAF is paused. In dev, `window.__advance(t, true)` steps frames and `window.__canvas` exposes the canvas store.
- Background (hidden) Chrome tabs pause rAF **and** heavily throttle timers after a few minutes, so long test scripts stall,
  motion exit animations never finish (the curtain stays in the DOM), and screenshots can come out stale or tiled. Keep scripts
  short and observe with MutationObserver; hide `[role=status]` to look past a stuck curtain.
- **For visual or animation checks, use headless Chrome via puppeteer-core.** Install it in the session scratchpad
  (`npm i puppeteer-core@24`, never in the repo) and launch `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
  with `headless: 'new'`. It runs rAF normally, unlike the extension's background tab. Motion is `full` by default now (D-063),
  so no setup is needed unless a stored preference says otherwise. Wait for `window.__curtain.getState().revealed` before capturing.
- The user runs their own dev server on :5173. Use another port (e.g. 5179) for yours, and stop your servers when done.
- Ideas and features used to live on separate boards, so in old workspaces they may overlap on the shared board. Drag them apart.
- The quickest realistic test data is the example workspace: click Alice, then "Create example" (emulators).
- Seed script pattern for visual checks: sign in to the auth emulator as `test-alice` with the firebase client in node, write a workspace + items, then open `/#/w/<wid>` after clicking Alice.
- Dev hooks: `window.__boardItems`, `window.__sceneTime`, `__backdrop` (R3F state), `__curtain`, `__sweep`, `__canvas`, `__advance`.
- Chrome screenshots are scaled: viewport 2560 px vs 1568 px frame, so script clientX/Y needs ×(innerWidth/1568).
- OrbitControls listens on the Board's wrapper div (not the canvas), so card handlers run first and can disable panning.
- The bundle is about 1.6 MB (three + drei + firebase). Code-split views later.
