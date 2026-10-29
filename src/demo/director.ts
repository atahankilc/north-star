// The director (D-315, docs/specs/onboarding.md §6.2): plays a scene on the stage. A scene is a fixture, the part of the
// app it mounts (`view`), a length and its steps; a step does one thing at its moment (`at`, ms; or straight after the
// step before). The cursor sends **real** pointer, mouse, wheel and key events to the real elements under it, so the
// real menus open, the real camera glides, the real drags show their own marks; only what would be written (the demo
// writes nothing) is shown with `set()`, at the moment it would land.
//
// Time is the clock's (clock.ts): while playing it follows the browser's frames; `seek(t)` starts the scene again and
// steps it to t in fixed frames as fast as it can, so the same t draws the same picture (headless shots, the poster).
// At the end it holds 1 s, breaks the stage cell by cell and builds the first frame back (the app's one motion, D-034);
// under reduced motion it shows the poster, still.
import type { Store } from '../state/wsStore'
import type { WorkspaceCtx } from '../state/wsStore'
import { camOf, planeArea, setCam, useCanvasView, type Bounds } from '../state/canvasView'
import { isReducedMotion } from '../state/motion'
import { runCells } from '../ui/Appear'
import { finishAnimations, releaseAnimations, restart, step as stepClock, stepAnimations, yieldTask, realClock } from './clock'

export type Pt = { x: number; y: number }
// Where the cursor goes: a CSS selector (the element's middle, or `aim()`'s point in it), a stage point, or a function
// of the moment (read when the move starts).
export type Target = string | Pt | ((c: Ctx) => Pt | null)

export type Ctx = {
  store: Store
  wid: string
  root: HTMLElement
  navigate: (to: string) => void
  // The stage's size (its own CSS px, as the scene is authored), and how much it's scaled to fit the frame: a point on
  // the stage is `scale` times as far on the page (client px).
  size: { w: number; h: number }
  scale: number
}

// One step's work over `ms` (0: at once): started once, drawn every frame with its progress, ended once.
export type Action = {
  what: string
  ms: number
  start?: (c: Ctx) => void
  frame?: (c: Ctx, k: number) => void
  end?: (c: Ctx) => void
}
export type Step = { at?: number; do: Action }

export type ViewName = 'canvas' | 'focus'
export type Scene = {
  id: string
  fixture: Omit<WorkspaceCtx, 'canvas'>
  view: ViewName
  // The address the stage's router starts at (`?focus=<id>` for a piece in focus).
  route?: string
  // Authored at this size, 16:10, and scaled into the frame (960 × 600) and from there into the coach's slot
  // (onboarding.md §6.2): 960 × 600 mostly, larger when the part shown needs the room (the whole `+` menu).
  size: [number, number]
  // When the last step is done (ms, ≤ 8000); the hold and the rebuild come after.
  length: number
  // The telling moment, shown still under reduced motion and as the poster.
  poster: number
  // Where the cursor rests before the first step.
  cursor: Target
  // Done to the fresh stage before it settles (a camera put somewhere, a piece's view framed): part of the first frame,
  // not a step.
  setup?: Action[]
  steps: Step[]
}

export const HOLD_MS = 1000
const BREAK_MS = 420
const BUILD_MS = 420
const FRAME = 1000 / 60
// How long a fresh stage is run before its first frame (its entrances are 320–400 ms).
const SETTLE_FRAMES = 40

// ——— the pointer: real events at the fake cursor ———

const cursor = { x: 0, y: 0, down: false, shown: false, over: null as Element | null, downOn: null as Element | null, meant: null as { what: string; el: Element } | null }
// Each press: what the step meant to press and whether that's what was under the cursor (the scenes check reads it).
export type Press = { at: number; meant: string; ok: boolean; got: string; lit: boolean }
let presses: Press[] = []
const describe = (el: Element) => `${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : ''}${el.getAttribute('data-key') ? `[data-key="${el.getAttribute('data-key')}"]` : ''}${(el as HTMLElement).dataset?.task ? `[data-task="${(el as HTMLElement).dataset.task}"]` : ''} "${(el.textContent ?? '').trim().slice(0, 30)}"`
let capture: Element | null = null

// A pointer capture on a made-up pointer would throw (no such pointer); here it routes the moves to the element, as a
// real capture does.
Element.prototype.setPointerCapture = function (this: Element) {
  capture = this
}
Element.prototype.releasePointerCapture = function (this: Element) {
  if (capture === this) capture = null
}
Element.prototype.hasPointerCapture = function (this: Element) {
  return capture === this
}

