// The ops layer's public face (S3, D-312; docs/specs/agent.md §4.5, §5). Pure: types, autoId, validate, project, diff.
// apply is the Firestore adapter (firestore.ts). Entity ops (create_card, link, …) come in S4–S8.
export { DELETE, isDelete, OpsRefused } from './types'
export type { Coll, Delete, OpActor, OpCtx, OpError, Plan, Verdict, Write } from './types'
export { autoId, counterIds } from './newId'
export { validate } from './validate'
export { project } from './project'
export { diff, changedFields, type Change } from './diff'
export { toDocs, docsOf, writeTo, WriteError, type DocStore } from './docs'
export { apply, refOf, type Applied, type ApplyOpts } from './firestore'
export { uiCtx, applyUi, serverHas, sayRefused, runUi, freshWs, forgetRecent, present, type UiOpts } from './firestore'
export { projectLoose } from './project'
// Entity ops (S4): cards, links, evidence, competitor features, places; the registry and batches with handles.
export { createCard, updateCard, createPackage, deleteThings, duplicate, duplicatePlan, cardCascade, rehome, offPlane } from './cards'
export type { CreateCardArgs, UpdateCardArgs, CreatePackageArgs, DeleteArgs, DuplicateArgs } from './cards'
export { link, unlink, updateLink, type LinkArgs, type UpdateLinkArgs } from './edges'
export { createEvidence, updateEvidence, type CreateEvidenceArgs, type UpdateEvidenceArgs, type EvidenceInput } from './evidence'
export { createCompetitorFeature, updateCompetitorFeature, type CreateFeatureArgs, type UpdateFeatureArgs } from './features'
export { placeOn, placeOnPlan, takeOff, takeOffPlan, type PlaceOnArgs, type TakeOffArgs } from './places'
export { OPS, REGISTRY, build, buildBatch, type OpDef, type ArgSchema, type Step } from './registry'
// Text ops (S5): create_text, update_text, arrange (a section carries what's inside it); delete takes text too.
export { createText, updateText, arrange, TEXT_KINDS, TEXT_NAMES, type CreateTextArgs, type UpdateTextArgs, type ArrangeArgs, type TextStyle } from './text'
// Piece and canvas ops (S6): create_piece, update_piece, rename, resize, create_canvas, move_canvas, move_to_canvas,
// place_on/take_off for pieces, delete for pieces and canvases (one `delete`, delete.ts).
export { createPiece, updatePiece, rename, resize, place, createCanvas, moveCanvas, moveToCanvas, moveToCanvasPlan, piecesOnPlan, piecesOff, deletePieces, pieceCascade, deleteCanvasWrites, PIECE_KINDS } from './pieces'
export type { CreatePieceArgs, UpdatePieceArgs, RenameArgs, PlaceArgs, ResizeArgs, CreateCanvasArgs, MoveCanvasArgs, MoveToCanvasArgs, PiecesOnArgs, PieceOffArgs, DeletePiecesArgs } from './pieces'
export { deleteAny, type DeleteAnyArgs } from './delete'
export { boundTo } from './stick'
// Matrix and table ops (S7): update_matrix, update_table, axis_add / axis_remove / axis_update, update_cell; create_piece
// takes a typed matrix / table; criteria taken off a feature (update_card) take their scores.
export { updateMatrix, matrixSetupFrom, axisFrom, stepsFrom, tidy, MATRIX_TEMPLATES, SCALE_KEYS, type UpdateMatrixArgs, type MatrixSpec, type AxisSpec, type AxisPatch } from './matrix'
export { updateTable, tableSetupFrom, rulesFrom, columnFrom, TABLE_TEMPLATES, type UpdateTableArgs, type TableSpec, type RuleSpec, type ColumnSpec } from './table'
export { axisAdd, axisRemove, axisUpdate, updateCell, criterionCascade, type AxisAddArgs, type AxisRemoveArgs, type AxisUpdateArgs, type UpdateCellArgs } from './lens'
// Task, deck and timeline ops (S8): create_task, update_task, move_task; update_deck (D-300's tasks_to), the column ops,
// update_timeline; create_piece takes a typed deck; delete takes tasks and deck columns; create_evidence from_task.
export { createTask, updateTask, moveTask, deleteTasksPlan, deckIn, columnIn, ordersIn, type CreateTaskArgs, type UpdateTaskArgs, type MoveTaskArgs, type TaskInput, type TaskMoveSpec } from './tasks'
export { updateDeck, createDeckColumn, updateDeckColumn, moveDeckColumn, deleteColumnPlan, columnById, deckSetupFrom, movesTo, updateTimeline, DECK_TEMPLATES, type UpdateDeckArgs, type DeckSpec, type CreateDeckColumnArgs, type UpdateDeckColumnArgs, type MoveDeckColumnArgs, type UpdateTimelineArgs } from './deck'
