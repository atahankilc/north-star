// Everything in one workspace, live. Loaded once by the workspace layout and shared by every view (D-036).
import type { WithId } from './hooks'
import { useWorkspaceCollection } from './hooks'
import type { Comparison, Competitor, CompetitorFeature, Customer, Edge, Feature, Idea, Label, Problem } from './model'

export type WorkspaceData = {
  labels: WithId<Label>[]
  customers: WithId<Customer>[]
  problems: WithId<Problem>[]
  ideas: WithId<Idea>[]
  features: WithId<Feature>[]
  competitors: WithId<Competitor>[]
  competitorFeatures: WithId<CompetitorFeature>[]
  comparisons: WithId<Comparison>[]
  edges: WithId<Edge>[]
}

export function useWorkspaceData(wid: string): { data: WorkspaceData; isLoading: boolean; error: Error | null } {
  const labels = useWorkspaceCollection<Label>(wid, 'labels')
  const customers = useWorkspaceCollection<Customer>(wid, 'customers')
  const problems = useWorkspaceCollection<Problem>(wid, 'problems')
  const ideas = useWorkspaceCollection<Idea>(wid, 'ideas')
  const features = useWorkspaceCollection<Feature>(wid, 'features')
  const competitors = useWorkspaceCollection<Competitor>(wid, 'competitors')
  const competitorFeatures = useWorkspaceCollection<CompetitorFeature>(wid, 'competitorFeatures')
  const comparisons = useWorkspaceCollection<Comparison>(wid, 'comparisons')
  const edges = useWorkspaceCollection<Edge>(wid, 'edges')
  const all = [labels, customers, problems, ideas, features, competitors, competitorFeatures, comparisons, edges]

  return {
    data: {
      labels: labels.data,
      customers: customers.data,
      problems: problems.data,
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
