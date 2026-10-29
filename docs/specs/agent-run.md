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
Not started. First step: S1.

### Done
_(one line per step: `S1 · <commit> · reviewer: … · ideas: …`)_

### Stuck
_(none)_

### For the user (in the morning)
_(questions, choices made on their behalf, anything that needs a key or a design session)_

### Ideas
_(the reviewers' and builders' "could be better", not done yet)_
