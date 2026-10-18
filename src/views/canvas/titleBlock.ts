// The project's title block on the board (D-118): its layout, and its size for what needs it outside the block itself
// (framing the board, box selection, placing it, the assistant's area layout). The block measures itself once its text
// is laid out; until then its size is estimated from the text.
import { create } from 'zustand'
import type { Label } from '../../data/model'
import { labelSize } from './BoardLabel'

// Board units. Top to bottom: caption, name, rule, description.
export const TITLE_W = 9
export const CAPTION = 0.22
export const NAME = 1.15
export const NAME_LEADING = 1.05
export const DESC = 0.32
export const DESC_LEADING = 1.4
export const DESC_W = TITLE_W * 0.86
// Space between the rows.
export const GAP = 0.34
export const RULE = 0.045
// Room between the text and the corner brackets.
export const PAD = 0.55

// Geist is about half its size wide per character, on average.
const lines = (text: string, size: number, width: number) => Math.max(1, Math.ceil((text.length * size * 0.5) / width))

// The block's height from its parts' heights.
export const titleHeight = (nameH: number, descH: number | null) => CAPTION + GAP + nameH + GAP + RULE + (descH === null ? 0 : GAP + descH)

export const estimateNameH = (name: string) => lines(name, NAME, TITLE_W) * NAME * NAME_LEADING

// Half its size, estimated from what it says. `description` null: none shown.
export function estimateTitleHalf(name: string, description: string | null): [number, number] {
  const nameH = estimateNameH(name)
  const descH = description === null ? null : lines(description || 'x'.repeat(50), DESC, DESC_W) * DESC * DESC_LEADING
  return [TITLE_W / 2 + PAD, titleHeight(nameH, descH) / 2 + PAD]
}

let half: [number, number] = estimateTitleHalf('Untitled', '')
export const titleHalf = () => half
export const setTitleHalf = (next: [number, number]) => {
  half = next
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

// Half the width and height a label takes on the board, roughly (Geist at its size), or the title block's.
export function labelHalf(l: Pick<Label, 'kind' | 'text' | 'size'>): [number, number] {
  if (isTitle(l)) return titleHalf()
  const h = labelSize(l)
  return [l.text.length * h * 0.32, h / 2]
}
