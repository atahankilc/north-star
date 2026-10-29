// DEV only: draws the kind guide and the `?` guide on their own, before the coach mounts them (O5b's shots and key
// checks). From the page: `const g = await import('/src/onboarding/devGuides.tsx')`, then `g.kind({ where })` with the
// `+` menu open (the row follows the menu's keys and pointer, as the coach will do), or `g.guide()`. Never imported by
// the app.
import { createRoot, type Root } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { Guide } from './Guide'
import { KindGuide } from './KindGuide'

let root: Root | null = null
let host: HTMLDivElement | null = null

function mount(node: React.ReactNode) {
  if (!import.meta.env.DEV) return
  unmount()
  host = document.createElement('div')
  host.dataset.devGuides = ''
  document.body.appendChild(host)
  root = createRoot(host)
  root.render(node)
}

export function unmount() {
  root?.unmount()
  host?.remove()
  root = null
  host = null
}

// The open `+` menu's panel and the row under the keys or the pointer, as the coach will track them.
function useMenu() {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [row, setRow] = useState<string | null>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const list = document.querySelector<HTMLElement>('[role=menu]')
      const panel = list?.parentElement?.parentElement
      if (panel) {
        const r = panel.getBoundingClientRect()
        setRect((o) => (o && o.left === r.left && o.top === r.top && o.width === r.width && o.height === r.height ? o : r))
        const at = (document.activeElement as HTMLElement | null)?.closest?.('[role^=menuitem]') as HTMLElement | null
        const hovered = list!.querySelector<HTMLElement>('[role^=menuitem]:hover')
        const first = list!.querySelector<HTMLElement>('[role^=menuitem][data-first]') ?? list!.querySelector<HTMLElement>('[role^=menuitem]')
        const key = (hovered ?? at ?? first)?.dataset.key ?? null
        setRow((o) => (o === key ? o : key))
      } else setRect(null)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])
  return { rect, row }
}

function KindHost({ where, onHide }: { where: 'canvas' | 'plane'; onHide: () => void }) {
  const { rect, row } = useMenu()
  return rect ? <KindGuide menu={rect} row={row} where={where} onHide={onHide} /> : null
}

export function kind({ where = 'canvas' as 'canvas' | 'plane' } = {}) {
  ;(window as unknown as { __hidden?: number }).__hidden = 0
  mount(<KindHost where={where} onHide={() => ((window as unknown as { __hidden: number }).__hidden += 1)} />)
}

export function guide() {
  const played: string[] = ((window as unknown as { __played: string[] }).__played = [])
  mount(<Guide onClose={unmount} onPlay={(id) => played.push(id)} role="owner" />)
}
