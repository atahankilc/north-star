// Everything in one workspace, live. Loaded once by the workspace layout (D-036): the canvas's pieces (D-176), the
// cards on its planes (D-187), the text written anywhere (D-188), the matrices' cells (D-204), what hangs off the cards,
// the comment threads and the documents you may see.
import { useMemo } from 'react'
import { CARD_COLLECTION, toCards, type Card, type CardFields } from './cards'
import type { WithId } from './hooks'
import { useWorkspaceCollection } from './hooks'
import type { Label } from './labels'
import type { Cell } from './matrix'
import type { Edge } from './edges'
import type { Evidence } from './evidence'
import type { Comparison, CompetitorFeature } from './competitorFeatures'
import type { Piece, Thread } from './model'
import { useAuth } from './auth'
import { useDocuments, type Doc } from './documents'
import type { Task } from './tasks'

export type WorkspaceData = {
  pieces: WithId<Piece>[]
  cards: Card[]
  // Text always has a space (`pieceId`); a doc without one isn't the app's and is skipped.
  labels: Label[]
  // Comment threads (D-192), each in a space (`planeId`); one without is skipped.
  threads: WithId<Thread>[]
  // Every matrix's cells (D-204).
  cells: Cell[]
  // What was learned about a card (D-137) and a competitor's features (D-164): counted on the cards (D-205).
  evidence: Evidence[]
  competitorFeatures: CompetitorFeature[]
  // Which of a competitor's features matches one of ours (D-221).
  comparisons: Comparison[]
  // Links between cards (D-207).
  edges: Edge[]
  // The documents you may see (D-232): the shared ones and your own, newest first. Summaries only.
  documents: WithId<Doc>[]
  // Every kanban's tasks (D-251).
  tasks: Task[]
}

type CardDoc = { pieceId?: string; title?: string; name?: string; x?: number; y?: number } & CardFields

export function useWorkspaceData(wid: string): { data: WorkspaceData; isLoading: boolean; error: Error | null } {
  const pieces = useWorkspaceCollection<Piece>(wid, 'pieces')
  const customers = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.customer)
  const problems = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.problem)
  const competitors = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.competitor)
  const ideas = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.idea)
  const features = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.feature)
  // Packages (D-239).
  const packages = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.package)
  const labelDocs = useWorkspaceCollection<Omit<Label, 'id'>>(wid, 'labels')
  const labels = useMemo(() => labelDocs.data.filter((l) => l.pieceId) as Label[], [labelDocs.data])
  const cells = useWorkspaceCollection<Cell>(wid, 'cells')
  const evidence = useWorkspaceCollection<Omit<Evidence, 'id'>>(wid, 'evidence')
  const competitorFeatures = useWorkspaceCollection<Omit<CompetitorFeature, 'id'>>(wid, 'competitorFeatures')
  const comparisons = useWorkspaceCollection<Omit<Comparison, 'id'>>(wid, 'comparisons')
  const edges = useWorkspaceCollection<Omit<Edge, 'id'>>(wid, 'edges')
  const threadDocs = useWorkspaceCollection<Thread>(wid, 'threads')
  const tasks = useWorkspaceCollection<Omit<Task, 'id'>>(wid, 'tasks')
  const threads = useMemo(() => threadDocs.data.filter((t) => t.planeId), [threadDocs.data])
  const { user } = useAuth()
  const documents = useDocuments(wid, user?.id)
  const cards = useMemo(
    () => [
      ...toCards('customer', customers.data),
      ...toCards('problem', problems.data),
      ...toCards('competitor', competitors.data),
      ...toCards('idea', ideas.data),
      ...toCards('feature', features.data),
      ...toCards('package', packages.data),
    ],
    [customers.data, problems.data, competitors.data, ideas.data, features.data, packages.data],
  )
  const all = [pieces, customers, problems, competitors, ideas, features, packages, labelDocs, cells]
  return {
    data: { pieces: pieces.data, cards, labels, threads, cells: cells.data, evidence: evidence.data, competitorFeatures: competitorFeatures.data, comparisons: comparisons.data, edges: edges.data, documents: documents.data, tasks: tasks.data },
    isLoading: all.some((l) => l.isLoading),
    error: all.find((l) => l.error)?.error ?? null,
  }
}
