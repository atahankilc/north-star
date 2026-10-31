// Helpers for the gallery's docks, menus, setups and wizards (D-324, G3): a right-click and a click where an element is,
// as the demo's kit does (src/demo/fixtures/kit.ts' rightClick), and a button found by its words.
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// The first element matching `sel` (whose text starts with `words`, if given), waited for up to `ms`.
export async function find(sel: string, words?: string, ms = 2000): Promise<HTMLElement | null> {
  const t = performance.now()
  for (;;) {
    const el = [...document.querySelectorAll<HTMLElement>(sel)].find((e) => !words || (e.textContent ?? '').trim().replace(/^\[|\]$/g, '').trim().startsWith(words))
    if (el || performance.now() - t > ms) return el ?? null
    await wait(40)
  }
}

const centre = (el: Element, ax = 0.5, ay = 0.5) => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width * ax, y: r.top + r.height * ay }
}

// A right-click at (ax, ay) of the element: the browser's events in order, on what's under that point.
export async function rightClick(sel: string, ax = 0.5, ay = 0.5) {
  const el = await find(sel)
  if (!el) return console.warn(`[gallery] right-click: nothing matches ${sel}`)
  const p = centre(el, ax, ay)
  const at = document.elementFromPoint(p.x, p.y) ?? el
  const init = { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, button: 2, buttons: 2, view: window }
  at.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true }))
  at.dispatchEvent(new MouseEvent('mousedown', init))
  at.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true }))
  at.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }))
  at.dispatchEvent(new MouseEvent('contextmenu', { ...init, buttons: 0 }))
}

// A left click on the element (its own click, as a person's lands).
export async function press(sel: string, words?: string) {
  const el = await find(sel, words)
  if (!el) return console.warn(`[gallery] press: nothing matches ${sel}${words ? ` "${words}"` : ''}`)
  const p = centre(el)
  const init = { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, button: 0, view: window }
  el.dispatchEvent(new PointerEvent('pointerdown', { ...init, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true }))
  el.dispatchEvent(new MouseEvent('mousedown', { ...init, buttons: 1 }))
  el.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true }))
  el.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }))
  el.click()
}

// A drag from one point of the element to another (fractions of its box), in steps: a box drawn, a section drawn.
export async function drag(sel: string, from: [number, number], to: [number, number], hold = false) {
  const el = await find(sel)
  if (!el) return console.warn(`[gallery] drag: nothing matches ${sel}`)
  const a = centre(el, ...from)
  const b = centre(el, ...to)
  const at = document.elementFromPoint(a.x, a.y) ?? el
  // A made-up pointer can't be captured (the browser throws for an id it never saw): while this drag runs, a capture of
  // it does nothing, and the handlers go on as for a person's.
  const capture = Element.prototype.setPointerCapture
  Element.prototype.setPointerCapture = function (id: number) {
    try {
      capture.call(this, id)
    } catch {
      // not a real pointer
    }
  }
  const ev = (type: string, x: number, y: number, buttons: number) =>
    new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons, pointerId: 1, pointerType: 'mouse', isPrimary: true, view: window })
  at.dispatchEvent(ev('pointerdown', a.x, a.y, 1))
  for (let i = 1; i <= 12; i++) {
    const x = a.x + ((b.x - a.x) * i) / 12
    const y = a.y + ((b.y - a.y) * i) / 12
    ;(document.elementFromPoint(x, y) ?? at).dispatchEvent(ev('pointermove', x, y, 1))
    window.dispatchEvent(ev('pointermove', x, y, 1))
    await wait(16)
  }
  if (!hold) {
    at.dispatchEvent(ev('pointerup', b.x, b.y, 0))
    window.dispatchEvent(ev('pointerup', b.x, b.y, 0))
  }
  Element.prototype.setPointerCapture = capture
}

export { wait }
