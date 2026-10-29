// The ops' one door to Firebase (S3, D-312): plans written as one undo step. Everything else in src/ops/ is pure (the
// purity test, tests/unit/purity.test.ts, lets only this file reach data/ and Firebase).
import { deleteField, doc, writeBatch, type DocumentReference } from 'firebase/firestore'
import { db, firebase } from '../data/firebase'
import { tracked, useHistory, writable } from '../data/history'
import { getWs, subscribeWs, type WorkspaceCtx } from '../state/wsStore'
import { validate } from './validate'
import { projectLoose } from './project'
import { docAt, toDocs, type DocStore } from './docs'
import { autoId } from './newId'
import { isDelete, OpsRefused, type OpActor, type OpCtx, type Plan, type Write } from './types'

const BATCH_LIMIT = 450

export function refOf(wid: string, w: Pick<Write, 'coll' | 'id'>): DocumentReference {
  return w.coll === 'workspace' ? doc(db(), 'workspaces', wid) : doc(db(), 'workspaces', wid, w.coll, w.id)
}

// DELETE as Firestore's deleteField(), in a patch's values and a merged set's maps.
export const forFirestore = (o: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, isDelete(v) ? deleteField() : v && typeof v === 'object' && !Array.isArray(v) ? forFirestore(v as Record<string, unknown>) : v]))

// The signed-in person and their role here (when the caller doesn't say).
function signedIn(ws: WorkspaceCtx): OpActor {
  const user = firebase?.auth.currentUser
  const uid = user?.uid ?? ''
  const name = user?.displayName || user?.email || undefined
  return { uid, role: ws.workspace.roles?.[uid] ?? 'viewer', ...(name ? { name } : {}) }
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
  // For the UI's own writes (S4: data/ functions wrapping ops), tracked()'s options as they passed them: `key` makes
  // consecutive applies with the same key one undo step (typing in a field; a card's making and naming); `mergeAlways`
  // merges into the last step with that key however long ago; `settle` waits for the server before reading "after".
  // Without a key the step's key is unique (it never merges).
  key?: string
  mergeAlways?: boolean
  settle?: boolean
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
  // Nothing to write (an arrange where everything already is): no step, nothing to undo (S9).
  if (!writes.length) return { ids, step: null, written: Promise.resolve() }
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

  const key = opts.key ?? `ops:${++count}:${Date.now()}`
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

  // Recorded: a step with the key that wasn't there before (a merge makes a new step object with the same key).
  const had = new Set(useHistory.getState().past.filter((s) => s.key === key))
  let off = () => {}
  let stepped = false
  const recorded = new Promise<void>((resolve) => {
    off = useHistory.subscribe((h) => {
      if (h.past.some((s) => s.key === key && !had.has(s))) ((stepped = true), resolve())
    })
  })
  const written = tracked(label, [...refs.values()], write, { absent: absentRefs, key, meta, mergeAlways: opts.mergeAlways, settle: opts.settle }).then(() => {})
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

// ---- The UI's writes through ops (S4): data/ functions build plans with these and apply them, keeping their old
// signatures, labels, undo keys and toasts.

// The workspace `wid` as the listeners last gave it (getWs()), null when another one (or none) is shown. The one seam
// for "the workspace as it is now": the agent's ctx and S15's preview read this, never the UI's overlay below.
export function freshWs(wid: string): WorkspaceCtx | null {
  const live = getWs()
  return live && live.wid === wid ? live : null
}

// UI-only: plans the UI applied a moment ago whose echo the snapshot may not show yet (getWs() follows React's render),
// played again on top of it in uiCtx, so a write made right after another (a card made, then named or linked) sees
// the first. The agent's context and the preview must never read this (they use freshWs()). An entry retires the first
// time the live store shows all its writes, when it's refused or its step isn't recorded, and after 3 s at the latest;
// every undo, redo or discard clears them all (what they replay may no longer be true).
type Recent = { wid: string; plans: Plan[]; until: number }
const recent: Recent[] = []
const CAP_MS = 3000
let unwatch: (() => void) | null = null

function drop(r: Recent) {
  const i = recent.indexOf(r)
  if (i >= 0) recent.splice(i, 1)
  if (!recent.length && unwatch) (unwatch(), (unwatch = null))
}

// Forgets every recent write (undo, redo, a discard).
export function forgetRecent() {
  recent.length = 0
  if (unwatch) (unwatch(), (unwatch = null))
}

// Recent writes the UI's overlay holds (tests).
export const recentCount = () => recent.length

useHistory.subscribe((h, prev) => {
  const redo = h.future.length < prev.future.length && prev.future.length > 0 && h.past[h.past.length - 1] === prev.future[0]
  if (h.wid !== prev.wid || h.past.length < prev.past.length || redo) forgetRecent()
})

const deepSame = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => deepSame((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}
const at = (d: Record<string, unknown>, path: string) => path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), d)
// Times aren't in every item (a card's), so they don't count.
const TIMES = new Set(['createdAt', 'updatedAt'])

