// A kanban on the canvas (D-251): the team's tasks in columns, `todo · doing · done` to start. Drawn in its own px
// through a view, like a table (D-209): on the canvas a picture (the pointer goes through to the canvas, D-186); in
// focus, or unframed (D-228), live. There a task is dragged to its place (in its column or another; after 5 px, a
// click still selects), a click opens its right panel (TaskPanel), `+ task` at a column's foot types new ones (Enter
// makes one and keeps typing, Escape stops), `+ column` adds a column. A column's head: a double-click renames it; its
// tools on hover move it left or right, mark it the finished one (`✓`), take it away (its tasks go to the one before).
// Delete takes the selected task away, Escape lets go of it.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { create } from 'zustand'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { addTask, COL_NAME_MAX, deleteColumn, deleteTask, emptyKanban, KANBAN_COLS_MAX, moveTask, orderBetween, overdue, setKanbanCols, TASK_TITLE_MAX, tasksIn, today, type KanbanCol, type KanbanSetup, type Task } from '../../data/tasks'
import { newId } from '../../data/matrix'
import { useAuth } from '../../data/auth'
import type { Bounds, PlaneCam } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import { useWs } from './context'
import { TYPE_ACCENT } from './PlaneCards'
import styles from './Kanban.module.css'

// Its parts in its own px: a column's width and the gap between, its head, a task and the gap under it, a column's
// foot (`+ task`), the `+ column` column.
export const K = { col: 264, gap: 16, head: 44, card: 84, cardGap: 8, foot: 44, add: 120 }
const STEP = K.card + K.cardGap
// A task's, a field's and `+ task`'s inset from its column's sides.
const IN = 8
const INNER = K.col - 2 * IN
const colX = (i: number) => i * (K.col + K.gap)

const NO_SETUP = emptyKanban()
export const kanbanOf = (p: Pick<Piece, 'kanban'>): KanbanSetup => p.kanban ?? NO_SETUP

// The box round its columns, in its px: what fit frames. As tall as its longest column.
export function kanbanBounds(piece: WithId<Piece>, tasks: Task[]): Bounds {
  const cols = kanbanOf(piece).cols
  const mine = tasks.filter((t) => t.pieceId === piece.id)
  const most = Math.max(1, ...cols.map((c) => mine.filter((t) => t.col === c.id).length))
  return { x: 0, y: 0, w: colX(cols.length) + K.add, h: K.head + most * STEP + K.foot }
}

// The task whose panel is open (its kanban's id with it), the column `+ task` is typing into, the column being renamed.
// Yours, not shared.
export const useKanbanUi = create<{ selected: { piece: string; task: string } | null; adding: string | null; naming: string | null }>(() => ({
  selected: null,
  adding: null,
  naming: null,
}))
export const selectTask = (piece: string, task: string | null) => useKanbanUi.setState({ selected: task ? { piece, task } : null })

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

type Drag = { id: string; from: [number, number]; grab: [number, number]; at: [number, number]; moving: boolean; over: { col: string; index: number } | null }

type Props = { piece: WithId<Piece>; view: PlaneCam; live: boolean; editor: boolean; onCanvas?: boolean }

