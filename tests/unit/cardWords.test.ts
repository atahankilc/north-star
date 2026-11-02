// The words cards and tasks say, from their one home (D-358): model/cardName.ts and model/tasks.ts.
import { describe, expect, it } from 'vitest'
import { cardName, cardPlaceholder } from '../../src/model/cardName'
import { checkCells, dueText, initials } from '../../src/model/tasks'

describe('cardName', () => {
  it('is the title, or untitled and the type', () => {
    expect(cardName({ title: 'Office workers', type: 'customer' })).toBe('Office workers')
    expect(cardName({ title: '', type: 'idea' })).toBe('untitled idea')
  })
  it('an empty card on its face asks its question', () => {
    expect(cardPlaceholder('problem')).toBe('What hurts?')
  })
})

describe('dueText', () => {
  const now = '2026-11-02'
  it('names the near days', () => {
    expect(dueText('2026-11-02', now)).toBe('today')
    expect(dueText('2026-11-03', now)).toBe('tomorrow')
    expect(dueText('2026-11-01', now)).toBe('yesterday')
  })
  it('writes the others as a day and a month, the year only when not this one', () => {
    expect(dueText('2026-10-28', now)).toBe('28 oct')
    expect(dueText('2027-01-05', now)).toBe('5 jan 2027')
  })
})

describe('initials', () => {
  it('first and last, or two letters of one name, or ?', () => {
    expect(initials('Atahan Kılıç')).toBe('AK')
    expect(initials('alice')).toBe('AL')
    expect(initials('  ')).toBe('?')
    expect(initials()).toBe('?')
  })
})

describe('checkCells', () => {
  it('done filled, the rest open; none past eight', () => {
    expect(checkCells(2, 3)).toBe('▮▮▯')
    expect(checkCells(3, 9)).toBe('')
  })
})
