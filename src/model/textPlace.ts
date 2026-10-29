// Where text goes and what a section holds, without Firebase (S5, D-312, R7): the pure part of TextItems.tsx' section
// drag (what it carries: the text, cards and pieces wholly inside it) and where the ops' create_text puts new text
// when it's told by meaning (near a thing, in a section, round things) rather than by x/y.
import { CARD, type Card } from './cards'
import { canvasOf, type Spot } from './canvases'
import { GRID, snap } from './grid'
import { labelBox } from './labelBox'
import type { Label } from './labels'

export type Box = { x: number; y: number; w: number; h: number }
export type Boxed = Box & { id: string }

// Wholly inside `s` (TextItems' `inside`).
export const inside = (b: Box, s: Box) => b.x >= s.x && b.y >= s.y && b.x + b.w <= s.x + s.w && b.y + b.h <= s.y + s.h

const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

// The ids of what a section carries when it moves (D-130): every other text wholly inside it, then every other thing
// given (a plane's cards, the canvas's pieces) wholly inside it, by where they are now. The section's own box is its
// stored size unless `box` says otherwise (a section being resized).
export function sectionHolds(section: Label, labels: Label[], others: Boxed[], box: Box = labelBox(section)): string[] {
  const out: string[] = []
  for (const o of labels) if (o.id !== section.id && inside(labelBox(o), box)) out.push(o.id)
  for (const c of others) if (c.id !== section.id && inside(c, box)) out.push(c.id)
  return out
}

// A plane's cards as boxes (each card's spot there; a card is CARD.w × CARD.h, as TextItems counts them).
export const cardBoxes = (cards: Pick<Card, 'id' | 'x' | 'y'>[]): Boxed[] => cards.map((c) => ({ id: c.id, x: c.x, y: c.y, w: CARD.w, h: CARD.h }))

// The pieces on `canvas`, each at its spot there (data/canvases.ts' piecesOn, without its memo).
export function piecesShown<P extends { id: string; canvasId?: string; x: number; y: number; w: number; h: number }>(canvas: string, pieces: P[], spots: Spot[]): P[] {
  const out = pieces.filter((p) => canvasOf(p) === canvas)
  for (const s of spots) {
    if (s.canvasId !== canvas) continue
    const p = pieces.find((x) => x.id === s.pieceId)
    if (p && canvasOf(p) !== canvas) out.push({ ...p, x: s.x, y: s.y })
  }
  return out
}

// ---- Where new text goes (create_text by meaning)

// Right of a thing, two grid steps clear, its top level with the thing's.
export const rightOf = (b: Box): { x: number; y: number } => ({ x: snap(b.x + b.w + 2 * GRID), y: snap(b.y) })

// Moved down past what it would cover (at most `limit` px down): create_text's `near` (S9: several made beside the
// same thing in one batch go one under the other, each seeing the ones before).
export function downPast(at: { x: number; y: number }, size: { w: number; h: number }, others: Box[], limit = 100000) {
  const spot = { ...at }
  for (let hit = others.find((o) => overlap({ ...spot, w: size.w, h: size.h }, o)); hit && spot.y - at.y < limit; hit = others.find((o) => overlap({ ...spot, w: size.w, h: size.h }, o)))
    spot.y = snap(hit.y + hit.h + GRID)
  return spot
}

// Inside a section: two grid steps in from its top-left (three from the top, under its name), at the first spot clear
// of what's already in it, row by row within its width; when it's full, under what's there.
export function inSection(section: Box, size: { w: number; h: number }, others: Box[]): { x: number; y: number } {
  const held = others.filter((o) => inside(o, section))
  const step = 2 * GRID
  const x0 = snap(section.x + 2 * GRID)
  for (let y = snap(section.y + 3 * GRID); y + size.h <= section.y + section.h - GRID; y += step)
    for (let x = x0; x + size.w <= section.x + section.w - GRID; x += step) if (!held.some((o) => overlap({ x, y, w: size.w, h: size.h }, o))) return { x, y }
  return downPast({ x: x0, y: snap(section.y + 3 * GRID) }, size, held)
}

// A section round boxes: two grid steps clear on every side, three on top (its name sits in the top edge).
export function around(boxes: Box[]): Box {
  const x0 = Math.min(...boxes.map((b) => b.x))
  const y0 = Math.min(...boxes.map((b) => b.y))
  const x1 = Math.max(...boxes.map((b) => b.x + b.w))
  const y1 = Math.max(...boxes.map((b) => b.y + b.h))
  const x = Math.floor((x0 - 2 * GRID) / GRID) * GRID
  const y = Math.floor((y0 - 3 * GRID) / GRID) * GRID
  return { x, y, w: Math.ceil((x1 + 2 * GRID - x) / GRID) * GRID, h: Math.ceil((y1 + 2 * GRID - y) / GRID) * GRID }
}

// Where text goes when nobody says: on a plane, the first clear spot row by row from its top-left (two grid steps in)
// within its width; on the canvas (no width), under everything there.
export function clearSpotFor(size: { w: number; h: number }, others: Box[], planeW?: number): { x: number; y: number } {
  const margin = 2 * GRID
  if (planeW === undefined) {
    if (!others.length) return { x: 0, y: 0 }
    return { x: snap(Math.min(...others.map((o) => o.x))), y: snap(Math.max(...others.map((o) => o.y + o.h)) + 4 * GRID) }
  }
  const step = 2 * GRID
  for (let y = margin; y < 40000; y += step)
    for (let x = margin; x + size.w <= Math.max(planeW - margin, margin + size.w); x += step) if (!others.some((o) => overlap({ x, y, w: size.w, h: size.h }, o))) return { x, y }
  return { x: margin, y: margin }
}
