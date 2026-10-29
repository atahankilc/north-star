// The demo's stage (D-315, docs/specs/onboarding.md §6.2): a plane in focus drawn by the app's own components
// (FocusedPlane, PlaneCards and its links) over a made-up workspace held in memory, and a pointer drawn by the stage.
// O0's spike plays one scene, `plane-drag`: the pointer goes to a card, presses, carries it across the plane and back.
// The card moves by changing the made-up data (the demo realm writes nothing), as a person's drag would once it lands.
// The time is the stage's own: a loop on rAF, or held still at a moment (`seek`, for headless shots and reduced motion).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { makeStore, registerStore, type Store } from '../state/wsStore'
import { useCanvasView, type PlaneCam } from '../state/canvasView'
import { useMotion } from '../state/motion'
import { WorkspaceContext, useWs } from '../views/workspace/context'
import { FocusedPlane } from '../views/workspace/FocusedPlane'
import { PlaneCards } from '../views/workspace/PlaneCards'
import { CARD } from '../data/cards'
import { MAIN } from '../data/canvases'
import { PLANE, tiny, WID, workspace } from './fixtures/tiny'
import styles from './Stage.module.css'

// The scenes it knows; another id is an error the host can read (`__demo.error`, main.tsx), not a blank wait.
export const SCENES = ['plane-drag']

// The scene's length and its moments (ms). One loop: rest, go to the card, rest on it (a person looks before they press,
// onboarding.md §6.2b.3), press, carry it, let go, hold, carry it back, let go, go away, rest; it ends where it starts,
// so the loop has no seam.
const LOOP = 6000
const GO = [200, 800]
const PRESS = [1000, 1150]
const THERE = [1150, 2650]
const BACK = [3450, 4950]
const AWAY = [4950, 5600]
// The still picture (reduced motion, the poster): the card where it was carried.
export const POSTER = 3050

// The card carried, from where to where (plane px), and the point of it held.
const CARRIED = 'f-pickup'
const FROM = { x: 600, y: 225 }
const TO = { x: 425, y: 450 }
const HOLD = { x: CARD.w * 0.55, y: CARD.h * 0.45 }
// The pointer's rest, off the cards (plane px).
const REST = { x: 900, y: 560 }
// What the view fits: every card, where they start and where the carried one goes.
const BOUNDS = { x0: 0, y0: 0, x1: 800, y1: 575 }

type Pt = { x: number; y: number }

const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const part = (t: number, [a, b]: number[]) => Math.min(1, Math.max(0, (t - a) / (b - a)))
// A person's hand doesn't go straight: a slight bow to one side (out round the cards, there; the other way, back),
// eased in and out.
function along(a: Pt, b: Pt, k: number): Pt {
  const e = inOut(k)
  const bow = -0.12
  const c = { x: (a.x + b.x) / 2 - (b.y - a.y) * bow, y: (a.y + b.y) / 2 + (b.x - a.x) * bow }
  const u = 1 - e
  return { x: u * u * a.x + 2 * u * e * c.x + e * e * b.x, y: u * u * a.y + 2 * u * e * c.y + e * e * b.y }
}
const add = (a: Pt, b: Pt) => ({ x: a.x + b.x, y: a.y + b.y })

// Where everything is at `t` in the loop: the pointer (plane px), whether it's pressed, and the card's top-left.
function frameAt(t: number): { pointer: Pt; pressed: boolean; card: Pt } {
  t = ((t % LOOP) + LOOP) % LOOP
  const grabFrom = add(FROM, HOLD)
  const grabTo = add(TO, HOLD)
  if (t < GO[1]) return { pointer: along(REST, grabFrom, part(t, GO)), pressed: false, card: FROM }
  if (t < THERE[1]) {
    const p = along(grabFrom, grabTo, part(t, THERE))
    return { pointer: p, pressed: t >= PRESS[0], card: { x: p.x - HOLD.x, y: p.y - HOLD.y } }
  }
  if (t < BACK[0]) return { pointer: grabTo, pressed: t < THERE[1] + 120 || t >= BACK[0] - 150, card: TO }
  if (t < BACK[1]) {
    const p = along(grabTo, grabFrom, part(t, BACK))
    return { pointer: p, pressed: true, card: { x: p.x - HOLD.x, y: p.y - HOLD.y } }
  }
  return { pointer: along(grabFrom, REST, part(t, AWAY)), pressed: t < BACK[1] + 120, card: FROM }
}

