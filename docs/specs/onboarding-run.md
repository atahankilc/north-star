# Onboarding: how the long runs work, and the run log

_The protocol for any session building onboarding (D-315, [onboarding.md](onboarding.md)), above all long unattended
runs (the user asleep). Part 1 is the rules; Part 2 is the log, the **single source of truth for progress**: after an
auto-compact, read this file first and continue from "Now". Written like [agent-run.md](agent-run.md), which runs at
the same time: the two leads share the repo, the emulators and the machine._

---

## Part 1: the protocol

### 1.1 Who does what
- **The lead** (the main session) plans, briefs, reviews results, commits, and keeps this log. It doesn't write big
  code itself: each step's work goes to a **builder** subagent (`model: opus`), so the lead's context stays small all
  night.
- **Builder**: one per step, a narrow brief: the step's goal, the sections of onboarding.md / onboarding-lessons.md it
  implements, the files it may touch, the gate, what not to touch, "run the checks and report what you ran and its
  output". It edits files but **doesn't commit**.
- **Reviewer**: a fresh subagent (`model: opus`) per step, given the diff, the gate and the spec sections, **not** the
  builder's report (so it isn't anchored). It checks (a) correctness: bugs, broken behaviour of the app around it (the
  onboarding must never break or slow the canvas), keys stolen, focus lost, stores leaking between the demo frame and
  the app; (b) the gate, item by item, by running the checks itself; (c) the rules of onboarding.md §3, one by one;
  (d) every scene against the quality bar of onboarding.md §6.2b (the real screen part, cause then effect, a
  person's cursor, one idea, real-looking data), from its 8-frame strip and the live loop; (e) the shots (1.6): readable, nothing covering its anchor, tokens not raw colours, light theme right, reduced
  motion still; (f) **what's missing or could be better** (shorter words, a better scene, a lesson the spec forgot).
  Verdict: `pass`, `fix` (a list) or `rethink`.
- **Fix loop**: `fix` → a builder fixes exactly the list → the reviewer checks again. At most 3 rounds; still failing →
  revert the step's uncommitted changes (own files only), log why under "Stuck", go on with work that doesn't depend on it.
- **Improve pass**: small "could be better" items inside the step are done in the fix loop; bigger ones go to "Ideas".
- Several builders may run at once only on steps that touch **different files** (the scenes of different areas, for
  instance, once O5 is done).

### 1.2 Working beside other sessions (above all the agent's lead, north-star-b2 or its successor)
- Before each step: `git status`, `git log -5`, `ListAgents`; tell running peers with `SendMessage` which files the
  step will touch ("onboarding-run: step O3 adds src/onboarding/queue.ts, events.ts for ~1 h").
- **Don't edit a file that has uncommitted changes you didn't make.** If a step needs one, do other steps first, then
  ask that peer; never take their hunks.
- **Shared files and who goes first** (agreed with north-star-b2, 2026-10-29):
  - `src/data/history.ts`: the agent run's **S3 adds `onTracked(fn: (label, meta?: { kind?, ids?, op?, actor?:
    'person'|'agent' }) => void)`**. Onboarding uses it once S3 is committed (`git log --grep 'Agent S3'`); until then
    events come from the stores only (onboarding.md §5.5). **Writes with `actor: 'agent'` never trigger lessons.**
  - `package.json`, `vitest.config.*`: vitest comes from the agent run's **S2**. Onboarding adds only the
    `check:lessons` script line, after telling b2. If S2 isn't committed when O2 needs unit tests, write the tests
    anyway and run them when it lands (log it), or ask b2.
  - `src/data/presence.ts` (agent S14 adds the agent as a participant), `src/views/workspace/WorkspaceLayout.tsx`
    (agent S14 mounts its box; another session has uncommitted edits there now): onboarding's one-line additions
    (a demo source in presence; `<Coach />`) go in **after** asking b2, as small separate commits.
  - `src/views/workspace/context.ts`: the agent's S2 adds `getWs()`; onboarding doesn't edit it.
  - `src/firebase.ts` (demo guard) and `vite.config.ts` (the `demo.html` entry): not on the agent's list; tell b2 anyway.
- Hot files (CanvasView.tsx, CardPanel.tsx, WorkspaceLayout.tsx, PlaneCards.tsx, Kanban.tsx, TextItems.tsx,
  selection.ts…): change them as little as possible. Events come from store subscriptions; anchors are
  `data-learn="…"` attributes added in **one** pass (O6), coordinated.
- Commit **only your own files/hunks**. If the shared index holds others' staged work, build the commit from a
  separate index (`GIT_INDEX_FILE=<scratch>/index git read-tree HEAD`, `update-index --cacheinfo` your blobs,
  `write-tree`, `commit-tree -p HEAD`, `update-ref HEAD <new> <old>`), then `git reset -q -- <your paths>`. In zsh never
  name a loop variable `path` (it is `$PATH`).
- D-numbers: onboarding's plan is **D-315**; each built phase may take its own number. Re-check the last `### D-` in
  decisions-log.md right before writing one; the agent run takes numbers too.
