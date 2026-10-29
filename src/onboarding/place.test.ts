import { describe, expect, it } from 'vitest'
import { hits, leadCrosses, mustReplace, place, RIGHT_FREE, type PlaceInput, type Rect } from './place'

const view = { w: 1568, h: 980 }
const size = { w: 268, h: 340 }
const at = (p: ReturnType<typeof place>): Rect => ({ x: p.x, y: p.y, ...size })
const inView = (r: Rect, m = 16) => r.x >= m && r.y >= m && r.x + r.w <= view.w - m && r.y + r.h <= view.h - m

describe('place', () => {
  it('goes right of the anchor when there is room, with a lead from its edge to the anchor', () => {
    const anchor = { x: 400, y: 400, w: 120, h: 24 }
    const p = place({ anchor, size, view })
    expect(p.at).toBe('beside')
    if (p.at !== 'beside') return
    expect(p.side).toBe('right')
    expect(p.x).toBe(anchor.x + anchor.w + 14)
    expect(hits(at(p), anchor)).toBe(false)
    expect(p.lead).toMatchObject({ x1: p.x, x2: anchor.x + anchor.w })
    expect(p.lead!.y1).toBeGreaterThanOrEqual(anchor.y)
    expect(p.lead!.y1).toBeLessThanOrEqual(anchor.y + anchor.h)
  })

  it('goes left when the right has no room', () => {
    const anchor = { x: 1350, y: 400, w: 120, h: 24 }
    const p = place({ anchor, size, view })
    expect(p).toMatchObject({ at: 'beside', side: 'left' })
    expect(inView(at(p))).toBe(true)
  })

  it('goes above when neither side has room', () => {
    const anchor = { x: 200, y: 700, w: 1168, h: 40 }
    const p = place({ anchor, size, view })
    expect(p).toMatchObject({ at: 'beside', side: 'above' })
    expect(at(p).y + size.h).toBeLessThanOrEqual(anchor.y)
  })

  it('shifts along a side to a clear spot before covering a card', () => {
    const anchor = { x: 400, y: 400, w: 120, h: 200 }
    // A card right where the first spot would be, at the anchor's middle height.
    const card = { x: 560, y: 380, w: 200, h: 100 }
    const p = place({ anchor, size, view, soft: [card] })
    expect(p).toMatchObject({ at: 'beside', side: 'right' })
    expect(hits(at(p), card)).toBe(false)
    // Still faces its anchor.
    expect(at(p).y).toBeLessThanOrEqual(anchor.y + anchor.h)
  })

  it('takes another side before covering cards when one side is full of them', () => {
    const anchor = { x: 600, y: 300, w: 120, h: 300 }
    const wall = { x: 734, y: 0, w: 300, h: 980 }
    const p = place({ anchor, size, view, soft: [wall] })
    expect(p).toMatchObject({ at: 'beside', side: 'left' })
    expect(hits(at(p), wall)).toBe(false)
  })

  it('covers the fewest cards when no side is clear', () => {
    const anchor = { x: 600, y: 300, w: 120, h: 300 }
    const everywhere = [{ x: 0, y: 0, w: 1568, h: 980 }]
    const p = place({ anchor, size, view, soft: everywhere })
    expect(p.at).toBe('beside')
    expect(hits(at(p), anchor)).toBe(false)
  })

  it('never covers the right panel', () => {
    const panel = { x: view.w - 400, y: 0, w: 400, h: view.h }
    const anchor = { x: 1000, y: 400, w: 120, h: 24 }
    const p = place({ anchor, size, view, hard: [panel] })
    expect(hits(at(p), panel)).toBe(false)
    expect(p).toMatchObject({ side: 'left' })
  })

  it('keeps the right strip free in a focus (left first)', () => {
    const anchor = { x: 900, y: 400, w: 120, h: 24 }
    const p = place({ anchor, size, view, focus: true })
    expect(p).toMatchObject({ at: 'beside', side: 'left' })
    const anchor2 = { x: 40, y: 400, w: 60, h: 24 }
    const p2 = place({ anchor: anchor2, size, view, focus: true })
    expect(p2.at).toBe('beside')
    expect(at(p2).x + size.w).toBeLessThanOrEqual(view.w - RIGHT_FREE)
  })

  it('sits straight above the dock when clear', () => {
    const dock = { x: 600, y: 940, w: 368, h: 32 }
    const p = place({ anchor: dock, size, view, focus: true, dock: true })
    expect(p).toMatchObject({ at: 'beside', side: 'above' })
    if (p.at !== 'beside' || !p.lead) return
    expect(p.lead.x1).toBe(p.lead.x2)
    expect(p.lead.y2).toBe(dock.y)
  })

  it('falls back to the bottom-middle card (no lead) without an anchor', () => {
    const p = place({ anchor: null, size, view })
    expect(p).toMatchObject({ at: 'bottom', lead: null })
    expect(Math.abs(p.x + size.w / 2 - view.w / 2)).toBeLessThanOrEqual(1)
    expect(at(p).y + size.h).toBeLessThanOrEqual(view.h)
  })

  it('falls back to the bottom middle when the anchor fills the screen', () => {
    const anchor = { x: 20, y: 20, w: 1528, h: 940 }
    const input: PlaceInput = { anchor, size, view }
    expect(place(input).at).toBe('bottom')
  })

  it('keeps the bottom-middle card above the dock and off the right panel', () => {
    const dock = { x: 600, y: 940, w: 368, h: 32 }
    const panel = { x: 700, y: 0, w: 868, h: view.h }
    const p = place({ anchor: null, size, view, bottomDock: dock, hard: [panel] })
    expect(at(p).y + size.h).toBeLessThanOrEqual(dock.y)
    expect(hits(at(p), panel)).toBe(false)
  })

  it('hangs joined to the anchor (gap 0, no lead) in the order a look asks for', () => {
    const anchor = { x: 300, y: 300, w: 300, h: 26 }
    const p = place({ anchor, size: { w: 440, h: 140 }, view, order: ['below', 'above'], gap: 0 })
    expect(p).toMatchObject({ at: 'beside', side: 'below', y: anchor.y + anchor.h, lead: null })
  })

  it('goes below an anchor at the top of the screen (the breadcrumb)', () => {
    const anchor = { x: 24, y: 16, w: 1400, h: 24 }
    const p = place({ anchor, size, view })
    expect(p).toMatchObject({ at: 'beside', side: 'below' })
  })
})

