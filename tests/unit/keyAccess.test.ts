// Who may spend the workspace key (functions/src/access.ts; D-098, D-318): viewers never, even with access `everyone`.
import { describe, expect, it } from 'vitest'
import { mayUseKey } from '../../functions/src/access'

const ws = { ownerId: 'o', memberIds: ['o', 'e', 'v'], roles: { o: 'owner', e: 'editor', v: 'viewer' } }

describe('mayUseKey', () => {
  it('lets owners, and editors when everyone or chosen', () => {
    expect(mayUseKey(ws, 'o', {})).toBe(true)
    expect(mayUseKey(ws, 'e', { access: 'everyone' })).toBe(true)
    expect(mayUseKey(ws, 'e', { access: 'chosen', allowed: ['e'] })).toBe(true)
    expect(mayUseKey(ws, 'e', { access: 'chosen' })).toBe(false)
  })
  it('never a viewer, whatever was chosen', () => {
    expect(mayUseKey(ws, 'v', { access: 'everyone' })).toBe(false)
    expect(mayUseKey(ws, 'v', { access: 'chosen', allowed: ['v'] })).toBe(false)
  })
  it('never someone outside', () => expect(mayUseKey(ws, 'x', { access: 'everyone' })).toBe(false))
})
