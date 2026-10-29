// A timeline (D-262, D-304): a piece on the canvas (`+ → timeline`) showing decks' tasks on a strip of days. Drawn in
// its own px through a view, like a deck (D-251): a picture on the canvas, live in its focus or beside the deck it's
// stuck to. Which decks: the one it's linked to, else every deck (D-289). Rows: one per deck, or by who a task is given
// to, or by the card it's for (rows.ts, as a deck's lanes).
// The strip (D-304): time runs on without end; you move along it (sideways on a trackpad, a drag, the overview on top)
// and change its scale (day · week · month · quarter, a pinch), text always at its own size. Both are yours, per tab
// (`useStrip`), never written to the piece. A task is a sheet from its first day (`start`) to its due day in its card's
// colour; one with only a due day is a ◆ on it. Past its due day and not finished it stays where it is, hatched in magenta
// up to today. Finished: faint with a green `✓`. Its checklist is a line under it. Tasks with no day wait in a tray.
// Live: a drag moves a task (onto another row by person or card, that too), its edges (shown once it's picked) move its
// first or due day, the ◆'s `⟵` gives it a first day; a press on an empty day's `+` and a drag across days makes a new
// task there; a tray task dropped on a day gets it as its due day. A click opens its panel (TaskPanel).
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { useAuth } from '../../data/auth'
import { addTask, orderBetween, setTimeline, shownTasks, tasksIn, timelineKanbans, today, TIMELINE_ROWS, updateTask, type Task, type TaskFields, type TimelineRows } from '../../data/tasks'
import { camOf, type Bounds, type PlaneCam } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import { Menu, type MenuEntry } from '../../ui/Menu'
import { useWs, useWsNow } from './context'
import { DockAction } from './FocusDock'
import { kanbanOf, selectTask, useKanbanUi } from './Kanban'
import { KanbanFilterDock } from './KanbanFilterDock'
import { passes, useKanbanFilter } from './kanbanFilter'
import { TYPE_ACCENT } from './PlaneCards'
import { CardPicker } from './CardPanel'
import { cardsOn } from '../../data/places'
import type { Card } from '../../data/cards'
import { taskRows, type Lane } from './rows'
import { Landing, Marks, useSettledZoom, zsIn } from '../../ui/Marks'
import { OPEN_PAD } from './shownBox'
import { useOpenSize } from './sizes'
import { registerStrip } from './stripReveal'
import styles from './Timeline.module.css'

// Its parts in its own px: the rows' names, the overview, the days' head, a task, the gap between, a row's padding, the
// tray; how many days a pane beside a deck showed before the strip (kept for the tasks side view's call).
export const T = { left: 150, over: 34, head: 44, bar: 30, gap: 6, pad: 10, tray: 56, besideDays: 7 }
const TOP = T.over + 8 + T.head

// Its scales: px a day.
export const STRIP_SCALES = [
  { name: 'day', ppd: 150 },
  { name: 'week', ppd: 48 },
  { name: 'month', ppd: 18 },
  { name: 'quarter', ppd: 7 },
] as const
const PPD_MIN = 5
const PPD_MAX = 160

// Days as numbers: days since 1 Jan 1970 (UTC), as a due day is written.
const DAY_MS = 86400000
const dayOf = (s: string) => Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY_MS)
const iso = (d: number) => new Date(d * DAY_MS).toISOString().slice(0, 10)
const dateOf = (d: number) => new Date(d * DAY_MS)
const dow = (d: number) => (((d + 3) % 7) + 7) % 7 // 0 = Monday (day 0 was a Thursday)
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const WD = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const short = (d: number) => `${dateOf(d).getUTCDate()} ${MON[dateOf(d).getUTCMonth()]}`
function isoWeek(d: number) {
  const thu = d - dow(d) + 3
  const jan4 = dayOf(`${dateOf(thu).getUTCFullYear()}-01-04`)
  return 1 + Math.round((thu - (jan4 - dow(jan4) + 3)) / 7)
}

// Where it stands, per timeline, yours: its first day on the left (a fraction moves it smoothly), its scale, how far its
// rows are scrolled, and how many days it shows (written as it's laid out, for the dock's tools).
type Strip = { from: number; ppd: number; top: number; span: number }
const useStrip = create<Record<string, Strip>>(() => ({}))
const startFor = (span: number) => dayOf(today()) - Math.round(span / 3)
const stripOf = (id: string): Strip => useStrip.getState()[id] ?? { from: startFor(20), ppd: STRIP_SCALES[1].ppd, top: 0, span: 20 }
const setStrip = (id: string, patch: Partial<Strip>) => useStrip.setState((s) => ({ [id]: { ...(s[id] ?? stripOf(id)), ...patch } }))

// Its days glided to a first day, or its scale eased to another round a point (a fraction of what's shown); a press
// stops either.
const motion = new Map<string, number>()
const stopStrip = (id: string) => cancelAnimationFrame(motion.get(id) ?? 0)
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
function glideStrip(id: string, to: Partial<Pick<Strip, 'from' | 'top'>>, ms = 420) {
  stopStrip(id)
  const a = stripOf(id)
  if (isReducedMotion()) return setStrip(id, to)
  const t0 = performance.now()
  const step = (now: number) => {
    const k = ease(Math.min(1, (now - t0) / ms))
    setStrip(id, { ...(to.from !== undefined && { from: a.from + (to.from - a.from) * k }), ...(to.top !== undefined && { top: a.top + (to.top - a.top) * k }) })
    if (k < 1) motion.set(id, requestAnimationFrame(step))
  }
  motion.set(id, requestAnimationFrame(step))
}
function scaleStrip(id: string, ppd: number, at = 0.5, ms = 320) {
  stopStrip(id)
  const a = stripOf(id)
  const to = Math.max(PPD_MIN, Math.min(PPD_MAX, ppd))
  // The day under the point stays put.
  const day = a.from + a.span * at
  const set = (p: number) => setStrip(id, { ppd: p, from: day - ((a.span * a.ppd) / p) * at })
  if (isReducedMotion()) return set(to)
  const t0 = performance.now()
  const step = (now: number) => {
    const k = ease(Math.min(1, (now - t0) / ms))
    set(a.ppd * Math.pow(to / a.ppd, k))
    if (k < 1) motion.set(id, requestAnimationFrame(step))
  }
  motion.set(id, requestAnimationFrame(step))
}
const toToday = (id: string) => glideStrip(id, { from: startFor(stripOf(id).span) })

// A task's width on its sheet: its text measured once, in the sheet's font.
const widths = new Map<string, number>()
let measure: CanvasRenderingContext2D | null = null
function textW(s: string) {
  const known = widths.get(s)
  if (known !== undefined) return known
  measure ??= document.createElement('canvas').getContext('2d')
  if (!measure) return s.length * 7
  measure.font = `13px ${getComputedStyle(document.documentElement).getPropertyValue('--font-display') || 'sans-serif'}`
  const w = measure.measureText(s).width
  widths.set(s, w)
  return w
}
const labelOf = (t: Task, finished: boolean) => `${finished ? '✓ ' : ''}${t.priority ? `${t.priority} ` : ''}${t.title}`

