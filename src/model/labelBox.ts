// Where a piece of text sits in its space's px (D-188, D-194, D-257): for what a section holds, what fit frames and go to.
// Moved out of the workspace view TextItems.tsx (R8), which draws it.
import { HEADING_PX, kindOf, PARA_PX, PARA_W, STICKY_H, STICKY_PX, STICKY_W, TITLE_W, type Label, type LabelSize } from './labels'

// Down from a sticky note's top to its text: the glue band holding the signed line, then a gap (D-257).
export const STICKY_TEXT_TOP = 17.64

export type HeadingSize = Exclude<LabelSize, 'note'>
// A heading's or a section name's size (a section never says `note`; if it did, H3).
export const headingSize = (l: Label): HeadingSize => (l.size === 'note' ? 'minor' : (l.size ?? 'heading'))
// A heading's small line, a section's number: its size from the text it goes with.
export const kickPx = (px: number) => Math.max(8, px * 0.3)

// Roughly where it sits, for what a section holds and what fit frames. A turned one's sides swap.
export function labelBox(l: Label) {
  const k = kindOf(l)
  const lines = Math.max(1, l.text.split('\n').length)
  if (k === 'section') return { x: l.x, y: l.y, w: l.w ?? 400, h: l.h ?? 300 }
  if (k === 'sticky') {
    const w = l.w ?? STICKY_W.initial
    return { x: l.x, y: l.y, w, h: l.folded ? STICKY_H : Math.max(STICKY_H, STICKY_TEXT_TOP + lines * STICKY_PX[l.scale ?? 'medium'] * 1.45 + 7.2) }
  }
  if (k === 'title') return { x: l.x, y: l.y, w: l.w ?? TITLE_W.initial, h: 340 }
  let w: number
  let h: number
  if (k === 'paragraph') [w, h] = [l.w ?? PARA_W.initial, lines * PARA_PX[l.scale ?? 'large'] * 1.55 + 8]
  else {
    const px = HEADING_PX[headingSize(l)]
    ;[w, h] = [Math.max(4, l.text.length) * px * 0.55, px * 1.3 + (l.kicker ? kickPx(px) * 1.6 : 0)]
  }
  return l.rotate ? { x: l.x, y: l.y, w: h, h: w } : { x: l.x, y: l.y, w, h }
}
