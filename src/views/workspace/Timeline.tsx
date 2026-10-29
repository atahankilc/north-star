// A timeline (D-262): a piece on the canvas (`+ → timeline`) showing kanbans' tasks on a row of days, by due day. Drawn
// in its own px through a view, like a kanban (D-251): a picture on the canvas, live in its focus or beside the kanban
// it's stuck to. Which kanbans: the one it's linked to, else every kanban (D-289). Rows: one per
// kanban, or by who a task is given to, or by the card it's for (rows.ts, as a kanban's lanes). Two weeks from Monday,
// `‹ today ›` stepping a week (yours, per tab); today a cyan line, weekends a shade darker. A task sits on its day as a
// sheet in its card's colour; past its day and not finished it sits on today in magenta, `← 25` saying when it was due;
// finished, faint with a green `✓`. Tasks with no day wait in a tray under the rows. Dragging a task (or one from the
// tray) onto a day gives it that day; onto another row (by person or card) gives it that person or card too; rows by
// kanban keep it on its kanban. A click opens its panel (TaskPanel). Its own filter (the kanban's strip, its tasks).
import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { create } from 'zustand'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { useAuth } from '../../data/auth'
import { setTimeline, shownTasks, timelineKanbans, today, TIMELINE_ROWS, updateTask, type Task, type TaskFields, type TimelineRows } from '../../data/tasks'
import { camOf, type Bounds, type PlaneCam } from '../../state/canvasView'
import { Menu, type MenuEntry } from '../../ui/Menu'
import { useWs } from './context'
import { DockAction } from './FocusDock'
import { kanbanOf, selectTask, useKanbanUi } from './Kanban'
import { KanbanFilterDock } from './KanbanFilterDock'
import { passes, useKanbanFilter } from './kanbanFilter'
import { TYPE_ACCENT } from './PlaneCards'
import { taskRows, type Lane } from './rows'
import { Landing, Marks, useSettledZoom, zsIn } from '../../ui/Marks'
import { useOpenSize } from './sizes'
import styles from './Timeline.module.css'

// Its parts in its own px: the rows' names, a day, the days' head, a task, the gap between, a row's padding, the tray;
// how many days (beside a kanban, `besideDays`).
export const T = { left: 150, day: 150, head: 44, bar: 30, gap: 6, pad: 10, tray: 64, days: 14, besideDays: 7 }

// The week it starts on, per timeline, yours: 0 = this week.
const useWeeks = create<Record<string, number>>(() => ({}))
const DAY_MS = 86400000
const dayOf = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
function startOf(week: number) {
  const t = dayOf(today())
  const dow = (new Date(t).getUTCDay() + 6) % 7
  return t - dow * DAY_MS + week * 7 * DAY_MS
}

type Placed = { task: Task; row: string; day: number; late: boolean; finished: boolean; slot: number }
type Layout = { span: number; rows: (Lane & { top: number; h: number })[]; placed: Placed[]; tray: Task[]; from: number; later: number; earlier: number; h: number; w: number }

