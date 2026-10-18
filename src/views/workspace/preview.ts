// The assistant's preview (D-087): while it's open, every view shows the workspace as it would be with the proposal's
// ticked changes applied, and nothing can be written. `useWs()` hands out the previewed workspace everywhere except
// inside <OutsidePreview> (the assistant's own window, which must keep seeing the real one).
import { createContext } from 'react'
import { create } from 'zustand'
import { setReadOnly } from '../../data/history'
import { colors } from '../../styles/tokens'
import type { WorkspaceCtx } from './context'
import { useStage } from './stage'

// What a change does to an item (or a matrix cell), shown on it in every view.
export type Mark = 'new' | 'edited' | 'moved' | 'deleted'

type PreviewState = {
  // The chat message whose proposal is shown; null when closed.
  messageId: number | null
  ws: WorkspaceCtx | null
  marks: Map<string, Mark>
  count: number
  show: (messageId: number, ws: WorkspaceCtx, marks: Map<string, Mark>, count: number) => void
  close: () => void
}

const READ_ONLY = 'This is a preview: nothing changes here. Close it (Esc) to edit.'

export const usePreview = create<PreviewState>((set) => ({
  messageId: null,
  ws: null,
  marks: new Map(),
  count: 0,
  show: (messageId, ws, marks, count) => {
    setReadOnly(READ_ONLY)
    set({ messageId, ws, marks, count })
  },
  close: () => {
    setReadOnly(null)
    set({ messageId: null, ws: null, marks: new Map(), count: 0 })
  },
}))

// Marks are drawn like a collaborator's selection (rings and a name tag), in the dark theme's accents (themed later).
export const MARK_COLOR: Record<Mark, string> = { new: colors.cyan, edited: colors.yellow, moved: colors.blue, deleted: colors.magenta }
export const markTag = (m: Mark) => ({ uid: `preview:${m}`, name: m, color: MARK_COLOR[m] })

// Asked for or still on the stage (D-094): either way nothing may start an edit.
export const isPreviewing = () => usePreview.getState().ws !== null || useStage.getState().preview !== null

export const OutsidePreview = createContext(false)
