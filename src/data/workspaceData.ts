// Everything in one workspace, live. Loaded once by the workspace layout (D-036): the canvas's pieces (D-176), the
// cards on its planes (D-187), the text written anywhere (D-188), the matrices' cells (D-204), what hangs off the cards,
// the comment threads and the documents you may see.
import { useMemo, useRef } from 'react'
import { CARD_COLLECTION, type Card, type CardFields } from './cards'
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
import type { Place } from './places'
import type { Canvas, Spot } from './canvases'
import { canvasesFrom, cardsFrom, labelsFrom, piecesFrom, placedFrom, placesFrom, spotsFrom, threadsFrom, type RawDoc } from '../model/fromDocs'

export type WorkspaceData = {
  // The workspace's canvases in order, `main` first even without its doc (D-302).
  canvases: Canvas[]
  // Every piece, on every canvas (`canvasId`, D-302): what's drawn filters them to the one shown (`piecesOn`). One on
  // more than its own says them all (`canvases`, D-302's session 3).
  pieces: WithId<Piece>[]
  // Pieces on canvases besides their own (D-302's session 3); one whose piece or canvas is gone is skipped.
  spots: Spot[]
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
  // Cards on planes besides their home (D-281); one whose card or plane is gone is skipped.
  places: Place[]
}

type CardDoc = { pieceId?: string; title?: string; name?: string; x?: number; y?: number } & CardFields

// The list from before while it holds the same things in the same order: a list made again from unchanged parts (cards
// when only places changed, places when only cards did) doesn't draw anything again.
function useSame<T>(list: T[]): T[] {
  const kept = useRef(list)
  const was = kept.current
  if (was !== list && (was.length !== list.length || list.some((x, i) => x !== was[i]))) kept.current = list
  return kept.current
}

export function useWorkspaceData(wid: string): { data: WorkspaceData; isLoading: boolean; error: Error | null } {
  const pieces = useWorkspaceCollection<Piece>(wid, 'pieces')
  const canvasDocs = useWorkspaceCollection<Omit<Canvas, 'id'>>(wid, 'canvases')
  // Each step is src/model/fromDocs.ts' (the ops' project runs the same ones, S3).
  const canvases = useMemo(() => canvasesFrom(canvasDocs.data as RawDoc[]), [canvasDocs.data])
  const spotDocs = useWorkspaceCollection<Omit<Spot, 'id'>>(wid, 'pieceSpots')
  const spots = useSame(useMemo(() => spotsFrom(spotDocs.data as RawDoc[], pieces.data, canvases), [spotDocs.data, pieces.data, canvases]))
  // Each piece says the canvases it's on when that's more than its own; the others stay the same objects.
  const shared = useSame(useMemo(() => piecesFrom(pieces.data as unknown as RawDoc[], spots), [pieces.data, spots]))
  const customers = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.customer)
  const problems = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.problem)
  const competitors = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.competitor)
  const ideas = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.idea)
  const features = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.feature)
  // Packages (D-239).
  const packages = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.package)
  const labelDocs = useWorkspaceCollection<Omit<Label, 'id'>>(wid, 'labels')
  const labels = useSame(useMemo(() => labelsFrom(labelDocs.data as RawDoc[]), [labelDocs.data]))
  const cells = useWorkspaceCollection<Cell>(wid, 'cells')
  const evidence = useWorkspaceCollection<Omit<Evidence, 'id'>>(wid, 'evidence')
  const competitorFeatures = useWorkspaceCollection<Omit<CompetitorFeature, 'id'>>(wid, 'competitorFeatures')
  const comparisons = useWorkspaceCollection<Omit<Comparison, 'id'>>(wid, 'comparisons')
  const edges = useWorkspaceCollection<Omit<Edge, 'id'>>(wid, 'edges')
  const threadDocs = useWorkspaceCollection<Thread>(wid, 'threads')
  const tasks = useWorkspaceCollection<Omit<Task, 'id'>>(wid, 'tasks')
  const placeDocs = useWorkspaceCollection<Omit<Place, 'id'>>(wid, 'places')
  const threads = useSame(useMemo(() => threadsFrom(threadDocs.data as unknown as RawDoc[]), [threadDocs.data]))
  const { user } = useAuth()
  const documents = useDocuments(wid, user?.id)
  const cards = useMemo(
    () =>
      cardsFrom({
        customer: customers.data as RawDoc[],
        problem: problems.data as RawDoc[],
        competitor: competitors.data as RawDoc[],
        idea: ideas.data as RawDoc[],
        feature: features.data as RawDoc[],
        package: packages.data as RawDoc[],
      }),
    [customers.data, problems.data, competitors.data, ideas.data, features.data, packages.data],
  )
  const places = useSame(useMemo(() => placesFrom(placeDocs.data as RawDoc[], pieces.data, cards), [placeDocs.data, pieces.data, cards]))
  // Each card says the planes it's on when that's more than its home (D-281); the others stay the same objects.
  const placed = useSame(useMemo(() => placedFrom(cards, places), [cards, places]))
  const all = [canvasDocs, spotDocs, pieces, customers, problems, competitors, ideas, features, packages, labelDocs, cells, placeDocs]
  // The same object while nothing in it changed (the workspace's context is built from it).
  const data = useMemo(
    () => ({ canvases, spots, pieces: shared, cards: placed, labels, threads, cells: cells.data, evidence: evidence.data, competitorFeatures: competitorFeatures.data, comparisons: comparisons.data, edges: edges.data, documents: documents.data, tasks: tasks.data, places }),
    [canvases, spots, shared, placed, labels, threads, cells.data, evidence.data, competitorFeatures.data, comparisons.data, edges.data, documents.data, tasks.data, places],
  )
  return {
    data,
    isLoading: all.some((l) => l.isLoading),
    error: all.find((l) => l.error)?.error ?? null,
  }
}
