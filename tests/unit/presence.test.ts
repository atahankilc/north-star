// Presence's photo check (D-317): only Google's image host, as database.rules.json allows.
import { describe, expect, it } from 'vitest'
import { safePhoto } from '../../src/data/presence'

describe('safePhoto', () => {
  it("keeps a Google account's photo", () => {
    expect(safePhoto('https://lh3.googleusercontent.com/a/abc=s96-c')).toBe('https://lh3.googleusercontent.com/a/abc=s96-c')
  })
  it('drops any other address', () => {
    for (const url of ['https://example.com/a.png', 'https://lh3.googleusercontent.com.evil.example/a.png', 'http://lh3.googleusercontent.com/a.png', 'javascript:alert(1)', `https://lh3.googleusercontent.com/${'a'.repeat(2048)}`])
      expect(safePhoto(url)).toBeUndefined()
    expect(safePhoto(null)).toBeUndefined()
  })
})