// Whether the store shows a write: a set's doc there with its fields, a delete's doc gone, a patch's fields as written.
function shows(store: DocStore, w: Write): boolean {
  const d = docAt(store, w.coll, w.id)
  if (w.del) return !d
  if (!d) return false
  if (w.set && w.merge) return true
  const fields = w.set ?? w.patch ?? {}
  return Object.entries(fields).every(([k, v]) => TIMES.has(k) || (isDelete(v) ? at(d, k) === undefined : deepSame(at(d, k), v)))
}

function retire(wid: string) {
  const now = Date.now()
  const live = freshWs(wid)
  let store: DocStore | null = null
  for (const r of [...recent]) {
    if (r.wid !== wid || r.until < now || !live) {
      drop(r)
      continue
    }
    store ??= toDocs(live)
    if (r.plans.every((p) => p.writes.every((w) => shows(store!, w)))) drop(r)
  }
}

function watch() {
  unwatch ??= subscribeWs(() => {
    const live = getWs()
    if (live) retire(live.wid)
    else forgetRecent()
  })
}

// The context a UI write builds its plans in: the workspace shown with the UI's recent writes on top, the signed-in
// person, now. Null when no workspace is shown (no UI write happens outside one).
export function uiCtx(wid: string): OpCtx | null {
  const live = freshWs(wid)
  if (!live) {
    console.error(`ops: no snapshot of workspace ${wid}; the write is dropped`)
    return null
  }
  retire(wid)
  const ws = projectLoose(live, recent.filter((r) => r.wid === wid).flatMap((r) => r.plans))
  return { ws, actor: signedIn(ws), now: Date.now(), newId: () => autoId() }
}

export type UiOpts = Pick<ApplyOpts, 'label' | 'key' | 'mergeAlways' | 'settle'>

// Applies plans built in `ctx` as the signed-in person; null when they write nothing or validate refuses them (said in
// the toast).
export function applyUi(wid: string, ctx: OpCtx, plans: Plan[], opts: UiOpts = {}): Promise<Applied | null> {
  if (!plans.some((p) => p.writes.length)) return Promise.resolve(null)
  // Refused right now (a viewer, a preview, the demo): said as tracked() said it, nothing checked or written.
  if (!writable()) return Promise.resolve(null)
  const entry: Recent = { wid, plans, until: Date.now() + CAP_MS }
  recent.push(entry)
  watch()
  // Refused by validate: said in the toast and resolved with null (nothing written), so `void` callers never leave an
  // unhandled rejection; a write the server refuses still rejects `written`, as before.
  return apply(wid, plans, { ...opts, ws: ctx.ws, by: ctx.actor, actor: 'person' }).then(
    (a) => {
      if (!a.step) drop(entry)
      else a.written.catch(() => drop(entry))
      return a
    },
    (e) => {
      drop(entry)
      if (!(e instanceof OpsRefused)) throw e
      useHistory.getState().say(`Couldn't ${opts.label ?? plans.map((x) => x.label).join(', ')}: ${e.errors[0]?.message ?? 'refused'}`)
      return null
    },
  )
}

// The promise a UI write gave before (S4 keeps it): resolved once the server has the write.
export const serverHas = (p: Promise<Applied | null>): Promise<void> => p.then((a) => a?.written)

// A plan the builder refused (what it names isn't there): said in the toast, as a refused write was; anything else is
// thrown on.
export function sayRefused(e: unknown, label: string) {
  if (!(e instanceof OpsRefused)) throw e
  useHistory.getState().say(`Couldn't ${label}: ${e.errors[0]?.message ?? 'refused'}`)
}

// A UI write in one call: plans built in the UI's context and applied; resolves once the server has them (as tracked()
// did), at once when nothing is written. A builder's refusal is said in the toast and resolves (nothing written).
export function runUi(wid: string, make: (ctx: OpCtx) => Plan[], opts: UiOpts & { label?: string } = {}): Promise<void> {
  const ctx = uiCtx(wid)
  if (!ctx) return Promise.resolve()
  let plans: Plan[]
  try {
    plans = make(ctx)
  } catch (e) {
    sayRefused(e, opts.label ?? 'do that')
    return Promise.resolve()
  }
  return serverHas(applyUi(wid, ctx, plans, opts))
}

// Of `ids`, those the UI's snapshot holds (a collaborator may have deleted one a moment ago): a UI delete takes the
// rest, as it always did. The ops themselves refuse a missing id (the agent should hear of it).
export function present(ctx: OpCtx, ids: string[]): string[] {
  const ws = ctx.ws
  const all = new Set<string>([...ws.cards, ...ws.labels, ...ws.edges, ...ws.evidence, ...ws.competitorFeatures, ...ws.comparisons].map((x) => x.id))
  return ids.filter((id) => all.has(id))
}
