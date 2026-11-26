# The agent on the server, three kinds of key, limits, audit and a backoffice

Status (2026-11-25): **decided (D-434), P0 begun (§15).** The user asked for one agent that works in the backend, paid in one of
three ways: the lab's key (about €3 a person a month, then it stops until the next month), a workspace's key (its
owners may limit it in total and per person), or a person's own key (they spend what they like); a very good audit log;
a backoffice for the lab's key. The choices are in §2. Facts checked on 2026-11-25 are in §14.

## 1. What it is, in short

- **One loop, on the server, whoever pays.** `src/agent/loop.ts` is already pure: the evals run it in Node today. A run
  goes on with the tab closed, for all three kinds of key. The tab keeps only the scripted dev stub and the demos.
- **The server agent reads and proposes; it never writes content.** A run ends in pending changes. The person accepts
  them in their tab, as themselves, under `firestore.rules`, in one undo step, as today. Nothing about previews, undo
  or permissions changes.
- **No raw proxy.** A browser sends what the person wrote, never a prompt, a tool list or a model request. That is what
  makes a free key possible: nobody can use it as a general API.
- **Money is reserved before a call and settled after it**, in a transaction, per person and in total, on the lab's and
  the workspace's key. OpenAI's own hard limit on the lab's project is the outer wall.
- **Every call leaves an audit entry, opened before the call is made.** Counts and money, never text.

## 2. The choices (all settled as recommended, D-434)

| # | Choice | Recommendation | Why |
|---|---|---|---|
| 2 | Which key pays when several could | The person picks, per chat (`paid by`); to start: own → workspace → lab. **Never switched silently**: at a limit the app offers the others | A fall from a free key to one's own would spend a person's money unasked |
| 3 | Who gets the lab's key | Any signed-in person, but opened in two steps: an invited list first, then everyone; a switch turns it off at once | Sign-in is open, so cost grows with sign-ups; §9's caps hold it |
| 4 | The numbers | €3 a person a month, €100 a month in total to start, both edited in the backoffice. OpenAI's hard limit a little above the total | The total is the real risk, not the €3 |
| 5 | Does the app stay locked for the person while the server agent works? | No | The lock exists so undo steps don't mix. A server run writes nothing, and accept already rebuilds on the live workspace and says what no longer fits |
| 6 | May the audit log hold what people wrote? | Never: counts, models, money, who, when, outcome | Today's rule (D-079). A support case is answered from the person's own shared chat |

Settled by the user (2026-11-25), was choice 1 among them: everything on the server; three ways to pay; own keys without
a limit of ours; a workspace key limited in total and per person if its owners want; **an own key is kept where the
person says, in this browser or in their account** (§6.2).

