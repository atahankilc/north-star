// A live demo in the coach (D-315, docs/specs/onboarding.md §6.2): the demo realm (demo.html, the real components on
// made-up data) in a sealed frame, 16:10, the frame made the scene's own authored size (it says it in `ready`) and the
// frame scaled into its slot, never the stage inside it (a scaled stage moves every drag too far: the app divides client
// px by its zoom only); under it, never on it, a strip
// with what it is (`▸ LIVE DEMO · <scene>`) and its `[❚❚]` / `[▶ play]`. It plays 3 loops, then rests on its poster;
// reduced motion: the poster, still. The frame is `inert` and hidden from screen readers: the caption is the text.
// Talking to the frame: postMessage `{ ns, type: play | pause | seek | poster | scene | theme | motion }` there, and
// `{ ns, type: ready | loop | error }` back (src/demo/main.tsx). One frame per mounted Demo, kept across scene changes
// (a page turn in the welcome sends `scene`, it doesn't make a new frame).
import { useEffect, useRef, useState } from 'react'
import { useMotion } from '../state/motion'
import { useTheme } from '../state/theme'
import styles from './Demo.module.css'

export const DEMO_NS = 'north-star-demo'
// The frame's size until the scene says its own (onboarding.md §6.2: "960 × 600 CSS px, scaled into the card").
export const STAGE = { w: 960, h: 600 }
const LOOPS = 3

// The scenes demo.html can play today (src/demo/sceneList.ts). Every other id plays `plane-drag` for now (a
// placeholder until its scene is written); the strip still names the scene that was asked for. Kept here, not imported
// from src/demo/, so the app's bundle never pulls the stage in.
const BUILT = ['plane-drag', 'canvas-fit', 'sidenav-plus', 'deck-drag', 'pieces-tour', 'plus-adds-plane', 'finder-go', 'peers-comment']
// O9: the kind guide's rows and the `+` and pieces lessons (onboarding-lessons.md §2).
BUILT.push('kind-plane', 'kind-matrix', 'kind-table', 'kind-documents', 'kind-deck', 'kind-timeline', 'kind-heading', 'kind-paragraph', 'kind-sticky', 'kind-section', 'kind-title', 'card-customer', 'card-problem', 'card-competitor', 'card-idea', 'card-feature', 'kind-package', 'kind-existing', 'edit-move-resize', 'edit-done', 'console-appear', 'focus-ink', 'plane-inside', 'lens-focus', 'unframe', 'unframed-live', 'stick', 'stick-follow', 'beside', 'beside-pick', 'canvases-share')
export const playable = (scene: string) => (BUILT.includes(scene) ? scene : 'plane-drag')

type Msg = { ns: typeof DEMO_NS; type: string; [k: string]: unknown }

// `compact`: a narrow slot (the drawer's 148 px): the strip keeps the scene's name, `live demo` goes.
export function Demo({ scene, width, label, compact }: { scene: string; width: number; label?: string; compact?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const reduced = useMotion((s) => s.reduced)
  const theme = useTheme((s) => s.theme)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(!reduced)
  const loops = useRef(0)
  // The scene's authored size, from its `ready`: the frame's size (16:10 always, so the slot's height doesn't change).
  const [size, setSize] = useState(STAGE)
  const sized = useRef(STAGE)
  // The first scene decides the frame's src; later ones go by message, so the frame is kept.
  const [src] = useState(() => `${import.meta.env.BASE_URL}demo.html#scene=${encodeURIComponent(playable(scene))}`)

  const send = (type: string, extra: Record<string, unknown> = {}) =>
    frame.current?.contentWindow?.postMessage({ ns: DEMO_NS, type, ...extra } satisfies Msg, location.origin)

  // What the frame says back: ready (then it gets the theme, motion, and plays), each loop's end, an error.
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.origin !== location.origin) return
      const m = e.data as Msg
      if (!m || m.ns !== DEMO_NS) return
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
  const name = label ?? scene
  return (
    <div className={styles.demo} style={{ width }}>
      <div className={styles.scene} style={{ height: Math.round(size.h * k) }} data-ready={ready || undefined}>
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
