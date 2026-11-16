// @vitest-environment happy-dom
// A box drawn from a press (D-394, src/ui/foundation/dragPointer.ts' boxDrag): what a plane's and a deck's alt+drag
// share. Let go, the box is given; Escape or a cancel drops it; a press that doesn't move gives none; while it's drawn
// the keys are its own (keysTaken says so), and the Escape stack waits.
import { describe, expect, it } from 'vitest'
import { boxDrag, type DragBox } from '../../src/ui/foundation/dragPointer'
import { keysHeld, keysTaken } from '../../src/ui/foundation/focus'

const at = (ev: { clientX: number; clientY: number }) => [ev.clientX, ev.clientY] as const
const fire = (type: string, x = 0, y = 0) => window.dispatchEvent(Object.assign(new Event(type), { clientX: x, clientY: y }))
const key = (k: string) => {
  const e = new KeyboardEvent('keydown', { key: k, cancelable: true })
  window.dispatchEvent(e)
  return e
}
function start() {
  const drawn: (DragBox | null)[] = []
  const done: unknown[] = []
  boxDrag({ clientX: 10, clientY: 10 }, at, (b) => drawn.push(b), (b) => done.push(b))
  return { drawn, done }
}

describe('boxDrag', () => {
  it('let go: the box, its corners in order, and nothing drawn after', () => {
    const { drawn, done } = start()
    fire('pointermove', 4, 30)
    fire('pointerup', 4, 30)
    expect(done).toEqual([{ l: 4, t: 10, r: 10, b: 30 }])
    expect(drawn.at(-1)).toBeNull()
    expect(keysHeld()).toBe(false)
  })
  it('a press that does not move is a click: no box', () => {
    const { done } = start()
    fire('pointerup', 10, 10)
    expect(done).toEqual([])
  })
  it('Escape drops it, goes no further, and the release selects nothing', () => {
    const { drawn, done } = start()
    fire('pointermove', 80, 80)
    let later = 0
    const after = () => later++
    window.addEventListener('keydown', after, true)
    expect(keysTaken(document.body)).toBe(true)
    const e = key('Escape')
    window.removeEventListener('keydown', after, true)
    expect(e.defaultPrevented).toBe(true)
    expect(later).toBe(0)
    expect(drawn.at(-1)).toBeNull()
    fire('pointermove', 200, 200)
    expect(drawn.at(-1)).toBeNull()
    fire('pointerup', 200, 200)
    expect(done).toEqual([])
    expect(keysHeld()).toBe(false)
  })
  it('a cancel selects nothing', () => {
    const { done } = start()
    fire('pointermove', 80, 80)
    fire('pointercancel', 80, 80)
    expect(done).toEqual([])
    expect(keysTaken(document.body)).toBe(false)
  })
})
