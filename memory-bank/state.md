# Project State

_Last updated: 2026-10-28 (one card on many planes: D-281 planned; D-282–D-285 built: data, planes, bringing in, panel)_

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
- One card on many planes (D-281), docs/specs/shared-cards.md: sessions 1 (data, rules, deployed), 2 (planes draw and
  move placed cards, Delete takes off), 3 (`existing card…`) and 4 (PLANES, `⧉ N`, `use that one`) done and committed,
  not pushed (D-282–D-285); session 5 next (matrix, table, kanban, finder, comments, the panel's own lists).

## Next steps (not started; ask the user which first)
- Plane parity with the old board, left over (D-207's and D-225's *Not yet*): link bend points (D-155), links to a
  competitor's features and dropping a link on a small card.
- Documents (D-232): files (images, PDFs) once Storage is live; writing documents in the app; renaming from the UI.
- The assistant back as a piece (its rules are in decisions-1.0.md; check them with the user first). Then the
  workspace key once Blaze goes through: `npx firebase functions:secrets:set AI_KEY_SECRET --project north-star-db`,
  `npm run deploy:functions`, try as owner + member (also the workspace-delete cleanup).
- Speed, measured, not done (D-279's *Not yet*, numbers in state-history): one write draws every piece (`useWs` one context, new arrays per snapshot); code-split the workspace
  route (Pages drops old chunks on deploy: needs a reload on a failed chunk).
- Smaller leftovers are the *Not yet* lines of each decision in decisions-log.md (grep `Not yet`).

## Blockers
- Blaze: the user's payments profile was refused once (OR_BAOOC_15, likely profile country vs German card); retrying.

## Known issues
- Emulators only: after a Storage URL fetch, a tab's next Firestore write can queue ~55 s in Chrome (HTTP/1.1 connection limit).
- The bundle is one 2.7 MB chunk (three + firebase + the canvas). Code-split pieces later.
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
- Emulators: a firestore one left on 8080 (its CLI gone) keeps its old rules: `PUT 127.0.0.1:8080/emulator/v1/projects/demo-north-star:securityRules`
  loads them, `DELETE …/documents` clears data, start the rest `--only auth,database,storage`; stop yours with `kill -INT`.
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
- Dev hooks: `window.__kanbanUi` (D-260), `__sceneTime`, `__backdrop`, `__curtain`, `__sweep`, `__advance`.
- Chrome extension screenshots are scaled: viewport 2560 px vs 1568 px frame, so clientX/Y needs ×(innerWidth/1568).
