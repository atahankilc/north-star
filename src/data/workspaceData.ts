// Everything in one workspace, live. Loaded once by the workspace layout (D-036). Today that's the canvas's pieces
// (D-176); what the old views loaded is in src/archive/data/workspaceData.ts and comes back as each piece does (D-177).
import type { WithId } from './hooks'
import { useWorkspaceCollection } from './hooks'
import type { Piece } from './model'

export type WorkspaceData = {
  pieces: WithId<Piece>[]
}

export function useWorkspaceData(wid: string): { data: WorkspaceData; isLoading: boolean; error: Error | null } {
  const pieces = useWorkspaceCollection<Piece>(wid, 'pieces')
  return { data: { pieces: pieces.data }, isLoading: pieces.isLoading, error: pieces.error }
}
