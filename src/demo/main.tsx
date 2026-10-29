// The onboarding's demo realm (D-315, docs/specs/onboarding.md §6.1–6.2): its own page (demo.html), shown in a sealed
// frame, so the real components run on their own copy of every store and nothing leaks into the app. No Firebase at
// all (demo.html sets the flag src/data/firebase.ts reads); theme and motion from the same browser storage as the app;
// every write refused; the scene from the hash (`#scene=plane-drag`).
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/global.css'
import '../state/theme'
import { setReadOnly } from '../data/history'
import { useCurtain } from '../state/curtain'
import { useMotion } from '../state/motion'
import { useTheme } from '../state/theme'
import { POSTER, SCENES, Stage } from './Stage'

// Anything that slips through to a write is refused (the toast that would say so isn't mounted here).
setReadOnly('the demo writes nothing', 'demo')
// No curtain here: the stage is the page from the first frame, entrances play at once.
useCurtain.getState().setRevealed(true)

const scene = new URLSearchParams(location.hash.slice(1)).get('scene') ?? 'plane-drag'
window.__demo = { ready: false, t: 0, seek: () => {}, play: () => {} }

// A scene it doesn't know shows nothing and says so, rather than leaving the host waiting for `ready`.
if (SCENES.includes(scene))
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Stage scene={scene} />
    </StrictMode>,
  )
else window.__demo.error = `unknown scene: ${scene}`

// Talking to the coach (onboarding.md §6.2; src/onboarding/Demo.tsx): `{ ns, type }` messages from the same origin only.
// play, pause (held where it is), seek `t`, poster, scene (another scene: the frame reloads on it), theme, motion; back:
// ready once the scene is drawn, loop at each loop's end, error. Theme and motion change this frame's stores only
// (nothing written to the browser's storage: the app's own choice is the one kept).
const NS = 'north-star-demo'
// Whether the clock runs (a loop's end is told only then) and where it was last frame.
let running = !useMotion.getState().reduced
let last = 0
const tell = (type: string, extra: Record<string, unknown> = {}) => {
  if (window.parent !== window) window.parent.postMessage({ ns: NS, type, ...extra }, location.origin)
}
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.source !== window.parent) return
  const m = e.data as { ns?: string; type?: string; t?: number; scene?: string; theme?: string; reduced?: boolean }
  if (!m || m.ns !== NS) return
  const demo = window.__demo
  if (m.type === 'play') {
    running = !useMotion.getState().reduced
    last = demo.t
    demo.play()
  } else if (m.type === 'pause') {
    running = false
    demo.seek(demo.t)
  } else if (m.type === 'seek' && typeof m.t === 'number') {
    running = false
    demo.seek(m.t)
  } else if (m.type === 'poster') {
    running = false
    demo.seek(POSTER)
  }
  else if (m.type === 'theme' && (m.theme === 'dark' || m.theme === 'light')) useTheme.setState({ theme: m.theme })
  else if (m.type === 'motion' && typeof m.reduced === 'boolean') useMotion.setState({ reduced: m.reduced })
  else if (m.type === 'scene' && typeof m.scene === 'string') {
    if (m.scene === scene) {
      demo.seek(0)
      last = 0
      running = !useMotion.getState().reduced
      demo.play()
      tell('ready')
    } else {
      location.hash = `scene=${encodeURIComponent(m.scene)}`
      location.reload()
    }
  }
})
// Ready, the loops and an error, watched on the frame's clock (the stage keeps `__demo` up to date).
if (window.__demo.error) tell('error', { error: window.__demo.error })
else {
  let said = false
  const watch = () => {
    const demo = window.__demo
    if (!said && demo.ready) {
      said = true
      tell('ready')
    }
    if (running && demo.t < last - 1000) tell('loop')
    last = demo.t
    requestAnimationFrame(watch)
  }
  requestAnimationFrame(watch)
}
