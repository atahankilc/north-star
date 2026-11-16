// @vitest-environment happy-dom
// The one Escape stack (D-359, src/ui/foundation/useEscapeLayer.ts): what opened last hears Escape first and nothing
// under it does; a layer turned on again goes on top; a field keeps its Escape unless the layer takes fields; someone
// else's menu keeps its Escape; the coach's never reaches a layer.
import { afterEach, describe, expect, it } from 'vitest'
import { createElement as h, useRef, type RefObject } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { useEscapeLayer } from '../../src/ui/foundation/useEscapeLayer'
import { holdKeys } from '../../src/ui/foundation/focus'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type L = { name: string; on?: boolean; fields?: boolean; first?: boolean; bare?: boolean }
const heard: string[] = []

// `bare`: a layer with no root (a console's drawer).
function Layer({ name, on = true, fields = false, first = false, bare = false }: L) {
  const root = useRef<HTMLDivElement>(null)
  useEscapeLayer(() => heard.push(name), { on, fields, first, root: bare ? undefined : (root as RefObject<HTMLElement | null>) })
  return h('div', { ref: root, id: name }, h('input', { id: `${name}-field` }), h('button', { id: `${name}-btn` }))
}

let root: Root | null = null
let host: HTMLElement
function draw(layers: L[]) {
  if (!root) {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  }
  act(() => root!.render(h('div', null, ...layers.map((l) => h(Layer, { key: l.name, ...l })))))
}
const esc = (on: Element | null = document.body) => {
  const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  on!.dispatchEvent(e)
  return e
}

afterEach(() => {
  act(() => root?.unmount())
  root = null
  host?.remove()
  document.body.innerHTML = ''
  heard.length = 0
})

describe('useEscapeLayer', () => {
  it('only the newest layer hears it', () => {
    draw([{ name: 'panel' }, { name: 'menu' }])
    const e = esc()
    expect(heard).toEqual(['menu'])
    expect(e.defaultPrevented).toBe(true)
  })

  it('a layer turned on again goes on top', () => {
    draw([{ name: 'list', on: false }, { name: 'thread' }])
    esc()
    draw([{ name: 'list', on: true }, { name: 'thread' }])
    esc()
    expect(heard).toEqual(['thread', 'list'])
  })

  it('nothing heard with no layer on', () => {
    draw([{ name: 'list', on: false }])
    const e = esc()
    expect(heard).toEqual([])
    expect(e.defaultPrevented).toBe(false)
  })

  it('a field keeps its Escape, unless the layer takes fields', () => {
    draw([{ name: 'panel' }])
    esc(document.getElementById('panel-field'))
    expect(heard).toEqual([])
    esc(document.getElementById('panel-btn'))
    expect(heard).toEqual(['panel'])
    draw([{ name: 'panel' }, { name: 'window', fields: true }])
    esc(document.getElementById('window-field'))
    expect(heard).toEqual(['panel', 'window'])
  })

  it("someone else's menu keeps its Escape; the coach's never reaches a layer", () => {
    draw([{ name: 'panel' }])
    const menu = document.createElement('div')
    menu.setAttribute('role', 'menu')
    const item = document.createElement('button')
    menu.appendChild(item)
    document.body.appendChild(menu)
    esc(item)
    const coach = document.createElement('div')
    coach.setAttribute('data-coach', '')
    document.body.appendChild(coach)
    esc(coach)
    expect(heard).toEqual([])
  })

  it('a key already taken is left alone', () => {
    draw([{ name: 'panel' }])
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    e.preventDefault()
    document.body.dispatchEvent(e)
    expect(heard).toEqual([])
  })

  it('a drawer (no root) closes from inside the docked panel that holds it, after what opened later', () => {
    draw([{ name: 'drawer', bare: true }])
    const dock = document.createElement('div')
    dock.setAttribute('role', 'dialog')
    const btn = document.createElement('button')
    dock.appendChild(btn)
    document.body.appendChild(dock)
    esc(btn)
    expect(heard).toEqual(['drawer'])
    // A modal window is someone else's.
    dock.setAttribute('aria-modal', 'true')
    esc(btn)
    expect(heard).toEqual(['drawer'])
    // What opened after the drawer closes first.
    draw([{ name: 'drawer', bare: true }, { name: 'panel' }])
    esc()
    expect(heard).toEqual(['drawer', 'panel'])
  })

  it('a first layer hears it before the others, in a field too', () => {
    draw([{ name: 'following', first: true }, { name: 'panel' }])
    esc(document.getElementById('panel-field'))
    expect(heard).toEqual(['following'])
    draw([{ name: 'following', first: true, on: false }, { name: 'panel' }])
    esc()
    expect(heard).toEqual(['following', 'panel'])
  })
  it('waits while something holds the keys (a box being drawn, D-394)', () => {
    draw([{ name: 'a' }])
    const free = holdKeys()
    esc()
    expect(heard).toEqual([])
    free()
    esc()
    expect(heard).toEqual(['a'])
  })
})
