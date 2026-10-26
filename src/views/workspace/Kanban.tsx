// A kanban on the canvas (D-251): the team's tasks in columns, `todo · doing · done` to start. Drawn in its own px
// through a view, like a table (D-209): on the canvas a picture (the pointer goes through to the canvas, D-186); in
// focus, or unframed (D-228), live. There a task is dragged to its place (in its column or another; after 5 px, a
// click still selects), a click opens its right panel (TaskPanel), `+ add a task` under a column's last task types new
// ones (Enter makes one and keeps typing, Escape stops), `+ column` adds a column. A column's head: a double-click
// renames it; its tools on hover move it left or right, mark it the finished one (`✓`), take it away (its tasks go to
// the one before). Delete takes the selected task away, Escape lets go of it.
//
// Its look, the ledger (D-252): no box round a column, only a numbered rule (`01 TODO ──── 5`, the right panel's
// sections); tasks hang under it as raised sheets as tall as their text, their left edge in the colour of the card they're
// for; the place a held task would land is a cyan line between two tasks.
//
// Stuck to a plane (D-255), like a table (D-210): it shows that plane's tasks (for its cards, or for none) unless set to
// every plane (`[this plane only]` in its dock), and opens beside the plane in its focus, where a task picked glides the
// plane to its card (`onTask`).
//
// Filters, labels, priority, limits (D-256): what it shows narrows by its dock's filter (kanbanFilter.ts, yours); a
// task carries `#labels` and `P1`–`P3`; a column may have a limit (its head's `≤`), its head magenta when over.
//
// Lanes and several at once (D-258): rows across the columns by who a task is given to or the card it's for (rows.ts,
// `[lanes ▾]` in its dock), each folding from its head (yours); dropping into a lane gives the task to that person or
// card. Shift+click adds a task to the selection or takes it out, alt+drag a box selects what it touches; dragging one of
// them carries them all, in their order; the panel turns into `N selected`.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { create } from 'zustand'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { passes, useKanbanFilter } from './kanbanFilter'
import { addTask, COL_NAME_MAX, LIMIT_MAX, deleteColumn, deleteTasks, emptyKanban, KANBAN_COLS_MAX, moveTasks, orderBetween, setKanbanRows, KANBAN_ROWS, type KanbanRows, type TaskMove, overdue, setEveryPlane, setKanbanCols, shownTasks, TASK_TITLE_MAX, tasksIn, today, type KanbanCol, type KanbanSetup, type Task } from '../../data/tasks'
import { newId } from '../../data/matrix'
import { useAuth } from '../../data/auth'
import type { Bounds, PlaneCam } from '../../state/canvasView'
import type { Card } from '../../data/cards'
import { useWs } from './context'
import { DockAction } from './FocusDock'
import { Menu, type MenuEntry } from '../../ui/Menu'
import { loadFolds, saveFolds, taskRows, type Lane } from './rows'
import { TYPE_ACCENT } from './PlaneCards'
import { learnable } from './TaskPanel'
import styles from './Kanban.module.css'

// Its parts in its own px: a column's width and the gap between, its head, the gap under a task, the `+ column` head's
// width; what an unmeasured task is guessed at (a line of title, its meta line, its padding).
export const K = { col: 256, gap: 28, head: 32, cardGap: 8, add: 120, line: 18, meta: 26, pad: 22 }

const NO_SETUP = emptyKanban()
export const kanbanOf = (p: Pick<Piece, 'kanban'>): KanbanSetup => p.kanban ?? NO_SETUP

// How big each kanban came out, measured as it's drawn (its tasks are as tall as their text): what fit frames.
const useSizes = create<Record<string, { w: number; h: number }>>(() => ({}))

const hasMeta = (t: Task) => !!(t.cardId || t.due || t.checks?.length || t.assignee)
// About how tall a task is before it's drawn: its title's lines (about 30 letters each, at most 3) and its meta line.
const guess = (t: Task) => K.pad + Math.min(3, Math.max(1, Math.ceil(t.title.length / 30))) * K.line + (hasMeta(t) ? K.meta : 0) + (t.labels?.length ? K.line : 0)

// The box round its columns, in its px: what fit frames. As drawn once it has been; until then, guessed.
export function kanbanBounds(piece: WithId<Piece>, tasks: Task[]): Bounds {
  const seen = useSizes.getState()[piece.id]
  if (seen) return { x: 0, y: 0, ...seen }
  const cols = kanbanOf(piece).cols
  const mine = tasks.filter((t) => t.pieceId === piece.id)
  const tall = Math.max(0, ...cols.map((c) => mine.filter((t) => t.col === c.id).reduce((s, t) => s + guess(t) + K.cardGap, 0)))
  return { x: 0, y: 0, w: cols.length * (K.col + K.gap) + K.add + 32, h: K.head + 10 + tall + 68 }
}

