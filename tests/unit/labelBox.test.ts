// agent-bugs 6: a paragraph's or a sticky's height counts its lines wrapped at its width, word by word, as drawn. The
// heights below were measured in headless Chrome on 2026-11-01 (the texts as drawn in a plane's focus, in plane px);
// labelBox must stay within 15 % of them, never under by more than a few px (placement keeps clear by this box).
import { describe, expect, it } from 'vitest'
import { labelBox, wrappedLines } from '../../src/model/labelBox'
import type { Label } from '../../src/model/labels'

const words = (n: number) => Array.from({ length: n }, (_, i) => ['stall', 'owners', 'want', 'cash', 'first', 'and', 'pre-orders', 'cut', 'waste', 'more'][i % 10]).join(' ')
const label = (o: Partial<Label> & Pick<Label, 'text'>): Label => ({ id: 'x', pieceId: 'p', x: 0, y: 0, ...o }) as Label

const DRAWN: [string, Label, number][] = [
  ['a 600-character one-line paragraph, 400 wide, large', label({ size: 'note', text: words(95), w: 400, scale: 'large' }), 264],
  ['a 300-character one-line paragraph, 300 wide, small', label({ size: 'note', text: words(50), w: 300, scale: 'small' }), 99],
  ['bullets and a second paragraph, 500 wide, medium', label({ size: 'note', text: `- ${words(20)}\n- ${words(12)}\n\n${words(40)}`, w: 500, scale: 'medium' }), 125],
  ['a long sticky, 150 wide', label({ kind: 'sticky', text: words(35), w: 150 }), 139],
  ['a sticky, 220 wide, large', label({ kind: 'sticky', text: words(22), w: 220, scale: 'large' }), 125],
]

describe('labelBox: as tall as the text is drawn (bug 6)', () => {
  for (const [what, l, drawn] of DRAWN)
    it(what, () => {
      const h = labelBox(l).h
      expect(h, `${h} vs ${drawn} drawn`).toBeGreaterThanOrEqual(drawn - 4)
      expect(h, `${h} vs ${drawn} drawn`).toBeLessThanOrEqual(drawn * 1.15)
    })
  it('wraps word by word; a blank line counts half', () => {
    expect(wrappedLines('aaa bbb ccc', 7 * 10 * 0.5, 10, 0.5)).toBe(2)
    expect(wrappedLines('one\n\ntwo', 1000, 10, 0.5)).toBe(2.5)
  })
})
