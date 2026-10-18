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
import { attachmentsAvailable, deleteAttachmentFiles } from './attachments'
import { db } from './firebase'
import { useDoc, usePaged, useQuery } from './hooks'
import type { AuthUser } from './auth'
import type { InviteCode, JoinRequest, Member, Role, Workspace } from './model'

// No 0/O/1/I/L: codes get read aloud and typed by hand.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function newInviteCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// Roles (D-098): authority comes from `roles`, not `ownerId` (the creator). A workspace can have several owners.
export const roleOf = (w: Pick<Workspace, 'roles' | 'memberIds'>, uid: string | undefined): Role | null =>
  uid && w.memberIds.includes(uid) ? (w.roles[uid] ?? null) : null
export const isOwnerOf = (w: Pick<Workspace, 'roles' | 'memberIds'>, uid: string | undefined) => roleOf(w, uid) === 'owner'
export const canEditIn = (w: Pick<Workspace, 'roles' | 'memberIds'>, uid: string | undefined) => {
  const r = roleOf(w, uid)
  return r === 'owner' || r === 'editor'
}
export const ownerCount = (w: Pick<Workspace, 'roles'>) => Object.values(w.roles).filter((r) => r === 'owner').length

export function useMyWorkspaces(uid: string) {
  return useQuery<Workspace>(
    query(collection(db(), 'workspaces'), where('memberIds', 'array-contains', uid)),
    `workspaces:${uid}`,
  )
}

export function useWorkspace(wid: string) {
  return useDoc<Workspace>(`workspaces/${wid}`)
}