// The task whose panel is open (its kanban's id with it), the column `+ add a task` is typing into, the column being
// renamed, the task whose panel should open on its evidence form (D-254), the tasks selected together (D-258; `adding`
// is a column and a lane, `col|lane`). Yours, not shared.
type Many = { piece: string; tasks: string[] }
export const useKanbanUi = create<{ selected: { piece: string; task: string } | null; adding: string | null; naming: string | null; learning: string | null; many: Many | null }>(() => ({
  selected: null,
  adding: null,
  naming: null,
  learning: null,
  many: null,
}))
// One task picked (or none): the several selected let go.
export const selectTask = (piece: string, task: string | null) => useKanbanUi.setState({ selected: task ? { piece, task } : null, many: null })
// Several (D-258): two or more is a selection of several, one is that task picked, none lets go.
export function selectTasks(piece: string, tasks: string[]) {
  if (tasks.length > 1) useKanbanUi.setState({ selected: null, many: { piece, tasks } })
  else selectTask(piece, tasks[0] ?? null)
}

// Two letters for a member's square: their initials, or the first two letters of a one-word name.
export function initials(name?: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase()
}

// A due day as the card says it: `today`, `tomorrow`, `yesterday`, else `28 oct` (the year only when it isn't this one).
export function dueText(due: string) {
  const t = today()
  const day = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
  const diff = Math.round((day(due) - day(t)) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  const d = new Date(day(due))
  const month = d.toLocaleString('en', { month: 'short', timeZone: 'UTC' }).toLowerCase()
  return `${d.getUTCDate()} ${month}${due.slice(0, 4) === t.slice(0, 4) ? '' : ` ${due.slice(0, 4)}`}`
}

// A checklist as small cells, done ones filled (up to 8; past that, the count alone).
const cells = (done: number, all: number) => (all > 8 ? '' : '▮'.repeat(done) + '▯'.repeat(all - done))

// Tasks held: the one pressed (and the others selected with it, in their order), where the press began (screen), where
// in the task it was taken and its size (its px), where the pointer is now (its px), and where they'd land: a column, a
// lane ('' without lanes), the place among that cell's tasks.
type Over = { col: string; lane: string; index: number }
type Drag = { id: string; ids: string[]; from: [number, number]; grab: [number, number]; size: [number, number]; at: [number, number]; moving: boolean; over: Over | null }
// A box being drawn with alt held (its px), from where it began to the pointer.
type Box = { from: [number, number]; to: [number, number] }

// `onTask`: a task picked (beside a plane, D-255: the plane glides to its card).
type Props = { piece: WithId<Piece>; view: PlaneCam; live: boolean; editor: boolean; onCanvas?: boolean; onTask?: (t: Task) => void }

const NO_LANE: Lane[] = [{ key: '', label: '', drop: true }]

export function KanbanView({ piece, view, live, editor, onCanvas = false, onTask }: Props) {
  const { wid, tasks: all, cards } = useWs()
  const { user } = useAuth()
  const setup = kanbanOf(piece)
  const cols = setup.cols
  const tasks = useMemo(() => all.filter((t) => t.pieceId === piece.id), [all, piece.id])
  // What it shows: stuck to a plane, that plane's tasks (D-255).
  // And by its filter, yours (D-256).
  const filter = useKanbanFilter(piece.id)
  const shown = useMemo(() => {
    const done = new Set(cols.filter((c) => c.done).map((c) => c.id))
    const typeOf = (id: string) => cards.find((c) => c.id === id)?.type
    return shownTasks(tasks, piece, cards).filter((t) => passes(t, filter, done.has(t.col), user?.id, typeOf))
  }, [tasks, piece, cards, filter, cols, user?.id])
  // Its lanes (D-258): by a field, or one lane with no head.
  const field = useMemo(() => {
    const names = new Map(tasks.flatMap((t) => (t.assignee && t.assigneeName ? [[t.assignee, t.assigneeName] as const] : [])))
    return taskRows(setup.rows, cards, { me: user ? { id: user.id, name: user.name ?? '' } : undefined, names })
  }, [setup.rows, cards, tasks, user])
  const lanes = useMemo(() => (field ? field.lanes(shown) : NO_LANE), [field, shown])
  const laneOf = (t: Task) => (field ? field.laneOf(t) : '')
  const byCol = useMemo(() => new Map(cols.map((c) => [c.id, tasksIn(shown, c.id)])), [cols, shown])
  const byCell = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const c of cols) for (const t of byCol.get(c.id) ?? []) {
      const k = `${c.id}|${field ? field.laneOf(t) : ''}`
      m.set(k, [...(m.get(k) ?? []), t])
    }
    return m
  }, [cols, byCol, field])
  const [folds, setFolds] = useState(() => loadFolds(piece.id))
  const fold = (lane: string) => {
    const next = folds.includes(lane) ? folds.filter((x) => x !== lane) : [...folds, lane]
    setFolds(next)
    saveFolds(piece.id, next)
  }
  const selected = useKanbanUi((s) => (live && s.selected?.piece === piece.id ? s.selected.task : null))
  const many = useKanbanUi((s) => (live && s.many?.piece === piece.id ? s.many.tasks : null))
  const adding = useKanbanUi((s) => (live ? s.adding : null))
  const naming = useKanbanUi((s) => (live ? s.naming : null))
  const board = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag
  const [box, setBox] = useState<Box | null>(null)

  // Its drawn size, for fit (written only when it changes).
  useLayoutEffect(() => {
    const el = board.current
    if (!el) return
    const note = () => {
      const size = { w: el.offsetWidth, h: el.offsetHeight }
      const was = useSizes.getState()[piece.id]
      if (!was || was.w !== size.w || was.h !== size.h) useSizes.setState({ [piece.id]: size })
    }
    note()
    const ro = new ResizeObserver(note)
    ro.observe(el)
    return () => ro.disconnect()
  }, [piece.id])

  // A selected task that went (deleted here or elsewhere, or moved to another kanban) lets go; so does leaving focus.
  useEffect(() => {
    if (selected && !tasks.some((t) => t.id === selected)) selectTask(piece.id, null)
  }, [selected, tasks, piece.id])
  useEffect(() => {
    if (many && many.some((id) => !tasks.some((t) => t.id === id))) selectTasks(piece.id, many.filter((id) => tasks.some((t) => t.id === id)))
  }, [many, tasks, piece.id])
  useEffect(() => {
    if (!live) return
    return () =>
      useKanbanUi.setState((s) => ({ selected: s.selected?.piece === piece.id ? null : s.selected, many: s.many?.piece === piece.id ? null : s.many, adding: null, naming: null }))
  }, [live, piece.id])

  // Delete takes the selected task (or tasks) away, Escape lets go; heard before the canvas's own keys (Escape would
  // leave focus).
  const picked = many ?? (selected ? [selected] : null)
  useEffect(() => {
    if (!live || !picked) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, [contenteditable], [role=menu], [role=dialog] input, [role=listbox]')) return
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        selectTask(piece.id, null)
      }
      if (editor && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        e.stopImmediatePropagation()
        void deleteTasks(wid, picked)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, picked?.join(','), editor, wid, piece.id])

  // The board's scale on the screen (the canvas's zoom and the view's), and a point on the screen in its px.
  const scale = () => {
    const el = board.current
    return el ? el.getBoundingClientRect().width / (el.offsetWidth || 1) : 1
  }
  const local = (x: number, y: number): [number, number] => {
    const r = board.current?.getBoundingClientRect()
    const s = scale()
    return r ? [(x - r.left) / s, (y - r.top) / s] : [0, 0]
  }
  // Where tasks held under the pointer would land, read off what's drawn: the cell (a column in an open lane that takes
  // them) under the pointer or the nearest, and the place among its other tasks by their middles.
  const landing = (x: number, y: number, ids: string[]): Over | null => {
    const cellsAt = [...(board.current?.querySelectorAll<HTMLElement>('[data-cell][data-drop]') ?? [])]
    if (!cellsAt.length) return null
    const dist = (c: HTMLElement) => {
      const r = c.getBoundingClientRect()
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0
      return Math.hypot(dx, dy)
    }
    const cell = cellsAt.reduce((a, b) => (dist(b) < dist(a) ? b : a))
    const rows = [...cell.querySelectorAll<HTMLElement>('[data-task]')].filter((t) => !ids.includes(t.dataset.task!))
    const index = rows.filter((t) => {
      const r = t.getBoundingClientRect()
      return r.top + r.height / 2 < y
    }).length
    return { col: cell.dataset.col!, lane: cell.dataset.lane ?? '', index }
  }

  const drop = (task: Task) => {
    const d = dragRef.current
    setDrag(null)
    if (!d) return
    if (!d.moving) return pick(task)
    if (!d.over) return
    const moving = d.ids.map((id) => tasks.find((t) => t.id === id)!).filter(Boolean)
    const list = (byCell.get(`${d.over.col}|${d.over.lane}`) ?? []).filter((t) => !d.ids.includes(t.id))
    const before = list[d.over.index - 1]
    const after = list[d.over.index]
    // Let go where it was (one task, its own cell, between the same two): nothing changes.
    if (moving.length === 1) {
      const was = byCell.get(`${task.col}|${laneOf(task)}`) ?? []
      const k = was.findIndex((t) => t.id === task.id)
      if (d.over.col === task.col && d.over.lane === laneOf(task) && was[k - 1]?.id === before?.id && was[k + 1]?.id === after?.id) return
    }
    // Into another lane: its field too (null: the lane takes nothing, so they keep theirs).
    const lanePatch = field && d.over.lane ? field.set(d.over.lane) : null
    // Into an empty cell: after every task in that column (the other lanes' too), so lanes switched off keep the order.
    const lo = before?.order ?? (after ? undefined : tasksIn(tasks.filter((t) => !d.ids.includes(t.id)), d.over.col).at(-1)?.order)
    const hi = after?.order
    const moves: TaskMove[] = moving.map((t, i) => {
      const order = lo === undefined && hi === undefined ? i + 1 : lo === undefined ? hi! - (moving.length - i) : hi === undefined ? lo + i + 1 : lo + ((hi - lo) * (i + 1)) / (moving.length + 1)
      return { id: t.id, col: d.over!.col, order, fields: lanePatch && laneOf(t) !== d.over!.lane ? lanePatch : undefined }
    })
    void moveTasks(wid, moves, moves.length > 1 ? `move ${moves.length} tasks` : 'move a task')
  }
  // A press on a task: held; it moves after 5 px (with the others selected, if it's one of them). The window hears the
  // pointer meanwhile, since the task leaves its list while it's held. With shift, it joins the selection or leaves it.
  const press = (task: Task) => (e: ReactPointerEvent<HTMLElement>) => {
    if (!live || e.button !== 0) return
    if (e.shiftKey) {
      e.stopPropagation()
      const now = many ?? (selected ? [selected] : [])
      return selectTasks(piece.id, now.includes(task.id) ? now.filter((x) => x !== task.id) : [...now, task.id])
    }
    if (!editor) return
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const s = scale()
    // The selection in the board's order (column, then place).
    const order = cols.flatMap((c) => byCol.get(c.id) ?? []).map((t) => t.id)
    const ids = many?.includes(task.id) ? order.filter((id) => many.includes(id)) : [task.id]
    setDrag({ id: task.id, ids, from: [e.clientX, e.clientY], grab: [(e.clientX - r.left) / s, (e.clientY - r.top) / s], size: [r.width / s, r.height / s], at: local(e.clientX, e.clientY), moving: false, over: null })
    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const moving = d.moving || Math.hypot(ev.clientX - d.from[0], ev.clientY - d.from[1]) > 5
      if (moving) setDrag({ ...d, at: local(ev.clientX, ev.clientY), moving, over: landing(ev.clientX, ev.clientY, d.ids) ?? d.over })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      drop(task)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  // Alt held, a press on the board's empty space draws a box; let go, what it touches is selected (with shift, added).
  const boxPress = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live || e.button !== 0 || !e.altKey) return
    if ((e.target as HTMLElement).closest('[data-task], button, input, textarea')) return
    e.stopPropagation()
    e.preventDefault()
    const from = local(e.clientX, e.clientY)
    const keep = e.shiftKey ? (many ?? (selected ? [selected] : [])) : []
    let to = from
    setBox({ from, to })
    const move = (ev: PointerEvent) => {
      to = local(ev.clientX, ev.clientY)
      setBox({ from, to })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setBox(null)
      const [x0, x1] = [Math.min(from[0], to[0]), Math.max(from[0], to[0])]
      const [y0, y1] = [Math.min(from[1], to[1]), Math.max(from[1], to[1])]
      const hit = [...(board.current?.querySelectorAll<HTMLElement>('[data-task]') ?? [])]
        .filter((el) => {
          const r = el.getBoundingClientRect()
          const [a, b] = [local(r.left, r.top), local(r.right, r.bottom)]
          return a[0] < x1 && b[0] > x0 && a[1] < y1 && b[1] > y0
        })
        .map((el) => el.dataset.task!)
      selectTasks(piece.id, [...new Set([...keep, ...hit])])
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // A click on a task: picked (its panel opens), or let go if it was.
  const pick = (task: Task) => {
    const again = useKanbanUi.getState().selected?.task === task.id
    selectTask(piece.id, again ? null : task.id)
    if (!again) onTask?.(task)
  }

  const setCols = (next: KanbanCol[], what: string) => void setKanbanCols(wid, piece.id, next, what)
  const moveCol = (i: number, by: -1 | 1) => {
    const next = [...cols]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    setCols(next, 'move a column')
  }
  const addCol = () => {
    const id = newId()
    setCols([...cols, { id, name: 'new column' }], 'add a column')
    useKanbanUi.setState({ naming: id })
  }
  // Typed at a cell's foot: in that column, after every task in it (those not shown too), given its lane's value.
  const add = (column: string, lane: string, title: string) => {
    if (!user) return
    const last = tasksIn(tasks, column).at(-1)?.order
    const fields = field && lane ? (field.set(lane) ?? {}) : {}
    const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined))
    addTask(wid, piece.id, column, orderBetween(last, undefined), title, user.id, clean)
  }

  const own = live ? (e: ReactPointerEvent) => e.stopPropagation() : undefined
  const held = drag?.moving ? tasks.find((t) => t.id === drag.id) : undefined
  const heldIds = held && drag ? drag.ids : []
  const cardOf = (t: Task) => (t.cardId ? (cards.find((x) => x.id === t.cardId) ?? null) : null)
  const vars = { ['--col' as string]: `${K.col}px`, ['--gap' as string]: `${K.gap}px`, ['--head' as string]: `${K.head}px`, ['--card-gap' as string]: `${K.cardGap}px` } as CSSProperties
  const isPicked = (id: string) => (many ? many.includes(id) : selected === id)

  return (
    <div className={styles.layer} data-live={live || undefined} data-on-canvas={onCanvas || undefined}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }}>
        <div ref={board} className={styles.board} style={vars} role="list" aria-label={piece.name || 'kanban'} data-dragging={held ? true : undefined} data-lanes={field ? true : undefined} onPointerDown={boxPress}>
          <div className={styles.row}>
            {cols.map((c, i) => (
              <div key={c.id} className={styles.colHead} data-done={c.done || undefined} data-over={(held && drag?.over?.col === c.id) || undefined}>
                <ColumnHead
                  col={c}
                  n={i + 1}
                  count={(byCol.get(c.id) ?? []).length}
                  holds={tasks.filter((t) => t.col === c.id).length}
                  live={live}
                  editor={editor}
                  naming={naming === c.id}
                  first={i === 0}
                  last={i === cols.length - 1}
                  alone={cols.length < 2}
                  onPress={own}
                  onName={() => useKanbanUi.setState({ naming: c.id })}
                  onRename={(name) => {
                    useKanbanUi.setState({ naming: null })
                    const next = name.trim().slice(0, COL_NAME_MAX)
                    if (next && next !== c.name) setCols(cols.map((x) => (x.id === c.id ? { ...x, name: next } : x)), 'rename a column')
                  }}
                  onMove={(by) => moveCol(i, by)}
                  onLimit={(limit) => setCols(cols.map((x) => (x.id === c.id ? { ...x, limit } : x)), limit ? 'set a column’s limit' : 'take a column’s limit away')}
                  onDone={() => setCols(cols.map((x) => (x.id === c.id ? { ...x, done: !x.done || undefined } : x)), c.done ? 'unmark a finished column' : 'mark a finished column')}
                  onDelete={() => void deleteColumn(wid, piece.id, cols, c.id, tasks)}
                />
              </div>
            ))}
            {live && editor && cols.length < KANBAN_COLS_MAX && (
              <button className={styles.addCol} onPointerDown={own} onClick={addCol} title="add a column">
                + column
              </button>
            )}
          </div>
          {lanes.map((lane) => {
            const folded = !!field && folds.includes(lane.key)
            const count = shown.filter((t) => laneOf(t) === lane.key).length
            return (
              <div key={lane.key || 'all'} className={styles.lane} data-folded={folded || undefined}>
                {field && <LaneHead lane={lane} count={count} folded={folded} onFold={() => fold(lane.key)} onPress={own} />}
                {!folded && (
                  <div className={styles.row}>
                    {cols.map((c) => {
                      const cell = `${c.id}|${lane.key}`
                      const every = byCell.get(cell) ?? []
                      const list = held ? every.filter((t) => !heldIds.includes(t.id)) : every
                      const slot = held && drag?.over?.col === c.id && drag.over.lane === lane.key ? drag.over.index : -1
                      return (
                        <div
                          key={c.id}
                          className={styles.column}
                          data-cell
                          data-col={c.id}
                          data-lane={lane.key}
                          data-drop={lane.drop || undefined}
                          data-done={c.done || undefined}
                          role="listitem"
                          aria-label={`${c.name}${lane.label ? `, ${lane.label}` : ''}, ${every.length} tasks`}
                        >
                          <div className={styles.list}>
                            {list.map((t, k) => (
                              <Slotted key={t.id} slot={slot === k}>
                                <TaskCard
                                  task={t}
                                  card={cardOf(t)}
                                  finished={!!c.done}
                                  selected={isPicked(t.id)}
                                  live={live}
                                  learn={live && editor && !many && learnable(t, cardOf(t) ?? undefined, !!c.done) ? () => (selectTask(piece.id, t.id), useKanbanUi.setState({ learning: t.id })) : undefined}
                                  onPointerDown={press(t)}
                                  onClick={live && !editor ? (e: React.MouseEvent) => void (!e.shiftKey && pick(t)) : undefined}
                                />
                              </Slotted>
                            ))}
                            {slot >= 0 && slot >= list.length && <span className={styles.slot} aria-hidden />}
                            {!list.length && slot < 0 && adding !== cell && !field && <span className={styles.empty}>· nothing yet</span>}
                            {live && editor && lane.drop && (
                              <AddTask open={adding === cell} quiet={!!field} onPress={own} onOpen={() => useKanbanUi.setState({ adding: cell })} onClose={() => useKanbanUi.setState({ adding: null })} onAdd={(title) => add(c.id, lane.key, title)} />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          {held && drag && (
            <div className={styles.ghost} style={{ left: drag.at[0] - drag.grab[0], top: drag.at[1] - drag.grab[1], width: drag.size[0] }} aria-hidden>
              <TaskCard task={held} card={cardOf(held)} finished={!!cols.find((c) => c.id === (drag.over?.col ?? held.col))?.done} selected={false} live lifted />
              {heldIds.length > 1 && <span className={styles.more}>+{heldIds.length - 1}</span>}
            </div>
          )}
          {box && (
            <div
              className={styles.box}
              style={{ left: Math.min(box.from[0], box.to[0]), top: Math.min(box.from[1], box.to[1]), width: Math.abs(box.to[0] - box.from[0]), height: Math.abs(box.to[1] - box.from[1]) }}
              aria-hidden
            />
          )}
        </div>
      </div>
    </div>
  )
}

// A lane's head (D-258), the width of the columns: `▾`, its mark (a member's square, a card type's bar), its name, a
// rule, how many it holds. A click folds it or opens it.
function LaneHead({ lane, count, folded, onFold, onPress }: { lane: Lane; count: number; folded: boolean; onFold: () => void; onPress?: (e: ReactPointerEvent) => void }) {
  return (
    <button className={styles.laneHead} onPointerDown={onPress} onClick={onFold} aria-expanded={!folded} title={folded ? 'open it' : 'fold it'} style={lane.tone ? ({ ['--tone' as string]: lane.tone } as CSSProperties) : undefined}>
      <span className={styles.laneFold} aria-hidden>
        {folded ? '▸' : '▾'}
      </span>
      {lane.initials && <span className={styles.who}>{lane.initials}</span>}
      {lane.kind && <span className={styles.laneKind}>▌{lane.kind}</span>}
      <span className={styles.laneName} data-none={!lane.initials && !lane.kind ? true : undefined}>
        {lane.label}
      </span>
      <span className={styles.rule} aria-hidden />
      <span className={styles.count}>{count}</span>
    </button>
  )
}

// Its lanes, in its dock (D-258): none, by who a task is given to, by the card it's for. Shared; editors choose.
export function KanbanLanes({ piece, editor }: { piece: WithId<Piece>; editor: boolean }) {
  const { wid } = useWs()
  const rows = kanbanOf(piece).rows
  const NAME: Record<KanbanRows, string> = { assignee: 'given to', card: 'card' }
  const items: MenuEntry[] = [
    { key: 'none', label: 'no lanes', checked: !rows, onSelect: () => editor && rows && void setKanbanRows(wid, piece.id, undefined) },
    ...KANBAN_ROWS.map((r) => ({ key: r, label: `by ${NAME[r]}`, checked: rows === r, onSelect: () => editor && rows !== r && void setKanbanRows(wid, piece.id, r) })),
  ]
  return <Menu label="lanes" up summary={rows ? NAME[rows] : 'none'} active={!!rows} items={items} ariaLabel="Lanes" noun="ways" />
}

// A task with the place a held one would land just above it.
function Slotted({ slot, children }: { slot: boolean; children: ReactNode }) {
  return (
    <>
      {slot && <span className={styles.slot} aria-hidden />}
      {children}
    </>
  )
}

type HeadProps = {
  col: KanbanCol
  n: number
  count: number
  // Every task in it, shown or not: what its limit counts.
  holds: number
  live: boolean
  editor: boolean
  naming: boolean
  first: boolean
  last: boolean
  alone: boolean
  onPress?: (e: ReactPointerEvent) => void
  onName: () => void
  onRename: (name: string) => void
  onMove: (by: -1 | 1) => void
  onDone: () => void
  onDelete: () => void
  onLimit: (limit: number | undefined) => void
}

// A column's head, as the right panel's sections: its number faint, its name in caps, a rule, its count; the finished
// one's name green. Live, a double-click renames it, and on hover its tools come in after the count. With a limit
// (D-256), the count reads `4/3` (every task in it, shown or not, over the limit), the head magenta once over; `≤` types
// the limit (Enter keeps it, empty takes it away, Escape leaves it).
function ColumnHead({ col, n, count, holds, live, editor, naming, first, last, alone, onPress, onName, onRename, onMove, onDone, onDelete, onLimit }: HeadProps) {
  const [draft, setDraft] = useState(col.name)
  useEffect(() => setDraft(col.name), [col.name, naming])
  const [limiting, setLimiting] = useState<string | null>(null)
  const tools = live && editor && !naming && limiting === null
  const over = !!col.limit && holds > col.limit
  const keepLimit = (v: string) => {
    setLimiting(null)
    const k = Math.round(Number(v))
    const next = v.trim() && k >= 1 ? Math.min(LIMIT_MAX, k) : undefined
    if (next !== col.limit) onLimit(next)
  }
  return (
    <div className={styles.head} data-over={over || undefined} onPointerDown={naming || tools || limiting !== null ? onPress : undefined}>
      <span className={styles.n}>{String(n).padStart(2, '0')}</span>
      {naming ? (
        <input
          className={styles.headField}
          value={draft}
          autoFocus
          maxLength={COL_NAME_MAX}
          aria-label="Column name"
          size={Math.max(draft.length, 4)}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onRename(draft)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') (setDraft(col.name), requestAnimationFrame(() => onRename(col.name)))
          }}
        />
      ) : (
        <span className={styles.name} onDoubleClick={tools ? onName : undefined} title={tools ? 'double-click to rename' : undefined}>
          {col.name}
        </span>
      )}
      <span className={styles.rule} aria-hidden />
      {limiting !== null ? (
        <span className={styles.count}>
          {holds}/
          <input
            className={styles.limitField}
            value={limiting}
            autoFocus
            inputMode="numeric"
            aria-label="Limit"
            placeholder="–"
            size={2}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setLimiting(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onBlur={() => keepLimit(limiting)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setLimiting(null)
            }}
          />
        </span>
      ) : (
        <span className={styles.count} title={col.limit ? `${holds} of at most ${col.limit}${over ? ': over its limit' : ''}` : undefined}>
          {col.limit ? `${holds}/${col.limit}` : count}
        </span>
      )}
      {tools && (
        <span className={styles.tools}>
          <button className={styles.tool} data-limit aria-pressed={!!col.limit} title={col.limit ? `at most ${col.limit}: change or take away` : 'how many it should hold at most'} aria-label="Column limit" onClick={() => setLimiting(col.limit ? String(col.limit) : '')}>
            ≤
          </button>
          {!first && (
            <button className={styles.tool} title="move it left" aria-label="Move the column left" onClick={() => onMove(-1)}>
              ‹
            </button>
          )}
          {!last && (
            <button className={styles.tool} title="move it right" aria-label="Move the column right" onClick={() => onMove(1)}>
              ›
            </button>
          )}
          <button className={styles.tool} aria-pressed={!!col.done} title={col.done ? 'not the finished column' : 'its tasks are finished: their due days stop warning'} aria-label="Finished column" onClick={onDone}>
            ✓
          </button>
          {!alone && (
            <button className={styles.tool} data-danger title={count ? `take it away: its ${count} task${count > 1 ? 's go' : ' goes'} to the column ${first ? 'after' : 'before'} it` : 'take it away'} aria-label="Delete the column" onClick={onDelete}>
              ×
            </button>
          )}
        </span>
      )}
    </div>
  )
}

type CardProps = {
  task: Task
  card: Card | null
  finished: boolean
  selected: boolean
  live: boolean
  lifted?: boolean
  // Finished, for a card still being tested (D-254): its line asking what it taught.
  learn?: () => void
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void
  onClick?: (e: React.MouseEvent) => void
}

// A task: raised paper as tall as its title (Geist, up to three lines), its left edge in the colour of the card it's for.
// Under the title, only when there's something: the card's name, then on the right its due day (magenta once past,
// unless finished), its checklist as cells, who it's given to (a square with their initials). Finished: a green `✓`
// before the title, the title grey. Hover and selection are a card's corner marks (D-150).
function TaskCard({ task, card, finished, selected, live, lifted, learn, onPointerDown, onClick }: CardProps) {
  const checks = task.checks ?? []
  const ticked = checks.filter((c) => c.done).length
  const late = overdue(task, finished)
  const tone = task.cardType ? TYPE_ACCENT[task.cardType] : undefined
  return (
    <div
      className={styles.task}
      data-task={task.id}
      data-selected={selected || undefined}
      data-finished={finished || undefined}
      data-lifted={lifted || undefined}
      data-card={tone ? true : undefined}
      style={tone ? ({ ['--tone' as string]: tone } as CSSProperties) : undefined}
      role={live && !lifted ? 'button' : undefined}
      tabIndex={live && !lifted ? 0 : -1}
      aria-label={task.title}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <span className={styles.title}>
        {finished && <span className={styles.tick}>✓ </span>}
        {task.priority && (
          <span className={styles.priority} data-p={task.priority}>
            {task.priority}{' '}
          </span>
        )}
        {task.title}
      </span>
      {!!task.labels?.length && <span className={styles.labels}>{task.labels.map((l) => `#${l}`).join(' ')}</span>}
      {hasMeta(task) && (
        <span className={styles.meta}>
          {task.cardId && (
            <span className={styles.for} title={card?.title ?? 'its card is gone'}>
              {card ? card.title || 'untitled' : 'its card is gone'}
            </span>
          )}
          <span className={styles.push} />
          {task.due && (
            <span className={styles.due} data-late={late || undefined} title={late ? `was due ${task.due}` : `due ${task.due}`}>
              ◷ {dueText(task.due)}
            </span>
          )}
          {checks.length > 0 && (
            <span className={styles.checks} data-all={ticked === checks.length || undefined} title={`${ticked} of ${checks.length} steps done`}>
              {checks.length <= 8 && <span className={styles.cells}>{cells(ticked, checks.length)}</span>} {ticked}/{checks.length}
            </span>
          )}
          {task.assignee && (
            <span className={styles.who} title={task.assigneeName}>
              {initials(task.assigneeName)}
            </span>
          )}
        </span>
      )}
      {learn && (
        <button
          className={styles.learn}
          title="log what it taught on its card, as evidence"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => (e.stopPropagation(), learn())}
        >
          + log what it taught
        </button>
      )}
      {(['nw', 'ne', 'se', 'sw'] as const).map((c) => (
        <span key={c} className={styles.mark} data-corner={c} aria-hidden />
      ))}
    </div>
  )
}

// `quiet`: in a lane, shown only while its cell is hovered (one in every cell would crowd it).
type AddProps = { open: boolean; quiet?: boolean; onPress?: (e: ReactPointerEvent) => void; onOpen: () => void; onClose: () => void; onAdd: (title: string) => void }

// `+ add a task` under a column's last task, a faint line: a click types a new one in its place, a sheet like a task with
// the menus' cyan `>` (D-222); Enter makes it and keeps the field for the next, Escape (or leaving it empty) stops.
function AddTask({ open, quiet, onPress, onOpen, onClose, onAdd }: AddProps) {
  const [draft, setDraft] = useState('')
  if (!open)
    return (
      <button className={styles.add} data-quiet={quiet || undefined} onPointerDown={onPress} onClick={onOpen}>
        + add a task
      </button>
    )
  return (
    <label className={styles.adding} onPointerDown={onPress}>
      <span className={styles.prompt} aria-hidden>
        &gt;
      </span>
      <textarea
        className={styles.addField}
        value={draft}
        autoFocus
        rows={2}
        maxLength={TASK_TITLE_MAX}
        placeholder="what needs doing?"
        aria-label="New task"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim()) onAdd(draft)
          setDraft('')
          onClose()
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!draft.trim()) return onClose()
            onAdd(draft)
            setDraft('')
          }
          if (e.key === 'Escape') (setDraft(''), onClose())
        }}
      />
    </label>
  )
}

// Its tools in a dock (its focus, its pane beside a plane): stuck to a plane, `[this plane only]` (D-255), lit while it
// shows only that plane's tasks; how many it leaves out, beside. Editors switch it (shared); others see it.
export function KanbanDockTools({ piece, editor }: { piece: WithId<Piece>; editor: boolean }) {
  const { wid, tasks, cards } = useWs()
  if (!piece.stuckTo) return null
  const mine = tasks.filter((t) => t.pieceId === piece.id)
  const only = !piece.kanban?.everyPlane
  const left = only ? mine.length - shownTasks(mine, piece, cards).length : 0
  return (
    <DockAction
      label={`this plane only${left ? ` · ${left} hidden` : ''}`}
      pressed={only}
      title={only ? 'showing tasks for this plane’s cards and for no card; click: every task' : 'showing every task; click: only this plane’s'}
      onClick={() => editor && void setEveryPlane(wid, piece.id, only)}
    />
  )
}
