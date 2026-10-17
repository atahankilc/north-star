# Project State

_Last updated: 2026-10-17 (full motion default, background switch, cheaper backdrop, D-063)_

## Phase
**Phase 2b done: one board** (spec: docs/specs/board.md, D-040 to D-052). Domains and groups were tried and removed (D-048, D-049);
text labels with a jump list replace them (D-050). Next: Phase 3 (presence, live cursors).

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

## Done (motion default + background switch + GPU, 2026-10-17)
- Full motion by default, `background: on | off` in Settings → app (signed-in pages only), field at one texel per cell,
  backdrop 30 fps on demand + low-power context, board on demand (D-063). `postprocessing` packages removed.
- Verified with headless Chrome on emulators: landing 30 renders/s, idle board 0 draws, panning draws, background off removes
  the canvas, the landing still flows after sign-out; same frame as before at a pinned clock (glyphs a touch crisper). Not committed.

## Next steps
1. The user's review on the live site; then Phase 3 (presence, live cursors)
2. Phase 3: presence + live cursors (RTDB rules are ready)
3. Phase 4: settings + AI (BYOK); Phase 5: files, export/import
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
