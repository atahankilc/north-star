// The welcome and what's new (D-315, docs/specs/onboarding.md §4.1, §4.4): one paged modal, the wizard's shade, z 40,
// `role="dialog"`, focus inside and back where it was on close; `←` `→` `Enter` page, `esc` skips. The wizard window
// (D-316): the matrix/table/deck wizards' frame, the pages as tabs, the demo on top, words on black.
// What's new is the same frame: the pages are the changes, `[show me]` where an item has somewhere to go, the last
// page `+ N more` as a list.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Appear } from '../ui/Appear'
import { DecodeText } from '../ui/DecodeText'
import { Demo } from './Demo'
import { bits, plain, two, type PageModel } from './words'
import type { ReleaseItem } from './releases'
import styles from './Pages.module.css'

export type PagesEnd = { how: 'done' | 'skipped'; go?: NonNullable<ReleaseItem['go']>['action'] }

// A line with its key chips (backticks), as the app writes keys.
export function Words({ text }: { text: string }) {
  return (
    <>
      {bits(text).map((b, i) =>
        b.key ? (
          <kbd key={i} className={styles.kbd}>
            {b.text}
          </kbd>
        ) : (
          <span key={i}>{b.text}</span>
        ),
      )}
    </>
  )
}

// A `[verb]` button, lowercase; `tone`: hot (white), go (cyan), out (a way out, --fg-muted).
export function Btn({ children, onClick, tone, disabled, bare, label, elRef }: { children: ReactNode; onClick?: () => void; tone?: 'hot' | 'go' | 'out'; disabled?: boolean; bare?: boolean; label?: string; elRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <button ref={elRef} type="button" className={bare ? styles.bare : styles.btn} data-tone={tone} disabled={disabled} onClick={onClick} aria-label={label}>
      {children}
    </button>
  )
}

// Focus inside while open (Tab wraps), and back where it was on close.
export function useDialogFocus(root: React.RefObject<HTMLElement | null>, first: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const was = document.activeElement as HTMLElement | null
    ;(first.current ?? root.current)?.focus({ preventScroll: true })
    return () => {
      if (was && document.contains(was)) was.focus({ preventScroll: true })
    }
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
export function trapTab(e: KeyboardEvent, root: HTMLElement | null) {
  if (e.key !== 'Tab' || !root) return
  const all = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
  if (!all.length) return
  const i = all.indexOf(document.activeElement as HTMLElement)
  if (e.shiftKey && i <= 0) {
    e.preventDefault()
    all[all.length - 1].focus()
  } else if (!e.shiftKey && i === all.length - 1) {
    e.preventDefault()
    all[0].focus()
  }
}

// A press on a shade (not on what's on it) keeps focus where it is, in the dialog (it never drops to <body>).
export const keepFocus = {
  onPointerDownCapture: (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) e.preventDefault()
  },
  onMouseDown: (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) e.preventDefault()
  },
}

// Stops what the canvas would do with a press, a wheel or a double-click here (as SidePanel does).
export const stopCanvas = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
  onWheel: (e: React.WheelEvent) => e.stopPropagation(),
  onContextMenu: (e: React.MouseEvent) => e.stopPropagation(),
}

type Props = {
  kind: 'welcome' | 'news'
  pages: PageModel[]
  onEnd: (end: PagesEnd) => void
}

export function Pages({ kind, pages, onEnd }: Props) {
  const [i, setI] = useState(0)
  const root = useRef<HTMLElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  useDialogFocus(root, next)
  const n = pages.length
  const page = pages[Math.min(i, n - 1)]
  const last = i >= n - 1
  const go = (to: number) => setI(Math.max(0, Math.min(n - 1, to)))
  const forward = () => (last ? onEnd({ how: 'done' }) : go(i + 1))
  const skip = () => onEnd({ how: 'skipped' })
  const showMe = page.go ? () => onEnd({ how: 'done', go: page.go!.action }) : undefined

  const onKey = (e: KeyboardEvent) => {
    // The canvas and the app's own keys never hear what's pressed in here.
    e.stopPropagation()
    trapTab(e, root.current)
    if (e.key === 'Escape') {
      e.preventDefault()
      skip()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      forward()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(i - 1)
    } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault()
      forward()
    }
  }

  const name = kind === 'welcome' ? 'welcome' : "what's new"
  const out = kind === 'welcome' ? 'skip' : 'close'
  const end = 'done'
  const titleId = `coach-${kind}-title`
  const scene = pages.find((p, k) => k >= i && p.scene)?.scene ?? pages.find((p) => p.scene)?.scene
  const fitW = useFitWidth()
  const common = { page, pages, i, n, last, go, forward, skip, showMe, name, out, end, next, scene, titleId, demoW: fitW - 2 }

  return createPortal(
    <div className={styles.shade} data-coach {...stopCanvas} {...keepFocus}>
      <Appear
        as="section"
        elRef={root}
        className={styles.wa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKey}
        style={{ '--w': `${fitW}px` } as React.CSSProperties}
      >
        <Window {...common} />
      </Appear>
    </div>,
    document.body,
  )
}