export async function createWorkspace(name: string, uid: string, description?: string): Promise<string> {
  const ref = doc(collection(db(), 'workspaces'))
  const inviteCode = newInviteCode()
  const about = description?.trim().slice(0, DESCRIPTION_MAX)
  const workspace: Workspace = {
    name: name.trim() || 'Untitled',
    ...(about && { description: about }),
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

// Requests to join a workspace; only its owners may list them (D-098), so pass null when you aren't one.
export function useJoinRequests(wid: string | null) {
  return useQuery<JoinRequest>(
    wid ? query(collection(db(), 'joinRequests'), where('workspaceId', '==', wid)) : null,
    `joinRequests:${wid ?? ''}`,
  )
}

export function withdrawJoinRequest(wid: string, uid: string) {
  return deleteDoc(doc(db(), 'joinRequests', requestId(wid, uid)))
}

export const denyJoinRequest = withdrawJoinRequest

// Owners only: add them as an editor, put them in the people list and clear the request in one go.
export function approveJoinRequest(wid: string, r: JoinRequest) {
  const batch = writeBatch(db())
  batch.update(doc(db(), 'workspaces', wid), { memberIds: arrayUnion(r.uid), [`roles.${r.uid}`]: 'editor' })
  batch.set(memberRef(wid, r.uid), memberEntry(r.name, r.email))
  batch.delete(doc(db(), 'joinRequests', requestId(wid, r.uid)))
  return batch.commit()
}

// ---- People (D-098) ----

const memberRef = (wid: string, uid: string) => doc(db(), 'workspaces', wid, 'members', uid)

const memberEntry = (name: string, email?: string | null, photo?: string | null): Member => ({
  name: (name || email || 'Someone').slice(0, 200),
  ...(email && { email: email.slice(0, 320) }),
  ...(photo && { photo: photo.slice(0, 2000) }),
  joinedAt: Date.now(),
})

// Your own entry in the people list, written when you open the workspace if it's missing or your name changed.
export async function ensureMemberEntry(wid: string, user: AuthUser) {
  const ref = memberRef(wid, user.id)
  const snap = await getDoc(ref)
  const now = memberEntry(user.name ?? '', user.email, user.photoURL)
  const was = snap.data() as Member | undefined
  if (was && was.name === now.name && (was.email ?? null) === (now.email ?? null) && (was.photo ?? null) === (now.photo ?? null)) return
  await setDoc(ref, { ...now, joinedAt: was?.joinedAt ?? now.joinedAt })
}

// The people list, by name, a page at a time.
export function useMembers(wid: string, size = 20) {
  return usePaged<Member>([collection(db(), 'workspaces', wid, 'members')], `members:${wid}`, 'name', 'asc', size)
}

// Owners only. The rules keep at least one owner.
export function setRole(wid: string, uid: string, role: Role) {
  return updateDoc(doc(db(), 'workspaces', wid), { [`roles.${uid}`]: role })
}

// Owners only: they lose access at once; their entry in the people list goes with them.
export function removeMember(wid: string, uid: string) {
  const batch = writeBatch(db())
  batch.update(doc(db(), 'workspaces', wid), { memberIds: arrayRemove(uid), [`roles.${uid}`]: deleteField() })
  batch.delete(memberRef(wid, uid))
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

export async function acceptInvite(wid: string, user: AuthUser) {
  await updateDoc(doc(db(), 'workspaces', wid), {
    memberIds: arrayUnion(user.id),
    [`roles.${user.id}`]: 'editor',
    invitedEmails: arrayRemove(normalizeEmail(user.email ?? '')),
  })
  await ensureMemberEntry(wid, user).catch(() => {})
}

export function declineInvite(wid: string, email: string) {
  return updateDoc(doc(db(), 'workspaces', wid), { invitedEmails: arrayRemove(normalizeEmail(email)) })
}

export function renameWorkspace(wid: string, name: string) {
  return updateDoc(doc(db(), 'workspaces', wid), { name: name.trim() || 'Untitled' })
}

// What the team is building, in a sentence or two (D-082). The assistant reads it first, so it knows the startup
// apart from the app.
export const DESCRIPTION_MAX = 1000

export function describeWorkspace(wid: string, description: string) {
  return updateDoc(doc(db(), 'workspaces', wid), { description: description.trim().slice(0, DESCRIPTION_MAX) })
}

// Every subcollection under workspaces/{wid}; Firestore doesn't cascade deletes.
// `domains` and `groups` are retired (D-048, D-049) but older workspaces may still hold some.
const WORKSPACE_COLLECTIONS = [
  'labels', 'domains', 'customers', 'problems', 'ideas', 'edges', 'groups', 'features', 'competitors', 'competitorFeatures', 'comparisons', 'evidence', 'planes', 'placements', 'packages',
  ...(attachmentsAvailable ? ['attachments'] : []),
]
const BATCH_LIMIT = 450

// Owners only. Children go first: their rules check membership on the workspace doc. Attachment files go before any
// doc (storage.rules check membership the same way), so none are left behind.
export async function deleteWorkspace(wid: string, inviteCode: string, uid: string) {
  await deleteAttachmentFiles(wid)
  const reports = await Promise.all([
    // Reports (D-090): the shared ones and yours. Others' private reports can't be read here; the
    // cleanUpWorkspaceAi function takes them once functions are deployed.
    getDocs(query(collection(db(), 'workspaces', wid, 'reports'), where('shared', '==', true))),
    getDocs(query(collection(db(), 'workspaces', wid, 'reports'), where('uid', '==', uid))),
  ])
  const snaps = await Promise.all([
    ...WORKSPACE_COLLECTIONS.map((c) => getDocs(collection(db(), 'workspaces', wid, c))),
    getDocs(query(collection(db(), 'joinRequests'), where('workspaceId', '==', wid))),
    getDocs(collection(db(), 'workspaces', wid, 'members')),
  ])
  // A report's body (D-098) goes before its summary, which its rule reads.
  const reportRefs = reports.flatMap((r) => r.docs.map((d) => d.ref))
  const bodies = reportRefs.map((r) => doc(r, 'content', 'body'))
  // Once each: your own shared reports come back from both report queries.
  const refs = [
    ...new Map(
      [...bodies, ...snaps.flatMap((s) => s.docs.map((d) => d.ref)), ...reportRefs].map((r) => [r.path, r] as const),
    ).values(),
  ]
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

// Anyone but the last owner may leave (D-098); your entry in the people list goes first, while you're still a member.
export async function leaveWorkspace(wid: string, uid: string) {
  await deleteDoc(memberRef(wid, uid)).catch(() => {})
  await updateDoc(doc(db(), 'workspaces', wid), {
    memberIds: arrayRemove(uid),
    [`roles.${uid}`]: deleteField(),
  })
}