// What the last input was (`html[data-demo-input]`): a press or a drag is a pointer's, a key a keyboard's. After a real
// click Chrome doesn't show the focus ring on what a script focuses next (a menu giving the focus back to its trigger);
// after made-up events it would. The focus stays where the app puts it (later keys need it there: a confirm's cancel, a
// menu's first row), and the demo's CSS doesn't draw `:focus-visible` while the pointer was last (demoCss.ts).
const input = (how: 'pointer' | 'key') => void (document.documentElement.dataset.demoInput = how)

// Where keys go. In the coach the demo's frame is `inert` and never has the focus, so the browser ignores the app's own
// `.focus()` calls in it (the finder's field, a thread's) and `document.activeElement` stays <body>: keys sent there would
// miss the field and hit the canvas's shortcuts (`t` the side view, `g` snapping). So what the app last asked to focus
// is kept here, and keys go to it while it's still on the page, as they would if the frame had the focus.
let wanted: HTMLElement | null = null
// Shown in the frame (the coach's), the focus is never really taken: Chrome lets a script in an `inert` frame focus
// its fields all the same, and the focus would leave the coach (its ← → would stop). The field is marked instead, and
// the demo's CSS draws `:focus` / `:focus-within` for the marks too (demoCss.ts).
const embedded = window.parent !== window
const realFocus = HTMLElement.prototype.focus
const realBlur = HTMLElement.prototype.blur
function mark(el: HTMLElement | null) {
  // Only in the frame: on its own the real focus is taken and the browser's states are right.
  if (!embedded) return
  document.querySelectorAll('[data-demo-focus]').forEach((e) => e.removeAttribute('data-demo-focus'))
  document.querySelectorAll('[data-demo-focus-within]').forEach((e) => e.removeAttribute('data-demo-focus-within'))
  if (!el) return
  el.setAttribute('data-demo-focus', '')
  for (let e: HTMLElement | null = el; e; e = e.parentElement) e.setAttribute('data-demo-focus-within', '')
}
HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
  wanted = this
  mark(this)
  if (!embedded) realFocus.call(this, options)
}
// A field's select() focuses it too: the same, its text selected without the focus.
for (const proto of [HTMLInputElement.prototype, HTMLTextAreaElement.prototype]) {
  const realSelect = proto.select
  proto.select = function (this: HTMLInputElement | HTMLTextAreaElement) {
    wanted = this
    mark(this)
    if (!embedded) return realSelect.call(this)
    try {
      this.setSelectionRange(0, this.value.length)
    } catch {
      // Not a text field (a checkbox): nothing to select.
    }
  }
}
HTMLElement.prototype.blur = function (this: HTMLElement) {
  const held = wanted === this
  if (held) {
    wanted = null
    mark(null)
  }
  // In the frame it never had the real focus, so the browser sends no blur: the one the app waits for (a field's
  // onBlur keeps what was typed: a cell's number, a name) is sent here, as leaving the field would.
  if (embedded && held) {
    this.dispatchEvent(new FocusEvent('blur', { relatedTarget: null }))
    this.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }))
    return
  }
  realBlur.call(this)
}
const keyTarget = (): Element => {
  if (wanted?.isConnected) return wanted
  if (wanted) mark((wanted = null))
  return document.activeElement ?? document.body
}

// `:hover` for made-up events (the browser never sets it): `data-demo-hover` on what's under the cursor and every element
// round it, which the demo's CSS reads as `:hover` (demoCss.ts). Kept up every frame, as the browser's follows what moves
// under a still pointer.
let lit: Element[] = []
function hover(el: Element | null) {
  const chain: Element[] = []
  for (let e = el; e && e !== document.documentElement; e = e.parentElement) chain.push(e)
  if (chain.length === lit.length && chain[0] === lit[0]) return
  const keep = new Set(chain)
  for (const e of lit) if (!keep.has(e)) e.removeAttribute('data-demo-hover')
  for (const e of chain) if (!e.hasAttribute('data-demo-hover')) e.setAttribute('data-demo-hover', '')
  lit = chain
}

// What's under a point: the page's own hit test (the cursor itself takes no clicks).
function hit(x: number, y: number): Element {
  return document.elementFromPoint(x, y) ?? document.body
}

const MOUSE: Record<string, string> = { pointerdown: 'mousedown', pointermove: 'mousemove', pointerup: 'mouseup', pointerover: 'mouseover', pointerout: 'mouseout' }