// A task on the strip: its first and last day (a ◆ has one), whether it's late or finished, its lane, and its box in
// px from day 0 (with what's drawn past it: the hatching, a name outside a short sheet).
type Item = { task: Task; s: number; e: number; point: boolean; late: boolean; finished: boolean; lane: number; x: number; w: number; out: boolean; x0: number; x1: number }
type Row = Lane & { top: number; h: number; lanes: number; items: Item[] }
type Layout = { rows: Row[]; tray: Task[]; rowsH: number; lo: number; hi: number }

const inset = (ppd: number) => (ppd >= 20 ? 3 : 1)
// Its box at a scale (also for a task held with other days).
function boxOf(t: Task, s: number, e: number, point: boolean, late: boolean, finished: boolean, ppd: number, now: number) {
  const lw = textW(labelOf(t, finished)) + 22
  const hatchEnd = late ? (now + 1) * ppd + 62 : 0
  if (point) {
    const x = e * ppd + ppd / 2 - 12
    return { x, w: 24, out: true, x0: x - 30, x1: Math.max(x + 32 + lw, late ? hatchEnd + lw : 0) }
  }
  const i = inset(ppd)
  const x = s * ppd + i
  const w = Math.max(ppd >= 20 ? 10 : 4, (e - s + 1) * ppd - 2 * i)
  const out = w < lw
  const x1 = Math.max(x + w, late ? hatchEnd + (out ? lw : 0) : out ? x + w + 8 + lw : 0)
  return { x, w, out, x0: x - 4, x1: x1 + 6 }
}

// Its tasks, where they go: rows, lanes (first fit, in px, so a name outside a short sheet never runs into the next),
// the tray; the days the overview spans.
function layoutOf(piece: WithId<Piece>, all: WithId<Piece>[], tasks: Task[], cards: { id: string; type: string; pieceId: string; title?: string }[], filterOk: (t: Task, finished: boolean) => boolean, me: { id: string; name: string } | undefined, ppd: number): Layout {
  const kanbans = timelineKanbans(piece, all)
  const done = new Set(kanbans.flatMap((k) => kanbanOf(k).cols.filter((c) => c.done).map((c) => `${k.id}|${c.id}`)))
  const pool = kanbans.flatMap((k) => shownTasks(tasks.filter((t) => t.pieceId === k.id), k, cards as never)).filter((t) => filterOk(t, done.has(`${t.pieceId}|${t.col}`)))
  const mode: TimelineRows = piece.timeline?.rows ?? 'kanban'
  const names = new Map(pool.flatMap((t) => (t.assignee && t.assigneeName ? [[t.assignee, t.assigneeName] as const] : [])))
  const field = mode === 'kanban' ? null : taskRows(mode, cards as never, { me, names })
  const lanes: Lane[] = field ? field.lanes(pool) : kanbans.map((k) => ({ key: k.id, label: k.name || 'deck', drop: true }))
  const rowOf = (t: Task) => (field ? field.laneOf(t) : t.pieceId)
  const now = dayOf(today())
  let lo = now - 60
  let hi = now + 120
  const tray: Task[] = []
  const byRow = new Map<string, Item[]>()
  for (const t of pool) {
    const finished = done.has(`${t.pieceId}|${t.col}`)
    if (!t.due) {
      if (!finished) tray.push(t)
      continue
    }
    const e = dayOf(t.due)
    const point = !t.start
    const s = t.start ? Math.min(dayOf(t.start), e) : e
    const late = !finished && e < now
    lo = Math.min(lo, s - 14)
    hi = Math.max(hi, e + 14)
    const item: Item = { task: t, s, e, point, late, finished, lane: 0, ...boxOf(t, s, e, point, late, finished, ppd, now) }
    const k = rowOf(t)
    byRow.set(k, [...(byRow.get(k) ?? []), item])
  }
  let top = 0
  const rows = lanes.map((l) => {
    const items = (byRow.get(l.key) ?? []).sort((a, b) => a.x0 - b.x0 || a.task.title.localeCompare(b.task.title))
    const ends: number[] = []
    for (const it of items) {
      let lane = 0
      while ((ends[lane] ?? -Infinity) > it.x0) lane++
      it.lane = lane
      ends[lane] = it.x1
    }
    const n = Math.max(1, ends.length)
    const h = 2 * T.pad + n * T.bar + (n - 1) * T.gap
    const r = { ...l, top, h, lanes: n, items }
    top += h
    return r
  })
  return { rows, tray, rowsH: top, lo, hi }
}

// The box round it, in its px: what fit frames. Framed, its window (it fills it, at its own size); in a pane beside
// a deck or the tasks side view (`span`), a small box at the top left, so the pane shows it at its own size.
export function timelineBounds(piece: WithId<Piece>, _all: WithId<Piece>[], _tasks: Task[], _cards: { id: string; type: string; pieceId: string }[], span?: number): Bounds {
  if (span !== undefined || !piece.w) return { x: 0, y: 0, w: 200, h: 120 }
  return { x: 0, y: 0, w: Math.max(200, piece.w - 26), h: Math.max(120, piece.h - 26) }
}

// `onCanvas`: unframed (D-289, as a deck, D-228), live on the canvas at its own size; its box is the strip's (shownBox.ts).
// `span`: once the days a pane showed; the strip fills what it's given instead.
type Props = { piece: WithId<Piece>; view: PlaneCam; live: boolean; editor: boolean; onCanvas?: boolean; onTask?: (t: Task) => void; span?: number }

