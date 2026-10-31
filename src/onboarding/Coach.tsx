// The coach (D-315, docs/specs/onboarding.md §5.1, §5.6): mounted once inside a workspace (and once on the workspaces
// page, where there's no workspace), it starts the seen-state, the events and the busy watch, runs the queue, and draws
// whatever is due: the welcome or what's new (a paged modal, z 40), a lesson (z 20, beside its anchor), a nudge, the
// teaching empty states, the kind guide beside the `+` menu (O5b's KindGuide) and the `?` guide (O5b's Guide).
// Everything portals to <body>; every surface stops presses from reaching the canvas.
//
// What the queue doesn't draw: the kind guide and the empty states. They never block anything else (a hint stays while
// its piece is empty; the kind guide lives as long as the `+` menu), so the coach keeps them itself, off the queue's one
// slot: the empty states from their triggers (and `doneWhen`, which marks them seen), the kind guide while its menu is on
// screen and it isn't hidden for good.
import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence } from 'motion/react'
import { useAuth } from '../data/auth'
import { usePresence } from '../data/presence'
import { useDoc } from '../data/hooks'
import type { Member } from '../data/model'
import { WorkspaceContext } from '../views/workspace/context'
import { useFind } from '../views/workspace/find'
import { toggleTasksSide, useTasksSide } from '../views/workspace/sideState'
import { useProgress } from './progress'
import { startEvents, stopEvents, onLearn, learn } from './events'
import { readBusy, startBusy } from './busy'
import { createQueue, matches, type LearnEvent, type Shown, type CloseHow } from './queue'
import { LESSONS, lessonById, type GuideLesson, type Lesson as LessonData, type LineLesson, type PagedLesson } from './lessons'
import { newest, releases, setReleases, type Release } from './releases'
import { fitsRole, planNews, roleHere, whoIs } from './audience'
import type { Audience } from './seenMerge'
import { fill, newsPages, plain, welcomePages, type Fill } from './words'
import { Pages, type PagesEnd } from './Pages'
import { Lesson } from './Lesson'
import { Nudge } from './Nudge'
import { EmptyHint } from './EmptyHint'
import { Choices } from './Choices'
import { KindGuide } from './KindGuide'
import { Guide, useGuideRole } from './Guide'

// Off the queue (see above).
const OFF_QUEUE = (l: LessonData) => l.format === 'guide' || l.format === 'empty'
const QUEUED = LESSONS.filter((l) => !OFF_QUEUE(l))
const HINTS = LESSONS.filter((l): l is LineLesson => l.format === 'empty')
const KIND_GUIDE = lessonById('kind-guide')!

// Done → next (onboarding.md §4.3): after a lesson goes, its break (320 ms) and 300 ms of nothing before the next.
const AFTER_MS = 320 + 300
const TICK_MS = 150
// Open menus and lists, over which no empty state draws.
const MENUS = '[data-learn="plus-menu"], [role="menu"], [role="listbox"]'
// The pointer resting on the side nav this long is `sidenav-rest`.
const REST_MS = 600

const editable = (el: Element | null) =>
  !!el && (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable)
const inFocus = () => new URLSearchParams(location.search).has('focus')

// What a piece kind is called on screen (never "kanban", D-301).
const KIND_WORDS: Record<string, string> = { kanban: 'deck' }

// Dev only: `?release=sample` (kept for the tab in sessionStorage, as the app drops the query on its way in) puts
// releases.sample.ts in place of the shipped list, for the what's-new flows and shots; `?release=off` takes it out.
// Production builds have no branch here: the sample is never in the app's chunks.
const DEV_RELEASE_KEY = 'north-star:dev-release'
const devRelease: Promise<void> | null = import.meta.env.DEV ? sampleIfAsked() : null
function sampleIfAsked(): Promise<void> | null {
  if (typeof location === 'undefined') return null
  const q = new URLSearchParams(location.search).get('release')
  try {
    if (q === 'sample') sessionStorage.setItem(DEV_RELEASE_KEY, 'sample')
    else if (q === 'off') sessionStorage.removeItem(DEV_RELEASE_KEY)
    if (sessionStorage.getItem(DEV_RELEASE_KEY) !== 'sample') return null
  } catch {
    if (q !== 'sample') return null
  }
  return import('./releases.sample').then((m) => setReleases(m.SAMPLE_RELEASES))
}