function send(type: string, el: Element, extra: Partial<PointerEventInit> = {}) {
  const init: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: cursor.x,
    clientY: cursor.y,
    screenX: cursor.x,
    screenY: cursor.y,
    button: type === 'pointermove' || type === 'pointerover' || type === 'pointerout' ? -1 : 0,
    buttons: cursor.down ? 1 : 0,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    width: 1,
    height: 1,
    pressure: cursor.down ? 0.5 : 0,
    view: window,
    ...extra,
  }
  const go = el.dispatchEvent(new PointerEvent(type, init))
  const mouse = MOUSE[type]
  if (mouse && go) el.dispatchEvent(new MouseEvent(mouse, { ...init, button: Math.max(0, init.button ?? 0) }))
}

// The cursor moved: over/out as it crosses elements, then the move (to what has it captured, else what's under it).
function moved() {
  const el = hit(cursor.x, cursor.y)
  if (el !== cursor.over) {
    if (cursor.over && cursor.over.isConnected) send('pointerout', cursor.over, { relatedTarget: el })
    send('pointerover', el, { relatedTarget: cursor.over })
    cursor.over = el
  }
  send('pointermove', capture?.isConnected ? capture : el)
}

function pressDown() {
  input('pointer')
  const el = hit(cursor.x, cursor.y)
  if (cursor.meant) {
    const m = cursor.meant
    presses.push({ at: Math.round(sceneT), meant: m.what, ok: m.el.isConnected && (m.el === el || m.el.contains(el)), got: describe(el), lit: el.hasAttribute('data-demo-hover') })
    cursor.meant = null
  }
  cursor.down = true
  cursor.downOn = el
  send('pointerdown', el)
  // A press on a field puts the caret in it, as a real one does; anything else lets go of the focus. (Buttons aren't
  // focused: a real click doesn't show their focus ring, a script's focus() would.)
  const field = el.closest<HTMLElement>('input, textarea, [contenteditable="true"]')
  if (field) field.focus({ preventScroll: true })
  else {
    // The field the keys went to (in the frame, the one only marked focused) is left too: its blur keeps what it holds.
    if (wanted?.isConnected && wanted !== document.activeElement && !wanted.contains(el)) wanted.blur()
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    wanted = null
    mark(null)
  }
}

function pressUp(click: boolean) {
  const el = capture?.isConnected ? capture : hit(cursor.x, cursor.y)
  cursor.down = false
  send('pointerup', el)
  capture = null
  const from = cursor.downOn
  cursor.downOn = null
  if (!click || !from) return
  // The click goes to what both the press and the release were in.
  let common: Element | null = el
  while (common && !common.contains(from)) common = common.parentElement
  if (common) common.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: cursor.x, clientY: cursor.y, button: 0, detail: 1, view: window }))
}

// ——— where things are ———

// The element a selector means: the last one drawn (a plane in focus draws its cards twice, the canvas's picture under
// the focus's live ones).
export function find(selector: string): Element | null {
  const all = document.querySelectorAll(selector)
  return all.length ? all[all.length - 1] : null
}

// The element a target means, when it names one (a selector, or aim()'s): what a press there should land on.
function meantBy(t: Target): Element | null {
  const sel = typeof t === 'string' ? t : typeof t === 'function' ? (t as { selector?: string }).selector : undefined
  return sel ? find(sel) : null
}

export function pointOf(t: Target, c: Ctx): Pt | null {
  if (typeof t === 'function') return t(c)
  if (typeof t !== 'string') return t
  const el = find(t)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

// A point inside an element: `ax`, `ay` from its left and top (0–1); `dx`, `dy` more (px).
export const aim = (selector: string, ax = 0.5, ay = 0.5, dx = 0, dy = 0) =>
  Object.assign(
    (): Pt | null => {
      const el = find(selector)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width * ax + dx, y: r.top + r.height * ay + dy }
    },
    { selector },
  )

// A canvas point (canvas px) where it is on the page now, through the canvas's camera.
export const onCanvas =
  (x: number, y: number) =>
  (c: Ctx): Pt => {
    const cam = camOf(c.wid)
    return { x: (c.size.w / 2 + cam.x + x * cam.zoom) * c.scale, y: (c.size.h / 2 + cam.y + y * cam.zoom) * c.scale }
  }

