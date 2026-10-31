// The component gallery's entry (D-324, docs/specs/gallery.md): dev only, gallery.html. No Firebase (gallery.html sets
// the demo flag), storage in memory, every write refused and counted; the app's own CSS, with `:hover` also matching
// `[data-demo-hover]` (demoCss.ts) so a state can hold one.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/global.css'
import '../state/theme'
import { setReadOnly } from '../data/history'
import { useCurtain } from '../state/curtain'
import { watchDemoCss } from '../demo/demoCss'
import { Gallery, countRefused } from './Gallery'
import { ENTRIES, stateSlug } from './registry'

if (!import.meta.env.DEV) throw new Error('the gallery is dev only (D-324)')

watchDemoCss()
setReadOnly('the gallery writes nothing', 'gallery')
// No curtain: entrances play at once, as in the demo.
useCurtain.getState().setRevealed(true)

// A write a handler tried fails on the missing Firebase or the read-only lock: counted (the bar says how many), not an
// error, since refusing it is the point.
const REFUSED = /Firebase is not configured|the gallery writes nothing|writes nothing/
const refused = (e: { preventDefault: () => void }, message: string) => {
  if (!REFUSED.test(message)) return
  e.preventDefault()
  countRefused()
}
window.addEventListener('unhandledrejection', (e) => refused(e, String((e.reason as Error)?.message ?? e.reason)))
window.addEventListener('error', (e) => refused(e, String(e.message)))

// For scripts (shots, checks by hand): every example and its states' addresses.
;(window as unknown as { __gallery: unknown }).__gallery = ENTRIES.map((e) => ({ c: e.id, states: Object.keys(e.states).map(stateSlug) }))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
)
