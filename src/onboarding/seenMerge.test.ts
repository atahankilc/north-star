import { describe, expect, it } from 'vitest'
import { cleanArmed, cleanSeenState, freshState, isArmed, mergeSeenState, sameSeenState, type SeenState } from './seenMerge'

const base = (patch: Partial<SeenState> = {}): SeenState => ({ ...freshState('new', 'launch', 1000), ...patch })

describe('mergeSeenState', () => {
  it('seen: union, the max version per lesson', () => {
    const local = base({ seen: { focus: 1, plus: 2 } })
    const remote = base({ seen: { focus: 2, deck: 1 } })
    expect(mergeSeenState(local, remote).seen).toEqual({ focus: 2, plus: 2, deck: 1 })
    expect(mergeSeenState(remote, local).seen).toEqual({ focus: 2, plus: 2, deck: 1 })
  })

  it('armed: union, cleared by what either side has seen at that version', () => {
    const local = base({ armed: ['side-view@1', 'deck@2'], seen: { deck: 1 } })
    const remote = base({ armed: ['timeline@1'], seen: { 'side-view': 1 } })
    const m = mergeSeenState(local, remote)
    expect(m.armed.sort()).toEqual(['deck@2', 'timeline@1'])
    expect(isArmed(m, 'deck')).toBe(true)
    expect(isArmed(m, 'side-view')).toBe(false)
  })

  it('armed at a newer version stays after the old one was seen; seen at it clears it', () => {
    expect(cleanArmed(['focus@2'], { focus: 1 })).toEqual(['focus@2'])
    expect(cleanArmed(['focus@2'], { focus: 2 })).toEqual([])
    expect(cleanArmed(['focus@1', 'focus@3', 'focus'], {})).toEqual(['focus@3'])
    expect(cleanArmed(['plus'], { plus: 1 })).toEqual([])
  })

  it('stamped fields: the side that set them last wins, field by field', () => {
    const local = base({ tipsOff: true, at: { tipsOff: 5000, lastRelease: 1000 }, updatedAt: 9000 })
    const remote = base({ tipsOff: false, lastRelease: '2026-11', welcome: 'skipped', at: { tipsOff: 3000, lastRelease: 4000, welcome: 4000 }, updatedAt: 4000 })
    const m = mergeSeenState(local, remote)
    expect(m.tipsOff).toBe(true)
    expect(m.lastRelease).toBe('2026-11')
    expect(m.welcome).toBe('skipped')
    expect(m.updatedAt).toBe(9000)
  })

  it('an older copy wins nothing: a newer doc changed for another reason keeps the newer tipsOff', () => {
    // Device A turned tips off at 5000; device B, still with its old copy, saw a lesson at 8000.
    const a = base({ tipsOff: true, at: { tipsOff: 5000, lastRelease: 1000 }, updatedAt: 5000 })
    const b = base({ seen: { focus: 1 }, updatedAt: 8000 })
    expect(mergeSeenState(b, a).tipsOff).toBe(true)
    expect(mergeSeenState(a, b).tipsOff).toBe(true)
    expect(mergeSeenState(b, a).seen).toEqual({ focus: 1 })
  })

  it('wholly older remote: local kept as is', () => {
    const remote = base()
    const local = base({ seen: { focus: 2 }, armed: ['deck@1'], tipsOff: true, welcome: 'done', at: { tipsOff: 2000, welcome: 2000, lastRelease: 1000 }, updatedAt: 2000 })
    expect(sameSeenState(mergeSeenState(local, remote), local)).toBe(true)
    expect(sameSeenState(mergeSeenState(remote, local), local)).toBe(true)
  })

  it('a tie goes by value, not by side', () => {
    expect(mergeSeenState(base({ tipsOff: true }), base({ tipsOff: false })).tipsOff).toBe(true)
    expect(mergeSeenState(base({ tipsOff: false }), base({ tipsOff: true })).tipsOff).toBe(true)
  })

  it('audience and startedAt: the copy started first', () => {
    const local = base({ audience: 'new', startedAt: 2000 })
    const remote = base({ audience: 'invited', startedAt: 1500 })
    const m = mergeSeenState(local, remote)
    expect(m.audience).toBe('invited')
    expect(m.startedAt).toBe(1500)
  })

  it('nudges: the later', () => {
    expect(mergeSeenState(base({ nudges: { last: 10 } }), base({ nudges: { last: 20 } })).nudges).toEqual({ last: 20 })
    expect(mergeSeenState(base(), base()).nudges).toBeUndefined()
  })

  it('never writes undefined fields (Firestore refuses them)', () => {
    const m = mergeSeenState(base(), base())
    expect(Object.values(m).every((v) => v !== undefined)).toBe(true)
    expect('welcome' in m).toBe(false)
  })
})

