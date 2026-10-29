// Who may spend a workspace's OpenAI key (D-079, D-098, D-318): kept apart from index.ts so it's tested without Firebase.
export type Access = 'everyone' | 'chosen'
export type Workspace = { ownerId: string; memberIds: string[]; roles?: Record<string, string> }

// Any number of owners (D-098); `ownerId` is only who created it.
export const isOwner = (ws: Workspace, uid: string | undefined) => !!uid && ws.memberIds.includes(uid) && ws.roles?.[uid] === 'owner'

// Owners always; other members when the owners let everyone or chose them; a viewer never, whatever was chosen (viewers
// call with their own key only, D-318).
export function mayUseKey(ws: Workspace, uid: string, config: { access?: Access; allowed?: string[] }): boolean {
  if (!ws.memberIds.includes(uid)) return false
  if (isOwner(ws, uid)) return true
  if ((ws.roles?.[uid] ?? 'viewer') === 'viewer') return false
  return config.access === 'everyone' || (config.allowed ?? []).includes(uid)
}
