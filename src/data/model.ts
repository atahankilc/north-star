// Firestore data model: the logical model from docs/ARCHITECTURE.md §5. Only what's live (D-177); the old views' shapes
// (cards, links, matrix, planes, reports, threads…) are in src/archive/data/model.ts. Their data is still in older
// workspaces, and firestore.rules still knows it.
//
//   workspaces/{workspaceId}                 Workspace
//     pieces/{id}                            Piece (D-176): something on the canvas, a plane (D-180) or a matrix (D-204)
//     cells/{matrixId}_{row}_{col}           Cell (D-204): one of a matrix's cells (src/data/matrix.ts)
//     members/{uid}                          Member (D-098): a member's name and email, for the people list
//   inviteCodes/{code}                       InviteCode (D-012)
//   joinRequests/{workspaceId}_{uid}         JoinRequest (D-062)
//
// Realtime Database (ephemeral):
//   presence/{workspaceId}/{uid}             Presence (D-016)

import type { MatrixSetup } from './matrix'

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

// Something placed on the workspace's canvas (D-174, D-176): a plane (D-180; earlier called a board, and stored
// as `kind: 'board'`, which still reads as a plane). World units are canvas pixels at zoom 1; x/y is its top-left corner.
// Not the archived `planes` collection (D-139): that was the old board's own layouts.
// A matrix (D-204): two lists crossed, its cells filled; its setup on the piece, its cells in `cells`.
export type PieceKind = 'plane' | 'matrix'
export type Piece = {
  kind: PieceKind
  x: number
  y: number
  w: number
  h: number
  name?: string
  matrix?: MatrixSetup
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

// A comment thread (D-159): a conversation pinned to something on the board (a card, text, a section, a sticky note,
// a link) or to a spot on it. Any member may start one or answer, viewers too; it's not content, so it's not undone,
// copied, exported or filtered. `x`/`y` is where it was pinned (a spot's place, or the thing's when the thread began),
// used when the thing is gone. `count` and `lastAt` follow its messages.
// `plane` (D-193): a plane on the canvas. New threads go on components only; `spot` is the old board's.
export const THREAD_TARGETS = ['card', 'label', 'link', 'spot', 'plane'] as const
export type ThreadTarget = (typeof THREAD_TARGETS)[number]
export const MESSAGE_MAX = 2000

export type Thread = {
  on: ThreadTarget
  // What it's on: the card's, label's or link's id (none for a spot).
  targetId?: string
  // The space it's in (D-192): `canvas` or a plane's id. Threads from the old board have none and aren't shown.
  planeId?: string
  x: number
  y: number
  uid: string
  name: string
  count: number
  lastAt: number
  // Who wrote the last message and how it began (D-166), so a thread is only new to the others and the threads panel
  // can show it without loading every thread's messages.
  lastUid?: string
  lastName?: string
  lastText?: string
  // Everyone mentioned in it (D-166), so it shows under their mentions.
  mentions?: string[]
  resolved?: boolean
  resolvedBy?: string
  createdAt: number
  updatedAt: number
}

export type ThreadMessage = {
  uid: string
  name: string
  text: string
  // Who it mentions (D-166), as `@Full Name` in the text.
  mentions?: string[]
  createdAt: number
  editedAt?: number
}
export const MENTIONS_MAX = 20

// What you've read of the workspace's threads (D-166), yours only: each thread's `lastAt` when you last saw it.
export type ThreadReads = { seen: Record<string, number>; updatedAt: number }