describe('cleanSeenState', () => {
  it('refuses what is not a seen-state', () => {
    expect(cleanSeenState(null)).toBeNull()
    expect(cleanSeenState({ v: 2, audience: 'new', startedAt: 1 })).toBeNull()
    expect(cleanSeenState({ v: 1, audience: 'old', startedAt: 1 })).toBeNull()
  })

  it('drops bad parts and keeps the good', () => {
    const s = cleanSeenState({ v: 1, audience: 'new', startedAt: 1, seen: { focus: 2, bad: 'x', zero: 0 }, armed: ['a@1', 5], tipsOff: 'yes', welcome: 'maybe' })
    expect(s).not.toBeNull()
    expect(s!.seen).toEqual({ focus: 2 })
    expect(s!.armed).toEqual(['a@1'])
    expect(s!.tipsOff).toBe(false)
    expect(s!.welcome).toBeUndefined()
    expect(s!.lastRelease).toBe('')
    expect(s!.updatedAt).toBe(1)
  })

  it('round-trips a real state', () => {
    const s = base({ seen: { focus: 1 }, armed: ['deck@2'], welcome: 'done', nudges: { last: 5 } })
    expect(sameSeenState(cleanSeenState(JSON.parse(JSON.stringify(s)))!, s)).toBe(true)
  })
})

describe('fresh states and caps', () => {
  it('freshState stamps nothing: only real setters do', () => {
    expect(freshState('new', 'launch', 5).at).toBeUndefined()
    const remote = base({ tipsOff: true, lastRelease: 'launch', at: { tipsOff: 1, lastRelease: 1 } })
    const early = freshState('new', '', 99999)
    const m = mergeSeenState(early, remote)
    expect(m.tipsOff).toBe(true)
    expect(m.lastRelease).toBe('launch')
  })

  it('a merge never passes MAX_SEEN ids', () => {
    const many = (p: string) => Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`${p}${i}`, 1]))
    const m = mergeSeenState(base({ seen: many('a') }), base({ seen: { ...many('b'), a0: 3 } }))
    expect(Object.keys(m.seen)).toHaveLength(300)
    expect(m.seen.a0).toBe(3)
  })
})

describe('symmetry: merge(a, b) deep-equals merge(b, a)', () => {
  const cases: Array<[string, SeenState, SeenState]> = [
    ['armed in different orders', base({ armed: ['b@1', 'a@1'] }), base({ armed: ['c@2', 'a@1'] })],
    ['seen keys in different orders', base({ seen: { z: 1, a: 2 } }), base({ seen: { a: 1, m: 1 } })],
    ['both unstamped, lastRelease launch vs empty', base({ lastRelease: 'launch' }), base({ lastRelease: '' })],
    ['both unstamped, tipsOff true vs false', base({ tipsOff: true }), base({ tipsOff: false })],
    ['same stamp, different welcome', base({ welcome: 'done', at: { welcome: 7 } }), base({ welcome: 'skipped', at: { welcome: 7 } })],
    ['same stamp, welcome vs none', base({ welcome: 'done', at: { welcome: 7 } }), base({ at: { welcome: 7 } })],
    ['same startedAt, different audience', base({ audience: 'new' }), base({ audience: 'invited' })],
    ['different stamps and everything', base({ seen: { a: 1 }, armed: ['x@1'], tipsOff: true, at: { tipsOff: 9 }, nudges: { last: 3 }, updatedAt: 50 }),
      base({ seen: { a: 2, b: 1 }, armed: ['a@2', 'y@1'], lastRelease: '2026-11', at: { lastRelease: 4 }, startedAt: 900, updatedAt: 40 })],
    ['over the caps', base({ seen: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`a${i}`, 1])) }),
      base({ seen: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`b${i}`, 1])) })],
  ]
  for (const [name, a, b] of cases) {
    it(name, () => {
      const ab = mergeSeenState(a, b)
      const ba = mergeSeenState(b, a)
      expect(ab).toEqual(ba)
      expect(JSON.stringify(ab)).toBe(JSON.stringify(ba))
      // Merging the result again with either side changes nothing: two tabs settle after one round.
      expect(mergeSeenState(ab, a)).toEqual(ab)
      expect(mergeSeenState(b, ab)).toEqual(ab)
    })
  }

  it('ties go by value', () => {
    expect(mergeSeenState(base({ lastRelease: '' }), base({ lastRelease: 'launch' })).lastRelease).toBe('launch')
    expect(mergeSeenState(base({ tipsOff: false }), base({ tipsOff: true })).tipsOff).toBe(true)
    expect(mergeSeenState(base(), base({ welcome: 'done', at: { welcome: 0 } })).welcome).toBe('done')
    expect(mergeSeenState(base({ audience: 'new' }), base({ audience: 'invited' })).audience).toBe('invited')
  })
})