// A point in the focused piece (its px) where it is on the page now, through its own view.
export const inFocus =
  (x: number, y: number) =>
  (c: Ctx): Pt | null => {
    const v = useCanvasView.getState().planeCam
    return v ? { x: (v.ox + x * v.zoom) * c.scale, y: (v.oy + y * v.zoom) * c.scale } : null
  }

// A point on the stage (its own px, as authored), on the page.
export const onStage =
  (x: number, y: number) =>
  (c: Ctx): Pt => ({ x: x * c.scale, y: y * c.scale })

// ——— the cursor's motion ———

const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
// A person's hand doesn't go straight: a slight bow to one side.
function along(a: Pt, b: Pt, k: number, bow = 0.1): Pt {
  const e = inOut(k)
  const c = { x: (a.x + b.x) / 2 - (b.y - a.y) * bow, y: (a.y + b.y) / 2 + (b.x - a.x) * bow }
  const u = 1 - e
  return { x: u * u * a.x + 2 * u * e * c.x + e * e * b.x, y: u * u * a.y + 2 * u * e * c.y + e * e * b.y }
}
// How long a move takes at ~60 % of a person's speed (onboarding.md §6.2b.3), so it can be followed.
export const moveMs = (from: Pt, to: Pt) => Math.round(520 + Math.hypot(to.x - from.x, to.y - from.y) * 0.9)

// ——— the steps ———

// The made-up data changed (what a write would have done), drawn at once.
export const set = (change: (ws: WorkspaceCtx) => WorkspaceCtx, what = 'set'): Action => ({
  what,
  ms: 0,
  start: (c) => {
    c.store.set(change(c.store.get()))
    c.store.tell()
  },
})

// Nothing for a while (a rest: a person looks before they press).
export const wait = (ms: number): Action => ({ what: `wait ${ms}`, ms })

// The scene in slow motion for `ms` of its time: everything (the app's own glides, the cursor) runs at `factor` of its
// speed, so a quick real motion (fit's 420 ms glide) can be followed. Used sparingly, round one moment.
let tempo = 1
export const slow = (factor: number, ms: number): Action => ({
  what: `slow ${factor} for ${ms}`,
  ms,
  start: () => void (tempo = factor),
  end: () => void (tempo = 1),
})

// Anything else at once, on the real app's own stores.
export const run = (fn: (c: Ctx) => void, what = 'run'): Action => ({ what, ms: 0, start: fn })

function moveTo(target: Target, ms: number | undefined, bow: number, what: string): Action {
  let a: Pt = { x: 0, y: 0 }
  let b: Pt | null = null
  const act: Action = {
    what,
    ms: ms ?? 900,
    start: (c) => {
      a = { x: cursor.x, y: cursor.y }
      b = pointOf(target, c)
      if (!b) console.error(`[demo] ${scene?.id}: ${what}: nothing there`)
      const el = meantBy(target)
      cursor.meant = el ? { what: describe(el), el } : null
    },
    frame: (_c, k) => {
      if (!b) return
      const p = along(a, b, k, bow)
      cursor.x = p.x
      cursor.y = p.y
      moved()
    },
  }
  return act
}

export const cursor_ = {
  // Glides to the target on a slight curve, eased at both ends; `ms` from the distance when not given.
  to: (target: Target, ms?: number): Action => moveTo(target, ms, 0.1, `cursor to ${String(target)}`),
  // Presses and lets go where it is: a click (the press held 90 ms, so the Marks' 70 ms press shows).
  press: (): Action => ({
    what: 'press',
    ms: 140,
    start: () => pressDown(),
    frame: (_c, k) => {
      if (k >= 0.65 && cursor.down) pressUp(true)
    },
    end: () => {
      if (cursor.down) pressUp(true)
    },
  }),
  // Presses at `from` (where the cursor should already be), carries it to `to`, lets go; `drop` runs straight after the
  // release, in the same frame (the write the drop would have made), so nothing flashes back.
  drag: (from: Target, to: Target, ms: number, drop?: Action): Action => {
    let a: Pt = { x: 0, y: 0 }
    let b: Pt | null = null
    return {
      what: `drag ${String(from)} → ${String(to)}`,
      ms,
      start: (c) => {
        const el = meantBy(from)
        cursor.meant = el ? { what: describe(el), el } : cursor.meant
        const p = pointOf(from, c)
        if (p) {
          cursor.x = p.x
          cursor.y = p.y
          moved()
        }
        a = { x: cursor.x, y: cursor.y }
        b = pointOf(to, c)
        pressDown()
      },
      frame: (_c, k) => {
        if (!b) return
        // A moment held before it moves, and a moment still before letting go, as a hand does.
        const m = Math.min(1, Math.max(0, (k - 0.08) / 0.84))
        const p = along(a, b, m, 0.06)
        cursor.x = p.x
        cursor.y = p.y
        moved()
      },
      end: (c) => {
        pressUp(false)
        drop?.start?.(c)
      },
    }
  },
  // The wheel turned over `ms` (a trackpad's even flow): `deltaY` in all, negative zooms in.
  wheel: (deltaY: number, ms: number): Action => {
    let done = 0
    return {
      what: `wheel ${deltaY}`,
      ms,
      start: () => (done = 0),
      frame: (_c, k) => {
        const want = deltaY * inOut(k)
        const d = want - done
        if (Math.abs(d) < 0.01) return
        done = want
        hit(cursor.x, cursor.y).dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, composed: true, clientX: cursor.x, clientY: cursor.y, deltaY: d, deltaMode: 0, view: window }))
      },
    }
  },
}
export { cursor_ as cursor }

