// Firestore data model: the logical model from docs/ARCHITECTURE.md §5. Only what's live (D-177); the old views' shapes
// (cards, links, matrix, planes, reports, threads…) are in src/archive/data/model.ts. Their data is still in older
// workspaces, and firestore.rules still knows it.
//
//   workspaces/{workspaceId}                 Workspace
//     pieces/{id}                            Piece (D-176): something on the canvas, a plane for now (D-180)
//     members/{uid}                          Member (D-098): a member's name and email, for the people list
//   inviteCodes/{code}                       InviteCode (D-012)
//   joinRequests/{workspaceId}_{uid}         JoinRequest (D-062)
//
// Realtime Database (ephemeral):
//   presence/{workspaceId}/{uid}             Presence (D-016)

// D-098: any number of owners (never none), editors, and viewers who read but don't change the workspace.
export type Role = 'owner' | 'editor' | 'viewer'
export const ROLES: readonly Role[] = ['owner', 'editor', 'viewer']

export type Workspace = {
  name: string
  // What the team is building (D-082), for people and the assistant.
  description?: string
  // Who created it. Authority comes from `roles` (D-098); this never changes.
  ownerId: string
  memberIds: string[]
  roles: Record<string, Role>
  inviteCode: string
  // Lowercased addresses the owner invited; accepting or declining removes yours (D-062).
  invitedEmails?: string[]
  // Retired (D-062): codes used to join directly. Older workspaces may still carry it.
  joinCode?: string
  createdAt: number
}

export type InviteCode = {
  workspaceId: string
  createdBy: string
}

// Someone entered the code and waits for the owner (D-062).
export type JoinRequest = {
  workspaceId: string
  // The workspace's creator when it was asked (unused since D-098: owners query by workspace).
  ownerId: string
  uid: string
  name: string
  email: string
  code: string
  createdAt: number
}

// Something placed on the workspace's canvas (D-174, D-176): for now a plane (D-180; earlier called a board, and stored
// as `kind: 'board'`, which still reads as a plane). World units are canvas pixels at zoom 1; x/y is its top-left corner.
// Not the archived `planes` collection (D-139): that was the old board's own layouts.
export type PieceKind = 'plane'
export type Piece = {
  kind: PieceKind
  x: number
  y: number
  w: number
  h: number
  name?: string
  createdAt: number
  updatedAt: number
}

// A member of a workspace as the people list shows them (D-098). Written by the member when they open it, or by an
// owner who lets them in. Their role is on the workspace (`roles`), not here.
export type Member = {
  name: string
  email?: string
  photo?: string
  joinedAt: number
}

export type Presence = {
  name: string
  color: string
  view: string
  x?: number
  y?: number
  ts: number
}
