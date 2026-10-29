import { describe, expect, it } from 'vitest'
import { keep, narrowing, START } from './planeFilter'
import { passes, NO_FILTER } from './kanbanFilter'
import { labelBox } from './labelBox'
import { placesIn, shownPlaces } from './goTo'
import { matchesIn, pageText, snippet } from './findIndex'
import { foldsOf } from './cardInside'
import { NO_VALUE, valueOf } from './kanbanCards'
import type { Card } from '../data/cards'
import type { Label } from '../data/labels'
import type { Task } from '../data/tasks'

// The pure helpers moved out of the views (R8) load and run in node.
describe('src/model in node', () => {
  const cards = [
    { id: 'a', type: 'idea', pieceId: 'p', title: 'A', x: 0, y: 0, tags: ['x'] },
    { id: 'b', type: 'feature', pieceId: 'p', title: 'B', x: 0, y: 0, folded: true },
  ] as Card[]

  it('filters', () => {
    expect([...keep(cards, [], { ...START, hide: ['feature'] })]).toEqual(['a'])
    expect([...keep(cards, [], { ...START, tags: ['x'] })]).toEqual(['a'])
    expect(narrowing(START)).toBe(0)
    expect(passes({ id: 't', title: 't' } as Task, NO_FILTER, false, undefined, () => undefined)).toBe(true)
    expect(passes({ id: 't', title: 't' } as Task, { ...NO_FILTER, due: ['none'] }, false, undefined, () => undefined)).toBe(true)
  })

  it('places text and finds it', () => {
    const labels = [
      { id: 'h', pieceId: 'canvas', kind: 'heading', text: 'Who we beat', x: 0, y: 200 },
      { id: 's', pieceId: 'canvas', kind: 'section', text: 'Area', x: 0, y: 0, w: 500, h: 400 },
    ] as unknown as Label[]
    expect(labelBox(labels[1])).toEqual({ x: 0, y: 0, w: 500, h: 400 })
    const places = placesIn('canvas', [], labels, 'North Star')
    expect(places.map((p) => p.id)).toEqual(['s', 'h'])
    expect(shownPlaces(places, [])).toHaveLength(2)
    expect(matchesIn('a b a', /a/g)).toEqual([
      [0, 1],
      [4, 5],
    ])
    expect(snippet('short text', /text/g)).toBe('short text')
    expect(pageText({ title: 'T', kind: 'markdown' } as never, { text: '# T\n**bold** [link](x)' } as never)).toBe('T\nbold link')
  })

  it("folds and reads a card's fields", () => {
    expect(foldsOf(cards, []).rows.size).toBe(0)
    expect(valueOf(cards[1], 'impact')).toBeUndefined()
    expect(NO_VALUE).toBe('-')
  })
})
