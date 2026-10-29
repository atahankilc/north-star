// The kind guide (D-315, onboarding.md §4.2): the `+` menu, explained. The first times the `+` opens, the row under the
// pointer or the keys shows its demo and two lines (what it is, when to use it) beside the menu, changing as you move.
// It never blocks: it takes no focus and no keys (the menu's field keeps them: typing, letters, arrows, Enter), and a
// press on it neither moves focus nor closes the menu. `[hide guide]` hides it for good (the coach records it through
// `onHide`); one line under the menu then says `? brings it back`, until the menu closes.
//
// Three looks while the user picks (Q-028, `useLook('kind')`): a, the glued column (the menu gets wider: one panel split
// by a hairline, its height the guide's floor when typing narrows the menu); b, ink beside (unframed, a dashed magenta
// lead from the row under the keys, no floor); c, the man page (glued like a, `PLANE(1)`, NAME / USE / KEY / SEEN, and
// a magenta dot on the menu's rows not seen yet).
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
import { useLook } from './looks'
import { useProgress } from './progress'
import styles from './KindGuide.module.css'

type Props = { menu: DOMRect; row: string | null; where: 'canvas' | 'plane'; onHide: () => void }

// A row counts as seen once it has been shown this long (not every row the arrows pass on the way).
const SEEN_AFTER_MS = 600
// Widths: the glued column (a), the man page (c), the ink (b); the demo fills the column less its padding.
const W = { a: 290, b: 290, c: 310 }
const PAD = 12

// Each row's glyph, colour and letter, as the `+` menu has them (AddToCanvas in WorkspaceLayout.tsx; check:lessons
// keeps the labels in step). Read from the menu's own row when it's there; these are the fallback.
const LOOK: Record<string, { glyph: string; tone?: string; letter: string }> = {
  plane: { glyph: '▦', letter: 'p' },
  matrix: { glyph: '⊞', letter: 'm' },
  table: { glyph: '☰', letter: 't' },
  documents: { glyph: '▯', letter: 'd' },
  kanban: { glyph: '▥', letter: 'k' },
  timeline: { glyph: '▤', letter: 'l' },
  heading: { glyph: 'T', letter: 'h' },
  paragraph: { glyph: '¶', letter: 'a' },
  sticky: { glyph: '▤', tone: 'var(--accent-yellow)', letter: 'n' },
  section: { glyph: '⬚', letter: 's' },
  title: { glyph: '✦', letter: 'i' },
  customer: { glyph: '▌', tone: 'var(--accent-green)', letter: 'c' },
  problem: { glyph: '▌', tone: 'var(--accent-magenta)', letter: 'r' },
  competitor: { glyph: '▌', tone: 'var(--accent-yellow)', letter: 'o' },
  idea: { glyph: '▌', tone: 'var(--fg)', letter: 'i' },
  feature: { glyph: '▌', tone: 'var(--accent-cyan)', letter: 'f' },
  package: { glyph: '▣', tone: 'var(--accent-blue)', letter: 'k' },
  existing: { glyph: '⧉', letter: 'e' },
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
  const look = useLook('kind')
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

  // Layout of the menu's rows (for b's lead and c's dots): redone when the list scrolls, changes or resizes.
  const tick = useListTick(host)

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
  } else if (look === 'b') {
    body = <InkBeside host={host} row={cur} tick={tick} onHide={hide} />
  } else {
    body = (
      <Glued host={host} look={look}>
        {look === 'c' ? (
          <ManPage host={host} row={cur} seenN={seenN} total={rows.length} where={where} onHide={hide} />
        ) : (
          <Column host={host} row={cur} seenN={seenN} total={rows.length} onHide={hide} />
        )}
      </Glued>
    )
  }

  const unseenDots = look === 'c' && !hidden && host ? <Dots host={host} rows={rows} seen={seen} tick={tick} /> : null

  if (host) {
    return createPortal(
      <>
        {body}
        {unseenDots}
      </>,
      host,
    )
  }
  // No panel found: over the page at the menu's box.
  return createPortal(
    <div className={styles.over} style={{ left: menu.left, top: menu.top, width: menu.width, height: menu.height }}>
      {body}
    </div>,
    document.body,
  )
}

// A number that changes whenever the menu's rows may have moved.
function useListTick(host: HTMLElement | null) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!host) return
    const list = host.querySelector<HTMLElement>('[role=menu]')
    const bump = () => setTick((t) => t + 1)
    const mo = new MutationObserver(bump)
    if (list) mo.observe(list, { childList: true, subtree: true })
    const ro = new ResizeObserver(bump)
    ro.observe(host)
    list?.addEventListener('scroll', bump, { passive: true })
    return () => {
      mo.disconnect()
      ro.disconnect()
      list?.removeEventListener('scroll', bump)
    }
  }, [host])
  return tick
}

// Where a menu row sits in the panel's box (its padding box: what an absolute child is placed in).
function rowBox(host: HTMLElement, key: string): { top: number; height: number; visible: boolean } | null {
  const el = host.querySelector<HTMLElement>(`[role^=menuitem][data-key="${CSS.escape(key)}"]`)
  if (!el) return null
  const h = host.getBoundingClientRect()
  const b = el.getBoundingClientRect()
  const list = host.querySelector<HTMLElement>('[role=menu]')?.getBoundingClientRect()
  const visible = !list || (b.bottom > list.top + 2 && b.top < list.bottom - 2)
  return { top: b.top - h.top - host.clientTop, height: b.height, visible }
}

