// A lesson (D-315, docs/specs/onboarding.md §4.3): a card beside what it explains (`[data-learn="<anchor>"]`), placed by
// place.ts on a screen rect sampled when it opens and again when a pan or zoom ends (it never moves with the camera);
// no anchor or no room: the bottom-middle card. z 20, announced politely, never taking focus from the canvas. Pages
// `1 / 3` with `[next ›]` / `[got it]`, `×`, a quiet `don't show tips`; done by doing it: `✓ done` where it was until the
// queue lets it go (then it breaks cell by cell). Played from `?`: in the middle, a dialog with `[‹ guide]`.
// The prompt card (D-316): `┌ LESSON · FOCUS`, the right panel's magenta corner marks, a straight lead with a square tip.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Appear } from '../ui/Appear'
import { DecodeText } from '../ui/DecodeText'
import { useCanvasView } from '../state/canvasView'
import { Demo } from './Demo'
import { Btn, keepFocus, stopCanvas, trapTab, useDialogFocus, Words } from './Pages'
import { place, type Placed, type Rect } from './place'
import { fill, lessonName, plain, type Fill } from './words'
import type { CloseHow, Shown } from './queue'
import styles from './Lesson.module.css'

// Drawn and visible: on screen, with a size, not hidden by style (visibility, opacity 0, display, a cell-by-cell clip
// that's shut: a piece's console when not shown), not inside something inert or aria-hidden (the canvas picture's cards
// under a focus).
const SHUT = 'polygon(0 0, 0 0, 0 0)'
export function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  if (!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth)) return false
  if (el.closest('[inert]') || el.parentElement?.closest('[aria-hidden="true"]')) return false
  if (getComputedStyle(el).visibility === 'hidden') return false
  for (let a: HTMLElement | null = el; a && a !== document.body; a = a.parentElement) {
    if (a.style.clipPath.replace(/px/g, '') === SHUT) return false
    const cs = getComputedStyle(a)
    if (cs.display === 'none' || cs.opacity === '0') return false
  }
  return true
}

// The anchor on screen: a visible `[data-learn]` of that name, at or inside what the event was about first (`target`,
// the app's `data-target`: the card selected, the piece just made), else the first one drawn.
export function findAnchor(name: string | undefined, target?: string): HTMLElement | null {
  if (!name) return null
  const sel = `[data-learn="${name}"]`
  if (target)
    for (const t of document.querySelectorAll<HTMLElement>(`[data-target="${CSS.escape(target)}"]`)) {
      const at = [...(t.matches(sel) ? [t] : []), ...t.querySelectorAll<HTMLElement>(sel)].find(isVisible)
      if (at) return at
    }
  for (const el of document.querySelectorAll<HTMLElement>(sel)) if (isVisible(el)) return el
  return null
}

const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height }
}
const onScreen = (r: Rect) => r.w > 0 && r.h > 0 && r.x < innerWidth && r.y < innerHeight && r.x + r.w > 0 && r.y + r.h > 0

// What the card shifts away from (cards, tasks) and what it never covers: every panel and dialog that isn't the
// coach's own (the right panel, the side view's aside, the threads panel, Settings, a wizard), the pane open beside a
// focused plane, and the piece being taught.
const PANELS = '[role="dialog"], [role="alertdialog"], aside, dialog[open]'
function obstacles(anchor: HTMLElement | null) {
  const soft: Rect[] = []
  for (const el of document.querySelectorAll('[data-card], [data-task]')) {
    if (soft.length > 400) break
    if (anchor && (el === anchor || el.contains(anchor))) continue
    const r = rectOf(el)
    if (onScreen(r)) soft.push(r)
  }
  const screen = innerWidth * innerHeight
  const hard: Rect[] = []
  for (const el of document.querySelectorAll(PANELS)) {
    if (el.closest('[data-coach]')) continue
    const r = rectOf(el)
    // A screen-filling layer (a shade) would leave no room at all; what's on it is busy anyway.
    if (onScreen(r) && r.w * r.h < screen * 0.9) hard.push(r)
  }
  // In a focus, what's open beside the plane: the screen right of the split (D-211), whatever its width.
  const cv = useCanvasView.getState()
  if (new URLSearchParams(location.search).has('focus') && cv.beside > 0) {
    const x = Math.round(cv.split * innerWidth)
    hard.push({ x, y: 0, w: innerWidth - x, h: innerHeight })
  }
  // The piece being taught (its console, its dock…): never covered (O6 marks pieces `data-learn="piece"`).
  const piece = anchor?.parentElement?.closest('[data-learn="piece"]')
  if (piece) hard.push(rectOf(piece))
  return { soft, hard }
}

