# North Star: Roadmap

Live progress is tracked in [../memory-bank/state.md](../memory-bank/state.md).

## Phase 0: Foundations
- Resolve the blocking open questions (backend, auth methods, fonts)
- Scaffold Vite + React + TS + R3F; GitHub Actions → Pages deploy
- Design tokens, fonts, base ASCII-styled UI components
- ASCII post-processing effect prototype plus an ambient background

## Phase 1: Single-user core (mostly done; see memory-bank/state.md)
- Auth and workspace list
- Idea Canvas: create, edit, move and delete post-its; connections; tags; text labels to name and jump between areas (groups dropped, D-049)
- Detail panel
- Data adapter, schema and permission rules

## Phase 2: Competitors and features
- Competitors list plus a per-competitor map with competitor features
- Features view, linked to ideas
- Comparison matrix (spreadsheet view)
- Cross-linking from any node to any node; view transitions

## Phase 3: Collaboration ✅ done (D-071)
- Workspace sharing (invites, roles) ✅ (D-021, D-062)
- Presence: live cursors, avatars, selections, following ✅ (D-065, D-067, D-068)
- Live edits across clients ✅ (last write wins per field; no typing indicator, D-071)

## Phase 4: AI and settings
- Settings page: OpenAI key (local only), model choice, effect quality
- AI actions: summarize, suggest links, draft competitor breakdown, fill matrix notes

## Phase 5: Files, export and import
- Attachments (images, PDFs, drawings)
- Workspace export/import (zip bundle) ✅ (D-080)
- Matrix → TSV, canvas → PNG ✅ (D-080)

## Later
- Templates, version history, comments, collaborative text (Yjs)
