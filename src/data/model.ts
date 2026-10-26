// Firestore data model: the logical model from docs/ARCHITECTURE.md §5. Cards, links, text, evidence and competitor
// features have their own modules in src/data/; the rest is here.
//
//   workspaces/{workspaceId}                 Workspace
//     pieces/{id}                            Piece (D-176): something on the canvas, a plane (D-180), a matrix (D-204)…
//     documents/{id}                         Doc (D-232, src/data/documents.ts): a file the workspace keeps
//       content/body                         DocBody: a .md's text, a report's sections
//     cells/{matrixId}_{row}_{col}           Cell (D-204): one of a matrix's or a table's (D-209) cells (src/data/matrix.ts)
//     tasks/{id}                             Task (D-251): one of a kanban's tasks (src/data/tasks.ts)
//     members/{uid}                          Member (D-098): a member's name and email, for the people list
//     threads/{id}, messages/{id}            Thread, ThreadMessage (D-159, D-192)
//     reports/{id}                           an old research report, moved to documents once (documents.ts' moveReports)
//   inviteCodes/{code}                       InviteCode (D-012)
//   joinRequests/{workspaceId}_{uid}         JoinRequest (D-062)
//
// Realtime Database (ephemeral):
//   presence/{workspaceId}/{uid}             Presence (D-016)

import type { DocumentsSetup } from './documents'
import type { KanbanSetup } from './tasks'
import type { MatrixSetup } from './matrix'
import type { TableSetup } from './table'

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
  createdAt: number
}

export type InviteCode = {
  workspaceId: string
  createdBy: string
}

// Someone entered the code and waits for the owner (D-062).
export type JoinRequest = {
  workspaceId: string
  uid: string
  name: string
  email: string
  code: string
  createdAt: number
}

// Something placed on the workspace's canvas (D-174, D-176): a plane (D-180). World units are canvas pixels at zoom 1;
// x/y is its top-left corner.
// A matrix (D-204): two lists crossed, its cells filled; its setup on the piece, its cells in `cells`.
// A table (D-209): rows from rules, columns of the cards' fields and its own; its own columns' values in `cells`.
// Documents (D-232): `documents` lists them, `document` shows one on its own.
// A kanban (D-251): its columns on the piece, its tasks in `tasks`.
export type PieceKind = 'plane' | 'matrix' | 'table' | 'documents' | 'document' | 'kanban'
export type Piece = {
  kind: PieceKind
  x: number
  y: number
  w: number
  h: number
  name?: string
  matrix?: MatrixSetup
  table?: TableSetup
  // A documents list's view, kinds, sort, page size (D-232).
  documents?: DocumentsSetup
  // The document a document piece shows (D-232).
  docId?: string
  // A kanban's columns (D-251).
  kanban?: KanbanSetup
  // A matrix or a table stuck to a plane's edge (D-210): moved with it, showing its cards.
  stuckTo?: string
  // A matrix or a table opened onto the canvas (D-228): out of its window, at its own size and live there. Its w/h stay
  // the window's, for when it's closed again.
  open?: boolean
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

// A comment thread (D-159, D-193): a conversation on a component: a card, text, a link or a plane (`plane`). Any member
// may start one or answer, viewers too; it's not content, so it's not undone, copied, exported or filtered. `x`/`y` is
// where the thing was when the thread began, used when the thing is gone. `count` and `lastAt` follow its messages.
export const THREAD_TARGETS = ['card', 'label', 'link', 'plane'] as const
export type ThreadTarget = (typeof THREAD_TARGETS)[number]
export const MESSAGE_MAX = 2000

export type Thread = {
  on: ThreadTarget
  // What it's on: the card's, label's, link's or plane's id.
  targetId: string
  // The space it's in (D-192): `canvas` or a plane's id.
  planeId: string
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
