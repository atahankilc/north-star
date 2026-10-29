// agentDriving (S9, R11): true while a facade call runs and SETTLE_MS after it settles; onboarding reads it.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { agentDriving, driving, SETTLE_MS } from '../../src/agent/driving'

describe('agentDriving', () => {
  afterEach(() => void vi.useRealTimers())

  it('is false at rest, true during a sync call and for the settle time after', () => {
    vi.useFakeTimers()
    vi.advanceTimersByTime(SETTLE_MS * 4)
    expect(agentDriving()).toBe(false)
    let inside = false
    expect(driving(() => ((inside = agentDriving()), 7))).toBe(7)
    expect(inside).toBe(true)
    expect(agentDriving()).toBe(true)
    vi.advanceTimersByTime(SETTLE_MS - 1)
    expect(agentDriving()).toBe(true)
    vi.advanceTimersByTime(2)
    expect(agentDriving()).toBe(false)
  })

  it('counts async calls until they settle, overlapping ones too, and a throw still settles', async () => {
    vi.useFakeTimers()
    vi.advanceTimersByTime(SETTLE_MS * 4)
    let end1 = () => {}
    let end2 = () => {}
    const a = driving(() => new Promise<void>((r) => (end1 = r)))
    const b = driving(() => new Promise<void>((r) => (end2 = r)))
    vi.advanceTimersByTime(SETTLE_MS * 3)
    expect(agentDriving()).toBe(true)
    end1()
    await a
    vi.advanceTimersByTime(SETTLE_MS * 3)
    // b still runs.
    expect(agentDriving()).toBe(true)
    end2()
    await b
    expect(agentDriving()).toBe(true)
    vi.advanceTimersByTime(SETTLE_MS + 1)
    expect(agentDriving()).toBe(false)
    expect(() => driving(() => { throw new Error('no') })).toThrow('no')
    expect(agentDriving()).toBe(true)
    vi.advanceTimersByTime(SETTLE_MS + 1)
    await expect(driving(() => Promise.reject(new Error('later')))).rejects.toThrow('later')
    expect(agentDriving()).toBe(true)
    vi.advanceTimersByTime(SETTLE_MS + 1)
    expect(agentDriving()).toBe(false)
  })
})