// Where the card goes.
function where(anchorName: string | undefined, anchor: HTMLElement | null, size: { w: number; h: number }): Placed {
  const view = { w: innerWidth, h: innerHeight }
  const focus = new URLSearchParams(location.search).has('focus')
  const dockEl = findAnchor('dock')
  const { soft, hard } = obstacles(anchor)
  return place({ anchor: anchor ? rectOf(anchor) : null, size, view, soft, hard, focus, bottomDock: dockEl ? rectOf(dockEl) : null, dock: anchorName === 'dock' })
}

type Props = {
  shown: Shown
  names: Fill
  onClose: (how: CloseHow) => void
  onTipsOff: () => void
  // Played from `?`: back to the guide.
  onGuide?: () => void
  // Set to what puts focus in the card (`?` then ↵ reaches it, onboarding.md §3.1.9).
  reachRef?: React.MutableRefObject<(() => void) | null>
}

export function Lesson({ shown, names, onClose, onTipsOff, onGuide, reachRef }: Props) {
  const played = shown.via === 'play'
  const pages = shown.pages
  const [i, setI] = useState(0)
  const page = pages[Math.min(i, pages.length - 1)]
  const last = i >= pages.length - 1
  const done = shown.doneAt !== undefined
  const name = lessonName(shown.lesson.id)
  const anchorName = shown.lesson.anchor
  const target = shown.target
  const f: Fill = names

  const card = useRef<HTMLElement>(null)
  const [pos, setPos] = useState<Placed | null>(null)
  // The anchor it was placed by: gone from the page (its piece deleted) closes the lesson; hidden for a moment (a
  // console shown only while pointed at) doesn't.
  const hadAnchor = useRef<HTMLElement | null>(null)
  const [sample, setSample] = useState(0)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Placed once measured, again on a new page or a pan/zoom's end; kept while `✓ done` shows (its anchor may be gone).
  useLayoutEffect(() => {
    if (played || (done && pos) || !card.current) return
    const anchor = findAnchor(anchorName, target)
    if (anchor) hadAnchor.current = anchor
    const size = { w: card.current.offsetWidth, h: card.current.offsetHeight }
    const next = where(anchorName, anchor, size)
    setPos((p) => (p && p.x === next.x && p.y === next.y && p.at === next.at && (p.lead?.x2 ?? 0) === (next.lead?.x2 ?? 0) && (p.lead?.y2 ?? 0) === (next.lead?.y2 ?? 0) ? p : next))
  }, [i, sample, played, done, anchorName, target])

  // A pan or zoom ended, the window resized: sample the anchor again. Its anchor gone (its piece deleted): closed.
  useEffect(() => {
    if (played) return
    let t: ReturnType<typeof setTimeout> | undefined
    const again = () => {
      clearTimeout(t)
      t = setTimeout(() => setSample((n) => n + 1), 160)
    }
    const off = useCanvasView.subscribe((n, p) => {
      if (n.cams !== p.cams || n.planeCam !== p.planeCam || n.beside !== p.beside) again()
    })
    addEventListener('resize', again)
    // Its own size settling (type in, a page turned): placed again.
    const ro = new ResizeObserver(again)
    if (card.current) ro.observe(card.current)
    const gone = setInterval(() => {
      if (hadAnchor.current && !hadAnchor.current.isConnected && !document.querySelector(`[data-learn="${anchorName}"]`) && card.current && !card.current.dataset.done) closeRef.current('closed')
      else if (anchorName) {
        // Placed again when a better anchor is in sight: none was (still building), the one it went by is hidden now
        // (a console no longer pointed at), or what the event was about has come into view.
        const best = findAnchor(anchorName, target)
        const had = hadAnchor.current
        if (best && best !== had && (!had || !isVisible(had) || (target && best.closest(`[data-target="${CSS.escape(target)}"]`)))) setSample((n) => n + 1)
      }
    }, 700)
    return () => {
      off()
      removeEventListener('resize', again)
      ro.disconnect()
      clearInterval(gone)
      clearTimeout(t)
    }
  }, [played, anchorName, target])

  const root = useRef<HTMLElement>(null)
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!reachRef) return
    reachRef.current = () => first.current?.focus({ preventScroll: true })
    return () => {
      reachRef.current = null
    }
  }, [reachRef])

  if (!page) return null
  const title = fill(page.title, f)
  const body = fill(page.body, f)
  const forward = () => (last ? onClose('closed') : setI(i + 1))
  const tipsOff = () => {
    onTipsOff()
    onClose('skipped')
  }
  const demoW = 246
  const count = `${i + 1} / ${pages.length}`
  const common = { name, title, body, page, count, last, forward, tipsOff, onClose, onGuide: played ? onGuide : undefined, isNew: shown.isNew, demoW, first }

  const inner = done ? <Done name={name} /> : <Card {...common} />

  if (played) {
    return createPortal(
      <div className={styles.shade} data-coach {...stopCanvas} {...keepFocus}>
        <Middle root={root} first={first} onClose={onClose} onGuide={onGuide} forward={forward}>
          <Appear as="section" className={styles.card} role="dialog" aria-modal="true" aria-label={`lesson: ${plain(title)}`} data-played>
            {inner}
          </Appear>
        </Middle>
      </div>,
      document.body,
    )
  }

  const style = pos ? { left: pos.x, top: pos.y } : { left: -9999, top: 0, visibility: 'hidden' as const }
  const side = pos?.at === 'beside' ? pos.side : 'bottom'
  return createPortal(
    <>
      {pos?.lead && !done && <LeadLine lead={pos.lead} />}
      <Appear
        as="section"
        elRef={card}
        className={styles.card}
        data-coach
        data-side={side}
        data-done={done || undefined}
        data-nodemo={!page.scene || undefined}
        style={style}
        role="region"
        aria-live="polite"
        aria-label={`lesson: ${plain(title)}`}
        {...stopCanvas}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose('closed')
          }
        }}
      >
        {inner}
      </Appear>
    </>,
    document.body,
  )
}

