// A live demo in the coach (D-315, docs/specs/onboarding.md §6.2): the demo realm (demo.html, the real components on
// made-up data) in a sealed frame, 16:10, the frame made the scene's own authored size (it says it in `ready`) and the
// frame scaled into its slot, never the stage inside it (a scaled stage moves every drag too far: the app divides client
// px by its zoom only); under it, never on it, a strip
// with what it is (`▸ LIVE DEMO · <scene>`) and its `[❚❚]` / `[▶ play]`. It plays 3 loops, then rests on its poster;
// reduced motion: the poster, still. The frame is `inert` and hidden from screen readers: the caption is the text.
// Talking to the frame: postMessage `{ ns, type: play | pause | seek | poster | scene | theme | motion }` there, and
// `{ ns, type: ready | loop | error }` back (src/demo/main.tsx). One frame per mounted Demo, kept across scene changes
// (a page turn in the welcome sends `scene`, it doesn't make a new frame).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMotion } from '../state/motion'
import { useTheme } from '../state/theme'
import { useCanvasView } from '../state/canvasView'
import styles from './Demo.module.css'
import { DEMO_NS, STAGE, canMove, giveBack, lend, setFrameClass, setSrcBase, type Pool } from './demoPool'

export { DEMO_NS, STAGE, preloadDemo, disposeDemoPool } from './demoPool'
const LOOPS = 3

// The scenes demo.html can play today (src/demo/sceneList.ts). Every other id plays `plane-drag` for now (a
// placeholder until its scene is written); the strip still names the scene that was asked for. Kept here, not imported
// from src/demo/, so the app's bundle never pulls the stage in.
const BUILT = ['plane-drag', 'canvas-fit', 'sidenav-plus', 'deck-drag', 'pieces-tour', 'plus-adds-plane', 'finder-go', 'peers-comment']
// O9: the kind guide's rows and the `+` and pieces lessons (onboarding-lessons.md §2).
BUILT.push('kind-plane', 'kind-matrix', 'kind-table', 'kind-documents', 'kind-deck', 'kind-timeline', 'kind-heading', 'kind-paragraph', 'kind-sticky', 'kind-section', 'kind-title', 'card-customer', 'card-problem', 'card-competitor', 'card-idea', 'card-feature', 'kind-package', 'kind-existing', 'edit-move-resize', 'edit-done', 'console-appear', 'focus-ink', 'plane-inside', 'lens-focus', 'unframe', 'unframed-live', 'stick', 'stick-follow', 'beside', 'beside-pick', 'canvases-share')
// O10: planes and cards (onboarding-lessons.md §3).
BUILT.push('link-draw', 'card-make-name', 'card-panel', 'evidence', 'link-bar', 'for-filter', 'plane-filter', 'multi-select', 'package', 'shared-card', 'competitor-features', 'parts', 'guides', 'prompt-type')
// O11: text, matrix and table (onboarding-lessons.md §4, §5).
BUILT.push('text-edit', 'sticky', 'section', 'finder-heading', 'matrix-wizard', 'matrix-keys', 'matrix-sure', 'criteria', 'table-rules', 'table-keys', 'table-setup')
// O12: documents, decks and days (onboarding-lessons.md §6, §7).
BUILT.push('deck-kinds', 'deck-filter', 'task-panel', 'task-learned', 'card-deck', 'priorities', 'side-view', 'side-mine', 'timeline-scroll', 'timeline-draw', 'doc-beside', 'documents', 'doc-place', 'deck-add')
// O13: the side nav's pages, together, canvases (onboarding-lessons.md §1, §8, §9).
BUILT.push('sidenav-fit', 'sidenav-find', 'sidenav-side', 'peers-cursors', 'follow', 'thread', 'threads-panel', 'canvases')
export const playable = (scene: string) => (BUILT.includes(scene) ? scene : 'plane-drag')

type Msg = { ns: typeof DEMO_NS; type: string; [k: string]: unknown }

// The one frame lent to every demo: demoPool.ts. Demo.module.css' look and the app's base for it.
setFrameClass(styles.frame)
setSrcBase(import.meta.env.BASE_URL)

// The canvas moving (a pan, a zoom, a glide, a drag): a playing demo holds still meanwhile and goes on this long after,
// so its frames (a loop's seam and rebuild) never land in the middle of the canvas's.
const RESUME_MS = 300
const DRAG_PX = 4
// A drag whose end never came (the pointer let go outside the window, a lost capture): the demo goes on after this.
const HOLD_CAP_MS = 5000

