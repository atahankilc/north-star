# Project State

_Last updated: 2026-10-22 (D-223: piece names held at screen size)_

A snapshot, not a history. What was done and how it was verified, session by session, is in
[state-history.md](state-history.md) (not auto-loaded; grep it by D-number). Keep this file under ~100 lines: when
something is finished, add its entry to state-history.md and leave at most one line here.

## Phase
- Phases 0–4 done: scaffold + design language, one board (D-040–D-052), collaboration (D-065–D-071), settings + AI (D-073–D-079).
- Phase 5 in part: export/import/TSV/PNG done (D-080); attachments built, emulator-only (D-083).
- Ongoing: the user's assistant redesign (D-094–D-101, D-114, D-121 done) and board editing (D-108–D-113, D-115, D-117).

## Live vs not yet
- Live at https://atahankilc.github.io/north-star/; every push to `main` redeploys. Firestore + RTDB rules and indexes deployed
  (latest: Firestore rules 2026-10-20 for D-155–D-159; RTDB 2026-10-18 for D-124's `more`; rules 253 tests incl. sections and text setting (D-130); reports readable while not saved yet, so a save shows at once; research written twice keeps only the newest).
- Waiting for Blaze: Cloud Functions (workspace key D-079, model enforcement D-104, cleanup trigger), `storage.rules`
  (attachments D-083). Flags `WORKSPACE_KEYS_LIVE` (src/data/ai.ts) and `ATTACHMENTS_LIVE` (src/data/attachments.ts) are `false`.
- Tried with a real key: chat, proposals, [web], agent loop, deep research, reports. Only with a fake OpenAI: `/analyze` (D-099),
  `edit_link` / `add_note` (D-108). Not tried in the app at all: `update_project` (D-120), D-122's edits, D-123's text and moves, D-125/D-126/D-129's layouts, D-131's frames.

## In progress
- 2026-10-19 fix, pushed: deleting a workspace with ~10+ reports was refused (a batch's rules may read ≤ 20 docs;
  each report body's delete reads its summary twice), so `deleteWorkspace` now takes reports 6 to a batch; rules test
  added. Reports "out of order": the code sorts right; two live workspaces hold reports written with made-up `createdAt`
  (2026-10-19 12:00:00.0xx), so reports made that morning sat below them. Flaky uploads: not reproduced.
- Nothing uncommitted: D-124–D-131, autoGrow fields and the group drag fix pushed 2026-10-18 (see state-history.md).
- D-132 (title block resize + animated fold with a bigger name) committed 2026-10-18 (see state-history.md).
- Phase 6 (docs/specs/usefulness.md), from examining the user's BUBBLES workspace: slice 1, matrix criteria (D-133), built,
  committed, rules deployed 2026-10-19. Slice 2, the assistant writes criteria (D-134), committed;
  try `/criteria` on BUBBLES with a real key. Slice 3, competitor lines off by default (D-135), committed.
  Slice 4, not relevant + confidence (D-136), committed, rules deployed 2026-10-19.
  Slice 5, status + evidence (D-137), committed, rules deployed 2026-10-19.
  Slice 6, priorities (D-138), committed, rules deployed 2026-10-19. Planes and packages (D-139, docs/specs/planes.md): step 1, planes (D-140), committed, rules deployed 2026-10-19.
  Step 2, packages (D-141), committed, rules deployed 2026-10-19. Step 3, the assistant on planes (D-142), committed
  (no rules change). Step 4, plane filter in other views (D-143), committed. Planes spec done. Slice 8,
  overview (D-144), committed, rules deployed, pushed 2026-10-19. Phase 6 plan done.
- Competitor regions (D-145): where a competitor operates, REGION filter (bar + matrix footer), assistant fields; committed 2026-10-19.
- LINKS filter: one group per kind (D-146), each with its own colour, solid lines (D-147), 2026-10-19.
- Board grid (D-148): one `+` every 0.625, card corners land on marks, no perspective drift, cards 2.5 wide with no grey
  edge; drags snap to fifths between marks (D-149), 2026-10-19.
- Card hover/selection as corner marks, dragged card shrinks to 0.8 with its corners on where it lands, 5 px drag
  threshold (D-150), 2026-10-19.
- Grid `+` stays a thin `+` zoomed out, thinning to every 4th instead of turning to dots (D-151), 2026-10-19.
- Zoomed out: title alone in whole words (≤3 lines), far out bars instead of stars (D-153), 2026-10-19.
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
- Board speed with many competitors (2026-10-20, committed): hidden feature rows / folded-part rows are no longer mounted
  (they mount to open and unmount after closing), lists memoised, row decorations skip raycasts. Hover stalls 918 → 102 ms.
- Go to back for every space (D-196): compass in the side nav under fit, no keys (D-201), planes' places folded (D-200); canvas (planes' insides too) and focused plane. 2026-10-21, not committed.
- Threads panel as list + thread halves, nothing on the canvas, cell-by-cell build/break for the tab and each half, go there an icon in the header (D-199). 2026-10-21, committed.
- Plane back to the old board's power, step by step (asked 2026-10-21): step 1, card motion (D-203); step 2, card inside
  (D-205, shown only, nothing sets it yet). Step 3, links (D-207); step 4, the right
  panel's look (D-219), filled for every card type (D-221).
  Next: multi-select, guides, right-click, competitor features beside cards, filters (the user picks). Fixed 2026-10-21:
  reloading in focus was black (the fit ran before the screen was measured: zoom 0.1 at 0, 0); it now waits, then sits at once.
- Matrix as a generic canvas piece (D-204): templates, card/typed axes, scale/number/text cells, setup in focus. 2026-10-21, committed, Firestore rules deployed; not pushed. A resizable window on the canvas, no marks (D-208), its own focus (D-206), 2026-10-22. Cards-crossed look, wizard + tabbed setup, totals options (D-212), 2026-10-22, committed, Firestore rules deployed. Fit, sticky heads, centring (D-214); long names, setup pills (D-216); pan from cells, heads nearer the left (D-217).
- Piece names readable at any zoom, edit as a cyan field with `>` and a count (D-223), 2026-10-22, committed.
- Lenses: table (D-209), sticking (D-210), beside the plane in focus (D-211), table pages (D-213), links shown and made from a dropdown (D-215), 2026-10-22, rules deployed.
- Menus as a prompt (D-222): `+`, go to, start over from, right-click and every Select; `>` line, letters; one click outside closes. 2026-10-22, committed.
- Redesign started (2026-10-20): no pages, one canvas per workspace, the board at `/board` (D-174); the HUD moves to a
  left side nav piece by piece, you + settings bottom left first (D-175); planes (D-180, first called boards) placed on the canvas from the side
  nav's `+` (D-176, `pieces`), renamed/moved/resized in edit mode from their console (D-179, D-180); terminal look with corner marks (D-181);
  delete asks with hazard tape, 25 px snapping (D-182, D-183); `focus` spreads a plane over the screen like ink (D-184, D-185).
  Cards on planes (D-187); text anywhere, canvas or plane (D-188, D-190); cursors, total follow, selection marks (D-191);
  comment threads (D-192); text's old look back: section names, kickers, turns, the title's sizes and fold (D-194;
  what else was lost is in D-194's *Not yet*). All the old code archived in `src/archive/`, out of the build (D-177); features come back as pieces. Not pushed; RTDB + Firestore rules deployed 2026-10-20. Next: the board's cards
  inside its piece (each board its own items: maybe a plane per board, D-139), then tables etc.; pieces in the export.

## Next steps
0. **Board ideas after D-108 (suggested to the user, not started; ask which first):**
   - Try `edit_link` / `add_note` with a real key.
   - Link chips already hide when too small (D-111); left: draw them at a constant screen size.
   - Lines crossing cards or other links' chips: nudge chips apart (parallel links between a pair are done, D-113).
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
- Rules tests: "owner/member reads workspace-key usage" fail (also on the committed rules, seen 2026-10-19).
- At 390 px the board's filter bar overlaps the top of the side panel.
- Emulators only: after a Storage URL fetch, a tab's next Firestore write can queue ~55 s in Chrome (HTTP/1.1 connection limit).
- Dev only: drei `<Html>` logs "synchronously unmount a root" when the board unmounts with one shown. Harmless.
- The bundle is about 1.6 MB (three + drei + firebase). Code-split views later.

## Notes for future sessions
- On the board, draw lines with `BoardLine`, never drei `<Line>` (it recompiled line shaders on every render).
- **Visual or animation checks: headless Chrome via puppeteer-core.** Install it in the session scratchpad
  (`npm i puppeteer-core@24`, never in the repo), launch `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` with
  `headless: 'new'` (add `ignoreDefaultArgs: ['--hide-scrollbars']` to see scroll bars). Wait for
  `window.__curtain.getState().revealed` before capturing.
- Hidden or background Chrome tabs (the extension's) pause rAF and throttle timers: scripts stall, exit animations never
  finish, screenshots come out stale. In dev, `window.__advance(t, true)` steps frames.
- The user runs their own dev server on :5173. Use another port (e.g. 5179) and stop your servers when done.
- Several Claude sessions work on this repo at once. Check `git status` and file times before editing shared files
  (memory-bank, NodeCard.tsx…), and don't commit another session's hunks.
- Test data: click Alice, then create a workspace (the example is archived, D-177). Seed script: sign in to the auth emulator as `test-alice` with the
  firebase client in node, write a workspace + items, open `/workspaces/<wid>` after clicking Alice.
- Dev hooks: `window.__boardItems`, `__sceneTime`, `__backdrop`, `__curtain`, `__sweep`, `__canvas`, `__advance`,
  `__orbAntic`, `__orbFace`, `__orbReact`, `__orbPom`.
- Chrome extension screenshots are scaled: viewport 2560 px vs 1568 px frame, so clientX/Y needs ×(innerWidth/1568).
- OrbitControls listens on the Board's wrapper div (not the canvas), so card handlers run first and can disable panning.
- Old workspaces may have ideas and features overlapping on the shared board (they used to be separate boards).
