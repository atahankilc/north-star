# Project State

_Last updated: 2026-11-01 (buttons as cells D-344; two buttons and one HUD icon set D-343, light theme D-342, the landing D-340; the workspaces page D-338; the kit, D-326; gallery D-324 G1; audit P1–P3 and its decisions D-317–D-323; onboarding plan D-315, tasks side view D-300)_

A snapshot, not a history. What was done and how it was verified, session by session, is in
[state-history.md](state-history.md) (not auto-loaded; grep it by D-number). Keep this file under ~100 lines: when
something is finished, add its entry to state-history.md and leave at most one line here.

## Phase
- Phases 0–4 (1.0) done; 1.0 then dropped: code, data shapes and rules (D-177, D-248). Only old reports move to documents.
- 1.5: one canvas per workspace with pieces (D-174, D-176): planes with cards, links, text, packages; matrix, table,
  documents, kanban (tasks or cards, priorities), timeline; comments, presence, following; export/import v2 (D-246).
- One look and behaviour across the canvas: all six sessions of docs/specs/consistency.md built, plus ink and one family
  of lines (D-263–D-277).

## Live vs not yet
- Live at https://atahankilc.github.io/north-star/; every push to `main` redeploys. `refactor/north-star-1.5` was merged
  into `main` (fast-forward) and pushed 2026-10-27; Pages deployed.
- Rules: Firestore rules + indexes and RTDB deployed 2026-10-29 (RTDB again for presence `tasks`, D-300) (latest change D-292, no `bends` check); rules tests 457/0 (2026-10-29, private emulators: the usual ports were in use). Until Blaze,
  deploy without Storage: `npx firebase deploy --only firestore:rules,firestore:indexes,database --project north-star-db`.
- Waiting for Blaze: Cloud Functions (workspace key D-079, model enforcement D-104, cleanup trigger) and Storage
  (documents' files, D-232; `storage.rules` allow nothing yet). The assistant's client code went with 1.0 (D-248); only
  its server side in `functions/` and the `ai`/`aiUsage`/`aiSecrets` rules are kept.

## In progress
- Pushed and live (checked against origin/main 2026-11-01): D-332 grid dots, D-331 away (RTDB rules deployed), D-330
  text saved as typed, D-325 tokens (CSS and TS, `check:tokens` in CI), D-310, D-308, D-293–D-299 and the framed
  table's focus, D-300/D-301/D-303/D-314 decks and days, D-304 the timeline strip (its preview of four:
  docs/specs/timeline-preview/, B, C, D not built), the `setFitter` code, audit P1–P3 (D-317–D-323). What was done:
  state-history.md.
- Audit leftovers: Firestore rules + RTDB deployed 2026-10-29 (indexes not, Firebase's kept); functions wait for
  Blaze. P3b, P4–P6 after onboarding; Q-029, Q-030.

## Next steps (not started; ask the user which first)
- **The agent, where it stands (2026-11-01; D-327, D-328, D-329 built and pushed):**
  1. Evals trusted now (agent-bugs 33: every task audited, `--replay`). Single runs 2026-11-01: terra 78 % ($7.73),
     sonnet 75 % (≈ $11.4), gpt-5.4-mini 73 % ($3.37); prompt fixes 19, 20, 23, 24 + plan-waits guard measured
     (agent-bugs "Prompt changes"). Pipeline foundation built (D-341, docs/specs/agent-pipeline.md: roles, a model
     per role, run records, `--compare`); next is its P1: mini ×3 baseline, Claude's cache, then routing measured.
  2. In the app: a big job (`/restructure Segments`), and the two go buttons (not looked at in a browser yet).
  3. Left in code: the preview pick saved with the chat (a rules change).
  4. The local harness stays an idea (Q-031).
  Order and status of every agent bug: docs/specs/agent-bugs.md (its table).
- Several canvases (D-302): all four sessions built (D-305–D-307, D-309) and checked (D-311); a shared piece's delete asks
  which (D-313); pushed;
  rules deployed.
- Documents (D-232): files (images, PDFs) once Storage is live; writing documents in the app; renaming from the UI.
- The agent (D-312, docs/specs/agent.md; the overnight build: docs/specs/agent-run.md): see the first item above.
- Onboarding (D-315, D-316): **built and live** (O0–O16; state-history.md); its rules (and the agent run's) deployed
  2026-10-31 (firestore:rules + database; rules tests 586/0; indexes not). The agent's lessons wait for its redesign.
- Parked (D-312: the agent uses own keys only): the
  workspace key once Blaze goes through: `npx firebase functions:secrets:set AI_KEY_SECRET --project north-star-db`,
  `npm run deploy:functions`, try as owner + member (also the workspace-delete cleanup).
- Gallery and foundation (D-324, D-326): map, motion, kit, every area on it, patterns, `check:kit` pushed 2026-11-01
  (4a07c52). Landing + workspaces on the kit: pushed 2026-11-01 (f15f8d7). The whole UI but the agent on the kit:
  check:kit 238 → 13 (only src/agent/ui left); D-334 (:where); folders by layer/area (2026-11-01, not pushed). Next, agreed with the user: the agent's column on Window (only when
  the user says), check:kit lower area by area, folders last; the plan is D-326's *Not yet*.
- D-335 (Q-029 + old-data code deleted): pushed; firestore:rules deployed 2026-11-01 (rules tests 616/0).
- D-337 fonts and greys (2026-11-01): Inter + JetBrains Mono, mono only on system bits, brighter greys, the agent's
  column and picture too; pushed 2026-11-01. evals/fonts → Inter: the agent session's (after its terra run). Preview: docs/specs/font-preview/. Left: `--fg-faint`'s uses one by one, the world's 7/8 px sizes.
- Workspaces page (D-338, docs/specs/workspaces-page.md): built and pushed 2026-11-01, firestore:rules deployed (summary +
  visited); the user's pick E from docs/specs/workspaces-preview/. Left: whether to add a release entry (the first what's
  new), a look at it in light theme. Verified: state-history D-338.
