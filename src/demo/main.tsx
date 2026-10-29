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
import { SCENES, Stage } from './Stage'

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
