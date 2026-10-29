// Comment threads (D-159; on the canvas and in planes, D-192: `planeId` is the space, `canvas` or a plane's id): `threads/{id}`, each with its `messages/{id}`. Any member writes them, viewers
// too, as themselves; they aren't board content, so nothing here goes through `tracked()` (no undo, no read-only
// refusal for viewers). A thread and its first message are written together; each reply bumps the thread's count and
// says who wrote last. Mentions (D-166) are member ids on the message and, gathered, on the thread. What you've read is
// `threadReads/{your uid}`: each thread's `lastAt` when you last had it open.
import { arrayUnion, collection, doc, getDocs, increment, limit, orderBy, query, setDoc, updateDoc, writeBatch, deleteField } from 'firebase/firestore'
import { db, firebase } from './firebase'
import { useDoc, useQuery } from './hooks'
import { MENTIONS_MAX, MESSAGE_MAX, type Member, type Thread, type ThreadMessage, type ThreadReads, type ThreadTarget } from './model'

const threadsOf = (wid: string) => collection(db(), 'workspaces', wid, 'threads')
const messagesOf = (wid: string, tid: string) => collection(db(), 'workspaces', wid, 'threads', tid, 'messages')
const readsRef = (wid: string, uid: string) => doc(db(), 'workspaces', wid, 'threadReads', uid)

function me() {
  const user = firebase?.auth.currentUser
  if (!user) throw new Error('Not signed in')
  return { uid: user.uid, name: (user.displayName || user.email || 'someone').slice(0, 200) }
}

// A thread's messages, oldest first, while it's open.
export const useMessages = (wid: string, tid: string | null) =>
  useQuery<ThreadMessage>(tid ? query(messagesOf(wid, tid), orderBy('createdAt'), limit(300)) : null, `${wid}/threads/${tid}`)

// What you've read (D-166).
export const useReads = (wid: string, uid: string | null) => useDoc<ThreadReads>(uid ? `workspaces/${wid}/threadReads/${uid}` : null)

// Everyone in the workspace, for `@` (D-166): the people list, up to 200.
export const useMembers = (wid: string, on = true) =>
  useQuery<Member>(on && firebase ? query(collection(db(), 'workspaces', wid, 'members'), orderBy('name'), limit(200)) : null, `${wid}/members/all`)

export type NewThread = { on: ThreadTarget; targetId: string; planeId: string; at: [number, number] }

// How much of the newest message a thread keeps for its preview.
const PREVIEW_MAX = 160

const cap = (ids: string[]) => [...new Set(ids)].slice(0, MENTIONS_MAX)

// Starts a thread with its first message; its id.
export async function startThread(wid: string, t: NewThread, text: string, mentions: string[] = []): Promise<string> {
  const who = me()
  const now = Date.now()
  const ref = doc(threadsOf(wid))
  const ids = cap(mentions)
  const thread: Thread = {
    on: t.on,
    targetId: t.targetId,
    planeId: t.planeId,
    x: t.at[0],
    y: t.at[1],
    ...who,
    count: 1,
    lastAt: now,
    lastUid: who.uid,
    lastName: who.name,
    lastText: text.slice(0, PREVIEW_MAX),
    ...(ids.length && { mentions: ids }),
    createdAt: now,
    updatedAt: now,
  }
  const batch = writeBatch(db())
  batch.set(ref, thread)
  batch.set(doc(messagesOf(wid, ref.id)), { ...who, text: text.slice(0, MESSAGE_MAX), ...(ids.length && { mentions: ids }), createdAt: now } satisfies ThreadMessage)
  await batch.commit()
  void markSeen(wid, ref.id, now)
  return ref.id
}

export async function reply(wid: string, tid: string, text: string, mentions: string[] = []) {
  const who = me()
  const now = Date.now()
  const ids = cap(mentions)
  const batch = writeBatch(db())
  batch.set(doc(messagesOf(wid, tid)), { ...who, text: text.slice(0, MESSAGE_MAX), ...(ids.length && { mentions: ids }), createdAt: now } satisfies ThreadMessage)
  batch.update(doc(threadsOf(wid), tid), {
    count: increment(1),
    lastAt: now,
    lastUid: who.uid,
    lastName: who.name,
    lastText: text.slice(0, PREVIEW_MAX),
    updatedAt: now,
    ...(ids.length && { mentions: arrayUnion(...ids) }),
  })
  await batch.commit()
  void markSeen(wid, tid, now)
}

