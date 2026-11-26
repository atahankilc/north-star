// A card named in a message (D-436): picked as `#Name`, sent as `[[id|name]]`, read back as its name.
import { describe, expect, it } from 'vitest'
import { cardRefsAsText, cardRefsForEditing, withCardRefs } from '../../src/model/cardRefs'

describe('a card in a message', () => {
  it('goes in as its reference, the longest name first', () => {
    const picked = new Map([['a', 'Lunch'], ['b', 'Lunch order']])
    expect(withCardRefs('see #Lunch order and #Lunch', picked)).toBe('see [[b|Lunch order]] and [[a|Lunch]]')
  })
  it('reads as its name, a cut one as …', () => {
    expect(cardRefsAsText('see [[b|Lunch order]] now')).toBe('see Lunch order now')
    expect(cardRefsAsText('see [[b|Lunch or')).toBe('see …')
  })
  it('comes back for editing as #Name with its card', () => {
    const { text, picked } = cardRefsForEditing('see [[b|Lunch order]]')
    expect(text).toBe('see #Lunch order')
    expect([...picked]).toEqual([['b', 'Lunch order']])
    expect(withCardRefs(text, picked)).toBe('see [[b|Lunch order]]')
  })
})
