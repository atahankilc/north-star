// The assistant's stage (D-094): what the app's box shows *now* while the assistant has something to show, a proposal's
// preview (D-087) or a report (D-089). The preview and report stores hold what is asked for; the stage follows them,
// but only once the app has broken apart, so the old screen never turns into the new one in place (AiChat's
// useStageMotion). While the chat is open and something is staged, the chat sits on the left and the stage on the right.
import { create } from 'zustand'
import type { Simulation } from '../../ai/simulate'

export type StagedPreview = Simulation & { messageId: number; count: number }

type StageState = {
  preview: StagedPreview | null
  reportId: string | null
}

export const useStage = create<StageState>(() => ({ preview: null, reportId: null }))

// Which checklist row is lit (D-096), by number: hovering it in the chat, hovering one of its items on the stage, or
// stepping to it. `step` is the stepper's place among the staged steps; `lit` follows it when stepping.
// Kept apart from the preview store so a hover doesn't restage the preview.
export const usePreviewFocus = create<{ lit: number | null; step: number | null }>(() => ({ lit: null, step: null }))

// Back to the step's row, or none.
export function unlight() {
  const step = usePreviewFocus.getState().step
  usePreviewFocus.setState({ lit: step === null ? null : (useStage.getState().preview?.steps[step]?.n ?? null) })
}

// What the staged preview does to one item, cell or label (D-096): its mark, the values an edit replaced, and whether
// its checklist row is lit. Everything undefined outside a preview.
export function useMarkOf(id: string) {
  const mark = useStage((s) => s.preview?.marks.get(id))
  const before = useStage((s) => s.preview?.before.get(id))
  const steps = useStage((s) => s.preview?.steps)
  const lit = usePreviewFocus((f) => f.lit !== null && !!steps?.find((st) => st.n === f.lit)?.ids.includes(id))
  return { mark, before, lit }
}

// Hovering a marked item on the stage lights its checklist row in the chat, and the reverse (AiProposal).
export function markHover(id: string) {
  return {
    onPointerEnter: () => {
      const step = useStage.getState().preview?.steps.find((s) => s.ids.includes(id))
      if (step) usePreviewFocus.setState({ lit: step.n })
    },
    onPointerLeave: unlight,
  }
}

// The same for a staged report (D-101): which section is lit, from hovering its row in the chat's report card or
// stepping to it on the stage. Sections by index.
export const useReportFocus = create<{ lit: number | null; step: number | null }>(() => ({ lit: null, step: null }))

export function unlightSection() {
  useReportFocus.setState((f) => ({ lit: f.step }))
}
