// Where a coach surface points (D-315): a visible `[data-learn]` of a name. Used by the empty states (EmptyHint: the
// empty canvas's arrow to the `+`, an empty plane's line in its piece). Was Lesson.tsx's, kept when the anchored card
// went (D-349: every lesson the centred modal).
import { CELLS_SHUT } from '../ui/foundation/cellReveal'

// Drawn and visible: on screen, with a size, not hidden by style (visibility, opacity 0, display, a cell-by-cell clip
// that's shut: a piece's console when not shown), not inside something inert or aria-hidden (the canvas picture's cards
// under a focus).
export function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  if (!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth)) return false
  if (el.closest('[inert]') || el.parentElement?.closest('[aria-hidden="true"]')) return false
  if (getComputedStyle(el).visibility === 'hidden') return false
  for (let a: HTMLElement | null = el; a && a !== document.body; a = a.parentElement) {
    if (a.style.clipPath.replace(/px/g, '') === CELLS_SHUT) return false
    const cs = getComputedStyle(a)
    if (cs.display === 'none' || cs.opacity === '0') return false
  }
  return true
}

// The anchor on screen: a visible `[data-learn]` of that name, at or inside what the event was about first (`target`,
// the app's `data-target`: the card selected, the piece just made), else the first one drawn.
export function findAnchor(name: string | undefined, target?: string): HTMLElement | null {
  if (!name) return null
  const sel = `[data-learn="${name}"]`
  if (target)
    for (const t of document.querySelectorAll<HTMLElement>(`[data-target="${CSS.escape(target)}"]`)) {
      const at = [...(t.matches(sel) ? [t] : []), ...t.querySelectorAll<HTMLElement>(sel)].find(isVisible)
      if (at) return at
    }
  for (const el of document.querySelectorAll<HTMLElement>(sel)) if (isVisible(el)) return el
  return null
}