// The plane's view fitted to the stage, as a focus fits it on arrival (D-186).
function fit(w: number, h: number): PlaneCam {
  const pad = 96
  const bw = BOUNDS.x1 - BOUNDS.x0
  const bh = BOUNDS.y1 - BOUNDS.y0
  const zoom = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh, 1.4)
  return { zoom, ox: (w - bw * zoom) / 2 - BOUNDS.x0 * zoom, oy: (h - bh * zoom) / 2 - BOUNDS.y0 * zoom }
}

export type DemoHandle = { ready: boolean; error?: string; t: number; seek: (t: number) => void; play: () => void }

export function Stage({ scene }: { scene: string }) {
  const store = useMemo<Store>(() => makeStore({ ...tiny, wid: WID, workspace, canvas: MAIN }), [])
  useLayoutEffect(() => registerStore(store), [store])
  const [size] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const home = useMemo(() => fit(size.w, size.h), [size])
  useLayoutEffect(() => {
    useCanvasView.setState({ size })
  }, [size])
  const plane = tiny.pieces[0]
  const lens = useRef<HTMLDivElement>(null)
  const pointer = useRef<HTMLDivElement>(null)
  const reduced = useMotion((s) => s.reduced)

  // The clock: a loop on rAF, or a moment held (seek). Each frame puts the card where it is (only when it moved) and the
  // pointer on screen through the plane's view (its style only, nothing drawn again for it).
  useEffect(() => {
    if (scene !== 'plane-drag') return
    const demo = window.__demo
    let raf = 0
    let t0 = performance.now()
    let held: number | null = reduced ? POSTER : null
    let last: Pt | null = null
    const show = (t: number) => {
      const f = frameAt(t)
      if (!last || last.x !== f.card.x || last.y !== f.card.y) {
        last = f.card
        const ws = store.get()
        store.set({ ...ws, cards: ws.cards.map((c) => (c.id === CARRIED ? { ...c, x: Math.round(f.card.x), y: Math.round(f.card.y) } : c)) })
        store.tell()
      }
      const cam = useCanvasView.getState().planeCam ?? home
      const el = pointer.current
      if (el) {
        el.style.transform = `translate(${cam.ox + f.pointer.x * cam.zoom}px, ${cam.oy + f.pointer.y * cam.zoom}px)`
        el.dataset.pressed = f.pressed ? 'true' : 'false'
      }
      demo.t = ((t % LOOP) + LOOP) % LOOP
    }
    const frame = (now: number) => {
      show(held ?? now - t0)
      if (held === null) raf = requestAnimationFrame(frame)
    }
    demo.seek = (t) => {
      cancelAnimationFrame(raf)
      held = t
      show(t)
    }
    demo.play = () => {
      if (reduced) return
      cancelAnimationFrame(raf)
      t0 = performance.now() - (held ?? 0)
      held = null
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    // Ready once the type is in and the plane has its view: what's drawn from here is the scene.
    let gone = false
    void document.fonts.ready.then(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!gone) demo.ready = !!useCanvasView.getState().planeCam
        }),
      ),
    )
    return () => {
      gone = true
      cancelAnimationFrame(raf)
      demo.ready = false
    }
  }, [scene, store, home, reduced])

  return (
    <MemoryRouter initialEntries={[`/workspaces/${WID}?focus=${PLANE}`]}>
      <WorkspaceContext.Provider value={store}>
        <div className={styles.stage}>
          {/* What a focus hides under it: here nothing, the stage is the plane. */}
          <div ref={lens} hidden />
          <FocusedPlane piece={plane} at={{ x: 0, y: 0, w: size.w, h: size.h, zoom: home.zoom }} home={home} spread={false} leaving={false} lens={lens} onArrived={() => {}} onLeft={() => {}}>
            <Cards />
          </FocusedPlane>
          <div ref={pointer} className={styles.pointer} aria-hidden>
            <svg viewBox="0 0 16 22" width="16" height="22">
              <path d="M1 1 L1 17 L5 13 L8 20 L10.6 19 L7.6 12.2 L13 12.2 Z" />
            </svg>
          </div>
        </div>
      </WorkspaceContext.Provider>
    </MemoryRouter>
  )
}

// The plane's cards, live on its view, as a focus draws them (CanvasView's FocusedCards); read from the store, so a
// change to the made-up data draws what it changed.
function Cards() {
  const { cards, labels } = useWs()
  const view = useCanvasView((s) => s.planeCam)
  const mine = useMemo(() => cards.filter((c) => c.pieceId === PLANE), [cards])
  const text = useMemo(() => labels.filter((l) => l.pieceId === PLANE), [labels])
  return view ? <PlaneCards cards={mine} labels={text} view={view} live editor={false} /> : null
}

declare global {
  interface Window {
    __demo: DemoHandle
  }
}
