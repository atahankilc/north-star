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
import { movesTo, mustReplace, place, type Placed, type Rect, type Side } from './place'
import { getWs } from '../state/wsStore'
import { fill, lessonName, plain, type Fill } from './words'
import { countsAsMenu, type CloseHow, type Shown } from './queue'
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
// focused plane, the piece being taught and what the event was about (`target`), every console and dock on screen, an
// open menu (the `+` menu, a right-click, a Select), the HUD (side nav, breadcrumb, the bottom-left corner), and the
// coach's other surfaces (a hint, the kind guide). Its lead never crosses a console's or a dock's buttons.
const PANELS = '[role="dialog"], [role="alertdialog"], aside, dialog[open]'
export const MENUS = '[role="menu"], [role="listbox"], [data-learn="plus-menu"]'
const CONSOLES = '[data-learn="console"], [data-learn="console-unframe"], [data-learn="dock"], [data-learn="dock-view"]'
// The HUD (D-027, D-175, D-178): the side nav, the breadcrumb and the bottom-left corner (people here, threads, your square,
// the gear; the corner is the gear's parent). Never covered, unless it holds the anchor (a lesson about that part sits
// beside it).
export const HUD = '[data-learn="sidenav"], header nav[aria-label="Breadcrumb"], [data-learn="people"]'
const HUD_CORNER = 'header button[aria-haspopup="dialog"][aria-label^="Settings"]'
const SETTINGS_MENU = '[data-learn="settings-menu"]'
function obstacles(anchor: HTMLElement | null, target: string | undefined, own: HTMLElement | null) {
  const soft: Rect[] = []
  for (const el of document.querySelectorAll('[data-card], [data-task]')) {
    if (soft.length > 400) break
    if (anchor && (el === anchor || el.contains(anchor))) continue
    const r = rectOf(el)
    if (onScreen(r)) soft.push(r)
  }
  const screen = innerWidth * innerHeight
  const hard: Rect[] = []
  const noLead: Rect[] = []
  const mine = (el: Element) => !!own && (el === own || own.contains(el))
  for (const el of document.querySelectorAll(PANELS)) {
    if (el.closest('[data-coach]')) continue
    const r = rectOf(el)
    // The open modal dialog the anchor is in (Settings): the card goes inside it (the rest of the page is inert), so it's
    // room to use when it must, beside the anchor with a lead, not a wall.
    if (anchor && el.matches('dialog[open]') && el.contains(anchor)) {
      soft.push(r)
      continue
    }
    // A screen-filling layer (a shade) would leave no room at all; what's on it is busy anyway.
    if (onScreen(r) && r.w * r.h < screen * 0.9) hard.push(r)
  }
  // In a focus, what's open beside the plane: the screen right of the split (D-211), whatever its width.
  const cv = useCanvasView.getState()
  if (new URLSearchParams(location.search).has('focus') && cv.beside > 0) {
    const x = Math.round(cv.split * innerWidth)
    hard.push({ x, y: 0, w: innerWidth - x, h: innerHeight })
  }
  // The piece being taught (its console, its dock…): never covered (O6 marks pieces `data-learn="piece"`); what the event
  // was about too, unless it fills the screen (a plane in focus).
  const piece = anchor?.parentElement?.closest('[data-learn="piece"]')
  if (piece) hard.push(rectOf(piece))
  if (target)
    for (const el of document.querySelectorAll<HTMLElement>(`[data-target="${CSS.escape(target)}"]`)) {
      const r = rectOf(el)
      if (isVisible(el) && r.w * r.h < screen * 0.5) hard.push(r)
    }
  // A link (`link:<id>`): the two cards it joins are what it means, never covered either.
  hard.push(...linkEnds(target))
  // A matrix or a table in focus fills the screen, so its piece is no obstacle: what it shows is (its heads, row names
  // and cells, on screen), one box round them all.
  hard.push(...lensContent())
  for (const el of document.querySelectorAll<HTMLElement>(`${CONSOLES}, ${MENUS}`)) {
    if (el === anchor || mine(el) || !isVisible(el)) continue
    hard.push(rectOf(el))
    for (const b of el.querySelectorAll('button')) if (!(anchor && (b === anchor || anchor.contains(b) || b.contains(anchor)))) noLead.push(rectOf(b))
  }
  const holdsAnchor = (el: Element) => !!anchor && (el === anchor || el.contains(anchor))
  for (const el of document.querySelectorAll<HTMLElement>(HUD)) if (!holdsAnchor(el) && isVisible(el)) hard.push(rectOf(el))
  // Settings' menu (its YOU and WORKSPACE groups) when the lesson is about something else in Settings (its people): what
  // takes you there, never covered.
  for (const el of document.querySelectorAll<HTMLElement>(SETTINGS_MENU)) if (!holdsAnchor(el) && isVisible(el)) hard.push(rectOf(el))
  for (const gear of document.querySelectorAll<HTMLElement>(HUD_CORNER)) {
    const corner = gear.parentElement
    if (corner && !holdsAnchor(corner) && isVisible(corner)) hard.push(rectOf(corner))
  }
  // The coach's other surfaces: an empty hint, the kind guide, a nudge.
  for (const el of document.querySelectorAll<HTMLElement>('[data-coach]')) {
    if (mine(el) || el.closest('[role="dialog"]')) continue
    const r = rectOf(el)
    if (onScreen(r) && r.w * r.h < screen * 0.5) hard.push(r)
  }
  return { soft, hard, noLead }
}