// It fills what it's drawn in: framed, its window; live, the screen (or its pane) less the view's margin; unframed, its
// width. Its view moves only the world's transform; the days are drawn again when the zoom settles, never as it pans.
export function TimelineView({ piece, view, live, editor, onCanvas = false, onTask }: Props) {
  const settled = useSettledZoom(view.zoom, live)
  const layer = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = layer.current
    if (!el || onCanvas) return
    const read = () => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [onCanvas])
  const z = view.zoom || 1
  let w = onCanvas ? piece.w - 2 * OPEN_PAD : (box.w - 2 * view.ox) / z
  // Going into focus (its view not yet at its own size), never narrower than its window: it starts where its picture
  // was, cut to the window. A pane's view is at its own size from the start.
  if (live && !onCanvas && piece.w && Math.abs(z - 1) > 0.001) w = Math.max(w, piece.w - 26)
  const h = onCanvas ? undefined : live ? (box.h - view.oy - Math.max(view.oy, 64)) / z : (box.h - 2 * view.oy) / z
  return (
    <div ref={layer} className={styles.layer} data-timeline data-live={live || undefined} data-on-canvas={onCanvas || undefined}>
      <div className={styles.world} data-zooming={view.zoom !== settled || undefined} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})`, ...zsIn(settled, onCanvas || !live) }}>
        {(onCanvas || box.w > 0) && <Days piece={piece} zoom={settled} live={live} editor={editor} onCanvas={onCanvas} onTask={onTask} w={Math.round(Math.max(360, Math.min(8000, w)))} h={h === undefined ? undefined : Math.round(Math.max(TOP + 120, h))} />}
      </div>
    </div>
  )
}

type DaysProps = { piece: WithId<Piece>; zoom: number; live: boolean; editor: boolean; onCanvas: boolean; onTask?: (t: Task) => void; w: number; h?: number }

// A task held: how (moved, or one of its days), where the press began (screen), the day under it then, the days it
// had; now: the days it would get, the row it would go to, the pointer (its time layer's px) and where in the sheet
// it was taken.
type Drag = { id: string; how: 'move' | 'start' | 'due'; from: [number, number]; day0: number; s0: number; e0: number; point: boolean; row0: string; moving: boolean; s: number; e: number; row: string; at: [number, number]; grab: [number, number] }
// A new task being drawn across days, then named.
type Draft = { row: string; d0: number; s: number; e: number; naming: boolean }
// Where the `+` shows: an empty day in a row's lane.
type Ghost = { row: string; day: number; lane: number }

const Days = memo(function Days({ piece, zoom, live, editor, onCanvas, onTask, w, h }: DaysProps) {
  const { wid, pieces, tasks, cards } = useWs()
  const now = useWsNow()
  const { user } = useAuth()
  const ppd = useStrip((s) => s[piece.id]?.ppd ?? STRIP_SCALES[1].ppd)
  const tw = w - T.left
  // What's drawn: three screens of days round the one shown, drawn again only as you pass into the next.
  const span = Math.ceil(tw / ppd / 8) * 8 + 8
  const base = useStrip((s) => Math.floor((s[piece.id]?.from ?? startFor(span)) / span))
  const origin = (base - 1) * span
  const filter = useKanbanFilter(piece.id)
  const me = useMemo(() => (user ? { id: user.id, name: user.name ?? '' } : undefined), [user])
  const layout = useMemo(() => {
    const typeOf = (id: string) => cards.find((c) => c.id === id)?.type
    return layoutOf(piece, pieces, tasks, cards, (t, fin) => passes(t, filter, fin, user?.id, typeOf), me, ppd)
  }, [piece, pieces, tasks, cards, filter, user?.id, me, ppd])
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const selected = useKanbanUi((s) => s.selected?.task ?? null)
  const mode = piece.timeline?.rows ?? 'kanban'
  const field = useMemo(() => (mode === 'kanban' ? null : taskRows(mode, cards, { me, names: new Map() })), [mode, cards, me])
  const fullH = TOP + 8 + layout.rowsH + 16 + T.tray
  const boardH = h ?? fullH
  // The rows' height on screen: all of them, or what fits above the tray (then they scroll); the tray right under them.
  const rowsShown = Math.min(layout.rowsH, Math.max(40, boardH - TOP - 8 - 16 - T.tray))
  const maxTop = Math.max(0, layout.rowsH - rowsShown)
  const maxTopRef = useRef(maxTop)
  maxTopRef.current = maxTop
  const todayAt = dayOf(today())
  const visible = Math.max(1, tw / ppd)

  // Its strip, set up the first time it's drawn here; how many days it shows, kept for the dock's tools.
  useLayoutEffect(() => {
    const s = useStrip.getState()[piece.id]
    if (!s) setStrip(piece.id, { from: startFor(visible), ppd, top: 0, span: visible })
    else if (Math.abs(s.span - visible) > 0.01) setStrip(piece.id, { span: visible })
  }, [piece.id, visible, ppd])

  // Unframed, how big it came out: its box on the canvas (shownBox.ts). Written only when it changes.
  useLayoutEffect(() => {
    if (!onCanvas) return
    const was = useOpenSize.getState()[piece.id]
    if (!was || was.w !== w || was.h !== fullH) useOpenSize.setState({ [piece.id]: { w, h: fullH } })
  }, [onCanvas, piece.id, w, fullH])

  // Moving along the strip or scrolling its rows writes only transforms (and a few edge marks), never redraws the days.
  const board = useRef<HTMLDivElement>(null)
  const timeLayer = useRef<HTMLDivElement>(null)
  const headLayer = useRef<HTMLDivElement>(null)
  const rowsInner = useRef<HTMLDivElement>(null)
  const win = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const apply = () => {
      const s = stripOf(piece.id)
      const top = Math.min(s.top, maxTopRef.current)
      const x = -(s.from - origin) * ppd
      if (timeLayer.current) timeLayer.current.style.transform = `translateX(${x}px)`
      if (headLayer.current) headLayer.current.style.transform = `translateX(${x}px)`
      if (rowsInner.current) rowsInner.current.style.transform = `translateY(${-top}px)`
      const { lo, hi } = layoutRef.current
      if (win.current) {
        const k = tw / (hi - lo)
        const ww = Math.max(14, (tw / ppd) * k)
        win.current.style.left = `${Math.min(tw - ww, Math.max(0, (s.from - lo) * k))}px`
        win.current.style.width = `${ww}px`
      }
      // A long sheet that started before the left edge keeps its name on screen.
      for (const el of timeLayer.current?.querySelectorAll<HTMLElement>('[data-sticky]') ?? []) {
        const bx = +el.dataset.sticky!
        const bw = +el.dataset.w!
        el.style.left = `${Math.max(10, Math.min(bw - 60, (s.from - origin) * ppd - bx + 44))}px`
      }
    }
    apply()
    return useStrip.subscribe((st, was) => st[piece.id] !== was[piece.id] && apply())
  }, [piece.id, origin, ppd, tw, layout])

  // Its view's px per screen px, read as it's drawn (a drag draws it again).
  const screen = (live ? 1 : camOf(wid).zoom) * zoom
  const scaleOf = () => {
    const el = board.current
    if (!el) return 1
    return el.getBoundingClientRect().width / (el.offsetWidth || 1)
  }
  // The day under a point on the screen, and how far down the rows it is (their px).
  const dayAt = (clientX: number) => {
    const el = timeLayer.current
    if (!el) return 0
    return origin + (clientX - el.getBoundingClientRect().left) / scaleOf() / ppd
  }
  const rowY = (clientY: number) => {
    const el = rowsInner.current
    return el ? (clientY - el.getBoundingClientRect().top) / scaleOf() : 0
  }
  const rowAt = (clientY: number) => {
    const y = rowY(clientY)
    const rows = layoutRef.current.rows
    return rows.find((r) => y >= r.top && y < r.top + r.h) ?? (y < 0 ? rows[0] : rows.at(-1))
  }

  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag
  const [draft, setDraft] = useState<Draft | null>(null)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const [trayHeld, setTrayHeld] = useState<{ id: string; at: [number, number] } | null>(null)

  // Near the left or right edge while holding something, the days move under it.
  const edge = useRef({ raf: 0, x: 0, on: () => {} })
  const edgeScroll = (on: () => void) => {
    edge.current.on = on
    cancelAnimationFrame(edge.current.raf)
    const tick = () => {
      const el = board.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const left = r.left + T.left * scaleOf()
      const x = edge.current.x
      const d = x < left + 48 ? x - (left + 48) : x > r.right - 48 ? x - (r.right - 48) : 0
      if (d) {
        const s = stripOf(piece.id)
        setStrip(piece.id, { from: s.from + (d * 0.3) / ppd / scaleOf() })
        edge.current.on()
      }
      edge.current.raf = requestAnimationFrame(tick)
    }
    edge.current.raf = requestAnimationFrame(tick)
  }
  const edgeStop = () => cancelAnimationFrame(edge.current.raf)
  useEffect(() => edgeStop, [])

  const pick = (t: Task) => {
    const again = useKanbanUi.getState().selected?.task === t.id
    selectTask(t.pieceId, again ? null : t.id)
    if (!again) onTask?.(t)
  }

  // A press on a sheet: picked once it's let go without moving; held, it moves (or, picked, its edges move a day).
  const press = (it: Item, row: string, how: Drag['how']) => (e: ReactPointerEvent<HTMLElement>) => {
    if (!live || e.button !== 0) return
    e.stopPropagation()
    stopStrip(piece.id)
    if (!editor || it.finished) {
      const up = () => (window.removeEventListener('pointerup', up), pick(it.task))
      window.addEventListener('pointerup', up)
      return
    }
    const r = e.currentTarget.closest('[data-bar]')!.getBoundingClientRect()
    const s = scaleOf()
    const day0 = Math.floor(dayAt(e.clientX))
    const el = timeLayer.current!.getBoundingClientRect()
    const atOf = (ev: { clientX: number; clientY: number }): [number, number] => [(ev.clientX - el.left) / s, (ev.clientY - el.top) / s]
    setDrag({ id: it.task.id, how, from: [e.clientX, e.clientY], day0, s0: it.s, e0: it.e, point: it.point, row0: row, moving: false, s: it.s, e: it.e, row, at: atOf(e), grab: [(e.clientX - r.left) / s, (e.clientY - r.top) / s] })
    const follow = (ev: { clientX: number; clientY: number }) => {
      const d = dragRef.current
      if (!d) return
      const moving = d.moving || Math.hypot(ev.clientX - d.from[0], ev.clientY - d.from[1]) > 4
      if (!moving) return
      const by = Math.floor(dayAt(ev.clientX)) - d.day0
      const lr = timeLayer.current!.getBoundingClientRect()
      const at: [number, number] = [(ev.clientX - lr.left) / s, (ev.clientY - lr.top) / s]
      let { s0: ns, e0: ne } = d
      if (d.how === 'move') ((ns = d.s0 + by), (ne = d.e0 + by))
      else if (d.how === 'start') ns = Math.min(d.s0 + by, d.e0)
      else ne = Math.max(d.s0, d.e0 + by)
      const row = d.how === 'move' ? (rowAt(ev.clientY)?.key ?? d.row0) : d.row0
      setDrag({ ...d, moving, s: ns, e: ne, row, at })
    }
    const move = (ev: PointerEvent) => ((edge.current.x = ev.clientX), follow(ev))
    let last: { clientX: number; clientY: number } = e
    const track = (ev: PointerEvent) => ((last = ev), move(ev))
    edge.current.x = e.clientX
    edgeScroll(() => follow(last))
    const up = () => {
      window.removeEventListener('pointermove', track)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      edgeStop()
      const d = dragRef.current
      setDrag(null)
      if (!d?.moving) return pick(it.task)
      const fields: TaskFields = {}
      const t = it.task
      if (d.how === 'move') {
        if (d.e !== d.e0) fields.due = iso(d.e)
        if (!d.point && d.s !== d.s0) fields.start = iso(d.s)
        // Another row by person or card: that too (a lane that takes nothing, or rows by deck, keep theirs).
        if (field && d.row !== d.row0) Object.assign(fields, field.set(d.row) ?? {})
      } else if (d.how === 'start') {
        // A ◆ given a first day on its due day stays a ◆.
        if (d.s !== d.s0 && !(d.point && d.s === d.e0)) fields.start = iso(d.s)
      } else if (d.e !== d.e0) fields.due = iso(d.e)
      if (!Object.keys(fields).length) return
      const what = d.how === 'start' ? (d.point ? 'give a task a first day' : 'change a task’s first day') : d.how === 'due' ? 'change a task’s due day' : 'move a task to other days'
      void updateTask(wid, t, fields, what)
    }
    window.addEventListener('pointermove', track)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // A press on empty space: a drag moves along the days (sideways) and the rows (up and down); let go without moving,
  // what's picked lets go. A flick keeps going and slows.
  const pan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live || (e.button !== 0 && e.button !== 1)) return
    e.stopPropagation()
    stopStrip(piece.id)
    const s = scaleOf()
    const start = stripOf(piece.id)
    const [sx, sy] = [e.clientX, e.clientY]
    let [lx, lt, v] = [e.clientX, performance.now(), 0]
    let moved = false
    const el = board.current!
    el.dataset.panning = 'true'
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4) moved = true
      const t = performance.now()
      v = (ev.clientX - lx) / Math.max(1, t - lt)
      ;[lx, lt] = [ev.clientX, t]
      setStrip(piece.id, { from: start.from - (ev.clientX - sx) / s / ppd, top: Math.max(0, Math.min(maxTopRef.current, start.top - (ev.clientY - sy) / s)) })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      delete el.dataset.panning
      if (!moved) return void useKanbanUi.setState({ selected: null, many: null })
      if (isReducedMotion() || performance.now() - lt > 60) return
      let vel = (v * 16) / s / ppd
      const decay = () => {
        if (Math.abs(vel) < 0.01) return
        setStrip(piece.id, { from: stripOf(piece.id).from - vel })
        vel *= 0.92
        motion.set(piece.id, requestAnimationFrame(decay))
      }
      motion.set(piece.id, requestAnimationFrame(decay))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // The overview: a press jumps there (glides), a drag on its window moves along.
  const scrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live || e.button !== 0) return
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const { lo, hi } = layoutRef.current
    const dayOfX = (x: number) => lo + ((x - r.left) / r.width) * (hi - lo)
    const s = stripOf(piece.id)
    const onWin = !!(e.target as HTMLElement).closest('[data-window]')
    const grab = onWin ? dayOfX(e.clientX) - s.from : visible / 2
    if (!onWin) glideStrip(piece.id, { from: dayOfX(e.clientX) - visible / 2 }, 300)
    const move = (ev: PointerEvent) => (stopStrip(piece.id), setStrip(piece.id, { from: dayOfX(ev.clientX) - grab }))
    const up = () => (window.removeEventListener('pointermove', move), window.removeEventListener('pointerup', up))
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // The wheel: sideways (or with shift) moves along the days, a pinch (or ⌘) changes the scale round the pointer, up and
  // down scrolls the rows (or, when they all show, moves along the days). Never the view's zoom: text stays its size.
  useEffect(() => {
    const el = board.current?.closest<HTMLElement>('[data-timeline]')
    if (!live || !el) return
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[role=dialog], [role=menu], section')) return
      e.preventDefault()
      e.stopPropagation()
      stopStrip(piece.id)
      const s = stripOf(piece.id)
      const k = scaleOf()
      if (e.ctrlKey || e.metaKey) {
        const r = timeLayer.current?.parentElement?.getBoundingClientRect()
        const at = r ? Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) : 0.5
        const to = Math.max(PPD_MIN, Math.min(PPD_MAX, s.ppd * Math.exp(-e.deltaY * 0.012)))
        const day = s.from + s.span * at
        return setStrip(piece.id, { ppd: to, from: day - ((s.span * s.ppd) / to) * at })
      }
      const dx = e.shiftKey ? e.deltaY || e.deltaX : e.deltaX
      const sideways = Math.abs(dx) > Math.abs(e.shiftKey ? 0 : e.deltaY)
      if (sideways || maxTopRef.current === 0) setStrip(piece.id, { from: s.from + (sideways ? dx : e.deltaY) / k / s.ppd })
      else setStrip(piece.id, { top: Math.max(0, Math.min(maxTopRef.current, s.top + e.deltaY / k)) })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, piece.id])

  // Going to one of its tasks (the finder, your tasks, D-298): its days glided to it, its rows scrolled to it.
  useEffect(() => {
    if (!live) return
    return registerStrip(piece.id, (id) => {
      const l = layoutRef.current
      if (l.tray.some((t) => t.id === id)) return true
      for (const r of l.rows) {
        const it = r.items.find((x) => x.task.id === id)
        if (!it) continue
        const s = stripOf(piece.id)
        const y = r.top + T.pad + it.lane * (T.bar + T.gap)
        const inDays = it.s >= s.from && it.e <= s.from + s.span
        const inRows = y >= s.top && y + T.bar <= s.top + rowsShown
        glideStrip(piece.id, { ...(!inDays && { from: (it.s + it.e) / 2 - s.span / 2 }), ...(!inRows && { top: Math.max(0, Math.min(maxTopRef.current, y - rowsShown / 2)) }) })
        return true
      }
      return false
    })
  }, [live, piece.id, rowsShown])

  // Hovering an empty day in a row's lane: a `+`; press it and draw across days.
  const hover = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live || !editor || dragRef.current || draft) return
    if ((e.target as HTMLElement).closest('[data-bar], [data-ghost]')) {
      if (!(e.target as HTMLElement).closest('[data-ghost]') && ghost) setGhost(null)
      return
    }
    // Over the rows' names, no day: no `+` (it would sit off the strip, and go as the pointer reached it).
    const strip = timeLayer.current?.getBoundingClientRect()
    if (!strip || e.clientX < strip.left) return ghost && setGhost(null)
    const r = rowAt(e.clientY)
    if (!r) return setGhost(null)
    const day = Math.floor(dayAt(e.clientX))
    const lane = Math.floor((rowY(e.clientY) - r.top - T.pad) / (T.bar + T.gap))
    const busy = lane < 0 || lane >= r.lanes || r.items.some((it) => it.lane === lane && it.x0 < (day + 1) * ppd && it.x1 > day * ppd)
    if (busy) return ghost && setGhost(null)
    if (ghost?.row !== r.key || ghost.day !== day || ghost.lane !== lane) setGhost({ row: r.key, day, lane })
  }
  const draw = (e: ReactPointerEvent<HTMLElement>) => {
    if (!ghost || e.button !== 0) return
    e.stopPropagation()
    const g = ghost
    setGhost(null)
    setDraft({ row: g.row, d0: g.day, s: g.day, e: g.day, naming: false })
    const follow = (x: number) => {
      const d = Math.floor(dayAt(x))
      setDraft((v) => (v && !v.naming ? { ...v, s: Math.min(v.d0, d), e: Math.max(v.d0, d) } : v))
    }
    const move = (ev: PointerEvent) => ((edge.current.x = ev.clientX), follow(ev.clientX))
    edge.current.x = e.clientX
    edgeScroll(() => follow(edge.current.x))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      edgeStop()
      setDraft((v) => (v ? { ...v, naming: true } : v))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  // Its deck: the row's (rows by deck), the one it's linked to, else the first.
  const deckFor = (row: string) => {
    const kanbans = timelineKanbans(piece, now().pieces)
    return (mode === 'kanban' ? kanbans.find((k) => k.id === row) : undefined) ?? kanbans.find((k) => k.id === piece.stuckTo) ?? kanbans[0]
  }
  // Picked (D-300): a card (the task named after it, for it) or what was typed (a task with no card): a new task on its
  // deck, in its first column, with those days and the row's person or card. Escape: nothing.
  const make = (title: string, card?: Card) => {
    const d = draft
    setDraft(null)
    if (!d || !title.trim() || !user) return
    const { tasks: every } = now()
    const deck = deckFor(d.row)
    const col = deck ? kanbanOf(deck).cols.find((c) => !c.done) ?? kanbanOf(deck).cols[0] : undefined
    if (!deck || !col) return
    const last = tasksIn(every.filter((t) => t.pieceId === deck.id), col.id).at(-1)?.order
    const fields: TaskFields = { due: iso(d.e), ...(d.s < d.e && { start: iso(d.s) }), ...(field ? field.set(d.row) ?? {} : {}), ...(card && { cardId: card.id, cardType: card.type }) }
    const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as TaskFields
    const id = addTask(wid, deck.id, col.id, orderBetween(last, undefined), title, user.id, clean)
    selectTask(deck.id, id)
  }

  // A tray task held: dropped on a day, that's its due day (and the row's person or card).
  const pressTray = (t: Task) => (e: ReactPointerEvent<HTMLElement>) => {
    if (!live || e.button !== 0) return
    e.stopPropagation()
    if (!editor) {
      const up = () => (window.removeEventListener('pointerup', up), pick(t))
      window.addEventListener('pointerup', up)
      return
    }
    const [sx, sy] = [e.clientX, e.clientY]
    let moved = false
    const s = scaleOf()
    const atOf = (ev: { clientX: number; clientY: number }): [number, number] => {
      const r = board.current!.getBoundingClientRect()
      return [(ev.clientX - r.left) / s, (ev.clientY - r.top) / s]
    }
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return
      moved = true
      setTrayHeld({ id: t.id, at: atOf(ev) })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setTrayHeld(null)
      if (!moved) return pick(t)
      const lr = timeLayer.current?.parentElement?.getBoundingClientRect()
      if (!lr || ev.clientX < lr.left || ev.clientX > lr.right || ev.clientY < lr.top || ev.clientY > lr.bottom) return
      const fields: TaskFields = { due: iso(Math.floor(dayAt(ev.clientX))) }
      const r = rowAt(ev.clientY)
      if (field && r) Object.assign(fields, field.set(r.key) ?? {})
      void updateTask(wid, t, fields, 'give a task a day')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // What's drawn, in the time layer's px (day `origin` at 0).
  const days = Array.from({ length: 3 * span }, (_, i) => origin + i)
  const X = (d: number) => (d - origin) * ppd
  const lo = origin - 1
  const hi = origin + 3 * span + 1
  const tone = (t: Task) => (t.cardType ? TYPE_ACCENT[t.cardType] : undefined)
  const held = drag?.moving ? drag : null
  const vars = { ['--left' as string]: `${T.left}px`, ['--bar' as string]: `${T.bar}px`, ['--over' as string]: `${T.over}px`, ['--head' as string]: `${T.head}px` } as CSSProperties

  const sheet = (it: Item, row: string, s: number, e: number, y: number, lifted = false) => {
    const t = it.task
    const tn = tone(t)
    const g = lifted ? { ...boxOf(t, s, e, it.point, it.late, it.finished, ppd, todayAt) } : { x: it.x, w: it.w, out: it.out }
    if (!lifted && (s !== it.s || e !== it.e)) Object.assign(g, boxOf(t, s, e, it.point, it.late, it.finished, ppd, todayAt))
    const isSel = selected === t.id
    const left = g.x - origin * ppd
    const checks = t.checks?.length ? t.checks.filter((c) => c.done).length / t.checks.length : null
    const hatch = it.late && !lifted ? { x: (e + 1) * ppd - inset(ppd) - origin * ppd, w: (todayAt - e) * ppd + inset(ppd) } : null
    const style = { left, top: y, width: g.w, ...(tn ? { ['--tone' as string]: tn } : {}), ...(lifted && { left: held!.at[0] - Math.min(held!.grab[0], g.w - 6), top: held!.at[1] - held!.grab[1], scale: '0.8', transformOrigin: `${Math.min(held!.grab[0], g.w - 6)}px ${held!.grab[1]}px` }) } as CSSProperties
    const resizing = drag?.moving && drag.id === t.id && drag.how !== 'move'
    return (
      <>
        <div
          key={t.id}
          className={styles.task}
          data-bar
          data-task={lifted ? undefined : t.id}
          data-point={it.point || undefined}
          data-late={it.late || undefined}
          data-finished={it.finished || undefined}
          data-selected={isSel || undefined}
          data-lifted={lifted || undefined}
          style={style}
          title={`${t.title}${t.due ? ` · ${t.start ? `${short(dayOf(t.start))} → ` : ''}${short(dayOf(t.due))}` : ''}`}
          tabIndex={live && !lifted ? 0 : -1}
          onPointerDown={lifted ? undefined : press(it, row, 'move')}
          onKeyDown={(ev) => ev.key === 'Enter' && live && pick(t)}
          aria-hidden={lifted || undefined}
        >
          {it.point && <span className={styles.dia} />}
          <span className={styles.label} data-out={g.out || undefined} {...(!g.out && !it.point && { 'data-sticky': left, 'data-w': g.w })} style={g.out && hatch && hatch.w > 0 ? { left: hatch.x - left + hatch.w + 74 } : undefined}>
            {it.finished && <span className={styles.ok}>✓</span>}
            {t.priority && <span className={styles.p} data-p={t.priority}>{t.priority}</span>}
            {t.title}
          </span>
          {checks !== null && !it.finished && !it.point && (
            <span className={styles.checks}>
              <i style={{ width: `${checks * 100}%` }} />
            </span>
          )}
          {live && !lifted && isSel && editor && !it.finished && (
            <>
              <span className={styles.grip} data-side={it.point ? 'give' : 'start'} title={it.point ? 'drag left to give it a first day' : 'its first day'} onPointerDown={press(it, row, 'start')} />
              {!it.point && <span className={styles.grip} data-side="due" title="its due day" onPointerDown={press(it, row, 'due')} />}
            </>
          )}
          {live && !lifted && <Marks tone={tn} selected={isSel} pressed={drag?.id === t.id && !drag.moving} />}
        </div>
        {resizing && (
          <span key={`${t.id}-days`} className={styles.readout} style={{ left, top: y }}>
            {short(s)} → {short(e)} · {e - s + 1} days
          </span>
        )}
        {hatch && hatch.w > 0 && (
          <span key={`${t.id}-late`} className={styles.hatch} style={{ left: hatch.x, top: y, width: hatch.w }}>
            <span>+{todayAt - e}d late</span>
          </span>
        )}
      </>
    )
  }

  const shown = Math.ceil(visible)
  return (
    <div ref={board} className={styles.board} style={{ ...vars, width: w, height: boardH }} data-dragging={held || trayHeld ? true : undefined} onPointerDown={pan} onPointerMove={hover} onPointerLeave={() => ghost && setGhost(null)}>
      {/* The overview: every day's load as a bar glyph, months under it, today a tick, the window you see. */}
      <div className={styles.over} onPointerDown={scrub}>
        <Overview layout={layout} tw={tw} />
        <span className={styles.overToday} style={{ left: ((todayAt - layout.lo) / (layout.hi - layout.lo)) * tw }} />
        <div ref={win} className={styles.window} data-window />
      </div>
      <span className={styles.overName}>
        overview
        <span>
          {short(layout.lo)} – {short(layout.hi)}
        </span>
      </span>
      {/* The days' head: months (their number magenta) and days, by scale; today cyan. */}
      <div className={styles.headClip}>
        <div ref={headLayer} className={styles.timeLayer}>
          {days.map((d) => {
            const date = dateOf(d)
            const dt = date.getUTCDate()
            const m = date.getUTCMonth()
            const isToday = d === todayAt
            const label = ppd >= 90 ? `${WD[dow(d)]} ${dt}` : ppd >= 30 ? `${WD[dow(d)][0]} ${dt}` : ppd >= 12 ? (dow(d) === 0 || isToday ? `${dt}` : '') : dow(d) === 0 && (ppd * 7 >= 40 || isoWeek(d) % 2 === 0) ? `w${isoWeek(d)}` : ''
            return (
              <span key={d}>
                {dt === 1 && (
                  <span className={styles.month} style={{ left: X(d) }}>
                    <b>{String(m + 1).padStart(2, '0')}</b>
                    {ppd * 30 > 260 ? `${MONTH[m]} ${date.getUTCFullYear()}` : MON[m]}
                  </span>
                )}
                {label && (
                  <span className={styles.dayHead} data-today={isToday || undefined} data-weekend={dow(d) >= 5 || undefined} style={{ left: X(d) }}>
                    {label}
                  </span>
                )}
              </span>
            )
          })}
          <span className={styles.headToday} style={{ left: X(todayAt) + (ppd >= 60 ? 0 : ppd / 2) }} />
        </div>
      </div>
      {/* The rows: names on the left, the days' cells, its tasks; scrolled up and down inside its height. */}
      <div className={styles.rowsClip} style={{ height: rowsShown }}>
        <div ref={rowsInner} className={styles.rowsInner} style={{ height: layout.rowsH }}>
          <div className={styles.timeClip}>
            <div ref={timeLayer} className={styles.timeLayer}>
              {days.map((d) => (
                <span key={d}>
                  {dow(d) === 5 && ppd >= 5 && <span className={styles.weekend} style={{ left: X(d), width: 2 * ppd }} />}
                  {dateOf(d).getUTCDate() === 1 ? <span className={styles.monthLine} style={{ left: X(d) }} /> : (ppd >= 20 || (ppd >= 9 && dow(d) === 0)) && <span className={styles.dayLine} style={{ left: X(d) }} />}
                </span>
              ))}
              <span className={styles.today} style={{ left: X(todayAt) + (ppd >= 60 ? 0 : ppd / 2) }} />
              {layout.rows.flatMap((r) =>
                r.items
                  .filter((it) => it.x1 / ppd >= lo && it.x0 / ppd <= hi && !(held?.id === it.task.id && held.how === 'move'))
                  .map((it) => {
                    const d = drag?.moving && drag.id === it.task.id ? drag : null
                    return <span key={it.task.id}>{sheet(it, r.key, d ? d.s : it.s, d ? d.e : it.e, r.top + T.pad + it.lane * (T.bar + T.gap))}</span>
                  }),
              )}
              {/* Held (D-265): 0.8 round the point held under the pointer, its marks where it lands. */}
              {held?.how === 'move' &&
                (() => {
                  const it = layout.rows.flatMap((r) => r.items).find((x) => x.task.id === held.id)
                  const r = layout.rows.find((x) => x.key === held.row)
                  if (!it || !r) return null
                  const b = boxOf(it.task, held.s, held.e, it.point, false, it.finished, ppd, todayAt)
                  const lane = held.row === held.row0 ? it.lane : 0
                  const y = r.top + T.pad + lane * (T.bar + T.gap)
                  return (
                    <>
                      <Landing x={b.x - origin * ppd} y={y} w={b.w} h={T.bar} zoom={screen} tone={tone(it.task)} />
                      <span className={styles.readout} style={{ left: b.x - origin * ppd, top: y }}>
                        {it.point ? `due ${short(held.e)}` : `${short(held.s)} → ${short(held.e)} · ${held.e - held.s + 1} days`}
                      </span>
                      {sheet(it, held.row, held.s, held.e, 0, true)}
                    </>
                  )
                })()}
              {ghost && !draft && (
                (() => {
                  const r = layout.rows.find((x) => x.key === ghost.row)
                  if (!r) return null
                  const gw = Math.max(22, ppd - 6)
                  return (
                    <span className={styles.ghost} data-ghost style={{ left: X(ghost.day) + (ppd - gw) / 2, top: r.top + T.pad + ghost.lane * (T.bar + T.gap), width: gw }} onPointerDown={draw} title="press and drag across days: a new task">
                      {ppd >= 60 ? '+ task' : '+'}
                    </span>
                  )
                })()
              )}
              {draft &&
                (() => {
                  const r = layout.rows.find((x) => x.key === draft.row)
                  if (!r) return null
                  const y = r.top + T.pad
                  const x = X(draft.s) + inset(ppd)
                  const dw = (draft.e - draft.s + 1) * ppd - 2 * inset(ppd)
                  return (
                    <>
                      <span className={styles.draft} style={{ left: x, top: y, width: dw }} />
                      <span className={styles.readout} style={{ left: x, top: y }}>
                        {short(draft.s)} → {short(draft.e)} · {draft.e - draft.s + 1} days
                      </span>
                      {draft.naming && <DraftPick left={x} top={y} width={Math.max(320, dw)} plane={deckFor(draft.row)?.stuckTo ?? piece.stuckTo} onCard={(c) => make(c.title || `untitled ${c.type}`, c)} onText={(t) => make(t)} onCancel={() => make('')} />}
                    </>
                  )
                })()}
            </div>
          </div>
          {layout.rows.map((r) => (
            <span key={r.key} className={styles.rowName} data-none={!r.drop || undefined} style={{ top: r.top + T.pad, ...(r.tone ? ({ ['--tone' as string]: r.tone } as CSSProperties) : {}) }}>
              {r.initials && <span className={styles.who}>{r.initials}</span>}
              {r.kind && <span className={styles.kind}>▌</span>}
              <span className={styles.rowLabel}>{r.label}</span>
              <span className={styles.rowCount}>{r.items.length || ''}</span>
            </span>
          ))}
          {layout.rows.map((r) => (
            <span key={`rule-${r.key}`} className={styles.rule} style={{ top: r.top + r.h - 1 }} />
          ))}
          <Edges piece={piece} layout={layout} ppd={ppd} shown={shown} />
        </div>
      </div>
      {/* No day yet: a tray under the rows. */}
      <div className={styles.tray} style={{ top: TOP + 8 + rowsShown + 16 }}>
        <span className={styles.trayLabel}>no day · {layout.tray.length}</span>
        {layout.tray.map((t) =>
          t.id === trayHeld?.id ? null : (
            <button key={t.id} className={styles.pill} data-task={t.id} data-selected={selected === t.id || undefined} style={tone(t) ? ({ ['--tone' as string]: tone(t) } as CSSProperties) : undefined} tabIndex={live ? 0 : -1} onPointerDown={pressTray(t)}>
              <span className={styles.line}>☐ {t.title}</span>
              {live && <Marks tier="s" tone={tone(t)} selected={selected === t.id} />}
            </button>
          ),
        )}
        {!layout.tray.length && <span className={styles.trayNone}>every task has a day</span>}
        {live && editor && layout.tray.length > 0 && <span className={styles.trayHint}>drag onto a day to give it one</span>}
      </div>
      {trayHeld &&
        (() => {
          const t = layout.tray.find((x) => x.id === trayHeld.id)
          return t ? (
            <span className={styles.pill} data-lifted style={{ left: trayHeld.at[0] - 10, top: trayHeld.at[1] - 10, ...(tone(t) ? { ['--tone' as string]: tone(t) } : {}) } as CSSProperties}>
              <span className={styles.line}>☐ {t.title}</span>
            </span>
          ) : null
        })()}
    </div>
  )
})

// The overview's glyphs: for every few days, how many tasks run then (the busiest of them), `▁` to `█`; months under.
const Overview = memo(function Overview({ layout, tw }: { layout: Layout; tw: number }) {
  const { lo, hi } = layout
  const chars = Math.max(1, Math.floor(tw / 6.6))
  const load = new Array(hi - lo).fill(0)
  for (const r of layout.rows) for (const it of r.items) for (let d = Math.max(lo, it.s); d <= Math.min(hi - 1, it.late ? dayOf(today()) : it.e); d++) load[d - lo]++
  const G = ' ▁▂▃▄▅▆▇█'
  let line = ''
  for (let c = 0; c < chars; c++) {
    const a = Math.floor((c * load.length) / chars)
    const b = Math.max(a + 1, Math.floor(((c + 1) * load.length) / chars))
    line += G[Math.min(8, Math.round(Math.max(...load.slice(a, b)) * 1.3))]
  }
  const months: number[] = []
  for (let d = lo; d < hi; d++) if (dateOf(d).getUTCDate() === 1) months.push(d)
  return (
    <>
      <span className={styles.density}>{line}</span>
      {months.map((d) => (
        <span key={d} className={styles.overMonth} style={{ left: ((d - lo) / (hi - lo)) * tw }}>
          {MON[dateOf(d).getUTCMonth()]}
        </span>
      ))}
    </>
  )
})

// What's past the edges, per row: `‹ 2` / `3 ›`, a click glides to the nearest. Drawn again only as a whole day passes.
function Edges({ piece, layout, ppd, shown }: { piece: WithId<Piece>; layout: Layout; ppd: number; shown: number }) {
  const from = useStrip((s) => Math.floor(s[piece.id]?.from ?? startFor(shown)))
  const to = from + shown
  return (
    <>
      {layout.rows.map((r) => {
        const left = r.items.filter((it) => (it.late ? dayOf(today()) : it.e) < from && it.x1 / ppd < from)
        const right = r.items.filter((it) => it.s > to)
        const y = r.top + T.pad + 5
        const go = (it: Item) => (e: ReactPointerEvent) => {
          e.stopPropagation()
          glideStrip(piece.id, { from: (it.s + it.e) / 2 - shown / 2 })
        }
        return (
          <span key={r.key}>
            {left.length > 0 && (
              <button className={styles.edge} style={{ left: T.left + 4, top: y }} onPointerDown={go(left.reduce((a, b) => (b.e > a.e ? b : a)))} title="earlier tasks: glide to the nearest">
                ‹ {left.length}
              </button>
            )}
            {right.length > 0 && (
              <button className={styles.edge} style={{ right: 4, top: y }} onPointerDown={go(right.reduce((a, b) => (b.s < a.s ? b : a)))} title="later tasks: glide to the nearest">
                {right.length} ›
              </button>
            )}
          </span>
        )
      })}
    </>
  )
}

// A new task's name, typed where it was drawn: Enter keeps it, Escape (or leaving it empty) takes it away.
// A new task's what (D-300): the card prompt, the cards of its deck's plane suggested first (`# suggested · on Pazar`), then
// every card by type; what's typed, last, makes it a task with no card. Escape or a press away: nothing.
function DraftPick({ left, top, width, plane, onCard, onText, onCancel }: { left: number; top: number; width: number; plane?: string; onCard: (c: Card) => void; onText: (title: string) => void; onCancel: () => void }) {
  const { cards, places, pieces } = useWs()
  const done = useRef(false)
  const once = <A,>(f: (a: A) => void) => (a: A) => {
    if (done.current) return
    done.current = true
    f(a)
  }
  const on = pieces.find((p) => p.id === plane)
  const suggest = useMemo(() => (on ? cardsOn(cards, places, on.id).slice(0, 6).map((c) => ({ id: c.id, why: `on ${on.name || 'its plane'}` })) : undefined), [cards, places, on])
  // Where the days were drawn, on the screen: the prompt opens under it, over everything (nothing round the strip cuts
  // it), kept on the screen.
  const anchor = useRef<HTMLSpanElement>(null)
  const [at, setAt] = useState<{ x: number; y: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const r = anchor.current?.getBoundingClientRect()
    if (!r) return
    const w = Math.max(320, Math.min(420, r.width))
    setAt({ x: Math.max(8, Math.min(innerWidth - w - 8, r.left)), y: Math.min(r.bottom + 4, innerHeight - 380), w })
  }, [])
  return (
    <>
      <span ref={anchor} className={styles.pickAt} style={{ left, top, width }} aria-hidden />
      {at &&
        createPortal(
          <div className={styles.pick} style={{ left: at.x, top: at.y, width: at.w }} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <CardPicker
              card={NO_CARD}
              cards={cards}
              types={null}
              exclude={NONE}
              make={false}
              suggest={suggest}
              prompt="a card it's for, or type a task…"
              orTyped={(typed) => ({ key: '+text', label: `“${typed}”`, glyph: '☐', hint: 'A TASK WITH NO CARD', onSelect: () => once(onText)(typed) })}
              onPick={once(onCard)}
              onClose={() => once(onCancel)(undefined)}
            />
          </div>,
          document.body,
        )}
    </>
  )
}