// `compact`: a narrow slot (the drawer's 148 px): the strip keeps the scene's name, `live demo` goes.
// `own`: never the shared frame (the kind guide: it lives inside the `+` menu, which leaves the page before it unmounts,
// taking a borrowed frame with it).
export function Demo({ scene, width, label, compact, own }: { scene: string; width: number; label?: string; compact?: boolean; own?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const reduced = useMotion((s) => s.reduced)
  const theme = useTheme((s) => s.theme)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(!reduced)
  const loops = useRef(0)
  // The scene's authored size, from its `ready`: the frame's size (16:10 always, so the slot's height doesn't change).
  const [size, setSize] = useState(STAGE)
  const sized = useRef(STAGE)
  // The scene now (a frame still loading sends it when it's ready).
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  // The shared frame (demoPool.ts), lent in the layout effect below; when that can't be (no `moveBefore`, already lent,
  // the move refused), a frame of its own: `fallback`.
  const shared = !own && canMove()
  const [fallback, setFallback] = useState(false)
  const lent = useRef<Pool | null>(null)
  const [lentAt, setLentAt] = useState(0)
  // A frame of its own: its first scene decides its src (later ones go by message, so the frame is kept).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const src = useMemo(() => `${import.meta.env.BASE_URL}demo.html#scene=${encodeURIComponent(playable(scene))}`, [fallback])
  const slot = useRef<HTMLDivElement>(null)
  // A lent frame still loading: its first `ready` is its own scene's; this one's scene goes once it has loaded.
  const pending = useRef(false)
  const playingRef = useRef(playing)
  playingRef.current = playing

  const send = (type: string, extra: Record<string, unknown> = {}) =>
    frame.current?.contentWindow?.postMessage({ ns: DEMO_NS, type, ...extra } satisfies Msg, location.origin)

  // What the frame says back: ready (then it gets the theme, motion, and plays), each loop's end, an error. Listened
  // to from a layout effect declared before the lend's, so a lent frame's first `ready` can't come before it.
  useLayoutEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.origin !== location.origin) return
      const m = e.data as Msg
      if (!m || m.ns !== DEMO_NS) return
      if (m.type === 'ready' && pending.current) {
        pending.current = false
        send('scene', { scene: playable(sceneRef.current) })
        return
      }
      if (m.type === 'ready') {
        // Drawn at another size than its own: the frame takes the scene's size, the scene draws again, then ready.
        const want = Array.isArray(m.size) && m.size.length === 2 ? { w: Number(m.size[0]), h: Number(m.size[1]) } : STAGE
        if (want.w !== sized.current.w || want.h !== sized.current.h) {
          sized.current = want
          setSize(want)
          return
        }
        setReady(true)
      }
      if (m.type === 'loop') {
        loops.current += 1
        if (loops.current >= LOOPS) {
          send('poster')
          setPlaying(false)
        }
      }
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [])

  // The shared frame into the slot (keeping its document), told this scene; given back by the cleanup (which React runs
  // before the next mount's effect: StrictMode, a slot moved into a dialog).
  useLayoutEffect(() => {
    if (!shared || fallback || !slot.current) return
    const p = lend(slot.current)
    if (!p) {
      setFallback(true)
      return
    }
    lent.current = p
    frame.current = p.frame
    p.frame.title = `demo: ${label ?? sceneRef.current}`
    setLentAt((n) => n + 1)
    if (p.loaded) send('scene', { scene: playable(sceneRef.current) })
    else pending.current = true
    return () => {
      lent.current = null
      frame.current = null
      pending.current = false
      giveBack(p)
    }
    // Once per mount (and when falling back).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared, fallback])

  // The canvas moving: paused meanwhile (still showing `[❚❚]`: it goes on by itself), on again RESUME_MS after.
  useEffect(() => {
    let held = false
    let t: ReturnType<typeof setTimeout> | undefined
    let cap: ReturnType<typeof setTimeout> | undefined
    let down: { x: number; y: number } | null = null
    let dragging = false
    const hold = () => {
      if (!held && playingRef.current) {
        held = true
        send('pause')
        cap = setTimeout(() => {
          down = null
          dragging = false
          release()
        }, HOLD_CAP_MS)
      }
      clearTimeout(t)
      if (!dragging) t = setTimeout(release, RESUME_MS)
    }
    const release = () => {
      if (dragging) return
      clearTimeout(cap)
      if (held && playingRef.current) send('play')
      held = false
    }
    const offCam = useCanvasView.subscribe((n, p) => {
      if (n.cams !== p.cams || n.planeCam !== p.planeCam) hold()
    })
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY }
      dragging = false
    }
    const onMove = (e: PointerEvent) => {
      if (!down || dragging || Math.hypot(e.clientX - down.x, e.clientY - down.y) <= DRAG_PX) return
      dragging = true
      hold()
    }
    const onUp = () => {
      down = null
      if (!dragging) return
      dragging = false
      clearTimeout(t)
      t = setTimeout(release, RESUME_MS)
    }
    addEventListener('pointerdown', onDown, true)
    addEventListener('pointermove', onMove, { capture: true, passive: true })
    addEventListener('pointerup', onUp, true)
    addEventListener('pointercancel', onUp, true)
    // A drag's end that never comes as pointerup: the window losing focus, a capture lost.
    addEventListener('lostpointercapture', onUp, true)
    addEventListener('blur', onUp)
    return () => {
      offCam()
      clearTimeout(t)
      clearTimeout(cap)
      removeEventListener('lostpointercapture', onUp, true)
      removeEventListener('blur', onUp)
      removeEventListener('pointerdown', onDown, true)
      removeEventListener('pointermove', onMove, true)
      removeEventListener('pointerup', onUp, true)
      removeEventListener('pointercancel', onUp, true)
    }
  }, [])

  // The frame never keeps the keyboard: a scene focusing a field in it (the finder's, a thread's) would take the focus
  // out of the coach (the welcome's ← → stop working). When it goes into the frame, it's given back where it was.
  useEffect(() => {
    let last: HTMLElement | null = document.activeElement as HTMLElement | null
    const onIn = (e: FocusEvent) => {
      if (e.target !== frame.current) last = e.target as HTMLElement
    }
    const onBlur = () =>
      requestAnimationFrame(() => {
        if (document.activeElement === frame.current && last?.isConnected) last.focus({ preventScroll: true })
      })
    document.addEventListener('focusin', onIn)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('focusin', onIn)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  // Theme and motion follow the app's, live.
  useEffect(() => {
    if (ready) send('theme', { theme })
  }, [ready, theme])
  useEffect(() => {
    if (!ready) return
    send('motion', { reduced })
    if (reduced) {
      send('poster')
      setPlaying(false)
    }
  }, [ready, reduced])

  // A new scene: the frame swaps it (a page turn), the loops counted afresh.
  const first = useRef(true)
  useEffect(() => {
    loops.current = 0
    if (first.current) {
      first.current = false
      return
    }
    setReady(false)
    send('scene', { scene: playable(scene) })
    setPlaying(!useMotion.getState().reduced)
  }, [scene])

  // Ready: play from the start, or rest on the poster.
  useEffect(() => {
    if (!ready) return
    if (reduced) send('poster')
    else {
      send('play')
      setPlaying(true)
    }
    // Only on becoming ready; motion changes are handled above.
  }, [ready])

  const toggle = () => {
    if (playing) {
      send('pause')
      setPlaying(false)
    } else {
      loops.current = 0
      send('play')
      setPlaying(true)
    }
  }

  const k = width / size.w
  // The lent frame at the scene's size, scaled into the slot (a frame of its own gets these from its JSX).
  useLayoutEffect(() => {
    const p = lent.current
    if (!p) return
    p.frame.width = String(size.w)
    p.frame.height = String(size.h)
    p.frame.style.transform = `scale(${k})`
  }, [lentAt, size.w, size.h, k])
  const name = label ?? scene
  return (
    <div className={styles.demo} style={{ width }}>
      <div className={styles.scene} style={{ height: Math.round(size.h * k) }} data-ready={ready || undefined}>
        {shared && !fallback ? (
          <div ref={slot} style={{ display: 'contents' }} />
        ) : (
        <iframe
          ref={frame}
          className={styles.frame}
          src={src}
          title={`demo: ${name}`}
          aria-hidden
          tabIndex={-1}
          inert
          width={size.w}
          height={size.h}
          style={{ transform: `scale(${k})` }}
        />
        )}
      </div>
      <div className={styles.strip}>
        <span className={styles.what}>
          <b>▸</b> {compact ? name : `live demo · ${name}`}
        </span>
        {reduced ? (
          <span className={styles.still}>still</span>
        ) : (
          <button type="button" className={styles.toggle} onClick={toggle} aria-label={playing ? 'pause the demo' : 'play the demo'}>
            {playing ? '[❚❚]' : '[▶ play]'}
          </button>
        )}
      </div>
    </div>
  )
}
