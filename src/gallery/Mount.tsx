// One state of one example, mounted fresh (D-324, gallery.md §2–§4): every outside-React store reset (realm.ts), a store
// of its own over the made-up workspace, a router, an error boundary of its own (an example that throws says so; the
// page goes on), then the state's `setup` and its held hover.
import { Component, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { makeStore, registerStore, type Store } from '../state/wsStore'
import { WorkspaceContext } from '../views/workspace/context'
import { MAIN } from '../data/canvases'
import { tiny, workspace, WID } from '../demo/fixtures/tiny'
import { fresh } from '../demo/realm'
import { specOf, type GalleryCtx, type State } from './example'
import styles from './Gallery.module.css'

const frames = (n: number) => new Promise<void>((r) => (n <= 0 ? r() : requestAnimationFrame(() => void frames(n - 1).then(r))))

function ctxOf(root: HTMLElement, store: Store): GalleryCtx {
  const find = (sel: string) => root.querySelector<HTMLElement>(sel) ?? document.querySelector<HTMLElement>(sel)
  return {
    root,
    store,
    click: (sel) => {
      const el = find(sel)
      if (!el) return console.warn(`[gallery] click: nothing matches ${sel}`)
      const r = el.getBoundingClientRect()
      const at = { bubbles: true, cancelable: true, composed: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, view: window }
      el.dispatchEvent(new PointerEvent('pointerdown', { ...at, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1 }))
      el.dispatchEvent(new MouseEvent('mousedown', { ...at, buttons: 1 }))
      el.dispatchEvent(new PointerEvent('pointerup', { ...at, pointerId: 1, pointerType: 'mouse', isPrimary: true }))
      el.dispatchEvent(new MouseEvent('mouseup', at))
      el.dispatchEvent(new MouseEvent('click', at))
    },
    key: (key, sel) => {
      const el = (sel ? find(sel) : null) ?? (document.activeElement as HTMLElement | null) ?? document.body
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
      el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
    },
    type: (text, sel) => {
      const el = ((sel ? find(sel) : null) ?? document.activeElement) as HTMLInputElement | HTMLTextAreaElement | null
      if (!el || !('value' in el)) return console.warn('[gallery] type: no field')
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, el.value + text)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
  }
}

// The outside-React stores reset once the example before is gone (after the commit that took it away, never while
// drawing: a store it still listened to would be changed mid-render), then the example drawn.
export function Mount(props: { state: State; onError: (message: string | null) => void }) {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    fresh()
    setReady(true)
  }, [])
  return ready ? <Example {...props} /> : null
}

function Example({ state, onError }: { state: State; onError: (message: string | null) => void }) {
  const spec = specOf(state)
  // A new store for each mount (the parent keys Mount by example, state and reset).
  const store = useMemo<Store>(
    () => makeStore({ ...structuredClone(spec.fixture ?? tiny), wid: WID, workspace, canvas: MAIN }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useLayoutEffect(() => registerStore(store), [store])
  const box = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    let gone = false
    onError(null)
    void (async () => {
      await frames(2)
      if (gone || !box.current) return
      try {
        await spec.setup?.(ctxOf(box.current, store))
      } catch (e) {
        onError(`setup: ${e instanceof Error ? e.message : String(e)}`)
      }
      await frames(1)
      if (gone || !spec.hover) return
      document.querySelectorAll(spec.hover).forEach((el) => el.setAttribute('data-demo-hover', ''))
    })()
    return () => {
      gone = true
      document.querySelectorAll('[data-demo-hover]').forEach((el) => el.removeAttribute('data-demo-hover'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const size = spec.size
  const style = size === 'full' ? { width: '100%', height: '100%' } : size ? { width: size[0], height: size[1] } : undefined
  return (
    <Boundary onError={onError}>
      <MemoryRouter initialEntries={[spec.route ?? `/workspaces/${WID}`]}>
        <WorkspaceContext.Provider value={store}>
          <div ref={box} className={styles.example} data-size={size === 'full' ? 'full' : size ? 'fixed' : 'auto'} style={style}>
            {spec.render()}
          </div>
        </WorkspaceContext.Provider>
      </MemoryRouter>
    </Boundary>
  )
}

class Boundary extends Component<{ onError: (message: string) => void; children: ReactNode }, { failed: string | null }> {
  state = { failed: null as string | null }
  static getDerivedStateFromError(e: unknown) {
    return { failed: e instanceof Error ? e.message : String(e) }
  }
  componentDidCatch(e: unknown) {
    this.props.onError(e instanceof Error ? e.message : String(e))
  }
  render() {
    return this.state.failed ? <p className={styles.failed}>this example threw: {this.state.failed}</p> : this.props.children
  }
}
