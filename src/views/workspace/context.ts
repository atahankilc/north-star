import { createContext, useContext } from 'react'
import type { WithId } from '../../data/hooks'
import type { Workspace } from '../../data/model'
import type { WorkspaceData } from '../../data/workspaceData'

export type WorkspaceCtx = WorkspaceData & {
  wid: string
  workspace: WithId<Workspace>
}

export const WorkspaceContext = createContext<WorkspaceCtx | null>(null)

export function useWs(): WorkspaceCtx {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWs() outside a workspace route')
  return ctx
}
