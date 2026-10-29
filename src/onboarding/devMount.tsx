// Dev only (O5's shots, never imported by the app): renders the coach into the running app, sharing its module stores
// and its workspace store, and forces any surface in any look. From the page:
//   const m = await import('/src/onboarding/devMount.tsx'); m.mount(); m.show('lesson', 'focus-plane', 'b')
// O6 mounts <Coach /> for real (WorkspaceLayout, the workspaces page).
import { createRoot, type Root } from 'react-dom/client'
import { activeStore } from '../state/wsStore'
import { WorkspaceContext } from '../views/workspace/context'
import { Coach, coachDev } from './Coach'
import { lessonById, type Role } from './lessons'
import { pagesFor, type Shown } from './queue'
import { SAMPLE_RELEASES } from './releases.sample'
import type { Look } from './looks'
import type { Audience } from './seenMerge'

let root: Root | null = null
let host: HTMLDivElement | null = null

export function mount() {
  if (root) return
  host = document.createElement('div')
  host.dataset.devCoach = ''
  document.body.appendChild(host)
  root = createRoot(host)
  root.render(
    <WorkspaceContext.Provider value={activeStore()}>
      <Coach />
    </WorkspaceContext.Provider>,
  )
}

export function unmount() {
  root?.unmount()
  host?.remove()
  root = null
  host = null
}

type Opts = { via?: 'event' | 'play'; done?: boolean; role?: Role; audience?: Audience; isNew?: boolean; kind?: string }
type Kind = 'welcome' | 'news' | 'lesson' | 'nudge' | 'empty' | 'guide' | 'kind' | 'clear'

const frameOf = (k: Kind) => (k === 'welcome' || k === 'news' ? 'welcome' : k === 'guide' ? 'guide' : k === 'kind' ? 'kind' : 'lesson')

export function show(kind: Kind, id = '', look: Look = 'a', o: Opts = {}) {
  const dev = coachDev.current
  if (!dev) throw new Error('mount() first')
  ;(window as unknown as { __onboardingLook: Record<string, Look> }).__onboardingLook = { [frameOf(kind)]: look }
  dev.quiet(true)
  dev.force(null)
  dev.news(null)
  dev.hint(null)
  dev.guide(false)
  if (kind === 'clear') return
  if (kind === 'news') return dev.news(SAMPLE_RELEASES as never)
  if (kind === 'empty') return dev.hint(id || 'empty-canvas')
  if (kind === 'guide') return dev.guide(true)
  if (kind === 'kind') return dev.kind(true)
  const l = lessonById(kind === 'welcome' ? 'welcome' : id)
  if (!l) throw new Error(`no lesson ${id}`)
  const payload = o.kind ? { kind: o.kind } : {}
  const s: Shown = {
    lesson: l,
    pages: pagesFor(l, o.role ?? 'owner', o.audience ?? 'new', payload, () => true),
    payload,
    isNew: !!o.isNew,
    via: o.via ?? 'event',
    since: Date.now(),
    ...(o.done ? { doneAt: Date.now() } : {}),
  }
  dev.force(s)
}
