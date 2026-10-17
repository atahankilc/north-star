import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { useDoc, useQuery } from './hooks'
import type { InviteCode, Workspace } from './model'

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

// D-012: look the code up, then add yourself. The rules check the code matches the workspace.
export async function joinWorkspace(rawCode: string, uid: string): Promise<string> {
  const code = normalizeInviteCode(rawCode)
  if (!code) throw new JoinError('Enter an invite code.')
  const snap = await getDoc(doc(db(), 'inviteCodes', code))
  if (!snap.exists()) throw new JoinError('That invite code does not exist.')
  const { workspaceId } = snap.data() as InviteCode

  try {
    await updateDoc(doc(db(), 'workspaces', workspaceId), {
      memberIds: arrayUnion(uid),
      [`roles.${uid}`]: 'editor',
      joinCode: code,
    })
  } catch (e) {
    // Already a member: the join rule refuses, but there's nothing to do.
    const ws = await getDoc(doc(db(), 'workspaces', workspaceId)).catch(() => null)
    if (ws?.exists()) return workspaceId
    throw new JoinError('This invite code is no longer valid.', { cause: e })
  }
  return workspaceId
}

export function renameWorkspace(wid: string, name: string) {
  return updateDoc(doc(db(), 'workspaces', wid), { name: name.trim() || 'Untitled' })
}

// Every subcollection under workspaces/{wid}; Firestore doesn't cascade deletes.
const WORKSPACE_COLLECTIONS = ['domains', 'customers', 'problems', 'ideas', 'edges', 'groups', 'features', 'competitors', 'competitorFeatures', 'comparisons']
const BATCH_LIMIT = 450

// Owner only. Children go first: their rules check membership on the workspace doc.
export async function deleteWorkspace(wid: string, inviteCode: string) {
  const snaps = await Promise.all(WORKSPACE_COLLECTIONS.map((c) => getDocs(collection(db(), 'workspaces', wid, c))))
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
