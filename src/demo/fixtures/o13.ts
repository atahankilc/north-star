// What O13's scenes share (D-315, onboarding-lessons.md §8 together, §9 finding and canvases, and the side nav's pages):
// made-up teammates in the presence store (their squares are the real PeopleHere, their selection the real L's, a
// follow the real Follow), their cursors drawn in the look PeerCursors gives them (where a cursor is comes from RTDB
// in the app, which the demo has none of: src/data/presence.ts keeps its tracks private), each in a space of its own
// (the canvas, or the plane in focus) so it stays on what it points at as the view moves; and threads as the
// workspace holds them (the list and the chips read only these; a thread's messages load from Firestore, which the
// demo hasn't got, so no scene opens a thread that has any).
import { accents } from '../../styles/tokens'
import { themeAccent } from '../../state/theme'
import { useCanvasView } from '../../state/canvasView'
import { usePresence, type Peer } from '../../data/presence'
import { useThreadView } from '../../views/workspace/Threads'
import { demoThreads } from '../../data/threads'
import { useFind } from '../../views/workspace/find'
import type { WithId } from '../../data/hooks'
import type { Thread } from '../../data/model'
import peerStyles from '../../views/workspace/collab.module.css'
import hudStyles from '../../ui/Hud.module.css'
import { inFocus, onCanvas, run, type Action, type Ctx } from '../director'
import { PEOPLE } from './pazar'
import { DEMO_DAY } from '../clock'

// ——— the stage ———
// Only the HUD's part the lesson is about (onboarding.md §6.2b.1): on a 16:10 stage small enough to read in the lesson's
// slot (640 × 400) the side nav (the left edge's middle) and the bottom-left corner would overlap, as they never do on a
// real screen; so a side nav lesson shows no corner, and a corner lesson (people, threads) no side nav.
const hide = (scene: string, what: string, selector: string): Action =>
  run(() => {
    const id = `demo-o13-${scene}-${what}`
    if (document.getElementById(id)) return
    const st = document.createElement('style')
    st.id = id
    st.textContent = `html:has([data-scene="${scene}"]) [data-scene] ${selector} { visibility: hidden !important; }`
    document.head.appendChild(st)
  }, `no ${what}`)
export const sideOnly = (scene: string): Action => hide(scene, 'corner', `.${hudStyles.corner}`)
export const cornerOnly = (scene: string): Action => hide(scene, 'side nav', '[data-learn="sidenav"]')

// ——— teammates ———

export const peer = (who: { uid: string; name: string }, color: string, since: number, extra: Partial<Peer> = {}): Peer => ({
  uid: who.uid,
  name: who.name.split(' ')[0],
  color,
  view: 'canvas',
  since,
  ts: DEMO_DAY,
  ...extra,
})
export const AYLA = peer(PEOPLE.ayla, accents[2], 1)
export const JONAS = peer(PEOPLE.jonas, accents[0], 2)

// Nobody here, nobody followed, nothing of a thread open: how every O13 scene starts (the stores outlive a loop).
export const calm = (): Action =>
  run(() => {
    usePresence.setState({ peers: [], following: null })
    useThreadView.setState({
      openId: null,
      draft: null,
      inbox: false,
      scope: null,
      show: true,
    })
    useFind.setState({ open: false })
    demoThreads.messages = {}
    demoThreads.seen = {}
    demoThreads.me = ''
    useCanvasView.setState({ selected: null, cardSelected: null, cardMulti: [], labelSelected: null })
    drawn.forEach((d) => d.el.remove())
    drawn.clear()
  }, 'nobody here')

// Someone's presence changed (arrived, went into a plane, picked a card): the presence store as RTDB would fill it.
export const presence = (uid: string, change: Partial<Peer> | null, base?: Peer): Action =>
  run(() => {
    const { peers } = usePresence.getState()
    const was = peers.find((p) => p.uid === uid) ?? base
    if (change === null)
      return usePresence.setState({
        peers: peers.filter((p) => p.uid !== uid),
      })
    if (!was) return
    const next = { ...was, ...change }
    usePresence.setState({
      peers: peers.some((p) => p.uid === uid) ? peers.map((p) => (p.uid === uid ? next : p)) : [...peers, next],
    })
  }, `presence ${uid}`)

