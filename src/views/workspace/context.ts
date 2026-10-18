import { createContext, useContext } from 'react'
import type { WithId } from '../../data/hooks'
import type { Workspace } from '../../data/model'
import type { WorkspaceData } from '../../data/workspaceData'
import { OutsidePreview } from './preview'
import { useStage } from './stage'

// `plane`: set when the board shows a plane other than All (D-139), with every card's place on All.
export type WorkspaceCtx = WorkspaceData & {
  wid: string
  workspace: WithId<Workspace>
  plane?: { id: string; allSpots: { x: number; y: number }[] }
}

export const WorkspaceContext = createContext<WorkspaceCtx | null>(null)

// The previewed workspace while the assistant's preview is on the stage (D-087, D-094), except inside the assistant itself.
export function useWs(): WorkspaceCtx {
  const ctx = useContext(WorkspaceContext)
  const outside = useContext(OutsidePreview)
  const preview = useStage((s) => s.preview?.ws)
  if (!ctx) throw new Error('useWs() outside a workspace route')
  return preview && !outside && preview.wid === ctx.wid ? preview : ctx
}
