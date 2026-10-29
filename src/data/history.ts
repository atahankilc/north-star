// Undo and redo (Q-013): every tracked write snapshots the documents it touches before and after, so undo
// and redo just put a snapshot back. Local to this tab and workspace; last write wins against collaborators.
import { deleteDoc, getDoc, getDocFromCache, writeBatch, type DocumentData, type DocumentReference } from 'firebase/firestore'
import { create } from 'zustand'
import { db } from './firebase'

type Snapshot = { ref: DocumentReference; data: DocumentData | null }[]

type Step = {
  label: string
  before: Snapshot
  after: Snapshot
  // Consecutive steps with the same key (typing in one field, one drag) merge into one.
  key?: string
  at: number
}

const MERGE_WITHIN_MS = 2000
const MAX_STEPS = 100
const BATCH_LIMIT = 450

type History = {
  wid: string | null
  past: Step[]
  future: Step[]
  // Last thing done, undone or redone, for the toast.
  // `action`: one thing to do from it, a button on the toast (`go there`, D-302's session 2).
  notice: { text: string; at: number; action?: Action } | null
  reset: (wid: string) => void
  say: (text: string, action?: Action) => void
}

export type Action = { label: string; run: () => void }

export const useHistory = create<History>((set, get) => ({
  wid: null,
  past: [],
  future: [],
  notice: null,
  reset: (wid) => {
    if (get().wid !== wid) set({ wid, past: [], future: [], notice: null })
  },
  say: (text, action) => set({ notice: { text, at: Date.now(), action } }),
}))

async function read(ref: DocumentReference): Promise<DocumentData | null> {
  let data: DocumentData | null
  try {
    // Every workspace collection has a live listener, so the cache is current.
    const snap = await getDocFromCache(ref)
    data = snap.exists() ? snap.data() : null
  } catch {
    const snap = await getDoc(ref)
    data = snap.exists() ? snap.data() : null
  }
  return data && isWorkspaceDoc(ref) ? { name: data.name, description: data.description ?? '' } : data
}

// The workspace document itself (the assistant's update_project, D-120): only its name and description are tracked, and
// put back merged, so an undo never touches its people, roles or codes.
const isWorkspaceDoc = (ref: DocumentReference) => ref.path.split('/').length === 2

// Refs read as `snapshot` does, except those known not to exist yet.
async function snapshotBut(refs: DocumentReference[], absent: DocumentReference[]): Promise<Snapshot> {
  const none = new Set(absent.map((r) => r.path))
  return Promise.all(refs.map(async (ref) => ({ ref, data: none.has(ref.path) ? null : await read(ref) })))
}

const snapshot = (refs: DocumentReference[]) => Promise.all(refs.map(async (ref) => ({ ref, data: await read(ref) })))

// Issues the batches without waiting for the server (they apply locally at once), so undo works offline too.
function restore(snap: Snapshot): Promise<unknown> {
  const commits: Promise<void>[] = []
  for (let i = 0; i < snap.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db())
    for (const { ref, data } of snap.slice(i, i + BATCH_LIMIT)) {
      if (data) batch.set(ref, data, { merge: isWorkspaceDoc(ref) })
      else if (!isWorkspaceDoc(ref)) batch.delete(ref)
    }
    commits.push(batch.commit())
  }
  return Promise.all(commits)
}

type Options = {
  // Pass what's known instead of reading it (e.g. `null` for a document about to be created).
  before?: Snapshot
  // Without `before`: these refs are known not to exist yet (made by this write), the others are read as usual, in
  // turn, after the writes queued before this one (the ops' apply, S3).
  absent?: DocumentReference[]
  key?: string
  // Wait for the server before reading the result: for writes that are several dependent steps (cascading deletes).
  settle?: boolean
  // Merge into the previous step with the same key however long ago it was (e.g. a label's first text into its creation).
  mergeAlways?: boolean
  // What it was, for whoever listens (`onTracked`): onboarding's checks, the agent's "what changed".
  meta?: TrackedMeta
}

// What a recorded write was (S3, D-312), for ops (src/ops/firestore.ts): `op` its ops' names comma-joined and `ops` the
// list, `ids` every doc it wrote (made, changed, deleted) and `created` the ones it made, `actor` who did it. A UI write
// says what it passes (`kind`, `ids`).
export type TrackedMeta = { kind?: string; ids?: string[]; op?: string; ops?: string[]; created?: string[]; actor?: 'person' | 'agent' }

// Told after every tracked write is recorded (its step pushed or merged), UI writes and ops alike: when the write is
// recorded locally, before the server confirms it (a write the server then refuses was still told). `meta` is what the
// write passed (undefined when it passed none). Returns the function that stops it.
const trackedListeners = new Set<(label: string, meta?: TrackedMeta) => void>()
export function onTracked(fn: (label: string, meta?: TrackedMeta) => void): () => void {
  trackedListeners.add(fn)
  return () => void trackedListeners.delete(fn)
}

