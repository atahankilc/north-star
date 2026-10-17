import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { useDoc, useQuery } from './hooks'
import type { AuthUser } from './auth'
import type { InviteCode, JoinRequest, Workspace } from './model'

// No 0/O/1/I/L: codes get read aloud and typed by hand.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function newInviteCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function useMyWorkspaces(uid: string) {
  return useQuery<Workspace>(
    query(collection(db(), 'workspaces'), where('memberIds', 'array-contains', uid)),
    `workspaces:${uid}`,
  )
}

export function useWorkspace(wid: string) {
  return useDoc<Workspace>(`workspaces/${wid}`)
}

export async function createWorkspace(name: string, uid: string): Promise<string> {
  const ref = doc(collection(db(), 'workspaces'))
  const inviteCode = newInviteCode()
  const workspace: Workspace = {
    name: name.trim() || 'Untitled',
    ownerId: uid,
    memberIds: [uid],
    roles: { [uid]: 'owner' },
    inviteCode,
    createdAt: Date.now(),
  }
  const code: InviteCode = { workspaceId: ref.id, createdBy: uid }

  const batch = writeBatch(db())
  batch.set(ref, workspace)
  batch.set(doc(db(), 'inviteCodes', inviteCode), code)
  await batch.commit()
  return ref.id
}

export class JoinError extends Error {}

export type JoinResult = { status: 'member'; workspaceId: string } | { status: 'requested' }

const requestId = (wid: string, uid: string) => `${wid}_${uid}`

// D-062: a code no longer joins by itself. It sends a request the owner approves or denies.
export async function requestToJoin(rawCode: string, user: AuthUser): Promise<JoinResult> {
  const code = normalizeInviteCode(rawCode)
  if (!code) throw new JoinError('Enter an invite code.')
  const snap = await getDoc(doc(db(), 'inviteCodes', code))
  if (!snap.exists()) throw new JoinError('That invite code does not exist.')
  const { workspaceId, createdBy } = snap.data() as InviteCode

  // Only members (and invitees) can read the workspace: if this works and you're in it, just go there.
  const ws = await getDoc(doc(db(), 'workspaces', workspaceId)).catch(() => null)
  if (ws?.exists() && (ws.data() as Workspace).memberIds.includes(user.id)) return { status: 'member', workspaceId }

  const request: JoinRequest = {
    workspaceId,
    ownerId: createdBy,
    uid: user.id,
    name: user.name || user.email || 'Someone',
    email: user.email ?? '',
    code,
    createdAt: Date.now(),
  }
  const ref = doc(db(), 'joinRequests', requestId(workspaceId, user.id))
  try {
    await setDoc(ref, request)
  } catch (e) {
    // A pending request can't be overwritten; that's fine, it's still waiting.
    const mine = await getDoc(ref).catch(() => null)
    if (mine?.exists()) throw new JoinError('You already asked to join. The owner has not answered yet.')
    throw new JoinError('This invite code is no longer valid.', { cause: e })
  }
  return { status: 'requested' }
}

// Requests you sent that are still waiting.
export function useMyJoinRequests(uid: string) {
  return useQuery<JoinRequest>(query(collection(db(), 'joinRequests'), where('uid', '==', uid)), `joinRequests:mine:${uid}`)
}

// Requests to join workspaces you own; pass a workspace to narrow it down.
export function useRequestsToMe(uid: string, wid?: string) {
  const mine = [where('ownerId', '==', uid), ...(wid ? [where('workspaceId', '==', wid)] : [])]
  return useQuery<JoinRequest>(query(collection(db(), 'joinRequests'), ...mine), `joinRequests:owner:${uid}:${wid ?? ''}`)
}

export function withdrawJoinRequest(wid: string, uid: string) {
  return deleteDoc(doc(db(), 'joinRequests', requestId(wid, uid)))
}

export const denyJoinRequest = withdrawJoinRequest

