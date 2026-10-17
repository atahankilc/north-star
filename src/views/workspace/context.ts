import { createContext, useContext } from 'react'
import type { WithId } from '../../data/hooks'
import type { Workspace } from '../../data/model'
import type { WorkspaceData } from '../../data/workspaceData'
import { OutsidePreview, usePreview } from './preview'

export type WorkspaceCtx = WorkspaceData & { wid: string; workspace: WithId<Workspace> }

export const WorkspaceContext = createContext<WorkspaceCtx | null>(null)

// The previewed workspace while the assistant's preview is open (D-087), except inside the assistant itself.
export function useWs(): WorkspaceCtx {
  const ctx = useContext(WorkspaceContext)
  const outside = useContext(OutsidePreview)
  const preview = usePreview((s) => s.ws)
  if (!ctx) throw new Error('useWs() outside a workspace route')
  return preview && !outside && preview.wid === ctx.wid ? preview : ctx
}
