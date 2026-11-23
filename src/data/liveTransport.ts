// Writing together's channel (D-374), in RTDB since Blaze (D-426; ~0.05–0.1 s, Firestore's was ~0.3): under
// `live/{wid}/{id}`, `edits/{eid}` the packets ({ u, by, at }, created, never changed) and `state` what's folded
// ({ s, v, at }), the bytes as base64 (RTDB keeps none). RTDB's rules (database.rules.json) let only who may write the .md
// (D-373's `mayWrite`) send or fold, from a copy of the roles and the document's author and sharing (access.ts): nothing
// starts until the copy says what this tab's summary does. A document's shared text goes with it (a function, when its
// summary is deleted). No Yjs here: bytes in, bytes out (liveText.ts holds the text).
import {
  onChildAdded,
  onChildRemoved,
  onValue,
  push,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type DataSnapshot,
} from 'firebase/database'
import { fromBase64, toBase64 } from '../model/base64'
import { LIVE_DROP_BATCH } from '../model/limits'
import { whenDocMirrored, type DocAccess } from './access'
import { firebase } from './firebase'
import type { LivePacket, LiveState, LiveTransport } from './liveText'

type Stored = { s?: unknown; v?: unknown }

const asState = (d: Stored | null): LiveState | null =>
  d && typeof d.s === 'string' ? { s: fromBase64(d.s), v: typeof d.v === 'number' ? d.v : 0 } : null
const packetOf = (snap: DataSnapshot): LivePacket | null => {
  const u = (snap.val() as { u?: unknown } | null)?.u
  return typeof u === 'string' && snap.key ? { id: snap.key, u: fromBase64(u) } : null
}

// `doc`: the document's summary as this tab reads it, what the copy must say before RTDB's rules agree.
export function rtdbLive(wid: string, id: string, uid: string, doc: DocAccess): LiveTransport {
  const rtdb = firebase?.rtdb
  if (!rtdb) throw new Error('Firebase is not configured')
  const root = `live/${wid}/${id}`
  const stateRef = ref(rtdb, `${root}/state`)
  const editsRef = ref(rtdb, `${root}/edits`)

  let stopWait = () => {}
  const allowed = new Promise<void>((resolve, reject) => {
    stopWait = whenDocMirrored(rtdb, wid, uid, id, doc, resolve, () => reject(new Error("couldn't open this document for writing together")))
  })
  // Starts `go` once allowed; the stop works before and after.
  const once = (go: () => () => void, onError: (e: unknown) => void) => {
    let off: (() => void) | null = null
    let stopped = false
    allowed.then(() => {
      if (!stopped) off = go()
    }, onError)
    return () => {
      stopped = true
      off?.()
      stopWait()
    }
  }

  return {
    listenState(on, onError) {
      return once(() => onValue(stateRef, (snap) => on(asState(snap.val() as Stored | null)), onError), onError)
    },
    listen(on, onError) {
      return once(() => {
        // Sizes per id, so what's there is known as packets come and go (a compaction deletes them).
        const sizes = new Map<string, number>()
        let bytes = 0
        // Those there now come one by one before the first value: gathered and given at once, then each as it comes.
        let first: LivePacket[] | null = []
        const offAdded = onChildAdded(
          editsRef,
          (snap) => {
            const p = packetOf(snap)
            if (!p || sizes.has(p.id)) return
            sizes.set(p.id, p.u.length)
            bytes += p.u.length
            if (first) first.push(p)
            else on([p], { count: sizes.size, bytes })
          },
          onError,
        )
        const offRemoved = onChildRemoved(editsRef, (snap) => {
          if (!snap.key) return
          bytes -= sizes.get(snap.key) ?? 0
          sizes.delete(snap.key)
        })
        const offFirst = onValue(
          editsRef,
          () => {
            const now = first ?? []
            first = null
            on(now, { count: sizes.size, bytes })
          },
          onError,
          { onlyOnce: true },
        )
        return () => {
          offAdded()
          offRemoved()
          offFirst()
        }
      }, onError)
    },
    send(u) {
      const node = push(editsRef)
      const done = allowed.then(() => set(node, { u: toBase64(u), by: uid, at: serverTimestamp() }))
      return { id: node.key!, done }
    },
    async seed(s) {
      await allowed
      // Made only if there's none: someone else's, there first, is taken as it is (two seeds would double the text).
      const r = await runTransaction(stateRef, (now: Stored | null) => (now ? undefined : { s: toBase64(s), v: 0, at: serverTimestamp() }))
      return asState(r.snapshot.val() as Stored | null) ?? { s, v: 0 }
    },
    async compact(fold, drop) {
      await allowed
      await runTransaction(stateRef, (now: Stored | null) => {
        const old = asState(now)
        return { s: toBase64(fold(old?.s ?? null)), v: old ? old.v + 1 : 0, at: serverTimestamp() }
      })
      for (let i = 0; i < drop.length; i += LIVE_DROP_BATCH) {
        await update(editsRef, Object.fromEntries(drop.slice(i, i + LIVE_DROP_BATCH).map((eid) => [eid, null])))
      }
    },
  }
}
