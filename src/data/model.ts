// Firestore data model: the logical model from docs/ARCHITECTURE.md §5.
//
//   workspaces/{workspaceId}                 Workspace
//     customers/{id}                         Customer (D-042, D-044)
//     problems/{id}                          Problem (D-041)
//     ideas/{id}                             Idea
//     labels/{id}                            Label: text on the board, a place to jump to (D-050)
//     features/{id}                          Feature
//     competitors/{id}                       Competitor
//     competitorFeatures/{id}                CompetitorFeature
//     comparisons/{id}                       Comparison
//     edges/{id}                             Edge (any node ↔ any node)
//   inviteCodes/{code}                       InviteCode (D-012)
//   joinRequests/{workspaceId}_{uid}         JoinRequest (D-062)
//
// Realtime Database (ephemeral):
//   presence/{workspaceId}/{uid}             Presence (D-016)

export type Role = 'owner' | 'editor'

export type Workspace = {
  name: string
  // What the team is building (D-082), for people and the assistant.
  description?: string
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
  // Copied from the workspace so the owner can query their requests.
  ownerId: string
  uid: string
  name: string
  email: string
  code: string
  createdAt: number
}

export type NodeType = 'customer' | 'problem' | 'idea' | 'feature' | 'competitor' | 'competitorFeature'

// Node types that live on the board as cards (D-040), in the order of the chain (D-045).
export const BOARD_TYPES = ['customer', 'problem', 'competitor', 'idea', 'feature'] as const
export type BoardType = (typeof BOARD_TYPES)[number]

// Fields shared by every board card.
export type BoardNode = {
  title: string
  body?: string
  // Retired (D-055): colour now means the card's type. Older cards may still carry it; it's ignored.
  color?: string
  tags?: string[]
  x: number
  y: number
  z?: number
  createdAt: number
  updatedAt: number
}

// Who it's for, at any breadth; also the segment (D-044). Items are tagged with `for` edges.
export type Customer = BoardNode

export type Problem = BoardNode

export type Idea = BoardNode & {
  status?: string
}

// Text written on the board (D-050). Every label is a place you can jump to.
export type Label = {
  text: string
  color?: string
  x: number
  y: number
  createdAt: number
  updatedAt: number
}

export const FEATURE_PRIORITIES = ['P1', 'P2', 'P3'] as const
export const FEATURE_STATUSES = ['idea', 'planned', 'building', 'shipped'] as const
export const FEATURE_EFFORTS = ['S', 'M', 'L'] as const

export type Feature = BoardNode & {
  priority?: (typeof FEATURE_PRIORITIES)[number]
  status?: (typeof FEATURE_STATUSES)[number]
  effort?: (typeof FEATURE_EFFORTS)[number]
}

// Competitors are named, not titled; on the board since D-040 (no position yet = placed on first view).
export type Competitor = {
  name: string
  // Grouping within competitors, like every other card (D-056).
  tags?: string[]
  url?: string
  description?: string
  pricing?: string
  audience?: string
  notes?: string
  color?: string
  x?: number
  y?: number
  createdAt: number
  updatedAt: number
}

// Listed on its competitor's page, grouped by category (D-038).
export type CompetitorFeature = {
  competitorId: string
  name: string
  description?: string
  category?: string
  createdAt: number
  updatedAt: number
}

export const COVERAGES = ['none', 'partial', 'full', 'better'] as const
export type Coverage = (typeof COVERAGES)[number]

// One matrix cell. Doc id is `${featureId}_${competitorId}`, so a cell can't be created twice.
export type Comparison = {
  featureId: string
  competitorId: string
  // Missing = not assessed yet.
  coverage?: Coverage
  notes?: string
  competitorFeatureId?: string
  updatedAt: number
}

// `for` tags an item with a customer (D-044): drawn as a label on the card, not a line.
export const FOR = 'for'
export type EdgeKind =
  | 'relates'
  | 'depends-on'
  | 'contradicts'
  | 'part-of'
  | 'inspired-by'
  | 'solves'
  | 'competes-with'
  | typeof FOR
  | (string & {})

export type Edge = {
  fromId: string
  fromType: NodeType
  toId: string
  toType: NodeType
  kind: EdgeKind
  label?: string
}

export type Presence = {
  name: string
  color: string
  view: string
  x?: number
  y?: number
  ts: number
}
