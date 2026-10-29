// The onboarding's demo realm (D-315, docs/specs/onboarding.md §6.1–6.2): its own page (demo.html), shown in a sealed
// frame, so the real components run on their own copy of every store and nothing leaks into the app. No Firebase at
// all (demo.html sets the flag src/data/firebase.ts reads); theme and motion copied from the app's storage (demo.html);
// every write refused; the first scene from the hash (`#scene=canvas-fit`), the next ones swapped in place. Loaded by
// main.tsx once the demo's clock and storage are in place.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/global.css'
import '../state/theme'
import { setReadOnly } from '../data/history'
import { useCurtain } from '../state/curtain'
import { useMotion } from '../state/motion'
import { useTheme } from '../state/theme'
import { useCanvasView } from '../state/canvasView'
import { useKanbanUi } from '../views/workspace/Kanban'
import { useMatrixUi } from '../views/workspace/Matrix'
import { useTableUi } from '../views/workspace/Table'
import { useFind } from '../views/workspace/find'
import { useTasksSide } from '../views/workspace/sideState'
import { usePlaneFilter } from '../views/workspace/planeFilter'
import { useThreadView } from '../views/workspace/Threads'
import { useDocUi } from '../views/workspace/Documents'
import { useShelf } from '../views/workspace/FilterDock'
import { useGoTo } from '../views/workspace/goTo'
import { useGuides } from '../views/workspace/guides'
import { useKanbanSizes, useOpenSize } from '../views/workspace/sizes'
import { usePresence } from '../data/presence'
import { load, onError, onLoop, pause, play, record, seek, type Ctx, type Scene } from './director'
import { SCENES } from './sceneList'
import { Stage } from './Stage'
import { watchDemoCss } from './demoCss'

// Anything that slips through to a write is refused (the toast that would say so isn't mounted here).
// `:hover` and `:focus-visible` for the made-up input (demoCss.ts): the build rewrote its CSS already; the dev server
// serves the app's own, so it's rewritten here as it arrives.
if (import.meta.env.DEV) watchDemoCss()

setReadOnly('the demo writes nothing', 'demo')
// No curtain here: the stage is the page from the first frame, entrances play at once.
useCurtain.getState().setRevealed(true)

window.__demo = { ready: false, t: 0, refused: 0, loops: 0, record, seek: async () => {}, play: () => {}, pause: () => {} }

// A write a handler tried (a drop, a click that would make something) fails on the missing Firebase: counted, not an
// error, since refusing it is the point. Only a handler's: what throws while drawing is caught by the stage's boundary
// (Stage.tsx) and reported as an error.
const REFUSED = /Firebase is not configured|the demo writes nothing/
const refused = (e: { preventDefault: () => void }, message: string) => {
  if (!REFUSED.test(message)) return
  e.preventDefault()
  window.__demo.refused += 1
}
window.addEventListener('unhandledrejection', (e) => refused(e, String((e.reason as Error)?.message ?? e.reason)))
window.addEventListener('error', (e) => {
  refused(e, String(e.message))
  if (import.meta.env.DEV) console.warn('[demo] refused', (e.error as Error)?.stack)
})

// Every store the real views keep outside React, as it was when the page loaded: a scene starts on them afresh.
// What a scene leaves in the demo's own storage (the split, snapping, the side view's tab…; demo.html keeps it in memory)
// goes too, but for the app's theme and motion, which the demo follows.
const stores = [useCanvasView, useKanbanUi, useMatrixUi, useTableUi, useFind, useTasksSide, usePlaneFilter, useThreadView, useDocUi, useShelf, useGoTo, useGuides, useOpenSize, useKanbanSizes, usePresence]
const KEEP = ['north-star.theme', 'north-star.motion']
const fresh = () => {
  for (const st of [localStorage, sessionStorage]) {
    const keys = Array.from({ length: st.length }, (_, i) => st.key(i)).filter((k): k is string => !!k && !KEEP.includes(k))
    keys.forEach((k) => st.removeItem(k))
  }
  stores.forEach((s) => (s as { setState: (v: unknown, replace: true) => void }).setState(s.getInitialState(), true))
}

