# Evals

The agent's eval harness (S11, D-312; docs/specs/agent.md §6 Phase 3, §8). Built before the loop and the UI, so every
later step (S12's loop and model adapter, S13's `change` tool, prompt changes) is measured the same way.

```
npm run eval                      every task (41), the stub model playing each task's reference
npm run eval:quick                the regression set (must stay at 100 % on every change)
npm run eval -- --repeat 3        pass^3: every attempt must pass (catches flaky behaviour)
npm run eval -- --group build --set capability --task find-01-no-evidence,edit-02-validate-with-interview
npm run eval -- --wrong           the stub plays each task's plausible wrong script: every task should FAIL
npm run eval -- --write-fixtures  rewrite evals/fixtures/*.workspace.json (export v2) after the fixtures change
OPENAI_API_KEY=… npm run eval -- --model openai:gpt-5.6-terra   a real model (S12); the judge uses it too
```

`npm run eval` runs `evals/run.ts` in node through Vite's module runner (`evals/cli.mjs`); no extra dependency. The
report goes to `evals/results/<timestamp>/` (gitignored): `report.md` (summary table, then every task with each
grader's verdict and why), `report.json`, and `transcripts/<task>-<attempt>.json`.

## How a run works

1. **Fixture** (`fixtures/index.ts`): the read layer's seeded workspaces (`small`, `medium` = "Pazar",
   `medium-injected` = medium with five planted instructions, `medium-table` = medium with the Backlog table stuck to
   Roadmap so it opens beside it). In memory as an `AgentWs` (the store's snapshot plus members, comment messages,
   document text, me, now), **deep-frozen** (a tool or op that writes into a snapshot instead of projecting a copy
   throws); also written as export-v2 files for the emulator mode.
2. **Env** (`env.ts`): an `AgentEnv` (src/agent/contract.ts) over the snapshot. Writes are real ops: `apply` runs
   `validate` + `project`, the same code the browser's apply runs before it writes. **One turn = one undo step**
   (§7.2 point 2): every apply in a turn (the loop calls `env.newTurn`) joins one agent step, whose inverse is each
   touched doc as it was when the turn began. The UI facade records moves and keeps a view in step (`where_am_i`).
3. **Loop**: the agent's real loop since S12 (`src/agent/loop.ts`, see "Model adapter & loop" below). Only a stop
   `end` with no call is `answered`; `length`, a refusal, a content filter or the step budget end the turn otherwise
   (and fail the attempt); a call whose arguments didn't parse (`argsError`) goes back to the model; a model that throws
   fails that attempt, never the run.
4. **Tools** (`tools.ts`, re-exporting `src/agent/tools.ts` since S12): the read layer's tools as they are,
   `where_am_i`, a stand-in `change` (ops by name, each op's arguments and summary in its description; args checked
   against the op's JSON Schema in `src/agent/schema.ts` (types, enums, required, nested, unknown keys) with the errors
   returned to the model; short ids resolved only under argument names that hold ids (`ID_KEYS`), never inside a title
   or text), the UI tools. S13 replaces `change` with the real write tool; the runner doesn't change.
5. **Graders** (`graders.ts`) read the END STATE and the transcript, never what the model says it did.
6. **Report** (`report.ts`): per attempt a verdict `pass`, `fail` or `unjudged` (no grader failed but an LLM judge was
   skipped: never counted as a pass); pass@1, pass^k, unjudged, failed, steps, tokens in (cached) and out (reasoning),
   cost (`prices.ts`, by model; the stub costs 0), time; per set and per group; each attempt's changes in words; the
   transcript keeps the system prompt and a hash of the tool definitions. Regression tasks carry no judge.

## Tasks (`tasks/*.ts`)

