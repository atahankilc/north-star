// @vitest-environment happy-dom
// A list picked from inside a typing field (D-361, src/ui/foundation/usePromptPick.ts): the agent's `/` and a thread's
// `@`. ↑ ↓ move round the ends, Enter or Tab picks, never Enter while an IME composes or with shift, Escape closes the
// list only; the pick goes back to the first row when `reset` changes; closed, no key is the list's.
import { afterEach, describe, expect, it } from 'vitest'
import { act, createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { usePromptPick } from '../../src/ui/foundation/usePromptPick'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const LIST = ['ada', 'bo', 'cy']
const log: string[] = []
let at = -1

function Field({ open, reset }: { open: boolean; reset: unknown }) {
  const p = usePromptPick(LIST, open, { pick: (x) => log.push(`pick ${x}`), close: () => log.push('close'), reset })
  at = p.at
  return h('input', { id: 'f', onKeyDown: (e: React.KeyboardEvent) => void (p.onKey(e) || log.push(`field ${e.key}`)) })
}

let root: Root | null = null
function draw(open = true, reset: unknown = 'q') {
  if (!root) {
    const host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  }
  act(() => root!.render(h(Field, { open, reset })))
}
const key = (k: string, o: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o })
  act(() => void document.getElementById('f')!.dispatchEvent(e))
  return e
}

afterEach(() => {
  act(() => root?.unmount())
  root = null
  document.body.innerHTML = ''
  log.length = 0
})

describe('usePromptPick', () => {
  it('moves round the ends and picks with Enter or Tab', () => {
    draw()
    key('ArrowUp')
    expect(at).toBe(2)
    key('ArrowDown')
    expect(at).toBe(0)
    key('ArrowDown')
    key('Enter')
    key('Tab')
    expect(log).toEqual(['pick bo', 'pick bo'])
  })

  it('leaves Enter to the field while composing or with shift', () => {
    draw()
    key('Enter', { isComposing: true })
    key('Enter', { shiftKey: true })
    expect(log).toEqual(['field Enter', 'field Enter'])
  })

  it('Escape closes the list only', () => {
    draw()
    const e = key('Escape')
    expect(log).toEqual(['close'])
    expect(e.defaultPrevented).toBe(true)
  })

  it('goes back to the first row when what is typed changes', () => {
    draw(true, 'a')
    key('ArrowDown')
    expect(at).toBe(1)
    draw(true, 'ad')
    expect(at).toBe(0)
  })

  it('closed, every key is the field’s', () => {
    draw(false)
    key('ArrowDown')
    key('Enter')
    expect(log).toEqual(['field ArrowDown', 'field Enter'])
  })
})
