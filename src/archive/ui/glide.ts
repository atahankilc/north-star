// Layout glides (D-081): change the layout at once, then let marked elements travel from where they were to where they
// are now (FLIP). Used when the assistant's window takes or gives back its column, so the HUD's right side and any open
// side panel slide over instead of jumping. Marked = `[data-glide]` or a side panel (`[data-side-panel]`).
import { isReducedMotion } from '../state/motion'

export const GLIDE_MS = 550
export const GLIDE_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

export function glide(change: () => void) {
  if (isReducedMotion()) return change()
  const els = [...document.querySelectorAll<HTMLElement>('[data-glide], [data-side-panel]')]
  const before = els.map((el) => el.getBoundingClientRect())
  change()
  els.forEach((el, i) => {
    if (!el.isConnected) return
    const after = el.getBoundingClientRect()
    const dx = before[i].left - after.left
    const dy = before[i].top - after.top
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
    // `add` keeps whatever transform the element already has.
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
      duration: GLIDE_MS,
      easing: GLIDE_EASE,
      composite: 'add',
    })
  })
}
