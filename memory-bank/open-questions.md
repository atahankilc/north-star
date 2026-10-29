# Open Questions

Format: `Q-xxx · priority (blocking | soon | later)`, with a recommendation where we have one.
Once answered → move to [decisions.md](decisions.md).

---

_Q-016–Q-018 were answered by D-139._

The agent's questions Q-019–Q-024 were answered by D-312.

---

### Q-025 · soon · Where is onboarding's "seen" kept? (D-315)
Recommendation: per person in Firestore (`users/{uid}/private/onboarding`, own only) with a browser cache; needs one
rules deploy by the user. Alternative: this browser only (no deploy; a new laptop shows everything again). The run
builds the recommendation with a silent localStorage fallback.

### Q-026 · soon · What's "new" for people who used North Star before? (D-315)
Recommendation: accounts made before onboarding ships are "returning", baseline D-291 (1.5 merged, 2026-10-27): what's
new covers D-293 onward (decks and days, the timeline strip, several canvases, filters that pass…), older lessons
marked known. Alternatives: all of 1.5 is new to them (full welcome too), or no what's new at all.

### Q-027 · later · A rule for every future feature (D-315)
Recommendation: add to CLAUDE.md's hard rules "every new user-facing feature ships with its lesson
(`src/onboarding/lessons.ts`) and a release line (`releases.ts`); `npm run check:lessons` passes". Only the user edits
CLAUDE.md.

### Q-028 · later · The onboarding's look (D-315)
The run makes a preview with 2–3 options (`docs/specs/onboarding-preview/`) and builds the recommended one; the user
picks in the morning.