// Owner only: add them as an editor and clear the request in one go.
export function approveJoinRequest(wid: string, uid: string) {
  const batch = writeBatch(db())
  batch.update(doc(db(), 'workspaces', wid), { memberIds: arrayUnion(uid), [`roles.${uid}`]: 'editor' })
  batch.delete(doc(db(), 'joinRequests', requestId(wid, uid)))
  return batch.commit()
}

// Owner only: the old code stops working at once. Pending requests stay.
export async function renewInviteCode(wid: string, oldCode: string, uid: string) {
  const inviteCode = newInviteCode()
  const code: InviteCode = { workspaceId: wid, createdBy: uid }
  const batch = writeBatch(db())
  batch.delete(doc(db(), 'inviteCodes', oldCode))
  batch.set(doc(db(), 'inviteCodes', inviteCode), code)
  batch.update(doc(db(), 'workspaces', wid), { inviteCode })
  await batch.commit()
}

// ---- Email invites (D-062): no mail is sent; the invite waits on the invitee's workspaces page. ----

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase()
}

export function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)
}

// Owner only.
export function inviteEmail(wid: string, email: string) {
  return updateDoc(doc(db(), 'workspaces', wid), { invitedEmails: arrayUnion(normalizeEmail(email)) })
}

export function uninviteEmail(wid: string, email: string) {
  return updateDoc(doc(db(), 'workspaces', wid), { invitedEmails: arrayRemove(email) })
}

// Workspaces that invited your (verified) address.
export function useMyInvites(email: string | null) {
  const me = email ? normalizeEmail(email) : ''
  return useQuery<Workspace>(
    me ? query(collection(db(), 'workspaces'), where('invitedEmails', 'array-contains', me)) : null,
    `invites:${me}`,
  )
}

export function acceptInvite(wid: string, user: AuthUser) {
  return updateDoc(doc(db(), 'workspaces', wid), {
    memberIds: arrayUnion(user.id),
    [`roles.${user.id}`]: 'editor',
    invitedEmails: arrayRemove(normalizeEmail(user.email ?? '')),
  })
}

export function declineInvite(wid: string, email: string) {
  return updateDoc(doc(db(), 'workspaces', wid), { invitedEmails: arrayRemove(normalizeEmail(email)) })
}

export function renameWorkspace(wid: string, name: string) {
  return updateDoc(doc(db(), 'workspaces', wid), { name: name.trim() || 'Untitled' })
}

// Every subcollection under workspaces/{wid}; Firestore doesn't cascade deletes.
// `domains` and `groups` are retired (D-048, D-049) but older workspaces may still hold some.
const WORKSPACE_COLLECTIONS = ['labels', 'domains', 'customers', 'problems', 'ideas', 'edges', 'groups', 'features', 'competitors', 'competitorFeatures', 'comparisons']
const BATCH_LIMIT = 450

// Owner only. Children go first: their rules check membership on the workspace doc.
export async function deleteWorkspace(wid: string, inviteCode: string, uid: string) {
  const snaps = await Promise.all([
    ...WORKSPACE_COLLECTIONS.map((c) => getDocs(collection(db(), 'workspaces', wid, c))),
    getDocs(query(collection(db(), 'joinRequests'), where('ownerId', '==', uid), where('workspaceId', '==', wid))),
  ])
  const refs = snaps.flatMap((s) => s.docs.map((d) => d.ref))
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db())
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(ref)
    await batch.commit()
  }
  const batch = writeBatch(db())
  batch.delete(doc(db(), 'inviteCodes', inviteCode))
  batch.delete(doc(db(), 'workspaces', wid))
  await batch.commit()
}

// Non-owners leave instead of deleting.
export function leaveWorkspace(wid: string, uid: string) {
  return updateDoc(doc(db(), 'workspaces', wid), {
    memberIds: arrayRemove(uid),
    [`roles.${uid}`]: deleteField(),
  })
}
