// The ops' one door to Firebase (S3, D-312): plans written as one undo step. Everything else in src/ops/ is pure (the
// purity test, tests/unit/purity.test.ts, lets only this file reach data/ and Firebase).
import { deleteField, doc, writeBatch, type DocumentReference } from 'firebase/firestore'
import { db, firebase } from '../data/firebase'
import { tracked, useHistory, writable } from '../data/history'
import { getWs, type WorkspaceCtx } from '../state/wsStore'
import { validate } from './validate'
import { isDelete, OpsRefused, type OpActor, type Plan, type Write } from './types'

const BATCH_LIMIT = 450

export function refOf(wid: string, w: Pick<Write, 'coll' | 'id'>): DocumentReference {
  return w.coll === 'workspace' ? doc(db(), 'workspaces', wid) : doc(db(), 'workspaces', wid, w.coll, w.id)
}

// DELETE as Firestore's deleteField(), in a patch's values and a merged set's maps.
const forFirestore = (o: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, isDelete(v) ? deleteField() : v && typeof v === 'object' && !Array.isArray(v) ? forFirestore(v as Record<string, unknown>) : v]))

// The signed-in person and their role here (when the caller doesn't say).
function signedIn(ws: WorkspaceCtx): OpActor {
  const uid = firebase?.auth.currentUser?.uid ?? ''
  return { uid, role: ws.workspace.roles?.[uid] ?? 'viewer' }
}

export type ApplyOpts = {
  // Who made the change: agent writes say so (onTracked's `actor`).
  actor?: 'person' | 'agent'
  // The undo/toast text; else the plans' labels joined.
  label?: string
  // The snapshot the plans were made on; else the workspace shown (getWs()).
  ws?: WorkspaceCtx
  // Who's writing and their role; else the signed-in person.
  by?: OpActor
}

export type Applied = {
  // Every plan's new ids by handle.
  ids: Record<string, string>
  // The undo step (its unique key and label); null when writes are refused right now (a preview, a viewer: writable()).
  step: { key: string; label: string } | null
  // Resolves once the server has the writes (like tracked()'s promise); rejects if it refused them (the step is gone).
  written: Promise<void>
}

let count = 0

// Validates (throws OpsRefused with validate's errors), then writes every plan as ONE tracked step: its refs are every
// doc written, its key unique (so it never merges with typing or another apply). Resolves once the step is recorded
// and the writes are issued locally (the listeners already show them); `written` waits for the server.
export async function apply(wid: string, plans: Plan[], opts: ApplyOpts = {}): Promise<Applied> {
  const ws = opts.ws ?? getWs()
  if (!ws || ws.wid !== wid) throw new Error(`apply: no snapshot of workspace ${wid}`)
  const verdict = validate(plans, ws, opts.by ?? signedIn(ws))
  if (!verdict.ok) throw new OpsRefused(verdict.errors)
  const ids = Object.assign({}, ...plans.map((p) => p.ids)) as Record<string, string>
  if (!writable()) return { ids, step: null, written: Promise.resolve() }

  // Each doc once, in the order first written.
  const writes = plans.flatMap((p) => p.writes)
  const refs = new Map<string, DocumentReference>()
  const docIds: string[] = []
  for (const w of writes) {
    const r = refOf(wid, w)
    if (!refs.has(r.path)) (refs.set(r.path, r), docIds.push(w.id))
  }
  // Before: nothing for what the plans make (no read); the rest read by tracked itself, in its queue, after the writes
  // queued before this one.
  const created = [...new Set(Object.values(ids))]
  const made = new Set(created)
  const absentRefs = [...refs.values()].filter((r) => made.has(r.id))

  const key = `ops:${++count}:${Date.now()}`
  const label = opts.label ?? plans.map((p) => p.label).join(', ')
  // A kind only when every plan says the same one.
  const kinds = [...new Set(plans.map((p) => p.meta?.kind))]
  const meta = {
    op: plans.map((p) => p.op).join(','),
    ops: plans.map((p) => p.op),
    ids: [...new Set([...docIds, ...plans.flatMap((p) => p.meta?.ids ?? [])])],
    created,
    ...(kinds.length === 1 && kinds[0] ? { kind: kinds[0] } : {}),
    actor: opts.actor ?? 'person',
  }
  // Every batch issued at once (they apply to the local cache at once, so the step's `after` sees them all).
  const write = () => {
    const commits: Promise<void>[] = []
    for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db())
      for (const w of writes.slice(i, i + BATCH_LIMIT)) {
        const r = refOf(wid, w)
        if (w.del) batch.delete(r)
        else if (w.set && w.merge) batch.set(r, forFirestore(w.set), { merge: true })
        else if (w.set) batch.set(r, w.set)
        else if (w.patch) batch.update(r, forFirestore(w.patch))
      }
      commits.push(batch.commit())
    }
    return Promise.all(commits)
  }

  let off = () => {}
  let stepped = false
  const recorded = new Promise<void>((resolve) => {
    off = useHistory.subscribe((h) => {
      if (h.past.some((s) => s.key === key)) ((stepped = true), resolve())
    })
  })
  const written = tracked(label, [...refs.values()], write, { absent: absentRefs, key, meta }).then(() => {})
  written.catch(() => {})
  try {
    await Promise.race([recorded, written])
  } finally {
    off()
  }
  // Writes were refused between the check above and tracked's (writable() flipped): nothing was written.
  if (!stepped) return { ids, step: null, written }
  return { ids, step: { key, label }, written }
}