export function editMessage(wid: string, tid: string, mid: string, text: string, mentions: string[] = []) {
  const ids = cap(mentions)
  return updateDoc(doc(messagesOf(wid, tid), mid), { text: text.slice(0, MESSAGE_MAX), mentions: ids.length ? ids : deleteField(), editedAt: Date.now() })
}

// Your own message taken back (D-166: only its writer can); the last one takes its thread with it. When it was the
// newest, the thread's preview goes back to the one before it (`lastMid` names it, so the rules can check it's really
// that message; a text too long for the preview is left out rather than cut).
export async function deleteMessage(wid: string, tid: string, mid: string, wasLast: boolean) {
  if (wasLast) return deleteThread(wid, tid)
  const newest = await getDocs(query(messagesOf(wid, tid), orderBy('createdAt', 'desc'), limit(2)))
  const before = newest.docs[0]?.id === mid ? newest.docs[1] : undefined
  const prev = before?.data() as ThreadMessage | undefined
  const batch = writeBatch(db())
  batch.delete(doc(messagesOf(wid, tid), mid))
  batch.update(doc(threadsOf(wid), tid), {
    count: increment(-1),
    updatedAt: Date.now(),
    ...(before && prev && {
      lastMid: before.id,
      lastAt: prev.createdAt,
      lastUid: prev.uid,
      lastName: prev.name,
      lastText: prev.text.length <= PREVIEW_MAX ? prev.text : deleteField(),
    }),
  })
  await batch.commit()
}

export function setResolved(wid: string, tid: string, resolved: boolean) {
  const { uid } = me()
  return updateDoc(doc(threadsOf(wid), tid), resolved ? { resolved: true, resolvedBy: uid, updatedAt: Date.now() } : { resolved: deleteField(), resolvedBy: deleteField(), updatedAt: Date.now() })
}

// The thread and every message in it; owners, or whoever started it while nobody answered. An owner may take others'
// messages only once the thread is gone (in the same batch or after it), so the thread goes in the first batch with as
// many messages as fit, and the rest follow a batch at a time until none are left.
const DELETE_BATCH = 450

export async function deleteThread(wid: string, tid: string) {
  let first = true
  for (;;) {
    const msgs = await getDocs(query(messagesOf(wid, tid), limit(first ? DELETE_BATCH - 1 : DELETE_BATCH)))
    if (!first && msgs.empty) return
    const batch = writeBatch(db())
    for (const d of msgs.docs) batch.delete(d.ref)
    if (first) batch.delete(doc(threadsOf(wid), tid))
    await batch.commit()
    if (msgs.size < (first ? DELETE_BATCH - 1 : DELETE_BATCH)) return
    first = false
  }
}

// Your tasks looked at (D-261): those given to you after this are new. In the same read marks, leaving `seen` alone: a
// merge with `seen: {}` would replace the map and make every thread new again. The rules want `seen` on a new doc, so
// only a first write brings an empty one.
export async function markTasksSeen(wid: string, at = Date.now()) {
  const user = firebase?.auth.currentUser
  if (!user) return
  const ref = readsRef(wid, user.uid)
  try {
    await updateDoc(ref, { tasks: at, updatedAt: Date.now() })
  } catch (e) {
    if ((e as { code?: string }).code !== 'not-found') throw e
    await setDoc(ref, { seen: {}, tasks: at, updatedAt: Date.now() }, { merge: true })
  }
}

// You've seen a thread up to `at` (its lastAt).

export function markSeen(wid: string, tid: string, at: number) {
  const user = firebase?.auth.currentUser
  if (!user) return Promise.resolve()
  return setDoc(readsRef(wid, user.uid), { seen: { [tid]: at }, updatedAt: Date.now() }, { merge: true })
}

// New to you: someone else wrote in it since you last read it.
export const isNew = (t: Pick<Thread, 'lastAt' | 'lastUid' | 'uid'>, seen: Record<string, number> | undefined, tid: string, uid: string | null) =>
  !!uid && (t.lastUid ?? t.uid) !== uid && (seen?.[tid] ?? 0) < t.lastAt
