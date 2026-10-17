# Open Questions

Format: `Q-xxx · priority (blocking | soon | later)`, with a recommendation where we have one.
Once answered → move to [decisions.md](decisions.md).

---

### Q-003 · soon: Exact default OpenAI model
Recommendation: the cheapest current "nano" tier, user-overridable in Settings.
Verify the model ID and pricing on openai.com when Phase 4 starts.

### Q-004 · soon: Drawings, upload only or a built-in sketch pad?
Option A: upload image/SVG/PDF only (simple). Option B: built-in sketch pad (for example tldraw) saving SVG.
Recommendation: A first, B later.

### Q-006 · later: Concurrent text editing
Is last-write-wins per field enough, or do we need Yjs for simultaneous typing in the same note body?
Recommendation: LWW for the MVP.

### Q-009 · soon: Storage limits for attachments
Blocked on D-015 (Storage needs Blaze). If Blaze: 5 GB free. What per-file cap (for example 10 MB)?
Should images be compressed client-side?

### Q-012 · soon: How should groups/clusters work?
Option A: a group is a labelled frame you drag cards into (spatial). Option B: tag-based (all cards with a tag form a group).
Recommendation: A, a frame on the board that moves its cards with it, since it matches the post-it mental model.

### Q-013 · soon: Undo and keyboard delete
Right now deleting is a two-step button only (no Delete key) because there's no undo yet.
Recommendation: add a small local undo stack (create, move, edit, delete), then enable the Delete key and cmd+Z.

### Q-015 · blocking: Information architecture around domains
User feedback 2026-10-17: the app should follow how they think: **domain → ideas (problem, customer segment:
start-ups / scale-ups / SMEs / enterprises) → competitors → features**, visible in one place with different visualizations,
plus a spreadsheet view of everything, domain tabs, and type filters.
Agreed so far: domains live inside a workspace; an idea has one domain, competitors and features can link into several.
Recommendation: domains as main tabs; type filters; one data set shown as Flow (auto-laid-out columns along the chain),
Board (free canvas, all types), Table (spreadsheet) and Matrix. Open: default view, idea fields for problem/customer.
