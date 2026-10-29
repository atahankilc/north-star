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
