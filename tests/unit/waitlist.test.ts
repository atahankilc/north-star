// atem-lab.com's waitlist (D-429, functions/src/waitlist.ts): what the function takes in, and what it refuses.
import { describe, expect, it } from 'vitest'
import { readWaitlistBody, WAITLIST_EMAIL_MAX, WaitlistError } from '../../functions/src/waitlist'
import { EMAIL_MAX } from '../../src/model/limits'

describe('the waitlist', () => {
  it('keeps an email trimmed and lowercased, with its product', () => {
    expect(readWaitlistBody({ email: '  Ada@Example.COM ', product: 'orrery' })).toEqual({ email: 'ada@example.com', product: 'orrery' })
    expect(readWaitlistBody({ email: 'ada@example.com', product: 'granat' })).toEqual({ email: 'ada@example.com', product: 'granat' })
  })

  it('refuses what is not an email', () => {
    for (const email of ['', 'ada', 'ada@example', 'a da@example.com', 42, undefined]) {
      expect(() => readWaitlistBody({ email, product: 'granat' })).toThrow(WaitlistError)
    }
    expect(() => readWaitlistBody({ email: `${'a'.repeat(WAITLIST_EMAIL_MAX)}@x.io`, product: 'granat' })).toThrow(WaitlistError)
  })

  it('refuses a product with no waitlist', () => {
    expect(() => readWaitlistBody({ email: 'ada@example.com', product: 'north-star' })).toThrow(WaitlistError)
    expect(() => readWaitlistBody({ email: 'ada@example.com' })).toThrow(WaitlistError)
  })

  it('drops a bot quietly (the hidden field filled)', () => {
    expect(readWaitlistBody({ email: 'x@y.zz', product: 'granat', website: 'http://spam' })).toBe('bot')
  })

  it('caps an email as the app does', () => {
    expect(WAITLIST_EMAIL_MAX).toBe(EMAIL_MAX)
  })
})