- Emulators: if one is already running on 8080/9099/9010, use it, never stop it; if you start your own, stop it with
  `kill -INT` when done. `test:rules` starts its own emulators: if the agent lead is running it, wait (ports busy).
- Dev server on **5181** (5288 is the user's, 5179 the agent run's).
- Headless Chrome: one browser at a time per lead; close it after each check.

### 1.3 Never, during an unattended run
- push, deploy (rules, functions, hosting), change Firebase settings, touch live data;
- edit CLAUDE.md, permission settings, or other sessions' uncommitted work;
- change the defaults or add a theme/motion/background control anywhere (CLAUDE.md hard rule);
- put the ASCII effect over text, or let a demo frame make any network request to Firebase;
- change a rule of onboarding.md §3 without logging it under "For the user".
When unsure: pick the choice that's easiest to undo, write it under "For the user", keep going. The questions in
onboarding.md §11: Q-025, Q-026, Q-027 answered; Q-028 answered (D-316): `a` for every frame, the others deleted.

### 1.4 After every step
1. Checks: `npm run build`; `npm run check:lessons` (from O2); `npx vitest run` (once it exists); `npm run test:rules`
   if rules changed; for anything a person sees, a headless check (puppeteer-core in the scratchpad, state.md's notes).
2. Reviewer verdict `pass`.
3. Commit (own files), message `Onboarding O<n>: … (D-315)` + the co-author line.
4. Update Part 2: the step's line in "Done" (commit, what the reviewer checked, ideas), "Now", "Next".
5. Every ~3 steps: `npm run check:memory`; state.md's onboarding line updated (one line); the shots gallery current.

### 1.5 The night's steps

| Step | What | Gate (on top of 1.4) |
|---|---|---|
| O0 | **Spike: the demo realm** (onboarding.md §6.1–6.2): `demo.html` + `src/demo/main.tsx` + `Stage.tsx`; the `firebase.ts` guard; a tiny fixture; the real plane view (PlaneCards in a focus-like stage) drawing 6 cards and 3 links; a scripted drag of one card via `set()`; a fake cursor. **Decides the approach**: if the real components can't run sealed in one step's time, log why, take the fallback (§10: alias-stub the module in the demo entry; or a `MemoryRouter`), and if even that fails, poster PNGs + CSS motion, and say so under "For the user". | the demo page loads in headless Chrome with **0 requests** to googleapis/firebaseio/firebasestorage, no console errors; screenshot of the plane drawn by the real components, dark + light; the app itself unchanged (smoke: open a workspace, focus a plane) |
| O1 | **Seen-state** (Q-025: Firestore, answered): `src/data/onboarding.ts` (Firestore `users/{uid}/private/onboarding` + localStorage cache + silent fallback), `firestore.rules` (own only, shape, size) + tests in `tests/rules.test.mjs`; `src/onboarding/audience.ts` (new / invited; no doc = new, whatever the account's age, Q-026; role per workspace), `progress.ts` (zustand) | rules tests pass (**not deployed**); unit tests for audience and progress merge (vitest, or logged as waiting for S2) |
| O2 | **Lessons as data + lint**: `lessons.ts` (from onboarding-lessons.md, all of it), `releases.ts` (from state-history.md, D-291 → newest), `scripts/check-lessons.mjs` + the `check:lessons` script | `npm run check:lessons` passes and **fails** on 5 planted mistakes (a missing scene, a 30-word body, a cycle in `after`, a bad role, "kanban" on screen), each reverted |
| O3 | **Events + queue**: `events.ts` (store subscriptions + URL; `onTracked` if S3 is in), `queue.ts` (busy, one at a time, cooldown, retire on done, tipsOff, nudge budget) | unit tests for the queue rules; a headless run logging the events of: open a workspace, `+` a plane, edit, focus, a card, a link, a deck task drag (each fires once, in order) |
| O4 | **Design pass**: `docs/specs/onboarding-preview/index.html` (the app's tokens and fonts, no external links, like timeline-preview) with **2–3 options** each for the welcome, the lesson card, the kind guide and the `?` guide, one marked recommended with why. **All options get built in O5** (Q-028: the user said build them all), so they must be really different, not shades of one | the preview opens locally; the reviewer checks the options are really different and on-brand (DESIGN.md, consistency.md, D-222 prompt look, D-219 panel look) |
| O5 | **The coach surfaces, every look option of O4** (a dev-only switch, onboarding.md §11 Q-028; the recommended one the default; since D-316 only `a` is left and the switch is gone), on placeholder demos: `Coach.tsx` (portal, z, `role="dialog"`, pointerdown stopped), `Welcome`/`WhatsNew` (one Pages component), `Lesson` (anchored, lead line, never over its anchor), `KindGuide` (glued to the `+` menu), `Nudge`, `Guide` (`?`), `Demo.tsx` (the iframe host: postMessage, pause, 3 loops, poster, reduced motion) | shots of every surface in every option, dark + light; the switch absent from a production build (`npm run build`, grep `dist/`); keyboard only: open, page, close, focus back; reduced motion: no loop; `?` free while typing (ignored in inputs) |
| O6 | **Mount + anchors**: `<Coach />` in WorkspaceLayout and Workspaces (one line each, after asking b2 and the session with uncommitted edits there), `data-learn` anchors in **one** pass, the `plus-open` / `context-menu` / `menu-open` one-line hooks | the app's own behaviour unchanged (smoke of focus, `+`, menus, drags, finder, Esc chains); every anchor named in lessons.ts found by `check:lessons` |
| O7 | **Director + fixtures + scene tooling**: `director.ts` (steps API, clock, seek, loop with the cell break/rebuild), `fixtures/pazar.ts` (onboarding.md §6.4), the fake cursor and key chips, a headless `scenes check` (loads, 0 requests, poster, loop equality, dark/light) | the scenes check passes on 3 scenes: `canvas-fit` and `sidenav-plus` (the whole screen, a real click opening the real `+` menu, a real fit glide) and `deck-drag`; the reviewer judges their 8-frame strips and live loops against onboarding.md §6.2b and fails anything below it |
| O8 | **Start**: welcome (4 pages + variants: invited, viewer), empty canvas, workspaces empty state, join pending; their scenes | flow: a fresh emulator user → workspaces empty state → create → welcome → empty-canvas hint gone at the first piece; Bob invited into Alice's filled workspace → the invited variant; Carol viewer → the viewer variant |
| O9 | **The `+` and pieces**: kind guide (every row, its `kind-*`/`card-*` scenes), piece-made, piece-console, focus-plane, focus-lens, hazard-undo, unframe(d), stick-hint, stuck, beside, move-canvas | flow: `+` → kind guide follows the keys → a plane → its lessons in order, never two at once, never during the drag or the focus ink |
| O10 | **Planes and cards** (§3 of lessons): card-made, card-panel, status-evidence, link-made, for-links, multi-select, package-made, brought, competitor-features, parts, plane-filter, guides-snap, right-click | flow over a focused plane; each lesson's rect doesn't cover its anchor |
| O11 | **Text** (§4) and **matrix and table** (§5) | flows; scenes checked |
| O12 | **Documents** (§6) and **decks and days** (§7) | flows; scenes checked |
| O13 | **Together** (§8; two headless browsers as Alice and Bob) and **finding, canvases, settings** (§9) | flows: Bob arrives → `people-here` for Alice; follow; a comment thread |
| O14 | **Nudges** (§10) and **what's new** (§4.4, §7): `releases.ts` (shipped: only `launch`), the sample release as a test fixture, armed lessons marked `NEW` in `?` | flow: a seeded seen-state with an older `lastRelease` + the sample release → what's new only, no welcome, its lessons armed; an old account with no doc → the full welcome; a new account → no what's new |
| O15 | **The guide `?`**: every lesson listed by area, replay, `# keys` (inventory §C), tips on/off; the magenta dot | flow: replay every lesson from `?` (each opens, shows its scene, closes) |
| O16 | **All of it, end to end** + the shots gallery + a polish pass: the reviewer reads every lesson's words aloud against the screen ("does it say what I see?"), timings, the queue's calm, speed (the canvas's frame time with the coach mounted and a demo playing: no worse than without, state-history D-279 / D-287 for how to measure) | the full flow for each audience green; the gallery complete; frame times logged |

If the night runs out, stop at a clean, committed step with the gallery up to date. If it doesn't, do the small, safe
"Ideas", each through the same review.

### 1.6 Screenshots of everything new (for the user to look at and change)
- Headless Chrome (puppeteer-core in the scratchpad, state.md's notes), emulators, a seeded workspace with realistic
  content (the same "Pazar" as the fixtures, written through the client SDK as Alice), the onboarding driven by the
  real triggers.
- Each surface and lesson in **dark and light**, at 1568 × 980 (2× device scale), cropped to the lesson plus enough of
  its anchor to see where it sits; one full-screen shot per flow step; for each scene its poster frame and three frames
  across the loop.
- Saved in `docs/specs/onboarding-shots/` as `O9-03-focus-plane-dark.png`…, plus `docs/specs/onboarding-shots/index.html`:
  a simple page (the app's tokens and fonts, no external links) with every shot under a heading per step and a one-line
  caption (what it is, what to look at, what's not final). Scenes can also be watched live: `npm run dev -- --port 5181`
  then `/demo.html#scene=<id>`; the gallery lists those links. Never published anywhere.
- Retaken when a later step changes a part; old ones replaced, not piled up.

---

## Part 2: the log

### Now
2026-10-29 afternoon (the user is here; resumed after a network pause and two usage-limit stops): O0–O8 committed,
the look pick (D-316). O9 (the `+` kind guide's 18 scenes, 13 piece-lesson scenes) built and fixed once, waiting for
its 2nd review now that O8 is in. Then O10 onward. The shared emulators were restarted (with the user's OK) and now
run from this session; the emulators' firebase-debug.log had grown to 117 GB and was emptied (the user's OK).
Agreed with b2: `onTracked` actor, `agentDriving()`, S13's grown-`before` merges handled (6829f5a).
Never `git add`/`git mv` from builders (shared index).

### Done
_(one line per step: `O0 · <commit> · reviewer: … · ideas: …`)_
- O0 · d37ea15 · the approach holds: real FocusedPlane + PlaneCards in demo.html, `firebase` null there, a network-off
  Firestore in db() only because PlaneCards builds spotRefs while drawing; 0 Firebase requests (dev + production
  build), no errors, dark/light, reduced motion still · reviewer: 2 rounds (heartbeat comment, a rest before the
  press, a fixture that reads real, shorter customer names); checked D-288's chunks: the app's entry and workspace
  chunk split in two but are still fetched ahead in parallel · ideas: in Ideas.
- O1 · 3e2b9aa · seen-state (src/data/onboarding.ts, seenMerge, progress, audience), rules for
  users/{uid}/private/onboarding + 28 rules tests (485/0 on a separate project; storage not exercised: no emulator)
  · reviewer: 3 rounds (early writes beating settings, two tabs, cache-miss = unavailable, stop order, a merge the
  same both ways round: 20 000 random pairs) · not deployed.
- O2 · (this commit) · lessons.ts: all 66 entries (1 welcome, the kind guide's 18 rows, 55 lessons, 5 nudges, 4 empty
  states) with EVENTS, PAYLOADS, ANCHORS, `within` (the busy source a lesson lives on), `after` (waits only while the
  named lesson is queued or showing), per-page roles/audience/kinds, `{owner}`/`{peer}`/`{piece}`; releases.ts only
  `launch`, the sample in releases.sample.ts; check-lessons.mjs (limits, roles, cycles, payloads, placeholders, D-numbers,
  the `+` menu vs the kind guide, same-event pairs ordered, a ratchet of pending scenes/anchors/events) · reviewer: 3
  rounds (lessons that could never show, same-event pairs, a clean checkout, words matching the app, viewer pages,
  shared-delete and join-request pages) · onboarding.md §3.1/§5.4/§5.5/§7 and onboarding-lessons.md kept in step.
- O4 · (this commit) · docs/specs/onboarding-preview/: 3 looks each for the welcome (a wizard window, b ink on the page,
  c a transcript), the lesson card (a prompt card, b margin note, c drawer), the kind guide (a glued column, b ink
  beside, c man page) and `?` (a the finder's twin, b list + preview, c the map); recommended: all `a`. Also no-demo,
  bottom-middle fallback, what's new, narrowed/hidden kind guide, `?` playing a note, done → next, nudge, empty canvas;
  dark/light · reviewer: 3 rounds (ink unreadable over pieces → `--ink-shade` as one layer under the text; demo label
  and pause in a strip under the scene; ways out at `--fg-muted`; sizes on tokens; heights for a 768 px laptop) ·
  onboarding.md §4 (+ §4.2, §4.3, §4.6) updated: 16:10 demos everywhere, placement order, 1.2 s + 320 + 300 ms
  handover. For O5: follow §4.3's placement, not lesson:a's focus mock (it covers two cards).
- O3 · (this commit) · events.ts (store/URL/history watchers → EVENTS with PAYLOADS; write events from `onTracked`'s
  steps, agent writes ignored, merged steps once; `task-moved {done}` added), busy.ts (§5.4's busy sources), queue.ts
  (one at a time, 400 ms calm, 10 s give-up paused while a coach surface shows, one queued per lesson, after/unless/
  within, retire on done, cooldown for automatic triggers, tipsOff, one nudge per page load, holds until the seen-state
  and the role are known) · reviewer: 2 rounds (canvas-open before the seen-state loaded, a stale `landing` keeping
  "busy" forever, confirmed deletes after a cancel, a start/stop race, per-kind pending for the deck's filter) ·
  headless: open, + plane, edit, focus, card, link, deck task drag each once in order (link/deck made by data calls; O6
  redoes them through the UI). Costs: readBusy 0.45 ms at 30k nodes (call only while something waits).
- O5 · (this commit) · the coach, every look a/b/c behind looks.ts's dev-only switch (`?look=welcome:b`,
  `window.__onboardingLook`; absent from production): Coach.tsx (starts progress/events/busy, welcome vs what's new,
  the queue's surface, `?`, the kind guide and empty states beside the queue), Pages (welcome + what's new), Lesson
  (anchored by `data-learn`, place.ts: right/left/above/below, past cards, never over a panel, the taught piece or the
  beside pane; bottom-middle fallback), Nudge, EmptyHint, Demo (the demo.html frame host, postMessage), KindGuide
  (inside the `+` menu's panel, never takes its keys), Guide (`?`: areas folding, keys, tips, plays a lesson), words.ts,
  guideModel.ts, keys.ts, `--ink-shade`; dev helpers devMount.tsx / devGuides.tsx · reviewer: 2 rounds (esc closes a
  lesson first, `?` → Enter reaches it, focus returns, sign-out stops the seen-state, panels never covered, tokens) ·
  shots: /…/tmp/shots/O5a-*, O5b-* (to move into the gallery) · not mounted yet (O6). Note (D-316): the user then
  picked `a` for every frame; b/c, looks.ts and its switch are deleted, so the switch named here no longer exists.
- O6 · (this commit) · `<Coach />` mounted in the workspace and (lazily) on the workspaces page; every ANCHORS name as a
  `data-learn` (39) and every view-only event as a one-line `learn()` (pending: 0 anchors, 0 events); the side nav's
  `?` button (GuideButton, its dot); window capture key handlers skip `[aria-modal=true], [data-coach]` (Backspace on
  the welcome deleted a selected task); lessons find the visible instance of their anchor, the event's `target` first;
  PlaneCards' and CanvasView's carried spotRefs built at drag start, so the demo's network-off Firestore is gone; a
  guard in collab.tsx's cursor report after a canvas remount · reviewer: 2 rounds (hidden consoles/cards as anchors,
  the empty hint over the `+` menu) · smoke 21/21 tips off; tips on, the first esc closes a showing lesson (§3.1.5) ·
  the orphan session's hunks in CanvasView/WorkspaceLayout/canvasView.ts left uncommitted, untouched.
- O7 · (this commit) · src/demo/director.ts (scenes as steps: a person's cursor on a curve with rests, real
  pointer/wheel/key events on the real elements, `set()` for what would write, a deterministic seek, the loop with a
  1 s hold and the cell break/rebuild over the whole page, presses recorded), the clock and an in-memory storage as
  inline scripts in demo.html before any module, demo.html built in its own Vite pass (vite.demo.config.ts, Firebase
  stubbed there) so the app's chunks are the app's alone, the side nav moved to SideNav.tsx and mounted in the app and
  the demo, fixtures/pazar.ts (the made-up startup), scenes canvas-fit / sidenav-plus / deck-drag (+ plane-drag on the
  director), scripts/check-scenes.mjs (0 requests, no errors, press targets, seeks in any order, seam frames, loop
  equality, no focus ring after a press, reduced motion still; dark + light) · reviewer: 3 rounds (the wrong menu row,
  a blank stage after a seek mid-drag, a stray seam frame, framing, a stray focus ring, the demo's own Firebase) ·
  carry-overs for O8: the focusin blur steals focus later keys need; CSS :hover never shows (rewrite in the demo's CSS).
- O8 · (this commit) · the start: the welcome's scenes (pieces-tour, plus-adds-plane, finder-go, peers-comment), its
  invited (`{owner} started this workspace`, the owner's name from members/) and viewer variants, the workspaces page's
  three framed choices (Choices.tsx), the join-pending row and lesson, the empty-canvas hint; the demo CSS rewrite
  (demoCss.ts: `:hover`/`:focus*` from demo marks, demo build only) so the app's own hover and focus looks show; keys
  into the element the app last focused, even inside the coach's inert frame; lessons step aside while a menu is open
  and never cover consoles, docks, the taught piece or its target, leads never cross buttons (place.ts) · reviewer: 3
  rounds (typing lost inside the welcome's frame and hitting app shortcuts, the in-frame check inheriting reduced
  motion, placement over consoles and the `+` menu, a setState during render) · flows A/B/C/F/G pass (new, invited
  editor, viewer, join pending, typing in the frame), on a private Firestore emulator when the shared one hung.

### Stuck
_(none)_

### For the user (in the morning)
- (Done 2026-10-29 ~09:50) the `setFitter`/`fitHere` edits were the user's own; committed as fc76174 at the user's
  request by the audit session.
- Deploy the rules once O1 is committed and you've read them: `npm run test:rules`, then
  `npx firebase deploy --only firestore:rules --project north-star-db` (until then, seen-state lives in the browser).
- (Done 2026-10-29 ~09:45) **Looks picked** (Q-028): the user chose `a` for all four frames from the preview; b/c being
  deleted (D-316).

### Ideas
_(the reviewers' and builders' "could be better", not done yet)_
- (Done after S9) learn.ts sends nothing while `agentDriving()` (src/agent/driving.ts) is true; agent writes carry
  `actor: 'agent'` (b2: a must in agent-run.md, with a test).
- O12: the `deck` lesson's page 1 (E+) says "`+ add a task` types one; Enter keeps typing the next" but deck-drag shows
  only the drag: give it its own page + scene (`deck-add`) or cut the sentence.
- **O6 must (done in O6):** Kanban.tsx:339, FilterDock.tsx:38, KanbanFilterDock.tsx:47 (window capture handlers) skip events from
  inside `[role=dialog]`: Backspace on the coach's welcome deleted a selected task (O5 review). Before mounting Coach.
- O7: one demo frame reused, scenes swapped in place (today a new scene reloads demo.html); preload on idle; measure in
  O16 what opening `+` costs with the kind guide's frame.
- O5: the first esc goes to window handlers set up before the lesson (a selected task/card, following), then the
  lesson; `keys: ? → tips off` turns off every tip (give the kind guide its own switch in `?`?); progress.ts imports
  firebase/auth directly: a `watchUser()` in src/data/auth.ts would be cleaner.
- (Resolved by D-316) O5 shipped all three looks of each frame until the user picked; only `a` is left.
- O1: `roleHere`/`canEditHere` in src/onboarding/audience.ts copy `roleOf`/`canEditIn` (src/data/workspaces.ts, which
  loads Firestore): move them into a pure module under src/model once the agent run's model split is committed.
- O1: the rules bound `seen`/`armed` counts, not their values' sizes (rules can't loop); only your own doc is at stake.
- O2: features with no lesson yet: deck lanes, column limits and labels (D-256), tags and the TAG filter (D-056),
  `linked · N` (D-235).
- O0: PlaneCards builds every card's spotRef while drawing (`carry`): make it lazy at drag start (O6's pass), then
  drop the demo-only Firestore in db().
- O0/O7: scenes should drive real pointer events on `data-target="card:<id>"` so the press marks, 0.8 lift and landing
  L's play; the drop's refused write needs the ops layer's memory backend or a stage hook that `set()`s on drop.
- O0: the demo page preloads the three and firebase chunks (shared helpers); fine while same-origin cached.
- O0 (app, not onboarding): a competitor card says "2 features" twice (the closed strip and the meta line).
- O4 (spec): scenes are 16:10 but the lesson card and kind guide asked for 4:3; the glued kind guide needs a min height
  (~330 px) when typing narrows the menu; the `+` menu (~450 px) runs off a 768 px screen; lesson placement tries
  right, left, above, then the middle-bottom card; `# keys` folds; "✓ done" holds ~1.2 s and the next lesson waits.
- O2: after the run, a `check:lessons --final` that fails while scripts/lessons-pending.json isn't empty.