type WindowProps = {
  page: PageModel
  pages: PageModel[]
  i: number
  n: number
  last: boolean
  go: (i: number) => void
  forward: () => void
  skip: () => void
  showMe?: () => void
  name: string
  out: string
  end: string
  next: React.RefObject<HTMLButtonElement | null>
  scene?: string
  titleId: string
  demoW: number
}

// The window's width: 620, smaller on a short screen so all of it shows (a 16:10 demo plus the words under it).
const WIDE = 620
const UNDER = 300
function useFitWidth(): number {
  const [h, setH] = useState(() => innerHeight)
  useEffect(() => {
    const on = () => setH(innerHeight)
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])
  return Math.round(Math.max(360, Math.min(WIDE, ((h - 32 - UNDER) * 16) / 10)))
}

// The demo, kept mounted across pages (one frame; a page turn sends it the next scene); a page without one (the
// `+ N more` list) shows its rows over it.
function Stage({ page, scene, width }: { page: PageModel; scene?: string; width: number }) {
  return (
    <div className={styles.stage}>
      {scene && (
        <div className={styles.demoKeep} data-away={!page.scene || undefined} aria-hidden={!page.scene || undefined}>
          <Demo scene={page.scene ?? scene} width={width} />
        </div>
      )}
      {!page.scene && <NewsList page={page} />}
    </div>
  )
}

function NewsList({ page }: { page: PageModel }) {
  if (!page.list) return null
  return (
    <div className={styles.newsList}>
      {page.list.map((it) => (
        <div key={it.title} className={styles.nl}>
          <span className={styles.num}>›</span>
          <div>
            <div className={styles.nt}>{it.title}</div>
            <div className={styles.nb}>
              <Words text={it.line} />
            </div>
          </div>
        </div>
      ))}
      <div className={styles.nf}>
        Their notes show the first time you meet them, marked <span className={styles.newChip}>NEW</span> in <kbd className={styles.kbd}>?</kbd>.
      </div>
    </div>
  )
}

const Title = ({ text, id, className }: { text: string; id: string; className: string }) => (
  <h2 id={id} className={className}>
    <DecodeText key={text} text={plain(text)} />
  </h2>
)

const Body = ({ page, className }: { page: PageModel; className: string }) =>
  page.body || page.extra ? (
    <p className={className}>
      <Words text={page.body} />
      {page.extra && (
        <>
          {' '}
          <span className={styles.extra}>{page.extra}</span>
        </>
      )}
    </p>
  ) : null

const Keys = () => (
  <span className={styles.keys} aria-hidden>
    ← → ↵
  </span>
)

// The wizard window.
function Window({ page, pages, i, n, last, go, forward, skip, showMe, name, out, end, next, scene, titleId, demoW }: WindowProps) {
  return (
    <>
      <nav className={styles.steps} aria-label="pages">
        {pages.map((p, k) => (
          <button key={k} type="button" tabIndex={-1} className={styles.step} data-on={k === i || undefined} data-done={k < i || undefined} onClick={() => go(k)}>
            <b>{two(k + 1)}</b>
            {p.tab}
          </button>
        ))}
      </nav>
      <Stage page={page} scene={scene} width={demoW} />
      <div className={styles.text}>
        <div className={styles.count}>
          {two(i + 1)} <span>/ {two(n)} · {name}</span>
        </div>
        <Title text={page.title} id={titleId} className={styles.titleA} />
        <Body page={page} className={styles.bodyA} />
      </div>
      <div className={styles.foot}>
        <Btn tone="out" onClick={skip}>
          {out}
        </Btn>
        <span className={styles.sp} />
        <Keys />
        <Btn onClick={() => go(i - 1)} disabled={i === 0}>
          ‹ back
        </Btn>
        {showMe && (
          <Btn tone="go" onClick={showMe}>
            show me
          </Btn>
        )}
        <Btn tone="hot" onClick={forward} elRef={next}>
          {last ? end : 'next ›'}
        </Btn>
      </div>
    </>
  )
}
