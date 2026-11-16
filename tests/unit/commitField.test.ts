// @vitest-environment happy-dom
// A value typed over where it's shown (src/ui/primitives/CommitField.tsx, D-392): one behaviour for a deck column's
// name and limit, a checklist's step and a document's title in its row, which each had their own: Enter or leaving
// keeps what changed, Escape puts it back, an empty name is put back, and `onEnd` is heard once whichever way it ends.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { CommitField } from '../../src/ui/primitives/CommitField'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let host: HTMLElement
function draw(props: Partial<Parameters<typeof CommitField>[0]> = {}) {
  const onSave = vi.fn()
  const onEnd = vi.fn()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root!.render(h(CommitField, { line: true, value: 'to do', label: 'Name', onSave, onEnd, ...props })))
  const field = host.querySelector('input, textarea') as HTMLInputElement
  act(() => field.focus())
  return { field, onSave, onEnd }
}
// Typed as a person types: the input's own value, then the event React listens for.
function type(field: HTMLInputElement, text: string) {
  const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')!.set!
  act(() => {
    set.call(field, text)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const key = (field: HTMLElement, k: string) => act(() => void field.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })))
const frame = () => act(() => new Promise<void>((r) => requestAnimationFrame(() => r())))

afterEach(() => {
  act(() => root?.unmount())
  root = null
  document.body.innerHTML = ''
})

describe('CommitField, one line', () => {
  it('is an input', () => expect(draw().field.tagName).toBe('INPUT'))

  it('Enter keeps what changed and ends it once', () => {
    const { field, onSave, onEnd } = draw()
    type(field, 'backlog')
    key(field, 'Enter')
    expect(onSave.mock.calls).toEqual([['backlog']])
    expect(onEnd).toHaveBeenCalledTimes(1)
    // Taken away while it had the keyboard, it can blur again: still once.
    act(() => void field.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('leaving unchanged saves nothing but still ends', () => {
    const { field, onSave, onEnd } = draw()
    act(() => field.blur())
    expect(onSave).not.toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('Escape puts it back: nothing saved, ended', async () => {
    const { field, onSave, onEnd } = draw()
    type(field, 'nope')
    key(field, 'Escape')
    await frame()
    expect(onSave).not.toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(field.value).toBe('to do')
  })

  it('an empty name is put back when asked (`empty: undo`), saved otherwise', () => {
    const a = draw({ empty: 'undo' })
    type(a.field, '   ')
    key(a.field, 'Enter')
    expect(a.onSave).not.toHaveBeenCalled()
    expect(a.onEnd).toHaveBeenCalledTimes(1)
    act(() => root?.unmount())
    const b = draw()
    type(b.field, '')
    key(b.field, 'Enter')
    expect(b.onSave.mock.calls).toEqual([['']])
  })

  it('`clean` holds what may be typed (a limit: digits)', () => {
    const { field, onSave } = draw({ value: '', clean: (v) => v.replace(/\D/g, '').slice(0, 2) })
    type(field, '7x9z1')
    expect(field.value).toBe('79')
    key(field, 'Enter')
    expect(onSave.mock.calls).toEqual([['79']])
  })

  it('still a textarea as tall as its text without `line`', () => {
    const { field, onSave } = draw({ line: false })
    expect(field.tagName).toBe('TEXTAREA')
    type(field, 'a title')
    key(field, 'Enter')
    expect(onSave.mock.calls).toEqual([['a title']])
  })
})
