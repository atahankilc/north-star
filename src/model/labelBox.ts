// Where a piece of text sits in its space's px (D-188, D-194, D-257): for what a section holds, what fit frames and go to.
// Moved out of the workspace view TextItems.tsx (R8), which draws it.
import { WORLD } from './world'
import { HEADING_PX, kindOf, PARA_PX, PARA_W, STICKY_H, STICKY_PX, STICKY_W, TITLE_W, type Label, type LabelSize } from './labels'

// Down from a sticky note's top to its text: the glue band holding the signed line, then a gap (D-257). The CSS's
// tokens (D-325): --space-1 + --w-text-2xs (WORLD.smallText) + --space-2.
export const STICKY_TEXT_TOP = 4 + WORLD.smallText + 8

export type HeadingSize = Exclude<LabelSize, 'note'>
// A heading's or a section name's size (a section never says `note`; if it did, H3).
export const headingSize = (l: Label): HeadingSize => (l.size === 'note' ? 'minor' : (l.size ?? 'heading'))
// A heading's small line, a section's number: its size from the text it goes with.
export const kickPx = (px: number) => Math.max(8, px * 0.3)

// Average character widths, in em, checked against the text as drawn (2026-11-01, headless Chrome: paragraphs 3–8 %
// over in Geist, so a count rounds up; Inter, D-337, is 2.7 % wider, still over), and JetBrains Mono (exactly 0.6,
// stickies exact). A paragraph's text keeps 0.6 em clear of its hairline (TextItems.module.css).
const PROSE_EM = 0.46
const MONO_EM = 0.6
const PARA_INSET_EM = 0.6

// How many lines a text takes at a width (agent-bugs 6): each of its own lines wraps word by word at the characters
// that fit, as the browser wraps it, so a long one-line paragraph is as tall as it's drawn, not one line high. A blank
// line (Markdown's paragraph break) counts half.
export function wrappedLines(text: string, width: number, px: number, em: number): number {
  const perLine = Math.max(1, Math.floor(width / (px * em)))
  let n = 0
  for (const line of text.split('\n')) {
    if (!line.trim()) {
      n += 0.5
      continue
    }
    let rows = 1
    let used = 0
    for (const word of line.split(/\s+/).filter(Boolean)) {
      const len = word.length
      if (used === 0) used = Math.min(len, perLine)
      else if (used + 1 + len <= perLine) used += 1 + len
      else {
        rows += Math.ceil(len / perLine)
        used = len % perLine || perLine
      }
    }
    n += rows
  }
  return Math.max(1, n)
}

// Roughly where it sits, for what a section holds and what fit frames. A turned one's sides swap.
export function labelBox(l: Label) {
  const k = kindOf(l)
  if (k === 'section') return { x: l.x, y: l.y, w: l.w ?? 400, h: l.h ?? 300 }
  if (k === 'sticky') {
    const w = l.w ?? STICKY_W.initial
    const px = STICKY_PX[l.scale ?? 'medium']
    const lines = wrappedLines(l.text, w - 2 * WORLD.cardPad, px, MONO_EM)
    return { x: l.x, y: l.y, w, h: l.folded ? STICKY_H : Math.max(STICKY_H, l.h ?? 0, STICKY_TEXT_TOP + lines * px * 1.5 + 7) }
  }
  if (k === 'title') return { x: l.x, y: l.y, w: l.w ?? TITLE_W.initial, h: 340 }
  let w: number
  let h: number
  if (k === 'paragraph') {
    const px = PARA_PX[l.scale ?? 'large']
    w = l.w ?? PARA_W.initial
    h = wrappedLines(l.text, w - PARA_INSET_EM * px, px, PROSE_EM) * px * 1.5 + 8
  }
  else {
    const px = HEADING_PX[headingSize(l)]
    ;[w, h] = [Math.max(4, l.text.length) * px * 0.55, px * 1.3 + (l.kicker ? kickPx(px) * 1.6 : 0)]
  }
  return l.rotate ? { x: l.x, y: l.y, w: h, h: w } : { x: l.x, y: l.y, w, h }
}
