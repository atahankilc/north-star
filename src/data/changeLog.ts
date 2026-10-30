// The change log in the browser (S16, D-312; docs/specs/agent.md §4.9 layer 6; the shape in src/model/changeLog.ts):
// one entry per recorded write, `workspaces/{wid}/changes/{id}` = { by, at, kinds, ids, op?, actor }, NO text.
//
// No free text by accident (src/model/changeLog.ts): ids, collection names and the registry's op names only.
//
// WRITTEN, best-effort, outside the undo history: history.ts' onTracked tells us after each tracked write is recorded;
// the docs it touched are read off the step it made or merged (its refs), never its content. Writes of one burst
// (typing in a field, a drag: the same step merged again) become one entry, sent once the burst has been quiet for a
// moment or another step starts. The entry is a plain `addDoc`, not a tracked() step, so it is never undone, never
// merges into anyone's step and onTracked's listeners (onboarding's checks) never see it. A refused or failed write
// is dropped silently: the log is a help, never in the way. Skipped: the demo realm (no Firestore), a viewer (the
// rules refuse it), and when turned off (`setChangeLogOn(false)`, kept in this browser).
//
// READ by the agent: the newest entries, live, with the people's names for whats_new (agentStore's snapshot).
import { addDoc, collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, firebase, isDemo } from './firebase'
import { onTracked, useHistory, type TrackedMeta } from './history'
import { getRealWs } from '../state/wsStore'
import { changeEntry, fromChangeDoc, mergeEntries, toChangeDoc, type ChangeEntry } from '../model/changeLog'
import { REGISTRY } from '../ops/registry'

const OPS: ReadonlySet<string> = new Set(REGISTRY.keys())

export type { ChangeEntry } from '../model/changeLog'

const OFF_KEY = 'northstar.changeLog.off'
const QUIET_MS = 2500

let on = typeof localStorage === 'undefined' || localStorage.getItem(OFF_KEY) !== '1'
export const changeLogOn = () => on
export function setChangeLogOn(v: boolean) {
  on = v
  try {
    if (v) localStorage.removeItem(OFF_KEY)
    else localStorage.setItem(OFF_KEY, '1')
  } catch {
    // Storage refused: on for this tab only.
  }
  if (!v) pending = null
}

// The entry being gathered for the current step (its key, or the step object when it has none), and its workspace.
let pending: { wid: string; step: unknown; entry: ChangeEntry; timer: ReturnType<typeof setTimeout> | null } | null = null

// What a path names: `workspaces/<wid>/<coll>/<id>`, a document's body as the document, the workspace doc itself.
function touchedOf(paths: string[]): { coll: string; id: string }[] {
  return paths.flatMap((p) => {
    const s = p.split('/')
    if (s.length === 2) return [{ coll: 'workspace', id: s[1] }]
    if (s.length === 4) return [{ coll: s[2], id: s[3] }]
    if (s.length === 6 && s[2] === 'documents') return [{ coll: 'documents', id: s[3] }]
    return []
  })
}

function send(p: NonNullable<typeof pending>) {
  if (p.timer) clearTimeout(p.timer)
  if (pending === p) pending = null
  if (!on || !firebase) return
  void addDoc(collection(db(), 'workspaces', p.wid, 'changes'), toChangeDoc(p.entry)).catch(() => {})
}

function told(_label: string, meta?: TrackedMeta) {
  if (!on || !firebase || isDemo) return
  const h = useHistory.getState()
  const step = h.past[h.past.length - 1]
  const wid = h.wid
  const ws = getRealWs()
  const uid = firebase.auth.currentUser?.uid
  if (!step || !wid || !uid || !ws || ws.wid !== wid) return
  const role = ws.workspace.roles?.[uid]
  if (role !== 'owner' && role !== 'editor') return
  const entry = changeEntry({ by: uid, at: Date.now(), touched: touchedOf(step.before.map((b) => b.ref.path)), ...(meta?.op ? { op: meta.op } : {}), actor: meta?.actor ?? 'person', knownOps: OPS })
  if (!entry) return
  const id = step.key ?? step
  if (pending && pending.wid === wid && pending.step === id) {
    pending.entry = mergeEntries(pending.entry, entry)
    if (pending.timer) clearTimeout(pending.timer)
  } else {
    if (pending) send(pending)
    pending = { wid, step: id, entry, timer: null }
  }
  const p = pending!
  p.timer = setTimeout(() => send(p), QUIET_MS)
}

let started = false
// Starts writing the log (once per tab; the agent's store calls it when it loads).
export function startChangeLog() {
  if (started) return
  started = true
  onTracked(told)
  // A burst still gathering when the tab goes away is sent now.
  if (typeof window !== 'undefined') window.addEventListener('pagehide', () => pending && send(pending))
}

// The newest entries, live (newest first); `cb([])` when it can't be read.
export function watchChanges(wid: string, cb: (list: ChangeEntry[]) => void, max = 300): () => void {
  if (!firebase || isDemo) return () => {}
  return onSnapshot(
    query(collection(db(), 'workspaces', wid, 'changes'), orderBy('at', 'desc'), limit(max)),
    (snap) => cb(snap.docs.flatMap((d) => fromChangeDoc(d.id, d.data()) ?? [])),
    () => cb([]),
  )
}

// The people's names (members/{uid}) for whats_new, live; the first 200 by name.
export function watchMembers(wid: string, cb: (list: { uid: string; name: string; email?: string }[]) => void): () => void {
  if (!firebase || isDemo) return () => {}
  return onSnapshot(
    query(collection(db(), 'workspaces', wid, 'members'), orderBy('name'), limit(200)),
    (snap) => cb(snap.docs.map((d) => ({ uid: d.id, name: String(d.data().name ?? ''), ...(d.data().email ? { email: String(d.data().email) } : {}) }))),
    () => cb([]),
  )
}
