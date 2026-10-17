# Project State

_Last updated: 2026-10-17_

## Phase
**Phase 2: Competitors and features**, first pass done (checkpoint). The user is now rethinking the information
architecture around domains (Q-015) before more Phase 2 work. Phase 1 leftovers: groups (Q-012), undo (Q-013).

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

## Next steps
0. Settle Q-015 (domains, problem/customer framing, Flow / Board / Table views), spec it in /docs, review with the user, then build
1. Groups / clusters (Q-012)
2. Undo + Delete key (Q-013)
3. Phase 2: competitors, competitor maps, features view, comparison matrix
4. Phase 3 polish: presence + live cursors (RTDB rules are ready)
5. ~~Deploy~~ done 2026-10-17: live at https://atahankilic.github.io/mind-map/ (Pages source = GitHub Actions; 5 `VITE_FIREBASE_*` repo variables set; github.io is an authorized domain). Every push to `main` redeploys.

## Blockers
- None

## Notes for future sessions
- In a hidden or background browser tab rAF is paused. In dev, `window.__advance(t, true)` steps frames and `window.__canvas` exposes the canvas store.
- Background (hidden) Chrome tabs pause rAF **and** heavily throttle timers after a few minutes, so long test scripts stall,
  motion exit animations never finish (the curtain stays in the DOM), and screenshots can come out stale or tiled. Keep scripts
  short and observe with MutationObserver; hide `[role=status]` to look past a stuck curtain.
- **For visual or animation checks, use headless Chrome via puppeteer-core.** Install it in the session scratchpad
  (`npm i puppeteer-core@24`, never in the repo) and launch `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
  with `headless: 'new'`. It runs rAF normally, unlike the extension's background tab. Set `localStorage['north-star.motion'] = 'full'`
  via `evaluateOnNewDocument` first (the user's OS has Reduce Motion on). Wait for `window.__curtain.getState().revealed` before capturing.
- The user runs their own dev server on :5173. Use another port (e.g. 5179) for yours, and stop your servers when done.
- Dev hooks: `window.__sceneTime`, `__backdrop` (R3F state), `__curtain`, `__sweep`, `__canvas`, `__advance`.
- Chrome screenshots are scaled: viewport 2560 px vs 1568 px frame, so script clientX/Y needs ×(innerWidth/1568).
- OrbitControls listens on the Board's wrapper div (not the canvas), so card handlers run first and can disable panning.
- The bundle is about 1.6 MB (three + drei + firebase). Code-split views later.