A task is `{ id, group, set, fixture, ask, followUps?, view?, role?, graders, reference, wrong? }`. `followUps`: later
turns of the same chat (`['go']` after a big job's plan, agent.md §4.10); the reference script runs on across the turns;
graders read the end state after the last turn, and `noWritesInTurn(1)` checks the plan wrote nothing (build-01, build-03).

- `group`: find (10), edit (8), build (8), context (6, one with a table beside), refuse (4), injection (5), as agent.md §8.
- `set`: `regression` (100 % on every change) or `capability` (measured at phase gates).
- `view`: where the person is (focus, selection, panel, beside, side view), real ids (`realOf('medium', 'c58')`).
- `reference`: the stub model's scripted solution. It exists **only** to prove the graders and the runner: a task whose
  reference fails is a broken task (or an op bug). Short ids are the ones the fixture's map gives
  (tests/unit/golden/medium.map.md).
- `wrong`: a plausible wrong script, on every task: a partial set or a wrong item (find), the wrong card, column,
  person or direction, or an extra write (edit, build, context), the harmful thing (refuse, injection). `--wrong` runs
  them; every task must fail, so the graders test precision, not just that something happened.

A bug a person hits becomes a task here before it's fixed (agent.md §8).

## Graders

`exists` · `absent` · `count` (absolute or what the run added) · `made(kind, where, n)` and `MADE(kind, where)` (the
thing the run added, found by its kind, usable wherever a name goes: never the reference's names) · `field` (dotted
paths; values, RegExp, `{ has }`, functions) · `linked` (kind, direction) · `onlyChanged({ allow, add })` (every
changed, moved, removed or added doc expected: on every edit, build and context task) · `noWrites` · `noDeletes` ·
`noOverlaps(plane)` (only what the run made or moved; S9's boxes; also what lands far outside the plane) ·
`grouped(cards, by)` (one cluster per group, groups apart) · `under(heading, cards)` (below, close, aligned) ·
`onPlane` · `cell(matrix, row, col, value)` · `tableCell(table, row, col, value)` · `task(deck, title or id, { column,
assignee, due, priority, card })` · `cites(items, { only, also })` (each named by short id, any case, or its title as
whole words; every short id must exist; `only`: no other item of those kinds by id or title) · `answerIncludes`
(numbers whole, never inside a date or id, or their words; RegExps) / `answerExcludes` · `asked` (a real question
outside quotes, no writes) · `noWriteAttempts` (no write call at all, refused or not) · `toolNotCalled` / `toolCalled`
· `argsExclude` (a URL found in content never passed to any tool) · `undoRestores` (exactly one undo step for the turn,
the agent's, and its inverse played with `project` gives the start back: `diff` is empty) · `judge(rubric)` (an LLM
judge given the answer and what changed (`diffLines`); skipped, and the attempt `unjudged`, until a judge model is set
with `setJudge`, S12).

Tests: tests/unit/evalGraders.test.ts (every grader on a right and a wrong end state), tests/unit/evalRunner.test.ts
(the runner, the stub, the loop's endings, the tools and their schema checks, all references pass (judged ones
unjudged) and all wrong scripts fail); the loop itself: tests/unit/agentLoop.test.ts.

## The contract (src/agent/contract.ts, src/agent/stubModel.ts)

`AgentModel` (`respond`, optional `stream`), `ToolDef` (`strict`, `additionalProperties` kept), `ToolCall` (`rawArgs`,
`argsError`), `ToolResult`, `Usage` (`cached`, `reasoning`), `ModelMessage` (an assistant message carries the provider's
`providerItems` and `responseId` to replay reasoning items), stop reasons (`length`, `content_filter`, `refusal`…),
`AgentStep`, `AgentTurn` (`end`, `error`), `Transcript` (`system`, `toolsHash`), `AgentEnv` (`getWs`, `apply(plans,
{ actor: 'agent' })`, `actor`, `ids`, `ui`, `now`, `newId`, `newTurn`), `AgentTool`. The stub model plays a script and answers exactly as an adapter would; S12's dev stub
(`?agentStub=1`) uses it too.

## Model adapter & loop (S12)

- `src/agent/loop.ts` `runTurn(model, env, tools, history, ask, { stepBudget = 25, signal, onEvent, notes, transcript,
  compact })`: context per agent.md §4.3 (system prompt → map, byte-stable within a turn → agent notes (S16) → the chat
  so far → where the person is, last → the ask → this turn's steps); all calls of a step run in that step (reads at
  once, writes and UI moves in order); tool errors, unknown tools and unparsed args go back as results; results cut at
  ~8k tokens; the last allowed step is asked to answer with the tools listed but off (`toolChoice: 'none'`) and ends
  `budget`; a stop returns what's done (calls not run say so); old tool results become one-line notes past 6 + 4;
  compaction past ~60k estimated tokens keeps the last two turns whole (a model-written summary can come through
  `compact` later); every apply goes as `actor: 'agent'`; events for the UI with step labels (`reading "Pazar"…`).
- `src/agent/openai.ts`: the Responses API, streamed (SSE), replaying output items with `store: false` and encrypted
  reasoning (no `previous_response_id`: nothing kept on OpenAI's side, and the loop owns the context); strict only for
  tools whose schema already fits; `parallel_tool_calls: true`; reasoning effort from `src/agent/models.ts` (medium);
  401/429/5xx/network/abort handled, one retry for 429 (honouring retry-after, not when out of credit) and 5xx; the key
  only in a closure and the Authorization header, redacted from every error. Tested on recorded-style SSE fixtures
  (`tests/unit/fixtures/openai/`); never run against the network yet.
- `src/agent/prompt.ts`: the system prompt in short sections; `tests/unit/agentPrompt.test.ts` checks §7.3 mechanically.
- `--model openai:<name>`: the key ONLY from `OPENAI_API_KEY` at run time, never written (the report and transcripts
  carry the model's name only). `src/agent/models.ts` holds the price table (`prices.ts` re-exports it) and the picker
  data; every model is `not tried yet` until a run with a key marks it.
- `src/agent/devStub.ts`: a scripted model for the UI in dev (`?agentStub=1`), on the real tools; not in production.
- `src/agent/usage.ts`: the browser's usage log, counts and tool names only.

## Emulator mode (not built)

`--emulator` stops with an error. Why: the real `apply` (src/ops/firestore.ts) is the browser app's adapter. It records
the step in `history.ts` (zustand, toasts), takes the signed-in Firebase app from `src/data/firebase.ts` (Vite env,
`connectAuthEmulator` from the browser's sign-in), and `importWorkspace` creates the workspace through
`src/data/workspaces.ts` with the same app. Running that in node means a node Firebase app signed in to the auth
emulator as a test user and those modules loaded without their browser parts; doable, but it touches src/data/, which
this step may not change. The in-memory mode runs the very same op builders, `validate` and `project` (and S3's tests
check `project` equals what `apply` writes), so what it grades is what the browser would write. To add it later: seed
with the firebase client in node as state.md's "Seed script" note does (sign in as `test-alice`, write the bundle's docs
under a new workspace), give `makeEnv` an `apply` that writes the plans with a batch, and read the end state back with
the listeners' converters (`fromDocs`).
