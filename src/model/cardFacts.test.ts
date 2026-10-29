import { describe, expect, it } from 'vitest'
import type { Card } from './cards'
import { confidenceFor, confidenceOf, scoreOf, suggestedOrder } from './cardFacts'
import type { Edge } from './edges'

let n = 0
const card = (type: Card['type'], fields: Partial<Card> = {}): Card => ({ id: `c${++n}`, type, pieceId: 'p', title: `${type} ${n}`, x: 0, y: 0, ...fields })
const edge = (kind: string, from: Card, to: Card): Edge => ({ id: `e${++n}`, kind, fromId: from.id, toId: to.id, fromType: from.type, toType: to.type }) as unknown as Edge

// The one confidence rule (D-253, D-271): validated 2, testing 1, else 0; share ≥ 0.75 high, ≥ 0.34 medium, else low;
// anything invalidated → broken; nothing behind it → low.
describe('confidenceOf', () => {
  it('is low with nothing behind it', () => {
    expect(confidenceOf([]).level).toBe('low')
    expect(confidenceOf([card('feature'), card('competitor')]).level).toBe('low')
  })
  it('is high at a share of 0.75 or more', () => {
    expect(confidenceOf([card('idea', { validation: 'validated' })]).level).toBe('high')
    // (2 + 1) / 4 = 0.75
    expect(confidenceOf([card('idea', { validation: 'validated' }), card('problem', { validation: 'testing' })]).level).toBe('high')
  })
  it('is medium from 0.34, low under it', () => {
    // 1 / 2 = 0.5
    expect(confidenceOf([card('idea', { validation: 'testing' })]).level).toBe('medium')
    // 1 / 4 = 0.25
    expect(confidenceOf([card('idea', { validation: 'testing' }), card('problem')]).level).toBe('low')
  })
  it('is broken when anything is invalidated', () => {
    const c = confidenceOf([card('idea', { validation: 'validated' }), card('customer', { validation: 'invalidated', title: 'Owners' })])
    expect(c.level).toBe('broken')
    expect(c.why).toContain('Owners')
  })
  it('counts a card once', () => {
    const v = card('idea', { validation: 'testing' })
    expect(confidenceOf([v, v, card('problem', { validation: 'validated' })]).level).toBe('high')
  })
})

describe('confidenceFor and the suggested order', () => {
  it("reads a feature's ideas and the problems they solve", () => {
    const problem = card('problem', { validation: 'validated' })
    const idea = card('idea', { validation: 'validated' })
    const feature = card('feature', { impact: 'high', effort: 'S' })
    const edges = [edge('solves', idea, problem), edge('relates', feature, idea)]
    expect(confidenceFor(feature, [problem, idea, feature], edges)?.level).toBe('high')
    expect(confidenceFor(problem, [problem, idea, feature], edges)).toBeUndefined()
    expect(scoreOf(feature, 'high')).toBe(9)
    expect(scoreOf(card('feature'), 'high')).toBeNull()
    expect(scoreOf(feature, 'broken')).toBe(0)
    const [first] = suggestedOrder([feature], [problem, idea, feature], edges)
    expect(first.suggested).toBe('P1')
  })
})