// Its tasks, where they go: rows, days, slots, the tray; and its size.
// `span`: how many days (two weeks; one beside a kanban, where it has half the screen).
function layoutOf(piece: WithId<Piece>, all: WithId<Piece>[], tasks: Task[], cards: { id: string; type: string; pieceId: string; title?: string }[], week: number, filterOk: (t: Task, finished: boolean) => boolean, me: { id: string; name: string } | undefined, span = T.days): Layout {
  const kanbans = timelineKanbans(piece, all)
  const done = new Set(kanbans.flatMap((k) => kanbanOf(k).cols.filter((c) => c.done).map((c) => `${k.id}|${c.id}`)))
  const pool = kanbans.flatMap((k) => shownTasks(tasks.filter((t) => t.pieceId === k.id), k, cards as never)).filter((t) => filterOk(t, done.has(`${t.pieceId}|${t.col}`)))
  const mode: TimelineRows = piece.timeline?.rows ?? 'kanban'
  const names = new Map(pool.flatMap((t) => (t.assignee && t.assigneeName ? [[t.assignee, t.assigneeName] as const] : [])))
  const field = mode === 'kanban' ? null : taskRows(mode, cards as never, { me, names })
  const lanes: Lane[] = field ? field.lanes(pool) : kanbans.map((k) => ({ key: k.id, label: k.name || 'deck', drop: true }))
  const rowOf = (t: Task) => (field ? field.laneOf(t) : t.pieceId)
  const from = startOf(week)
  const now = dayOf(today())
  const todayAt = Math.round((now - from) / DAY_MS)
  const placed: Placed[] = []
  const tray: Task[] = []
  let later = 0
  let earlier = 0
  for (const t of pool) {
    const finished = done.has(`${t.pieceId}|${t.col}`)
    if (!t.due) {
      if (!finished) tray.push(t)
      continue
    }
    let day = Math.round((dayOf(t.due) - from) / DAY_MS)
    const late = !finished && t.due < today()
    if (late && todayAt >= 0 && todayAt < span) day = todayAt
    if (day < 0) earlier++
    else if (day >= span) later++
    else placed.push({ task: t, row: rowOf(t), day, late, finished, slot: 0 })
  }
  // Stacked in each day of a row: late first, then by title.
  placed.sort((a, b) => Number(b.late) - Number(a.late) || a.task.title.localeCompare(b.task.title))
  const used = new Map<string, number>()
  for (const p of placed) {
    const k = `${p.row}|${p.day}`
    p.slot = used.get(k) ?? 0
    used.set(k, p.slot + 1)
  }
  let top = T.head
  const rows = lanes.map((l) => {
    const most = Math.max(1, ...[...used].filter(([k]) => k.startsWith(`${l.key}|`)).map(([, n]) => n))
    const h = 2 * T.pad + most * T.bar + (most - 1) * T.gap
    const r = { ...l, top, h }
    top += h
    return r
  })
  return { span, rows, placed, tray, from, later, earlier, h: top + 16 + T.tray, w: T.left + span * T.day + 24 }
}

// The box round it, in its px: what fit frames.
export function timelineBounds(piece: WithId<Piece>, all: WithId<Piece>[], tasks: Task[], cards: { id: string; type: string; pieceId: string }[], span = T.days): Bounds {
  const l = layoutOf(piece, all, tasks, cards, useWeeks.getState()[piece.id] ?? 0, () => true, undefined, span)
  return { x: 0, y: 0, w: l.w, h: l.h + 16 }
}

// A task held: where the press began (screen), where in the sheet it was taken (its px), the pointer (its px), where it
// would land (a row and a day).
type Drag = { id: string; from: [number, number]; grab: [number, number]; at: [number, number]; moving: boolean; over: { row: string; day: number } | null }

// `onCanvas`: unframed (D-289, as a kanban, D-228), live on the canvas at its own size; its box is the days' (shownBox.ts).
type Props = { piece: WithId<Piece>; view: PlaneCam; live: boolean; editor: boolean; onCanvas?: boolean; onTask?: (t: Task) => void; span?: number }

