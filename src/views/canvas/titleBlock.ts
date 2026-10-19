// The project's title block on the board (D-118): its layout, and its size for what needs it outside the block itself
// (framing the board, box selection, placing it, the assistant's area layout). The block measures itself once its text
// is laid out; until then its size is estimated from the text.
import { create } from 'zustand'
import { MathUtils } from 'three'
import type { Label } from '../../data/model'
import { isParagraph, kickerSize, labelSize, paraBox } from './textStyle'
import { stickyHalf } from './stickyNote'
import { isSection, sizeOf } from './sections'

// Board units. Top to bottom: caption, name, rule, description.
// The text's width: TITLE_W until someone drags the block's right edge (D-132), within MIN_TITLE_W–MAX_TITLE_W.
export const TITLE_W = 9
export const MIN_TITLE_W = 5
export const MAX_TITLE_W = 30
export const titleWidth = (l: Pick<Label, 'w'>) => MathUtils.clamp(l.w ?? TITLE_W, MIN_TITLE_W, MAX_TITLE_W)
export const CAPTION = 0.22
export const NAME = 1.15
export const NAME_LEADING = 1.05
export const DESC = 0.32
export const DESC_LEADING = 1.4
export const descWidth = (w: number) => w * 0.86
// Space between the rows.
export const GAP = 0.34
export const RULE = 0.045
// Room between the text and the corner brackets.
export const PAD = 0.55

// Geist is about half its size wide per character, on average.
const lines = (text: string, size: number, width: number) => Math.max(1, Math.ceil((text.length * size * 0.5) / width))

// The block's height from its parts' heights.
export const titleHeight = (nameH: number, descH: number | null) => CAPTION + GAP + nameH + GAP + RULE + (descH === null ? 0 : GAP + descH)

export const estimateNameH = (name: string, w = TITLE_W) => lines(name, NAME, w) * NAME * NAME_LEADING

// Half its size, estimated from what it says. `description` null: none shown.
export function estimateTitleHalf(name: string, description: string | null, w = TITLE_W): [number, number] {
  const nameH = estimateNameH(name, w)
  const descH = description === null ? null : lines(description || 'x'.repeat(50), DESC, descWidth(w)) * DESC * DESC_LEADING
  return [w / 2 + PAD, titleHeight(nameH, descH) / 2 + PAD]
}

// As drawn now (folded when far out, D-132), for selecting, guides and framing; and unfolded, the room it takes when
// read up close, which the assistant keeps new cards out of whatever the zoom.
let half: [number, number] = estimateTitleHalf('Untitled', '')
let fullHalf = half
export const titleHalf = () => half
export const titleFullHalf = () => fullHalf
export const setTitleHalf = (next: [number, number], full = next) => {
  half = next
  fullHalf = full
}

// The title label's id while one is on the board, for code that knows pieces only by kind and id (guides.ts).
let id: string | null = null
export const titleId = () => id
export const setTitleId = (next: string | null) => {
  id = next
}

// Which of its fields to open for editing, asked from outside the block (the right-click menu); the block clears it.
export type TitleField = 'name' | 'description'
export const useTitleEdit = create<{ field: TitleField | null }>(() => ({ field: null }))
export const editTitle = (field: TitleField | null) => useTitleEdit.setState({ field })

export const isTitle = (l: Pick<Label, 'kind'>) => l.kind === 'title'

// Half the width and height a label takes on the board, roughly (Geist at its size), or the title block's, or a
// section's (D-130); a paragraph's as laid out (D-156); turned a quarter, its sides swap.
export function labelHalf(l: Pick<Label, 'kind' | 'text' | 'size' | 'w' | 'h' | 'caps' | 'bold' | 'italic' | 'rotate' | 'kicker'>): [number, number] {
  if (isTitle(l)) return titleHalf()
  if (isSection(l)) {
    const [w, h] = sizeOf(l)
    return [w / 2, h / 2]
  }
  let half: [number, number]
  if (l.kind === 'sticky') half = stickyHalf(l)
  else if (isParagraph(l)) {
    const [w, h] = paraBox(l)
    half = [w / 2, h / 2]
  } else {
    const h = labelSize(l)
    // Capitals and bold run wider; the small line over it and an H1's rule under it add a little height.
    const ruled = (l.size ?? 'heading') === 'heading'
    half = [l.text.length * h * 0.32 * (l.caps || l.bold ? 1.18 : 1), h / 2 + (l.kicker ? kickerSize(h) : 0) + (ruled ? h * 0.25 : 0)]
  }
  return l.rotate ? [half[1], half[0]] : half
}

// The same for the assistant's layouts: the title block unfolded, whatever the zoom (D-132).
export const labelRoom = (l: Parameters<typeof labelHalf>[0]): [number, number] => (isTitle(l) ? titleFullHalf() : labelHalf(l))