Also proposed, smaller: viewers may use the lab's key (their agent only reads; the limit is the person's, not the
workspace's) while D-318 keeps them off the workspace key; Claude on people's own keys moves to the server too (it works
today, so it can't be lost), on the lab's and workspace's keys later.

## 3. Where things stand today

| Part | Today | Reusable? |
|---|---|---|
| Loop, tools, changeset, job, skills (`src/agent/`) | pure, no React or Firebase, run in Node by the evals | yes; `ui.ts`, `browser.ts`, `preview.ts` and `ui/` stay in the browser |
| Workspace snapshot (`model/fromDocs.ts`) | pure | yes: the server feeds it the same collections |
| Plans and changes (`ops/types.ts`) | plain data (`DELETE` is a plain object) | yes: can be stored and sent |
| `look`'s picture | browser canvas; resvg in the evals | yes, resvg, with the Inter TTFs |
| Accept (`browserApply`, `acceptChanges`) | tab, rules, one undo step, rebuilt on the live workspace | unchanged |
| Chats saved (`agentChats`) | text of turns, not the model's history | the history gets its own private, short-lived store |
| A person's own key (D-312, D-329) | browser storage, the tab calls OpenAI or Anthropic itself | stays in browser storage; the calls move (§6.2) |
| Workspace key (D-427) | the tab loops, each request through the `ai` function | `ai` is replaced (§5.6): a member can send it any instructions today |
| Usage (`aiUsage`) | one entry after a call; a crash loses it; no limits; no page | replaced by §8–§9's ledger |
| Prices (`models.ts`) | three OpenAI models, no cache-write price | must be refreshed first (§9.5) |

## 4. The whole, drawn

```
 tab                                   Firebase / Cloud Run (EU)                              OpenAI
 ───                                   ─────────────────────────                              ──────
 message ──startRun (callable)──▶ checks: signed in, App Check, member, key route,
                                  limits, one run a chat ──▶ agentRuns/{id} (queued)
                                                             │ Cloud Tasks
                                                             ▼
                                  runAgent (task function): leases the run
                                   ├ reads the workspace AS THE PERSON (rules)
                                   ├ loop.ts ─ each model call: reserve ▸ call ▸ settle ─────▶ Responses API
                                   │                          └ aiCalls/{id} opened, closed     (store: false)
                                   ├ after every step: checkpoint
                                   └ text and steps ──▶ RTDB agentLive/{uid}/{run} ──▶ tab (any tab, after a reload too)
 stop / steer / view ──▶ RTDB agentCtl/{uid}/{run} ──▶ the worker
                                  end: changes stored, chat saved, run `waiting` or `done`
 preview ◀── changes ─────────────┘
 accept (in the tab, rules, one undo step) ──runOutcome──▶ the next step of a job, or the end
```

## 5. The run on the server

### 5.1 Functions
| Function | Kind | Does |
|---|---|---|
| `startRun` | callable, App Check | `{ wid, chatId, text, view, paidBy, model?, effort?, key? }` (`key` only for an own key kept in the browser): checks, makes the run, queues it, answers with its id |
| `runAgent` | task queue, ≤ 1800 s | runs one turn (or goes on from a checkpoint) |
| `runOutcome` | callable | what the person did with the preview (applied, discarded, undone, which items off); the job's next move |
| `closeStale` | every 5 min | runs and calls whose worker died: settled, ended or queued again |
| `setLab`, `setPerson` | callable, lab admin | the backoffice's writes (§10) |
| `setOwnKey` | callable | a person's own key kept in their account: saved, checked, removed |
| `setWorkspaceKey`, `setWorkspaceAi` | callable, owner | the workspace's key and its settings, each change audited |
| `reconcile` | daily | our ledger against OpenAI's Costs (§8.5) |

`runAgent`: europe-west1, 1 vCPU, 1 GiB, concurrency 8, at most 10 instances at first, 3 attempts, dispatch deadline
1800 s (Cloud Tasks' own default is shorter). A turn near 25 min checkpoints and queues its own continuation, so a job's
length isn't bound to one task. Task payload: the run's id only, never text, never a key.

Why a queue and not the callable itself: work after a response loses its CPU under request-based billing, and a closed
tab must not end a run. Why not OpenAI's background mode: it stores response data even with `store: false`. Why not a
workflow product (Temporal and the like): one more service and bill; our loop has one kind of side effect, the model
call, and it's covered by §9's reservation.

### 5.2 A run's life
`queued → running → waiting (a preview is open) → done | stopped | failed | limit`. `agentRuns/{runId}` holds who, which
workspace and chat, key source, model, times, counters, status: no text. Beside it, server-only, in Storage with a
7-day lifecycle: the input, the model's history (with its encrypted reasoning), short ids, changes, the job.

- **Lease:** the worker takes the run in a transaction (`lease`, 60 s, renewed). Cloud Tasks can deliver twice; the
  second one finds the lease and leaves.
- **Checkpoint** after each step. A retry goes on from the last one. The call that was in flight when the worker died
  is charged (§9.3) and made again.
- **One run a chat, at most 3 a person** at once, plus a limit on starts a minute.
- **In `loop.ts`:** `onStep`, before each model call, with the turn's whole state (`TurnState`, plain data; what the
  person wrote meanwhile is already in it), and `resume` from one. What `onStep` throws ends the turn. A turn cut before
  every step and resumed from JSON sends the same requests and gives the same turn as one never cut
  (tests/unit/agentResume.test.ts, every eval task).

### 5.3 Reading as the person
The worker reads with the client SDK, its own app instance a run, signed in with a custom token of the person (the
session renews itself past an hour), so **the rules stay the one truth**: private documents, roles. It keeps listeners
for the turn, so it sees edits made meanwhile. A listener already open when its person is removed isn't told (§15), so
**membership and role are read directly, admin SDK, before each step and before the changes are handed over**; a no ends
the run and closes its listeners. The fallback, if custom tokens can't be signed on the real project, is the admin SDK
behind one read module that passes the same cases as `tests/rules.test.mjs`. The token never leaves the worker. Content writes from the server: none. Server writes are only run, ledger and chat records.

### 5.4 Talking to the tab
- **Down:** RTDB `agentLive/{uid}/{runId}`: status, steps, text (batched about every 150 ms), usage, with a sequence
  number; rules: only that `uid` reads, nobody writes. A reload, or another tab, reads the state so far and goes on.
  Deleted 10 minutes after the end; the saved chat is the record.
- **Up:** `agentCtl/{uid}/{runId}`: `stop`, `steer` messages (≤ the message's own limit), `view` (what's in focus and
  selected). Only that person writes; only the worker reads.
- **Moves of the view** (`go_to`, `focus`, `select`, `open_panel`, `show_beside`): sent down as requests; the tab that
  shows the chat does them and answers. No tab: the tool says the person isn't here and nothing moved.
- **Preview:** the stored changes open as today (`openPreview`). Unticked items go back as ids, never as a changed
  changeset; the server works its own out again. Closed tab: the preview waits; the chat list, the orb and a toast say
  `1 to review`.
- **Jobs:** one preview at the end: the job goes on with no tab open. One per step: it waits for the person.
- **Auto-apply** stays in the tab (it writes); a server run proposes only.

### 5.5 In the app
- `agentStore.ts` gets one seam: `TurnHost`, today's `turn()` as `tabHost` and the new `serverHost` (start, follow,
  control). The column, preview, workflow and checklist stay the same components. `tabHost` stays for the dev stub and,
  until P6, as the way back.
