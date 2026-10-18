# Memory Bank

The project's working memory. It lets any session (human or Claude) pick up exactly where the
last one stopped. `state.md`, `decisions.md` and `open-questions.md` are auto-loaded (CLAUDE.md); the two logs are read on demand.

| File | Holds | Update when |
|---|---|---|
| [state.md](state.md) | Current phase, what's done, in progress, next steps | At the end of every work session or milestone |
| [decisions.md](decisions.md) | Current rules by topic, one line each with its D-number; a "rejected" list | A decision is made or reversed (edit the line it replaces) |
| [decisions-log.md](decisions-log.md) | Every decision in full (ADR-lite): what, why, alternatives, verification | Append each new `D-xxx` entry |
| [state-history.md](state-history.md) | What was done and verified, session by session | Work finishes (state.md keeps only the snapshot) |
| [open-questions.md](open-questions.md) | Unresolved questions, each with a recommendation | A question comes up or gets answered (answered → move to decisions.md) |

## Rules
- An open question, once answered, becomes a decision: remove it from `open-questions.md`, add
  `D-xxx` to `decisions-log.md` and its line to `decisions.md`, and update affected docs in `/docs` if needed.
- Decisions are never silently deleted. A reversed one is marked `Superseded by D-yyy` in the log, and its line leaves `decisions.md`.
- Keep `state.md` short and current. It is a snapshot, not a history; git has the history.
- Specs live in `/docs`: [PRODUCT](../docs/PRODUCT.md), [ARCHITECTURE](../docs/ARCHITECTURE.md),
  [DESIGN](../docs/DESIGN.md), [ROADMAP](../docs/ROADMAP.md).
