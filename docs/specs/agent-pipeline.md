# The agent pipeline (D-341)

How the agent's work is split across models and measured, so it can be made cheaper and better step by step, and
later run on a server with a backoffice. Today it runs in the browser on the person's own key (D-312); everything here
is built so the same pipeline, records and experiments carry over when there is a server.

Status (2026-11-01): **foundation built** (roles, pipelines in the evals, run records, compare, replay). Routing in the
app, a reviewer and the backoffice are later stages (§7).

## 1. Why

The first measured runs (one run each, 116 tasks, 2026-11-01; per-task numbers from their report.json):

| model | passed | cost per task (mean / median / max) | input per step | from cache |
|---|---|---|---|---|
| gpt-5.4-mini | 73 % | $0.029 / $0.018 / $0.32 | 21k | 88 % |
| gpt-5.6-terra | 78 % | $0.067 / $0.044 / $0.50 | 21k | 85 % |
| claude-sonnet-5-5 | 75 % | $0.099 / $0.073 / $0.56 | 29k | 63 % |

- Questions, small edits, context, refusals and memory: the cheap model passes as many as the strong ones, at
  $0.008–0.013 a task. The gap is in big jobs (build, skills: 20–29 steps, up to $0.50).
- Claude read less from its cache (63 % vs 85–88 %): an engineering cost, not the model's. Fixed 2026-11-01: 94 % (§6).
- A heavy user (≈ 20 asks a day, a fifth of them big jobs) costs about $0.5 a day with routing; a hosted plan has to
  route and budget, not run the strongest model on everything.

## 2. Principles

1. **The harness carries the intelligence.** Tools that do the work (layouts, `structure`, `look`), checks in code
   (skill checks, change warnings, the plan-waits guard), clear guides. Every improvement there helps the cheap model
   most. The target: the cheap model as good as the strong one on everything but the hardest jobs.
2. **Code decides what code can know.** A turn's role comes from facts (a `/skill`, the job's state, a refusal),
   never from reading the person's words (D-333) and never from an extra model call.
3. **Code is the first judge.** A model judges only what code can't: an eval's rubric, a big job's last look.
4. **One record shape for every run.** An eval run, a replay and, later, a production job write the same record
   (§4), so the backoffice is a reader of records, not a new system.
5. **Measure before and after.** Every change runs against a baseline (§5); a prompt change on the tasks it touches,
   ×3; a model or pipeline change on the whole set.

## 3. Roles and pipelines (src/agent/pipeline.ts)

A **turn** has a **role**, read before it runs (`roleOf`):