describe('place, round the piece it teaches', () => {
  it('goes past the piece the anchor sits in rather than over it', () => {
    const piece = { x: 96, y: 270, w: 705, h: 440 }
    const anchor = { x: 635, y: 674, w: 146, h: 35 }
    const p = place({ anchor, size: { w: 268, h: 333 }, view, hard: [piece] })
    expect(p).toMatchObject({ at: 'beside', side: 'right' })
    expect(hits(at({ ...p }), piece)).toBe(false)
    expect(p.x).toBeGreaterThanOrEqual(piece.x + piece.w)
  })

  it("keeps the bottom-middle card off what it mustn't cover, nearest the middle", () => {
    const piece = { x: 600, y: 500, w: 400, h: 470 }
    const p = place({ anchor: null, size, view, hard: [piece] })
    expect(hits(at(p), piece)).toBe(false)
  })
})

describe('the bottom-middle card and its anchor', () => {
  it('moves off an anchor low in the middle of the screen', () => {
    // An anchor in the bottom middle that leaves no room beside it on any side.
    const anchor = { x: 560, y: 600, w: 448, h: 360 }
    const p = place({ anchor, size: { w: 268, h: 340 }, view, hard: [{ x: 0, y: 0, w: 560, h: 600 }, { x: 1008, y: 0, w: 560, h: 980 }] })
    expect(hits({ x: p.x, y: p.y, w: 268, h: 340 }, anchor)).toBe(false)
  })

  it('stays in the middle when the anchor is elsewhere', () => {
    const p = place({ anchor: { x: 20, y: 20, w: 1528, h: 300 }, size, view, hard: [{ x: 0, y: 320, w: 1568, h: 10 }] })
    if (p.at === 'bottom') expect(Math.abs(p.x + size.w / 2 - view.w / 2)).toBeLessThanOrEqual(1)
  })

  // O9's review: never over the piece taught or its console, a hint, an open menu; leads never cross buttons.
  describe('obstacles a lesson must keep clear of', () => {
    it('steps past the taught piece and its console rather than sit on them', () => {
      const anchor = { x: 700, y: 400, w: 80, h: 24 }
      const pieceBox = { x: 600, y: 200, w: 500, h: 400 }
      const console_ = { x: 900, y: 610, w: 220, h: 28 }
      const p = place({ anchor, size, view, hard: [pieceBox, console_] })
      expect(p.at).toBe('beside')
      expect(hits(at(p), pieceBox)).toBe(false)
      expect(hits(at(p), console_)).toBe(false)
    })

    it("the bottom-middle card keeps clear of a console it would have covered", () => {
      const console_ = { x: view.w / 2 - 100, y: view.h - 24 - size.h + 40, w: 200, h: 28 }
      const p = place({ anchor: null, size, view, hard: [console_] })
      expect(p.at).toBe('bottom')
      expect(hits(at(p), console_)).toBe(false)
    })

    it('keeps clear of an empty hint and an open menu', () => {
      const anchor = { x: 400, y: 400, w: 120, h: 24 }
      const hint = { x: 534, y: 300, w: 300, h: 40 }
      const menu = { x: 534, y: 380, w: 320, h: 450 }
      const p = place({ anchor, size, view, hard: [hint, menu] })
      expect(hits(at(p), hint)).toBe(false)
      expect(hits(at(p), menu)).toBe(false)
    })

    it("never leads across a console's buttons", () => {
      // The anchor (a console's `[unframe]`) with the console's other buttons right of it: the card doesn't go right.
      const anchor = { x: 600, y: 500, w: 70, h: 22 }
      const buttons = [
        { x: 680, y: 500, w: 60, h: 22 },
        { x: 750, y: 500, w: 60, h: 22 },
      ]
      const p = place({ anchor, size, view, noLead: buttons })
      expect(p.at).toBe('beside')
      if (p.at !== 'beside' || !p.lead) return
      expect(leadCrosses(p.lead, buttons)).toBe(false)
      expect(p.side).not.toBe('right')
    })

    it('a lead touching its own anchor only is fine', () => {
      const lead = { x1: 100, y1: 50, x2: 200, y2: 50 }
      expect(leadCrosses(lead, [{ x: 200, y: 40, w: 50, h: 20 }])).toBe(false)
      expect(leadCrosses(lead, [{ x: 150, y: 40, w: 20, h: 20 }])).toBe(true)
    })
  })
})

