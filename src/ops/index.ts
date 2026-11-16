// The ops layer's public face (S3, D-312; docs/specs/agent.md §4.5, §5). Pure: types, autoId, validate, project, diff.
// apply is the Firestore adapter (firestore.ts). Entity ops (create_card, link, …) come in S4–S8.
export { OpsRefused } from './types'
export type { Coll, Delete, OpActor, OpCtx, OpError, Plan, Verdict, Write } from './types'
export { type Change } from './diff'
export { type DocStore } from './docs'
export { apply, type Applied, type ApplyOpts } from './firestore'
export { freshWs, type UiOpts } from './firestore'
// Entity ops (S4): cards, links, evidence, competitor features, places; the registry and batches with handles.
export type { CreateCardArgs, UpdateCardArgs, CreatePackageArgs, DeleteArgs, DuplicateArgs } from './cards'
export { type LinkArgs, type UpdateLinkArgs } from './edges'
export { type CreateEvidenceArgs, type UpdateEvidenceArgs, type EvidenceInput } from './evidence'
export { type CreateFeatureArgs, type UpdateFeatureArgs } from './features'
export { type PlaceOnArgs, type TakeOffArgs } from './places'
export { type OpDef, type ArgSchema, type Step } from './registry'
// Text ops (S5): create_text, update_text, arrange (a section carries what's inside it); delete takes text too.
export { type CreateTextArgs, type UpdateTextArgs, type ArrangeArgs, type TextStyle } from './text'
// Piece and canvas ops (S6): create_piece, update_piece, rename, resize, create_canvas, move_canvas, move_to_canvas,
// place_on/take_off for pieces, delete for pieces and canvases (one `delete`, delete.ts).
export type { CreatePieceArgs, UpdatePieceArgs, RenameArgs, PlaceArgs, ResizeArgs, CreateCanvasArgs, MoveCanvasArgs, MoveToCanvasArgs, PiecesOnArgs, PieceOffArgs, DeletePiecesArgs } from './pieces'
export { type DeleteAnyArgs } from './delete'
// Matrix and table ops (S7): update_matrix, update_table, axis_add / axis_remove / axis_update, update_cell; create_piece
// takes a typed matrix / table; criteria taken off a feature (update_card) take their scores.
export { type UpdateMatrixArgs, type MatrixSpec, type AxisSpec, type AxisPatch } from './matrix'
export { type UpdateTableArgs, type TableSpec, type RuleSpec, type ColumnSpec } from './table'
export { type AxisAddArgs, type AxisRemoveArgs, type AxisUpdateArgs, type UpdateCellArgs } from './lens'
// Task, deck and timeline ops (S8): create_task, update_task, move_task; update_deck (D-300's tasks_to), the column ops,
// update_timeline; create_piece takes a typed deck; delete takes tasks and deck columns; create_evidence from_task.
export { type CreateTaskArgs, type UpdateTaskArgs, type MoveTaskArgs, type TaskInput, type TaskMoveSpec } from './tasks'
export { type UpdateDeckArgs, type DeckSpec, type CreateDeckColumnArgs, type UpdateDeckColumnArgs, type MoveDeckColumnArgs, type UpdateTimelineArgs } from './deck'
// Layouts by meaning (S9, R10): arrange with layout/where (the registry's arrange); the geometry in src/model/layout.ts.
export { type LayoutArgs, type Where, type GroupBy } from './arrange'
export { type Layout, type Side } from '../model/layout'