| role | when | today |
|---|---|---|
| `chat` | any turn that is not part of a big job (questions, small edits) | built |
| `planner` | the turn that starts a plan skill (`/compare`, `/test`, `/restructure`…) | built |
| `executor` | a big job's turns once a `plan` is under way (planned, running or paused) | built |
| `reviewer` | one look at a finished big job (`look` + the job's checks), before the person accepts | named, not built |

A **pipeline** names a model for each role (`chat` required, the rest fall back to it) and, later, an effort per
role. One provider per pipeline: a chat's history carries one provider's items, and a model's own items (reasoning,
thinking blocks) go back only to that model (loop.ts drops another model's items, keeps its text and calls).

Pipelines to measure:

| name | chat | planner | executor | idea |
|---|---|---|---|---|
| `single` | M | M | M | today: one model |
| `routed` | cheap | strong | strong | the cheap model for everything small |
| `plan-strong` | cheap | strong | cheap | the strong model plans, the cheap one runs the steps |

A big job asked in plain words ("organise Bets") starts as `chat`; once the model calls `plan`, its next turns are the
executor's. That is the first thing to measure for `routed`: does the cheap model plan the jobs it should?

## 4. The run record (evals/records.ts)

Every eval run writes, beside its report:

- `report.json` gets a **manifest**: run id, time, git sha and whether the tree was dirty, the command, the pipeline,
  the model and judge, the system prompt's hash and the tools' hash (a prompt change shows even when the sha didn't
  move), task count, repeats, whether pictures could be drawn.
- and a **summary**: attempts, passes, cost, tokens in / cached / out, overall, by group, **by model** and **by role**
  (each turn records the model and role that ran it: `AgentTurn.model`, `.role`).
- one line in `evals/results/index.jsonl` (gitignored like the results): manifest + summary, the list a backoffice
  reads first.

Later, the app writes the same shape per job (model and role per turn, tokens, cost, the job's checks, accepted or
discarded), counts only, never message text (CLAUDE.md's hard rule on the usage log).

## 5. The experiment loop

```
baseline:   npm run eval -- --model openai:gpt-5.4-mini --repeat 3                    (≈ $10)
change:     code, prompt, guide or grader
free check: npm run eval  ·  npm run eval -- --wrong  ·  npm run eval -- --replay <baseline run>
targeted:   npm run eval -- --model … --repeat 3 --task <the tasks the change is for>     (cents)
full:       npm run eval -- --model … [--pipeline routed --strong openai:gpt-5.6-terra]
compare:    npm run eval -- --compare <run A> <run B>       (per group pass and $/attempt, every task that moved)
```

Rules: read every failure of a real run, not only the 0/3s (agent-bugs 33); a grader fix is checked with `--replay`
before money is spent; `fit` in models.ts is written only from ×3 runs.

## 6. Levers, measured one at a time

| lever | where | expected | status |
|---|---|---|---|
| Claude's cache at 85 %+ (breakpoints on tools + system and on a chat's first map, sent before its first ask; automatic for the tail) | anthropic.ts, loop.ts | Sonnet ≈ −35 % | **measured 2026-11-01**: 63.5 → 94.4 % from the cache, $0.156 → $0.058 an attempt (−63 %; Sonnet, 12 tasks, report 2026-11-01T17-51-08-095Z); every new chat reads tools + system + map (26.6k of 26.7k); the evals record Claude's cache diagnostics (no divergence seen) |
| a leaner `change` (args only for the 16 ops that make 97 % of all ops; a rare op's come back in its refusal), with the fixes of agent-bugs 35–41 | tools.ts, loop.ts, change.ts | ≈ −0.9k tokens a request | **measured 2026-11-02, kept** (mini ×3, judge terra): 265 → 268 of 348 passed, $10.11 → $9.42 (−7 %); both runs re-graded on today's graders 302 vs 300 (even); build 50 → 67 %, skills 68 → 72 %; edit-12 (a dry run asked for) 3/3 → 0/3, the one real loss (reports 2026-11-01T20-24-14-991Z, 2026-11-01T23-22-53-835Z) |
| routing (`routed`: mini, terra for planner and executor) | pipeline + app | small asks at the cheap model's price | **half measured 2026-11-02** (×1): the run's OpenAI credit ran out at skill-dedupe, 41 turns errored; on the 75 clean tasks routed 65/75 vs single 60.7/75 (mean of 3), $2.47 vs $1.80 (+37 %). Not enough to choose: the skills left are the hard ones (report 2026-11-02T03-04-23-709Z) |
| effort per role (low for chat) | pipeline `effort` | the cheap model's output tokens (46 % of its cost) | named |
| plan-strong / cheap executor | pipeline | big jobs ≈ −60 %, quality to measure | evals ready, not run (credit) |
| a smaller map (`--map-budget`: 7000 sums up planes over 20 cards, 3000 every plane; today 13.5k) | loop / read | medium map 22k → 10k / 5k chars; more reads per ask | **half measured 2026-11-02** (mini ×3; find, context, edit, refuse, injection, memory: 43 tasks): graders full 121, 7000 121, 3000 123 of 129; with the judge 112 / 115 / 122; input an attempt 48.1k / 42.5k / 38.7k (−20 %), cost $1.06 / $1.00 / $0.94. Default unchanged until build and skills (where the map matters most) run at 3000 |
| fewer steps in big jobs (tools that do more per call) | ops, tools | the 20–29-step jobs | ongoing |
| reviewer (one look at a big job's end) | loop + job | catches what checks can't, for one call | later |

## 7. Stages

- **P0, foundation (built 2026-11-01):** roles, pipelines and `--pipeline`/`--strong` in the evals, run records and the
  index, `--compare`, `--replay`, per-model and per-role cost.
- **P1, the cheap baseline:** mini ×3 as the main baseline; Claude's cache; the open model bugs measured on it.
  *Done 2026-11-02:* baseline 265/348 (76 %, $10.11, before the fixes) and 268/348 (77 %, $9.42, after); every failed
  attempt read and sorted (model, eval or code): code fixed in agent-bugs 40–41, eval fixes in learn-01, pitch-02,
  find-06, dedupe-03 (each checked with `--replay` and `--wrong`).
- **Left for when credit is back (≈ $16):** routed on skills (`--pipeline routed --strong openai:gpt-5.6-terra --group
  skills`), plan-strong (`--pipeline plan-strong`, whole suite), terra single (whole suite), and build + skills at
  `--map-budget 3000` (×3); then `--compare` each against 2026-11-01T23-22-53-835Z and decide routing and the map's
  default here and in D-341. All with `--judge openai:gpt-5.6-terra`.
- **P2, routing in the evals:** `routed` and `plan-strong` against `single`, both providers; pick by pass and cost.
- **P3, routing in the app:** the chosen pipeline from the person's models (Settings: a cheap and a strong model), the
  cost of each job shown, a budget per chat; the reviewer if P2 shows it pays.
- **P4, server (needs Blaze):** the workspace key (D-079) and jobs run by Cloud Functions: the same loop, tools and
  pipeline on the server, writing the same records to Firestore.
- **P5, backoffice:** reads the records: runs over time, by pipeline, model, role and task; a failing task's
  transcript; re-run a run's tasks on a new commit; production jobs beside eval runs.
