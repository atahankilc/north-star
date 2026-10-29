# Open Questions

Format: `Q-xxx · priority (blocking | soon | later)`, with a recommendation where we have one.
Once answered → move to [decisions.md](decisions.md).

---

_Q-016–Q-018 were answered by D-139._

The agent's questions Q-019–Q-024 were answered by D-312.

---

_Q-025 and Q-026 were answered in D-315._

### Q-027 · later · A rule for every future feature (D-315)
Recommendation: add to CLAUDE.md's hard rules "every new user-facing feature ships with its lesson
(`src/onboarding/lessons.ts`) and a release line (`releases.ts`); `npm run check:lessons` passes". Only the user edits
CLAUDE.md.

### Q-028 · later · The onboarding's look (D-315)
The run makes a preview with 2–3 options (`docs/specs/onboarding-preview/`) and builds the recommended one; the user
picks in the morning.
