// Who a run works for, checked directly (D-434, docs/specs/agent-server.md §5.3): the workspace doc read with the admin
// SDK before each step, since a listener already open isn't told when its person is removed.
import type { Firestore } from 'firebase-admin/firestore'

export type Role = 'owner' | 'editor' | 'viewer'

export class NotAMember extends Error {
  constructor() {
    super('you are not in this workspace any more')
    this.name = 'NotAMember'
  }
}

// The person's role now; throws NotAMember when they aren't in it, or it's gone.
export async function roleNow(db: Firestore, wid: string, uid: string): Promise<Role> {
  const w = (await db.doc(`workspaces/${wid}`).get()).data() as { memberIds?: string[]; roles?: Record<string, string> } | undefined
  if (!w?.memberIds?.includes(uid)) throw new NotAMember()
  const role = w.roles?.[uid]
  return role === 'owner' || role === 'editor' ? role : 'viewer'
}