// A key pressed (real key events to what has the focus), shown as a key chip bottom-left for a moment: `⌘F`, `Esc`,
// `0`, `p`, `Enter`.
const KEYS: Record<string, { key: string; code: string }> = {
  Esc: { key: 'Escape', code: 'Escape' },
  Enter: { key: 'Enter', code: 'Enter' },
  '↵': { key: 'Enter', code: 'Enter' },
  Tab: { key: 'Tab', code: 'Tab' },
  '↓': { key: 'ArrowDown', code: 'ArrowDown' },
  '↑': { key: 'ArrowUp', code: 'ArrowUp' },
  '⌫': { key: 'Backspace', code: 'Backspace' },
}
export const CHIP_MS = 900
let chipUntil = -1
let chipText = ''
export function key(combo: string, chipMs = CHIP_MS): Action {
  const meta = combo.includes('⌘')
  const shift = combo.includes('⇧')
  const alt = combo.includes('⌥')
  const name = combo.replace(/[⌘⇧⌥]/g, '')
  const k = KEYS[name] ?? { key: name.length === 1 ? (shift ? name.toUpperCase() : name.toLowerCase()) : name, code: name.length === 1 ? (/\d/.test(name) ? `Digit${name}` : `Key${name.toUpperCase()}`) : name }
  return {
    what: `key ${combo}`,
    ms: 0,
    start: () => {
      input('key')
      chipText = combo
      chipUntil = sceneT + chipMs
      const el = keyTarget()
      const init = { ...k, bubbles: true, cancelable: true, composed: true, metaKey: meta, shiftKey: shift, altKey: alt, view: window }
      const go = el.dispatchEvent(new KeyboardEvent('keydown', init))
      // A letter typed into a field, as the browser would after an unrefused keydown.
      if (go && !meta && k.key.length === 1 && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set
        setter?.call(el, el.value + k.key)
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: k.key, inputType: 'insertText' }))
      }
      el.dispatchEvent(new KeyboardEvent('keyup', init))
    },
  }
}

export const ui = {
  // A piece in focus, as its console's `[focus]` asks for it: the ink spreads (unless `instant`).
  focus: (id: string, instant = false): Action => ({
    what: `focus ${id}`,
    ms: 0,
    start: (c) => {
      useCanvasView.setState({ focusSpread: !instant, focusArrived: false, focusLeaving: false, selected: null, cardSelected: null })
      c.navigate(`/workspaces/${c.wid}?focus=${encodeURIComponent(id)}`)
    },
  }),
  // Something selected: `card:<id>`, `piece:<id>`, `text:<id>`.
  select: (what: string): Action => ({
    what: `select ${what}`,
    ms: 0,
    start: () => {
      const [kind, id] = what.split(':')
      if (kind === 'card') useCanvasView.setState({ cardSelected: id, cardMulti: [] })
      else if (kind === 'text') useCanvasView.setState({ labelSelected: id })
      else useCanvasView.setState({ selected: id })
    },
  }),
}

