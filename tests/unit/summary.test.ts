import { describe, expect, it } from 'vitest'
import { makeSummary, readSummary, SUMMARY_CHARS } from '../../src/model/summary'
import { SUMMARY_CARDS_CHARS, SUMMARY_PIECES_MAX } from '../../src/model/limits'

const plane = (id: string, x: number, y: number, w = 1000, h = 650) => ({ id, kind: 'plane' as const, x, y, w, h })

describe('workspace summary (D-338)', () => {
  it('turns pieces and cards into numbers and letters, and back', () => {
    const s = makeSummary(
      [plane('a', 0, 0), { id: 'b', kind: 'kanban', x: 1100, y: 0, w: 900, h: 500 }],
      [
        { type: 'customer', pieceId: 'a', x: 0, y: 0 },
        { type: 'problem', pieceId: 'a', x: 400, y: 200 },
        { type: 'feature', pieceId: 'a', x: 50, y: 50, on: 'x' },
        { type: 'idea', pieceId: 'b', x: 0, y: 0 },
      ],
      [{ planeId: 'a', type: 'competitor', x: 200, y: 100 }],
    )
    expect(SUMMARY_CHARS.test(s.pieces) && SUMMARY_CHARS.test(s.cards)).toBe(true)
    expect(s.n).toBe(3)
    const r = readSummary({ ...s, by: 'u', at: 1 })!
    expect(r.pieces.map((p) => p.kind)).toEqual(['plane', 'kanban'])
    expect(r.pieces[0]).toEqual({ kind: 'plane', x: 0, y: 0, w: 500, h: 325 })
    expect(r.cards.map((c) => c.type).sort()).toEqual(['competitor', 'customer', 'problem'])
    expect(r.cards.every((c) => c.piece === 0 && c.x >= 0 && c.x <= 999 && c.y >= 0 && c.y <= 999)).toBe(true)
    // 400 px right and 200 down of the first card: two cards' widths, one card's height (a card is 10 × 5 units).
    expect(r.cards.find((c) => c.type === 'problem')).toMatchObject({ x: 20, y: 10 })
  })

  it('stays within its caps', () => {
    const many = Array.from({ length: 80 }, (_, i) => plane(`p${i}`, i * 1100, 0))
    const cards = Array.from({ length: 900 }, (_, i) => ({ type: 'idea' as const, pieceId: `p${i % 60}`, x: (i * 37) % 3000, y: (i * 53) % 2000 }))
    const s = makeSummary(many, cards, [])
    expect(s.pieces.split(';')).toHaveLength(SUMMARY_PIECES_MAX)
    expect(s.cards.length).toBeLessThanOrEqual(SUMMARY_CARDS_CHARS)
  })

  it('an empty canvas, and a doc that does not read', () => {
    expect(makeSummary([], [], [])).toEqual({ n: 0, pieces: '', cards: '' })
    expect(readSummary(null)).toBeNull()
    expect(readSummary({ pieces: 'z 1 2 3 4;p 0 0 10 10', cards: '9 i 1 1;0 q 1 1;0 c 5 5' })!.cards).toEqual([{ piece: 0, type: 'customer', x: 5, y: 5 }])
  })
})
