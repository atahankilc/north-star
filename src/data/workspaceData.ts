// Everything in one workspace, live. Loaded once by the workspace layout and shared by every view (D-036).
import { collection } from 'firebase/firestore'
import { attachmentsAvailable } from './attachments'
import { db } from './firebase'
import type { WithId } from './hooks'
import { useQuery, useWorkspaceCollection } from './hooks'
import type { Attachment, Comparison, Competitor, CompetitorFeature, Customer, Edge, Evidence, Feature, Idea, Label, Package, Placement, Plane, Problem } from './model'

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
  // What was learned about customers, problems and ideas (D-137): small, and counted on the cards, so loaded up front.
  evidence: WithId<Evidence>[]
  // Planes and where cards sit on them (D-139); All has neither.
  planes: WithId<Plane>[]
  // Packages (D-141): cards holding a piece of the chain.
  packages: WithId<Package>[]
  placements: WithId<Placement>[]
  // Empty where attachments aren't available yet (D-083).
  attachments: WithId<Attachment>[]
  // Reports aren't here (D-098): the reports tab, the report screen and the chat each load what they show.
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
  const evidence = useWorkspaceCollection<Evidence>(wid, 'evidence')
  const planes = useWorkspaceCollection<Plane>(wid, 'planes')
  const packages = useWorkspaceCollection<Package>(wid, 'packages')
  const placements = useWorkspaceCollection<Placement>(wid, 'placements')
  const attachments = useQuery<Attachment>(
    attachmentsAvailable ? collection(db(), 'workspaces', wid, 'attachments') : null,
    `${wid}/attachments`,
  )
  // Planes (D-139) draw the board, so they hold the loading screen; like evidence, they can't fail the workspace.
  const all = [labels, customers, problems, ideas, features, competitors, competitorFeatures, comparisons, edges]
  const loadingPlanes = planes.isLoading || placements.isLoading || packages.isLoading

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
      evidence: evidence.data,
      planes: planes.data,
      packages: packages.data,
      placements: placements.data,
      attachments: attachments.data,
    },
    // Attachment records and evidence (D-137) don't hold the workspace's loading screen: the board needs only their
    // counts, which fill in. Evidence can't fail the workspace either (a rule not deployed yet reads as none).
    isLoading: all.some((l) => l.isLoading) || loadingPlanes,
    error: [...all, attachments].find((l) => l.error)?.error ?? null,
  }
}
