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
