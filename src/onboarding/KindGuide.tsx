// The kind guide (D-315, onboarding.md §4.2): the `+` menu, explained. The first times the `+` opens, the row under the
// pointer or the keys shows its demo and two lines (what it is, when to use it) beside the menu, changing as you move.
// It never blocks: it takes no focus and no keys (the menu's field keeps them: typing, letters, arrows, Enter), and a
// press on it neither moves focus nor closes the menu. `[hide guide]` hides it for good (the coach records it through
// `onHide`); one line under the menu then says `? brings it back`, until the menu closes.
//
// The glued column (D-316): the menu gets wider, one panel split by a hairline, its height the guide's floor when typing
// narrows the menu.
//
// Where it's drawn: inside the menu's own panel (found from `menu`, its rect), so a press on it is a press in the menu
// (the menu closes on presses outside its root) and it breaks away with the menu's cells. If the panel can't be found,
// it's drawn at `menu` over the page instead.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Appear } from '../ui/Appear'
import { DecodeText } from '../ui/DecodeText'
import { Demo } from './Demo'
import { lessonById, type GuideLesson, type GuideRow } from './lessons'
import { useProgress } from './progress'
import styles from './KindGuide.module.css'

type Props = { menu: DOMRect; row: string | null; where: 'canvas' | 'plane'; onHide: () => void }

// A row counts as seen once it has been shown this long (not every row the arrows pass on the way).
const SEEN_AFTER_MS = 600
// The glued column's width; the demo fills it less its padding.
const W = 290
const PAD = 12

// Each row's glyph and colour, as the `+` menu has them (AddToCanvas in WorkspaceLayout.tsx; check:lessons
// keeps the labels in step). Read from the menu's own row when it's there; these are the fallback.
const LOOK: Record<string, { glyph: string; tone?: string }> = {
  plane: { glyph: '▦' },
  matrix: { glyph: '⊞' },
  table: { glyph: '☰' },
  documents: { glyph: '▯' },
  kanban: { glyph: '▥' },
  timeline: { glyph: '▤' },
  heading: { glyph: 'T' },
  paragraph: { glyph: '¶' },
  sticky: { glyph: '▤', tone: 'var(--accent-yellow)' },
  section: { glyph: '⬚' },
  title: { glyph: '✦' },
  customer: { glyph: '▌', tone: 'var(--accent-green)' },
  problem: { glyph: '▌', tone: 'var(--accent-magenta)' },
  competitor: { glyph: '▌', tone: 'var(--accent-yellow)' },
  idea: { glyph: '▌', tone: 'var(--fg)' },
  feature: { glyph: '▌', tone: 'var(--accent-cyan)' },
  package: { glyph: '▣', tone: 'var(--accent-blue)' },
  existing: { glyph: '⧉' },
}

const seenId = (key: string) => `kind-guide:${key}`

// The menu's panel: the outermost element round its list whose box is `menu`.
function panelOf(menu: DOMRect): HTMLElement | null {
  const near = (a: number, b: number) => Math.abs(a - b) <= 3
  for (const list of document.querySelectorAll<HTMLElement>('[role=menu]')) {
    let found: HTMLElement | null = null
    for (let el: HTMLElement | null = list; el && el !== document.body; el = el.parentElement) {
      const b = el.getBoundingClientRect()
      if (near(b.left, menu.left) && near(b.top, menu.top) && near(b.width, menu.width)) found = el
      else if (found) break
    }
    if (found) return found
  }
  return null
}

// Keeps a press on the guide from taking focus away from the menu's field (the click still happens).
const keepFocus = (e: React.MouseEvent) => e.preventDefault()

export function KindGuide({ menu, row, where, onHide }: Props) {
  const lesson = lessonById('kind-guide') as GuideLesson | undefined
  const rows = useMemo(() => (lesson?.rows ?? []).filter((r) => r.where === where || r.where === 'both'), [lesson, where])
  const seen = useProgress((s) => s.seen)
  const markSeen = useProgress((s) => s.markSeen)
  const cur = rows.find((r) => r.key === row) ?? null
  const seenN = rows.filter((r) => (seen[seenId(r.key)] ?? 0) >= r.v).length
  const [hidden, setHidden] = useState(false)

  // Seen once it has been on show a moment.
  useEffect(() => {
    if (!cur || hidden) return
    const t = setTimeout(() => markSeen(seenId(cur.key), cur.v), SEEN_AFTER_MS)
    return () => clearTimeout(t)
  }, [cur, hidden, markSeen])

  // The panel it's drawn in; looked for again while the menu builds (its rect may come before its list).
  const [host, setHost] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    let raf = 0
    let tries = 0
    const find = () => {
      const p = panelOf(menu)
      if (p) return setHost(p)
      if (++tries < 30) raf = requestAnimationFrame(find)
      else setHost(null)
    }
    find()
    return () => cancelAnimationFrame(raf)
  }, [menu.left, menu.top, menu.width])

  const hide = () => {
    setHidden(true)
    onHide()
  }

  let body: ReactNode
  if (hidden) {
    body = (
      <div className={styles.hiddenNote} role="status">
        guide hidden · <kbd className={styles.k}>?</kbd> brings it back
      </div>
    )
  } else {
    body = (
      <Glued host={host}>
        <Column host={host} row={cur} seenN={seenN} total={rows.length} onHide={hide} />
      </Glued>
    )
  }

  if (host) return createPortal(body, host)
  // No panel found: over the page at the menu's box.
  return createPortal(
    <div className={styles.over} style={{ left: menu.left, top: menu.top, width: menu.width, height: menu.height }}>
      {body}
    </div>,
    document.body,
  )
}

