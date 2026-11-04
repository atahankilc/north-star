# Project State

_Last updated: 2026-11-02 (the agent's web D-360 checked on the stub and pushed; windows and docked panels D-359; cards on one face D-358 done; onboarding content D-349; Steps on Tabs, tabs in one row; check:kit 0, D-326 done; buttons as cells D-344; two buttons and one HUD icon set D-343, light theme D-342, the landing D-340; the workspaces page D-338; the kit, D-326; gallery D-324 G1; audit P1–P3 and its decisions D-317–D-323; onboarding plan D-315, tasks side view D-300)_

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
- Rules: Firestore rules + indexes and RTDB deployed 2026-10-29 (RTDB again for presence `tasks`, D-300) (latest change D-292, no `bends` check); rules tests 639/0 (2026-11-03). Until Blaze,
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
- **The agent, where it stands (2026-11-02; D-327, D-328, D-329 built and pushed; D-341 P1 done):**
  1. P1 measured, committed and pushed (529d57b; state-history 2026-11-02); the runs' records are in evals/results.
     **Waiting for OpenAI credit:** the four runs in agent-pipeline.md §7, then routing and the map's default (D-341).
  2. In the app: both go buttons checked headless on the stub 2026-11-02 (`job demo`); `/restructure` on a real model
     still to see; the preview pick saved with the chat (a rules change). Every agent bug: docs/specs/agent-bugs.md (its table).
- Several canvases (D-302): all four sessions built (D-305–D-307, D-309) and checked (D-311); a shared piece's delete asks
  which (D-313); pushed;
  rules deployed.
- Documents (D-232): files (images, PDFs) once Storage is live; writing documents in the app; renaming from the UI.
- The agent (D-312, docs/specs/agent.md; the overnight build: docs/specs/agent-run.md): see the first item above.
- Onboarding (D-315, D-316): **built and live** (O0–O16; state-history.md). D-349 (2026-11-02, committed, not pushed):
  content rewritten, every lesson the centred modal, ~30 lessons by screen/piece, no nudges; checked headless on
  emulators. Then Lesson/Nudge, 10 unused scenes, `idle` and seen-state `nudges` deleted; D-351: ≤ 8 pages, welcome
  reordered, lessons split; D-357: canvases in the welcome and piece-made; all pushed and live 2026-11-02,
  firestore:rules deployed (631/0). Not seen in a browser: the comment lesson over the threads panel. The agent's
  lessons wait for its redesign.
- Parked (D-312: the agent uses own keys only): the
  workspace key once Blaze goes through: `npx firebase functions:secrets:set AI_KEY_SECRET --project north-star-db`,
  `npm run deploy:functions`, try as owner + member (also the workspace-delete cleanup).
- Gallery and foundation (D-324, D-326): done 2026-11-01: the whole UI on the kit, `check:kit` at 0 (baseline `{}`),
  folders by layer/area; the agent's column on Window, InPlaceMenu added, text caps in limits.ts (pushed 2026-11-01;
  checked headless on emulators). Left: D-326's smaller *Not yet* notes (Chip world size, a third Tabs look).
- D-335 (Q-029 + old-data code deleted): pushed; firestore:rules deployed 2026-11-01 (rules tests 616/0).
- D-337 fonts and greys (2026-11-01): Inter + JetBrains Mono, mono only on system bits, brighter greys, the agent's
  column and picture too; pushed 2026-11-01. evals/fonts → Inter: the agent session's (after its terra run). Preview: docs/specs/font-preview/. Its leftovers done by D-366 (2026-11-04): faint only on marks, the world's smallest text 8 px.
- D-339 (2026-11-01, pushed): rules enforced by hooks; git hooks on (core.hooksPath set by the user). Claude Code
  loads `.claude/settings.json` after `/hooks` or a new session.
- Landing (D-340, 2026-11-01, committed): full-screen backdrop, mono name, no HUD, Button; the user is working
  through more landing changes. AsciiButton deleted (e1b86de).
- D-344 (pushed; + Steps on Tabs, tabs scroll in one row, 2026-11-02); its open item done by D-364 (2026-11-04, pushed): filters as columns of tick rows.
- Light theme (D-342, 2026-11-01, committed): `--bg` #f3f3f3, bolder/darker glyphs in light. Q-033 closed by D-348.
- D-352–D-356 (2026-11-02, state-history): pushed (756bd67), firestore:rules deployed after (633/0); D-348 (Settings → display: hud size, background strength) pushed, the user checked it.
- D-350 (2026-11-02, pushed): the prompt family on one set of parts, done (state-history); `@` and `/` checked on emulators.
- Cards on one face (D-358, docs/specs/cards.md): done 2026-11-02, five steps, one move (`startMove`) and the tray's task after (state-history). D-363 (few cards fill a plane), D-365 (bigger names, kind tab) 2026-11-04: not committed, the user to check their numbers; D-367 (far view) taken out.
- Windows and docked panels (D-359, 2026-11-02): all eight steps and the open items done, pushed and live (f2d28ac, deploy ok); left: beside's row line wins a press where it crosses the split line (as before).
- The agent's web (D-360, docs/specs/agent-web.md, 2026-11-02): both steps built (web search on every turn, sources under the answer; `/research` with parallel researchers and a cited document); checked on the stub and pushed (a6872f8; state-history); not on a real key yet: what to watch then is in D-360's *Not yet*.
- Shared code above the kit (D-361, docs/specs/shared-code.md): all four groups done 2026-11-03 (state-history); the add fields keep what's typed on leaving.
- Sweep 2026-11-03 (state-history): threads' rule (pushed 0f7ddf4, deployed, 639/0), Crash boundary, loading waits for every listener; then 10, 11, 14, 12, 13, 15, 17, 18, 9, 7, 8, 16, 19, 22; still open: 5, 20, 21 and small leftovers, listed there under **Still open from the sweep**.
- Smaller leftovers: each decision's *Not yet* in decisions-log.md; the 2026-11-03 test pass's fixes (pushed) and left items: state-history.

## Blockers
- Blaze: the user's payments profile was refused once (OR_BAOOC_15, likely profile country vs German card); retrying.

## Known issues
- Agent: bugs 1–48 (45–48 from the sweep: fixed 2026-11-03; 44, organising moving things far: fixed in code 2026-11-02, to measure; 43, non-goals as tasks: eval edit-17 built 2026-11-02, to run on credit), order and status in docs/specs/agent-bugs.md (add new ones there). Other providers: Q-031.
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
- Dev hooks: `window.__kanbanUi` (D-260), `__sceneTime`, `__backdrop`, `__curtain`, `__sweep`, `__advance`, `__onboarding.reset()`
  (or `?onboarding=reset`: this tab sees the onboarding as a new person, on a sessionStorage copy, real seen-state
  untouched; the address drops it at once, expected; `?onboarding=real` back; `?release=sample` for what's new).
- Chrome extension screenshots are scaled: viewport 2560 px vs 1568 px frame, so clientX/Y needs ×(innerWidth/1568).