// Its view moves only the world's transform: the days are drawn again when the zoom changes, never as the view pans.
export function TimelineView({ piece, view, live, editor, onCanvas = false, onTask, span = T.days }: Props) {
  // Marks, chips and handles at screen size take the zoom once it settles (D-278), so a wheel step restyles none of them.
  const settled = useSettledZoom(view.zoom, live)
  return (
    <div className={styles.layer} data-timeline data-live={live || undefined} data-on-canvas={onCanvas || undefined}>
      <div className={styles.world} data-zooming={view.zoom !== settled || undefined} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})`, ...zsIn(settled, onCanvas || !live) }}>
        <Days piece={piece} zoom={settled} live={live} editor={editor} onCanvas={onCanvas} onTask={onTask} span={span} />
      </div>
    </div>
  )
}

type DaysProps = Omit<Props, 'view'> & { zoom: number }

const Days = memo(function Days({ piece, zoom, live, editor, onCanvas, onTask, span = T.days }: DaysProps) {
  const { wid, pieces, tasks, cards } = useWs()
  const { user } = useAuth()
  const week = useWeeks((s) => s[piece.id] ?? 0)
  const filter = useKanbanFilter(piece.id)
  const me = useMemo(() => (user ? { id: user.id, name: user.name ?? '' } : undefined), [user])
  const layout = useMemo(() => {
    const typeOf = (id: string) => cards.find((c) => c.id === id)?.type
    return layoutOf(piece, pieces, tasks, cards, week, (t, fin) => passes(t, filter, fin, user?.id, typeOf), me, span)
  }, [piece, pieces, tasks, cards, week, filter, user?.id, me, span])
  const selected = useKanbanUi((s) => s.selected?.task ?? null)
  const board = useRef<HTMLDivElement>(null)
  // Unframed, how big it came out: its box on the canvas (shownBox.ts). Written only when it changes.
  useLayoutEffect(() => {
    if (!onCanvas) return
    const was = useOpenSize.getState()[piece.id]
    if (!was || was.w !== layout.w || was.h !== layout.h) useOpenSize.setState({ [piece.id]: { w: layout.w, h: layout.h } })
  }, [onCanvas, piece.id, layout.w, layout.h])
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag
  const mode = piece.timeline?.rows ?? 'kanban'
  const field = useMemo(() => (mode === 'kanban' ? null : taskRows(mode, cards, { me, names: new Map() })), [mode, cards, me])

  const local = (x: number, y: number): [number, number] => {
    const el = board.current
    if (!el) return [0, 0]
    const r = el.getBoundingClientRect()
    const s = r.width / (el.offsetWidth || 1)
    return [(x - r.left) / s, (y - r.top) / s]
  }
  const cellAt = ([x, y]: [number, number]) => {
    const day = Math.floor((x - T.left) / T.day)
    if (day < 0 || day >= layout.span) return null
    const row = layout.rows.find((r) => y >= r.top && y < r.top + r.h) ?? (y >= T.head ? layout.rows.at(-1) : layout.rows[0])
    return row ? { row: row.key, day } : null
  }
  const press = (task: Task, row: string | null) => (e: ReactPointerEvent<HTMLElement>) => {
    if (!live || e.button !== 0) return
    e.stopPropagation()
    if (!editor) return
    const r = e.currentTarget.getBoundingClientRect()
    const s = r.width / (e.currentTarget.offsetWidth || 1)
    setDrag({ id: task.id, from: [e.clientX, e.clientY], grab: [(e.clientX - r.left) / s, (e.clientY - r.top) / s], at: local(e.clientX, e.clientY), moving: false, over: null })
    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const moving = d.moving || Math.hypot(ev.clientX - d.from[0], ev.clientY - d.from[1]) > 5
      if (moving) setDrag({ ...d, moving, at: local(ev.clientX, ev.clientY), over: cellAt(local(ev.clientX, ev.clientY)) })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      const d = dragRef.current
      setDrag(null)
      if (!d?.moving) return pick(task)
      if (!d.over) return
      const fields: TaskFields = { due: iso(layout.from + d.over.day * DAY_MS) }
      // Another row by person or card: that too (a lane that takes nothing, or rows by kanban, keep theirs).
      if (field && d.over.row !== row) Object.assign(fields, field.set(d.over.row) ?? {})
      if (fields.due === task.due && Object.keys(fields).length === 1) return
      void updateTask(wid, task, fields, task.due ? 'move a task to another day' : 'give a task a day')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  const pick = (t: Task) => {
    const again = useKanbanUi.getState().selected?.task === t.id
    selectTask(t.pieceId, again ? null : t.id)
    if (!again) onTask?.(t)
  }

  const held = drag?.moving ? tasks.find((t) => t.id === drag.id) : undefined
  // Its screen px per its own, for a held task's landing (read as it's drawn: a drag draws it again).
  const screen = (live ? 1 : camOf(wid).zoom) * zoom
  const todayAt = Math.round((dayOf(today()) - layout.from) / DAY_MS)
  const days = Array.from({ length: layout.span }, (_, i) => new Date(layout.from + i * DAY_MS))
  const vars = { ['--left' as string]: `${T.left}px`, ['--day' as string]: `${T.day}px`, ['--head' as string]: `${T.head}px`, ['--bar' as string]: `${T.bar}px` } as CSSProperties
  // Its text cut with `…` inside it, so its marks (D-265) can stand outside it.
  const sheet = (t: Task, late: boolean) => (
    <span className={styles.line}>
      {late && <span className={styles.late}>← {+t.due!.slice(8, 10)} · </span>}
      {t.priority && <span className={styles.p} data-p={t.priority}>{t.priority} </span>}
      {t.title}
    </span>
  )
  const tone = (t: Task) => (t.cardType ? TYPE_ACCENT[t.cardType] : undefined)

  return (
    <div ref={board} className={styles.board} style={{ ...vars, width: layout.w, height: layout.h }} data-dragging={held ? true : undefined}>
      {/* The days' head: `MON 26`, today cyan, weekends faint; a month's first day says its month. */}
      {days.map((d, i) => {
        const dow = d.getUTCDay()
        const label = `${d.toLocaleString('en', { weekday: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}${d.getUTCDate() === 1 ? ` ${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })}` : ''}`
        return (
          <div key={i} className={styles.dayHead} data-today={i === todayAt || undefined} data-weekend={dow === 0 || dow === 6 || undefined} style={{ left: T.left + i * T.day }}>
            {label}
          </div>
        )
      })}
      {layout.earlier > 0 && <div className={styles.more} style={{ left: T.left - 8, transform: 'translateX(-100%)' }}>← {layout.earlier}</div>}
      {layout.later > 0 && <div className={styles.more} style={{ left: T.left + layout.span * T.day + 6 }}>{layout.later} →</div>}
      {/* The rows: a name, the days' cells (weekends a shade darker), a rule under. */}
      {layout.rows.map((r) => (
        <div key={r.key} className={styles.row} style={{ top: r.top, height: r.h }} data-none={!r.drop || undefined}>
          <span className={styles.rowName} style={r.tone ? ({ ['--tone' as string]: r.tone } as CSSProperties) : undefined}>
            {r.initials && <span className={styles.who}>{r.initials}</span>}
            {r.kind && <span className={styles.kind}>▌</span>}
            <span className={styles.rowLabel}>{r.label}</span>
          </span>
          {days.map((d, i) => (
            <span
              key={i}
              className={styles.cell}
              data-weekend={d.getUTCDay() === 0 || d.getUTCDay() === 6 || undefined}
              style={{ left: T.left + i * T.day }}
            />
          ))}
        </div>
      ))}
      {todayAt >= 0 && todayAt < layout.span && <span className={styles.today} style={{ left: T.left + todayAt * T.day, top: T.head - 8, height: (layout.rows.at(-1)?.top ?? T.head) + (layout.rows.at(-1)?.h ?? 0) - T.head + 8 }} />}
      {/* Its tasks on their days. */}
      {layout.placed.map((p) => {
        const r = layout.rows.find((x) => x.key === p.row)
        if (!r || p.task.id === held?.id) return null
        const t = tone(p.task)
        return (
          <button
            key={p.task.id}
            className={styles.task}
            data-task={p.task.id}
            data-late={p.late || undefined}
            data-finished={p.finished || undefined}
            data-selected={selected === p.task.id || undefined}
            style={{ left: T.left + p.day * T.day + 4, top: r.top + T.pad + p.slot * (T.bar + T.gap), width: T.day - 8, ...(t ? { ['--tone' as string]: t } : {}) } as CSSProperties}
            tabIndex={live ? 0 : -1}
            title={`${p.task.title}${p.task.due ? ` · due ${p.task.due}` : ''}`}
            onPointerDown={press(p.task, p.row)}
            onClick={live && !editor ? () => pick(p.task) : undefined}
          >
            {sheet(p.task, p.late)}
            {live && <Marks tone={t} selected={selected === p.task.id} />}
          </button>
        )
      })}
      {/* No day yet: a tray under the rows. */}
      <div className={styles.tray} style={{ top: (layout.rows.at(-1)?.top ?? T.head) + (layout.rows.at(-1)?.h ?? 0) + 16 }}>
        <span className={styles.trayLabel}>no day · {layout.tray.length}</span>
        {layout.tray.map((t) =>
          t.id === held?.id ? null : (
            <button key={t.id} className={styles.pill} data-task={t.id} data-selected={selected === t.id || undefined} style={tone(t) ? ({ ['--tone' as string]: tone(t) } as CSSProperties) : undefined} tabIndex={live ? 0 : -1} onPointerDown={press(t, null)} onClick={live && !editor ? () => pick(t) : undefined}>
              <span className={styles.line}>☐ {t.title}</span>
              {live && <Marks tier="s" tone={tone(t)} selected={selected === t.id} />}
            </button>
          ),
        )}
        {!layout.tray.length && <span className={styles.trayNone}>every task has a day</span>}
        {live && editor && layout.tray.length > 0 && <span className={styles.trayHint}>drag onto a day to give it one</span>}
      </div>
      {/* Held (D-265): 0.8 round the point held under the pointer, its marks where it lands, on that day's first row. */}
      {held && drag?.over && (() => {
        const r = layout.rows.find((x) => x.key === drag.over!.row)
        return r ? <Landing x={T.left + drag.over.day * T.day + 4} y={r.top + T.pad} w={T.day - 8} h={T.bar} zoom={screen} tone={tone(held)} /> : null
      })()}
      {held && drag && (
        <div
          className={styles.task}
          data-lifted
          style={{ left: drag.at[0] - Math.min(drag.grab[0], T.day - 12), top: drag.at[1] - drag.grab[1], width: T.day - 8, scale: '0.8', transformOrigin: `${Math.min(drag.grab[0], T.day - 12)}px ${drag.grab[1]}px`, ...(tone(held) ? { ['--tone' as string]: tone(held) } : {}) } as CSSProperties}
          aria-hidden
        >
          {sheet(held, false)}
        </div>
      )}
    </div>
  )
})

// Its tools in its dock (its focus, beside its kanban): its filter, its rows, the weeks.
export function TimelineDockTools({ piece, editor }: { piece: WithId<Piece>; editor: boolean }) {
  const { pieces, tasks } = useWs()
  const kanbans = timelineKanbans(piece, pieces)
  const pool = useMemo(() => tasks.filter((t) => kanbans.some((k) => k.id === t.pieceId)), [tasks, kanbans])
  const week = useWeeks((s) => s[piece.id] ?? 0)
  const step = (by: number) => useWeeks.setState({ [piece.id]: by === 0 ? 0 : week + by })
  return (
    <>
      <KanbanFilterDock piece={piece} pool={pool} />
      <TimelineRowsMenu piece={piece} editor={editor} />
      <DockAction label="‹" title="the week before" onClick={() => step(-1)} />
      <DockAction label="today" pressed={week === 0} title="back to this week" onClick={() => step(0)} />
      <DockAction label="›" title="the week after" onClick={() => step(1)} />
    </>
  )
}

// Its weeks on the canvas, unframed (D-289): `‹ today ›` in its console, as in its dock.
export function TimelineWeeks({ piece, toolClass }: { piece: WithId<Piece>; toolClass: string }) {
  const week = useWeeks((s) => s[piece.id] ?? 0)
  const step = (by: number) => useWeeks.setState({ [piece.id]: by === 0 ? 0 : week + by })
  return (
    <>
      <button className={toolClass} title="the week before" aria-label="The week before" onClick={() => step(-1)}>
        ‹
      </button>
      <button className={toolClass} aria-pressed={week === 0} title="back to this week" onClick={() => step(0)}>
        today
      </button>
      <button className={toolClass} title="the week after" aria-label="The week after" onClick={() => step(1)}>
        ›
      </button>
    </>
  )
}

const ROW_NAME: Record<TimelineRows, string> = { kanban: 'deck', assignee: 'given to', card: 'card' }

// Its rows (shared): by kanban, by who it's given to, by the card it's for.
function TimelineRowsMenu({ piece, editor }: { piece: WithId<Piece>; editor: boolean }) {
  const { wid } = useWs()
  const rows = piece.timeline?.rows ?? 'kanban'
  const items: MenuEntry[] = TIMELINE_ROWS.map((r) => ({ key: r, label: `by ${ROW_NAME[r]}`, checked: rows === r, onSelect: () => editor && rows !== r && void setTimeline(wid, piece.id, { rows: r === 'kanban' ? undefined : r }, 'change a timeline’s rows') }))
  return <Menu label="rows" up plain summary={ROW_NAME[rows]} items={items} ariaLabel="Rows" noun="ways" />
}
