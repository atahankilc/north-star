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

### Q-007 · soon: Workspace roles
Sharing uses an invite code (D-012). Still open: owner/editor/viewer roles, or everyone is an editor for the MVP? Public read-only links?
Recommendation: owner + editor only for the MVP.

### Q-008 · later: Canvas dimensionality
A true 3D canvas (cards at different depths, orbit camera), or 2.5D (flat board, 3D camera moves,
tilt and parallax)? Recommendation: 2.5D for usability, with full 3D used for transitions and
competitor maps.

### Q-009 · soon: Storage limits for attachments
Blocked on D-015 (Storage needs Blaze). If Blaze: 5 GB free. What per-file cap (for example 10 MB)?
Should images be compressed client-side?

### Q-011 · blocking (Phase 1): Verify the Firebase security rules
`firestore.rules` (especially the invite-code `joining()` rule) and `database.rules.json` have not been run yet.
Recommendation: test with two Google accounts once the project exists. Optionally add emulator tests
(`@firebase/rules-unit-testing`, needs Java).
