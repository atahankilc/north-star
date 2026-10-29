// The welcome's last page (onboarding-lessons.md §1 `welcome` page 4, "Together, live"): a plane in focus with two
// teammates in it. Their squares are bottom left (the real PeopleHere, from the presence store), Ayla has a card
// selected (the real L's with her name), and both their cursors drift over the plane. Then the person right-clicks a
// problem card: the real menu builds, `comment` is picked, and the real thread panel opens bottom left with its field,
// a first line typed into it.
//
// The peers' cursors are drawn here, in the look PeerCursors gives them (collab.module.css: the arrow in their colour,
// the name tag): their places come from RTDB in the app (src/data/presence.ts keeps them private), and the demo has
// none. Their squares and selection are the real components, fed through the presence store.
import { accents } from '../../styles/tokens'
import { themeAccent } from '../../state/theme'
import { usePresence, type Peer } from '../../data/presence'
import peerStyles from '../../views/workspace/collab.module.css'
import { aim, camera, cursor, inFocus, key, pointOf, wait, type Action, type Ctx, type Scene, type Step, type Target } from '../director'
import { pazar, workspace, WID, P, PEOPLE, DEMO_USER } from '../fixtures/pazar'
import { DEMO_DAY } from '../clock'

const CARD = '[data-target="card:r-greasy"]'
const COMMENT = '[role="menu"] [data-key="comment"]'
const TYPED = 'Is €14 still right?'

// Two teammates in the plane: Ayla (her card picked), Jonas.
const peer = (who: { uid: string; name: string }, color: string, since: number, extra: Partial<Peer> = {}): Peer => ({
  uid: who.uid,
  name: who.name.split(' ')[0],
  color,
  view: 'canvas',
  plane: P.lunch,
  since,
  ts: DEMO_DAY,
  ...extra,
})
const PEERS: Peer[] = [peer(PEOPLE.ayla, accents[2], 1, { sel: 'i-forecast' }), peer(PEOPLE.jonas, accents[0], 2)]

// ——— the peers' cursors (drawn as PeerCursors draws them) ———

type Drawn = { el: HTMLDivElement; at: { x: number; y: number }; color: string }
const drawn = new Map<string, Drawn>()
const place = (c: Ctx, d: Drawn) => {
  const p = inFocus(d.at.x, d.at.y)(c)
  if (!p) return
  const box = (d.el.parentElement ?? c.root).getBoundingClientRect()
  d.el.style.transform = `translate(${(p.x - box.left) / c.scale}px, ${(p.y - box.top) / c.scale}px)`
  d.el.style.setProperty('--peer', themeAccent(d.color))
}

// The peers in the presence store and their cursors on the stage, where each starts (plane px).
const arrive = (start: Record<string, { x: number; y: number }>): Action => ({
  what: 'peers here',
  ms: 0,
  start: (c) => {
    usePresence.setState({ peers: PEERS })
    drawn.clear()
    // Into the real PeerCursors' layer (under the menus and panels, as in the app); empty here, the demo has no RTDB.
    const real = [...c.root.querySelectorAll<HTMLElement>(`.${peerStyles.cursors}`)].at(-1)
    const layer = real ?? c.root.appendChild(document.createElement('div'))
    if (!real) layer.className = peerStyles.cursors
    for (const p of PEERS) {
      const el = document.createElement('div')
      el.className = peerStyles.cursor
      el.innerHTML = `<svg class="${peerStyles.arrow}" viewBox="0 0 16 16"><path d="M1 1 L1 13 L4.5 9.5 L7.5 15 L9.5 14 L6.6 8.6 L11.5 8.6 Z"/></svg><span class="${peerStyles.name}">${p.name}</span>`
      layer.appendChild(el)
      const d = { el, at: { ...start[p.uid] }, color: p.color }
      drawn.set(p.uid, d)
      place(c, d)
    }
  },
})