const NO_CARD = { id: '', type: 'idea', pieceId: '', title: '', x: 0, y: 0 } as Card
const NONE = new Set<string>()

// Its tools in its dock (its focus, beside its deck): its filter, its rows, its scale and days.
export function TimelineDockTools({ piece, editor }: { piece: WithId<Piece>; editor: boolean }) {
  const { pieces, tasks } = useWs()
  const kanbans = timelineKanbans(piece, pieces)
  const pool = useMemo(() => tasks.filter((t) => kanbans.some((k) => k.id === t.pieceId)), [tasks, kanbans])
  return (
    <>
      <KanbanFilterDock piece={piece} pool={pool} />
      <TimelineRowsMenu piece={piece} editor={editor} />
      <WeekTools piece={piece} />
    </>
  )
}

// Its scale and `‹ today ›` in a dock (yours): a week back or on, or back to today. Also the tasks side view's days
// (D-300), whose timeline may be none.
export function WeekTools({ piece }: { piece: Pick<Piece, 'kind'> & { id: string } }) {
  const s = useStrip((st) => st[piece.id])
  const ppd = s?.ppd ?? STRIP_SCALES[1].ppd
  const now = dayOf(today())
  const onToday = !!s && now >= s.from && now < s.from + s.span
  const step = (by: number) => glideStrip(piece.id, { from: stripOf(piece.id).from + by * 7 })
  const near = STRIP_SCALES.reduce((a, b) => (Math.abs(Math.log(ppd / b.ppd)) < Math.abs(Math.log(ppd / a.ppd)) ? b : a))
  return (
    <>
      {STRIP_SCALES.map((sc) => (
        <DockAction key={sc.name} label={sc.name} pressed={sc === near && Math.abs(Math.log(ppd / sc.ppd)) < 0.25} title={`${sc.ppd} px a day (a pinch on it changes it too)`} onClick={() => scaleStrip(piece.id, sc.ppd)} />
      ))}
      <DockAction label="‹" title="a week back" onClick={() => step(-1)} />
      <DockAction label="today" pressed={onToday} title="back to today" onClick={() => toToday(piece.id)} />
      <DockAction label="›" title="a week on" onClick={() => step(1)} />
    </>
  )
}

