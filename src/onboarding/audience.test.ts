import { describe, expect, it } from 'vitest'
import { canEditHere, fitsRole, newestRelease, releasesSince, roleHere, whoIs } from './audience'

const ws = {
  memberIds: ['alice', 'bob', 'carol'],
  roles: { alice: 'owner', bob: 'editor', carol: 'viewer' } as const,
}

describe('whoIs', () => {
  it('no doc and an own (or no) workspace: new', () => {
    expect(whoIs({ uid: 'alice', hasDoc: false })).toBe('new')
    expect(whoIs({ uid: 'alice', hasDoc: false, firstWorkspace: { ownerId: 'alice', pieceCount: 4 } })).toBe('new')
  })

  it("no doc on an old account is still new (Q-026): age isn't an input", () => {
    expect(whoIs({ uid: 'old-account', hasDoc: false, firstWorkspace: null })).toBe('new')
  })

  it("no doc, first workspace someone else's with pieces: invited", () => {
    expect(whoIs({ uid: 'bob', hasDoc: false, firstWorkspace: { ownerId: 'alice', pieceCount: 3 } })).toBe('invited')
  })

  it("someone else's empty workspace: new", () => {
    expect(whoIs({ uid: 'bob', hasDoc: false, firstWorkspace: { ownerId: 'alice', pieceCount: 0 } })).toBe('new')
  })

  it('a doc: known, whatever the workspace', () => {
    expect(whoIs({ uid: 'bob', hasDoc: true, firstWorkspace: { ownerId: 'alice', pieceCount: 3 } })).toBe('known')
  })
})

describe('roles per workspace', () => {
  it('owner, editor, viewer, not a member', () => {
    expect(roleHere(ws, 'alice')).toBe('owner')
    expect(roleHere(ws, 'bob')).toBe('editor')
    expect(roleHere(ws, 'carol')).toBe('viewer')
    expect(roleHere(ws, 'erin')).toBeNull()
    expect(roleHere(ws, undefined)).toBeNull()
  })

  it('a role without membership counts for nothing', () => {
    expect(roleHere({ memberIds: [], roles: { alice: 'owner' } }, 'alice')).toBeNull()
  })

  it('a viewer here can own another workspace', () => {
    const other = { memberIds: ['carol'], roles: { carol: 'owner' } as const }
    expect(roleHere(ws, 'carol')).toBe('viewer')
    expect(roleHere(other, 'carol')).toBe('owner')
  })

  it('editing: owners and editors only', () => {
    expect(canEditHere(ws, 'alice')).toBe(true)
    expect(canEditHere(ws, 'bob')).toBe(true)
    expect(canEditHere(ws, 'carol')).toBe(false)
  })

  it('fitsRole', () => {
    expect(fitsRole(undefined, 'viewer')).toBe(true)
    expect(fitsRole([], 'viewer')).toBe(true)
    expect(fitsRole(['owner', 'editor'], 'viewer')).toBe(false)
    expect(fitsRole(['owner', 'editor'], 'editor')).toBe(true)
    expect(fitsRole(undefined, null)).toBe(false)
  })
})

describe('releasesSince', () => {
  const releases = [{ id: '2026-12' }, { id: '2026-11' }, { id: 'launch' }]

  it('what came after lastRelease, newest first', () => {
    expect(releasesSince('launch', releases).map((r) => r.id)).toEqual(['2026-12', '2026-11'])
    expect(releasesSince('2026-11', releases).map((r) => r.id)).toEqual(['2026-12'])
  })

  it('nothing when already at the newest', () => {
    expect(releasesSince('2026-12', releases)).toEqual([])
  })

  it('nothing for an unknown or empty id', () => {
    expect(releasesSince('', releases)).toEqual([])
    expect(releasesSince('2027-01', releases)).toEqual([])
  })

  it('newestRelease', () => {
    expect(newestRelease(releases)).toBe('2026-12')
    expect(newestRelease([])).toBe('')
  })
})