// ——— their cursors (drawn as PeerCursors draws them) ———

type Space = 'canvas' | 'focus'
type Drawn = {
  el: HTMLDivElement
  at: { x: number; y: number }
  space: Space
  color: string
}
const drawn = new Map<string, Drawn>()
const place = (c: Ctx, d: Drawn) => {
  const p = d.space === 'canvas' ? onCanvas(d.at.x, d.at.y)(c) : inFocus(d.at.x, d.at.y)(c)
  if (!p) return
  const box = (d.el.parentElement ?? c.root).getBoundingClientRect()
  d.el.style.transform = `translate(${(p.x - box.left) / c.scale}px, ${(p.y - box.top) / c.scale}px)`
  d.el.style.setProperty('--peer', themeAccent(d.color))
}
// Into the real PeerCursors' layer (under the menus and panels, as in the app); empty here, the demo has no RTDB.
const layer = (c: Ctx) => {
  const real = [...c.root.querySelectorAll<HTMLElement>(`.${peerStyles.cursors}`)].at(-1)
  if (real) return real
  const el = c.root.appendChild(document.createElement('div'))
  el.className = peerStyles.cursors
  return el
}

// A teammate's cursor appears at a point of a space (its px).
export const cursorOf = (p: Peer, at: { x: number; y: number }, space: Space = 'canvas'): Action => ({
  what: `${p.name}'s cursor`,
  ms: 0,
  start: (c) => {
    drawn.get(p.uid)?.el.remove()
    const el = document.createElement('div')
    el.className = peerStyles.cursor
    el.innerHTML = `<svg class="${peerStyles.arrow}" viewBox="0 0 16 16"><path d="M1 1 L1 13 L4.5 9.5 L7.5 15 L9.5 14 L6.6 8.6 L11.5 8.6 Z"/></svg><span class="${peerStyles.name}">${p.name}</span>`
    layer(c).appendChild(el)
    const d = { el, at: { ...at }, space, color: p.color }
    drawn.set(p.uid, d)
    place(c, d)
  },
})

// Their cursor now in another space (they went into a plane): where it is in that one.
export const cursorInto = (uid: string, at: { x: number; y: number }, space: Space): Action => ({
  what: `cursor into ${space}`,
  ms: 0,
  start: (c) => {
    const d = drawn.get(uid)
    if (!d) return
    // Into the layer the view draws now (a focus has its own).
    const l = layer(c)
    if (d.el.parentElement !== l) l.appendChild(d.el)
    d.at = { ...at }
    d.space = space
    place(c, d)
  },
})

// Every drawn cursor kept on its point for `ms` while the view moves under it (a camera glide, a focus arriving).
export const keepPlaced = (ms: number): Action => ({
  what: `cursors kept placed ${ms}`,
  ms,
  frame: (c) => drawn.forEach((d) => place(c, d)),
})

// A teammate's cursor glides (eased both ends, a slight bow, as a hand) to a point of its space.
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const drift = (uid: string, to: { x: number; y: number }, ms: number): Action => {
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
      d.at = {
        x: a.x + (to.x - a.x) * e - (to.y - a.y) * bow,
        y: a.y + (to.y - a.y) * e + (to.x - a.x) * bow,
      }
      place(c, d)
    },
  }
}

// ——— threads ———

const MIN = 60 * 1000
export const thread = (id: string, t: Partial<Thread> & Pick<Thread, 'on' | 'targetId' | 'planeId'>): WithId<Thread> => ({
  id,
  x: 0,
  y: 0,
  uid: PEOPLE.ayla.uid,
  name: PEOPLE.ayla.name,
  count: 1,
  lastAt: DEMO_DAY - 30 * MIN,
  createdAt: DEMO_DAY - 3 * 60 * MIN,
  updatedAt: DEMO_DAY - 30 * MIN,
  ...t,
})

// A teammate's cursor gone from your space (you went where they aren't): PeerCursors draws only those in yours.
export const cursorGone = (uid: string): Action =>
  run(() => {
    drawn.get(uid)?.el.remove()
    drawn.delete(uid)
  }, `cursor ${uid} gone`)