// The dev-only handle devMount.tsx drives (O5's shots; O6 has the real mount).
export type CoachDev = {
  force(s: Shown | null): void
  news(pages: Release[] | null): void
  hint(id: string | null): void
  guide(open: boolean): void
  kind(open: boolean): void
  // The real queue's surfaces hidden (only what's forced shows).
  quiet(on: boolean): void
}
export const coachDev: { current: CoachDev | null } = { current: null }

// The side nav's `?` (onboarding.md §4.6): opens (or closes) the guide as the key does, through the mounted coach.
const guideToggle: { current: (() => void) | null } = { current: null }
export const openGuide = () => guideToggle.current?.()

export function Coach() {
  const store = useContext(WorkspaceContext)
  const { user } = useAuth()
  const uid = user?.id ?? null
  const noop = () => () => {}
  const workspace = useSyncExternalStore(store?.subscribe ?? noop, () => store?.get().workspace ?? null)
  const piecesHere = useSyncExternalStore(store?.subscribe ?? noop, () => {
    const w = store?.get()
    return w ? w.pieces.filter((p) => (p.canvasId ?? 'main') === w.canvas || p.canvases?.includes(w.canvas)).length : 0
  })
  const peers = usePresence((s) => s.peers)

  // Who this person is to the onboarding, as decided at the first canvas-open (else what the seen-state says).
  const audience = useRef<Audience>('new')
  const role = workspace && uid ? roleHere(workspace, uid) : store ? null : 'owner'
  const roleRef = useRef(role)
  roleRef.current = role
  // The side nav's `?` dot counts only what `?` lists for this person here.
  useEffect(() => useGuideRole.setState({ role }), [role])

  const [pagesOpen, setPagesOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const guideOpenRef = useRef(false)
  guideOpenRef.current = guideOpen
  // Opened again from a played note's `‹ guide`: where it was.
  const [guideResume, setGuideResume] = useState(false)
  // Where focus was before `?` (or a note played from it): it goes back there when that's done.
  const returnTo = useRef<HTMLElement | null>(null)
  const restoreFocus = () => {
    const el = returnTo.current
    returnTo.current = null
    requestAnimationFrame(() => {
      if (el?.isConnected) el.focus({ preventScroll: true })
    })
  }
  // The showing lesson's way in (`?` then ↵): focus in its card.
  const reachRef = useRef<(() => void) | null>(null)
  const holdUntil = useRef(0)
  const modalRef = useRef(false)
  modalRef.current = pagesOpen || guideOpen

  // The seen-state for the signed-in person (before the events, so the queue can become ready).
  useEffect(() => {
    if (uid) useProgress.getState().startFor(uid)
    else void useProgress.getState().stop()
  }, [uid])

  // The events and the busy watch, while mounted (both count their starts).
  useEffect(() => {
    void startEvents()
    const offBusy = startBusy()
    return () => {
      stopEvents()
      offBusy()
    }
  }, [])

  const queue = useMemo(
    () =>
      createQueue({
        lessons: QUEUED,
        now: () => Date.now(),
        getBusy: () => readBusy({ modal: modalRef.current || Date.now() < holdUntil.current }),
        getProgress: () => useProgress.getState(),
        getRole: () => roleRef.current,
        getAudience: () => useProgress.getState().state?.audience ?? audience.current,
        isLoaded: () => useProgress.getState().loaded,
        pageIf: (c) => (c === 'has-tasks-button' ? !!document.querySelector('[data-learn="tasks"]') || hasDecks(store) : true),
        markSeen: (id, v) => useProgress.getState().markSeen(id, v),
        noteNudge: (at) => useProgress.getState().noteNudge(at),
      }),
    // One queue per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const queued = useSyncExternalStore(queue.subscribe, queue.current)
  const [forced, setForced] = useState<Shown | null>(null)
  const [quiet, setQuiet] = useState(false)
  const cur = forced ?? (quiet ? null : queued)

  // Ticks only while something waits or a `✓ done` is counting down (readBusy costs on a big canvas).
  useEffect(() => {
    const t = setInterval(() => {
      const c = queue.current()
      if (queue.queued().length > 0 || c?.doneAt !== undefined) queue.tick()
    }, TICK_MS)
    return () => clearInterval(t)
  }, [queue])

  // A surface gone: its break and a gap before the next one builds.
  const prevCur = useRef<Shown | null>(null)
  useEffect(() => {
    if (prevCur.current && !cur) holdUntil.current = Date.now() + AFTER_MS
    prevCur.current = cur
  }, [cur])

  // ── What's new, the welcome's start, the empty states ──────────────────────────────────────────────────────────────
  const [news, setNews] = useState<Release[] | null>(null)
  const newsRef = useRef(news)
  newsRef.current = news
  const [newsShowing, setNewsShowing] = useState(false)
  const [hints, setHints] = useState<Record<string, true>>({})
  const [kindOpen, setKindOpen] = useState(false)

  const decide = () => {
    // Dev only: the sample release loads first (its import), then this runs.
    if (devRelease) return void devRelease.then(decideNow)
    decideNow()
  }
  const decideNow = () => {
    const p = useProgress.getState()
    const w = store?.get()
    if (!uid || !w || newsRef.current) return
    const plan = planNews({ hasDoc: p.hadDoc || !!p.state, lastRelease: p.lastRelease, tipsOff: p.tipsOff }, releases(), (id) => lessonById(id)?.v)
    if (plan.kind === 'begin') {
      // New (or invited, or an old account with no doc): the welcome comes from the queue's own trigger; what's new
      // is all of today for them.
      const who = whoIs({ uid, hasDoc: false, firstWorkspace: { ownerId: w.workspace.ownerId, pieceCount: piecesNow(store) } })
      audience.current = who === 'invited' ? 'invited' : 'new'
      p.begin(audience.current, plan.lastRelease)
      return
    }
    if (p.state?.audience) audience.current = p.state.audience
    if (plan.kind === 'set') return p.setLastRelease(plan.lastRelease)
    if (plan.kind === 'none') return
    // Armed now: their lessons show on first use as NEW (and in `?`, its dot on), whatever happens to the modal.
    if (plan.arm.length) p.arm(plan.arm)
    // Tips off: no modal; given all the same (the dot says there's something new).
    if (!plan.modal) return p.setLastRelease(plan.lastRelease)
    setNews(plan.releases)
  }

  useEffect(() => {
    const onEvent = (e: LearnEvent) => {
      if (e.event === 'canvas-open') {
        if (useProgress.getState().loaded) decide()
        else {
          const off = useProgress.subscribe((s) => {
            if (!s.loaded) return
            off()
            decide()
          })
        }
      }
      // The empty states: shown by their trigger (for this person, unseen, tips on), gone (and seen) when done.
      const p = useProgress.getState()
      // Marked seen here, not in the state's updater: React runs updaters while rendering, and a store write there
      // redraws other components mid-render (GuideButton's dot).
      for (const l of HINTS) if (l.doneWhen?.some((t) => matches(t, e)) && (p.seen[l.id] ?? 0) < l.v) p.markSeen(l.id, l.v)
      setHints((h) => {
        let next = h
        for (const l of HINTS) {
          if (l.doneWhen?.some((t) => matches(t, e))) {
            if (next[l.id]) {
              next = { ...next }
              delete next[l.id]
            }
            continue
          }
          if (l.trigger.some((t) => matches(t, e)) && !next[l.id] && (p.seen[l.id] ?? 0) < l.v && !p.tipsOff && fitsRole(l.roles, roleRef.current))
            next = { ...next, [l.id]: true }
        }
        // A plane's or timeline's hint lasts while its focus does.
        if (e.event === 'focus-out' && (next['empty-plane'] || next['empty-timeline'])) {
          next = { ...next }
          delete next['empty-plane']
          delete next['empty-timeline']
        }
        return next
      })
      // The kind guide: watched while the `+` menu is up.
      if (e.event === 'plus-open') setKindOpen(true)
      queue.onEvent(e)
    }
    return onLearn(onEvent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, uid, store])

  // The empty canvas's hint goes with the first piece, however it came.
  useEffect(() => {
    if (piecesHere > 0 && hints['empty-canvas'])
      setHints((h) => {
        const n = { ...h }
        delete n['empty-canvas']
        return n
      })
  }, [piecesHere, hints])

  // What's new waits for a free moment on the canvas: no focus, nothing busy, nothing else of the coach's. A welcome
  // still due (a doc whose `welcome` was never ended, after a release) goes first: queued, it hasn't taken the slot yet
  // in its calm, so `cur` alone would let what's new in ahead of it; what's new then follows once it's closed.
  useEffect(() => {
    if (!news || newsShowing) return
    const t = setInterval(() => {
      const b = readBusy()
      const welcomeWaits = queue.current()?.lesson.id === 'welcome' || queue.queued().includes('welcome')
      if (!cur && !welcomeWaits && !inFocus() && !guideOpenRef.current && !Object.values(b).some(Boolean)) setNewsShowing(true)
    }, 500)
    return () => clearInterval(t)
  }, [news, newsShowing, cur, queue])

  useEffect(() => setPagesOpen(cur?.lesson.format === 'welcome' || cur?.via === 'play' || newsShowing), [cur, newsShowing])

  // ── `?`, and the side nav's rest ───────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      if (editable(document.activeElement) || editable(e.target as Element)) return
      e.preventDefault()
      toggle()
    }
    const toggle = () => {
      if (guideOpenRef.current) {
        setGuideOpen(false)
        restoreFocus()
        return
      }
      returnTo.current = document.activeElement as HTMLElement | null
      setGuideResume(false)
      setGuideOpen(true)
      learn('guide-open')
    }
    guideToggle.current = toggle
    let timer: ReturnType<typeof setTimeout> | undefined
    let on = false
    const onMove = (e: PointerEvent) => {
      const over = !!(e.target as Element | null)?.closest?.('[data-learn="sidenav"]')
      if (over === on) return
      on = over
      clearTimeout(timer)
      if (over) timer = setTimeout(() => learn('sidenav-rest'), REST_MS)
    }
    addEventListener('keydown', onKey)
    addEventListener('pointermove', onMove, { passive: true })
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('pointermove', onMove)
      clearTimeout(timer)
      if (guideToggle.current === toggle) guideToggle.current = null
    }
  }, [])

  // `esc` closes a lesson showing beside something first, and only it: when nothing is typed (outside the lesson) and
  // nothing over the canvas (a menu, the finder, a dialog) would take the `esc` itself. Capture on the window, so the
  // canvas's own `esc` (unfocus, deselect) never also hears it.
  const curRef = useRef<Shown | null>(null)
  curRef.current = cur
  const anchored = !!cur && cur.lesson.format === 'lesson' && cur.via !== 'play' && cur.doneAt === undefined
  useEffect(() => {
    if (!anchored) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const active = document.activeElement
      const inCoach = !!active?.closest?.('[data-coach]')
      if (!inCoach && editable(active)) return
      if (guideOpenRef.current || modalRef.current) return
      if (useFind.getState().open || document.querySelector('[aria-modal="true"], dialog[open], [role="alertdialog"], [role="menu"], [role="listbox"]')) return
      const c = curRef.current
      if (!c) return
      e.preventDefault()
      e.stopImmediatePropagation()
      closeRef.current('closed')
    }
    addEventListener('keydown', onEsc, true)
    return () => removeEventListener('keydown', onEsc, true)
  }, [anchored])

  // ── The kind guide's menu and row ──────────────────────────────────────────────────────────────────────────────────
  // Whether it shows is decided once, when the `+` menu opens, and holds until the menu closes (so `[hide guide]`'s
  // `guide hidden · ? brings it back` line stays). `?`'s kind-guide row brings it back on the next `+` (this tab).
  const [menu, setMenu] = useState<{ rect: DOMRect; row: string | null } | null>(null)
  const kindAgain = useRef(false)
  const kindDueNow = () => {
    const p = useProgress.getState()
    return !p.tipsOff && fitsRole(KIND_GUIDE.roles, roleRef.current) && ((p.seen[KIND_GUIDE.id] ?? 0) < KIND_GUIDE.v || kindAgain.current)
  }
  useEffect(() => {
    if (!kindOpen || !kindDueNow()) {
      setMenu(null)
      if (kindOpen) setKindOpen(false)
      return
    }
    let hovered: string | null = null
    const over = (e: PointerEvent) => {
      const row = (e.target as Element | null)?.closest?.('[data-learn="plus-menu"] [data-key]') as HTMLElement | null
      if (row) hovered = row.dataset.key ?? null
    }
    addEventListener('pointerover', over, { passive: true })
    let misses = 0
    let seenMenu = false
    // Polled: the menu's rect follows it as its panel grows or scrolls, its row as the pointer or the keys move.
    const t = setInterval(() => {
      const el = document.querySelector<HTMLElement>('[data-learn="plus-menu"]')
      if (!el) {
        // The menu is gone (or never came): the guide goes with it.
        if (seenMenu || ++misses > 10) {
          setKindOpen(false)
          setMenu(null)
        }
        return
      }
      seenMenu = true
      const active = document.activeElement as HTMLElement | null
      const keyed = active && el.contains(active) ? active.dataset.key : undefined
      const first = el.querySelector<HTMLElement>('[data-first][data-key]')?.dataset.key
      const rect = el.getBoundingClientRect()
      const row = keyed ?? hovered ?? first ?? null
      setMenu((m) => (m && m.row === row && m.rect.x === rect.x && m.rect.y === rect.y && m.rect.width === rect.width && m.rect.height === rect.height ? m : { rect, row }))
    }, 100)
    return () => {
      clearInterval(t)
      removeEventListener('pointerover', over)
    }
    // Decided once per opening.
  }, [kindOpen])

  // The workspace's maker's name, for the invited welcome (`{owner} started this workspace`): from the people list
  // (members/{uid}), read only for an invited person in someone else's workspace; else from who's here.
  // Listened to only while the welcome waits or shows.
  const invited = useProgress((s) => s.state?.audience) === 'invited'
  const ownerId = workspace?.ownerId
  const welcomeDue = cur?.lesson.id === 'welcome' || queued?.lesson.id === 'welcome' || queue.queued().includes('welcome')
  const ownerDoc = useDoc<Member>(invited && welcomeDue && store && ownerId && ownerId !== uid ? `workspaces/${store.get().wid}/members/${ownerId}` : null).data

  // ── Names and handlers ─────────────────────────────────────────────────────────────────────────────────────────────
  const names: Fill = useMemo(() => {
    const owner = ownerDoc?.name || peers.find((p) => p.uid === ownerId)?.name || (ownerId && ownerId === uid ? (user?.name ?? undefined) : undefined)
    const peer = peers.find((p) => p.uid !== uid)?.name
    const kind = cur?.payload.kind as string | undefined
    return { owner: owner?.split(' ')[0], peer: peer?.split(' ')[0], piece: kind ? (KIND_WORDS[kind] ?? kind) : undefined }
  }, [ownerId, ownerDoc, peers, uid, user, cur])

  const close = (how: CloseHow, toGuide = false) => {
    if (!cur) return
    if (forced) {
      setForced(null)
      // The kind guide played from `?` (its rows as pages, off the queue): seen once closed, like any played note.
      if (cur.via === 'play' && cur.lesson.id === KIND_GUIDE.id) useProgress.getState().markSeen(KIND_GUIDE.id, KIND_GUIDE.v)
    } else queue.close(cur.lesson.id, how)
    // A note played from `?` gives focus back to where it was before the guide (unless it goes back to the guide).
    if (cur.via === 'play' && !toGuide) restoreFocus()
  }
  const closeRef = useRef(close)
  closeRef.current = close
  const endWelcome = ({ how }: PagesEnd) => {
    if (!cur) return
    if (!forced) useProgress.getState().setWelcome(how === 'skipped' ? 'skipped' : 'done')
    close(how === 'skipped' ? 'skipped' : 'done')
  }
  const endNews = ({ go }: PagesEnd) => {
    setNewsShowing(false)
    setNews(null)
    useProgress.getState().setLastRelease(newest())
    // Opened, never closed (the side view may already be open).
    if (go === 'side-view') void (!useTasksSide.getState().open && toggleTasksSide())
    else if (go === 'finder') useFind.setState({ open: true })
    else if (go === 'guide') setGuideOpen(true)
    else if (go === 'crumb-prompt') document.querySelector<HTMLElement>('[data-learn="crumb"]')?.click()
    if (returnTo.current && go !== 'guide') restoreFocus()
  }
  const play = (id: string) => {
    setGuideOpen(false)
    if (id === 'whats-new') {
      // Replayed from `?`: the newest release's changes, if it has any.
      const latest = releases().slice(0, 1)
      if (newsPages(latest).length) {
        setNews(latest)
        setNewsShowing(true)
      }
      return
    }
    if (id === 'kind-guide') {
      // Its rows as pages in the middle (the kinds the `+` here has), and it shows again beside the next `+`.
      kindAgain.current = true
      const where = inFocus() ? 'plane' : 'canvas'
      const rows = (KIND_GUIDE as GuideLesson).rows.filter((r) => r.where === where || r.where === 'both')
      const pages = rows.map((r) => {
        const t = r.label.replace(/…$/, '')
        return { title: t[0].toUpperCase() + t.slice(1), body: r.lines.join(' '), scene: r.scene }
      })
      const lesson: PagedLesson = { ...(KIND_GUIDE as GuideLesson), format: 'lesson', pages }
      setForced({ lesson, pages, payload: {}, isNew: false, via: 'play', since: Date.now() })
      return
    }
    queue.play(id)
  }
  const backToGuide = () => {
    close('closed', true)
    setGuideResume(true)
    setGuideOpen(true)
  }
  const closeGuide = () => {
    setGuideOpen(false)
    restoreFocus()
  }
  // `?` then ↵ on `# showing now`: the guide closes and focus goes into the lesson's card.
  const reach = () => {
    setGuideOpen(false)
    returnTo.current = null
    requestAnimationFrame(() => reachRef.current?.())
  }
  const now =
    anchored && cur && cur.lesson.format === 'lesson' && cur.pages[0] ? { title: plain(fill(cur.pages[0].title, names)) } : null

  // Dev only: devMount.tsx forces any surface (the shots), O6 mounts this for real.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    coachDev.current = {
      force: setForced,
      news: (r) => {
        setNews(r)
        setNewsShowing(!!r)
      },
      hint: (id) => setHints(id ? { [id]: true } : {}),
      guide: setGuideOpen,
      kind: setKindOpen,
      quiet: setQuiet,
    }
    return () => {
      coachDev.current = null
    }
  }, [])

  // A menu or list open (the `+` with its kind guide, a right-click, a Select): the empty states step aside meanwhile.
  const anyHint = Object.keys(hints).length > 0
  const [menuUp, setMenuUp] = useState(false)
  useEffect(() => {
    if (!anyHint) return setMenuUp(false)
    const t = setInterval(() => setMenuUp(!!document.querySelector(MENUS)), 150)
    return () => clearInterval(t)
  }, [anyHint])
  const welcomeQueued = cur?.lesson.id === 'welcome' || queue.queued().includes('welcome')
  const hintIds = menuUp || menu ? [] : Object.keys(hints).filter((id) => !(id === 'empty-canvas' && (welcomeQueued || newsShowing || piecesHere > 0)))

  return (
    <>
      <AnimatePresence>
        {cur?.lesson.format === 'welcome' && (
          <Pages key={`welcome-${cur.since}`} kind="welcome" pages={welcomePages(cur.pages, role, names)} onEnd={endWelcome} />
        )}
        {cur?.lesson.format === 'lesson' && (
          <Lesson
            key={`${cur.lesson.id}-${cur.since}`}
            shown={cur}
            names={names}
            onClose={close}
            onTipsOff={() => useProgress.getState().setTipsOff(true)}
            onGuide={cur.via === 'play' ? backToGuide : undefined}
            reachRef={reachRef}
          />
        )}
        {cur?.lesson.format === 'nudge' && cur.doneAt === undefined && (
          <Nudge key={`${cur.lesson.id}-${cur.since}`} line={(cur.lesson as LineLesson).line ?? ''} anchor={cur.lesson.anchor} names={names} onClose={() => close('closed')} />
        )}
        {news && newsShowing && <Pages key="news" kind="news" pages={newsPages(news, (a) => a !== 'side-view' || hasDecks(store))} onEnd={endNews} />}
        {hintIds.map((id) => {
          const l = HINTS.find((h) => h.id === id)
          // Framed choices go into their anchor on the page (the workspaces page's empty box), in place of its line.
          if (l?.choices && l.anchor) {
            const into = document.querySelector(`[data-learn="${l.anchor}"]`)
            return into ? <Choices key={id} into={into} choices={l.choices} /> : null
          }
          if (!l?.line) return null
          return <EmptyHint key={id} line={l.line} toward={id === 'empty-canvas' ? 'plus' : undefined} anchor={id === 'empty-timeline' ? 'piece' : undefined} />
        })}
      </AnimatePresence>
      {guideOpen && <Guide role={role} onClose={closeGuide} onPlay={play} now={now} onReach={reach} resume={guideResume} />}
      {menu && (
        <KindGuide
          menu={menu.rect}
          row={menu.row}
          where={inFocus() ? 'plane' : 'canvas'}
          onHide={() => {
            kindAgain.current = false
            useProgress.getState().markSeen(KIND_GUIDE.id, KIND_GUIDE.v)
          }}
        />
      )}
    </>
  )
}

function piecesNow(store: React.ContextType<typeof WorkspaceContext>): number {
  const w = store?.get()
  return w ? w.pieces.filter((p) => (p.canvasId ?? 'main') === w.canvas || p.canvases?.includes(w.canvas)).length : 0
}

function hasDecks(store: React.ContextType<typeof WorkspaceContext>): boolean {
  const w = store?.get()
  return !!w?.pieces.some((p) => (p.kind === 'kanban' || p.kind === 'timeline') && ((p.canvasId ?? 'main') === w.canvas || p.canvases?.includes(w.canvas)))
}
