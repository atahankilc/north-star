// Comment threads (D-159; on the canvas and in planes, D-192: `planeId` is the space, `canvas` or a plane's id): `threads/{id}`, each with its `messages/{id}`. Any member writes them, viewers
// too, as themselves; they aren't board content, so nothing here goes through `tracked()` (no undo, no read-only
// refusal for viewers). A thread and its first message are written together; each reply bumps the thread's count and
// says who wrote last. Mentions (D-166) are member ids on the message and, gathered, on the thread. What you've read is
// `threadReads/{your uid}`: each thread's `lastAt` when you last had it open.
import { useCallback, useSyncExternalStore } from 'react'
import { arrayUnion, collection, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, setDoc, updateDoc, writeBatch, deleteField } from 'firebase/firestore'
import { db, firebase } from './firebase'
import { useQuery, type Live, type WithId } from './hooks'
import { MENTIONS_MAX, MESSAGE_MAX, type Member, type Thread, type ThreadMessage, type ThreadReads, type ThreadTarget } from './model'

const threadsOf = (wid: string) => collection(db(), 'workspaces', wid, 'threads')
const messagesOf = (wid: string, tid: string) => collection(db(), 'workspaces', wid, 'threads', tid, 'messages')
const readsRef = (wid: string, uid: string) => doc(db(), 'workspaces', wid, 'threadReads', uid)

function me() {
  const user = firebase?.auth.currentUser
  if (!user) throw new Error('Not signed in')
  return { uid: user.uid, name: (user.displayName || user.email || 'someone').slice(0, 200) }
}

// The onboarding's demo realm (D-315: no Firebase at all): a scene's made-up messages, what "you" have read and who
// "you" are, read instead of Firestore. Never filled while Firebase is there.
export const demoThreads: { messages: Record<string, WithId<ThreadMessage>[]>; seen: Record<string, number>; me: string } = { messages: {}, seen: {}, me: '' }

// A thread's messages, oldest first, while it's open.
export function useMessages(wid: string, tid: string | null): Live<WithId<ThreadMessage>[]> {
  const live = useQuery<ThreadMessage>(tid && firebase ? query(messagesOf(wid, tid), orderBy('createdAt'), limit(300)) : null, `${wid}/threads/${tid}`)
  return firebase ? live : { data: (tid && demoThreads.messages[tid]) || [], isLoading: false, error: null }
}

// What you've read (D-166).
// One listener per reads doc, however many read it: every comment chip on a plane reads it (the sweep of 2026-11-03:
// 300 cards were 300 listeners, and each read mark gave all 300 a new object). Started by the first that reads it,
// stopped when the last one goes.
type Shared = { live: Live<WithId<ThreadReads> | null>; subs: Set<() => void>; off: () => void }
const sharedReads = new Map<string, Shared>()
const READS_LOADING: Live<WithId<ThreadReads> | null> = { data: null, isLoading: true, error: null }
const READS_NONE: Live<WithId<ThreadReads> | null> = { data: null, isLoading: false, error: null }

function listenReads(path: string, on: () => void): () => void {
  let s = sharedReads.get(path)
  if (!s) {
    const made: Shared = { live: READS_LOADING, subs: new Set(), off: () => {} }
    const tell = (live: Live<WithId<ThreadReads> | null>) => ((made.live = live), made.subs.forEach((f) => f()))
    made.off = onSnapshot(
      doc(db(), path),
      (snap) => tell({ data: snap.exists() ? { ...(snap.data() as ThreadReads), id: snap.id } : null, isLoading: false, error: null }),
      (error) => tell({ data: null, isLoading: false, error }),
    )
    sharedReads.set(path, made)
    s = made
  }
  const entry = s
  entry.subs.add(on)
  return () => {
    entry.subs.delete(on)
    if (entry.subs.size || sharedReads.get(path) !== entry) return
    entry.off()
    sharedReads.delete(path)
  }
}

export function useReads(wid: string, uid: string | null): Live<WithId<ThreadReads> | null> {
  const path = firebase && uid ? `workspaces/${wid}/threadReads/${uid}` : null
  const subscribe = useCallback((on: () => void) => (path ? listenReads(path, on) : () => {}), [path])
  const get = useCallback(() => (path ? (sharedReads.get(path)?.live ?? READS_LOADING) : READS_NONE), [path])
  const live = useSyncExternalStore(subscribe, get, get)
  return firebase ? live : { data: { id: uid ?? '', seen: demoThreads.seen } as WithId<ThreadReads>, isLoading: false, error: null }
}

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
  // The rules check the count and the preview against this message, made in the same batch (`lastMid` names it).
  const mref = doc(messagesOf(wid, tid))
  batch.set(mref, { ...who, text: text.slice(0, MESSAGE_MAX), ...(ids.length && { mentions: ids }), createdAt: now } satisfies ThreadMessage)
  batch.update(doc(threadsOf(wid), tid), {
    count: increment(1),
    lastMid: mref.id,
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

// Your own message changed; when it's the one the thread's preview shows (its writer and time), the preview's text
// changes with it, in the same write, so nobody's threads panel keeps the old words.
export async function editMessage(wid: string, tid: string, mid: string, text: string, mentions: string[] = []) {
  const ids = cap(mentions)
  const body = text.slice(0, MESSAGE_MAX)
  const [t, m] = await Promise.all([getDoc(doc(threadsOf(wid), tid)), getDoc(doc(messagesOf(wid, tid), mid))])
  const thread = t.data() as Thread | undefined
  const msg = m.data() as ThreadMessage | undefined
  const batch = writeBatch(db())
  batch.update(doc(messagesOf(wid, tid), mid), { text: body, mentions: ids.length ? ids : deleteField(), editedAt: Date.now() })
  if (thread && msg && (thread.lastMid === mid || (thread.lastUid === msg.uid && thread.lastAt === msg.createdAt)))
    batch.update(doc(threadsOf(wid), tid), { lastText: body.length <= PREVIEW_MAX ? body : deleteField(), updatedAt: Date.now() })
  return batch.commit()
}

// Your own message taken back (D-166: only its writer can); the last one takes its thread with it. The thread's preview
// is always set to the newest message left (`lastMid` names it, so the rules can check it's really that message; a text
// too long for the preview is left out rather than cut). Not only when the one taken back was the newest by
// `createdAt`: that's each writer's own clock, and a preview that waited on it kept showing a deleted message to
// everyone in the threads panel.
export async function deleteMessage(wid: string, tid: string, mid: string, wasLast: boolean) {
  if (wasLast) return deleteThread(wid, tid)
  const newest = await getDocs(query(messagesOf(wid, tid), orderBy('createdAt', 'desc'), limit(2)))
  const before = newest.docs.find((d) => d.id !== mid)
  const prev = before?.data() as ThreadMessage | undefined
  const batch = writeBatch(db())
  batch.delete(doc(messagesOf(wid, tid), mid))
  batch.update(doc(threadsOf(wid), tid), {
    count: increment(-1),
    // The message going in this batch: the rules let the count down only with one that really goes.
    takenMid: mid,
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

// The thread and every message in it; owners, or whoever wrote the one message left (its starter, or an answer
// whose thread's first message was taken back). An owner may take others'
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
    // Not there yet, the rules refuse the update (permission-denied, not not-found: a new doc wants `seen`): look first.
    if ((await getDoc(ref)).exists()) throw e
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
