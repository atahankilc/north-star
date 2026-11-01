# Open Questions

Format: `Q-xxx · priority (blocking | soon | later)`, with a recommendation where we have one.
Once answered → move to [decisions.md](decisions.md).

---

_Q-016–Q-018 were answered by D-139._

The agent's questions Q-019–Q-024 were answered by D-312.

---

_Q-025, Q-026 and Q-027 were answered in D-315; Q-028 (the onboarding's look) was answered by D-316._

---

_Q-029 (fields restricted on content shapes) was answered by D-335._

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

_Q-032 (the kit's rules repeated in the live CSS) was answered by D-334._

### Q-033 · soon · The backdrop faint on some screens (dark theme)
The user, 2026-11-01: on their screen the dark ASCII backdrop is clear, on some others barely visible. Measured
(headless, dpr 1/1.25/1.5/2): the ink is the same at every dpr; what changes is glyph size (a cell is 9 device px,
D-172, so on a 2x screen glyphs are physically half size, strokes ~1 device px) and the glyph atlas being sampled
from 64 px down to 9 with no mipmaps (thin strokes drop out). About a third of lit pixels are mid-dark grey, which
poor panels, low brightness or a bright room crush to black. Waiting on: which screen is the user's (MacBook or
external) and which one looked faint. **Recommendation:** (a) draw the atlas at the real cell size so strokes sit on
pixels (look unchanged); (b) a floor lifting the faintest glyphs; (c) only if needed, a minimum cell size in CSS px
(changes D-172's fine look, ask first).

_Q-034 (where the HUD's tools sit) was answered by D-343: the decks tool stays in the side nav._
