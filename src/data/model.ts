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

export type Idea = {
  title: string
  body?: string
  color?: string
  tags?: string[]
  status?: string
  groupIds?: string[]
  x: number
  y: number
  z?: number
  createdAt: number
  updatedAt: number
}

export type Group = { name: string; color?: string }

export type Feature = {
  name: string
  description?: string
  priority?: string
  status?: string
  effort?: string
  createdAt: number
}

export type Competitor = {
  name: string
  url?: string
  description?: string
  pricing?: string
  audience?: string
  notes?: string
  createdAt: number
}

export type CompetitorFeature = {
  competitorId: string
  name: string
  description?: string
  category?: string
  x?: number
  y?: number
}

export type Coverage = 'none' | 'partial' | 'full' | 'better'

export type Comparison = {
  featureId: string
  competitorId: string
  coverage: Coverage
  notes?: string
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
