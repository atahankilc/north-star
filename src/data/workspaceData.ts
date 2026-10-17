// Everything in one workspace, live. Loaded once by the workspace layout and shared by every view (D-036).
import { collection } from 'firebase/firestore'
import { attachmentsAvailable } from './attachments'
import { db } from './firebase'
import type { WithId } from './hooks'
import { useQuery, useWorkspaceCollection } from './hooks'
import type { Attachment, Comparison, Competitor, CompetitorFeature, Customer, Edge, Feature, Idea, Label, Problem, SavedReport } from './model'
import { useReports } from './reports'

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
  // Empty where attachments aren't available yet (D-083).
  attachments: WithId<Attachment>[]
  // The research reports you may see (D-090): shared ones and your own, newest first.
  reports: WithId<SavedReport>[]
}

export function useWorkspaceData(wid: string, uid: string | undefined): { data: WorkspaceData; isLoading: boolean; error: Error | null } {
  const labels = useWorkspaceCollection<Label>(wid, 'labels')
  const customers = useWorkspaceCollection<Customer>(wid, 'customers')
  const problems = useWorkspaceCollection<Problem>(wid, 'problems')
  const ideas = useWorkspaceCollection<Idea>(wid, 'ideas')
  const features = useWorkspaceCollection<Feature>(wid, 'features')
  const competitors = useWorkspaceCollection<Competitor>(wid, 'competitors')
  const competitorFeatures = useWorkspaceCollection<CompetitorFeature>(wid, 'competitorFeatures')
  const comparisons = useWorkspaceCollection<Comparison>(wid, 'comparisons')
  const edges = useWorkspaceCollection<Edge>(wid, 'edges')
  const attachments = useQuery<Attachment>(
    attachmentsAvailable ? collection(db(), 'workspaces', wid, 'attachments') : null,
    `${wid}/attachments`,
  )
  const reports = useReports(wid, uid)
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
      attachments: attachments.data,
      reports: reports.data,
    },
    // Attachment records and reports don't hold the workspace's loading screen: the board needs only their counts, which fill in.
    isLoading: all.some((l) => l.isLoading),
    error: [...all, attachments, reports].find((l) => l.error)?.error ?? null,
  }
}
