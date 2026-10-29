// The fixed lists and limits the rules check, without Firebase (S3, D-312): what the cleaners (clean.ts) and the ops'
// validate need. The data/ files that owned them re-export them under the same names.

// competitorFeatures.ts
export const AVAILABILITIES = ['free', 'paid', 'enterprise', 'beta'] as const
export type Availability = (typeof AVAILABILITIES)[number]
export type CriterionScore = 'met' | 'part' | 'no'
export const CRITERION_SCORES: CriterionScore[] = ['met', 'part', 'no']

// documents.ts
export const DOC_KINDS = ['markdown', 'image', 'pdf', 'report'] as const
export type DocKind = (typeof DOC_KINDS)[number]
export const DOC_COLS = ['kind', 'title', 'by', 'size', 'added'] as const
export type DocCol = (typeof DOC_COLS)[number]
// firestore.rules checks these.
export const DOC_LIMITS = { title: 300, excerpt: 400, text: 900_000 }

// evidence.ts
export const EVIDENCE_KINDS = ['interview', 'quote', 'data', 'observation', 'link'] as const
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number]

// matrix.ts
// What a card can unfold into; only a feature's criteria for now (later its parts, a competitor's features).
export const UNFOLDS = ['criteria'] as const
export type Unfold = (typeof UNFOLDS)[number]
export const TONES = ['dim', 'fg', 'cyan', 'yellow', 'magenta', 'green', 'blue'] as const
export type Tone = (typeof TONES)[number]
export const CELL_KINDS = ['scale', 'number', 'text'] as const
export type CellKind = (typeof CELL_KINDS)[number]
export const TOTALS_AT = ['head', 'end', 'both'] as const
export type TotalsAt = (typeof TOTALS_AT)[number]
export const TOTALS_AS = ['squares', 'number', 'bar'] as const
export type TotalsAs = (typeof TOTALS_AS)[number]
export const CONFIDENCES = ['documented', 'inferred', 'guess'] as const
export type Confidence = (typeof CONFIDENCES)[number]

// table.ts
// A card's own fields, shown as they are.
export const FIELDS = ['type', 'plane', 'status', 'tags', 'regions', 'priority', 'impact', 'effort', 'evidence'] as const
export type Field = (typeof FIELDS)[number]
export const OWN_KINDS = ['scale', 'number', 'text', 'check'] as const
export type OwnKind = (typeof OWN_KINDS)[number]
// How narrow and how wide a column may be dragged, in the table's px.
export const COL_W = { min: 48, max: 640 }

// tasks.ts
// The cards' fields a kanban's columns can come from (D-268): never type (dragging doesn't change a card's type).
export const CARD_FIELDS = ['status', 'impact', 'effort', 'priority'] as const
export type CardField = (typeof CARD_FIELDS)[number]
