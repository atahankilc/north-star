# The agent on Claude: an Anthropic adapter (plan, not started)

_Written 2026-10-31 for Q-031 (1). Status: **agreed (D-329), not started.** Read with agent.md §4.2 (models and keys), §4.3
(context), agent-bugs.md (25, the baseline) and D-312 (own keys only, the person picks the model)._

## Why

The agent talks only to OpenAI today. A Claude key opens it to Anthropic's models, and since 2026-10-07 a Max, Ultra
or Team plan pays for it: those plans include monthly API credits that cover the Claude API when the key comes from a
Console organisation linked to the plan (support.claude.com articles 15036540 and 17154008: Max $100 a month, Ultra
$200; claude.ai → Settings → Billing → API credits → Link organization; unused credits expire each cycle; when they
run out, requests stop unless the organisation bought credits; never charged to the plan). No sign-in with Claude
(Anthropic's terms forbid it in third-party apps): the person pastes a key, as with OpenAI.

## What already fits

- The loop talks to `AgentModel` (`respond`, `stream`) in src/agent/contract.ts; tools, results and usage are ours,
  not OpenAI's. `providerItems` is already `unknown[]`.
- The prompt names no provider or model (tests/unit/agentPrompt.test.ts holds it).
- Keys: one in the browser's storage, read only by the call that needs it, never logged (settings.ts, CLAUDE.md).

## The one hard part: Claude needs an append-only history

Claude's current models (Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.1) bind each thinking block to everything before
it: the system prompt, the tool set and every earlier message. Change any of that and every later thinking block is
invalid; for accounts created on or after 2026-08-31 the request is **refused with a 400**, and older accounts lose
the reasoning silently. The people pasting a fresh Max key are exactly those new accounts.

Our loop edits its history three ways (loop.ts, agent.md §4.3), each fine on OpenAI and each breaking Claude:

1. **The map, the notes and "where the person is" are rebuilt every turn and placed before the chat** (items 2, 3,
   5), so the prefix changes whenever the workspace does.
2. **Old tool results are cleared** past KEEP_RESULTS into a one-line note.
3. **`compact`** drops older turns' calls, results and provider items.

So the Claude adapter can't just translate messages. The loop gets an **append-only mode**, used by any provider that
asks for it (`AgentModel.appendOnly`):

- **Context goes after, not before.** The fixed part (prompt, tools) stays first. The map, the notes and "where"
  are *appended* as a system message at the start of each turn (Claude's mid-conversation system messages exist for
  this, keep the cached prefix and act as the operator's channel), and earlier copies stay in the history. A map
  that grows each turn is cut down by sending only what changed since the last one (`whats_new` already computes
  that), with the whole map again after a compaction.
- **Clearing old results** moves to the server: Anthropic's context editing (`clear_tool_uses`), which doesn't count
  as an edit.
- **Compaction** moves to the server too: Anthropic's compaction (beta), its block kept and sent back as it came.
- Thinking blocks go back unchanged, always; on a 400 about a binding, one retry with
  `prefix_mismatch_behavior: "drop_block"` (beta header) and a warning in the transcript, never a silent loop.

OpenAI keeps today's path: the mode is per provider and the OpenAI evals don't move.

## The adapter (src/agent/anthropic.ts, beside openai.ts)

- **Client:** the official `@anthropic-ai/sdk`, in the browser with `dangerouslyAllowBrowser: true` (which sends
  Anthropic's direct-browser header), lazy-loaded in its own chunk like the workspace's code. The client lives in the
  adapter's closure only, as the OpenAI key does now; every error text passes through `redact` (`sk-ant-…`).
  Step 1 checks that it builds for the browser in Vite; if it doesn't, the fallback is `fetch` with the same header,
  like openai.ts.
- **Request:** `system` from the first system message; later system messages as `role: "system"` entries in place;
  tools as `input_schema`, `strict: true` where the schema already fits (the same `fitsStrict` rule); tool results
  all in one user message per step (parallel calls stay parallel); `max_tokens` high, streamed.
- **Thinking and effort:** `thinking: { type: "adaptive" }` (it can't be turned off on Opus 5.5, Sonnet 5.5 off only
  through `between_tools`); the person's effort to `output_config.effort` (`low`…`max`; Opus 5.5 and Haiku 5.5
  default `medium`, Sonnet 5.5 `high`, so we always send it). Thinking blocks are kept in `providerItems` and sent
  back verbatim.
- **The loop's last step** (`toolChoice: 'none'`): `tool_choice: { type: "none" }` exists. Forced `any`/`tool` 400 on
  these models, and we never use them.
- **Caching:** automatic caching (`cache_control` at the top) with the prefix stable by construction (above);
  `usage.cache_read_input_tokens` → `Usage.cached`. Caches are per model.
- **Stops:** `end_turn` → end, `tool_use` → tool_calls, `max_tokens` → length, `refusal` → refusal (with its
  category in the transcript, never the text), `pause_turn` → continue the same step. Server-side `fallbacks:
  "default"` on Opus 5.5 and Sonnet 5.5 (Anthropic's guidance), so a refusal is re-run on another model inside the
  call; the transcript says which model answered.
- **Errors:** 401 the key; 429 one retry honouring `retry-after`; 529/5xx one retry; "credit balance too low" a
  plain line: *your monthly API credits (or the organisation's balance) are used up: they come back next cycle, or
  add credits in the Console*; an abort throws `AbortError`, as now.
- **Models:** `GET /v1/models` for the picker (it gives each model's context and output limits). KNOWN_MODELS gets
  `provider: 'anthropic'` rows: `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-fable-5-1`, all
  `fit: 'unknown'` until the evals; prices from Anthropic's page when added (today: $4/$20, $2/$10, $0.10/$0.50,
  $10/$50 per million, cache reads 10 %).

## Settings, keys, picking

- A key per provider (`northstar.agent.anthropicKey` beside the OpenAI one), each with its own `[check]`, hint
  (`sk-ant-…abcd`) and remove. The person may hold both.
- The model id carries its provider (`anthropic:claude-sonnet-5-5`, as the evals already write `openai:…`; usage.ts
  accepts the colon). A model saved without one is OpenAI's (old settings keep working).
- The key row's note, for Claude: *Max, Ultra and Team plans include monthly API credits: make the key in the
  Console organisation linked to your plan and it spends them.* with a link to Anthropic's article, so the text never
  goes stale in the app when the rules change again.
- The Settings copy about where the key goes names the provider of that key ("goes only to Anthropic").
- A chat started on one provider stays on it (another provider's `providerItems` can't be replayed); switching
  model starts a new chat, said in the picker.

## Smart and informed: how we know

- **The same eval suite**, `npm run eval -- --model anthropic:<id>` with `ANTHROPIC_API_KEY` read at run time (never
  written), three runs per model, after 25 and the baseline (agent-bugs "Order").
- **One judge for every provider:** the judge model stays fixed whatever is being tested, so scores compare.
- `fit` in models.ts is written from those runs only; nothing is `works well` without them.
- A prompt tuned on GPT may not suit Claude (Anthropic's notes: newer models do worse with over-prescriptive prompts).
  Per-provider prompt changes only where the evals show a gap, measured; never two prompts by default.
- An eval on a long chat (many turns, compaction) passes only with no binding 400 and no dropped thinking.

## Steps

1. **Contract:** `AgentModel.appendOnly` and `provider`; `providerItems` tagged with their provider (dropped, never
   sent, to another one); the SDK built for the browser (or the fetch fallback decided).
2. **Loop's append-only mode:** context appended per turn, the diff map, server-side clearing and compaction behind
   the adapter; unit tests that the history only grows; OpenAI's path unchanged (its tests and evals as before).
3. **anthropic.ts** with recorded SSE fixtures (`tests/unit/fixtures/anthropic/`, as for OpenAI): text, parallel
   tools, thinking replay, refusal + fallback, `pause_turn`, every error, abort, redaction.
4. **models.ts and settings:** provider rows, keys per provider, `[check]` through `/v1/models`, the picker.
5. **Settings UI:** the second key row and its note; the chat's model switch line.
6. **Evals:** `--model anthropic:<id>`, three runs per model, `fit` written; the long-chat eval.
7. **Docs:** agent.md §4.2/§4.3, ARCHITECTURE.md (AI), evals/README.md.

No rules change (keys never leave the browser), no Blaze. Onboarding: the agent's lessons wait for its redesign
(CLAUDE.md, D-312), so a line in releases.ts only when the agent's lessons are written.

## Open

- Whether 1–2 wait for 25 and the baseline or go first: the adapter can be built now, but its evals only mean
  something after 25. Recommended: build 1–5 now, measure (6) after the baseline.
- The diff map (sending what changed instead of the whole map each turn) is new and needs its own eval: a turn after
  edits must still answer from the right state.
