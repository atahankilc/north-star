// @vitest-environment happy-dom
// A list that grows at its foot (D-361, src/ui/foundation/useStickToBottom.ts): the agent's chat, a thread. Kept at the
// bottom as things come in; scrolled up to read, a new one leaves it where it is; scrolled back down, sent, or another
// list shown, it follows again.
import { afterEach, describe, expect, it } from 'vitest'
import { act, createElement as h, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useStickToBottom } from '../../src/ui/foundation/useStickToBottom'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// The list's size: `n` rows of 20 px in a box 100 px tall (happy-dom lays nothing out).
let n = 0
let el: HTMLElement | null = null
let toBottom = () => {}
function List({ rows, reset }: { rows: number; reset: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const stick = useStickToBottom(ref, [rows], reset)
  toBottom = stick.toBottom
  return h('div', {
    id: 'list',
    ref: (node: HTMLDivElement | null) => {
      ref.current = node
      if (node && node !== el) {
        el = node
        Object.defineProperty(node, 'scrollHeight', { get: () => n * 20, configurable: true })
        Object.defineProperty(node, 'clientHeight', { get: () => 100, configurable: true })
      }
    },
    onScroll: stick.onScroll,
  })
}

let root: Root | null = null
function draw(rows: number, reset = 'a') {
  n = rows
  if (!root) {
    const host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  }
  act(() => root!.render(h(List, { rows, reset })))
}
const scrollTo = (top: number) => act(() => {
  el!.scrollTop = top
  el!.dispatchEvent(new Event('scroll', { bubbles: true }))
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  el = null
  document.body.innerHTML = ''
})

describe('useStickToBottom', () => {
  it('stays at the bottom as rows come in', () => {
    draw(10)
    expect(el!.scrollTop).toBe(200)
    draw(12)
    expect(el!.scrollTop).toBe(240)
  })

  it('scrolled up to read, a new row leaves it there; back at the bottom, it follows again', () => {
    draw(10)
    scrollTo(50)
    draw(11)
    expect(el!.scrollTop).toBe(50)
    scrollTo(120)
    draw(12)
    expect(el!.scrollTop).toBe(240)
  })

  it('sending takes it back down', () => {
    draw(10)
    scrollTo(0)
    act(() => toBottom())
    draw(11)
    expect(el!.scrollTop).toBe(220)
  })

  it('another list opens at its bottom', () => {
    draw(10)
    scrollTo(0)
    draw(10, 'b')
    expect(el!.scrollTop).toBe(200)
  })
})
