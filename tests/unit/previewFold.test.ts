// @vitest-environment happy-dom
// agent-bugs 7: on the canvas a plane is only its fitted picture, so the preview's marks for what's inside it fold into
// one mark on the plane (nothing drawn outside it); in the plane's focus, or beside it, every mark is drawn as before.
// Other pieces (decks, tables) draw their real contents on the canvas and keep their own marks.
import { afterEach, describe, expect, it } from 'vitest'
import { folded, pictureOf, stepperMarks, type Drawn } from '../../src/agent/ui/PreviewMarks'
import type { Target } from '../../src/agent/preview'

function canvas() {
  document.body.innerHTML = `
    <div data-target="plane:p1" data-kind="plane"><div data-target="card:c1"></div><div data-target="card:c2"></div></div>
    <div data-target="plane:k1" data-kind="kanban"><div data-task="t1"></div></div>`
  const q = (s: string) => document.querySelector(s)!
  return { plane: q('[data-target="plane:p1"]'), c1: q('[data-target="card:c1"]'), c2: q('[data-target="card:c2"]'), task: q('[data-task="t1"]'), deck: q('[data-target="plane:k1"]') }
}

const at = (search: string) => history.replaceState(null, '', `/workspaces/w${search}`)
const mark = (key: string, change: Target['change'], tag: string, item?: string): Drawn => {
  const t: Target = { key, id: key, change, sel: '', tier: 'm', tag, was: [], ...(item ? { item } : {}) }
  return { key, t, r: { x: 0, y: 0, w: 10, h: 10 }, was: [], tag }
}

afterEach(() => at(''))

describe('a plane only as a picture folds its marks (bug 7)', () => {
  it('a card in a plane on the canvas: in its picture; the plane itself and a deck\'s task: not', () => {
    const d = canvas()
    at('')
    expect(pictureOf(d.c1)).toBe(d.plane)
    expect(pictureOf(d.plane)).toBeNull()
    expect(pictureOf(d.task)).toBeNull()
  })

  it('in the plane\'s focus or beside it, every mark is its own', () => {
    const d = canvas()
    at('?focus=p1')
    expect(pictureOf(d.c1)).toBeNull()
    at('?focus=p9&beside=x,p1')
    expect(pictureOf(d.c1)).toBeNull()
  })

  it('one mark: how many changes, by sign, each change\'s words on hover; the stepper\'s item lights it', () => {
    const d = canvas()
    const f = folded(d.plane, [mark('a', 'added', '+ new problem', 'i1'), mark('b', 'added', '+ new customer', 'i2'), mark('c', 'removed', '− deleted', 'i3'), mark('c2', 'removed', '− deleted', 'i3')])
    expect(f.tag).toBe('3 changes inside +2 −1')
    expect(f.t.change).toBe('changed')
    expect(f.inside).toEqual(['i1', 'i2', 'i3'])
    expect(f.was).toEqual(['+ new problem', '+ new customer', '− deleted'])
    // The same target while its words stay (the layer redraws only on a change).
    expect(folded(d.plane, [mark('a', 'added', '+ new problem', 'i1'), mark('b', 'added', '+ new customer', 'i2'), mark('c', 'removed', '− deleted', 'i3')]).t).toBe(f.t)
    expect(folded(d.plane, [mark('a', 'added', '+ new problem', 'i1')]).t.tag).toBe('1 change inside +1')
  })
})

describe('the stepper\'s item stands out (bug 3)', () => {
  const marks = [mark('a', 'added', '+', 'i1'), mark('b', 'changed', '~', 'i2'), mark('c', 'removed', '−', 'i3')]
  it('the rest go quiet while it is on an item with a mark', () => {
    const { isLit, quiet } = stepperMarks(marks, 'i2')
    expect(marks.map(isLit)).toEqual([false, true, false])
    expect(marks.map(quiet)).toEqual([true, undefined, true])
  })
  it('a folded plane holding the item is lit', () => {
    const d = canvas()
    const f = folded(d.plane, [mark('x', 'added', '+', 'i7')])
    expect(stepperMarks([...marks, f], 'i7').isLit(f)).toBe(true)
  })
  it('no item, or an item with no mark here: nothing quiet', () => {
    expect(marks.map(stepperMarks(marks, null).quiet)).toEqual([undefined, undefined, undefined])
    expect(marks.map(stepperMarks(marks, 'i9').quiet)).toEqual([undefined, undefined, undefined])
  })
})
