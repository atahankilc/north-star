// Comment threads on the board (D-159): `threads/{id}`, each with its `messages/{id}`. Any member writes them, viewers
// too, as themselves; they aren't board content, so nothing here goes through `tracked()` (no undo, no read-only
// refusal for viewers). A thread and its first message are written together; each reply bumps the thread's count.
import { collection, deleteField, doc, getDocs, increment, limit, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore'
import { db, firebase } from './firebase'
import { useQuery, useWorkspaceCollection } from './hooks'
import { MESSAGE_MAX, type Thread, type ThreadMessage, type ThreadTarget } from './model'

const threadsOf = (wid: string) => collection(db(), 'workspaces', wid, 'threads')
const messagesOf = (wid: string, tid: string) => collection(db(), 'workspaces', wid, 'threads', tid, 'messages')

function me() {
  const user = firebase?.auth.currentUser
  if (!user) throw new Error('Not signed in')
  return { uid: user.uid, name: (user.displayName || user.email || 'someone').slice(0, 200) }
}

// Every thread in the workspace: few, and the board shows their pins.
export const useThreads = (wid: string) => useWorkspaceCollection<Thread>(wid, 'threads')

// A thread's messages, oldest first, while it's open.
export const useMessages = (wid: string, tid: string | null) =>
  useQuery<ThreadMessage>(tid ? query(messagesOf(wid, tid), orderBy('createdAt'), limit(300)) : null, `${wid}/threads/${tid}`)

export type NewThread = { on: ThreadTarget; targetId?: string; planeId?: string; at: [number, number] }

// Starts a thread with its first message; its id.
export async function startThread(wid: string, t: NewThread, text: string): Promise<string> {
  const who = me()
  const now = Date.now()
  const ref = doc(threadsOf(wid))
  const thread: Thread = {
    on: t.on,
    ...(t.targetId && { targetId: t.targetId }),
    ...(t.planeId && { planeId: t.planeId }),
    x: t.at[0],
    y: t.at[1],
    ...who,
    count: 1,
    lastAt: now,
    createdAt: now,
    updatedAt: now,
  }
  const batch = writeBatch(db())
  batch.set(ref, thread)
  batch.set(doc(messagesOf(wid, ref.id)), { ...who, text: text.slice(0, MESSAGE_MAX), createdAt: now } satisfies ThreadMessage)
  await batch.commit()
  return ref.id
}

export async function reply(wid: string, tid: string, text: string) {
  const now = Date.now()
  const batch = writeBatch(db())
  batch.set(doc(messagesOf(wid, tid)), { ...me(), text: text.slice(0, MESSAGE_MAX), createdAt: now } satisfies ThreadMessage)
  batch.update(doc(threadsOf(wid), tid), { count: increment(1), lastAt: now, updatedAt: now })
  await batch.commit()
}

export function editMessage(wid: string, tid: string, mid: string, text: string) {
  return updateDoc(doc(messagesOf(wid, tid), mid), { text: text.slice(0, MESSAGE_MAX), editedAt: Date.now() })
}

// A message taken back; the last one takes its thread with it.
export async function deleteMessage(wid: string, tid: string, mid: string, wasLast: boolean) {
  if (wasLast) return deleteThread(wid, tid)
  const batch = writeBatch(db())
  batch.delete(doc(messagesOf(wid, tid), mid))
  batch.update(doc(threadsOf(wid), tid), { count: increment(-1), updatedAt: Date.now() })
  await batch.commit()
}

export function setResolved(wid: string, tid: string, resolved: boolean) {
  const { uid } = me()
  return updateDoc(doc(threadsOf(wid), tid), resolved ? { resolved: true, resolvedBy: uid, updatedAt: Date.now() } : { resolved: deleteField(), resolvedBy: deleteField(), updatedAt: Date.now() })
}

// The thread and every message in it (owners and editors, or whoever started it while it's theirs alone).
export async function deleteThread(wid: string, tid: string) {
  const msgs = await getDocs(messagesOf(wid, tid))
  const refs = msgs.docs.map((d) => d.ref)
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db())
    for (const r of refs.slice(i, i + 400)) batch.delete(r)
    await batch.commit()
  }
  const batch = writeBatch(db())
  batch.delete(doc(threadsOf(wid), tid))
  await batch.commit()
}
