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

