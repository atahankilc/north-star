# North Star: Roadmap

Live progress is tracked in [../memory-bank/state.md](../memory-bank/state.md).

## 1.0 ✅ done, then dropped (D-177, D-248)
Phases 0–6 were built as pages: one board with every card type, Flow, Table, Matrix, Priorities, Overview, Reports, the
assistant, attachments and export/import. In 1.5 that code and its data shapes were deleted (in git at `493bf87`); only
old reports move to documents. Its specs stay as reference for when a feature comes back:
[specs/board.md](specs/board.md), [specs/usefulness.md](specs/usefulness.md), [specs/planes.md](specs/planes.md).

- Phase 0, foundations ✅: scaffold, GitHub Pages deploy, tokens, fonts, the ASCII effect and backdrop.
- Phase 1–2, the board, competitors and features, the matrix ✅ (D-040–D-052).
- Phase 3, collaboration ✅: sharing (D-062, D-098), presence, cursors, following (D-065–D-071).
- Phase 4, settings and AI ✅ (D-073–D-079).
- Phase 5, files and export ✅ (D-080, D-083).
- Phase 6, from research to decisions ✅ (D-133–D-144).

## 1.5: one canvas (D-174) — live on `main` since 2026-10-27
- Canvas and pieces ✅: planes (cards, links, text, sections, sticky notes, packages, multi-select, guides, filters,
  right-click), matrix, table, documents, kanban (tasks or cards; priorities), timeline (D-176–D-271).
- Collaboration on the canvas ✅: cursors, following, selections, comment threads (D-191–D-199, D-260).
- Export/import v2 ✅ (D-246).
- One look and behaviour across the canvas ✅ ([specs/consistency.md](specs/consistency.md), D-263–D-277).

## Next
- Documents' files (images, PDFs) and the workspace key: both need the Blaze plan (D-232, D-079).
- The assistant back, as a piece.

## Later
- Templates (Lean Canvas, SWOT, positioning map), version history, collaborative text (Yjs).
