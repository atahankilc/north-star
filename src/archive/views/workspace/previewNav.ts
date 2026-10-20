// Getting around a proposal's preview (D-096): on opening, the board frames every change; the stepper (‹ n/N ›, or n and
// p) goes through the checklist's rows one by one, lighting the row in the chat and its items on the stage, and brings
// them into view: the board glides to frame them, the other views scroll to them (`data-mark-id`).
import { useCanvas } from '../../state/canvasStore'
import { isReducedMotion } from '../../state/motion'
import { CARD_H, CARD_W } from '../canvas/cardLayout'
import { usePreviewFocus, useStage, type StagedPreview } from './stage'

type Box = [number, number, number, number]

// The board box around these items (cards, labels, a competitor's feature by its competitor) and where moved ones were.
function boundsOf(p: StagedPreview, ids: Iterable<string>): Box | null {
  const ws = p.ws
  const cards = new Map<string, { x?: number; y?: number }>()
  for (const c of [...ws.customers, ...ws.problems, ...ws.ideas, ...ws.features, ...ws.competitors]) cards.set(c.id, c)
  const owner = new Map(ws.competitorFeatures.map((f) => [f.id, f.competitorId]))
  const labels = new Map(ws.labels.map((l) => [l.id, l]))
  let box: Box | null = null
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    box = box ? [Math.min(box[0], x0), Math.min(box[1], y0), Math.max(box[2], x1), Math.max(box[3], y1)] : [x0, y0, x1, y1]
  }
  const card = (x: number, y: number) => add(x - CARD_W / 2, y - CARD_H / 2, x + CARD_W / 2, y + CARD_H / 2)
  for (const id of ids) {
    const c = cards.get(id) ?? cards.get(owner.get(id) ?? '')
    if (c?.x !== undefined && c.y !== undefined) card(c.x, c.y)
    const l = labels.get(id)
    if (l) add(l.x - 1.5, l.y - 0.4, l.x + 1.5, l.y + 0.4)
    const was = p.from.get(id)
    if (was) card(was[0], was[1])
  }
  return box
}

const PAD = 0.8
// Never closer than about a dozen cards' room, so a step keeps its neighbours in sight.
const MIN_W = 14
const MIN_H = 8
function padded([x0, y0, x1, y1]: Box): Box {
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const w = Math.max(x1 - x0 + PAD * 2, MIN_W) / 2
  const h = Math.max(y1 - y0 + PAD * 2, MIN_H) / 2
  return [cx - w, cy - h, cx + w, cy + h]
}

// Every change at once: on opening the preview.
export function frameAllChanges() {
  const p = useStage.getState().preview
  if (!p) return
  const box = boundsOf(p, [...p.marks.keys(), ...p.steps.flatMap((s) => s.ids)])
  if (box) useCanvas.getState().flyToFit(padded(box))
}

// Step to row `i` of the staged steps (wrapping), light it and bring it into view.
export function goToStep(i: number) {
  const p = useStage.getState().preview
  if (!p || p.steps.length === 0) return
  const at = ((i % p.steps.length) + p.steps.length) % p.steps.length
  const step = p.steps[at]
  usePreviewFocus.setState({ step: at, lit: step.n })
  const box = boundsOf(p, step.ids)
  if (box) useCanvas.getState().flyToFit(padded(box))
  // Outside the board: the first of its items on the page.
  const el = step.ids.map((id) => document.querySelector(`[data-app] [data-mark-id="${CSS.escape(id)}"]`)).find(Boolean)
  el?.scrollIntoView({ block: 'center', inline: 'center', behavior: isReducedMotion() ? 'auto' : 'smooth' })
}

export function stepBy(d: number) {
  const now = usePreviewFocus.getState().step
  goToStep(now === null ? (d > 0 ? 0 : -1) : now + d)
}
