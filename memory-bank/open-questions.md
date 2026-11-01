# Open Questions

Format: `Q-xxx · priority (blocking | soon | later)`, with a recommendation where we have one.
Once answered → move to [decisions.md](decisions.md).

---

_Q-016–Q-018 were answered by D-139._

The agent's questions Q-019–Q-024 were answered by D-312.

---

_Q-025, Q-026 and Q-027 were answered in D-315; Q-028 (the onboarding's look) was answered by D-316._

---

### Q-029 · soon · `keys().hasOnly` on content shapes (audit P2)
Cards, labels, pieces, edges, cells, evidence and comparisons accept any extra field. Restricting them needs the field
names really in the live data first (old docs and undo re-creating them would be refused otherwise); reading them was
refused by the permission prompt on 2026-10-29. A read-only script that prints field names only (never values) is
`livekeys.mjs` in that session's scratchpad (not kept). **Recommendation:** the user allows the read or runs it, then
restrict only added or changed keys on update (old fields stay) and all keys on create, with allow + deny tests.

### Q-030 · later · Author fields bound to their writer (audit P2)
A task's `givenBy` and a sticky's `uid`/`author` can name someone else. Binding them to `request.auth.uid` on update
would refuse undoing a change to someone else's assignment (undo writes the old `givenBy` back). **Recommendation:**
leave open until undo can skip those fields; low risk (members only).

### Q-031 · later · Other model providers: Claude's API, subscriptions, a local harness
The user, 2026-10-31: could the agent use a Claude API key, a Claude or ChatGPT subscription, or a local harness
(Claude Code), and how do we know it stays as smart and informed? D-312 already says OpenAI first "behind a thin
adapter, other providers later". The loop talks to `AgentModel` (src/agent/contract.ts), but `providerItems`
(OpenAI's reasoning items) and `KnownModel.provider: 'openai'` are OpenAI's shape.
_(1) is answered by D-329 (docs/specs/agent-claude.md); left open: (2) ChatGPT's sign-in and (3) the local harness._
**Recommendation:** (1) an Anthropic adapter behind `AgentModel`, the person's own key as today (Anthropic allows
browser calls with its direct-browser header), its reasoning blocks replayed as OpenAI's are, `models.ts` per
provider; (2) subscriptions, checked 2026-10-31: Claude's sign-in is not allowed in our app (Anthropic's Claude Code legal page: no third party may offer Claude.ai login or route requests through Free/Pro/Max/Ultra credentials; only the unmodified Claude Code binary signed in by the person). But the plan can still pay: since 2026-10-07 Max, Ultra and Team include monthly API credits covering the Claude API when used with an API key from a linked Claude Console organisation (support.claude.com/en/articles/15036540; the June 15 credit pool that herdl.com and others reported was paused that day and never started). So a Max person makes a key in that organisation and pastes it as their own key, today's flow, spent from their plan's credits; no OAuth, nothing against the terms. Pro gets no credits. ChatGPT's plan can be used, through OpenAI's official "Sign in with ChatGPT" (DevDay 2026-09-29; developers.openai.com/siwc/quickstart: commercial partners by an interest form in a limited trial; "ChatGPT plan usage is available to all open-source partners", aimed at plugin and CLI authors; Plus and Pro users; Responses API scopes the person grants; the quickstart's code exchange is on a backend, which we lack until Blaze, PKCE without one not confirmed). Our repo is public with no licence, so not open source yet: a licence would be the user's call, then apply; never an unofficial Codex/Claude OAuth route (blocked or may break); (3) a local harness: Claude Code driving the open tab through a small local bridge (an MCP server on localhost speaking to the tab), the same `src/ops/` tools; it is also the one way a Claude subscription can drive the agent, since the person signs in to Claude Code itself; this reverses D-074's "not MCP, no server". The user, 2026-10-31: kept as an idea for the future, not now; one day it would let people connect their own local agents or harnesses (Claude Code, Codex, any MCP client). Smart and informed is held by
the evals, not by the provider: every provider and model runs the same suite (`--model anthropic:<id>`), three
times, with `fit` in models.ts written from it; nothing ships as `works well` without that run. After 25 and the
baseline.

### Q-032 · later · Label's (and Button's) rules repeated in the live CSS
Files that `composes` Label.module.css or Button.module.css bring the kit's rules again (4 copies of Label's in the
live build: main, learn, Coach, WorkspaceLayout), so a caller's own colour or size on a label can lose to it (seen:
Settings' section heads ask `--fg-muted` and show `--fg-dim`). Tried 2026-11-01: Label's rules in `:where()` fixes it,
but visibly changes those labels app-wide. **Recommendation:** do it as its own step (Label, then Button), listing the
labels whose colour changes; until then a caller's override outweighs the kit's (`.board .month`, `.x[data-icon]`).

