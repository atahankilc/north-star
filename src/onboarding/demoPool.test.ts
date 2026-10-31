// @vitest-environment happy-dom
// @vitest-environment-options { "happyDOM": { "settings": { "disableIframePageLoading": true, "disableJavaScriptFileLoading": true, "disableCSSFileLoading": true, "handleDisabledFileLoadingAsSuccess": true } } }
// The demos' one frame (demoPool.ts, Demo.tsx): lent to a Demo from its layout effect and given back by the cleanup, so
// StrictMode's mount → cleanup → mount and a slot moved to another container hand it over in order (O16c review).
// `moveBefore` is mocked (happy-dom has none): a plain insertBefore, the frame's document isn't modelled.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode, act, createElement, useState } from 'react'
import { createPortal } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { disposeDemoPool, giveBack, lend, poolState, preloadDemo, resetPoolForTests } from './demoPool'
import { useCanvasView } from '../state/canvasView'
import { Demo } from './Demo'

const g = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
g.IS_REACT_ACT_ENVIRONMENT = true
const createElement0 = document.createElement
const proto = Element.prototype as unknown as { moveBefore?: (n: Node, c: Node | null) => void }

// happy-dom reports each frame's page as not loaded (loading is off here), some of it after a test: not what's tested.
// Not restored (vitest runs each file on its own).
beforeEach(() => {
  // Every frame with an empty srcdoc: happy-dom draws that and never tries to load the page (which it reports on stderr).
  const make = createElement0
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, o?: ElementCreationOptions) => {
    const el = make.call(document, tag, o)
    if (tag.toLowerCase() === 'iframe') {
      el.setAttribute('srcdoc', '')
      // Its page (an empty srcdoc, origin null) would refuse the app's messages: a window that takes them.
      Object.defineProperty(el, 'contentWindow', { value: { postMessage() {} } })
    }
    return el
  }) as typeof document.createElement)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(window.console, 'error').mockImplementation(() => {})
  proto.moveBefore = function (this: Element, n: Node, c: Node | null) {
    if (!this.isConnected || !(n as Element).isConnected) throw new DOMException('invalid hierarchy', 'HierarchyRequestError')
    this.insertBefore(n, c)
  }
})
afterEach(() => {
  vi.mocked(document.createElement).mockRestore()
  resetPoolForTests()
  delete proto.moveBefore
  document.body.innerHTML = ''
})

const frames = () => document.querySelectorAll('iframe').length

describe('demoPool', () => {
  it('lends the frame into a slot and takes it back into its holder', () => {
    preloadDemo()()
    const slot = document.body.appendChild(document.createElement('div'))
    const p = lend(slot)!
    expect(p.lent).toBe(true)
    expect(p.frame.parentElement).toBe(slot)
    expect(lend(document.body.appendChild(document.createElement('div')))).toBeNull()
    giveBack(p)
    expect(p.lent).toBe(false)
    expect(p.frame.parentElement).toBe(poolState().holder)
    expect(frames()).toBe(1)
  })

  it('makes the frame itself when a lesson comes before the idle moment, and never a second one', () => {
    const slot = document.body.appendChild(document.createElement('div'))
    const p = lend(slot)
    expect(p).not.toBeNull()
    preloadDemo()()
    expect(frames()).toBe(1)
  })

  it('drops the frame when it is not wanted any more (tips off, the coach gone), now or once given back', () => {
    preloadDemo()()
    const slot = document.body.appendChild(document.createElement('div'))
    const p = lend(slot)!
    disposeDemoPool()
    expect(p.frame.isConnected).toBe(true)
    giveBack(p)
    expect(frames()).toBe(0)
    expect(poolState().pool).toBeNull()
  })

  it('a slot already off the page: the frame is dropped and made again only while wanted', () => {
    preloadDemo()()
    const slot = document.body.appendChild(document.createElement('div'))
    const p = lend(slot)!
    slot.remove()
    giveBack(p)
    expect(poolState().pool).toBeNull()
    expect(poolState().wanted).toBe(true)
  })
})

describe('demoPool, made only when idle and still', () => {
  it('waits while the camera moved in the last 500 ms; no timeout forces it', () => {
    const queued: Array<() => void> = []
    const w = window as unknown as { requestIdleCallback?: unknown; cancelIdleCallback?: unknown }
    const was = [w.requestIdleCallback, w.cancelIdleCallback]
    w.requestIdleCallback = (f: () => void, o?: unknown) => {
      expect(o).toBeUndefined()
      queued.push(f)
      return queued.length
    }
    w.cancelIdleCallback = () => {}
    const now = vi.spyOn(performance, 'now')
    try {
      now.mockReturnValue(1000)
      preloadDemo()
      useCanvasView.setState({ cams: { ...useCanvasView.getState().cams } })
      now.mockReturnValue(1300)
      queued.shift()!()
      expect(poolState().pool).toBeNull()
      expect(queued.length).toBe(1)
      now.mockReturnValue(1600)
      queued.shift()!()
      expect(poolState().pool).not.toBeNull()
    } finally {
      ;[w.requestIdleCallback, w.cancelIdleCallback] = was
    }
  })
})

describe('Demo with the shared frame', () => {
  let root: Root
  let host: HTMLDivElement
  let cancelPreload = () => {}
  beforeEach(() => {
    host = document.body.appendChild(document.createElement('div'))
    root = createRoot(host)
    // Wanted (kept between demos), its idle-time making cancelled: the first lend makes it.
    cancelPreload = preloadDemo()
  })
  afterEach(() => {
    act(() => root.unmount())
    cancelPreload()
  })

  it("StrictMode's double mount leaves it lent, in the slot, and no frame of its own", () => {
    act(() => root.render(createElement(StrictMode, null, createElement(Demo, { scene: 'canvas-fit', width: 246 }))))
    const { pool } = poolState()
    expect(pool?.lent).toBe(true)
    expect(host.contains(pool!.frame)).toBe(true)
    expect(frames()).toBe(1)
    act(() => root.unmount())
    expect(pool?.lent).toBe(false)
    expect(pool?.frame.parentElement).toBe(poolState().holder)
    root = createRoot(host)
  })

  it('a slot moved into another container (a lesson going into a dialog) hands the frame over, no second frame', () => {
    const a = document.body.appendChild(document.createElement('div'))
    const b = document.body.appendChild(document.createElement('dialog'))
    let move: (to: Element) => void = () => {}
    function Host() {
      const [to, setTo] = useState<Element>(a)
      move = setTo
      return createPortal(createElement(Demo, { scene: 'canvas-fit', width: 246 }), to)
    }
    act(() => root.render(createElement(StrictMode, null, createElement(Host))))
    const { pool } = poolState()
    expect(a.contains(pool!.frame)).toBe(true)
    act(() => move(b))
    expect(b.contains(pool!.frame)).toBe(true)
    expect(pool?.lent).toBe(true)
    expect(frames()).toBe(1)
  })

  it('a second demo while the frame is lent gets a frame of its own', () => {
    act(() =>
      root.render(
        createElement('div', null, createElement(Demo, { key: 1, scene: 'canvas-fit', width: 246 }), createElement(Demo, { key: 2, scene: 'deck-drag', width: 246 })),
      ),
    )
    expect(frames()).toBe(2)
    expect(poolState().pool?.lent).toBe(true)
  })
})
