// Everything in one workspace, live. Loaded once by the workspace layout (D-036): the canvas's pieces (D-176), the
// cards on its planes (D-187) and the text written anywhere (D-188). What the old views loaded is in src/archive/data/workspaceData.ts and comes back as each
// piece does (D-177).
import { useMemo } from 'react'
import { CARD_COLLECTION, toCards, type Card } from './cards'
import type { WithId } from './hooks'
import { useWorkspaceCollection } from './hooks'
import type { Label } from './labels'
import type { Piece, Thread } from './model'

export type WorkspaceData = {
  pieces: WithId<Piece>[]
  cards: Card[]
  // Only the ones with a space (`pieceId`): the old board's labels aren't shown.
  labels: Label[]
  // Comment threads with a space (`planeId`, D-192): the old board's aren't shown.
  threads: WithId<Thread>[]
}

type CardDoc = { pieceId?: string; title?: string; name?: string; x?: number; y?: number }

export function useWorkspaceData(wid: string): { data: WorkspaceData; isLoading: boolean; error: Error | null } {
  const pieces = useWorkspaceCollection<Piece>(wid, 'pieces')
  const customers = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.customer)
  const problems = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.problem)
  const competitors = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.competitor)
  const ideas = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.idea)
  const features = useWorkspaceCollection<CardDoc>(wid, CARD_COLLECTION.feature)
  const labelDocs = useWorkspaceCollection<Omit<Label, 'id'>>(wid, 'labels')
  const labels = useMemo(() => labelDocs.data.filter((l) => l.pieceId) as Label[], [labelDocs.data])
  const threadDocs = useWorkspaceCollection<Thread>(wid, 'threads')
  const threads = useMemo(() => threadDocs.data.filter((t) => t.planeId), [threadDocs.data])
  const cards = useMemo(
    () => [
      ...toCards('customer', customers.data),
      ...toCards('problem', problems.data),
      ...toCards('competitor', competitors.data),
      ...toCards('idea', ideas.data),
      ...toCards('feature', features.data),
    ],
    [customers.data, problems.data, competitors.data, ideas.data, features.data],
  )
  const all = [pieces, customers, problems, competitors, ideas, features, labelDocs]
  return {
    data: { pieces: pieces.data, cards, labels, threads },
    isLoading: all.some((l) => l.isLoading),
    error: all.find((l) => l.error)?.error ?? null,
  }
}
