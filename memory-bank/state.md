# Project State

_Last updated: 2026-10-29 (D-288 speed leftovers, D-289 small details, D-290 one card on many planes closed; not pushed)_

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
- Rules: Firestore rules + indexes and RTDB deployed 2026-10-28 (latest change D-282, `places`); rules tests 429/0. Until Blaze,
  deploy without Storage: `npx firebase deploy --only firestore:rules,firestore:indexes,database --project north-star-db`.
- Waiting for Blaze: Cloud Functions (workspace key D-079, model enforcement D-104, cleanup trigger) and Storage
  (documents' files, D-232; `storage.rules` allow nothing yet). The assistant's client code went with 1.0 (D-248); only
  its server side in `functions/` and the `ai`/`aiUsage`/`aiSecrets` rules are kept.

## In progress
- Speed: D-287 pushed and live (Pages deployed 2026-10-29); D-288 (frames, library chunks) committed, **not pushed**.
- One card on many planes closed (D-281–D-286, D-290: ⇧⌘V, threads say where the card is). D-290 committed, **not pushed**.
- Small details (D-289): unframed on black and sized to contents, timeline unframes and lost `shows`, focus on black,
  plain dock dropdowns. Committed, **not pushed**; `firestore.rules` (`open` on timelines) **not deployed**.

## Next steps (not started; ask the user which first)
- Plane parity with the old board, left over (D-207's and D-225's *Not yet*): link bend points (D-155), links to a
  competitor's features and dropping a link on a small card.
- Documents (D-232): files (images, PDFs) once Storage is live; writing documents in the app; renaming from the UI.
- The assistant back as a piece (its rules are in decisions-1.0.md; check them with the user first). Then the
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
