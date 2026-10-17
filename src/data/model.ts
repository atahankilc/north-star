// Firestore data model: the logical model from docs/ARCHITECTURE.md §5.
//
//   workspaces/{workspaceId}                 Workspace
//     ideas/{id}                             Idea
//     groups/{id}                            Group
//     features/{id}                          Feature
//     competitors/{id}                       Competitor
//     competitorFeatures/{id}                CompetitorFeature
//     comparisons/{id}                       Comparison
//     edges/{id}                             Edge (any node ↔ any node)
//   inviteCodes/{code}                       InviteCode (D-012)
//
// Realtime Database (ephemeral):
//   presence/{workspaceId}/{uid}             Presence (D-016)

export type Role = 'owner' | 'editor'

export type Workspace = {
  name: string
  description?: string
  ownerId: string
  memberIds: string[]
  roles: Record<string, Role>
  inviteCode: string
  // Set by a joining member; the rules check it against inviteCode (D-012).
  joinCode?: string
  createdAt: number
}

export type InviteCode = {
  workspaceId: string
  createdBy: string
}

export type NodeType = 'idea' | 'group' | 'feature' | 'competitor' | 'competitorFeature'

// Node types that live on a board as cards (D-037).
export type BoardType = 'idea' | 'feature'

// Fields shared by every board card.
export type BoardNode = {
  title: string
  body?: string
  color?: string
  tags?: string[]
  x: number
  y: number
  z?: number
  createdAt: number
  updatedAt: number
}

export type Idea = BoardNode & {
  status?: string
  groupIds?: string[]
}

export type Group = { name: string; color?: string }

export const FEATURE_PRIORITIES = ['P1', 'P2', 'P3'] as const
export const FEATURE_STATUSES = ['idea', 'planned', 'building', 'shipped'] as const
export const FEATURE_EFFORTS = ['S', 'M', 'L'] as const

export type Feature = BoardNode & {
  priority?: (typeof FEATURE_PRIORITIES)[number]
  status?: (typeof FEATURE_STATUSES)[number]
  effort?: (typeof FEATURE_EFFORTS)[number]
}

export type Competitor = {
  name: string
  url?: string
  description?: string
  pricing?: string
  audience?: string
  notes?: string
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

export type EdgeKind = 'relates' | 'depends-on' | 'contradicts' | 'part-of' | 'inspired-by' | (string & {})

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