// A peer's cursor glides (eased both ends, a slight bow, as a hand) to a point of the plane.
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const drift = (uid: string, to: { x: number; y: number }, ms: number): Action => {
  let a = { x: 0, y: 0 }
  return {
    what: `peer ${uid} to ${to.x},${to.y}`,
    ms,
    start: () => {
      const d = drawn.get(uid)
      if (d) a = { ...d.at }
    },
    frame: (c, k) => {
      const d = drawn.get(uid)
      if (!d) return
      const e = inOut(k)
      const bow = Math.sin(Math.PI * e) * 0.08
      d.at = { x: a.x + (to.x - a.x) * e - (to.y - a.y) * bow, y: a.y + (to.y - a.y) * e + (to.x - a.x) * bow }
      place(c, d)
    },
  }
}

// A right-click where the cursor is (it went to `t` the step before): the browser's contextmenu, which the canvas
// answers with its menu. (The director's press is the left button's.)
const rightClick = (t: Target): Action => ({
  what: 'right-click',
  ms: 120,
  start: (c) => {
    const p = pointOf(t, c)
    if (!p) return console.error('[demo] peers-comment: nothing to right-click')
    const el = document.elementFromPoint(p.x, p.y) ?? document.body
    const init = { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, button: 2, buttons: 2, view: window }
    el.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true }))
    el.dispatchEvent(new MouseEvent('mousedown', init))
    el.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true }))
    el.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }))
    el.dispatchEvent(new MouseEvent('contextmenu', { ...init, buttons: 0 }))
  },
})

// Typed into what has the focus, at a readable pace, no key chips (it's words, not a key).
const type = (text: string, each = 75): Step[] => [...text].map((ch) => ({ do: { ...key(/[A-Z]/.test(ch) ? `⇧${ch}` : ch, 0), ms: each } }))

const on = aim(CARD, 0.55, 0.55)

const scene: Scene = {
  id: 'peers-comment',
  fixture: { ...pazar, wid: WID, workspace: { ...workspace, ownerId: DEMO_USER.uid } },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${P.lunch}`,
  size: [960, 600],
  length: 6900,
  // The thread open on the card, its first line typed; the menu gone.
  poster: 6700,
  cursor: inFocus(560, 690),
  // Customers, problems and the first ideas in view; the thread opens bottom left, over the plane's lower left, so the
  // teammates end on the right, in sight.
  setup: [
    camera.frame({ x: -30, y: -30, w: 1000, h: 640 }, 30),
    arrive({ [PEOPLE.ayla.uid]: { x: 840, y: 560 }, [PEOPLE.jonas.uid]: { x: 700, y: 120 } }),
  ],
  steps: [
    // The person: to the problem card, a rest, a right-click; the menu builds; down to `comment`, a click.
    { at: 1300, do: cursor.to(on, 1000) },
    { do: wait(400) },
    { do: rightClick(on) },
    { do: wait(650) },
    { do: cursor.to(aim(COMMENT, 0.3, 0.5), 700) },
    { do: wait(300) },
    { do: cursor.press() },
    // The thread builds, its field takes the keys; a first line.
    { do: wait(600) },
    ...type(TYPED),
    // The teammates meanwhile: Ayla looks over the ideas, Jonas comes down the problems toward the person's card.
    { at: 0, do: drift(PEOPLE.ayla.uid, { x: 610, y: 600 }, 1600) },
    { at: 300, do: drift(PEOPLE.jonas.uid, { x: 520, y: 230 }, 1500) },
    { at: 2100, do: drift(PEOPLE.ayla.uid, { x: 760, y: 520 }, 1400) },
    { at: 2300, do: drift(PEOPLE.jonas.uid, { x: 400, y: 250 }, 1700) },
    { at: 4300, do: drift(PEOPLE.jonas.uid, { x: 760, y: 300 }, 1600) },
    { at: 4400, do: drift(PEOPLE.ayla.uid, { x: 700, y: 610 }, 1500) },
  ],
}
export default scene
