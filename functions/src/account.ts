// Deleting an account (D-432): what happens to each workspace the person is in. Kept apart from index.ts so it's tested
// without Firebase.
// - theirs alone: deleted whole;
// - shared, another owner there: they leave it; what they made in it stays, without their name;
// - shared and they're its only owner: nothing is deleted until they make someone else an owner or delete it.
import { isOwner, type Workspace } from './access.js'

export type Fate = 'delete' | 'leave' | 'blocked'

export function fateOf(ws: Workspace, uid: string): Fate | null {
  if (!ws.memberIds.includes(uid)) return null
  if (ws.memberIds.every((m) => m === uid)) return 'delete'
  if (!isOwner(ws, uid)) return 'leave'
  return ws.memberIds.some((m) => m !== uid && isOwner(ws, m)) ? 'leave' : 'blocked'
}

// Signed in again just now: an open laptop isn't enough to delete an account.
export const FRESH_S = 5 * 60
export const isFresh = (authTime: unknown, nowMs: number) => typeof authTime === 'number' && nowMs / 1000 - authTime < FRESH_S

export const GONE_NAME = 'Deleted account'
