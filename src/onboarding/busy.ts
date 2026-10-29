// What's going on right now, for the onboarding's queue (D-315, docs/specs/onboarding.md §3.1, §5.4), read from the
// app's own stores and the page, never from new calls in views; and the real stores events.ts watches (`realSources`).
// Browser only (it reads `document`): queue.ts and events.ts stay testable in node, this is their wiring.
import { useCurtain } from '../state/curtain'
import { useCanvasView } from '../state/canvasView'
import { getWs, subscribeWs } from '../state/wsStore'
import { onTracked, useHistory } from '../data/history'
import { usePresence } from '../data/presence'
import { firebase } from '../data/firebase'
import { timelineKanbans } from '../data/tasks'
import { useTasksSide } from '../views/workspace/sideState'
import { useFind } from '../views/workspace/find'
import { useThreadView } from '../views/workspace/Threads'
import { usePlaneFilter } from '../views/workspace/planeFilter'
import { useShelf } from '../views/workspace/FilterDock'
import { useMatrixUi } from '../views/workspace/Matrix'
import { useTableUi } from '../views/workspace/Table'
import { useKanbanUi } from '../views/workspace/Kanban'
import { useDocUi } from '../views/workspace/Documents'
import { useProgress } from './progress'
import type { PieceLike, Sources, StoreLike, WsLike, CanvasViewLike, HistoryLike } from './events'
import type { Busy } from './queue'

// A press that moved this far is a drag (a pan, a piece, a card, a task between columns, a box).
const DRAG_PX = 4
// The camera moved this recently: it's gliding (a fit, the finder going somewhere, a wheel).
const GLIDE_MS = 200

let pressed: { x: number; y: number } | null = null
let dragging = false
let camAt = -Infinity
let started = 0
let offs: Array<() => void> = []

// The page's listeners the busy state needs (a press moving, the camera moving). Counted: start/stop pair up.
export function startBusy(): () => void {
  if (started++ === 0 && typeof window !== 'undefined') {
    const down = (e: PointerEvent) => {
      pressed = { x: e.clientX, y: e.clientY }
      dragging = false
    }
    const move = (e: PointerEvent) => {
      if (pressed && !dragging && Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > DRAG_PX) dragging = true
    }
    const up = () => {
      pressed = null
      dragging = false
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointermove', move, { capture: true, passive: true })
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    window.addEventListener('blur', up)
    const unCam = useCanvasView.subscribe((n, p) => {
      if (n.cams !== p.cams || n.planeCam !== p.planeCam) camAt = performance.now()
    })
    offs = [
      () => window.removeEventListener('pointerdown', down, true),
      () => window.removeEventListener('pointermove', move, true),
      () => window.removeEventListener('pointerup', up, true),
      () => window.removeEventListener('pointercancel', up, true),
      () => window.removeEventListener('blur', up),
      unCam,
    ]
  }
  let done = false
  return () => {
    if (done) return
    done = true
    if (--started === 0) {
      for (const off of offs) off()
      offs = []
    }
  }
}

const editable = (el: Element | null) =>
  !!el && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'range', 'submit'].includes(el.type)) || (el as HTMLElement).isContentEditable)

export const settingsPage = (): string | null => {
  const d = document.querySelector('dialog[open][aria-label="Settings"]')
  if (!d) return null
  return d.querySelector('[aria-current="page"] span')?.textContent?.trim().toLowerCase() || 'account'
}
// A prompt or a Select's list (D-222).
export const menuOpen = () => !!document.querySelector('[role="menu"], [role="listbox"]')

// Every busy source as it is now (polled by the coach, and on change). `extra`: the coach's own (`modal`).
export function readBusy(extra: Busy = {}): Busy {
  const cv = useCanvasView.getState()
  const threads = useThreadView.getState()
  const matrix = useMatrixUi.getState()
  return {
    // Not `landing` or `cardsLive`: those hold things where they were let go until their data's back, and can stay
    // behind when what they held unmounts first.
    drag: dragging || !!cv.dragShift || !!cv.linking || !!cv.stickHint || Object.keys(cv.following).length > 0,
    focusMoving: (cv.focusSpread && !cv.focusArrived) || cv.focusLeaving,
    typing: editable(document.activeElement),
    menu: menuOpen() || !!cv.bringing || !!cv.toCanvas,
    wizard: matrix.wizard || useTableUi.getState().wizard || useKanbanUi.getState().wizard,
    setup: !!matrix.setup || !!useTableUi.getState().setup || !!useKanbanUi.getState().setup,
    hazard: !!cv.confirming || !!cv.deleting || !!document.querySelector('[role="alertdialog"]'),
    settings: settingsPage() !== null,
    finder: useFind.getState().open,
    threads: threads.inbox || !!threads.openId || !!threads.draft,
    following: !!usePresence.getState().following,
    gliding: performance.now() - camAt < GLIDE_MS,
    curtainHidden: !useCurtain.getState().revealed,
    ...extra,
  }
}

// The workspace store as events.ts reads it (it hands the previous value itself).
const wsSource = { get: () => getWs() as unknown as WsLike | null, subscribe: subscribeWs }

const every = (ms: number, fn: () => void) => {
  const t = setInterval(fn, ms)
  return () => clearInterval(t)
}

// The real stores, for events.ts' startEvents().
export function realSources(): Sources {
  const input = (fn: () => void) => {
    const kinds = ['pointerdown', 'keydown', 'wheel', 'pointermove'] as const
    for (const k of kinds) window.addEventListener(k, fn, { capture: true, passive: true })
    return () => kinds.forEach((k) => window.removeEventListener(k, fn, true))
  }
  const pop = (fn: () => void) => {
    window.addEventListener('popstate', fn)
    return () => window.removeEventListener('popstate', fn)
  }
  return {
    canvasView: useCanvasView as unknown as StoreLike<CanvasViewLike>,
    curtain: useCurtain,
    ws: wsSource,
    history: useHistory as unknown as StoreLike<HistoryLike>,
    onTracked,
    side: useTasksSide,
    presence: usePresence,
    find: useFind,
    threads: useThreadView,
    planeFilter: usePlaneFilter as unknown as Sources['planeFilter'],
    shelf: useShelf,
    matrixUi: useMatrixUi,
    tableUi: useTableUi,
    kanbanUi: useKanbanUi,
    docUi: useDocUi,
    search: () => location.search,
    onPopState: pop,
    settingsPage,
    menuOpen,
    onInput: input,
    uid: () => firebase?.auth.currentUser?.uid ?? '',
    seenCount: () => Object.keys(useProgress.getState().seen).length,
    progressLoaded: () => useProgress.getState().loaded,
    firstCanvas: () => {
      const p = useProgress.getState()
      return !p.welcome && !p.seen.welcome
    },
    timelineDecks: (t: PieceLike, pieces: PieceLike[]) => timelineKanbans(t, pieces).map((p) => p.id),
    now: () => Date.now(),
    every,
  }
}