// Tracked writes, undo and redo run one at a time, so snapshots and the stack never interleave. Firestore applies
// each write to its local cache in call order, so reading the cache right after issuing a write sees it; nothing
// in the queue waits for the server, and editing keeps working offline.
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn)
  queue = run.catch(() => {})
  return run
}

// Runs `write` and records it as one undoable step.
// Resolves once the write is confirmed, like the Firestore call it wraps.
// Set while the workspace on screen isn't the real one (the assistant's preview, D-087), or while you only view it (a
// viewer, D-098): every tracked write, undo and redo is refused with the message instead. One reason per `key`, so the
// preview closing doesn't unlock a viewer.
const readOnly = new Map<string, string>()
export const setReadOnly = (why: string | null, key = 'preview') => {
  if (why) readOnly.set(key, why)
  else readOnly.delete(key)
}
// False (and says why) while writes are refused.
export function writable(): boolean {
  const why = [...readOnly.values()][0]
  if (why) useHistory.getState().say(why)
  return !why
}

export function tracked(label: string, refs: DocumentReference[], write: () => Promise<unknown>, opts: Options = {}) {
  if (!writable()) return Promise.resolve()
  return serial(() => record(label, refs, write, opts)).then(({ pending }) => pending)
}

async function record(label: string, refs: DocumentReference[], write: () => Promise<unknown>, opts: Options) {
  const before = opts.before ?? (opts.absent ? await snapshotBut(refs, opts.absent) : await snapshot(refs))
  const pending = write()
  if (opts.settle) await pending
  const after = await snapshot(refs)
  const { past } = useHistory.getState()
  const last = past[past.length - 1]
  const now = Date.now()
  let step: Step
  if (opts.key && last?.key === opts.key && (opts.mergeAlways || now - last.at < MERGE_WITHIN_MS)) {
    // Docs this write touched that the step didn't hold yet (the agent's auto-apply: several batches in one turn, S13)
    // join it: their before (read above, before this write) added to the step's own before IN PLACE (its identity is
    // how onboarding tells a merged step), and after read for all of them. Same docs (typing, a drag): nothing joins.
    // Docs the step holds that this write didn't touch are read for `after` too, so a redo puts every doc back.
    const held = new Set(last.before.map((b) => b.ref.path))
    const extra = before.filter((b) => !held.has(b.ref.path))
    if (extra.length) last.before.push(...extra)
    const mine = new Set(after.map((a) => a.ref.path))
    const rest = last.before.map((b) => b.ref).filter((r) => !mine.has(r.path))
    if (rest.length) after.unshift(...(await snapshot(rest)))
    step = { ...last, after, at: now }
    useHistory.setState({ past: [...past.slice(0, -1), step], future: [] })
  } else {
    step = { label, before, after, key: opts.key, at: now }
    useHistory.setState({ past: [...past, step].slice(-MAX_STEPS), future: [] })
  }
  for (const fn of [...trackedListeners]) {
    try {
      fn(label, opts.meta)
    } catch {
      // A listener's mistake never breaks the write.
    }
  }
  // A write the server refuses never happened: forget it, and let the caller see the error.
  pending.catch(() => useHistory.setState((h) => ({ past: h.past.filter((p) => p !== step) })))
  // Wrapped: returning the promise itself would make the queue wait for the server.
  return { pending }
}

// Something just made and let go before it had a name (Escape, or Enter with nothing typed): it goes, and so do its
// steps (`key`, which its making and naming share), as if it was never made. Nothing is left to undo or redo.
export function discardNew(ref: DocumentReference, key: string) {
  if (!writable()) return Promise.resolve()
  return serial(async () => {
    const pending = deleteDoc(ref)
    useHistory.setState((h) => ({ past: h.past.filter((p) => p.key !== key) }))
    return { pending }
  }).then(({ pending }) => pending)
}

export const absent = (refs: DocumentReference[]): Snapshot => refs.map((ref) => ({ ref, data: null }))

// The document as it is now, with some fields as they were (e.g. a card's position before a drag).
export async function snapshotWith(ref: DocumentReference, fields: DocumentData): Promise<Snapshot> {
  const data = await read(ref)
  return [{ ref, data: data && { ...data, ...fields } }]
}

export const undo = () => (writable() ? serial(undoNow) : Promise.resolve())
export const redo = () => (writable() ? serial(redoNow) : Promise.resolve())

async function undoNow() {
  const { past, future, say } = useHistory.getState()
  const step = past[past.length - 1]
  if (!step) return say('Nothing to undo')
  useHistory.setState({ past: past.slice(0, -1), future: [step, ...future] })
  say(`Undid ${step.label}`)
  restore(step.before).catch(() => say(`Couldn't undo ${step.label}`))
}

async function redoNow() {
  const { past, future, say } = useHistory.getState()
  const step = future[0]
  if (!step) return say('Nothing to redo')
  useHistory.setState({ past: [...past, step], future: future.slice(1) })
  say(`Redid ${step.label}`)
  restore(step.after).catch(() => say(`Couldn't redo ${step.label}`))
}
