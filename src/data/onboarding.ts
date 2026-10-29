// The onboarding's seen-state (D-315, docs/specs/onboarding.md §5.3): one person's own doc at
// `users/{uid}/private/onboarding`, readable and writable by them alone (firestore.rules), cached in this browser's
// localStorage so nothing flashes. Not workspace content: never `tracked()` (not undoable), never exported.
// If Firestore refuses (rules not deployed, offline, no Firebase as in the demo realm), it runs on localStorage alone
// and says nothing. Shape and merge: src/onboarding/seenMerge.ts.
import { doc, onSnapshot, setDoc, type DocumentSnapshot } from 'firebase/firestore'
import { firebase } from './firebase'
import { cleanSeenState, mergeSeenState, type SeenState } from '../onboarding/seenMerge'

const localKey = (uid: string) => `north-star:onboarding:${uid}`

const seenRef = (uid: string) => doc(firebase!.firestore, 'users', uid, 'private', 'onboarding')

export function readLocalSeen(uid: string): SeenState | null {
  try {
    const raw = localStorage.getItem(localKey(uid))
    return raw ? cleanSeenState(JSON.parse(raw)) : null
  } catch {
    // Storage blocked or a broken value: as if nothing was kept.
    return null
  }
}

// Merged with what's kept (another tab may have written since this one read), so a stale tab never writes old
// settings over newer ones. Returns what was kept: the caller shows that.
export function writeLocalSeen(uid: string, s: SeenState): SeenState {
  const kept = readLocalSeen(uid)
  const out = kept ? mergeSeenState(s, kept) : s
  try {
    localStorage.setItem(localKey(uid), JSON.stringify(out))
  } catch {
    // Not kept in this browser; Firestore still has it.
  }
  return out
}

// Another tab of this browser changed the kept copy (the `storage` event fires only in the other tabs).
export function watchLocalSeen(uid: string, fn: (s: SeenState) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const key = localKey(uid)
  const on = (e: StorageEvent) => {
    if (e.key !== key || !e.newValue) return
    const s = readLocalSeen(uid)
    if (s) fn(s)
  }
  window.addEventListener('storage', on)
  return () => window.removeEventListener('storage', on)
}

// `none`: the person has no doc (a new person, §5.2). `unavailable`: we can't tell (refused, offline, no Firebase, a
// doc we can't read as a seen-state), so the caller must not take it for `none` and must not write over a doc it never
// read.
export type RemoteSeen = { status: 'found'; state: SeenState } | { status: 'none' } | { status: 'unavailable' }

// One snapshot read as a RemoteSeen; null when it says nothing yet. Missing in the offline cache isn't missing on the
// server (production keeps a persistent cache), so that's `unavailable` until the server answers.
export function readSeenSnap(snap: DocumentSnapshot): RemoteSeen | null {
  // This tab's own write, not yet acknowledged: nothing new.
  if (snap.metadata.hasPendingWrites) return null
  if (!snap.exists()) return snap.metadata.fromCache ? { status: 'unavailable' } : { status: 'none' }
  const state = cleanSeenState(snap.data())
  return state ? { status: 'found', state } : { status: 'unavailable' }
}

const READ_TIMEOUT = 8000

// The person's doc while started: every change (another tab, another device) comes in, so this tab merges it before
// it writes. `fn` gets `unavailable` when nothing decisive came within READ_TIMEOUT or the listen was refused; a later
// snapshot (back online) still comes through.
export function watchRemoteSeen(uid: string, fn: (r: RemoteSeen) => void): () => void {
  if (!firebase) {
    fn({ status: 'unavailable' })
    return () => {}
  }
  let heard = false
  let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    timer = null
    if (!heard) fn({ status: 'unavailable' })
  }, READ_TIMEOUT)
  const clear = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  const unsub = onSnapshot(
    seenRef(uid),
    { includeMetadataChanges: true },
    (snap) => {
      const r = readSeenSnap(snap)
      if (!r) return
      // A cache miss waits for the server (or the timeout) rather than saying `unavailable` at once.
      if (r.status === 'unavailable' && !snap.exists()) return
      heard = true
      clear()
      fn(r)
    },
    () => {
      clear()
      fn({ status: 'unavailable' })
    },
  )
  return () => {
    clear()
    unsub()
  }
}

export type SeenWriter = {
  // The whole state to keep; the last one pushed within the gap is the one written.
  push(s: SeenState): void
  // Write what's waiting now.
  flush(): Promise<void>
  // No more writes: what's waiting goes now, the page listener goes, and the last write is returned (an offline
  // setDoc may never resolve, so don't wait on it for long).
  stop(): Promise<void>
}

// At most one Firestore write per GAP ms. Each write sends the whole (small) state with `merge: true`, so a field this
// tab doesn't know of is left alone and `seen`'s keys add to what's there; the state was merged with the latest
// snapshot first (watchRemoteSeen), so its `at` stamps are never older than the doc's. The first refusal turns writing
// off for the session: from then on it's localStorage alone.
const GAP = 2000

export function seenWriter(uid: string): SeenWriter {
  let pending: SeenState | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastWrite = 0
  let off = !firebase
  let inFlight: Promise<void> = Promise.resolve()

  const write = () => {
    if (timer) clearTimeout(timer)
    timer = null
    if (!pending || off || !firebase) return inFlight
    const s = pending
    pending = null
    lastWrite = Date.now()
    inFlight = setDoc(seenRef(uid), s, { merge: true }).catch(() => {
      off = true
    })
    return inFlight
  }

  const onHide = () => {
    if (document.visibilityState === 'hidden') void write()
  }
  const hasDocument = typeof document !== 'undefined'
  if (hasDocument) document.addEventListener('visibilitychange', onHide)

  return {
    push(s) {
      if (off) return
      pending = s
      if (timer) return
      timer = setTimeout(write, Math.max(0, lastWrite + GAP - Date.now()))
    },
    flush: write,
    stop() {
      if (hasDocument) document.removeEventListener('visibilitychange', onHide)
      const last = write()
      off = true
      pending = null
      return last
    },
  }
}
