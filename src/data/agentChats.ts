// Saved chats in Firestore (S16, D-312; docs/specs/agent.md §4.7; the shapes, caps and checks in src/agent/chats.ts):
// `workspaces/{wid}/agentChats/{id}` (the summary: uid, title, times, shared, model, turns) and its `content/body` (the
// turns and the chat's short ids). Private to whoever wrote it until they share it; then every member reads it, and
// still only its writer changes or deletes it (firestore.rules). Viewers keep their own chats too (D-098's spirit:
// viewers keep their own documents).
//
// Not content: no undo step, no change log (chats are nobody's work on the canvas). Never the key, never a tool's raw
// result: what's saved is what src/agent/chats.ts' chatDocs gives.
import { collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where, writeBatch, type QueryConstraint } from 'firebase/firestore'
import { db, firebase, isDemo } from './firebase'
import { chatTitle, FIRST_PAGE, pageChats, type ChatBody, type ChatCursor, type ChatSummary } from '../agent/chats'

export type ChatListItem = ChatSummary & { id: string }

const chatsOf = (wid: string) => collection(db(), 'workspaces', wid, 'agentChats')
const chatRef = (wid: string, id: string) => doc(chatsOf(wid), id)
const bodyRef = (wid: string, id: string) => doc(chatsOf(wid), id, 'content', 'body')

export const newChatId = (wid: string) => doc(chatsOf(wid)).id

export const chatsAvailable = () => !!firebase && !isDemo

// The summary and body in one batch (the body's rule reads the summary as the batch leaves it).
export async function saveChat(wid: string, id: string, summary: ChatSummary, body: ChatBody): Promise<void> {
  if (!chatsAvailable()) return
  const batch = writeBatch(db())
  batch.set(chatRef(wid, id), summary)
  batch.set(bodyRef(wid, id), body)
  await batch.commit()
}

// Your chats and the ones shared with the workspace, newest first, `size` of each kind a page, each query with its own
// cursor (src/agent/chats.ts' pageChats): pass back the cursor it gave for the next page.
export async function listChats(wid: string, uid: string, o: { size?: number; cursor?: ChatCursor } = {}): Promise<{ items: ChatListItem[]; cursor: ChatCursor }> {
  if (!chatsAvailable()) return { items: [], cursor: { mineMore: false, sharedMore: false } }
  const fetchBy = (field: 'uid' | 'shared', value: string | boolean) => async (before: number | undefined, size: number) => {
    const page: QueryConstraint[] = [where(field, '==', value), orderBy('updatedAt', 'desc'), ...(before !== undefined ? [where('updatedAt', '<', before)] : []), limit(size)]
    return (await getDocs(query(chatsOf(wid), ...page))).docs.map((d) => ({ ...(d.data() as ChatSummary), id: d.id }))
  }
  return pageChats(fetchBy('uid', uid), fetchBy('shared', true), o.cursor ?? FIRST_PAGE, o.size ?? 20)
}

// A chat to reopen: its summary and body; null when it's gone or not yours to read.
export async function openChat(wid: string, id: string): Promise<{ summary: ChatSummary; body: ChatBody } | null> {
  if (!chatsAvailable()) return null
  try {
    const s = await getDoc(chatRef(wid, id))
    if (!s.exists()) return null
    const b = await getDoc(bodyRef(wid, id))
    return { summary: s.data() as ChatSummary, body: (b.data() as ChatBody | undefined) ?? { turns: [], ids: { v: 1, next: {}, ids: {} } } }
  } catch {
    return null
  }
}

export const renameChat = (wid: string, id: string, title: string) => updateDoc(chatRef(wid, id), { title: chatTitle(title), updatedAt: Date.now() })
export const shareChat = (wid: string, id: string, shared: boolean) => updateDoc(chatRef(wid, id), { shared })

// The body first in the batch (its rule reads the summary as it was before the batch).
export async function deleteChat(wid: string, id: string): Promise<void> {
  const batch = writeBatch(db())
  batch.delete(bodyRef(wid, id))
  batch.delete(chatRef(wid, id))
  await batch.commit()
}
