import { describe, expect, it } from 'vitest'
import { TERMS, terms } from './glossary'
import { LESSONS } from './lessons'

describe('glossary (D-355)', () => {
  it('marks only the first use of each word, whole words, any case', () => {
    const b = terms('Cards sit on a plane; a card on two planes is one card. Cardboard is not.')
    expect(b.filter((x) => x.term).map((x) => [x.text, x.term!.id])).toEqual([
      ['Cards', 'card'],
      ['plane', 'plane'],
    ])
    expect(b.map((x) => x.text).join('')).toBe('Cards sit on a plane; a card on two planes is one card. Cardboard is not.')
  })
  it('longest form first', () => {
    expect(terms('Press edit mode on.').find((x) => x.term)?.term?.id).toBe('edit mode')
  })
  it('shares what was seen across the runs of one line', () => {
    const seen = new Set<string>()
    terms('a deck', seen)
    expect(terms('another deck', seen).some((x) => x.term)).toBe(false)
  })
  it('every meaning is one short line, and the lessons use most words', () => {
    const all = LESSONS.flatMap((l) => ('pages' in l && l.pages ? l.pages.map((p) => p.body) : [])).join(' ')
    for (const t of TERMS) expect(t.meaning.split(/\s+/).length, t.id).toBeLessThanOrEqual(20)
    const used = TERMS.filter((t) => terms(all).some((x) => x.term?.id === t.id))
    expect(used.length).toBeGreaterThan(TERMS.length / 2)
  })
})
