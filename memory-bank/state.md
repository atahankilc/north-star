# Project State

_Last updated: 2026-10-18 (D-118 project title block on the board)_

A snapshot, not a history. What was done and how it was verified, session by session, is in
[state-history.md](state-history.md) (not auto-loaded; grep it by D-number). Keep this file under ~100 lines: when
something is finished, add its entry to state-history.md and leave at most one line here.

## Phase
- Phases 0–4 done: scaffold + design language, one board (D-040–D-052), collaboration (D-065–D-071), settings + AI (D-073–D-079).
- Phase 5 in part: export/import/TSV/PNG done (D-080); attachments built, emulator-only (D-083).
- Ongoing: the user's assistant redesign (D-094–D-101, D-114 done) and board editing (D-108–D-113, D-115, D-117).

## Live vs not yet
- Live at https://atahankilc.github.io/north-star/; every push to `main` redeploys. Firestore + RTDB rules and indexes deployed
  (latest 2026-10-18, rules 245 tests incl. the title label; reports readable while not saved yet, so a save shows at once; research written twice keeps only the newest).
- Waiting for Blaze: Cloud Functions (workspace key D-079, model enforcement D-104, cleanup trigger), `storage.rules`
  (attachments D-083). Flags `WORKSPACE_KEYS_LIVE` (src/data/ai.ts) and `ATTACHMENTS_LIVE` (src/data/attachments.ts) are `false`.
- Tried with a real key: chat, proposals, [web], agent loop, deep research, reports. Only with a fake OpenAI: `/analyze` (D-099),
  `edit_link` / `add_note` (D-108).

## In progress
- Nothing in progress; D-118 (project title block) committed, not pushed. Keep this section true: empty it when work is committed.

## Next steps
0. **Board ideas after D-108 (suggested to the user, not started; ask which first):**
   - Try `edit_link` / `add_note` with a real key.
   - Link chips already hide when too small (D-111); left: draw them at a constant screen size.
   - Lines crossing cards or other links' chips: nudge chips apart (parallel links between a pair are done, D-113).
   - Multi-select: align / distribute, arrow-key nudge, broadcast the whole selection (presence `sel` carries only the last one).
   - Formatting in card notes (the chat's light Markdown, D-089).
   - `add_note` notes can overlap a link chip: offset or left-align them.
1. Finish the workspace key (D-079) once Blaze goes through: user runs
   `npx firebase functions:secrets:set AI_KEY_SECRET --project north-star-db`, then `npm run deploy:functions`, set
   `WORKSPACE_KEYS_LIVE = true`, push, try with a real key as owner + member (also the workspace-delete cleanup).
2. Attachments live (D-083), once on Blaze: `npm run deploy:rules` (includes storage; until Blaze use
   `--only firestore:rules,database`), `gsutil cors set cors.json gs://north-star-db.firebasestorage.app` (or the
   `VITE_FIREBASE_STORAGE_BUCKET` repo variable), flip `ATTACHMENTS_LIVE = true`, push, try upload, export and a workspace delete live.

## Blockers
- Blaze: the user's payments profile was refused once (OR_BAOOC_15, likely profile country vs German card); retrying.

## Known issues
- At 390 px the board's filter bar overlaps the top of the side panel.
- Emulators only: after a Storage URL fetch, a tab's next Firestore write can queue ~55 s in Chrome (HTTP/1.1 connection limit).
- Dev only: drei `<Html>` logs "synchronously unmount a root" when the board unmounts with one shown. Harmless.
- The bundle is about 1.6 MB (three + drei + firebase). Code-split views later.

## Notes for future sessions
- **Visual or animation checks: headless Chrome via puppeteer-core.** Install it in the session scratchpad
  (`npm i puppeteer-core@24`, never in the repo), launch `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` with
  `headless: 'new'` (add `ignoreDefaultArgs: ['--hide-scrollbars']` to see scroll bars). Wait for
  `window.__curtain.getState().revealed` before capturing.
- Hidden or background Chrome tabs (the extension's) pause rAF and throttle timers: scripts stall, exit animations never
  finish, screenshots come out stale. In dev, `window.__advance(t, true)` steps frames.
- The user runs their own dev server on :5173. Use another port (e.g. 5179) and stop your servers when done.
- Several Claude sessions work on this repo at once. Check `git status` and file times before editing shared files
  (memory-bank, NodeCard.tsx…), and don't commit another session's hunks.
- Test data: click Alice, then "Create example" (emulators). Seed script: sign in to the auth emulator as `test-alice` with the
  firebase client in node, write a workspace + items, open `/workspaces/<wid>` after clicking Alice.
- Dev hooks: `window.__boardItems`, `__sceneTime`, `__backdrop`, `__curtain`, `__sweep`, `__canvas`, `__advance`,
  `__orbAntic`, `__orbFace`, `__orbReact`, `__orbPom`.
- Chrome extension screenshots are scaled: viewport 2560 px vs 1568 px frame, so clientX/Y needs ×(innerWidth/1568).
- OrbitControls listens on the Board's wrapper div (not the canvas), so card handlers run first and can disable panning.
- Old workspaces may have ideas and features overlapping on the shared board (they used to be separate boards).
