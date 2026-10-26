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
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { create } from 'zustand'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { addTask, COL_NAME_MAX, deleteColumn, deleteTask, emptyKanban, KANBAN_COLS_MAX, moveTask, orderBetween, overdue, setKanbanCols, TASK_TITLE_MAX, tasksIn, today, type KanbanCol, type KanbanSetup, type Task } from '../../data/tasks'
import { newId } from '../../data/matrix'
import { useAuth } from '../../data/auth'
import type { Bounds, PlaneCam } from '../../state/canvasView'
import type { Card } from '../../data/cards'
import { useWs } from './context'
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
const guess = (t: Task) => K.pad + Math.min(3, Math.max(1, Math.ceil(t.title.length / 30))) * K.line + (hasMeta(t) ? K.meta : 0)

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
// renamed, the task whose panel should open on its evidence form (D-254). Yours, not shared.
export const useKanbanUi = create<{ selected: { piece: string; task: string } | null; adding: string | null; naming: string | null; learning: string | null }>(() => ({
  selected: null,
  adding: null,
  naming: null,
  learning: null,
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

// A checklist as small cells, done ones filled (up to 8; past that, the count alone).
const cells = (done: number, all: number) => (all > 8 ? '' : '▮'.repeat(done) + '▯'.repeat(all - done))

// A task held: where the press began (screen), where in the task it was taken and its size (its px), where the pointer
// is now (its px), and where it would land.
type Drag = { id: string; from: [number, number]; grab: [number, number]; size: [number, number]; at: [number, number]; moving: boolean; over: { col: string; index: number } | null }

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
  const board = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag

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
    if (!live) return
    return () => useKanbanUi.setState((s) => ({ selected: s.selected?.piece === piece.id ? null : s.selected, adding: null, naming: null }))
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
  // Where a task held under the pointer would land, read off what's drawn: the column under the pointer (or the
  // nearest), and the place among its other tasks by their middles.
  const landing = (x: number, y: number, id: string) => {
    const columns = [...(board.current?.querySelectorAll<HTMLElement>('[data-col]') ?? [])]
    if (!columns.length) return null
    const dist = (c: HTMLElement) => {
      const r = c.getBoundingClientRect()
      return x < r.left ? r.left - x : x > r.right ? x - r.right : 0
    }
    const col = columns.reduce((a, b) => (dist(b) < dist(a) ? b : a))
    const rows = [...col.querySelectorAll<HTMLElement>('[data-task]')].filter((t) => t.dataset.task !== id)
    const index = rows.filter((t) => {
      const r = t.getBoundingClientRect()
      return r.top + r.height / 2 < y
    }).length
    return { col: col.dataset.col!, index }
  }

  const drop = (task: Task) => {
    const d = dragRef.current
    setDrag(null)
    if (!d) return
    if (!d.moving) return selectTask(piece.id, useKanbanUi.getState().selected?.task === task.id ? null : task.id)
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
  // A press on a task: held; it moves after 5 px. The window hears the pointer meanwhile, since the task leaves its list
  // while it's held.
  const press = (task: Task) => (e: ReactPointerEvent<HTMLElement>) => {
    if (!live || e.button !== 0 || !editor) return
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const s = scale()
    setDrag({ id: task.id, from: [e.clientX, e.clientY], grab: [(e.clientX - r.left) / s, (e.clientY - r.top) / s], size: [r.width / s, r.height / s], at: local(e.clientX, e.clientY), moving: false, over: null })
    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const moving = d.moving || Math.hypot(ev.clientX - d.from[0], ev.clientY - d.from[1]) > 5
      if (moving) setDrag({ ...d, at: local(ev.clientX, ev.clientY), moving, over: landing(ev.clientX, ev.clientY, d.id) ?? d.over })
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
  const add = (column: string, title: string) => {
    if (!user) return
    const last = (byCol.get(column) ?? []).at(-1)?.order
    addTask(wid, piece.id, column, orderBetween(last, undefined), title, user.id)
  }

  const own = live ? (e: ReactPointerEvent) => e.stopPropagation() : undefined
  const held = drag?.moving ? tasks.find((t) => t.id === drag.id) : undefined
  const cardOf = (t: Task) => (t.cardId ? (cards.find((x) => x.id === t.cardId) ?? null) : null)
  const vars = { ['--col' as string]: `${K.col}px`, ['--gap' as string]: `${K.gap}px`, ['--head' as string]: `${K.head}px`, ['--card-gap' as string]: `${K.cardGap}px` } as CSSProperties

  return (
    <div className={styles.layer} data-live={live || undefined} data-on-canvas={onCanvas || undefined}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }}>
        <div ref={board} className={styles.board} style={vars} role="list" aria-label={piece.name || 'kanban'} data-dragging={held ? true : undefined}>
          {cols.map((c, i) => {
            const every = byCol.get(c.id) ?? []
            const list = held ? every.filter((t) => t.id !== held.id) : every
            const slot = held && drag?.over?.col === c.id ? drag.over.index : -1
            return (
              <div key={c.id} className={styles.column} data-col={c.id} data-done={c.done || undefined} data-over={slot >= 0 || undefined} role="listitem" aria-label={`${c.name}, ${every.length} tasks`}>
                <ColumnHead
                  col={c}
                  n={i + 1}
                  count={every.length}
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
                <div className={styles.list}>
                  {list.map((t, k) => (
                    <Slotted key={t.id} slot={slot === k}>
                      <TaskCard
                        task={t}
                        card={cardOf(t)}
                        finished={!!c.done}
                        selected={selected === t.id}
                        live={live}
                        learn={live && editor && learnable(t, cardOf(t) ?? undefined, !!c.done) ? () => (selectTask(piece.id, t.id), useKanbanUi.setState({ learning: t.id })) : undefined}
                        onPointerDown={press(t)}
                        onClick={live && !editor ? () => selectTask(piece.id, selected === t.id ? null : t.id) : undefined}
                      />
                    </Slotted>
                  ))}
                  {slot >= 0 && slot >= list.length && <span className={styles.slot} aria-hidden />}
                  {!list.length && slot < 0 && adding !== c.id && <span className={styles.empty}>· nothing yet</span>}
                  {live && editor && (
                    <AddTask open={adding === c.id} onPress={own} onOpen={() => useKanbanUi.setState({ adding: c.id })} onClose={() => useKanbanUi.setState({ adding: null })} onAdd={(title) => add(c.id, title)} />
                  )}
                </div>
              </div>
            )
          })}
          {live && editor && cols.length < KANBAN_COLS_MAX && (
            <button className={styles.addCol} onPointerDown={own} onClick={addCol} title="add a column">
              + column
            </button>
          )}
          {held && drag && (
            <div className={styles.ghost} style={{ left: drag.at[0] - drag.grab[0], top: drag.at[1] - drag.grab[1], width: drag.size[0] }} aria-hidden>
              <TaskCard task={held} card={cardOf(held)} finished={!!cols.find((c) => c.id === (drag.over?.col ?? held.col))?.done} selected={false} live lifted />
            </div>
          )}
        </div>
      </div>
    </div>
  )
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

// A column's head, as the right panel's sections: its number faint, its name in caps, a rule, its count; the finished
// one's name green. Live, a double-click renames it, and on hover its tools come in after the count.
function ColumnHead({ col, n, count, live, editor, naming, first, last, alone, onPress, onName, onRename, onMove, onDone, onDelete }: HeadProps) {
  const [draft, setDraft] = useState(col.name)
  useEffect(() => setDraft(col.name), [col.name, naming])
  const tools = live && editor && !naming
  return (
    <div className={styles.head} onPointerDown={naming || tools ? onPress : undefined}>
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
  card: Card | null
  finished: boolean
  selected: boolean
  live: boolean
  lifted?: boolean
  // Finished, for a card still being tested (D-254): its line asking what it taught.
  learn?: () => void
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void
  onClick?: () => void
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
        {task.title}
      </span>
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

type AddProps = { open: boolean; onPress?: (e: ReactPointerEvent) => void; onOpen: () => void; onClose: () => void; onAdd: (title: string) => void }

// `+ add a task` under a column's last task, a faint line: a click types a new one in its place, a sheet like a task with
// the menus' cyan `>` (D-222); Enter makes it and keeps the field for the next, Escape (or leaving it empty) stops.
function AddTask({ open, onPress, onOpen, onClose, onAdd }: AddProps) {
  const [draft, setDraft] = useState('')
  if (!open)
    return (
      <button className={styles.add} onPointerDown={onPress} onClick={onOpen}>
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