// What the menu's own row says (its letter), else the fallback.
function letterOf(host: HTMLElement | null, key: string) {
  const el = host?.querySelector(`[role^=menuitem][data-key="${CSS.escape(key)}"] b`)
  return el?.textContent || LOOK[key]?.letter || ''
}

// a and c: glued to the menu's right edge, as tall as the menu, and the menu at least as tall as the guide (its floor:
// typing that narrows the menu never makes the panel shorter than the guide). The menu's prompt gets that floor as its
// min-height while the guide is up (its list grows; its foot stays level with the guide's).
function Glued({ host, look, children }: { host: HTMLElement | null; look: 'a' | 'c'; children: ReactNode }) {
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
  }, [host, look])
  return (
    <Appear className={styles.glued} data-look={look} style={{ width: W[look] }} onMouseDown={keepFocus} aria-live="polite">
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
  return <Demo scene={row.scene} width={width} label={row.scene} />
}

// a · the glued column.
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
        <DemoSlot row={row} width={W.a - 2 * PAD - 1} />
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

// c · the man page.
function ManPage({ host, row, seenN, total, where, onHide }: { host: HTMLElement | null; row: GuideRow | null; seenN: number; total: number; where: 'canvas' | 'plane'; onHide: () => void }) {
  const label = row ? row.label.replace('…', '') : 'the + menu'
  const page = `${label.toUpperCase().replace(/ /g, '-')}(1)`
  return (
    <>
      <div className={styles.manHead}>
        <span>{row ? page : 'ADD(1)'}</span>
        <span className={styles.manRight}>NORTH STAR</span>
      </div>
      <div className={styles.demoWrap}>
        <DemoSlot row={row} width={W.c - 2 * PAD - 1} />
      </div>
      <dl className={styles.man}>
        <dt>NAME</dt>
        <dd className={styles.manName}>
          {row ? <DecodeText key={row.key} text={`${label} — ${row.lines[0].toLowerCase().replace(/\.$/, '')}`} /> : 'add — what each thing is'}
        </dd>
        <dt>USE</dt>
        <dd>{row ? row.lines[1].replace(/`/g, '') : INTRO.when}</dd>
        <dt>KEY</dt>
        <dd className={styles.mono}>{row ? `+ ${letterOf(host, row.key)} ↵${where === 'plane' ? '  ·  right-click → add' : ''}` : '+ then a letter, ↵'}</dd>
        <dt>SEEN</dt>
        <dd className={styles.mono}>
          {seenN} of {total} kinds
        </dd>
      </dl>
      <div className={styles.meter} aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <i key={i} data-on={i < seenN || undefined} />
        ))}
      </div>
      <div className={styles.spacer} />
      <div className={styles.foot}>
        <span>
          <i className={styles.dotKey} aria-hidden /> not seen yet
        </span>
        <HideButton onHide={onHide} />
      </div>
    </>
  )
}

// b · ink beside: no frame, a dashed lead from the row under the keys, each line on its shade.
function InkBeside({ host, row, tick, onHide }: { host: HTMLElement | null; row: GuideRow | null; tick: number; onHide: () => void }) {
  const [y, setY] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!host) return setY(null)
    const first = host.querySelector<HTMLElement>('[role^=menuitem]')?.dataset.key
    const box = rowBox(host, row?.key ?? first ?? '')
    setY(box && box.visible ? box.top + box.height / 2 : null)
  }, [host, row?.key, tick])
  const top = y ?? 60
  return (
    <>
      {y !== null && <div className={styles.lead} style={{ top: y }} aria-hidden />}
      <Appear className={styles.ink} style={{ top: top - 9, width: W.b }} onMouseDown={keepFocus} aria-live="polite">
        <div className={styles.small}>
          <span className={styles.num}>{row ? letterOf(host, row.key).toUpperCase() : '+'}</span>
          <span className={styles.rule} />
          <span>{row ? row.label.replace('…', '') : 'the + menu'} · what it is</span>
        </div>
        <div className={styles.inkDemo}>
          <DemoSlot row={row} width={W.b} />
        </div>
        <p className={styles.inkWhat}>
          <span className={styles.shade}>{row ? <DecodeText key={row.key} text={row.lines[0]} /> : INTRO.what}</span>
        </p>
        <p className={styles.inkWhen}>
          <span className={styles.shade}>{row ? row.lines[1].replace(/`/g, '') : INTRO.when}</span>
        </p>
        <div className={styles.inkHide}>
          <span className={styles.shade}>
            <HideButton onHide={onHide} />
          </span>
        </div>
      </Appear>
    </>
  )
}

// c's dots: a small magenta square at the right end of each menu row not seen yet.
function Dots({ host, rows, seen, tick }: { host: HTMLElement; rows: readonly GuideRow[]; seen: Record<string, number>; tick: number }) {
  const [at, setAt] = useState<number[]>([])
  useLayoutEffect(() => {
    const out: number[] = []
    for (const r of rows) {
      if ((seen[seenId(r.key)] ?? 0) >= r.v) continue
      const b = rowBox(host, r.key)
      if (b?.visible) out.push(b.top + b.height / 2)
    }
    setAt(out)
  }, [host, rows, seen, tick])
  return (
    <>
      {at.map((y) => (
        <i key={y} className={styles.dot} style={{ top: y }} aria-hidden />
      ))}
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
