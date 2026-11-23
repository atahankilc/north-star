// What RTDB's rules know about Firestore (D-426): they can't read it, so a function copies the two facts they check.
// - `access/{wid}/{uid}`: each member's role (D-098), read by presence's rules (D-317) and writing together's (D-374).
// - `docAccess/{wid}/{id}`: a document's author, sharing and kind, what firestore.rules' `mayRead`/`mayWrite` read.
// Kept apart from index.ts so it's tested without Firebase.
import type { Workspace } from './access.js'

export type Role = 'owner' | 'editor' | 'viewer'
const ROLES: readonly string[] = ['owner', 'editor', 'viewer']

// Every member with a known role; nothing for a workspace that's gone (null deletes the node).
export function accessOf(ws: Workspace | undefined): Record<string, Role> | null {
  if (!ws) return null
  const out: Record<string, Role> = {}
  for (const uid of ws.memberIds ?? []) {
    const role = ws.roles?.[uid]
    if (role && ROLES.includes(role) && /^[A-Za-z0-9_-]{1,128}$/.test(uid)) out[uid] = role as Role
  }
  return Object.keys(out).length ? out : null
}

export type DocAccess = { uid: string; shared: boolean; kind: string }
type DocSummary = { uid?: unknown; shared?: unknown; kind?: unknown }

// The three fields the rules read, or null for a document that's gone.
export function docAccessOf(d: DocSummary | undefined): DocAccess | null {
  if (!d || typeof d.uid !== 'string' || typeof d.kind !== 'string') return null
  return { uid: d.uid, shared: d.shared === true, kind: d.kind }
}

// Whether a write changed what's mirrored (a rename or a new member list without new roles needs no copy).
export const sameAccess = (a: Workspace | undefined, b: Workspace | undefined) =>
  JSON.stringify(accessOf(a)) === JSON.stringify(accessOf(b))
export const sameDocAccess = (a: DocSummary | undefined, b: DocSummary | undefined) =>
  JSON.stringify(docAccessOf(a)) === JSON.stringify(docAccessOf(b))