// Played from `?`: in the middle, a dialog (focus inside, back on close; `esc` closes, `←` back to the guide).
function Middle({ root, first, children, onClose, onGuide, forward }: { root: React.RefObject<HTMLElement | null>; first: React.RefObject<HTMLButtonElement | null>; children: React.ReactNode; onClose: (how: CloseHow) => void; onGuide?: () => void; forward: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  useDialogFocus(box, first)
  void root
  return (
    <div
      ref={box}
      tabIndex={-1}
      className={styles.middle}
      onKeyDown={(e) => {
        e.stopPropagation()
        trapTab(e, box.current)
        if (e.key === 'Escape') onClose('closed')
        else if (e.key === 'ArrowLeft' && onGuide) onGuide()
        else if ((e.key === 'ArrowRight' || e.key === 'Enter') && !(e.target instanceof HTMLButtonElement)) forward()
      }}
    >
      {children}
    </div>
  )
}

// The lead: a straight magenta line from the card to its anchor, a square tip on the anchor (D-266's line family).
function LeadLine({ lead }: { lead: NonNullable<Placed['lead']> }) {
  const h = lead.y1 === lead.y2
  const x = Math.min(lead.x1, lead.x2)
  const y = Math.min(lead.y1, lead.y2)
  const len = h ? Math.abs(lead.x2 - lead.x1) : Math.abs(lead.y2 - lead.y1)
  if (len < 1) return null
  return (
    <>
      <div className={styles.lead} style={h ? { left: x, top: Math.round(y), width: len, height: 1 } : { left: Math.round(x), top: y, width: 1, height: len }} aria-hidden />
      <div className={styles.tip} style={{ left: Math.round(lead.x2) - 2, top: Math.round(lead.y2) - 2 }} aria-hidden />
    </>
  )
}

type CardProps = {
  name: string
  title: string
  body: string
  page: Shown['pages'][number]
  count: string
  last: boolean
  forward: () => void
  tipsOff: () => void
  onClose: (how: CloseHow) => void
  onGuide?: () => void
  isNew: boolean
  demoW: number
  first: React.RefObject<HTMLButtonElement | null>
}

const NewChip = () => <span className={styles.newChip}>NEW</span>

const Title = ({ text, className }: { text: string; className: string }) => (
  <h3 className={className}>
    <DecodeText key={text} text={plain(text)} />
  </h3>
)

// The prompt card.
function Card({ name, title, body, page, count, last, forward, tipsOff, onClose, onGuide, isNew, demoW, first }: CardProps) {
  return (
    <>
      <div className={styles.top}>
        <span>┌ lesson</span>·<span className={styles.k}>{name}</span>
        {isNew && <NewChip />}
        <span className={styles.sp} />
        {onGuide && (
          <Btn onClick={onGuide} elRef={first}>
            ‹ guide
          </Btn>
        )}
        <Btn tone="out" onClick={() => onClose('closed')} label="close">
          ×
        </Btn>
      </div>
      {page.scene && (
        <div className={styles.demo}>
          <Demo scene={page.scene} width={demoW} />
        </div>
      )}
      <Title text={title} className={styles.title} />
      <p className={styles.body}>
        <Words text={body} />
      </p>
      <div className={styles.foot}>
        <span>{count}</span>
        <Btn bare tone="out" onClick={tipsOff}>
          don't show tips
        </Btn>
        <span className={styles.sp} />
        <Btn tone="go" onClick={forward} elRef={onGuide ? undefined : first}>
          {last ? 'got it' : 'next ›'}
        </Btn>
      </div>
    </>
  )
}

// `✓ done`, where the card was, until the queue lets it go.
function Done({ name }: { name: string }) {
  return (
    <div className={styles.top}>
      <span>┌ lesson</span>·<span className={styles.k}>{name}</span>
      <span className={styles.ok}>✓ done</span>
    </div>
  )
}
