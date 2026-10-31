// The onboarding's surfaces in the gallery (D-324, gallery.md G3; D-315): the coach's parts drawn on their own with
// made-up data, as src/onboarding/devMount.tsx and devGuides.tsx force them in the app. Nothing reaches Firestore: the
// seen-state (useProgress) is never started here (no `startFor`), only reset and, for a state that needs it, patched.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { MenuPanel, type MenuEntry } from '../ui/Menu'
import { useProgress } from '../onboarding/progress'
import { useGuideRole } from '../onboarding/Guide'
import { KindGuide } from '../onboarding/KindGuide'
import { lessonById, type GuideLesson, type Role } from '../onboarding/lessons'
import { pagesFor, type Shown } from '../onboarding/queue'
import type { Audience } from '../onboarding/seenMerge'
import type { Fill } from '../onboarding/words'

// The names a lesson's words fill in (`{owner}`, `{peer}`, `{piece}`).
export const NAMES: Fill = { owner: 'You', peer: 'Ayla', piece: '01 Lunch' }
export const none = () => {}

type ProgressPatch = { seen?: Record<string, number>; armed?: string[]; tipsOff?: boolean }

// The onboarding's own stores back as the page loaded them (they aren't in src/demo/realm.ts' list), then the state's
// patch, before what's inside is drawn: no seen-state or role carried over from the example before.
export function Fresh({ progress, role = 'owner', children }: { progress?: ProgressPatch; role?: Role | null; children: ReactNode }) {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    useProgress.setState(useProgress.getInitialState(), true)
    useGuideRole.setState({ role })
    if (progress) useProgress.setState(progress)
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return ready ? <>{children}</> : null
}

// What the coach shows for a lesson (devMount.show's): its pages for this role and audience.
export function shown(id: string, o: { via?: 'event' | 'play'; done?: boolean; role?: Role; audience?: Audience; isNew?: boolean; kind?: string } = {}): Shown {
  const l = lessonById(id)
  if (!l) throw new Error(`no lesson ${id}`)
  const payload = o.kind ? { kind: o.kind } : {}
  return {
    lesson: l,
    pages: pagesFor(l, o.role ?? 'owner', o.audience ?? 'new', payload, () => true),
    payload,
    isNew: !!o.isNew,
    via: o.via ?? 'event',
    since: Date.now(),
    ...(o.done ? { doneAt: Date.now() } : {}),
  }
}

// Shown once the example's setup says so (a lesson placed by an anchor needs the anchor drawn first).
export const useShowNow = create<{ on: boolean }>(() => ({ on: false }))
export function WhenReady({ children }: { children: ReactNode }) {
  const on = useShowNow((s) => s.on)
  useLayoutEffect(() => () => useShowNow.setState({ on: false }), [])
  return on ? <>{children}</> : null
}

// The kind guide beside a `+` menu (devGuides.kind's): a prompt with the guide's rows, the row under the keys or the
// pointer followed as the coach does.
export function KindBeside({ where = 'canvas' as 'canvas' | 'plane' }) {
  const rows = (lessonById('kind-guide') as GuideLesson).rows.filter((r) => r.where === where || r.where === 'both')
  const items: MenuEntry[] = rows.map((r) => ({ key: r.key, label: r.label, onSelect: none }))
  const box = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [row, setRow] = useState<string | null>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const panel = box.current
      const list = panel?.querySelector<HTMLElement>('[role=menu]')
      if (panel && list) {
        const r = panel.getBoundingClientRect()
        setRect((o) => (o && o.left === r.left && o.top === r.top && o.width === r.width && o.height === r.height ? o : r))
        const at = (document.activeElement as HTMLElement | null)?.closest?.('[role^=menuitem]') as HTMLElement | null
        const hovered = list.querySelector<HTMLElement>('[role^=menuitem]:hover')
        const first = list.querySelector<HTMLElement>('[role^=menuitem][data-first]') ?? list.querySelector<HTMLElement>('[role^=menuitem]')
        const key = (hovered ?? at ?? first)?.dataset.key ?? null
        setRow((o) => (o === key ? o : key))
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <>
      <div ref={box} data-learn="plus-menu" style={{ width: 280, border: '1px solid var(--line-hover)', background: 'var(--bg)' }}>
        <MenuPanel items={items} ariaLabel="add" noun="kinds" onClose={none} />
      </div>
      {rect && <KindGuide menu={rect} row={row} where={where} onHide={none} />}
    </>
  )
}

// The box the workspaces page gives its empty state (Workspaces.tsx's `data-learn="workspaces-empty"`), for Choices.
export function EmptyBox({ children }: { children: (into: Element) => ReactNode }) {
  const [into, setInto] = useState<HTMLDivElement | null>(null)
  return (
    <div ref={setInto} data-learn="workspaces-empty" style={{ width: 640, minHeight: 200 }}>
      {into && children(into)}
    </div>
  )
}