// Glued to the menu's right edge, as tall as the menu, and the menu at least as tall as the guide (its floor:
// typing that narrows the menu never makes the panel shorter than the guide). The menu's prompt gets that floor as its
// min-height while the guide is up (its list grows; its foot stays level with the guide's).
function Glued({ host, children }: { host: HTMLElement | null; children: ReactNode }) {
  const own = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = own.current
    const prompt = host?.querySelector<HTMLElement>('[role=menu]')?.parentElement
    if (!el || !prompt) return
    const before = prompt.style.minHeight
    const fit = () => {
      // The guide's own height: its parts, not its stretched box.
      const natural = [...el.children].reduce((s, c) => s + (c as HTMLElement).offsetHeight, 0)
      prompt.style.minHeight = `${natural}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    for (const c of el.children) ro.observe(c)
    return () => {
      ro.disconnect()
      prompt.style.minHeight = before
    }
  }, [host])
  return (
    <Appear className={styles.glued} style={{ width: W }} onMouseDown={keepFocus} aria-live="polite">
      <div ref={own} className={styles.gluedIn}>
        {children}
      </div>
    </Appear>
  )
}

const INTRO = { what: 'What each thing is.', when: 'Point at a row, or move with ↑ ↓: what it is and when to use it shows here.' }

function DemoSlot({ row, width }: { row: GuideRow | null; width: number }) {
  if (!row) {
    return (
      <div className={styles.noDemo} style={{ width, height: Math.round((width * 10) / 16) }}>
        <span>▸ a demo for each row</span>
      </div>
    )
  }
  return <Demo scene={row.scene} width={width} label={row.scene} own />
}

// The column: the row's name, its demo, what it is and when to use it.
function Column({ host, row, seenN, total, onHide }: { host: HTMLElement | null; row: GuideRow | null; seenN: number; total: number; onHide: () => void }) {
  const look = row ? LOOK[row.key] : null
  return (
    <>
      <div className={styles.head}>
        {row ? (
          <>
            <span className={styles.glyph} style={look?.tone ? { color: look.tone } : undefined} aria-hidden>
              {glyphOf(host, row.key)}
            </span>
            <span className={styles.name}>{row.label}</span>
          </>
        ) : (
          <span className={styles.name}>the + menu</span>
        )}
        <span className={styles.of}>
          {seenN} / {total} seen
        </span>
      </div>
      <div className={styles.demoWrap}>
        <DemoSlot row={row} width={W - 2 * PAD - 1} />
      </div>
      <div className={styles.lines}>
        <p className={styles.what}>{row ? <DecodeText key={row.key} text={row.lines[0]} /> : INTRO.what}</p>
        <p className={styles.when}>{row ? row.lines[1].replace(/`/g, '') : INTRO.when}</p>
      </div>
      <div className={styles.spacer} />
      <div className={styles.foot}>
        <span>↑ ↓ shows the others</span>
        <HideButton onHide={onHide} />
      </div>
    </>
  )
}

// A press only: the keys stay the menu's (letters pick its rows). The keyboard way is said beside it: tips off in `?`.
function HideButton({ onHide }: { onHide: () => void }) {
  return (
    <>
      <button type="button" className={styles.hide} tabIndex={-1} onMouseDown={keepFocus} onClick={onHide}>
        hide guide
      </button>
      <span className={styles.hideKeys}>
        keys: <kbd className={styles.k}>?</kbd> → tips off
      </span>
    </>
  )
}

// The menu row's own glyph (the documents page is drawn there), else the fallback.
function glyphOf(host: HTMLElement | null, key: string): ReactNode {
  const btn = host?.querySelector(`[role^=menuitem][data-key="${CSS.escape(key)}"]`)
  const spans = btn ? [...btn.children] : []
  // cursor, letter, glyph, label…: the glyph is the one before the label, when there is one.
  const g = spans.length >= 4 ? (spans[2] as HTMLElement) : null
  if (g && g.innerHTML) return <span dangerouslySetInnerHTML={{ __html: g.innerHTML }} />
  return LOOK[key]?.glyph ?? ''
}