// Its days on the canvas, unframed (D-289): `‹ today ›` in its console, as in its dock.
export function TimelineWeeks({ piece, toolClass }: { piece: WithId<Piece>; toolClass: string }) {
  const s = useStrip((st) => st[piece.id])
  const now = dayOf(today())
  const onToday = !!s && now >= s.from && now < s.from + s.span
  const step = (by: number) => glideStrip(piece.id, { from: stripOf(piece.id).from + by * 7 })
  return (
    <>
      <button className={toolClass} title="a week back" aria-label="A week back" onClick={() => step(-1)}>
        ‹
      </button>
      <button className={toolClass} aria-pressed={onToday} title="back to today" onClick={() => toToday(piece.id)}>
        today
      </button>
      <button className={toolClass} title="a week on" aria-label="A week on" onClick={() => step(1)}>
        ›
      </button>
    </>
  )
}

const ROW_NAME: Record<TimelineRows, string> = { kanban: 'deck', assignee: 'given to', card: 'card' }

// Its rows (shared): by deck, by who it's given to, by the card it's for.
function TimelineRowsMenu({ piece, editor }: { piece: WithId<Piece>; editor: boolean }) {
  const { wid } = useWs()
  const rows = piece.timeline?.rows ?? 'kanban'
  const items: MenuEntry[] = TIMELINE_ROWS.map((r) => ({ key: r, label: `by ${ROW_NAME[r]}`, checked: rows === r, onSelect: () => editor && rows !== r && void setTimeline(wid, piece.id, { rows: r === 'kanban' ? undefined : r }, 'change a timeline’s rows') }))
  return <Menu label="rows" up plain summary={ROW_NAME[rows]} items={items} ariaLabel="Rows" noun="ways" />
}
