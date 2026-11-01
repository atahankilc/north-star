// The welcome and what's new (D-315, docs/specs/onboarding.md §4.1, §4.4): one paged modal, the wizard's shade, z 40,
// the dialog role, focus inside and back where it was on close; `←` `→` `Enter` page, `esc` skips. The wizard window
// (D-316): the matrix/table/deck wizards' frame, the pages as tabs, the demo on top, words on black.
// What's new is the same frame: the pages are the changes, `[show me]` where an item has somewhere to go, the last
// page `+ N more` as a list.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { stopCanvas, Window } from '../ui/patterns/Window'
import { DecodeText } from '../ui/primitives/DecodeText'
import { Demo } from './Demo'
import { bits, fitTab, plain, two, type PageModel } from './words'
import type { ReleaseItem } from './releases'
import styles from './Pages.module.css'
import { Button } from '../ui/primitives/Button'
import { Num } from '../ui/primitives/Rule'
import { Steps } from '../ui/patterns/Steps'

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

// A `[verb]` button: the kit's Button (D-326). `tone`: hot the strong one (`main`), go cyan (`primary`), out a way out
// (--fg-muted: quiet by where it sits, never by contrast, onboarding.md §4); `bare` without brackets. `elRef` is the
// button itself, for the focus a dialog starts on (Button takes no ref: a wrapper that is no box hands it over).
export function Btn({ children, onClick, tone, disabled, bare, label, elRef }: { children: ReactNode; onClick?: () => void; tone?: 'hot' | 'go' | 'out'; disabled?: boolean; bare?: boolean; label?: string; elRef?: React.Ref<HTMLButtonElement> }) {
  const button = (
    <Button tone={tone === 'hot' ? 'main' : tone === 'go' ? 'primary' : undefined} icon={bare} className={tone === 'out' ? styles.out : undefined} disabled={disabled} onClick={onClick} aria-label={label}>
      {children}
    </Button>
  )
  if (!elRef) return button
  return (
    <span className={styles.btnRef} ref={(s) => setRef(elRef, s?.querySelector('button') ?? null)}>
      {button}
    </span>
  )
}

function setRef<T>(ref: React.Ref<T>, v: T | null) {
  if (typeof ref === 'function') ref(v)
  else if (ref) (ref as React.MutableRefObject<T | null>).current = v
}

// Focus kept inside and given back, Tab going round, a press on the scrim keeping the focus, the canvas never hearing a
// press: the Window's (src/ui/patterns/Window.tsx, D-326), here for the lessons and nudges that import them from this file.
export { keepFocus, stopCanvas, trapTab, useDialogFocus } from '../ui/patterns/Window'

type Props = {
  kind: 'welcome' | 'news'
  pages: PageModel[]
  onEnd: (end: PagesEnd) => void
}

export function Pages({ kind, pages, onEnd }: Props) {
  const [i, setI] = useState(0)
  const root = useRef<HTMLElement>(null)
  const next = useRef<HTMLButtonElement>(null)
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

  // The Window (D-326): the scrim (`data-coach`: the canvas and the app's keys never hear what's pressed here), focus on
  // `[next ›]` and back where it was, Tab round inside, the cell-by-cell build; its frame is the welcome's own (`.wa`)
  // and Escape is `skip`, heard by `onKey` (the Window's own Escape steps aside for the coach).
  return (
    <Window
      labelledBy={titleId}
      onClose={skip}
      escape={false}
      scrimPress="keep"
      scrimProps={{ 'data-coach': true, ...stopCanvas }}
      look="bare"
      entrance="cells"
      focus={next}
      elRef={root}
      className={styles.wa}
      onKeyDown={onKey}
      style={{ '--w': `${fitW}px` } as React.CSSProperties}
    >
      <PageWindow {...common} />
    </Window>
  )
}

type PageWindowProps = {
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
      {/* Over the demo's place (kept, hidden), so the window keeps its height on this page too. */}
      {!page.scene && <NewsList page={page} over={!!scene} />}
    </div>
  )
}

function NewsList({ page, over }: { page: PageModel; over: boolean }) {
  if (!page.list) return null
  return (
    <div className={styles.newsList} data-over={over || undefined}>
      <div className={styles.nls}>
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
      </div>
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

// A tab's room in characters: its share of the window, less its padding (14 + 14) and its `01 ` (two digits + 8 px), at
// about 7.9 px a character (11 px mono, 0.12 em tracking).
const tabChars = (w: number, n: number) => Math.max(4, Math.floor((w / Math.max(1, n) - 28 - 24) / 7.9))

// The wizard window.
function PageWindow({ page, pages, i, n, last, go, forward, skip, showMe, name, out, end, next, scene, titleId, demoW }: PageWindowProps) {
  const max = tabChars(demoW + 2, n)
  return (
    <>
      <Steps
        label="pages"
        keyboard={false}
        steps={pages.map((p) => fitTab(p.tab, max))}
        titles={pages.map((p) => (fitTab(p.tab, max) === p.tab ? undefined : p.tab))}
        step={i}
        onStep={go}
      />
      <Stage page={page} scene={scene} width={demoW} />
      <div className={styles.text}>
        <div className={styles.count}>
          <Num n={i + 1} /> <span>/ {two(n)} · {name}</span>
        </div>
        {/* Every page's words in one cell, the others unseen: the window is as tall as its tallest page throughout, so
            its top never moves as the pages turn. */}
        <div className={styles.textStack}>
          {pages.map((p, k) =>
            k === i ? null : (
              <div key={k} className={styles.ghost} aria-hidden>
                <h2 className={styles.titleA}>{plain(p.title)}</h2>
                <Body page={p} className={styles.bodyA} />
              </div>
            ),
          )}
          <div>
            <Title text={page.title} id={titleId} className={styles.titleA} />
            <Body page={page} className={styles.bodyA} />
          </div>
        </div>
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