// A focused matrix's or table's heads, row names and cells on screen, as one box (none when no lens is in focus).
function lensContent(): Rect[] {
  const id = new URLSearchParams(location.search).get('focus')
  const kind = id ? getWs()?.pieces.find((p) => p.id === id)?.kind : undefined
  if (kind !== 'matrix' && kind !== 'table') return []
  let box: { x0: number; y0: number; x1: number; y1: number } | null = null
  for (const el of document.querySelectorAll<HTMLElement>('[data-cell], [data-find-box]')) {
    const r = rectOf(el)
    // Not the coach's own, the dots of a matrix too small to read, or an axis's dashed `+ feature` to add to.
    if (!onScreen(r) || el.closest('[data-coach]') || el.dataset.cell === 'far' || el.closest('button[title^="add a"]')) continue
    const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(innerWidth, r.x + r.w), y1 = Math.min(innerHeight, r.y + r.h)
    box = box ? { x0: Math.min(box.x0, x0), y0: Math.min(box.y0, y0), x1: Math.max(box.x1, x1), y1: Math.max(box.y1, y1) } : { x0, y0, x1, y1 }
  }
  return box ? [{ x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0 }] : []
}

// The two cards a link joins, on screen (the live ones), when the lesson is about a link.
function linkEnds(target: string | undefined): Rect[] {
  if (!target?.startsWith('link:')) return []
  const e = getWs()?.edges.find((x) => x.id === target.slice(5))
  if (!e) return []
  const out: Rect[] = []
  for (const id of [e.fromId, e.toId]) {
    const el = [...document.querySelectorAll<HTMLElement>(`[data-target="card:${CSS.escape(id)}"]`)].filter(isVisible).at(-1)
    if (el) out.push(rectOf(el))
  }
  return out
}

// The card's width (Lesson.module.css), and the narrowest a squeezed one goes.
const CARD_W = 268
const CARD_MIN = 160

// Anchors that span the page (a row of the workspaces page's list): below them first, where the page has room, so the
// card never sits over the forms above.
const ORDER: Record<string, Side[]> = {
  'pending-row': ['below', 'above'],
  // Settings' menu is the dialog's left column: left of it first (the screen's margin), then over the page beside it.
  'settings-menu': ['left', 'right', 'above', 'below'],
}

