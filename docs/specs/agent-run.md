# The agent: how the long runs work, and the run log

_The protocol for any session building the agent (D-312, [agent.md](agent.md)), above all long unattended runs (the
user asleep). Part 1 is the rules; Part 2 is the log, the **single source of truth for progress**: after an
auto-compact, read this file first and continue from "Now"._

---

## Part 1: the protocol

### 1.1 Who does what
- **The lead** (the main session) plans, briefs, reviews results, commits, and keeps this log. It doesn't write big
  code itself: each step's work goes to a **builder** subagent (`model: opus`), so the lead's context stays small for
  the whole night.
- **Builder**: one per step, a narrow brief: the step's goal, the files, the gate, what not to touch, "run the checks
  and report what you ran and its output". It edits files but **doesn't commit**.
- **Reviewer**: a fresh subagent (`model: opus`) per step, given the diff and the gate, **not** the builder's report
  (so it isn't anchored). It checks (a) correctness: bugs, broken behaviour, missed cascades, rules, undo; (b) the
  gate, item by item, by running the checks itself; (c) **what's missing or could be better** (simpler, faster, closer
  to agent.md, something agent.md didn't foresee). Verdict: `pass`, `fix` (a list) or `rethink`.
- **Fix loop**: `fix` → a builder fixes exactly the list → the reviewer checks again. At most 3 rounds; still failing →
  revert the step's uncommitted changes (own files only), log why under "Stuck", go on with work that doesn't depend on it.
- **Improve pass**: the reviewer's "could be better" items that are small and inside the step are done in the fix
  loop; bigger ones go to "Ideas" in the log for the user.
- Several builders may run at once only on steps that touch **different files**.

### 1.2 Working beside other sessions
- Other Claude sessions edit this repo at the same time. Before each step: `git status`, `git log -3`, and
  `ListAgents`; tell running peers with `SendMessage` which files the step will touch ("agent-run: step S4 edits
  src/data/cards.ts, edges.ts for ~1 h").
- **Don't edit a file that has uncommitted changes you didn't make.** If a step needs one, do other steps first, then
  ask that peer; never take their hunks.
- Hot files (CanvasView.tsx, CardPanel.tsx, WorkspaceLayout.tsx, selection.ts, TextItems.tsx…): change them as little
  as possible. That's why every old write function stays as a **thin wrapper** with the same signature over the new
  ops: callers in views don't have to change tonight.
- Commit **only your own files/hunks**. If the shared index holds others' staged work, build the commit from a
  separate index (`GIT_INDEX_FILE=<scratch>/index git read-tree HEAD`, `update-index --cacheinfo` your blobs,
  `write-tree`, `commit-tree -p HEAD`, `update-ref HEAD <new> <old>`), then `git reset -q -- <your paths>`. In zsh never
  name a loop variable `path` (it is `$PATH`).
- D-numbers: re-check the last `### D-` in decisions-log.md right before writing one; others take numbers too.
- Emulators: if one is already running on 8080/9099/9010, use it, never stop it; if you start your own, stop it with
  `kill -INT` when done. Dev server on 5179 (5288 is the user's).

### 1.3 Never, during an unattended run
- push, deploy (rules, functions, hosting), change Firebase settings, touch live data;
- edit CLAUDE.md, permission settings, or other sessions' uncommitted work;
- put any API key anywhere (there is none tonight: everything is built, tested and shown with a stub model);
- change a rule of agent.md without logging it under "For the user".
When unsure: pick the choice that's easiest to undo, write it under "For the user", keep going.

### 1.4 After every step
1. Checks: `npm run build`; `npx vitest run` (once it exists); `npm run test:rules` if rules or data shapes changed;
   for anything a person sees, a headless check (puppeteer-core in the scratchpad, state.md's notes).
2. Reviewer verdict `pass`.
3. Commit (own files), message `Agent S<n>: … (D-312)` + the co-author line.
4. Update Part 2: the step's line in "Done" (commit, what the reviewer checked, ideas), "Now", "Next".
5. Every ~3 steps: `npm run check:memory`; state.md's agent line updated (one line).

### 1.5 The night's steps (agent.md's phases, on a stub model; no web, no key)

| Step | What | Gate (on top of 1.4) |
|---|---|---|
| S1 | **Action inventory** `docs/specs/agent-actions.md`: every content action in the UI (the `+`, right-clicks, panels' fields, consoles/docks, drags, wizards, keys) → the data function it calls today → the op it will be | the reviewer greps views for handlers and finds none missing |
| S2 | vitest; `getWs()` outside React; pure helpers out of `views/` into `src/model/` with glyphs split (R8, R9, R12); the old paths re-export | app unchanged (headless smoke: open a workspace, focus a plane, a matrix, a deck) |
| S3 | `src/ops/` core: plan / validate (shapes from `bundle.ts` + references) / apply (one undo step, own keys) / `project` / `diff` | tests: apply of N plans = one undo step; `project` equals what apply writes |
| S4 | Cards, edges, evidence, competitor features, places → ops; rich `createCard`; awaitable; old functions as wrappers | tests per op: valid, invalid, cascade, undo |
| S5 | Text (labels, sections, stickies), packages | same |
| S6 | Pieces, canvases, spots: explicit `canvasId` (R1), cascades read the snapshot (R5), followers and stick as ops (R7) | same + headless: move a plane with stuck pieces |
| S7 | Matrix, table | same |
| S8 | Tasks, kanban, timeline | same |
| S9 | `arrange` (R10, 1.0's `arrange.ts` as reference) + UI facade `src/agent/ui.ts` (R11) | no overlaps on 5 layouts × 3 sizes; facade drives focus/select headless |
| S10 | Read layer (Phase 2): short ids, map, search, query, get, view per kind, neighbours | golden files on 3 fixtures; map ≤ 15k tokens on the biggest |
| S11 | Eval harness (Phase 3): fixtures, task files, runner on the emulator, graders, report; the first ~40 tasks | the runner runs all tasks with a **stub model**; graders tested on right and wrong end states |
| S12 | Model adapter (OpenAI Responses) + the loop, tested against a recorded/stub OpenAI; a **dev stub model** (`?agentStub=1` or a dev switch) that plays scripted answers and tool calls, so the UI can be driven and shown without a key | loop tests: tool errors returned, step budget, stop, parallel calls |
| S13 | Writes (Phase 5): the `change` tool, workflows (plan → run → preview → ask → report) | edit tests on the stub; one undo returns the exact state |
| S14 | **The UI** (Phase 6, the user changes it later): the bottom-right box → the column (app narrows), steps live, stop, `[undo]`, Settings → the agent (own key, model picker), empty state with first asks, the agent in presence | DESIGN.md + consistency.md tokens and Marks; dark/light; reduced motion; ASCII never over text; screenshots (1.6) |
| S15 | **The preview** (§4.5): store swap to `project`, diff marks on every kind in agent.md's table, change list with ticks, stepper gliding to each, app locked | one screenshot per kind (1.6); applied equals previewed |
| S16 | Memory (Phase 7): saved chats, agent notes document, change log; their rules in `firestore.rules` + rules tests (**not deployed**) | rules tests pass; screenshots of the new parts |
| S17 | Skills (Phase 9 without the web): the `/` commands of agent.md §4.10, each with ≥ 3 eval tasks on the stub | tasks pass on the stub; screenshots of each command's result |

If the night runs out, stop at a clean, committed step, with the shots gallery up to date. If it doesn't, go back to "Ideas" and do the small,
safe ones, each through the same review.

### 1.6 Screenshots of everything new (for the user to look at and change)
The UI is built tonight; the user will change it later. So every new visible part is shown, presentably:
- Headless Chrome (puppeteer-core in the scratchpad, state.md's notes), emulators, a seeded workspace with realistic
  content (a real-looking startup: customers, problems, competitors, a matrix, a deck), the agent driven by the stub
  model so chats, steps and previews look like real use.
- Each new part in **dark and light**, at 1568 × 980 (2× device scale), cropped to the part plus enough context to see
  where it sits; also one full-screen shot per flow (box → column → steps → preview → applied).
- Saved in `docs/specs/agent-shots/` as `S14-01-box-dark.png`…, plus `docs/specs/agent-shots/index.html`: a simple
  page (the app's tokens and fonts, no external links) with every shot under a heading per step, a one-line caption
  (what it is, what to look at, what's not final). The user opens it locally (`npx serve docs/specs/agent-shots` or
  the dev server); never published anywhere.
- Retaken when a later step changes a part; old ones replaced, not piled up.
- The reviewer looks at the shots too: text readable, nothing overlapping, tokens not raw colours, the light theme right.

---

## Part 2: the log

### Now
S15 next (the preview §4.5: store swap to the changeset's projected ws + diff marks on every kind, change list with ticks, stepper gliding to each, app locked; one shot per kind; applied = previewed). S1–S14 done.

### Done
_(one line per step: `S1 · <commit> · reviewer: … · ideas: …`)_
- S1 · see `git log --grep "Agent S1"` · docs/specs/agent-actions.md: 180 rows in 17 groups, 49 ops (one naming rule:
  `create_*`/`update_*`/`delete` + named exceptions; `deck` to the model), 22 gaps, who-may/tracked per group ·
  reviewer: 1 fix round (a missing join-request write, presence session, canvas text has no duplicate/paste, 4 line
  numbers), then pass; reran the exported-function grep and the ops-vs-rows diff · ideas: its "Notes for S3–S8".
- S2 · see `git log --grep "Agent S2"` · vitest (`npm test`, 13 tests), `src/state/wsStore.ts` (`getWs`, `subscribeWs`,
  a stack of stores), `src/model/` (cardFacts, cardInside, kanbanCards, planeFilter, kanbanFilter, goTo, findIndex,
  labelBox; old view paths re-export; goTo's glyph → a `mark`) · reviewer: pass (diffed every moved body vs HEAD, all
  exports kept, StrictMode and workspace switching, headless smoke: focus plane/matrix/deck, finder, a plane filter, no
  errors); then the registry became a stack · ideas: in Ideas (model still loads Firebase; actor; tests shallow).
- S3 · see `git log --grep "Agent S3"` · `src/model/` data-free (cards, edges, labels, pieces, canvases, tasks, shapes,
  clean (bundle's clean*), fromDocs (the listeners' doc → item steps); data/ re-exports) + a purity guard test;
  `src/ops/`: types (Write set/patch/del/merge, Plan, OpCtx), autoId, validate (shapes + refs + role; only what the
  plan brings in), project (on docs via fromDocs), diff, apply (one tracked() step, unique key, `absent` refs, batches
  at once); history.ts `onTracked` + `meta`/`absent` options · reviewer: 1 fix round (validate refused innocent
  patches on docs with old dangling refs: 27/67 in a seeded workspace; apply's before from the snapshot could make undo
  delete an existing doc), then pass: 0/66 and 0/30 refused, real ⌘Z restores a mixed apply, 31 UI-written docs of
  every kind validate · ideas: "S4 shape", S15 diff mapping.
- S4 · see `git log --grep "Agent S4"` · op builders + registry (14 ops: create_card rich, update_card, delete,
  duplicate, create_package, link/unlink/update_link, evidence, competitor features + `ours`, place_on/take_off),
  `buildBatch` with `$handles`; every write in data/{cards,edges,evidence,competitorFeatures,places} a same-signature
  wrapper (`applyUi`/`runUi`; keys, merges, labels, toasts kept); `src/model/placement.ts`; a UI-only overlay of
  recent writes (retired when the live store shows them, cleared on undo/redo, ≤ 3 s) + `freshWs()` for the agent and
  S15 · reviewer: 2 fix rounds (overlay stale after undo and hiding collaborators' writes; a delete failing whole when
  one id was gone; test gaps; refused UI writes rejecting into unhandled rejections), then pass with real-UI and
  collaborator repros · left: `dropCriterionScores` (S7), `planeGoes`/`runOps` (S6).
- S5 · see `git log --grep "Agent S5"` · `src/ops/text.ts`: create_text (5 kinds; where = x/y, near, in_section, clear
  spot; section `around`; canvas from args/ctx, R1), update_text (model schema without w/h/x/y), arrange (text, cards,
  places, pieces, spots; carries section contents (`sectionHolds`, src/model/textPlace.ts), folded parts and package
  members (`carriedWith`)), delete for text; data/labels.ts wrapped (addLabel, updateLabel, deleteLabel, moveMany) ·
  reviewer: 1 fix round (arrange didn't carry package members/parts; update_text and arrange both moved text), then
  pass with real-UI checks (section drag with a plane, turns, sticky fold/resize, box-select drag, ⌘D/⌘V, second
  canvas) · left: line-up/space-out layouts (S9), stuck pieces (S6), workspace name/description untracked.
- S6 · see `git log --grep "Agent S6"` · `src/ops/{pieces,delete,stick}.ts`, `src/model/pieceMoves.ts`
  (followerMoves/stuckChain from CanvasView's press): create_piece (`deck` → `kanban`, canvas required R1, stuck_to,
  setup), update_piece, rename (piece/canvas), resize (pieces + text widths, followers), arrange carries stuck pieces
  and `stick`, delete for pieces (cascade from the snapshot R5; cards also elsewhere re-home; D-313 scope) and canvases,
  create/move canvas, move_to_canvas, place_on/take_off for pieces; data/{pieces,canvases} wrapped, places.ts'
  planeGoes/runOps/commit gone · reviewer: pass first round (real UI: stick by drag, plane move with deck + matrix =
  one step, resize keeps followers on edges, plane delete re-homes a shared card, D-313 confirm, canvas delete, all
  undone by one ⌘Z) · left: `placeDocument` with sharing (documents aren't ops yet).
- S7 · see `git log --grep "Agent S7"` · `src/ops/{matrix,table,lens}.ts`, `src/model/{matrix,table,lens}.ts`: typed
  matrix/table setups on create_piece, update_matrix, update_table, axis_add/axis_remove/axis_update (matrix entries,
  table rows and columns), update_cell by names (ambiguous → candidates; merge writes), criteria removal cascades its
  cells and scores from the snapshot; every write in data/{matrix,table} + dropCriterionScores wrapped; whole-list
  editor writes go through `editorChange` (one add/edit/swap → the axis op, never a guessed removal);
  agent-actions.md moved to the merged names (46 ops) · reviewer: 2 fix rounds (a stale editor list deleted a
  collaborator's column and its cells: reproduced, fixed; axisFrom skipped asked-for cards; "1,234"; then a docs
  search-and-replace broke 5 drag rows, put back by the lead) · real UI: wizards, keys, notes merging, totals,
  setup edits, criteria, all one step each and undone exactly.
- S8 · see `git log --grep "Agent S8"` · `src/ops/{tasks,deck}.ts`: create_task (deck/column by id or name,
  before/after → orderBetween in the op, givenAt/givenBy as before), update_task (days move each other along like the
  panel), move_task (a list = one step), delete for tasks and deck columns (tasks to the column before), typed deck
  setup, update_deck with D-300 `tasks_to` (deck id or `new_deck`), deck column ops, update_timeline, create_evidence
  `from_task` (logLearned); every write in data/tasks.ts wrapped; `cleanTask` kept `start` now (export/import lost
  it) · reviewer: 3 fix rounds (assignee check refused former members' lanes; a stale column list lost a rename when a
  collaborator deleted a column, middle then last; a description) · real UI: deck, lanes, several tasks, limits,
  finished, side view, timeline edges/bars/tray/draw, switch to cards, all one step and undone.
- S9 · see `git log --grep "Agent S9"` · `src/model/layout.ts` + `src/ops/arrange.ts`: arrange layouts grid, row,
  column, cluster (by type/tag/status/groups, `headings` → `$heading1…`), align-*/spread-* (the panel's maths), where
  near/side, in_section (grows it, refuses if growing would cover others), at:'clear'; snapped, never overlapping what
  stays, unnamed sections solid; creates near one thing don't stack; apply records no step for empty plans.
  `src/agent/ui.ts` facade (goTo, focus, select, openPanel, showBeside, currentView; queued; no data writes) +
  `src/agent/driving.ts` `agentDriving()` for onboarding · reviewer: 1 fix round (in_section swallowing, blocks
  landing in unnamed sections, a lone package member, facade calls racing), then pass: adversarial overlap cases,
  back-to-back facade calls end in the last call's view, live cluster beside a section.
- S10 · see `git log --grep "Agent S10"` · `src/agent/read/` (pure): short ids (c p x t e v f d k m u; stable,
  never reused, saved/restored; resolve by id/name with candidates; people by name/email/me), the map (legend, Today,
  link kinds, comments line; summarised by level; big fixture ≈ 11.1k est. tokens at chars/3.0, budget 13.5k),
  tools search/query (JSON-schema filters, bad values refused with allowed lists, comments)/get/view (every kind)/
  neighbours/read_document/whats_new (cards' times now kept by toCards)/where_am_i; workspace text wrapped and
  defanged (NFKC, zero-width); 3 generated fixtures + golden files · reviewer: 1 fix round (names leaking a closing
  tag outside the wrapper, crashes on dangling refs, loose tool args, silent zero results, no comment listing), then
  pass: 20/20 "where is / what is" questions answerable from the map + ≤ 2 calls, 0 injection leaks over 9 variants.
- S11 · see `git log --grep "Agent S11"` · `evals/` (41 tasks: find 10, edit 8, build 8, context 6, refuse 4,
  injection 5; 25 regression, 16 capability; graded on the end state: onlyChanged, cites(only), grouped/under,
  noOverlaps, noWriteAttempts, answerExcludes, undoRestores per TURN, made(kind), judge stub; in-memory env with the
  real validate/project; plausible wrong script per task; report with cost/cached/reasoning, pass^k; `npm run eval`,
  `eval:quick`), `src/agent/contract.ts` (AgentModel/AgentEnv/Transcript, Responses-API ready), `src/agent/stubModel.ts`;
  op fixes: create_card lands clear of text/sections, create_package pushes members clear, findCol takes "cost (€)" ·
  reviewer: 1 fix round (graders passed plausible-wrong work: 15 loopholes, all closed but one narrow `asked()` case)
  · eval: 37/41 pass + 4 unjudged (no judge model yet), `--wrong` 0/41.
- S12 · see `git log --grep "Agent S12"` · `src/agent/openai.ts` (Responses API, SSE, output items replayed under
  store:false, strict only where the schema fits, parallel calls, cached/reasoning usage, retries, abort, key only in
  a closure and redacted), `loop.ts` (§4.3 context, reads at once/writes in order, errors back to the model, 25-step
  budget then a forced answer, stop checked between queued writes, history clearing + compaction hook, actor
  'agent'), `prompt.ts` (~2k tokens, §7.3 checks automated, "big job" plans first), `tools.ts` (typed op signatures,
  no coordinates), `models.ts`, `devStub.ts` (`?agentStub=1`, dev only), `usage.ts` (no text); evals on the real loop
  with followUps and an automatic "go" after a plan (off for refuse/injection/viewer) · reviewer: 2 fix rounds (the
  plan-first rule vs one-turn evals; `change` offered coordinates; a stop didn't stop queued writes; small prompt and
  adapter items; round 2 checked by the lead: tests, eval, lint, tsc) · eval 37/41 + 4 unjudged, `--wrong` 0/41.
- S13 · see `git log --grep "Agent S13"` · `src/agent/change.ts` (the real change tool: schema-strict, ids only in id
  fields, people resolved, deletes need why, ≤ 80 ops, viewer refused, result in names + new short ids + warnings + a
  view), `changeset.ts` (pending per chat: untick with dependants, drop to revise, reads see it, previewDiff for S15,
  accept = one step with a stale-check rebuild, names-only messages), `workflow.ts` (idle → running → asking |
  previewing → applying → applied | discarded; fail/reset unlock from any phase), `browser.ts` (apply as agent, turn
  and preview locks, releaseAgentLocks, undo of the agent's step); history.ts: a merge adds new docs to `before` in
  place and reads every held doc into `after` (exact undo/redo of merged agent turns; onboarding's contract kept);
  evals: real change tool, untick follow-ups, proposedIn/dryRunOnly, 5 new edit tasks, `--emulator` mode through the
  real apply + history undo + "applied = previewed" · reviewer: 1 fix round (redo lost a doc; `from` as canvas; no
  lock release paths; a stale accept stuck the person; untick follow-up silent) · eval 42/46 + 4 unjudged, `--wrong`
  0/46, same on the emulator.
- S14 · see `git log --grep "Agent S14"` · `src/agent/ui/` (Agent.tsx: the corner box (⌘J, `/`, Esc) → a resizable
  right column (`--ai-w`; the card panel sits left of it), numbered turns, live steps, cited links (goTo), tokens,
  plain errors, stop, scope line, a ledger change list with [apply ↵]/[discard esc], status lines with [undo];
  AgentGhost (the agent's marks, local only); AgentSettings (Settings → the agent: own key in this browser, masked,
  check, model, effort, usage, keys); agentStore (the driver: workflow effects, locks released in finally/unmount/
  workspace change); suggest (first asks)); viewer gets no change tool; screenshots: docs/specs/agent-shots/ (18
  parts × dark/light, index.html) · reviewer: 1 fix round (marks over names and on wrong targets, undo label,
  keyboard not handed back, Settings double selection, stub in usage, viewer raw text; design: Geist asks, numbered
  turns, ledger list, status lines), then pass (design B/B+).

### Stuck
_(none)_

### For the user (in the morning)
_(questions, choices made on their behalf, anything that needs a key or a design session)_
- decisions-log.md has another session's uncommitted edits, so the run doesn't add D-numbers to it; every step commits
  under D-312 and the phases' own D-numbers are left for a day session. D-312's own full entry is still uncommitted in
  decisions-log.md (written by the planning session, not this run); it needs committing by whoever owns it.
- Onboarding (D-315, its own lead later) will use this run's vitest, `getWs()` and S3's `onTracked`; it adds one-line
  hooks to history.ts, presence.ts, WorkspaceLayout.tsx after ours land (onboarding-run.md §1.2).
- Op names (agent-actions.md): the model sees `deck`, never `kanban` (D-301); workspace name/description and comments
  are untracked today (no undo), so they can't join a preview's single undo step until they are.
- S10 (chosen): no real workspace is exported for fixtures (never touch live data); the three fixtures are generated
  (small, medium, big ≈ 1500 cards). Token counts are an estimate (chars/3.6, no tokenizer dependency); check the
  15k-token map target with a real tokenizer once a key is in.
- S14, for the user: others can't see the agent yet (only you): showing it needs an `agent: {state, at}` field under
  your own presence node + a database.rules.json rule + a test. The `?` guide's key list lacks ⌘J and `/`
  (src/onboarding/keys.ts, the onboarding session's). The canvas re-centres when the column opens instead of keeping
  its left edge. On Windows/Linux Ctrl+J replaces the browser's Downloads shortcut. The agent's marks can land on the
  side nav when a plane runs under it.
- Chosen in S12 (easy to undo): big jobs still plan first and wait for "go" (agent.md §4.10); "big" = several
  pieces, more than ~10 changes, or open-ended; a clearly specified small change runs at once. Evals play a
  scripted "go" turn for those tasks. The OpenAI adapter replays earlier output items under `store: false` (nothing
  kept on OpenAI's side) instead of `previous_response_id`: check with a real key first. Model ids in models.ts
  (gpt-5.6-terra suggested, pre-selected only) are not verified against a real key.
- Chosen in S11 (easy to undo): making a package (the UI's `package these` too) now moves its members clear as one
  unit when the new frame would cover a neighbour, instead of overlapping. The eval runner has no Firestore-emulator
  mode yet (the real apply needs the browser app); it runs the same ops in memory. Build it before S13's gate.
- Chosen in S8 (easy to undo): the agent's `update_deck tasks_to: 'new_deck'` moves the TASKS to a new deck and the
  current one holds cards (the UI's "[make a new deck for cards]" does the reverse via create_piece); a task can be
  given to a member or to anyone a task is already given to.
- Chosen in S6: deleting a plane also removes its deleted cards' evidence, competitor features and comparisons (same as
  S4's card delete); an agent `arrange` of a section holding a plane also brings the plane's stuck pieces.
- Chosen in S4 (easy to undo): deleting a card now also removes its evidence, competitor features and comparisons
  (today's deleteCard left them as invisible orphans); matrix cells and tasks pointing at it stay (skipped, D-141).

### Ideas
_(the reviewers' and builders' "could be better", not done yet)_
- S15's store swap is also what onboarding's demos need (session workspace-sections-canvas, docs/specs/onboarding.md,
  "Needs from the store swap"): read it before S15 and build one seam for both.
- **S3 must add (promised to onboarding):** in history.ts `onTracked(fn: (label: string, meta?: { kind?: string; ids?:
  string[]; op?: string; actor?: 'person' | 'agent' }) => void): () => void`, fired after a write is recorded, for UI
  writes and ops alike; ops pass their op name, agent writes `actor: 'agent'`. Ops take the actor uid as an argument,
  never `auth.currentUser`; `useWorkspaceData` stays outside the store.
- **S3 should first (S2 reviewer):** `src/model/` still imports values from `data/cards|labels|pieces|tasks|edges|source`,
  which load Firebase and zustand (why vitest.config blanks the Firebase env). Move pure constants/helpers (`CARD`,
  `GRID`, `FOR`, `kindOf`, `kindOfPiece`, `isOnPlane`, `rowsOf`, `today`, `KIND_NAME`…) into data-free modules, and add
  a unit test that fails if `src/model` or `src/ops` import firebase/react/zustand/views.
- S3: `getWs()` carries no actor; ops need uid, role, `editLocked` (a `getMe()` or fields on the store's value).
- `store.set` runs during render, so `getWs()` can see a value React later drops: harmless for reads; ops must not act
  inside a subscribe callback fired mid-render.
- `subscribeWs` fires on any change; the agent's read layer may want a selector/diff form (S10).
- Tests are shallow: S3 should add a shared fixture workspace snapshot used by model, ops and read tests.
- S4 reviewer, later: registry summaries should say what ids look like once S10's short ids exist; `delete` grows to
  pieces and tasks (S6/S8); `logLearned` → `create_evidence` (S8).
- **S4 shape (S3 reviewer, done in S4):** ops as pure builders `(ctx: OpCtx, args) => Plan` with `$handles`; one
  `src/ops/registry.ts` (`{ name, args schema, build, kind }`) shared by the agent's tools, validate's op names and
  onboarding; op builders list in `Plan.ids` only ids they really create (else undo deletes it); delete ops cascade exactly like today's data/ functions (card → edges, places, evidence, competitor
  features, comparisons; deck → tasks; matrix → cells), ideally the data/ functions then call the same builders
  through `apply` (one code path); `create_task`/`move_task` run `orderBetween` inside; always pass `by` (no auth
  fallback).
- S15: `diff` must map places and spots back to their card or piece; the store swap via wsStore's `set` + `tell`.
- Existing, not the run's: `places.ts` `commit`/`runOps` awaits each 450-batch in turn, so inside `tracked()` a write
  of > 450 docs records "after" before later batches land (ops' `apply` sends all at once). The S3 builder thought
  `bundle.ts` `cleanTask` drops a task's `start` (D-304), so export/import may lose start dates: check in S8.
- S5 reviewer: TextItems' section drag should call `sectionHolds` (one code path, R7) once TextItems is quiet; when S9
  adds layouts, extend `arrange` with `layout` (`near`/`align-*`/`spread-*`/`grid`) + `where` (agent.md §4.4), not new
  ops; `moveMany` refused by validate resolves null, so a caller's `.catch(() => landed(...))` wouldn't run (can't
  happen today).
- **S7/S8 (S6 reviewer):** give the model per-kind setup templates or a typed schema per kind (matrix axes by type/plane,
  table rules, deck `holds` + source) instead of a free-form `setup`; `create_piece` with `stuck_to` should pick a free
  side; `stuck_to` should refuse a host on another canvas; expose `where.at`; `resize` summary: grows right and down.
- S7 reviewer: `oneChange`'s add compares ids only, so a collaborator's removal of Y while my stale list edits X and
  still holds Y brings Y back and drops my X edit (nothing deleted); checking the rest is `same` in the add branch
  closes it. Whole-list writes of rule edits / bring back can still lose a concurrent edit (as before S7).
- **S13 must (S8 reviewer):** the agent's `change` tool must strip or refuse args an op's schema doesn't declare
  (UI-only `moves`, `setup`, `parts`, `order`, exact `to` spots would skip the typed checks); keep UI-only args behind
  the wrappers. S10: expose members (name/email → uid) so assignees and mentions resolve, and fill `assigneeName`.
- Import could remap a task's `learned` to the new evidence id instead of dropping it (S8 keeps only `'skip'`).
- **S14 note (audit session north-star-f8, D-317):** presence peers are now filtered to workspace members and photos
  to googleusercontent.com (`usePresenceMembers`, `safePhoto`). The agent as a participant can't be a fake uid: show it
  as part of the person's own presence node (e.g. `agent: {at, sel, state}` under their uid, drawn as the agent's
  square/cursor for everyone) or draw it only locally; rules for that field + a test.
- **S12/S13 must:** every apply the agent makes passes `actor: 'agent'` (onboarding skips those steps); add a test that
  the change tool's apply records `meta.actor === 'agent'`.
- S9 reviewer, layout quality: a 40-item cluster on a normal plane becomes one column of 2-wide groups (~4000 px
  tall); let groups sit side by side past the plane's width or pack more columns per group. The facade has no guard
  for an open hazard confirm or (later) the preview lock: add one in S15. `window.__agentUi` registers only once
  something imports src/agent/ui.ts (S14 will).
- **CI (from session north-star-f8):** CI now runs `npm test`, check:lessons, `npm run lint` and build:functions before
  the Pages build; a failing tests/unit test stops the deploy. Every step must keep full `npm test` green and lint
  error-free. Commits up to 3bc7a9c (S1–S9) were pushed by that session at the user's request.
- S11 reviewer: 8/126 one-card packages still cut neighbours on p9 when the card is already in an unfolded package
  (moving it changes the old frame): refuse packaging a card already in an unfolded package, or move the old frame
  too. `asked()` should need a question word, not only "?". Decide whether unjudged regression tasks fail the run
  once a judge exists. The eval emulator mode is still to build before S13's gate.
- S12 reviewer: `reasoning.context` isn't sent (GPT-5.6 defaults to replaying all turns' reasoning: costs tokens);
  confirm with the docs + a key and send `current_turn` if right. The map and where-am-i are built once per turn: after
  its own writes the model must call get/view/where_am_i to see them.
- **S14 must (S13 reviewer):** the driver calls `releaseAgentLocks()` in a finally, on unmount and on workspace change
  (`history.reset` doesn't clear read-only locks); workflow `fail` from the preview should discard or knowingly keep
  `env.changes` (today it keeps them while the state says nothing is pending); the stale-accept text "there is no card
  something that is gone" → "that card is gone".
- S14 reviewer ideas (bigger, for the user's design session): hovering a citation lights that card on the canvas
  before the click; steps as a live trace decoding cell by cell, folding into `▸ 2 steps · 3.6s`; the scope line
  clickable (`SEES [whole workspace ▾]` → this plane / canvas); the closed box exactly the Finder's `>` prompt (D-222)
  so ask and find feel like one family, a blinking `>` caret while it works; the column's resize edge usable from the
  keyboard; wizards (centred on the whole screen) sit partly under an open column; the box doesn't close on a canvas
  click.