- D-339 (2026-11-01, pushed): rules enforced by hooks; git hooks on (core.hooksPath set by the user). Claude Code
  loads `.claude/settings.json` after `/hooks` or a new session.
- Key hints out of the app (the user: "…onboardingde olması yeterli"): those beside buttons gone (D-344); left the
  prompt feet (`↵ picks · esc`), the finder's and guide's foot lines, DrawSection's hint, the panels' field hints.
- Landing (D-340, 2026-11-01, committed): full-screen backdrop, mono name, no HUD, Button; the user is working
  through more landing changes. AsciiButton deleted (e1b86de).
- D-344 (not committed): buttons are cells, ButtonGroup (G1), Avatar, controls as toggle cells (F3), one component
  each. Open: filters as always-open toggle strips (asked, not built).
- Light theme (D-342, 2026-11-01, committed): `--bg` #f3f3f3, bolder/darker glyphs in light. Next: Q-033 (dark
  backdrop faint on some screens; ask the user which screens, then (a) + (b)).
- Smaller leftovers are the *Not yet* lines of each decision in decisions-log.md (grep `Not yet`).

## Blockers
- Blaze: the user's payments profile was refused once (OR_BAOOC_15, likely profile country vs German card); retrying.

## Known issues
- Agent: bugs 1–28 with their order and status in docs/specs/agent-bugs.md (add new ones there); the first real eval
  run (gpt-5.6-terra 66/110, 2026-10-31) is not a baseline. Other providers: Q-031.
- Emulators only: after a Storage URL fetch, a tab's next Firestore write can queue ~55 s in Chrome (HTTP/1.1 connection limit).
- Emulators only: the 6th page load in one Chrome tab stalls ~60 s (connections per host); use a new tab per few loads.
- Emulators only: a Firestore emulator left running for days can stop sending one workspace's live updates; restart it.
- Two live workspaces hold reports written with made-up `createdAt` (2026-10-19 12:00:00.0xx), so they sort above
  reports made that morning. Data, not code.

## Notes for future sessions
- **Visual or animation checks: headless Chrome via puppeteer-core.** Install it in the session scratchpad
  (`npm i puppeteer-core@24`, never in the repo), launch `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` with
  `headless: 'new'` (add `ignoreDefaultArgs: ['--hide-scrollbars']` to see scroll bars). Wait for
  `window.__curtain.getState().revealed` before capturing.
- Hidden or background Chrome tabs (the extension's) pause rAF and throttle timers: scripts stall, exit animations never
  finish, screenshots come out stale. In dev, `window.__advance(t, true)` steps frames.
- The app's port is 5288 (`vite.config.ts`, strict); the user runs their own dev server there. Use another port
  (e.g. 5179: `npm run dev -- --port 5179`) and stop your servers when done.
- Several Claude sessions work on this repo at once. Check `git status` and file times before editing shared files
  (memory-bank, CardPanel.tsx…), and don't commit another session's hunks.
- Test data: click Alice, then create a workspace (there is no example workspace). Seed script: sign in to the auth
  emulator as `test-alice` with the firebase client in node, write a workspace + pieces + items, open `/workspaces/<wid>`
  after clicking Alice.
- Emulators: start them all with `npm run emulators` (or `--only auth,firestore,database,storage`) and stop yours with
  `kill -INT`. One left behind with its CLI gone ignores `-INT` (stopped with `kill` on 2026-10-29); while one runs on
  8080 it keeps old rules: `PUT 127.0.0.1:8080/emulator/v1/projects/demo-north-star:securityRules` loads them.
  Headless: items draw twice (canvas picture + focus), take the last `[data-task]`; dev mounts twice, never clear on unmount.
- Canvas speed: pieces' contents are memoised (keep their props stable); in focus a matrix's cells and heads and a table's
  rows are made only when they change; only what's on screen is drawn (`visible.ts`); a matrix too small to read is
  squares on one canvas (`CellDots`).
  Zooming moves only the world's transform (D-278): what's at screen size reads the *shown* zoom (`useShownZoom`, the
  camera's 120 ms after it stops, at once on a press; in a focus `useSettledZoom`, D-280); spaces take `--zs` from the piece's `--z` in CSS (`zsIn`), never
  from the camera in React; the Marks' L's transition only `--mo`/`--ml` (unscaled `@property`).
  A pan redraws nothing (D-279): a space's view goes to a thin shell moving the world, its contents memoised on the
  zoom (`PlaneInside`, `TaskBoard`, `CardBoard`, `Days`); CanvasView never reads the camera (`World`); nothing written
  per step (`--mark`, `--zs`…) on an element holding the contents. How it was measured: state-history D-279.
  A write draws what it changed (D-287): read what you show from `useWs()` (each field read is listened to), use
  `useWsNow()` in handlers; keep row/head/task components memoised with handlers through a ref, lists via `useKept`.
  Measuring a write: state-history D-287.
- Dev hooks: `window.__kanbanUi` (D-260), `__sceneTime`, `__backdrop`, `__curtain`, `__sweep`, `__advance`.
- Chrome extension screenshots are scaled: viewport 2560 px vs 1568 px frame, so clientX/Y needs ×(innerWidth/1568).
