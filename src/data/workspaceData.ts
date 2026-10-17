// Everything in one workspace, live. Loaded once by the workspace layout and shared by every view (D-036).
import type { WithId } from './hooks'
import { useWorkspaceCollection } from './hooks'
import type { Comparison, Competitor, CompetitorFeature, Edge, Feature, Idea } from './model'

export type WorkspaceData = {
  ideas: WithId<Idea>[]
  features: WithId<Feature>[]
  competitors: WithId<Competitor>[]
  competitorFeatures: WithId<CompetitorFeature>[]
  comparisons: WithId<Comparison>[]
  edges: WithId<Edge>[]
}

export function useWorkspaceData(wid: string): { data: WorkspaceData; isLoading: boolean; error: Error | null } {
  const ideas = useWorkspaceCollection<Idea>(wid, 'ideas')
  const features = useWorkspaceCollection<Feature>(wid, 'features')
  const competitors = useWorkspaceCollection<Competitor>(wid, 'competitors')
  const competitorFeatures = useWorkspaceCollection<CompetitorFeature>(wid, 'competitorFeatures')
  const comparisons = useWorkspaceCollection<Comparison>(wid, 'comparisons')
  const edges = useWorkspaceCollection<Edge>(wid, 'edges')
  const all = [ideas, features, competitors, competitorFeatures, comparisons, edges]

  return {
    data: {
      ideas: ideas.data,
      features: features.data,
      competitors: competitors.data,
      competitorFeatures: competitorFeatures.data,
      comparisons: comparisons.data,
      edges: edges.data,
    },
    isLoading: all.some((l) => l.isLoading),
    error: all.find((l) => l.error)?.error ?? null,
  }
}
