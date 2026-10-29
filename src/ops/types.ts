// The ops layer's words (S3, D-312, docs/specs/agent.md §4.5, §5 R2/R4–R6): an op turns arguments and a snapshot of
// the workspace into a plan of writes in data terms; `validate` checks plans, `project` plays them onto a copy, `diff`
// says what they change, and `apply` (firestore.ts, the one file here that talks to Firebase) writes them as one undo
// step. Nothing here reads the screen, the signed-in user or a module global: everything comes from the OpCtx.
import type { WorkspaceCtx } from '../state/wsStore'
import type { Role } from '../data/model'
import type { WsCollection } from '../model/fromDocs'

// The workspace's subcollections as Firestore names them, and `workspace`: the workspace doc itself (id = the
// workspace's id; only `name` and `description` are ever written, history.ts tracks only those).
export type Coll = WsCollection | 'workspace'

// A field taken away in a patch (Firestore's deleteField(), which apply puts in its place). A plain object, so plans
// stay plain data (a preview, a test, the model can hold them).
export const DELETE = Object.freeze({ $delete: true as const })
export type Delete = typeof DELETE
export const isDelete = (v: unknown): v is Delete => !!v && typeof v === 'object' && (v as { $delete?: unknown }).$delete === true && Object.keys(v).length === 1

// One write: a whole doc (`set`, replacing what's there; with `merge`, Firestore's set-merge: its fields merged into
// what's there, maps field by field, made if missing, DELETE allowed), some fields (`patch`: top-level names or dotted
// paths, as Firestore's update takes them; DELETE takes one away; the doc must exist) or a delete. Exactly one of the
// three.
export type Write = {
  coll: Coll
  id: string
  set?: Record<string, unknown>
  merge?: true
  patch?: Record<string, unknown>
  del?: true
}

// What an op makes: its writes, the undo/toast text, and the ids it gave new things by handle (`$a` → the id), so a
// later op in the same batch (and the model) can name them.
export type Plan = {
  // The op's name, snake_case as in docs/specs/agent-actions.md (`create_card`, `link`, …).
  op: string
  label: string
  writes: Write[]
  ids: Record<string, string>
  meta?: { kind?: string; ids?: string[] }
}

// Who's acting: the signed-in person (uid and role in this workspace), `agent` when the agent acts for them.
export type OpActor = { uid: string; role: Role; agent?: boolean }

export type OpCtx = {
  ws: WorkspaceCtx
  actor: OpActor
  now: number
  newId: () => string
}

// What validate says is wrong with a plan, and how to put it right (written for the model as much as for people).
export type OpError = { op: string; message: string; fix: string }
export type Verdict = { ok: true } | { ok: false; errors: OpError[] }

// Thrown by apply when validate refuses the plans; `errors` as validate gave them.
export class OpsRefused extends Error {
  constructor(public errors: OpError[]) {
    super(errors.map((e) => `${e.op}: ${e.message}`).join('; '))
  }
}
