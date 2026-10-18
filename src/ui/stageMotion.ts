// How the assistant's stage changes (D-094). When a preview or a report opens while the chat is open, the chat glides
// across to the left; the app breaks apart cell by cell, and the stage builds up on the right in the chat's wake (from
// the right edge, which the chat leaves first). Closing runs it back: the chat glides right and the app builds up from
// the left. Switching between a preview and a report breaks the stage apart and rebuilds it in place.
// Under reduced motion, on narrow screens (the chat covers everything) or with the chat closed, it all happens at once.
import { useEffect } from 'react'
import { useChat } from '../ai/chat'
import { useCanvas } from '../state/canvasStore'
import { isReducedMotion } from '../state/motion'
import { usePreview } from '../views/workspace/preview'
import { useStage, type StagedPreview } from '../views/workspace/stage'
import { runCells } from './Appear'

// The crossing takes about as long as the app's break-up plus the stage's build-up, so both end as the chat lands.
// Eased in and out, so you see it travel (an ease-out had it across in a tenth of a second).
export const CROSS_MS = 700
const CROSS_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'
const OUT_MS = 220
// How long the chat takes to slide away (AiChat's SLIDE).
const CHAT_SLIDE_MS = 600
const IN_MS = 460

type Staged = { preview: StagedPreview | null; reportId: string | null }

// What the stores ask for: a preview wins over a report (they close each other anyway, ReportView).
function wanted(): Staged {
  const p = usePreview.getState()
  if (p.sim && p.messageId !== null) return { preview: { ...p.sim, messageId: p.messageId, count: p.count }, reportId: null }
  return { preview: null, reportId: useChat.getState().reportOpen }
}

const kindOf = (s: Staged) => (s.preview ? 'preview' : s.reportId ? 'report' : null)
const narrow = () => window.matchMedia('(max-width: 760px)').matches

// The chat's side: `html[data-ai-left]` moves the window (AiChat.module.css; the orb follows its edge, perch.ts). Animated, it
// slides from where it was (FLIP), so the CSS stays the one place that says where it sits.
function setSide(left: boolean, animate: boolean) {
  const html = document.documentElement
  if (html.hasAttribute('data-ai-left') === left) return
  const els = animate ? [...document.querySelectorAll<HTMLElement>('[data-ai-window]')] : []
  const before = els.map((el) => el.getBoundingClientRect().left)
  html.toggleAttribute('data-ai-left', left)
  els.forEach((el, i) => {
    const dx = before[i] - el.getBoundingClientRect().left
    if (Math.abs(dx) < 0.5) return
    el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], { duration: CROSS_MS, easing: CROSS_EASE, composite: 'add' })
  })
}

export function useStageMotion() {
  useEffect(() => {
    const html = document.documentElement
    const app = () => document.querySelector<HTMLElement>('[data-app]')
    let busy = false
    let stopCells = () => {}
    // The chat is sliding away with a preview staged beside it: the preview ends with it, and the stage still breaks apart
    // and the app builds back up in place, while the chat goes down where it is (it takes its side again once it's gone).
    let closing = false
    let sideBack = 0

    // A preview glides the board to its changes; closing it puts back the view you had, unless it was applied (then the
    // board glides to what went in, AiProposal).
    let viewBefore: [number, number] | null = null
    // `html[data-ai-stage]` puts the app's box to the right of the chat (WorkspaceLayout.module.css).
    const show = (s: Staged) => {
      const was = useStage.getState().preview
      if (!was && s.preview) viewBefore = useCanvas.getState().viewCenter()
      if (was && !s.preview && viewBefore) {
        const applied = useChat.getState().messages.find((m) => m.id === was.messageId)?.proposalState?.status === 'applied'
        if (!applied) useCanvas.getState().focusOn(viewBefore)
        viewBefore = null
      }
      useStage.setState(s)
      html.toggleAttribute('data-ai-stage', kindOf(s) !== null)
    }

    const sync = () => {
      if (busy) return
      const next = wanted()
      const from = kindOf(useStage.getState())
      const to = kindOf(next)
      const open = useChat.getState().open
      const el = app()
      if (from === to || (!open && !closing) || isReducedMotion() || narrow() || !el) {
        // Ticking rows in a preview lands here too: the stage follows at once.
        show(next)
        // A closing chat breaks apart where it is; it takes its side again when it opens.
        if (open) setSide(to !== null, false)
        return
      }
      busy = true
      // Closing, the chat doesn't cross: it slides down on whichever side it was.
      const crossing = open && (from === null) !== (to === null)
      if (crossing) setSide(to !== null, true)
      stopCells = runCells(el, 'exit', 0, OUT_MS, () => {
        // Whatever is asked for by now, which may have changed while the app broke apart.
        const now = wanted()
        show(now)
        if (useChat.getState().open) setSide(kindOf(now) !== null, true)
        const wake = !crossing ? undefined : kindOf(now) ? 'right' : 'left'
        stopCells = runCells(el, 'enter', 0, IN_MS, () => {
          busy = false
          closing = false
          sync()
        }, wake)
      })
    }

    sync()
    const offPreview = usePreview.subscribe(sync)
    const offChat = useChat.subscribe((s, prev) => {
      if (prev.open && !s.open) {
        window.clearTimeout(sideBack)
        // Back on the right once it has slid away (AiChat's SLIDE), so the next open starts there.
        sideBack = window.setTimeout(() => {
          if (!useChat.getState().open) setSide(false, false)
        }, CHAT_SLIDE_MS)
        // Closing the chat ends its preview at once (it used to linger until the proposal left the screen).
        if (usePreview.getState().sim) {
          closing = true
          usePreview.getState().close()
          return
        }
      }
      if (s.reportOpen !== prev.reportOpen || s.open !== prev.open) sync()
    })
    return () => {
      offPreview()
      offChat()
      stopCells()
      window.clearTimeout(sideBack)
      app()?.style.removeProperty('clip-path')
      useStage.setState({ preview: null, reportId: null })
      html.removeAttribute('data-ai-stage')
      html.removeAttribute('data-ai-left')
    }
  }, [])
}
