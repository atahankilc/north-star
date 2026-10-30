// Plans played onto a copy of the workspace (S3, docs/specs/agent.md §4.5 point 2): the same writes apply sends, turned
// into items by the same converters the listeners run, so a preview shows exactly what applying would. How: docs.ts.
import { fromDocs } from '../model/fromDocs'
import type { Workspace } from '../data/model'
import type { WithId } from '../data/hooks'
import type { WorkspaceCtx } from '../state/wsStore'
import { docsOf, toDocs, writeTo } from './docs'
import type { Plan } from './types'
import type { DocStore } from './docs'

// Documents and bodies as the store has them after the writes, only when a write touched them (else the snapshot's
// own arrays and maps stay, so nothing that reads them draws again). Order: the snapshot's (newest first), a new one
// in front.
function docsAfter(ws: WorkspaceCtx, store: DocStore, plans: Plan[]): Partial<WorkspaceCtx> & { bodies?: Record<string, unknown> } {
  const touched = plans.some((p) => p.writes.some((w) => w.coll === 'documents' || w.coll === 'docBodies'))
  if (!touched) return {}
  const docs = store.get('documents')!
  const had = new Set((ws.documents ?? []).map((d) => d.id))
  const fresh = [...docs.values()].filter((d) => !had.has(d.id))
  const kept = (ws.documents ?? []).flatMap((d) => (docs.has(d.id) ? [docs.get(d.id)!] : []))
  const bodies = Object.fromEntries([...store.get('docBodies')!.values()].map(({ id, ...b }) => [id, b]))
  return { documents: [...fresh, ...kept] as unknown as WorkspaceCtx['documents'], bodies }
}

// The workspace as it would be with the plans written, in order. Throws (WriteError) on a write Firestore would refuse
// (a patch on a doc that isn't there): run validate first. What no write touched keeps its objects.
export function project(ws: WorkspaceCtx, plans: Plan[]): WorkspaceCtx {
  const store = toDocs(ws)
  for (const p of plans) for (const w of p.writes) writeTo(store, w)
  const extra = docsAfter(ws, store, plans)
  const data = fromDocs(docsOf(store), extra.documents ?? ws.documents)
  const workspace = store.get('workspace')!.get(ws.wid) as unknown as WithId<Workspace>
  return { ...ws, ...data, ...extra, workspace }
}

// As `project`, but a write that can't apply (a patch on a doc that's gone) is skipped instead of thrown: for writes
// already sent whose echo the snapshot may or may not show yet (the UI adapter's recent writes, firestore.ts), played
// again on top. Sets, merges, patches and deletes all land the same when played twice.
export function projectLoose(ws: WorkspaceCtx, plans: Plan[]): WorkspaceCtx {
  if (!plans.length) return ws
  const store = toDocs(ws)
  for (const p of plans)
    for (const w of p.writes) {
      try {
        writeTo(store, w)
      } catch {
        // Gone meanwhile: nothing to replay.
      }
    }
  const extra = docsAfter(ws, store, plans)
  const data = fromDocs(docsOf(store), extra.documents ?? ws.documents)
  const workspace = store.get('workspace')!.get(ws.wid) as unknown as WithId<Workspace>
  return { ...ws, ...data, ...extra, workspace }
}
