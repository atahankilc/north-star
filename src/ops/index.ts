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
