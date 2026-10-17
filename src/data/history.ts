// Undo and redo (Q-013): every tracked write snapshots the documents it touches before and after, so undo
// and redo just put a snapshot back. Local to this tab and workspace; last write wins against collaborators.
import { doc, getDoc, getDocFromCache, writeBatch, type DocumentData, type DocumentReference } from 'firebase/firestore'
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
  notice: { text: string; at: number } | null
  reset: (wid: string) => void
  say: (text: string) => void
}

export const useHistory = create<History>((set, get) => ({
  wid: null,
  past: [],
  future: [],
  notice: null,
  reset: (wid) => {
    if (get().wid !== wid) set({ wid, past: [], future: [], notice: null })
  },
  say: (text) => set({ notice: { text, at: Date.now() } }),
}))

async function read(ref: DocumentReference): Promise<DocumentData | null> {
  try {
    // Every workspace collection has a live listener, so the cache is current.
    const snap = await getDocFromCache(ref)
    return snap.exists() ? snap.data() : null
  } catch {
    const snap = await getDoc(ref)
    return snap.exists() ? snap.data() : null
  }
}

const snapshot = (refs: DocumentReference[]) => Promise.all(refs.map(async (ref) => ({ ref, data: await read(ref) })))

// Issues the batches without waiting for the server (they apply locally at once), so undo works offline too.
function restore(snap: Snapshot): Promise<unknown> {
  const commits: Promise<void>[] = []
  for (let i = 0; i < snap.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db())
    for (const { ref, data } of snap.slice(i, i + BATCH_LIMIT)) {
      if (data) batch.set(ref, data)
      else batch.delete(ref)
    }
    commits.push(batch.commit())
  }
  return Promise.all(commits)
}

type Options = {
  // Pass what's known instead of reading it (e.g. `null` for a document about to be created).
  before?: Snapshot
  key?: string
  // Wait for the server before reading the result: for writes that are several dependent steps (cascading deletes).
  settle?: boolean
  // Merge into the previous step with the same key however long ago it was (e.g. a label's first text into its creation).
  mergeAlways?: boolean
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
// Set while the workspace on screen isn't the real one (the assistant's preview, D-087): every tracked write, undo and
// redo is refused with this message instead.
let readOnly: string | null = null
export const setReadOnly = (why: string | null) => {
  readOnly = why
}
// False (and says why) while writes are refused.
export function writable(): boolean {
  if (readOnly) useHistory.getState().say(readOnly)
  return !readOnly
}

export function tracked(label: string, refs: DocumentReference[], write: () => Promise<unknown>, opts: Options = {}) {
  if (!writable()) return Promise.resolve()
  return serial(() => record(label, refs, write, opts)).then(({ pending }) => pending)
}

async function record(label: string, refs: DocumentReference[], write: () => Promise<unknown>, opts: Options) {
  const before = opts.before ?? (await snapshot(refs))
  const pending = write()
  if (opts.settle) await pending
  const after = await snapshot(refs)
  const { past } = useHistory.getState()
  const last = past[past.length - 1]
  const now = Date.now()
  let step: Step
  if (opts.key && last?.key === opts.key && (opts.mergeAlways || now - last.at < MERGE_WITHIN_MS)) {
    step = { ...last, after, at: now }
    useHistory.setState({ past: [...past.slice(0, -1), step], future: [] })
  } else {
    step = { label, before, after, key: opts.key, at: now }
    useHistory.setState({ past: [...past, step].slice(-MAX_STEPS), future: [] })
  }
  // A write the server refuses never happened: forget it, and let the caller see the error.
  pending.catch(() => useHistory.setState((h) => ({ past: h.past.filter((p) => p !== step) })))
  // Wrapped: returning the promise itself would make the queue wait for the server.
  return { pending }
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

export const workspaceDoc = (wid: string, collection: string, id: string) => doc(db(), 'workspaces', wid, collection, id)