describe('the HUD as hard obstacles', () => {
  // O9's review: the `unframe` lesson, anchored on a console's `unframe` low on the left, sat over the side nav's `+`,
  // fit and finder. Lesson.tsx counts the HUD (side nav, breadcrumb, the bottom-left corner) as hard obstacles; here,
  // with those rects hard, no spot the card takes covers them.
  it('never covers the HUD given as hard: the side nav, the breadcrumb, the corner', () => {
    const sidenav = { x: 16, y: 470, w: 48, h: 200 }
    const crumb = { x: 16, y: 14, w: 320, h: 28 }
    const corner = { x: 16, y: 830, w: 44, h: 134 }
    const piece = { x: 330, y: 120, w: 1200, h: 520 }
    const anchor = { x: 340, y: 610, w: 64, h: 18 }
    const hud = [sidenav, crumb, corner]
    const free = place({ anchor, size, view, hard: [piece] })
    // Without them the left spot lands on the side nav (what the review saw)…
    expect(hud.some((r) => hits(at(free), r))).toBe(true)
    // …with them it goes somewhere clear of all three, still in view.
    const p = place({ anchor, size, view, hard: [piece, ...hud] })
    for (const r of hud) expect(hits(at(p), r)).toBe(false)
    expect(inView(at(p), 0)).toBe(true)
  })

  it('an anchor that grew under the card (a console in edit mode): placed again, clear of its new box', () => {
    const small = { x: 600, y: 800, w: 140, h: 28 }
    const p = place({ anchor: small, size, view })
    const card = at(p)
    // The console widens to `EDIT 960 × 600 [delete] [done]` and now reaches under the card.
    const grown = { ...small, x: small.x - 200, w: small.w + 500 }
    expect(mustReplace(card, small)).toBe(false)
    expect(mustReplace(card, grown)).toBe(true)
    const again = place({ anchor: grown, size, view })
    expect(hits(at(again), grown)).toBe(false)
    expect(mustReplace(at(again), grown)).toBe(false)
  })

  it("a link's two cards are kept clear like the anchor (link-made's bar between them)", () => {
    const bar = { x: 500, y: 470, w: 430, h: 30 }
    const from = { x: 560, y: 520, w: 200, h: 100 }
    const to = { x: 960, y: 300, w: 200, h: 100 }
    const p = place({ anchor: bar, size, view, hard: [from, to] })
    expect(hits(at(p), from)).toBe(false)
    expect(hits(at(p), to)).toBe(false)
    expect(hits(at(p), bar)).toBe(false)
    expect(mustReplace(at(p), bar, [from, to])).toBe(false)
    expect(mustReplace({ ...to, w: 10, h: 10 }, bar, [from, to])).toBe(true)
  })
})