export function KanbanView({ piece, view, live, editor, onCanvas = false }: Props) {
  const { wid, tasks: all, cards } = useWs()
  const { user } = useAuth()
  const cols = kanbanOf(piece).cols
  const tasks = useMemo(() => all.filter((t) => t.pieceId === piece.id), [all, piece.id])
  const byCol = useMemo(() => new Map(cols.map((c) => [c.id, tasksIn(tasks, c.id)])), [cols, tasks])
  const selected = useKanbanUi((s) => (live && s.selected?.piece === piece.id ? s.selected.task : null))
  const adding = useKanbanUi((s) => (live ? s.adding : null))
  const naming = useKanbanUi((s) => (live ? s.naming : null))
  const world = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag
  const reduced = isReducedMotion()

  // A selected task that went (deleted here or elsewhere, or moved to another kanban) lets go; so does leaving focus.
  useEffect(() => {
    if (selected && !tasks.some((t) => t.id === selected)) selectTask(piece.id, null)
  }, [selected, tasks, piece.id])
  useEffect(() => {
    if (!live) return
    return () =>
      useKanbanUi.setState((s) => ({ selected: s.selected?.piece === piece.id ? null : s.selected, adding: null, naming: null }))
  }, [live, piece.id])

  // Delete takes the selected task away, Escape lets go of it; heard before the canvas's own keys (Escape would leave
  // focus).
  useEffect(() => {
    if (!live || !selected) return
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
        void deleteTask(wid, { id: selected })
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [live, selected, editor, wid, piece.id])

  // A point on the screen in the kanban's px: its world measured as the press goes (the canvas's zoom and the view's).
  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const el = world.current
    if (!el) return [0, 0]
    const r = el.getBoundingClientRect()
    const scale = r.width / (el.offsetWidth || 1)
    return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale]
  }
  // Where a task held at `at` (its grab point `grab` in it) would land: the column under its middle, the place in it
  // nearest its top.
  const landing = (at: [number, number], grab: [number, number], id: string) => {
    const cx = at[0] - grab[0] - IN + K.col / 2
    const i = Math.max(0, Math.min(cols.length - 1, Math.floor((cx + K.gap / 2) / (K.col + K.gap))))
    const list = (byCol.get(cols[i].id) ?? []).filter((t) => t.id !== id)
    const top = at[1] - grab[1] - K.head
    return { col: cols[i].id, index: Math.max(0, Math.min(list.length, Math.round(top / STEP))) }
  }

  const press = (task: Task, x: number, y: number) => (e: ReactPointerEvent) => {
    if (!live || e.button !== 0) return
    // Viewers only select: the press goes on to the view, which pans.
    if (!editor) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const at = local(e)
    setDrag({ id: task.id, from: [e.clientX, e.clientY], grab: [at[0] - x, at[1] - y], at, moving: false, over: null })
  }
  const move = (e: ReactPointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const moving = d.moving || Math.hypot(e.clientX - d.from[0], e.clientY - d.from[1]) > 5
    if (!moving) return
    const at = local(e)
    setDrag({ ...d, at, moving, over: landing(at, d.grab, d.id) })
  }
  const release = (task: Task) => () => {
    const d = dragRef.current
    setDrag(null)
    if (!d) return
    if (!d.moving) return selectTask(piece.id, selected === task.id ? null : task.id)
    if (!d.over) return
    const list = (byCol.get(d.over.col) ?? []).filter((t) => t.id !== task.id)
    const before = list[d.over.index - 1]
    const after = list[d.over.index]
    const was = byCol.get(task.col) ?? []
    const k = was.findIndex((t) => t.id === task.id)
    // Let go where it was: nothing changes.
    if (d.over.col === task.col && was[k - 1]?.id === before?.id && was[k + 1]?.id === after?.id) return
    void moveTask(wid, task, d.over.col, orderBetween(before?.order, after?.order))
  }

  const setCols = (next: KanbanCol[], what: string, key?: string) => void setKanbanCols(wid, piece.id, next, what, key)
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
  const add = (column: string, title: string) => {
    if (!user) return
    const last = (byCol.get(column) ?? []).at(-1)?.order
    addTask(wid, piece.id, column, orderBetween(last, undefined), title, user.id)
  }

  const own = live ? (e: ReactPointerEvent) => e.stopPropagation() : undefined
  const box = (x: number, y: number, w: number, h: number): CSSProperties => ({ left: x, top: y, width: w, height: h })
  const width = colX(cols.length) + (live && editor && cols.length < KANBAN_COLS_MAX ? K.add : 0)
  const most = Math.max(1, ...cols.map((c) => (byCol.get(c.id) ?? []).length + (adding === c.id ? 1 : 0)))
  const height = K.head + most * STEP + K.foot
  const held = drag?.moving ? tasks.find((t) => t.id === drag.id) : undefined

  return (
    <div className={styles.layer} data-live={live || undefined} data-on-canvas={onCanvas || undefined}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }}>
        <div ref={world} className={styles.board} style={{ width, height }} role="list" aria-label={piece.name || 'kanban'} data-dragging={held ? true : undefined}>
          {cols.map((c, i) => {
            const list = (byCol.get(c.id) ?? []).filter((t) => t.id !== held?.id)
            const gap = held && drag?.over?.col === c.id ? drag.over.index : -1
            const n = (byCol.get(c.id) ?? []).length
            const foot = K.head + (list.length + (gap >= 0 ? 1 : 0)) * STEP
            return (
              <div key={c.id} className={styles.column} data-done={c.done || undefined} data-over={gap >= 0 || undefined} style={box(colX(i), 0, K.col, Math.max(height, foot + K.foot))} role="listitem" aria-label={`${c.name}, ${n} tasks`}>
                <ColumnHead
                  col={c}
                  count={n}
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
                  onDone={() => setCols(cols.map((x) => (x.id === c.id ? { ...x, done: !x.done || undefined } : x)), c.done ? 'unmark a finished column' : 'mark a finished column')}
                  onDelete={() => void deleteColumn(wid, piece.id, cols, c.id, tasks)}
                />
                {(byCol.get(c.id) ?? []).map((t) => {
                  // The one held stays where it was, unseen, as the pointer's events are its own until let go.
                  const k = list.indexOf(t)
                  const y = k < 0 ? K.head + (byCol.get(c.id) ?? []).indexOf(t) * STEP : K.head + (k + (gap >= 0 && k >= gap ? 1 : 0)) * STEP
                  return (
                    <TaskCard
                      key={t.id}
                      task={t}
                      finished={!!c.done}
                      style={{ ...box(IN, y, INNER, K.card), transition: held && !reduced ? 'top 160ms var(--ease-out)' : undefined }}
                      hidden={k < 0}
                      selected={selected === t.id}
                      live={live}
                      cardTitle={t.cardId ? (cards.find((x) => x.id === t.cardId)?.title ?? null) : null}
                      onPointerDown={press(t, colX(i) + IN, y)}
                      onPointerMove={move}
                      onPointerUp={release(t)}
                      onClick={live && !editor ? () => selectTask(piece.id, selected === t.id ? null : t.id) : undefined}
                    />
                  )
                })}
                {gap >= 0 && <div className={styles.slot} style={box(IN, K.head + gap * STEP, INNER, K.card)} aria-hidden />}
                {live && editor && (
                  <AddTask
                    open={adding === c.id}
                    style={box(IN, foot, INNER, adding === c.id ? K.card : K.foot - K.cardGap)}
                    onPress={own}
                    onOpen={() => useKanbanUi.setState({ adding: c.id })}
                    onClose={() => useKanbanUi.setState({ adding: null })}
                    onAdd={(title) => add(c.id, title)}
                  />
                )}
              </div>
            )
          })}
          {live && editor && cols.length < KANBAN_COLS_MAX && (
            <button className={styles.addCol} style={box(colX(cols.length), 0, K.add, K.head)} onPointerDown={own} onClick={addCol} title="add a column">
              + column
            </button>
          )}
          {held && drag && (
            <TaskCard
              task={held}
              finished={!!cols.find((c) => c.id === (drag.over?.col ?? held.col))?.done}
              style={box(drag.at[0] - drag.grab[0], drag.at[1] - drag.grab[1], INNER, K.card)}
              selected={false}
              live
              lifted
              cardTitle={held.cardId ? (cards.find((x) => x.id === held.cardId)?.title ?? null) : null}
            />
          )}
        </div>
      </div>
    </div>
  )
}