// Where the card goes.
function where(anchorName: string | undefined, anchor: HTMLElement | null, size: { w: number; h: number }, target?: string, own: HTMLElement | null = null): Placed {
  const view = { w: innerWidth, h: innerHeight }
  const focus = new URLSearchParams(location.search).has('focus')
  const dockEl = findAnchor('dock')
  const { soft, hard, noLead } = obstacles(anchor, target, own)
  return place({ anchor: anchor ? rectOf(anchor) : null, size, view, soft, hard, noLead, focus, bottomDock: dockEl ? rectOf(dockEl) : null, dock: anchorName === 'dock', order: anchorName ? ORDER[anchorName] : undefined })
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
  const posRef = useRef(pos)
  posRef.current = pos
  // An anchor inside a modal <dialog> (Settings, D-097): the rest of the page is inert under the browser's top layer, so
  // the card goes inside that dialog to be seen and pressed (a press outside it would close it). The dialog's frame is a
  // containing block (its backdrop-filter): screen points are moved by its corner, and it lets the card overflow it.
  const [host, setHost] = useState<HTMLDialogElement | null>(null)
  // Where screen points are inside it: its containing block's corner, measured from the card as drawn.
  const [off, setOff] = useState({ x: 0, y: 0 })
  // The anchor it was placed by: gone from the page (its piece deleted) closes the lesson; hidden for a moment (a
  // console shown only while pointed at) doesn't.
  const hadAnchor = useRef<HTMLElement | null>(null)
  const [sample, setSample] = useState(0)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  // Beside a wizard there may be less room than a card (880 px of wizard on a 1280–1480 px screen): the card then goes
  // narrower and without its demo, so it still sits beside the wizard, off its controls, rather than in its middle.
  const [squeeze, setSqueeze] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (shown.lesson.within !== 'wizard' || played) return
    const wiz = document.querySelector<HTMLElement>('[data-learn="wizard"]')
    if (!wiz) return
    const r = wiz.getBoundingClientRect()
    const room = Math.max(r.left, innerWidth - r.right)
    const next = room >= CARD_W + 30 ? null : Math.max(CARD_MIN, Math.floor(room - 32))
    setSqueeze((v) => (v === next ? v : next))
  }, [shown.lesson.within, played, sample])

  // Placed once measured, again on a new page or a pan/zoom's end; kept while `✓ done` shows (its anchor may be gone).
  useLayoutEffect(() => {
    if (played || (done && posRef.current) || !card.current) return
    const anchor = findAnchor(anchorName, target)
    if (anchor) hadAnchor.current = anchor
    const dlg = anchor?.closest<HTMLDialogElement>('dialog[open]') ?? null
    setHost((h) => (h === dlg ? h : dlg))
    const size = { w: card.current.offsetWidth, h: card.current.offsetHeight }
    const next = where(anchorName, anchor, size, target, card.current)
    setPos((p) => (p && p.x === next.x && p.y === next.y && p.at === next.at && (p.lead?.x2 ?? 0) === (next.lead?.x2 ?? 0) && (p.lead?.y2 ?? 0) === (next.lead?.y2 ?? 0) ? p : next))
  }, [i, sample, played, done, anchorName, target, squeeze])

  // Inside a dialog: it lets the card hang out of its box while it's there.
  useEffect(() => {
    if (!host) return
    const was = host.style.overflow
    host.style.overflow = 'visible'
    return () => void (host.style.overflow = was)
  }, [host])
  // In a dialog the card's left/top are from whatever box contains it there (the dialog, or its frame's backdrop-filter):
  // where it really lands, against where its style put it, is that box's corner.
  useLayoutEffect(() => {
    const el = card.current
    if (!host || !el || !pos) return void setOff((o) => (o.x || o.y ? { x: 0, y: 0 } : o))
    const r = el.getBoundingClientRect()
    const at = { x: Math.round(r.left - (parseFloat(el.style.left) || 0)), y: Math.round(r.top - (parseFloat(el.style.top) || 0)) }
    setOff((o) => (o.x === at.x && o.y === at.y ? o : at))
  }, [host, pos, off])

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
        // What it keeps clear grew or moved under it (a console widening in edit mode, a link's card): placed again, but
        // only when placing again would move it (no clear spot left: it stays, rather than asking every 700 ms).
        else if (had && isVisible(had) && card.current && !card.current.dataset.done && mustReplace(rectOf(card.current), rectOf(had), linkEnds(target))) {
          const el = card.current
          const next = where(anchorName, had, { w: el.offsetWidth, h: el.offsetHeight }, target, el)
          if (movesTo(posRef.current, next)) setSample((n) => n + 1)
        }
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

  // A menu opened while it shows (the `+` menu with its kind guide, a right-click, a Select): a lesson about menus is
  // placed again clear of it; any other steps aside (hidden, taking no clicks) until the menu closes, then comes back.
  const aboutMenus = shown.lesson.within === 'menu'
  // About a wizard (`within: wizard`): over its dimmed shade (z 40), or the card would sit under it and a press on it
  // would land on the shade, which closes the wizard.
  const overWizard = shown.lesson.within === 'wizard'
  // A wizard opened while another lesson shows steps it aside too: under the wizard's shade it would read dimmed, and a
  // press on it would land on the shade and close the wizard.
  const [menuUp, setMenuUp] = useState(false)
  const [wizardUp, setWizardUp] = useState(false)
  useEffect(() => {
    if (played) return
    let was = false
    let wasWizard = false
    const t = setInterval(() => {
      const up = [...document.querySelectorAll<HTMLElement>(MENUS)].some((el) => !card.current?.contains(el) && countsAsMenu(el) && isVisible(el))
      const wiz = [...document.querySelectorAll<HTMLElement>('[data-learn="wizard"]')].some(isVisible)
      if (up === was && wiz === wasWizard) return
      was = up
      wasWizard = wiz
      setMenuUp(up)
      setWizardUp(wiz)
      setSample((n) => n + 1)
    }, 120)
    return () => clearInterval(t)
  }, [played])
  const aside = (menuUp && !aboutMenus) || (wizardUp && !overWizard)

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
  // ← a page back; on the first page of a note played from `?`, back to the guide.
  const back = i > 0 ? () => setI(i - 1) : onGuide
  const tipsOff = () => {
    onTipsOff()
    onClose('skipped')
  }
  const demoW = 246
  const count = `${i + 1} / ${pages.length}`
  const common = { name, title, body, page: squeeze !== null ? { ...page, scene: undefined } : page, count, last, forward, tipsOff, onClose, onGuide: played ? onGuide : undefined, isNew: shown.isNew, demoW, first }

  const inner = done ? <Done name={name} /> : <Card {...common} />

  if (played) {
    return createPortal(
      <div className={styles.shade} data-coach {...stopCanvas} {...keepFocus}>
        <Middle root={root} first={first} onClose={onClose} back={back} forward={forward}>
          <Appear as="section" className={styles.card} role="dialog" aria-modal="true" aria-label={`lesson: ${plain(title)}`} data-played>
            {inner}
          </Appear>
        </Middle>
      </div>,
      document.body,
    )
  }

  const style = pos && !aside ? { left: pos.x - off.x, top: pos.y - off.y } : pos ? { left: pos.x - off.x, top: pos.y - off.y, visibility: 'hidden' as const, pointerEvents: 'none' as const } : { left: -9999, top: 0, visibility: 'hidden' as const }
  const side = pos?.at === 'beside' ? pos.side : 'bottom'
  return createPortal(
    <>
      {pos?.lead && !done && !aside && <LeadLine lead={{ x1: pos.lead.x1 - off.x, y1: pos.lead.y1 - off.y, x2: pos.lead.x2 - off.x, y2: pos.lead.y2 - off.y }} over={overWizard} />}
      <Appear
        as="section"
        elRef={card}
        className={styles.card}
        data-coach
        data-side={side}
        data-done={done || undefined}
        data-aside={aside || undefined}
        data-nodemo={!page.scene || undefined}
        data-over-wizard={overWizard || undefined}
        data-squeezed={squeeze !== null || undefined}
        style={squeeze !== null ? { ...style, width: squeeze } : style}
        role="region"
        aria-live="polite"
        aria-label={`lesson: ${plain(title)}`}
        {...stopCanvas}
        // A press on it keeps the focus where it was (the finder's field, a name being typed), as the kind guide does: a
        // lesson closed with its `×` mustn't leave the finder deaf to `esc` (onboarding.md §3.1.9).
        onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
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
    host ?? document.body,
  )
}

