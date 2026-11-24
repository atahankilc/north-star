// Deleting an account (D-432, functions/src/account.ts): what happens to each workspace.
import { describe, expect, it } from 'vitest'
import { fateOf, FRESH_S, isFresh } from '../../functions/src/account'

const ws = (roles: Record<string, string>) => ({ ownerId: 'me', memberIds: Object.keys(roles), roles })

describe('what happens to a workspace', () => {
  it('goes when they are alone in it, whatever their role says', () => {
    expect(fateOf(ws({ me: 'owner' }), 'me')).toBe('delete')
    expect(fateOf(ws({ me: 'viewer' }), 'me')).toBe('delete')
  })
  it('is left when another owner stays, or they were never an owner', () => {
    expect(fateOf(ws({ me: 'owner', a: 'owner' }), 'me')).toBe('leave')
    expect(fateOf(ws({ me: 'editor', a: 'owner' }), 'me')).toBe('leave')
  })
  it('blocks when they are its only owner and others are in it', () => {
    expect(fateOf(ws({ me: 'owner', a: 'editor' }), 'me')).toBe('blocked')
  })
  it('is none of theirs when they are not in it', () => {
    expect(fateOf(ws({ a: 'owner' }), 'me')).toBeNull()
  })
})

it('takes only a sign-in of the last few minutes', () => {
  expect(isFresh(1000, 1000_000 + (FRESH_S - 1) * 1000)).toBe(true)
  expect(isFresh(1000, 1000_000 + FRESH_S * 1000)).toBe(false)
  expect(isFresh(undefined, 0)).toBe(false)
})
