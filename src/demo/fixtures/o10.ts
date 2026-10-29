// What O10's scenes share (D-315, onboarding-lessons.md §3, planes and cards): keys held down while the cursor presses or
// drags (shift-click, alt-drag a box), a panel scrolled as a wheel would, a scene's own CSS (a part hidden), the card
// panel shut for a card, and a link drawn as the `›`'s drop would have made it. Kept apart from kit.ts (O9's).
import type { Edge } from '../../data/edges'
import { planeArea, useCanvasView } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import { find, key, run, type Action, type Ctx } from '../director'

// ——— keys held while the pointer works ———
// The director's pointer events carry no modifier keys; a held key is put on every pointer and mouse event made while
// it's down, as the browser does. Shown as its key chip for as long as it's held.
type Mods = { shiftKey?: boolean; altKey?: boolean; metaKey?: boolean }
let held: Mods = {}
const Real = { PointerEvent: window.PointerEvent, MouseEvent: window.MouseEvent }
class HeldPointer extends Real.PointerEvent {
  constructor(type: string, init?: PointerEventInit) {
    super(type, { ...init, ...held })
  }
}
class HeldMouse extends Real.MouseEvent {
  constructor(type: string, init?: MouseEventInit) {
    super(type, { ...init, ...held })
  }
}
function holding(mods: Mods) {
  held = mods
  const on = Object.values(mods).some(Boolean)
  ;(window as unknown as Record<string, unknown>).PointerEvent = on ? HeldPointer : Real.PointerEvent
  ;(window as unknown as Record<string, unknown>).MouseEvent = on ? HeldMouse : Real.MouseEvent
}
// Pressed (its chip shown for `chipMs`) and held until `letGoKeys()`.
export const hold = (which: '⇧' | '⌥', chipMs: number): Action => ({
  what: `hold ${which}`,
  ms: 0,
  start: (c) => {
    key(which, chipMs).start?.(c)
    holding(which === '⇧' ? { shiftKey: true } : { altKey: true })
  },
})
export const letGoKeys = (): Action => run(() => holding({}), 'keys up')

// ——— the stage ———

// CSS for this scene only (put in once; the tree is made again each loop, the style stays).
export const style = (scene: string, css: string): Action =>
  run(() => {
    const id = `demo-o10-${scene}`
    if (document.getElementById(id)) return
    const st = document.createElement('style')
    st.id = id
    st.textContent = css.replaceAll('&', `[data-scene="${scene}"]`)
    document.head.appendChild(st)
  }, 'scene css')

// The stage without the HUD, and every key let go (a loop that started over mid-hold).
export const stage = (scene: string, css = ''): Action[] => [style(scene, `& header { display: none !important; } ${css}`), letGoKeys()]

// A card's panel kept shut (as Enter leaves one just named, D-250): the plane stays in view.
export const shut = (id: string): Action => run(() => useCanvasView.setState({ panelShut: id }), `panel shut for ${id}`)

// ——— the panel ———

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
// What scrolls in the open card panel (its body), scrolled to show `selector` (or `#name`, a section) near its top
// (or by `px`), eased: as a wheel's flow would.
export const scrollPanel = (to: string | number, ms: number): Action => {
  let from = 0
  let dest = 0
  let body: HTMLElement | null = null
  return {
    what: `panel scrolls to ${to}`,
    ms,
    start: () => {
      const panel = find('[data-learn="card-panel"]')
      body = panel ? [...panel.querySelectorAll<HTMLElement>('*')].find((e) => e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== 'visible') ?? null : null
      if (!body) return console.error('[demo] scrollPanel: nothing scrolls')
      from = body.scrollTop
      if (typeof to === 'number') dest = from + to
      else {
        // `#name`: the section under that rule (`01 NAME ──`).
        const el = to.startsWith('#') ? [...body.querySelectorAll('section')].find((x) => x.querySelector('h3')?.textContent?.toLowerCase().includes(to.slice(1))) : body.querySelector(to)
        const scale = body.getBoundingClientRect().height / body.clientHeight || 1
        dest = el ? from + (el.getBoundingClientRect().top - body.getBoundingClientRect().top) / scale - 8 : from
      }
      dest = Math.max(0, Math.min(body.scrollHeight - body.clientHeight, dest))
    },
    frame: (_c, k) => {
      if (body) body.scrollTop = from + (dest - from) * (isReducedMotion() ? 1 : ease(k))
    },
  }
}

// ——— writes the demo refuses, shown as they'd land ———

// The link the `›`'s drop would have made, selected with its label ready (D-154), as the real drop does for a new one.
export const linkLands = (e: Edge, labelling = true): Action => ({
  what: `linked ${e.fromId} → ${e.toId}`,
  ms: 0,
  start: (c: Ctx) => {
    const ws = c.store.get()
    c.store.set({ ...ws, edges: [...ws.edges.filter((x) => x.id !== e.id), e] })
    c.store.tell()
    useCanvasView.setState({ linkSelected: e.id, linkLabelling: labelling, cardSelected: null, labelSelected: null })
  },
})

// A row of the open menu (the prompt, D-222) whose text holds `words`, at its left part (where a person points).
export const row = (words: string) =>
  Object.assign(
    () => {
      const el = [...document.querySelectorAll('[role="menu"] [role^="menuitem"], [role="listbox"] [role="option"]')].filter((e) => (e.textContent ?? '').includes(words)).at(-1)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.left + Math.min(r.width * 0.3, 90), y: r.top + r.height / 2 }
    },
    { selector: undefined as string | undefined },
  )

// The focused piece's own view put at once: plane px 0 at (ox, oy) on the stage, at `zoom`. Where a panel will open,
// the cards kept clear of it (a card it would cover glides left, CardPanel).
export const view = (zoom: number, ox: number, oy: number): Action => run(() => useCanvasView.setState({ planeCam: { zoom, ox, oy } }), 'focus view')

// As kit's frameTo (the focused piece's view gliding, eased both ends, to frame part of it), allowed closer than 1.25:
// one card's face read in a small slot.
export const closeIn = (b: { x: number; y: number; w: number; h: number }, ms: number, pad = 16, max = 2.5): Action => {
  let from = { zoom: 1, ox: 0, oy: 0 }
  let to = from
  return {
    what: 'focus view closes in',
    ms,
    start: () => {
      from = useCanvasView.getState().planeCam ?? from
      const a = planeArea()
      const zoom = Math.min(max, (a.w - 2 * pad) / b.w, (a.h - 2 * pad) / b.h)
      to = { zoom, ox: a.w / 2 - (b.x + b.w / 2) * zoom, oy: a.h / 2 - (b.y + b.h / 2) * zoom }
    },
    frame: (_c, k) => {
      const e = isReducedMotion() ? 1 : ease(k)
      useCanvasView.setState({ planeCam: { zoom: from.zoom + (to.zoom - from.zoom) * e, ox: from.ox + (to.ox - from.ox) * e, oy: from.oy + (to.oy - from.oy) * e } })
    },
  }
}

// The button in the open card panel's section `name` whose text holds `words`: a row to point at.
export const inSection = (name: string, words: string) => () => {
  const sec = [...document.querySelectorAll('[data-learn="card-panel"] section')].find((x) => x.querySelector('h3')?.textContent?.toLowerCase().includes(name))
  const el = sec && [...sec.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(words))
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + Math.min(r.width * 0.4, 60), y: r.top + r.height / 2 }
}