// The canvas's camera glides (eased both ends) to frame a piece (`piece:<id>`, its box with `pad` round it) or
// everything (`all`).
export const camera = {
  // The canvas's camera put somewhere at once (where a scene starts): the canvas point in the stage's middle and the zoom.
  set: (x: number, y: number, zoom: number): Action => ({ what: `camera at ${x},${y}`, ms: 0, start: (c) => setCam(c.wid, { x: -x * zoom, y: -y * zoom, zoom }) }),
  // The focused piece's own view framing part of it (its px), at once: what the scene is about, big enough to read.
  frame: (b: Bounds, pad = 48): Action => ({
    what: 'focus view',
    ms: 0,
    // In the focused piece's own part of the screen (its half, with something open beside it).
    start: () => {
      const a = planeArea()
      const zoom = Math.min(1.25, (a.w - 2 * pad) / b.w, (a.h - 2 * pad) / b.h)
      useCanvasView.setState({ planeCam: { zoom, ox: a.w / 2 - (b.x + b.w / 2) * zoom, oy: a.h / 2 - (b.y + b.h / 2) * zoom } })
    },
  }),
  to: (what: string, ms: number, pad = 96): Action => {
    let from = { x: 0, y: 0, zoom: 1 }
    let to = from
    return {
      what: `camera to ${what}`,
      ms,
      start: (c) => {
        from = camOf(c.wid)
        const ws = c.store.get()
        const boxes: Bounds[] = what === 'all' ? ws.pieces : ws.pieces.filter((p) => `piece:${p.id}` === what)
        if (!boxes.length) return void (to = from)
        const x0 = Math.min(...boxes.map((b) => b.x))
        const y0 = Math.min(...boxes.map((b) => b.y))
        const x1 = Math.max(...boxes.map((b) => b.x + b.w))
        const y1 = Math.max(...boxes.map((b) => b.y + b.h))
        const { w, h } = c.size
        const zoom = Math.min(4, Math.max(0.1, Math.min((w - 2 * pad) / Math.max(1, x1 - x0), (h - 2 * pad) / Math.max(1, y1 - y0))))
        to = { x: -((x0 + x1) / 2) * zoom, y: -((y0 + y1) / 2) * zoom, zoom }
      },
      frame: (c, k) => {
        const e = isReducedMotion() ? 1 : inOut(k)
        setCam(c.wid, { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, zoom: from.zoom + (to.zoom - from.zoom) * e })
      },
    }
  },
}

// ——— the run ———

type Phase = 'run' | 'break' | 'build' | 'reset'

let scene: Scene | null = null
let ctx: Ctx | null = null
// Mounts the scene's tree again from its fixture (Stage.tsx), resolving once it's drawn and measured.
let remount: (() => Promise<Ctx>) | null = null
let sceneT = 0
let phase: Phase = 'run'
let playing = false
let rafId = 0
let lastReal = 0
let busy: Promise<void> = Promise.resolve()
let begun: { started: boolean; ended: boolean; at: number }[] = []
const listeners = { loop: () => {}, error: (_m: string) => {} }

// Each step's moment: its own `at`, or straight after the one before.
function timesOf(s: Scene) {
  let t = 0
  return s.steps.map((st) => {
    const at = st.at ?? t
    t = at + st.do.ms
    return at
  })
}

function advance() {
  if (!scene || !ctx) return
  const times = begun
  scene.steps.forEach((st, i) => {
    const b = times[i]
    if (sceneT < b.at) return
    const a = st.do
    if (!b.started) {
      b.started = true
      a.start?.(ctx!)
    }
    if (b.ended) return
    const k = a.ms > 0 ? Math.min(1, (sceneT - b.at) / a.ms) : 1
    a.frame?.(ctx!, k)
    if (k >= 1) {
      b.ended = true
      a.end?.(ctx!)
    }
  })
  if (document.documentElement.dataset.demoInput === 'pointer') {
    // What has the focus may match :focus-visible (it keeps the focus, for the keys after); the demo's CSS mustn't draw
    // its ring then. A field to type in always matches it, after a real click too (its caret is the point): not a ring.
    const ring = document.querySelector(':focus-visible:not(input, textarea, [contenteditable="true"])')
    if (ring && drawsRing(ring) && rings.length < 20) rings.push(`${Math.round(sceneT)}: ${describe(ring)}`)
  }
  draw()
}

