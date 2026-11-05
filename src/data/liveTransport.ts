// Writing together's channel (D-374, docs/specs/live-writing.md): Firestore until Blaze, RTDB after (only this file
// changes). Under a document: `edits/{eid}` the packets ({ u: bytes, by, at }, created, never changed) and `live/state`
// what's folded ({ s: bytes, v, at }). The rules (firestore.rules, `documents/{id}`) let only who may write the .md
// (D-373's `mayWrite`) send or fold. No Yjs here: bytes in, bytes out (liveText.ts holds the text).
import {
  Bytes,
  collection,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { LIVE_DROP_BATCH } from '../model/limits'
import { db } from './firebase'
import type { LivePacket, LiveState, LiveTransport } from './liveText'

const editsOf = (wid: string, id: string) => collection(db(), 'workspaces', wid, 'documents', id, 'edits')
const stateOf = (wid: string, id: string) => doc(db(), 'workspaces', wid, 'documents', id, 'live', 'state')

const bytesOf = (d: DocumentData | undefined, key: string) => {
  const b = d?.[key]
  return b instanceof Bytes ? b.toUint8Array() : null
}

export function firestoreLive(wid: string, id: string, uid: string): LiveTransport {
  const edits = editsOf(wid, id)
  const stateRef = stateOf(wid, id)
  const asState = (d: DocumentData | undefined): LiveState | null => {
    const s = bytesOf(d, 's')
    return s ? { s, v: typeof d?.v === 'number' ? d.v : 0 } : null
  }
  return {
    listenState(on, onError) {
      return onSnapshot(stateRef, (snap) => on(asState(snap.data())), onError)
    },
    listen(on, onError) {
      // Sizes per id, so what's there is known as packets come and go (a compaction deletes them).
      const sizes = new Map<string, number>()
      let bytes = 0
      return onSnapshot(
        edits,
        (snap) => {
          const added: LivePacket[] = []
          for (const c of snap.docChanges()) {
            if (c.type === 'removed') {
              bytes -= sizes.get(c.doc.id) ?? 0
              sizes.delete(c.doc.id)
              continue
            }
            if (c.type !== 'added') continue
            const u = bytesOf(c.doc.data(), 'u')
            if (!u) continue
            sizes.set(c.doc.id, u.length)
            bytes += u.length
            added.push({ id: c.doc.id, u })
          }
          on(added, { count: sizes.size, bytes })
        },
        onError,
      )
    },
    send(u) {
      const ref = doc(edits)
      return { id: ref.id, done: setDoc(ref, { u: Bytes.fromUint8Array(u), by: uid, at: serverTimestamp() }) }
    },
    async seed(s) {
      return runTransaction(db(), async (tx) => {
        const now = await tx.get(stateRef)
        const theirs = asState(now.data())
        if (theirs) return theirs
        tx.set(stateRef, { s: Bytes.fromUint8Array(s), v: 0, at: serverTimestamp() })
        return { s, v: 0 }
      })
    },
    async compact(fold, drop) {
      await runTransaction(db(), async (tx) => {
        const now = await tx.get(stateRef)
        const old = asState(now.data())
        const s = Bytes.fromUint8Array(fold(old?.s ?? null))
        if (old) tx.update(stateRef, { s, v: old.v + 1, at: serverTimestamp() })
        else tx.set(stateRef, { s, v: 0, at: serverTimestamp() })
      })
      for (let i = 0; i < drop.length; i += LIVE_DROP_BATCH) {
        const batch = writeBatch(db())
        for (const eid of drop.slice(i, i + LIVE_DROP_BATCH)) batch.delete(doc(edits, eid))
        await batch.commit()
      }
    },
  }
}

// A document's packets and state go with it (deleteDocument, deleteWorkspace): packets first, the state last, so a
// state is never left behind with its packets gone (an undo of the delete reseeds from the Markdown body).
export async function deleteLive(wid: string, id: string) {
  const all = await getDocs(editsOf(wid, id))
  for (let i = 0; i < all.docs.length; i += LIVE_DROP_BATCH) {
    const batch = writeBatch(db())
    for (const d of all.docs.slice(i, i + LIVE_DROP_BATCH)) batch.delete(d.ref)
    await batch.commit()
  }
  const batch = writeBatch(db())
  batch.delete(stateOf(wid, id))
  await batch.commit()
}
