// What functions copy into RTDB for its rules (D-426, functions/src/mirror.ts): each member's role, and a document's
// author, sharing and kind; nothing for what's gone, and no copy for a write that changed none of it.
import { describe, expect, it } from 'vitest'
import { accessOf, docAccessOf, sameAccess, sameDocAccess } from '../../functions/src/mirror'

const ws = { ownerId: 'a', memberIds: ['a', 'b', 'c'], roles: { a: 'owner', b: 'editor', c: 'viewer' } }

describe('the copy of the roles', () => {
  it('has every member with a known role', () => expect(accessOf(ws)).toEqual({ a: 'owner', b: 'editor', c: 'viewer' }))
  it('leaves out a role that is not one, and someone not a member', () =>
    expect(accessOf({ ...ws, memberIds: ['a', 'b'], roles: { a: 'owner', b: 'admin', c: 'viewer' } })).toEqual({ a: 'owner' }))
  it('is nothing for a workspace that is gone', () => expect(accessOf(undefined)).toBeNull())
  it('is not made again for a rename', () => expect(sameAccess(ws, { ...ws, name: 'New' } as typeof ws)).toBe(true))
  it('is made again for a new role', () => expect(sameAccess(ws, { ...ws, roles: { ...ws.roles, c: 'editor' } })).toBe(false))
})

describe("the copy of a document", () => {
  const d = { uid: 'a', shared: false, kind: 'markdown', title: 'Notes' }
  it('keeps only what the rules read', () => expect(docAccessOf(d)).toEqual({ uid: 'a', shared: false, kind: 'markdown' }))
  it('reads an absent sharing as private', () => expect(docAccessOf({ uid: 'a', kind: 'pdf' })?.shared).toBe(false))
  it('is nothing for a document that is gone', () => expect(docAccessOf(undefined)).toBeNull())
  it('is not made again for a new title', () => expect(sameDocAccess(d, { ...d, title: 'Other' })).toBe(true))
  it('is made again when shared', () => expect(sameDocAccess(d, { ...d, shared: true })).toBe(false))
})