// Whether a focused element shows a ring: a rule of the page's CSS about `:focus-visible` matches it (the demo's CSS
// keeps those from matching while the pointer was last, demoCss.ts; the stage's own rule turning the ring off aside).
// The rules are gathered again when sheets come.
let focusRules: { sheets: number; selectors: string[] } = { sheets: -1, selectors: [] }
function drawsRing(el: Element) {
  // The browser's own ring (an `auto` outline), which no rule of ours draws.
  const st = getComputedStyle(el)
  if (st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0) return true
  if (focusRules.sheets !== document.styleSheets.length) {
    const selectors: string[] = []
    const walk = (rules: CSSRuleList) => {
      for (const r of Array.from(rules)) {
        if (r instanceof CSSStyleRule && r.selectorText.includes(':focus-visible') && !/data-demo-input=['"]?pointer/.test(r.selectorText)) selectors.push(r.selectorText)
        if ('cssRules' in r && (r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules)
      }
    }
    for (const sh of Array.from(document.styleSheets)) {
      try {
        walk(sh.cssRules)
      } catch {
        // Another origin's: none of ours.
      }
    }
    focusRules = { sheets: document.styleSheets.length, selectors }
  }
  return focusRules.selectors.some((sel) => {
    try {
      return el.matches(sel)
    } catch {
      return false
    }
  })
}

// The cursor and the key chip, from where things are now.
let pointerEl: HTMLElement | null = null
let chipEl: HTMLElement | null = null
function draw() {
  if (cursor.shown) hover(capture?.isConnected && cursor.down ? capture : hit(cursor.x, cursor.y))
  if (pointerEl) {
    const k = ctx?.scale ?? 1
    pointerEl.style.transform = `translate(${cursor.x / k}px, ${cursor.y / k}px)`
    pointerEl.dataset.pressed = cursor.down ? 'true' : 'false'
    pointerEl.dataset.shown = cursor.shown ? 'true' : 'false'
  }
  if (chipEl) {
    const on = sceneT < chipUntil
    chipEl.dataset.shown = on ? 'true' : 'false'
    if (on && chipEl.textContent !== chipText) chipEl.textContent = chipText
  }
}

export function attach(p: { pointer: HTMLElement | null; chip: HTMLElement | null }) {
  pointerEl = p.pointer
  chipEl = p.chip
  draw()
}

// Where the break and the rebuild run: the whole page (the stage and what it puts in portals, a card's panel), kept
// hidden from the end of the break until the rebuild's cells start.
const page = () => document.body
const HIDDEN = 'polygon(0 0, 0 0, 0 0)'
// Frames shown while the stage was being made again (a half-settled frame at the loop's seam): should stay 0.
let leaks = 0
// Frames where, with the pointer last, something other than a field showed a focus ring (what a real click never
// leaves): should stay 0.
let rings: string[] = []

// A press or a drag still going ends as a real one would when the page goes (a cancel), and its capture lets go, so
// nothing is left mid-drag when the tree is made again.
function letGo() {
  if (cursor.down) {
    const el = capture?.isConnected ? capture : hit(cursor.x, cursor.y)
    cursor.down = false
    send('pointercancel', el)
  }
  capture = null
  cursor.downOn = null
  cursor.meant = null
  tempo = 1
}

// Back to the first frame: the tree made again from the fixture, every store as it began, the clock's scene time 0,
// the cursor at its rest, the steps at 0 done.
async function reset() {
  if (!scene || !remount) return
  letGo()
  // What the cancel set going (a drag's own end) runs before the tree goes.
  stepClock(0)
  await yieldTask()
  await yieldTask()
  finishAnimations()
  hover(null)
  wanted = null
  mark(null)
  Object.assign(cursor, { down: false, over: null, downOn: null, shown: true, meant: null })
  chipUntil = -1
  ctx = await remount()
  for (const a of scene.setup ?? []) {
    a.start?.(ctx)
    a.frame?.(ctx, 1)
    a.end?.(ctx)
  }
  // What builds in as it mounts (Appear's cells, a fit) done before the first frame: the scene starts built.
  for (let i = 0; i < SETTLE_FRAMES; i++) {
    stepClock(FRAME)
    await yieldTask()
    await yieldTask()
  }
  finishAnimations()
  restart()
  sceneT = 0
  presses = []
  rings = []
  delete document.documentElement.dataset.demoInput
  begun = timesOf(scene).map((at) => ({ started: false, ended: false, at }))
  const rest = pointOf(scene.cursor, ctx)
  if (rest) Object.assign(cursor, rest)
  advance()
  // Never an empty stage: the tree is there, or the error says why.
  if (!ctx.root.isConnected || !ctx.root.childElementCount) fail(`${scene.id}: the stage is empty after starting over`)
}

function fail(message: string) {
  console.error(`[demo] ${message}`)
  listeners.error(message)
}

function frame(now: number) {
  if (!playing) return void (rafId = 0)
  rafId = realClock.raf(frame)
  const dt = Math.min(50, Math.max(0, now - lastReal))
  lastReal = now
  // (The browser gives the polygon back in its own words: `polygon(0px 0px, …)`.)
  if (phase === 'reset' && !page().style.clipPath.startsWith('polygon')) leaks += 1
  stepClock(dt * tempo)
  if (!scene || !ctx) return
  if (phase === 'run') {
    sceneT += dt
    advance()
    if (sceneT >= scene.length + HOLD_MS) {
      phase = 'break'
      runCells(page(), 'exit', 0, BREAK_MS, () => {
        // Hidden from here until the rebuild's cells begin.
        page().style.clipPath = HIDDEN
        phase = 'reset'
        busy = reset().then(() => {
          if (!ctx) return
          phase = 'build'
          runCells(page(), 'enter', 0, BUILD_MS, () => {
            phase = 'run'
            listeners.loop()
          })
        })
      })
    }
  }
  if (window.__demo) window.__demo.t = sceneT
}

// The browser's frames drive the clock while playing; paused, held on the poster or under reduced motion nothing runs.
function startLoop() {
  if (rafId) realClock.caf(rafId)
  lastReal = realClock.now()
  rafId = realClock.raf(frame)
}

// The scene to play: made, measured, its first frame drawn.
export async function load(s: Scene, mount: () => Promise<Ctx>) {
  const times = timesOf(s)
  const last = Math.max(0, ...s.steps.map((st, i) => times[i] + st.do.ms))
  if (last > s.length) console.error(`[demo] ${s.id}: its steps end at ${last} ms, after its length (${s.length})`)
  if (s.length > 8000) console.error(`[demo] ${s.id}: ${s.length} ms is longer than a scene may be (8000)`)
  playing = false
  // In turn after whatever runs now (a seek, another load): two loads at once would mount two stages, the first one's
  // promise never settling, and everything after it waiting for good.
  const run = busy.then(async () => {
    scene = s
    remount = mount
    phase = 'run'
    page().style.clipPath = ''
    await reset()
  })
  busy = run.catch(() => {})
  await run
}

export function play() {
  if (!scene || isReducedMotion()) return
  releaseAnimations()
  playing = true
  startLoop()
}

export function pause() {
  playing = false
}

// The scene at `t` (ms), the same picture every time: started again, stepped in fixed frames to t, held there.
export async function seek(t: number) {
  playing = false
  const go = async () => {
    if (!scene) return
    page().style.clipPath = ''
    phase = 'run'
    await reset()
    const end = Math.max(0, Math.min(t, scene.length + HOLD_MS))
    while (sceneT < end - 1e-6) {
      const dt = Math.min(FRAME, end - sceneT)
      stepClock(dt * tempo)
      sceneT += dt
      advance()
      await yieldTask()
      await yieldTask()
      await yieldTask()
      stepAnimations(dt * tempo)
    }
    sceneT = end
    // What the last step changed drawn, and the cell reveals' last frames.
    for (let i = 0; i < 3; i++) {
      stepClock(0)
      await yieldTask()
    }
    stepAnimations(0)
    draw()
    if (window.__demo) window.__demo.t = sceneT
  }
  busy = busy.then(go)
  await busy
}

export const current = () => scene
export const onLoop = (f: () => void) => void (listeners.loop = f)
export const onError = (f: (message: string) => void) => void (listeners.error = f)
// What the scenes check reads: the presses since the scene last started, and frames shown at a seam.
export const record = () => ({ presses: [...presses], leaks, rings: [...rings] })
export const sceneTimeNow = () => sceneT

// What the page shows the coach and headless checks (main.tsx keeps it up to date).
export type DemoHandle = {
  ready: boolean
  error?: string
  // The scene's time now (ms), and the scene shown.
  t: number
  scene?: string
  // The scene's authored size (16:10): its frame should be this size, scaled from outside.
  size?: [number, number]
  length?: number
  poster?: number
  // Writes the demo refused (each a handler that would have written).
  refused: number
  // Loops played to their end since the page loaded.
  loops: number
  // The presses since the scene last started (each: meant to land on what it did?) and frames shown mid-rebuild.
  record: () => { presses: Press[]; leaks: number; rings: string[] }
  seek: (t: number) => Promise<void>
  play: () => void
  pause: () => void
}

declare global {
  interface Window {
    __demo: DemoHandle
  }
}
