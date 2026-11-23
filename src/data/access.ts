// What RTDB's rules know about Firestore (D-426): a function copies each workspace's roles to `access/{wid}/{uid}` and
// each document's author, sharing and kind to `docAccess/{wid}/{id}` (functions/src/mirror.ts), since RTDB's rules
// can't read Firestore. Presence (D-317) and writing together (D-374) wait here until the copy says what Firestore
// already does; one not there in ACCESS_ASK_MS (a workspace from before the copy, a trigger still on its way) is asked
// for once (`syncAccess`).
import { onValue, ref, type Database } from 'firebase/database'
import { ACCESS_ASK_MS, ACCESS_GIVE_UP_MS } from '../ui/foundation/feel'
import { functionsOf } from './firebase'

export type DocAccess = { uid: string; shared: boolean; kind: string }

// Each workspace (and document) is asked for at most once a tab while the answer is on its way.
const asking = new Map<string, Promise<unknown>>()
function ask(wid: string, doc?: string) {
  const key = `${wid}/${doc ?? ''}`
  if (asking.has(key)) return
  const call = Promise.all([functionsOf(), import('firebase/functions')])
    .then(([f, { httpsCallable }]) => httpsCallable(f, 'syncAccess')(doc ? { wid, doc } : { wid }))
    .catch(() => {})
    .finally(() => asking.delete(key))
  asking.set(key, call)
}

// Calls `on` once the copy fits (now, or when it comes); `fail` past ACCESS_GIVE_UP_MS. Returns a stop.
function waitFor<T>(rtdb: Database, path: string, fits: (v: T | null) => boolean, askFor: () => void, on: () => void, fail: () => void) {
  let done = false
  const asked = setTimeout(() => !done && askFor(), ACCESS_ASK_MS)
  const given = setTimeout(() => !done && (stop(), fail()), ACCESS_GIVE_UP_MS)
  // A value already cached can come back before onValue returns: stop then once it has.
  let off: (() => void) | undefined
  off = onValue(
    ref(rtdb, path),
    (snap) => {
      if (done || !fits(snap.val() as T | null)) return
      stop()
      on()
    },
    // Refused (not a member any more): nothing to wait for.
    () => !done && (stop(), fail()),
  )
  if (done) off()
  function stop() {
    done = true
    clearTimeout(asked)
    clearTimeout(given)
    off?.()
  }
  return stop
}

// Once `uid` is in the workspace's copy. Its own entry is the one thing anyone reads there.
export function whenMember(rtdb: Database, wid: string, uid: string, on: () => void, fail: () => void = () => {}) {
  return waitFor<string>(rtdb, `access/${wid}/${uid}`, (v) => typeof v === 'string', () => ask(wid), on, fail)
}

// Once the workspace's copy has `uid` and the document's copy says what `want` says (the summary this tab reads):
// RTDB's rules then judge as firestore.rules do.
export function whenDocMirrored(rtdb: Database, wid: string, uid: string, id: string, want: DocAccess, on: () => void, fail: () => void) {
  let stopDoc: (() => void) | null = null
  const stopMember = whenMember(
    rtdb,
    wid,
    uid,
    () => {
      stopDoc = waitFor<DocAccess>(
        rtdb,
        `docAccess/${wid}/${id}`,
        (v) => !!v && v.uid === want.uid && v.shared === want.shared && v.kind === want.kind,
        () => ask(wid, id),
        on,
        fail,
      )
    },
    fail,
  )
  return () => {
    stopMember()
    stopDoc?.()
  }
}