type HeadProps = {
  col: KanbanCol
  count: number
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
}

// A column's head: its name in caps and its count over a rule (the finished one's name green with a `✓`); live, a
// double-click renames it and its tools show on hover.
function ColumnHead({ col, count, live, editor, naming, first, last, alone, onPress, onName, onRename, onMove, onDone, onDelete }: HeadProps) {
  const [draft, setDraft] = useState(col.name)
  useEffect(() => setDraft(col.name), [col.name, naming])
  const tools = live && editor && !naming
  return (
    <div className={styles.head} style={{ left: 0, top: 0, width: K.col, height: K.head }} onPointerDown={naming || tools ? onPress : undefined}>
      {naming ? (
        <input
          className={styles.headField}
          value={draft}
          autoFocus
          maxLength={COL_NAME_MAX}
          aria-label="Column name"
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
        <span className={styles.headName} onDoubleClick={tools ? onName : undefined} title={tools ? 'double-click to rename' : undefined}>
          {col.done && <span className={styles.doneMark}>✓ </span>}
          {col.name}
        </span>
      )}
      <span className={styles.count}>{count}</span>
      {tools && (
        <span className={styles.tools}>
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
  finished: boolean
  style: CSSProperties
  selected: boolean
  live: boolean
  lifted?: boolean
  hidden?: boolean
  cardTitle: string | null
  onPointerDown?: (e: ReactPointerEvent) => void
  onPointerMove?: (e: ReactPointerEvent) => void
  onPointerUp?: () => void
  onClick?: () => void
}

// A task: its title (Geist, two lines), then a line of what it has: who it's given to (a square with their initials),
// its due day (magenta once past, unless finished), its checklist done of all, the card it's for in that card's colour.
// Hover and selection are a card's corner marks (D-150).
function TaskCard({ task, finished, style, selected, live, lifted, hidden, cardTitle, onPointerDown, onPointerMove, onPointerUp, onClick }: CardProps) {
  const checks = task.checks ?? []
  const ticked = checks.filter((c) => c.done).length
  const late = overdue(task, finished)
  return (
    <div
      className={styles.task}
      data-selected={selected || undefined}
      data-finished={finished || undefined}
      data-lifted={lifted || undefined}
      data-hidden={hidden || undefined}
      style={style}
      role={live ? 'button' : undefined}
      tabIndex={live ? 0 : -1}
      aria-label={task.title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
    >
      <span className={styles.title}>{task.title}</span>
      <span className={styles.meta}>
        {task.assignee && (
          <span className={styles.who} title={task.assigneeName}>
            {initials(task.assigneeName)}
          </span>
        )}
        {task.due && (
          <span className={styles.due} data-late={late || undefined} title={late ? `was due ${task.due}` : `due ${task.due}`}>
            ◷ {dueText(task.due)}
          </span>
        )}
        {checks.length > 0 && (
          <span className={styles.checks} data-all={ticked === checks.length || undefined}>
            ☑ {ticked}/{checks.length}
          </span>
        )}
        {task.cardId && task.cardType && (
          <span className={styles.for} style={{ ['--tone' as string]: TYPE_ACCENT[task.cardType] }} title={cardTitle ?? 'its card is gone'}>
            ▌{cardTitle ?? 'gone'}
          </span>
        )}
      </span>
      {(['nw', 'ne', 'se', 'sw'] as const).map((c) => (
        <span key={c} className={styles.mark} data-corner={c} aria-hidden />
      ))}
    </div>
  )
}

type AddProps = { open: boolean; style: CSSProperties; onPress?: (e: ReactPointerEvent) => void; onOpen: () => void; onClose: () => void; onAdd: (title: string) => void }

// `+ task` at a column's foot: a click types a new one there; Enter makes it and keeps the field for the next, Escape
// (or leaving it empty) stops.
function AddTask({ open, style, onPress, onOpen, onClose, onAdd }: AddProps) {
  const [draft, setDraft] = useState('')
  if (!open)
    return (
      <button className={styles.add} style={style} onPointerDown={onPress} onClick={onOpen}>
        + task
      </button>
    )
  return (
    <label className={styles.adding} style={style} onPointerDown={onPress}>
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
