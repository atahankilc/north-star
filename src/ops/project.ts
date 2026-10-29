// Plans played onto a copy of the workspace (S3, docs/specs/agent.md §4.5 point 2): the same writes apply sends, turned
// into items by the same converters the listeners run, so a preview shows exactly what applying would. How: docs.ts.
import { fromDocs } from '../model/fromDocs'
import type { Workspace } from '../data/model'
import type { WithId } from '../data/hooks'
import type { WorkspaceCtx } from '../state/wsStore'
import { docsOf, toDocs, writeTo } from './docs'
import type { Plan } from './types'

// The workspace as it would be with the plans written, in order. Throws (WriteError) on a write Firestore would refuse
// (a patch on a doc that isn't there): run validate first. What no write touched keeps its objects.
export function project(ws: WorkspaceCtx, plans: Plan[]): WorkspaceCtx {
  const store = toDocs(ws)
  for (const p of plans) for (const w of p.writes) writeTo(store, w)
  const data = fromDocs(docsOf(store), ws.documents)
  const workspace = store.get('workspace')!.get(ws.wid) as unknown as WithId<Workspace>
  return { ...ws, ...data, workspace }
}
