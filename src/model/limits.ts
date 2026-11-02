// How much the data may hold (D-325): text lengths and list sizes, in one place for the app (src/data/), the agent's
// layer (src/ops/) and the model. firestore.rules holds the same numbers (it can't import them):
// tests/unit/limits.test.ts reads the rules and fails when one of these and its rule disagree. Pure: no Firebase.

// Cards (D-187): a title; its notes (body) share the long-text cap.
export const TITLE_MAX = 200
export const LONG_TEXT_MAX = 20000
// A card's #tag, a competitor's region (D-056, D-145): one item in its list.
export const TAG_MAX = 40
export const REGION_MAX = 60
// A competitor's short facts (pricing, audience) and any card's web address (D-164).
export const FACT_MAX = 2000
export const URL_MAX = 2000
// A competitor feature's category (D-164).
export const CATEGORY_MAX = 100
// What a feature is judged on (D-133): one criterion.
export const CRITERION_MAX = 200
// Evidence (D-137): what was learned, and from whom.
export const EVIDENCE_TEXT_MAX = 2000
export const SOURCE_MAX = 200
// A link's own label (D-207).
export const LINK_LABEL_MAX = 200

// The author's name a document (D-232) or a sticky note (D-257) keeps.
export const AUTHOR_NAME_MAX = 200

// A workspace's name as typed on the workspaces page and in settings (D-338).
export const WORKSPACE_NAME_MAX = 80

// Pieces, canvases and text (D-176, D-302, D-194).
export const PIECE_NAME_MAX = 80
export const CANVAS_NAME_MAX = 60
export const KICKER_MAX = 60

// A workspace's "building" description.
export const DESCRIPTION_MAX = 1000

// Decks (D-251, D-268): columns, a column's name and its limit; named boxes when it holds cards.
export const KANBAN_COLS_MAX = 12
export const COL_NAME_MAX = 40
export const LIMIT_MAX = 99
export const BOX_NAMES_MAX = 40
export const BOX_NAME_MAX = 40

// Tasks (D-251, D-256): a title, notes, a checklist and its items, #labels and each label.
export const TASK_TITLE_MAX = 200
export const TASK_NOTES_MAX = LONG_TEXT_MAX
export const CHECKS_MAX = 50
export const CHECK_MAX = 200
export const LABELS_MAX = 20
export const LABEL_MAX = 40

// Matrices (D-204): a typed head's name, a text cell, a cell's note, a scale step's glyph and label.
export const MATRIX_NAME_MAX = 200
export const CELL_TEXT_MAX = 200
export const CELL_NOTES_MAX = LONG_TEXT_MAX
export const GLYPH_MAX = 4
export const STEP_LABEL_MAX = 40
// What one of an axis's entries is called, in the corner (D-204); a number cell's unit.
export const AXIS_NOUN_MAX = 40
export const UNIT_MAX = 20

// Tables (D-209): a column's own name; a rule's typed value (sources, D-268).
export const TABLE_COL_NAME_MAX = 40
export const VALUE_MAX = 200

// Threads (D-192): a message and its @mentions.
export const MESSAGE_MAX = 2000
export const MENTIONS_MAX = 20

// The agent's notes (D-312): their text goes into every prompt.
export const AGENT_NOTES_MAX = 8000

// The change log (D-312): kinds and ids in one entry.
export const CHANGE_IDS_MAX = 100
export const CHANGE_KINDS_MAX = 20

// A workspace's picture for the workspaces page (D-338, `summary/main`): its first canvas's pieces and their cards, as
// numbers and letters; the strings' caps hold that many entries at their longest (22 and 13 characters).
export const SUMMARY_PIECES_MAX = 60
export const SUMMARY_CARDS_MAX = 300
export const SUMMARY_PIECES_CHARS = 1400
export const SUMMARY_CARDS_CHARS = 4000

// Writes in one Firestore batch (its own cap is 500; room left for the tracked undo snapshot).
export const WRITE_BATCH_MAX = 450