- The turn's lock goes (choice 5); the preview's lock stays.
- Under the prompt, one quiet line says who pays, and picks: `paid by North Star · €1.20 of €3.00 left`,
  `paid by Acme's key · €4 of €10 left`, `paid by your OpenAI key`.
- The model picker lists only what the paying key may run (D-427's *Not yet*, closed here).
- With `own` picked and no key here nor in the account, the app asks for it; it never falls to another key.
- A run going on elsewhere: the orb's working mood, its line in the chats list; reopening shows it live.

### 5.6 The old proxy
`ai` takes any instructions from any member the owners allow. It stays while old tabs may be open (two weeks), under
§9's limits, then it's deleted. The lab's key is never reachable through it.

### 5.7 Building it
`functions/` is built by the repo's own Vite (an SSR build, `functions/build.mjs`; types first) so it can import
`src/agent`, `src/ops`, `src/model`; packages stay outside. `tests/unit/serverAgent.test.ts` holds what the worker's
code may reach (no React, no store, no page) and that its packages are listed. Cold start matters: the main file holds
only the light functions (30 KB), the agent is a chunk loaded when a run starts (≈ 630 KB), resvg only for `look`.

## 6. Keys

### 6.1 Three ways to pay

| | Lab | Workspace | Own |
|---|---|---|---|
| Who gives it | a lab admin, in the backoffice | an owner | the person |
| Where it lives | `aiSecrets/_lab`, encrypted (an id no workspace can have) | `aiSecrets/{wid}`, encrypted | the person picks: that browser (on the server only while a run needs it), or their account, encrypted |
| Who may use it | signed-in people not blocked, members of the workspace | owners, editors allowed; never viewers (D-318) | them |
| Limit | per person a month, and a total | per person a month and a total a month, each optional, set by owners | none of ours |
| Models | the admin's ticks, priced ones only | the owners' ticks, priced ones only | what the key can |
| Seen by | lab admins: all; a person: their own | owners: all; a person: their own | that person only |
| Providers | OpenAI, Claude later | OpenAI, Claude later | OpenAI and Claude |

### 6.2 A person's own key: they say where it's kept
Asked when a key is saved, for each key (OpenAI's, Claude's) on its own; `this browser` first in the row and picked to
start, since it's what people have today.

| | `this browser` | `my account` |
|---|---|---|
| Kept | this browser's storage | `aiSecrets/user_{uid}_{provider}`, sealed (KMS) |
| On the server | sent with each message, for that run only, then deleted | always, until removed |
| A started run goes on with the tab closed | yes | yes |
| On other devices | enter it again there | yes |
| Runs with nobody there (scheduled, later) | no | yes |
| Shown again | `sk-…abcd` | `sk-…abcd`, never the key, not even to its owner |
| Words under it | `Sent with each message and deleted when the answer is done.` | `Kept encrypted on North Star's server. Works on all your devices.` |

- **`this browser`:** `startRun` (and a job's next step, and an answer to a preview that starts a turn) carries it over
  TLS; sealed at once into `aiSecrets/run_{id}`, opened only in the worker's memory, **deleted when the run ends**,
  however it ends. A preview or a step waiting for the person holds no key. `closeStale` takes any older than 2 hours
  and mails us if it found one; a TTL policy is behind that. A retry reads it again; once it's gone, the run ends.
- **`my account`:** `setOwnKey` (callable) checks it with the provider, seals and keeps it; a fresh sign-in (under an
  hour) to save or replace; `remove` deletes it, so does deleting the account. Set, replaced and removed are audit
  entries the person sees. Saving it there takes it out of this browser.
- **Moving:** browser → account is one press. Account → browser: the key is entered again, since it's never sent back.
- **Both:** never in a task, a log, an error, a checkpoint, the ledger or a chat; errors are scrubbed as today. If both
  exist, this browser's goes first on this browser.
- `[check]`: from the browser for a key kept there; through the server for one in the account.
- **People with a key saved today:** it stays `this browser`. Nothing is sent before they agree: the first run after the
  change says once that the agent works on North Star's server now, and asks which of the two.
- Advice beside the field: a key of a project of its own with the provider's hard spend limit. It's what bounds a leak.
- **The open risk:** read strictly, OpenAI's terms don't allow passing a key to any app's server, for a moment or kept;
  kept is the worse reading, and a store of unlimited keys is worth stealing. P0 asks OpenAI and Anthropic in writing
  about both and **the workspace key** (already kept by us, D-427). A no to keeping drops `my account`; a no to both
  sends own-key chats back to the tab (`tabHost` is why that stays easy), and the workspace key is decided again.

### 6.3 The keys we keep

- **At rest:** sealed with Cloud KMS (envelope: each secret its own data key), replacing `AI_KEY_SECRET` (a script
  re-encrypts the workspace keys once). KMS logs each opening and rotates; about $0.06 a key version a month and $0.03
  per 10,000 openings. Only `runAgent` and the key setters may open.
- **Replacing** the lab key checks it with OpenAI first, needs a sign-in less than an hour old, and is audited; the old
  ciphertext is overwritten. Runs already going finish on the key they started with.
- **The OpenAI side:** a project of its own (`north-star`), a service-account key restricted to the Responses API, the
  hard spend limit on that project, spend alerts below it, only the ticked models allowed there.
- **Per person at OpenAI:** `safety_identifier` = HMAC of the uid. OpenAI blocks one abuser instead of the key.
- **Prompt cache:** `prompt_cache_key` stays per workspace, so people of different workspaces never share one.
- CLAUDE.md's hard rule changes when this is built, not before: an own key is kept where its person said (their browser,
  going to our server only with a run and deleted at its end; or sealed in `aiSecrets/`, as the workspace's and the
  lab's). Still never logged, never returned to any browser.

## 7. Data

| Path | Holds | Written by | Read by |
|---|---|---|---|
| `lab/public` | on, models, € a person, when it resets | server | signed in |
| `lab/private` | key hint, total limit, rate, thresholds, invited list on or off | server | lab admins |
| `admins/{uid}` | who is a lab admin | the Firebase console only | that person |
| `labPeople/{uid}` | blocked, own limit, invited | server | that person, lab admins |
| `aiMeters/lab_{uid}_{YYYY-MM}`, `…/ws_{wid}_{uid}_{YYYY-MM}`, `…/own_{uid}_{YYYY-MM}` | spent, reserved, calls, tokens, refusals | server | that person; lab admins (lab); owners (workspace) |
| `aiMeters/lab_total_{YYYY-MM}`, `…/ws_{wid}_total_{YYYY-MM}` | spent, reserved, by day, by model | server | lab admins; that workspace's owners |
| `aiSecrets/run_{id}` | an own key kept in a browser, sealed, for one run's life | server | nobody |
| `aiSecrets/user_{uid}_{provider}` | an own key kept in the account, sealed | server | nobody |
| `users/{uid}/ai/keys` | which keys the account holds: `sk-…abcd`, since when | server | that person |
| `aiCalls/{id}` | one model call (§8.1) | server | as the meter |
| `agentRuns/{id}` | one run (§5.2), no text | server | that person, lab admins (lab runs), owners (workspace runs) |
| `audit/{id}` | one administrative act (§8.2) | server | lab admins; owners for their workspace |
| Storage `agentRuns/{id}/…` | input, history, changes; 7 days | server | nobody; changes through a callable |

All money is whole **micro-dollars** (OpenAI bills in dollars); limits are set in euros and turned into dollars with
the month's fixed rate (the ECB's on the 1st, shown and editable), so a limit never moves during a month. Months are
UTC. No client writes any of these; the rules tests say so for each.

## 8. The audit log

### 8.1 Each call: `aiCalls/{id}`
Opened **before** the provider is called, closed after: `at`, `uid`, `wid`, `runId`, step, `source`
(lab, workspace, own), provider, model, effort, tokens (uncached, cached, cache write, output, reasoning), searches,
`reserved`, `cost`, `priceVersion`, `status` (`open`, `done`, `stopped`, `failed`, `unknown`), `estimated`, `ms`,
OpenAI's response and request ids, the function's version. Never text, tool arguments, names of cards, IPs or keys:
the entry is built field by field from a fixed shape and a test refuses any other field.

A refused start is counted on the meter by reason (`limit`, `total`, `blocked`, `off`, `model`, `rate`); the first of a
kind a person gets in a month also becomes an `audit` entry. (Writing one for each would let anyone fill the log.)

### 8.2 Each administrative act: `audit/{id}`
Key set, replaced or removed; on or off; models; limits; rate; a person blocked, freed, invited or given their own
limit; a workspace's key, access, models, total and per-person limits (so `ai/config` becomes server-written); an admin opening a
person's page; an export; an admin doc found changed. `by`, `at`, `what`, `from → to` (a key only as `sk-…abcd`),
`reason` (asked for when blocking or raising a limit). The act and its entry are **one transaction**: neither without
the other.

### 8.3 It can't be changed quietly
Rules: no client writes, edits or deletes, admins included. Each entry is also one structured line in Cloud Logging,
routed to its own bucket with 400 days' retention, locked once we're sure (locking can't be undone). Audit entries
carry a number in sequence and the hash of the one before; the daily check walks the chain and compares it with the
log bucket. It shows tampering; it doesn't stop a project owner (that's us), and the plan doesn't pretend it does.

### 8.4 Who sees what, how long
A person: their own calls and what's left, in Settings → the agent. Owners: their workspace's, by person and model.
Lab admins: the lab key's only; **never** a workspace's or an own key's calls, or any chat; for those only how many runs
went, failed and how long, without names. Calls and runs 13 months, then only the
monthly sums; `audit` 24 months. Deleting an account takes the name off and leaves a salted hash, so sums and the
invoice still agree (the privacy page says so).

### 8.5 Agreeing with the invoice
Daily: OpenAI's `/v1/organization/costs` by project against our settled sum for that day. More than 5 % and $1 apart:
a mail, and a mark in the backoffice. It needs an OpenAI admin key, a Secret Manager secret only `reconcile` reads.

## 9. Limits that hold

### 9.1 Before a call
For the lab's and the workspace's key (an own key has no limit: its calls are only recorded), in one transaction on the
person's meter and the total: not blocked, the key on, `spent + reserved + worst case ≤
limit` for both. Worst case = estimated input at the cache-write price + the output cap at the output price + searches.
The output cap is 32k tokens, cut down to what's left; under 1.5k left, the call isn't made.

### 9.2 After it
Settled from OpenAI's own `usage` with the price version; the rest of the reservation goes back.

### 9.3 When the number never comes
Stopped, crashed or cut: charged what we know (input estimate; output by what streamed and by time, capped by the
reservation), marked `estimated`. Otherwise stopping just before the end would be free use. `closeStale` closes calls
left open past 35 minutes the same way.

### 9.4 What the person meets
At 80 %: one quiet line. At the limit, mid-run: the run ends cleanly as `limit` after the step under way, keeps its
pending changes for review, and says when it resets and the other ways to pay it could go on with. A new message
says the same before starting. `/research` and jobs estimate first and say when the month likely won't cover them.

### 9.5 Prices
One price table with a version, in `src/agent/models.ts`, copied to the functions by a build step and held equal by a
test: input, cached, **cache write (1.25× input on GPT-5.6 and later, which we don't count today)**, output, search
($10 per 1,000). Requests over 200k tokens are refused (past 272k the price doubles). A model without a price can't be
ticked. A monthly check compares the table with OpenAI's page and mails on a difference.

### 9.6 What €3 buys
€3 ≈ $3.29 (ECB 1.0963, 24 Nov). The eval suite's mean task on gpt-5.4-mini (348 attempts, 2 Nov): 10.0k uncached +
86.7k cached input + 2.9k output. The same tokens at today's prices:

| Model | A mean task | Tasks for €3 |
|---|---|---|
| gpt-6-luna | $0.004 | ~ 900 |
| gpt-5.4-mini | $0.027 | ~ 120 |
| gpt-6.1-terra | $0.031 | ~ 105 |
| gpt-6.1-sol, gpt-6.2-sol | $0.063 | ~ 50 |
| gpt-5.6-terra (today's suggested) | $0.077 | ~ 43 |

Only mini is measured; the others assume the same tokens, and a stronger model may use more or fewer. The GPT-6 models
have never run our evals: P0 runs them (≈ $25 in all) before a default is chosen. Guess to check: gpt-6.1-terra.

### 9.7 What it costs us
Upper bound: people × €3, capped by the total. 100 people using all of it: €300 a month; 1,000: €3,000. Tokens only:
whether VAT comes on top is checked on the first invoice. Cloud cost of a 60 s turn: well under a tenth of a cent of
CPU beside 3–8 cents of tokens; one warm worker, if the first answer is too slow without it, about $13 a month.

### 9.8 Abuse
- Many Google accounts: the total cap, the invited list first, App Check, starts per minute, an alert on a burst of new
  accounts. Deleting and coming back: a salted hash of the email keeps that month's spend and a block until month end.
- Using it as a free model: no raw proxy, the app's own prompt and tools; a run needs a workspace the person is in.
- Injection from a card or a web page: the run writes nothing, reads one workspace, has no other way out than the
  provider (agent.md §7.2); the person accepts each change.
- Spending a colleague's limit: the meter is the caller's own, from their token.

## 10. The backoffice

`/backoffice` in the app, its own chunk, linked only for a lab admin; anyone else gets the not-found page. Admin = a
doc in `admins/{uid}`, made by hand in the Firebase console (nothing in the app can make one; the public repo names
nobody). Each write asks for a sign-in less than an hour old, and the functions check all of it again. Built from the
kit, laid out as Settings (D-404), both themes, its gallery beside it.

| Page | Shows | Does |
|---|---|---|
| Overview | this month: spent of the total, reserved now, people, runs, errors, spend by day and by model, forecast to month end, OpenAI's own figure beside ours | **turn the key off** (one press and a confirm) |
| People | one row each: spent of their limit, runs, last used, blocked; search, sort | block, invite, own limit (with a reason); their calls |
| Runs | by status, length, model, cost; failed and stuck ones first | stop a run |
| Calls | the ledger, filtered by person, model, source, status, day | CSV |
| Key and limits | `sk-…abcd`, set when and by whom; models; € a person; total; rate; thresholds | replace, remove, change |
| Audit | every administrative act, the chain's state | CSV |
| Health | queue length, failures by reason, reconciliation, price check, versions | |

Mails to the lab (Resend, as D-431): 50, 80, 100 % of the total, reconciliation off, error rate over 5 % in an hour,
key refused by OpenAI, a key or admin change. Agent-pipeline.md's P5 (runs over time by model and role, a failing
eval's transcript) lands on the same Runs page later: the run record has its manifest's fields from the start.

**Owners** get the same in small, in Settings → workspace → agent key: this month by person and model, a total and a
limit per person, who changed what. **Everyone** gets, in Settings → the agent: which key pays, what's left, when it resets, their
last calls, CSV of their own.

## 11. Law and words (before anyone outside uses the lab key)
- Privacy page (the site's repo; its line that an own key stays in the browser and goes only to its provider changes
  **in the same release**): the lab runs the requests now, on Google Cloud (EU) to OpenAI; what's logged, how
  long, why (contract; legitimate interest for abuse and billing), that OpenAI keeps abuse logs 30 days, rights.
- OpenAI's DPA for the account. EU residency is by request to sales and adds 10 % on newer models: ask, don't wait for
  it; without it, say the US transfer plainly (SCCs).
- Terms: the free allowance can change or stop, isn't money, isn't transferable, no reselling; adults only.
- In the app, the first time the lab key would run: one short notice of who sees what, accept or use your own key.
  (OpenAI's terms let an app's end users use it; they forbid reselling access.)
- Not checked by a lawyer. That check is worth having before step "everyone" in §12's P6.

## 12. Building it: phases and gates

Each phase ends deployable, behind a flag, and asks before any deploy (D-322). Order on purpose: **no lab key before
the limits and the ledger exist.**

| Phase | What | Gate | Size |
|---|---|---|---|
| **P0 · ground** | Q-038 answered; prices and models refreshed (cache writes, GPT-6); evals on the new models; OpenAI project, hard limit, service-account key; OpenAI and Anthropic asked in writing about keys (§6.2); KMS; spike: reading as the person | a price test; eval table; the spike's yes or no | 1 session + ≈ $25 |
| **P1 · a loop the server can run** | the Vite build, the purity test, step hook and resume in `loop.ts`, the server's env (snapshot, resvg, bodies, members), evals with `--server` against emulators | evals on the stub identical in tab, Node and emulated worker; kill tests at each step resume | 2 |
| **P2 · runs end to end** | `startRun`, `runAgent`, leases, RTDB down and up, `TurnHost`, stop, steer, view moves, preview hand-over, jobs, reload and second tab; workspace and own keys (OpenAI and Claude), flag on for us | headless on emulators with a fake OpenAI: close the tab mid-run, reload, stop, steer, two tabs, a member removed mid-run, accept after others edited; a browser's key gone from the server after every kind of end, an account's after `remove`; either in no log or record | 5 |
| **P3 · ledger and limits** | reserve and settle, `aiCalls`, meters, `closeStale`, `audit`, the log bucket, a workspace's total and per-person limits and the owners' page, `ai/config` server-written; `ai` under the same limits | 200 concurrent calls never pass a limit; crash at any point leaves no open reservation; nothing but the shape is stored | 2 |
| **P4 · the lab key** | `lab/*`, `setLab`, the `paid by` line and its pick, limits in words, the notice, what's left in Settings | headless: to the limit mid-run and over a month's turn; blocked; off; invited only | 2 |
| **P5 · the backoffice** | §10's pages, mails, CSV | each act leaves exactly one audit entry; a non-admin gets nothing from any function or rule | 2–3 |
| **P6 · open it** | App Check, load (50 runs at once), reconciliation, price check, legal texts, invited beta of ~10 for two weeks, then everyone; `ai` deleted; lessons and release line | the beta's ledger within 5 % of OpenAI's; first text < 4 s warm, < 8 s cold (p95); rollback tried | 2 |

About 17 sessions. Usable for us after P2, worth showing after P4.

**Rollback:** `lab/public.on` off stops the lab key in seconds; the `serverRuns` flag sends own-key chats back to the
tab and workspace-key chats through `ai`, until P6 deletes both. After that our server down means no agent for anyone;
the app itself goes on.

**Tests that stay:** rules tests for every path in §7; unit tests for prices, reserve and settle, the shape of entries,
leases, resume; a fake OpenAI with slow, cut, 429, 5xx and missing-usage answers; the evals' `--server` mode in CI on
the stub.

## 13. Risks

| Risk | What holds it |
|---|---|
| The bill | per-person and total reservation, output cap, OpenAI's hard limit, mails, off switch |
| The server sees what the rules would hide | reads as the person; no content writes; tests |
| A run doubles (Cloud Tasks may deliver twice) | lease, checkpoints, calls keyed `run:step:attempt` |
| Slower first answer than the tab | RTDB stream, small bundles, a warm instance if measured necessary |
| People's own keys leak through us | the person's choice where; sealed with KMS; a browser's deleted at each run's end, with a sweep that mails; a test over every record and log; the advice to set a hard limit at the provider |
| A provider says no to keys through our server | asked in P0; `tabHost` kept until the answer |
| RTDB or Firestore load from streaming | batches, deleted after the end; about 7 small writes a second a run against RTDB's 1,000 a second |
| The total meter is one hot doc | two writes a call, fine at today's size; split into shards when the load test says so |
| Prices change | versioned table, monthly check, reconciliation |
| Scope: the agent's UI redesign is still to come | `TurnHost` is under the UI; the new line and the limit words are small kit parts |

## 14. Checked on 2026-11-25
- Functions (2nd gen): HTTP 60 min, scheduled and task queue 1800 s, events 540 s: firebase.google.com/docs/functions/quotas.
- Cloud Tasks may run a task twice: docs.cloud.google.com/tasks/docs/common-pitfalls. Work after the response loses CPU
  under request-based billing: docs.cloud.google.com/run/docs/tips/general. Not settled by docs: whether a handler
  keeps its CPU after the client goes; the queue makes it not matter.
- A `FirebaseServerApp`'s user has no refresh token and the rules' view of it isn't documented: hence P0's spike, which
  signs in with a custom token instead.
- OpenAI: hard project spend limits (429, not instant): developers.openai.com/api/docs/guides/spend-limits. Costs by
  project and key: `/organization/costs`. Background mode stores data even with `store: false`: guides/background.
  Abuse logs 30 days, no training on API data: guides/your-data. EU residency through sales, +10 % on models since
  March 2026: guides/data-residency. `safety_identifier`: guides/safety-best-practices. Cache writes 1.25× on GPT-5.6
  and later: guides/prompt-caching. Prices: api/docs/pricing.
- OpenAI's services agreement: an app may serve its end users; no reselling or leasing of access; no buying, selling or
  transferring API keys with a third party (this last quoted from a search result, not found in the page text we
  fetched). Help page 5112595: sharing API keys is against the terms. Forum 14538 (2022): staff say that includes
  bring-your-own-key apps. No official page found that allows it. Anthropic's commercial terms: nothing on it found.
- Cloud KMS: software keys $0.06 a version a month, $0.03 per 10,000 operations: cloud.google.com/kms/pricing.
- Log buckets: retention 1–3650 days and a lock: docs.cloud.google.com/logging/docs/buckets.
- RTDB: about 1,000 writes a second, 200,000 connections: firebase.google.com/docs/database/usage/limits.
- Cloud Run's active CPU about $0.000024 a vCPU-second (from a search result, not read on the page). Firestore's
  Frankfurt prices weren't found in the page's text: look them up in P0.
- ECB rate 1.0963 (24 Nov, from a search result).

## 15. P0's log (2026-11-25)

**Done**
- `models.ts`: GPT-6.2 Sol, 6.1 Terra, 6 Luna, Claude Fable 5.2 added; every price read again on the providers' pages;
  `cacheWrite` on prices and usage (OpenAI's `cache_write_tokens`, Claude's `cache_creation_input_tokens`).
- Two faults of today's agent: GPT-6 models got no reasoning block; GPT-6.2 and later bill `instructions` uncached on
  every request, so there the system prompt goes first in the input.
- The spike, on the auth and Firestore emulators with the real rules, in one process: three people at once each see
  only their own private documents and the shared ones; a viewer's write and a stranger's read are refused; a forced
  token renewal works; nothing is left after `deleteApp`. Twenty runs with 1,500 cards each: 3 s and at most 140 MB, so
  concurrency 8 fits 1 GiB. Removed mid-run: new reads are refused, but a listener already open hears nothing (10 s,
  emulator), and the same query asked while it is open is answered from it (§5.3 says what follows).

**Waits for the user**
1. Evals, in their own terminal (the key must not be pasted in a chat), about $0.5, $4 and $8 plus the judge:
   `OPENAI_API_KEY=… npm run eval -- --model openai:gpt-6-luna --judge openai:gpt-5.6-terra`, then the same with
   `openai:gpt-6.1-terra` and `openai:gpt-6.2-sol`. The best two then ×3.
2. An OpenAI project `north-star` with a hard spend limit, only the picked models, and a service-account key.
3. Cloud KMS on in the Firebase project: a key ring and a key in europe-west1; the functions' service account may
   encrypt and decrypt with it, and create tokens for itself (what signs custom tokens). Commands come with P1.
4. The letters below.

**The letter (OpenAI and Anthropic, each with its name)**
> We build a workspace app. Our users may use its AI agent with their own API key. The agent runs on our server on the
> user's behalf. Is each of these allowed under your terms? (a) The user's key stays in their browser, is sent to our
> server with each request, used only for that user's run and deleted when it ends. (b) The user stores their key in
> their account with us, encrypted, write-only, and can delete it at any time. (c) The owner of a team's workspace
> stores their organisation's key the same way, and members of that team use it through our agent, with limits. If any
> isn't, what would you recommend instead?

## 16. P1's log (2026-11-25)
- **The loop resumes** (`loop.ts`): `TurnState`, `onStep`, `resume`. Each carried field was taken out in turn to see a test
  fail.
- **The server's agent** (`functions/src/agent/`): `person.ts` (a session as the person), `workspace.ts` (their workspace,
  live, through the rules, by the app's own converter), `membership.ts` (who they are now, admin SDK), `env.ts` (reads,
  keeps the pending changes, `apply` refuses), `render.ts` (resvg with Inter), `turn.ts` (`runServerTurn`: one turn, kept
  before each step, membership and role read again each time and before anything is handed over).
- **The evals on it:** `npm run eval -- --cut` (in memory, every turn cut before each step) and `npm run eval -- --server`
  (the emulators: every turn on `runServerTurn`, a new session and a new read of the workspace after every cut, accepted
  through the real apply). The emulator mode now seeds members and the change log too.
- Not exported from `functions/src/index.ts` yet: nothing changes for anyone until P2.

## 17. P2's log, the server's half (2026-11-26)
- **Functions** (index.ts, the agent's code in its own chunk): `startAgent` (a message → a run, queued), `runAgent` (Cloud
  Tasks, 1800 s, 8 tries), `tellAgent` (an outcome or a job button; may queue the next run), `agentChanges` (the chat's
  pending changes for its preview), `setOwnKey` (an own key kept in the account, after a fresh sign-in), `sweepAgent`
  (every 5 min: runs left behind, run keys past 2 h, live nodes of ended runs).
- **Parts** (`functions/src/agent/`): `ask.ts` (what a browser may send, field by field), `runs.ts` (a run, a chat's one
  run at a time, at most 3 a person, the lease), `keep.ts` (Storage, gzip, under `agent/{uid}/`), `live.ts` (RTDB down
  and up), `thread.ts` (the chat between runs, saved to agentChats by the server, once a run), `keys.ts` (who may pay,
  the model on its key), `worker.ts` (one run: lease, turn, checkpoint, end done once), `serve.ts`, `seal.ts`.
- **What a retry does:** a worker that finds the run held by another throws, so Cloud Tasks tries again until the dead
  worker's lease (60 s, renewed every 20 s) runs out; a run nobody can finish ends after a day.
- **Rules:** `agentRuns`, `agentThreads`, `users/{uid}/private/aiKeys` read by their person, written by nobody;
  `agentLive/{uid}` read by its person; `agentCtl/{uid}/{run}` written by its person (stop, words once each, where they
  are, a tab watching, a move's answer). `npm run test:rules` 773/0 (37 new).
- **Checked end to end** on the emulators with functions, tasks and a fake OpenAI (a script in the session's scratchpad,
  64 checks): the text over RTDB as made (first text ≈ 3 s cold on the emulator); paid with the right key, `store:
  false`, a safety id, the server's own prompt and tools; the chat saved with no tab; a change waits, nothing written,
  the preview's changes, an apply told, the model hearing it; stop (≈ 0.1 s, OpenAI's answer closed); words between
  steps, once; a busy chat; the worker killed mid-run: the run goes on to its end on its second try, only the call in
  flight made again, the chat written once; who may (a stranger, a viewer on the workspace key, a model not ticked,
  someone else's chat, the live nodes and controls); an own key from the browser (sealed while it runs, gone at its
  end) and from the account (only its hint comes back, used, removed); a move with no tab and with one; a member removed
  mid-run; none of three keys in any doc, file, RTDB node or the emulator's log; an account deleted takes it all.
- **Not yet (P2's other half):** the app's side (`serverHost` in agentStore.ts, the `paid by` line, the preview from
  `agentChanges`, moves from RTDB, reopening a chat at work), the evals through the functions, the CLAUDE.md hard rule
  (changes when the app uses it), KMS instead of `AI_KEY_SECRET`, `WEB_API_KEY` set at the deploy.

## 18. P2's log, the app's half (2026-11-26)
- **On when** `serverAgentOn()` (src/data/agentServer.ts): on the emulators, and in a browser where
  `northstar.agent.server` is 1. Elsewhere the tab's own loop runs as before, until P6.
- **The store** (agentStore.ts): `serverTurn` starts a run (or follows one the server started), and the column takes its
  events as it took the loop's (`entryEvents`, one for both); stop, words while it works, the job's buttons (`stop after
  this step` mid-run through `agentCtl/…/after`), what was done with the preview (`tellAgent`), moves the server asks of
  the screen (made, then answered); the turn's lock isn't taken; the chat isn't saved from the tab (the server does);
  a chat opened, or come back to, finds its run and follows it (with the message it was asked) or shows its waiting
  preview; leaving only stops watching.
- **Who pays:** a key kept in this browser goes with the message; else one kept in the account; else the workspace's
  (the `paid by` pick comes with the lab's key, P4).
- **Settings → the agent:** with the agent on the server, saving a key asks `this browser` or `my account`; one in the
  account shows as `sk-…abcd` with `remove`; the words say where it goes.
- **CLAUDE.md's hard rule on keys** rewritten for D-434.
- **Checked:** the real app on the emulators with functions, tasks and a fake OpenAI, headless Chrome (a script in the
  session's scratchpad): a question streamed into the column, a change previewed and applied in the tab as the person
  and the saved chat saying so, stop, a reload while it works (the chat finds its run, shows its message, follows it to
  its end), the tab closed (the run ends, the chat holds it); no page error; Settings' two places, a key kept in the
  account shown and its row turned. Rules 776/0; unit 1266; the checks.
- **Not yet:** a stale `paid by` choice per chat and its line under the prompt (P4); the agent's own onboarding words (they
  wait for its redesign, D-312); the evals through the functions; deployed nowhere.

