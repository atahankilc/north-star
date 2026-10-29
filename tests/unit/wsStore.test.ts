import { describe, expect, it, vi } from 'vitest'
import { getWs, makeStore, registerStore, subscribeWs, type WorkspaceCtx } from '../../src/state/wsStore'

const ws = (wid: string) => ({ wid, canvas: 'main' }) as unknown as WorkspaceCtx

describe('getWs (R9)', () => {
  it('is null with no store, the registered value after, and null again once it unregisters', () => {
    expect(getWs()).toBeNull()
    const store = makeStore(ws('a'))
    const off = registerStore(store)
    expect(getWs()?.wid).toBe('a')
    store.set(ws('b'))
    expect(getWs()?.wid).toBe('b')
    off()
    expect(getWs()).toBeNull()
  })

  it("keeps the newest store when an older one unmounts (dev's double mount)", () => {
    const first = makeStore(ws('first'))
    const second = makeStore(ws('second'))
    const offFirst = registerStore(first)
    const offSecond = registerStore(second)
    offFirst()
    expect(getWs()?.wid).toBe('second')
    offSecond()
    expect(getWs()).toBeNull()
  })

  it('is a stack: the top store is current, and an unregister takes out only its own store', () => {
    const a = makeStore(ws('A'))
    const b = makeStore(ws('B'))
    const offA = registerStore(a)
    const offB = registerStore(b)
    expect(getWs()?.wid).toBe('B')
    offB()
    expect(getWs()?.wid).toBe('A')
    const offB2 = registerStore(b)
    offA()
    expect(getWs()?.wid).toBe('B')
    offB2()
    expect(getWs()).toBeNull()
  })

  it("tells subscribers of the current store's changes and of the store coming and going", () => {
    const on = vi.fn()
    const unsub = subscribeWs(on)
    const store = makeStore(ws('a'))
    const off = registerStore(store)
    expect(on).toHaveBeenCalledTimes(1)
    store.set(ws('b'))
    store.tell()
    expect(on).toHaveBeenCalledTimes(2)
    off()
    expect(on).toHaveBeenCalledTimes(3)
    // A store no longer current isn't heard.
    store.tell()
    expect(on).toHaveBeenCalledTimes(3)
    unsub()
  })
})
