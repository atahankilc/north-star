# Memory Bank

The project's working memory. It lets any session (human or Claude) pick up exactly where the
last one stopped. **Read all files here at the start of every session.**

| File | Holds | Update when |
|---|---|---|
| [state.md](state.md) | Current phase, what's done, in progress, next steps | At the end of every work session or milestone |
| [decisions.md](decisions.md) | Decision log (ADR-lite): what was decided, why, alternatives | A decision is made or reversed |
| [open-questions.md](open-questions.md) | Unresolved questions, each with a recommendation | A question comes up or gets answered (answered → move to decisions.md) |

## Rules
- An open question, once answered, becomes a decision: remove it from `open-questions.md`, add
  `D-xxx` to `decisions.md`, and update affected docs in `/docs` if needed.
- Decisions are never silently deleted. A reversed one is marked `Superseded by D-yyy`.
- Keep `state.md` short and current. It is a snapshot, not a history; git has the history.
- Specs live in `/docs`: [PRODUCT](../docs/PRODUCT.md), [ARCHITECTURE](../docs/ARCHITECTURE.md),
  [DESIGN](../docs/DESIGN.md), [ROADMAP](../docs/ROADMAP.md).
