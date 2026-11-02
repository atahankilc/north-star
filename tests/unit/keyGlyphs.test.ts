import { describe, expect, it } from 'vitest'
import { isMacLike, keyGlyphs } from '../../src/ui/foundation/keyGlyphs'
import { KEYS } from '../../src/onboarding/keys'

describe('keyGlyphs (D-355)', () => {
  it('a Mac keeps the glyphs', () => {
    expect(keyGlyphs('⇧⌘Z  ⌃Y', true)).toBe('⇧⌘Z  ⌃Y')
  })
  it('elsewhere, the modifiers in words, Ctrl first', () => {
    expect(keyGlyphs('⌘F', false)).toBe('Ctrl+F')
    expect(keyGlyphs('⇧⌘Z  ⌃Y', false)).toBe('Ctrl+Shift+Z  Ctrl+Y')
    expect(keyGlyphs('⌥1–⌥9', false)).toBe('Alt+1–Alt+9')
    expect(keyGlyphs('⌥ drag', false)).toBe('Alt drag')
    expect(keyGlyphs('⇧↵', false)).toBe('Shift+↵')
    expect(keyGlyphs('delete  ⌫', false)).toBe('delete  Backspace')
    expect(keyGlyphs('⌥C ⌥W ⌥X', false)).toBe('Alt+C Alt+W Alt+X')
    expect(keyGlyphs('pinch or ⌃: faster', false)).toBe('pinch or Ctrl: faster')
    expect(keyGlyphs('done', false)).toBe('done')
  })
  it('no Mac glyph is left in any key row elsewhere', () => {
    for (const k of KEYS) expect(keyGlyphs(`${k.keys} ${k.what}`, false)).not.toMatch(/[⌃⌘⌥⇧⌫⇥]/)
  })
  it('tells a Mac from others', () => {
    expect(isMacLike({ platform: 'MacIntel' } as Navigator)).toBe(true)
    expect(isMacLike({ platform: 'Win32' } as Navigator)).toBe(false)
    expect(isMacLike({ platform: '', userAgent: 'X11; Linux x86_64' } as Navigator)).toBe(false)
    expect(isMacLike({ userAgentData: { platform: 'Windows' }, platform: '' } as unknown as Navigator)).toBe(false)
  })
})