// Played from `?`: in the middle, a dialog (focus inside, back on close; `esc` closes, `←` a page back, from the first
// page back to the guide).
function Middle({ root, first, children, onClose, back, forward }: { root: React.RefObject<HTMLElement | null>; first: React.RefObject<HTMLButtonElement | null>; children: React.ReactNode; onClose: (how: CloseHow) => void; back?: () => void; forward: () => void }) {
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
        else if (e.key === 'ArrowLeft' && back) back()
        // → always pages; ↵ too, unless on a button (that one's click is its own).
        else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement))) forward()
      }}
    >
      {children}
    </div>
  )
}

// The lead: a straight magenta line from the card to its anchor, a square tip on the anchor (D-266's line family).
function LeadLine({ lead, over }: { lead: NonNullable<Placed['lead']>; over?: boolean }) {
  const h = lead.y1 === lead.y2
  const x = Math.min(lead.x1, lead.x2)
  const y = Math.min(lead.y1, lead.y2)
  const len = h ? Math.abs(lead.x2 - lead.x1) : Math.abs(lead.y2 - lead.y1)
  if (len < 1) return null
  return (
    <>
      <div className={styles.lead} data-over-wizard={over || undefined} style={h ? { left: x, top: Math.round(y), width: len, height: 1 } : { left: Math.round(x), top: y, width: 1, height: len }} aria-hidden />
      <div className={styles.tip} data-over-wizard={over || undefined} style={{ left: Math.round(lead.x2) - 2, top: Math.round(lead.y2) - 2 }} aria-hidden />
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
          <Btn onClick={onGuide}>
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
        {/* Focus starts here, played from `?` too: ↵ pages on, ← a page back (from the first, to the guide). */}
        <Btn tone="go" onClick={forward} elRef={first}>
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