const root = createRoot(document.getElementById('root')!)
let gen = 0
// The scene's tree made anew; resolves once it's drawn and measured.
const mount = (s: Scene) => () =>
  new Promise<Ctx>((resolve) => {
    fresh()
    let done = false
    const ready = (c: Ctx) => {
      if (done) return
      done = true
      resolve(c)
    }
    root.render(
      <StrictMode>
        <Stage key={++gen} scene={s} onReady={ready} onError={failed} />
      </StrictMode>,
    )
  })

// Talking to the coach (onboarding.md §6.2; src/onboarding/Demo.tsx): `{ ns, type }` messages from the same origin only.
// There: play, pause (held where it is), seek `t`, poster, scene (another scene, swapped in this frame), theme, motion.
// Back: ready once a scene is drawn, loop at each loop's end, error. Theme and motion change this frame's stores only
// (nothing written to the browser's storage: the app's own choice is the one kept).
const NS = 'north-star-demo'
const tell = (type: string, extra: Record<string, unknown> = {}) => {
  if (window.parent !== window) window.parent.postMessage({ ns: NS, type, ...extra }, location.origin)
}

// The scene failed (it threw while drawing, or its stage came out empty): the coach shows the caption without it.
function failed(message: string) {
  window.__demo.error = message
  console.error(`[demo] ${message}`)
  tell('error', { error: message })
}
onError(failed)

let shown: Scene | null = null
// The window's size the scene was drawn at: the stage scales to it once, as it mounts. The frame made another size (the
// coach fitting it to the scene) draws the scene again.
let drawnAt = { w: 0, h: 0 }
// The latest show(): one started after it (a resize, another scene) makes it stop before saying it's ready.
let showing = 0
window.addEventListener('resize', () => {
  if (shown && (innerWidth !== drawnAt.w || innerHeight !== drawnAt.h)) void show(shown.id)
})
async function show(id: string) {
  const s = SCENES[id]
  const demo = window.__demo
  const mine = ++showing
  demo.ready = false
  if (!s) {
    demo.error = `unknown scene: ${id}`
    tell('error', { error: demo.error })
    return
  }
  demo.error = undefined
  shown = s
  Object.assign(demo, { scene: s.id, length: s.length, poster: s.poster, size: s.size })
  drawnAt = { w: innerWidth, h: innerHeight }
  await load(s, mount(s))
  if (shown !== s || mine !== showing) return
  if (useMotion.getState().reduced) await seek(s.poster)
  demo.ready = true
  // With its size (16:10, as authored): the coach makes its frame that size and scales the frame, not the stage, so a
  // drag's client px are the stage's own (the app divides them by its zoom only).
  tell('ready', { size: s.size })
  // Opened on its own (a check, a look by hand): it plays; in the coach's frame the coach says when.
  if (window.parent === window && !useMotion.getState().reduced) play()
}

onLoop(() => {
  window.__demo.loops += 1
  tell('loop')
})
Object.assign(window.__demo, {
  seek: (t: number) => seek(t),
  play: () => play(),
  pause: () => pause(),
})

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.source !== window.parent) return
  const m = e.data as { ns?: string; type?: string; t?: number; scene?: string; theme?: string; reduced?: boolean }
  if (!m || m.ns !== NS) return
  if (m.type === 'play') play()
  else if (m.type === 'pause') pause()
  else if (m.type === 'seek' && typeof m.t === 'number') void seek(m.t)
  else if (m.type === 'poster' && shown) void seek(shown.poster)
  else if (m.type === 'theme' && (m.theme === 'dark' || m.theme === 'light')) useTheme.setState({ theme: m.theme })
  else if (m.type === 'motion' && typeof m.reduced === 'boolean') {
    useMotion.setState({ reduced: m.reduced })
    if (m.reduced && shown) void seek(shown.poster)
  } else if (m.type === 'scene' && typeof m.scene === 'string') void show(m.scene)
})

void show(new URLSearchParams(location.hash.slice(1)).get('scene') ?? 'canvas-fit')

// Dev only: the stores, for checks by hand.
if (import.meta.env.DEV) (window as unknown as { __demoStores: unknown }).__demoStores = { useCanvasView, useKanbanUi }
