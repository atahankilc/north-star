// The assistant's stage (D-094): what the app's box shows *now* while the assistant has something to show, a proposal's
// preview (D-087) or a report (D-089). The preview and report stores hold what is asked for; the stage follows them,
// but only once the app has broken apart, so the old screen never turns into the new one in place (AiChat's
// useStageMotion). While the chat is open and something is staged, the chat sits on the left and the stage on the right.
import { create } from 'zustand'
import type { WorkspaceCtx } from './context'
import type { Mark } from './preview'

export type StagedPreview = { messageId: number; ws: WorkspaceCtx; marks: Map<string, Mark>; count: number }

type StageState = {
  preview: StagedPreview | null
  reportId: string | null
}

export const useStage = create<StageState>(() => ({ preview: null, reportId: null }))

const NO_MARKS = new Map<string, Mark>()
export const useStagedMarks = () => useStage((s) => s.preview?.marks ?? NO_MARKS)
