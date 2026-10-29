// The demo's stage (D-315, docs/specs/onboarding.md §6.2): a scene's made-up workspace in a store of its own, the part of
// the real app the scene mounts (views.tsx) over it, and the person's cursor and key chip drawn on top. Authored at the
// scene's size (16:10) and scaled to the frame. Made anew from the fixture each time the scene starts over (the
// director's reset); it says when it's drawn and measured (`onReady`).
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MemoryRouter } from 'react-router-dom'
import { makeStore, registerStore, type Store } from '../state/wsStore'
import { useCanvasView } from '../state/canvasView'
import { WorkspaceContext } from '../views/workspace/context'
import { MAIN } from '../data/canvases'
import { attach, type Ctx, type Scene } from './director'
import { realClock, step } from './clock'
import { CanvasScreen, Navigator } from './views'
import styles from './Stage.module.css'

export function Stage({ scene, onReady, onError }: { scene: Scene; onReady: (c: Ctx) => void; onError: (message: string) => void }) {
  const store = useMemo<Store>(() => makeStore({ ...structuredClone(scene.fixture), canvas: MAIN }), [scene])
  useLayoutEffect(() => registerStore(store), [store])
  const root = useRef<HTMLDivElement>(null)
  const pointer = useRef<HTMLDivElement>(null)
  const chip = useRef<HTMLDivElement>(null)
  const go = useRef<(to: string) => void>(() => {})
  const onNavigate = useCallback((f: (to: string) => void) => void (go.current = f), [])
  const route = scene.route ?? `/workspaces/${scene.fixture.wid}`
  const focus = new URLSearchParams(route.split('?')[1] ?? '').get('focus')
  const [w, h] = scene.size
  const scale = window.innerWidth / w

  useLayoutEffect(() => attach({ pointer: pointer.current, chip: chip.current }), [])

  // Ready once the type is in, the stage measured and the camera set (fitted on the canvas, or the focus arrived). The
  // clock is stepped meanwhile, so what waits on a frame gets one. Polled on the browser's own timer, not its frames: a
  // hidden tab gives no frames (a headless check, the coach's frame out of sight).
  useEffect(() => {
    let gone = false
    const started = realClock.now()
    const check = () => {
      if (gone) return
      step(1000 / 60)
      const v = useCanvasView.getState()
      const there = v.size.w > 0 && (focus ? !!v.planeCam && v.focusArrived : !!v.cams[scene.fixture.wid])
      if ((there && document.fonts.status === 'loaded') || realClock.now() - started > 4000) {
        if (!there) console.warn(`[demo] ${scene.id}: not settled after 4 s`)
        onReady({ store, wid: scene.fixture.wid, root: root.current!, navigate: (to) => go.current(to), size: { w: v.size.w || w, h: v.size.h || h }, scale })
        return
      }
      realClock.setTimeout(check, 16)
    }
    realClock.setTimeout(check, 0)
    return () => void (gone = true)
  }, [scene, store, focus, onReady, w, h, scale])

  return (
    <Boundary onError={onError}>
      <MemoryRouter initialEntries={[route]}>
        <Navigator onNavigate={onNavigate} />
        <WorkspaceContext.Provider value={store}>
          <div ref={root} className={styles.stage} data-scene={scene.id} style={{ width: w, height: h, transform: scale === 1 ? undefined : `scale(${scale})` }}>
            <CanvasScreen />
          </div>
          {/* The hand and the key chip over everything the page draws, what it puts in the body too (a card's panel, a
              menu): a layer of the stage's size and scale, last in the body. */}
          {createPortal(
            <div className={styles.top} style={{ width: w, height: h, transform: scale === 1 ? undefined : `scale(${scale})` }} aria-hidden>
              <div ref={chip} className={styles.chip} data-shown="false" />
              <div ref={pointer} className={styles.pointer} data-shown="false">
                <svg viewBox="0 0 16 22" width="16" height="22">
                  <path d="M1 1 L1 17 L5 13 L8 20 L10.6 19 L7.6 12.2 L13 12.2 Z" />
                </svg>
              </div>
            </div>,
            document.body,
          )}
        </WorkspaceContext.Provider>
      </MemoryRouter>
    </Boundary>
  )
}

// A scene that throws while drawing says so (the coach hears `error`) rather than leaving the stage empty.
class Boundary extends Component<{ onError: (message: string) => void; children: ReactNode }, { failed: string | null }> {
  state = { failed: null as string | null }
  static getDerivedStateFromError(e: unknown) {
    return { failed: e instanceof Error ? e.message : String(e) }
  }
  componentDidCatch(e: unknown) {
    this.props.onError(e instanceof Error ? e.message : String(e))
  }
  render() {
    return this.state.failed ? <p className={styles.failed}>demo: {this.state.failed}</p> : this.props.children
  }
}
