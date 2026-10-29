# Project State

_Last updated: 2026-10-29 (onboarding plan D-315, tasks side view D-300, deck naming D-301, linked decks always filter D-303)_

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
- D-310 (pieces drawn oldest first, the newest on top): committed, not pushed.
- D-308 (filters only while their view is open; what's added after shows): committed, not pushed.
- Committed, **not pushed** (2026-10-29): D-293 hidden while zooming and D-297 focus in/out together (efd34b4), D-294
  card faces on kanbans and tables (0c9178f), D-295 readable text on tinted cards (1c78097), D-296 dropped plans
  (memory only), D-298 timeline leftovers (06e11c7), D-299 card pickers as the prompt (80441e7), a framed table's focus
  kept inside its window (f14b321). D-291/D-292 and before: pushed and live. What was done: state-history.md.
- D-300/D-301/D-303/D-314 (decks and days in one side view, plane → deck → days; timelines always of something):
  committed, not pushed.
- D-304, the timeline as a strip (tasks' `start`, sideways without end, scales, overview): committed (414e24b), not
  pushed; its rule is already deployed. Its preview of four is docs/specs/timeline-preview/ (B, C, D not built).
- Uncommitted code in the tree from another session (`setFitter` in CanvasView/canvasView.ts, WorkspaceLayout.tsx): not
  part of the above.

## Next steps (not started; ask the user which first)
- Several canvases (D-302): all four sessions built (D-305–D-307, D-309) and checked (D-311); a shared piece's delete asks
  which (D-313); committed, not pushed;
  rules deployed.
- Documents (D-232): files (images, PDFs) once Storage is live; writing documents in the app; renaming from the UI.
- The agent back: plan accepted (D-312, docs/specs/agent.md): OpenAI, own keys, the person's model, previews, the
  bottom-right corner. Overnight run 2026-10-29/30 (docs/specs/agent-run.md, its log is the progress): S1–S7 done
  (action inventory, vitest + src/model, src/ops core, every content write as ops except tasks), S8 next. 1.0's rules: decisions-1.0.md.
- Onboarding: plan written (D-315; docs/specs/onboarding.md, onboarding-lessons.md, onboarding-run.md). Overnight run
  2026-10-29/30 (onboarding-run.md's log is the progress): O0–O6 done (demo realm, seen-state + rules **not deployed**,
  lessons + `check:lessons`, events + queue, look preview, the coach, mounted with anchors and the side nav's `?`); the
  look picked: `a` everywhere (D-316); O7 (director, Pazar fixture, first scenes) in its fix round.
- Parked (D-312: the agent uses own keys only): the
  workspace key once Blaze goes through: `npx firebase functions:secrets:set AI_KEY_SECRET --project north-star-db`,
  `npm run deploy:functions`, try as owner + member (also the workspace-delete cleanup).
- Smaller leftovers are the *Not yet* lines of each decision in decisions-log.md (grep `Not yet`).

## Blockers
- Blaze: the user's payments profile was refused once (OR_BAOOC_15, likely profile country vs German card); retrying.

## Known issues
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
