// What text on the canvas or a plane is, without Firebase (S3, D-312); data/labels.ts re-exports it and keeps the
// writes.

// The canvas as a space, beside the planes (whose ids are Firestore's 20-character ones).
export const CANVAS = 'canvas'

export type LabelSize = 'heading' | 'subheading' | 'minor' | 'note'
export type TextScale = 'small' | 'medium' | 'large'
export const LABEL_COLORS = ['ink', 'magenta', 'cyan', 'yellow', 'green', 'blue'] as const
export type LabelColor = (typeof LABEL_COLORS)[number]

export type Label = {
  id: string
  pieceId: string
  text: string
  // heading H1/H2/H3, or `note`: a paragraph. Sticky notes, sections and the title have a `kind` instead.
  size?: LabelSize
  kind?: 'sticky' | 'section' | 'title'
  bold?: boolean
  italic?: boolean
  caps?: boolean
  color?: LabelColor
  scale?: TextScale
  // A sticky note held at its first height, however long its text (D-259).
  folded?: boolean
  // A heading's small line over it, or the number before a section's name (`02 who we beat`); `''` on a section: none.
  kicker?: string
  // A heading or paragraph turned a quarter: 90 reads upwards, -90 downwards (D-156).
  rotate?: 90 | -90
  // A section's name up its left edge instead of in the top one (D-157).
  side?: 'left'
  // Who wrote a sticky note.
  uid?: string
  author?: string
  x: number
  y: number
  // A paragraph's or sticky note's width, the title block's; a section's size.
  w?: number
  h?: number
  // On the canvas (not a plane): which canvas (D-302); missing: the first, `main`.
  canvasId?: string
  createdAt: number
}

export type TextKind = 'heading' | 'paragraph' | 'sticky' | 'section' | 'title'
export const kindOf = (l: Pick<Label, 'kind' | 'size'>): TextKind =>
  l.kind === 'sticky' || l.kind === 'section' || l.kind === 'title' ? l.kind : l.size === 'note' ? 'paragraph' : 'heading'

// Sizes in space px (the old board's units × 80, a card being 200 wide).
export const HEADING_PX: Record<Exclude<LabelSize, 'note'>, number> = { heading: 48, subheading: 29, minor: 22 }
export const PARA_PX: Record<TextScale, number> = { small: 11, medium: 13, large: 16 }
// A sticky note's text, under a card title's 13 (the old board's 0.085 / 0.105 / 0.13 units).
export const STICKY_PX: Record<TextScale, number> = { small: 6.8, medium: 8.4, large: 10.4 }
export const PARA_W = { initial: 500, min: 120, max: 3200 }
// A sticky note starts 6 grid steps wide and 5 tall (D-259); it grows down with its text, folded back to the 5.
export const STICKY_W = { initial: 150, min: 100, max: 800 }
export const STICKY_H = 125
export const TITLE_W = { initial: 800, min: 500, max: 2400 }
export const SECTION_MIN = { w: 100, h: 75 }
export const KICKER_MAX = 60

// firestore.rules' validLabel: 4000 for a paragraph or a sticky note, 200 for the rest.
export const textMax = (l: Pick<Label, 'kind' | 'size'>) => (l.size === 'note' || l.kind === 'sticky' ? 4000 : 200)
