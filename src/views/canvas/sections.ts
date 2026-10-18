// Sections on the board (D-130): a named frame round part of the board. A section holds whatever lies inside its frame,
// by position: cards and text whose centre is inside it, and smaller sections wholly inside it, so sections nest. Nothing
// stores what's in one: drop a card in and it belongs, drag it out and it doesn't. Its place is a label of kind
// `section`, x/y its centre and w/h its size, so it selects, copies, undoes and syncs like text.
import { create } from 'zustand'
import type { Label, LabelSize } from '../../data/model'
import { labelSize } from './textStyle'

export const isSection = (l: Pick<Label, 'kind'>) => l.kind === 'section'

// [x0, y0, x1, y1] in board units (y grows upwards).
export type Rect = [number, number, number, number]
export type SectionRect = { x: number; y: number; w: number; h: number }

// The size assumed for a section without one (never written that way); the smallest one its corner can make.
export const DEFAULT_W = 16
export const DEFAULT_H = 10
export const MIN_W = 4
export const MIN_H = 3
// Room between a section's frame and what it was drawn round.
const WRAP_PAD = 1

export const sizeOf = (l: Pick<Label, 'w' | 'h'>): [number, number] => [l.w ?? DEFAULT_W, l.h ?? DEFAULT_H]

export function rectOf(l: Pick<Label, 'x' | 'y' | 'w' | 'h'>, at: [number, number] = [l.x, l.y]): Rect {
  const [w, h] = sizeOf(l)
  return [at[0] - w / 2, at[1] - h / 2, at[0] + w / 2, at[1] + h / 2]
}

const EPS = 1e-6
export const holdsPoint = (r: Rect, x: number, y: number) => x >= r[0] - EPS && x <= r[2] + EPS && y >= r[1] - EPS && y <= r[3] + EPS
// `inner` wholly inside `outer`, and smaller (two frames the same size don't hold each other).
export const holdsRect = (outer: Rect, inner: Rect) =>
  holdsPoint(outer, inner[0], inner[1]) &&
  holdsPoint(outer, inner[2], inner[3]) &&
  (inner[2] - inner[0]) * (inner[3] - inner[1]) < (outer[2] - outer[0]) * (outer[3] - outer[1]) - EPS

// The name is set like text on the board, H1 (the default), H2 or H3, whatever the section's size.
export const SECTION_SIZES = ['heading', 'subheading', 'minor'] as const satisfies readonly LabelSize[]
export const sectionNameSize = (l: Pick<Label, 'size'>) => labelSize({ size: l.size === 'note' ? 'minor' : l.size })
// The band across the top that holds the name, and is where the section is grabbed.
export const sectionBand = (l: Pick<Label, 'size'>) => sectionNameSize(l) * 1.9

// How many sections each section sits inside, so inner ones draw over outer ones.
export function depths(sections: Pick<Label, 'x' | 'y' | 'w' | 'h'>[]): number[] {
  const rects = sections.map((s) => rectOf(s))
  return rects.map((r) => rects.filter((o) => o !== r && holdsRect(o, r)).length)
}

// A frame round these boxes (centre, half size), with room for the name above them (an H1's, or `size`'s).
export function wrapRect(boxes: { c: [number, number]; h: [number, number] }[], size?: LabelSize): SectionRect {
  const x0 = Math.min(...boxes.map((b) => b.c[0] - b.h[0])) - WRAP_PAD
  const x1 = Math.max(...boxes.map((b) => b.c[0] + b.h[0])) + WRAP_PAD
  const y0 = Math.min(...boxes.map((b) => b.c[1] - b.h[1])) - WRAP_PAD
  const top = Math.max(...boxes.map((b) => b.c[1] + b.h[1])) + WRAP_PAD
  const w = Math.max(MIN_W, x1 - x0)
  const h = Math.max(MIN_H, top - y0 + sectionBand({ size }))
  return { x: x0 + w / 2, y: y0 + h / 2, w, h }
}

// The focus view (D-127): the sections that hold a card in focus, drawn round those cards only (with room for their
// name), so the chain still reads by area without the empty space the hidden cards left. Inner sections are fitted
// first and their parents round them. Each keeps its id, name and colour; nothing is written.
export function fitSections<T extends Label & { id: string }>(sections: T[], cards: { x: number; y: number; half: [number, number] }[]): T[] {
  const rects = new Map(sections.map((s) => [s.id, rectOf(s)]))
  // Smallest first, so a section's inner sections are fitted before it.
  const order = [...sections].sort((a, b) => sizeOf(a)[0] * sizeOf(a)[1] - sizeOf(b)[0] * sizeOf(b)[1])
  const fitted = new Map<string, SectionRect>()
  for (const s of order) {
    const r = rects.get(s.id)!
    const boxes = cards.filter((c) => holdsPoint(r, c.x, c.y)).map((c) => ({ c: [c.x, c.y] as [number, number], h: c.half }))
    for (const inner of order) {
      const f = fitted.get(inner.id)
      if (f && holdsRect(r, rects.get(inner.id)!)) boxes.push({ c: [f.x, f.y], h: [f.w / 2, f.h / 2] })
    }
    if (boxes.length) fitted.set(s.id, wrapRect(boxes, s.size))
  }
  return sections.filter((s) => fitted.has(s.id)).map((s) => ({ ...s, ...fitted.get(s.id)! }))
}

// The labels that are text (and the title block), without sections: what the assistant's label rows act on.
export const textLabels = <T extends Pick<Label, 'kind'>>(labels: T[]) => labels.filter((l) => !isSection(l))

// The named sections holding a point, outermost first.
export function sectionsAt<T extends Label>(labels: T[], x: number, y: number): T[] {
  return labels
    .filter((l) => isSection(l) && l.text.trim() && holdsPoint(rectOf(l), x, y))
    .sort((a, b) => sizeOf(b)[0] * sizeOf(b)[1] - sizeOf(a)[0] * sizeOf(a)[1])
}

// Drawing a new section: chosen from the + menu or the board's right-click, the pointer turns into a crosshair, and a
// press, drag and release on the board draws the frame (a drag shorter than DRAW_MIN draws nothing and keeps the
// crosshair). Escape, or leaving the board, stops it.
export const DRAW_MIN = 1
export const useSectionDraw = create<{ on: boolean }>(() => ({ on: false }))
export const drawSection = (on: boolean) => useSectionDraw.setState({ on })
