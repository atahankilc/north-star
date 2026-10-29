import { beforeEach, describe, expect, it } from 'vitest'

// A localStorage for node; Firebase stays unconfigured in vitest (vitest.config.ts), so the remote read is
// `unavailable` and the store runs on localStorage alone, as it must when the rules aren't there.
const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  get length() {
    return mem.size
  },
} as Storage

const { useProgress } = await import('./progress')
const settle = () => new Promise((r) => setTimeout(r, 0))

describe('progress', () => {
  beforeEach(async () => {
    await useProgress.getState().stop()
    mem.clear()
  })

  it('a new person: nothing kept, then begin() records the first state', async () => {
    useProgress.getState().startFor('u1')
    expect(useProgress.getState().hadDoc).toBe(false)
    await settle()
    expect(useProgress.getState().loaded).toBe(true)
    useProgress.getState().begin('new', 'launch')
    expect(useProgress.getState().lastRelease).toBe('launch')
    expect(JSON.parse(mem.get('north-star:onboarding:u1')!).audience).toBe('new')
  })

  it('kept in this browser: read at once on start (nothing flashes), known', async () => {
    useProgress.getState().startFor('u2')
    useProgress.getState().begin('invited', 'launch')
    useProgress.getState().markSeen('focus', 1)
    useProgress.getState().setWelcome('done')
    await useProgress.getState().stop()
    useProgress.getState().startFor('u2')
    const s = useProgress.getState()
    expect(s.hadDoc).toBe(true)
    expect(s.seen).toEqual({ focus: 1 })
    expect(s.welcome).toBe('done')
    expect(s.state?.audience).toBe('invited')
  })

  it('arm, markSeen clears it; lower versions change nothing', () => {
    useProgress.getState().startFor('u3')
    useProgress.getState().begin('new', 'launch')
    useProgress.getState().arm(['deck@2', 'focus'])
    expect(useProgress.getState().isArmed('deck')).toBe(true)
    useProgress.getState().markSeen('deck', 1)
    expect(useProgress.getState().isArmed('deck')).toBe(true)
    useProgress.getState().markSeen('deck', 2)
    expect(useProgress.getState().isArmed('deck')).toBe(false)
    useProgress.getState().markSeen('deck', 1)
    expect(useProgress.getState().seen.deck).toBe(2)
    expect(useProgress.getState().armed).toEqual(['focus@1'])
  })

  it('tipsOff and lastRelease are stamped', () => {
    useProgress.getState().startFor('u4')
    useProgress.getState().begin('new', 'launch')
    useProgress.getState().setTipsOff(true)
    useProgress.getState().setLastRelease('2026-11')
    const s = useProgress.getState()
    expect(s.tipsOff).toBe(true)
    expect(s.lastRelease).toBe('2026-11')
    expect(s.state?.at?.tipsOff).toBeTypeOf('number')
  })

  it('nothing is kept without a person', () => {
    useProgress.getState().markSeen('focus', 1)
    expect(useProgress.getState().state).toBeNull()
    expect(mem.size).toBe(0)
  })
})
