// What a plane draws, as boxes, and what lands on what (agent-bugs 6, 12): one definition for the agent's warnings
// (changeset.ts) and the evals' noOverlaps grader, so they never disagree. Pure: no Firebase.
import { CARD, type Card } from './cards'
import { cardsOn } from './placement'
import { foldsOf, packageBox } from './cardInside'
import { labelBox } from './labelBox'
import type { Box } from './layout'
import type { Label } from './labels'
import type { Edge } from './edges'

// `frame`: a section or an unfolded package's frame, which holds things (only cutting through one counts).
export type Boxed = Box & { id: string; frame?: boolean }

type PlaneWs = { cards: Card[]; places: Parameters<typeof cardsOn>[1]; edges: Edge[]; labels: Label[] }

// Every card shown on the plane (a folded part none; an unfolded package its frame) and its text; sections are frames.
export function planeBoxes(ws: PlaneWs, plane: string): Boxed[] {
  const cards = cardsOn(ws.cards, ws.places, plane)
  const folds = foldsOf(cards, ws.edges)
  const out: Boxed[] = []
  for (const c of cards) {
    if (folds.hidden.has(c.id)) continue
    if (c.type === 'package' && !c.folded) {
      const f = packageBox((folds.members.get(c.id) ?? []).map((m: Card) => ({ x: m.x, y: m.y, w: CARD.w, h: CARD.h })))
      if (f) out.push({ id: c.id, ...f, frame: true })
      continue
    }
    out.push({ id: c.id, x: c.x, y: c.y, w: CARD.w, h: CARD.h })
  }
  for (const l of ws.labels.filter((x) => x.pieceId === plane)) out.push({ id: l.id, ...labelBox(l), ...(l.kind === 'section' ? { frame: true } : {}) })
  return out
}

export const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
export const wholly = (a: Box, s: Box) => a.x >= s.x && a.y >= s.y && a.x + a.w <= s.x + s.w && a.y + a.h <= s.y + s.h

// The things that land on each other, where at least one was made or moved since `before` (what was already there may
// overlap: it isn't the change's doing). `cuts`: one cuts through a frame (a section, a package) without being inside it.
export type Overlap = { a: string; b: string; cuts: boolean }
export function overlaps(before: Boxed[], after: Boxed[]): { touched: Set<string>; found: Overlap[] } {
  const was = new Map(before.map((b) => [b.id, b]))
  const touched = new Set(after.filter((b) => { const w = was.get(b.id); return !w || w.x !== b.x || w.y !== b.y || w.w !== b.w || w.h !== b.h }).map((b) => b.id))
  const found: Overlap[] = []
  for (let i = 0; i < after.length; i++)
    for (let j = i + 1; j < after.length; j++) {
      const [a, b] = [after[i], after[j]]
      if (!touched.has(a.id) && !touched.has(b.id)) continue
      if (a.frame || b.frame) {
        const [f, o] = a.frame ? [a, b] : [b, a]
        if (hit(f, o) && !wholly(o, f) && !wholly(f, o)) found.push({ a: o.id, b: f.id, cuts: true })
      } else if (hit(a, b)) found.push({ a: a.id, b: b.id, cuts: false })
    }
  return { touched, found }
}
