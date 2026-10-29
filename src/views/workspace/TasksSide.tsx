// The tasks side view (D-300): every deck's tasks from anywhere, on the canvas or in any focus. `☐` by your square or
// `t` opens it on the right, split from what's left like what's open beside a plane (D-211: the same line, dragged, kept
// per browser; one or the other, never both). Tabs on top: each deck holding tasks (in reading order, its number
// magenta, how many unfinished it shows), `MINE` (given to you, across every deck: what `☐` listed before) and `ALL
// DAYS` (every deck on days, as a timeline linked to none). A deck's tab is its board or its days (`[board] [days]`):
// days use the timeline linked to it when there is one, else rows by who it's given to. A deck linked to a plane shows
// only that plane's tasks here too (D-255, D-303), its dock says so. A task picked opens its panel over the left part;
// in a plane's focus the plane glides to its card.
import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useAuth } from '../../data/auth'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { finished, overdue, shownTasks, type Task } from '../../data/tasks'
import { markTasksSeen, useReads } from '../../data/threads'
import { setSplit, useCanvasView, type Bounds } from '../../state/canvasView'
import { useWs, useWsNow } from './context'
import { glidePlaneTo, usePaneView, type EscNext } from './Beside'
import { dueText, kanbanBounds, KanbanDockTools, KanbanLanes, KanbanView, kanbanOf, useKanbanUi } from './Kanban'
import { KanbanFilterDock } from './KanbanFilterDock'
import { KanbanSetupPanel } from './KanbanSetup'
import { T, timelineBounds, TimelineDockTools, TimelineView, WeekTools } from './Timeline'
import { DockAction, FocusDock } from './FocusDock'
import { closeTasksSide, useTasksSide, type DeckView } from './sideState'
import pane from './Beside.module.css'
import styles from './TasksSide.module.css'

// The tabs' row, over the pane, under the breadcrumb's bar (`--hud-h`, 56) whose shade would cover it.
const TABS_H = 56 + 40

type Props = {
  editor: boolean
  // What Escape closes next (in a focus); on the canvas Escape closes it first.
  esc: EscNext | null
  // The plane in focus, if one is: a task picked glides it to its card.
  plane: WithId<Piece> | null
}

export function TasksSide({ editor, esc, plane }: Props) {
  const { pieces, tasks, cards } = useWs()
  const now = useWsNow()
  const size = useCanvasView((s) => s.size)
  const split = useCanvasView((s) => s.split)
  const tab = useTasksSide((s) => s.tab)
  const views = useTasksSide((s) => s.views)
  const left = Math.round(size.w * split)
  const width = size.w - left

  // Decks holding tasks, in reading order.
  const decks = useMemo(() => pieces.filter((p) => p.kind === 'kanban' && kanbanOf(p).holds !== 'cards').sort((a, b) => a.y - b.y || a.x - b.x), [pieces])
  const deck = decks.find((d) => d.id === tab)
  // A deck gone (deleted, or now holding cards): back to MINE.
  const shown = deck ? tab : tab === 'days' ? 'days' : 'mine'
  const view: DeckView = deck ? (views[deck.id] ?? 'board') : 'board'
  const setView = (v: DeckView) => deck && useTasksSide.setState((s) => ({ views: { ...s.views, [deck.id]: v } }))
  const pick = (id: string) => useTasksSide.setState({ tab: id })

  const count = (d: WithId<Piece>) => shownTasks(tasks.filter((t) => t.pieceId === d.id), d, cards).filter((t) => !finished(t, pieces)).length

  // The line between the left part and the side view drags, as beside a plane.
  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => setSplit(ev.clientX / Math.max(1, size.w))
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  const box: Bounds = { x: 0, y: TABS_H, w: width, h: size.h - TABS_H }
  const escHere = esc === null || (esc !== 'unfocus' && esc.what === 'close' && esc.id === 'tasks') ? 'esc' : undefined
  const close = <DockAction label="close" main keyHint={escHere} title="close the tasks side view (t)" onClick={closeTasksSide} />
  const onTask = (t: Task) => {
    const card = plane && t.cardId ? cards.find((c) => c.id === t.cardId) : undefined
    if (card && plane) glidePlaneTo(card, plane.id, cards, now().places, true)
  }

  if (!size.w) return null
  return (
    <>
      <div className={pane.divider} style={{ left }} onPointerDown={drag} role="separator" aria-orientation="vertical" aria-label="The tasks side view's width" />
      <aside className={styles.side} style={{ left, width }} aria-label="Tasks" onPointerDown={(e) => e.stopPropagation()}>
        <div className={styles.tabs} role="tablist" aria-label="Decks">
          {decks.map((d, i) => (
            <button key={d.id} role="tab" aria-selected={shown === d.id} className={styles.tab} onClick={() => pick(d.id)} title={d.name || 'deck'}>
              <b>{String(i + 1).padStart(2, '0')}</b>
              <span className={styles.tabName}>{d.name || 'deck'}</span>
              <em>· {count(d)}</em>
            </button>
          ))}
          {decks.length > 0 && (
            <span className={styles.sep} aria-hidden>
              ·
            </span>
          )}
          <button role="tab" aria-selected={shown === 'mine'} className={styles.tab} onClick={() => pick('mine')}>
            mine
          </button>
          <button role="tab" aria-selected={shown === 'days'} className={styles.tab} onClick={() => pick('days')}>
            all days
          </button>
        </div>
        {shown === 'mine' ? (
          <Mine decks={decks} onPick={(d, t) => (useTasksSide.setState((s) => ({ tab: d, views: { ...s.views, [d]: 'board' } })), useKanbanUi.setState({ pending: { piece: d, task: t.id } }), onTask(t))}>
            {close}
          </Mine>
        ) : shown === 'days' ? (
          <Days key="all" box={box} deck={null} editor={editor} onTask={onTask} close={close} />
        ) : deck && view === 'days' ? (
          <Days key={`days:${deck.id}`} box={box} deck={deck} editor={editor} onTask={onTask} close={close} viewTools={<ViewTools view={view} onView={setView} />} />
        ) : deck ? (
          <Board key={deck.id} box={box} deck={deck} editor={editor} onTask={onTask} close={close} esc={esc} viewTools={<ViewTools view={view} onView={setView} />} />
        ) : null}
      </aside>
    </>
  )
}

function ViewTools({ view, onView }: { view: DeckView; onView: (v: DeckView) => void }) {
  return (
    <>
      <DockAction label="board" pressed={view === 'board'} title="its columns" onClick={() => onView('board')} />
      <DockAction label="days" pressed={view === 'days'} title="its tasks on days, by due day" onClick={() => onView('days')} />
    </>
  )
}

type PartProps = { box: Bounds; editor: boolean; onTask: (t: Task) => void; close: ReactNode; viewTools?: ReactNode }

// A deck's board in a view of its own (as beside a plane).
function Board({ box, deck, editor, onTask, close, esc, viewTools }: PartProps & { deck: WithId<Piece>; esc: EscNext | null }) {
  const { tasks } = useWs()
  const { el, view, pan } = usePaneView(kanbanBounds(deck, tasks), box, true)
  const setupOpen = useKanbanUi((s) => s.setup === deck.id)
  return (
    <div ref={el} className={styles.part} style={{ top: box.y, height: box.h }} onPointerDown={pan}>
      <KanbanView piece={deck} view={view} live editor={editor} onTask={onTask} />
      {setupOpen && editor && <KanbanSetupPanel piece={deck} />}
      <FocusDock label="Tasks" name={<Name deck={deck} />}>
        {viewTools}
        <KanbanFilterDock piece={deck} />
        <KanbanLanes piece={deck} editor={editor} />
        <KanbanDockTools piece={deck} editor={editor} />
        {editor && (
          <DockAction
            label="setup"
            pressed={setupOpen}
            keyHint={esc !== null && esc !== 'unfocus' && esc.what === 'setup' && esc.id === deck.id ? 'esc' : undefined}
            title="what it holds: tasks, or cards by a field"
            onClick={() => useKanbanUi.setState((s) => ({ setup: s.setup === deck.id ? null : deck.id }))}
          />
        )}
        {close}
      </FocusDock>
    </div>
  )
}

// A deck's days (the timeline linked to it, else one of its own here), or every deck's (`deck` null).
function Days({ box, deck, editor, onTask, close, viewTools }: PartProps & { deck: WithId<Piece> | null }) {
  const { pieces, tasks, cards } = useWs()
  const linked = deck ? pieces.find((p) => p.kind === 'timeline' && p.stuckTo === deck.id) : undefined
  // Not stored: a timeline with no piece, its weeks and filter kept under its own key.
  const own = useMemo(
    () => ({ id: deck ? `tasks-side:${deck.id}` : 'tasks-side:all', kind: 'timeline', x: 0, y: 0, w: 0, h: 0, createdAt: 0, updatedAt: 0, ...(deck ? { stuckTo: deck.id, timeline: { rows: 'assignee' } } : {}) }) as WithId<Piece>,
    [deck?.id],
  )
  const piece = linked ?? own
  const pool = useMemo(() => tasks.filter((t) => (deck ? t.pieceId === deck.id : pieces.some((p) => p.id === t.pieceId && p.kind === 'kanban'))), [tasks, pieces, deck])
  const { el, view, pan } = usePaneView(timelineBounds(piece, pieces, tasks, cards, T.besideDays), box, true)
  return (
    <div ref={el} className={styles.part} style={{ top: box.y, height: box.h }} onPointerDown={pan}>
      <TimelineView piece={piece} view={view} live editor={editor} onTask={onTask} span={T.besideDays} />
      <FocusDock label="Tasks" name={deck ? <Name deck={deck} /> : <span className={pane.kind}>all days</span>}>
        {viewTools}
        {linked ? (
          <TimelineDockTools piece={linked} editor={editor} />
        ) : (
          <>
            <KanbanFilterDock piece={piece} pool={pool} />
            <WeekTools piece={piece} />
          </>
        )}
        {close}
      </FocusDock>
    </div>
  )
}

const Name = ({ deck }: { deck: WithId<Piece> }) => (
  <>
    <span className={pane.kind}>deck</span>
    {deck.name ? ` · ${deck.name}` : ''}
  </>
)

// Tasks given to you, not finished, across every deck, by deck; the new ones (given by someone else since you last
// looked) marked `●`, and seen once shown. A row goes to its task here: its deck's board, the task picked once that's
// live (`pending`, as going to a task does).
function Mine({ decks, onPick, children }: { decks: WithId<Piece>[]; onPick: (deck: string, t: Task) => void; children: ReactNode }) {
  const { wid, tasks, pieces } = useWs()
  const { user } = useAuth()
  const me = user?.id ?? null
  const lookedAt = useReads(wid, me).data?.tasks ?? 0
  // New: given by someone else since you last looked. Shown, they're seen (your read mark moves on), but stay marked
  // while it's shown: `held` keeps when you'd looked before. Only once the mark has held still a moment: the first one
  // read can be the cache's, empty, before the real one.
  const [held, setHeld] = useState<number | null>(null)
  const since = held ?? lookedAt
  const isNew = (t: Task) => (t.givenAt ?? 0) > since && t.givenBy !== me
  const mine = tasks.filter((t) => me && t.assignee === me && !finished(t, pieces))
  const fresh = mine.some((t) => (t.givenAt ?? 0) > lookedAt && t.givenBy !== me)
  useEffect(() => {
    if (!fresh) return
    const id = setTimeout(() => {
      setHeld((h) => h ?? lookedAt)
      void markTasksSeen(wid)
    }, 600)
    return () => clearTimeout(id)
  }, [fresh, lookedAt, wid])
  const colOf = (d: WithId<Piece>, t: Task) => kanbanOf(d).cols.find((c) => c.id === t.col)?.name
  const groups = decks.map((d) => ({ d, list: mine.filter((t) => t.pieceId === d.id).sort((a, b) => Number(isNew(b)) - Number(isNew(a)) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt - b.createdAt) })).filter((g) => g.list.length)
  return (
    <div className={styles.part} style={{ top: TABS_H, bottom: 0 }}>
      <div className={styles.mine} data-scrolls>
        {!groups.length && <p className={styles.none}>nothing given to you{decks.length ? '' : ': no deck yet, put one on the canvas from its +'}</p>}
        {groups.map(({ d, list }) => (
          <section key={d.id} className={styles.group} aria-label={d.name || 'deck'}>
            <h3 className={styles.groupHead}>
              <b>{String(decks.indexOf(d) + 1).padStart(2, '0')}</b>
              {d.name || 'deck'}
              <span className={styles.rule} aria-hidden />
              <span className={styles.dim}>{list.length}</span>
            </h3>
            {list.map((t) => {
              const late = overdue(t, false)
              return (
                <button key={t.id} className={styles.row} onClick={() => onPick(d.id, t)}>
                  <span className={isNew(t) ? styles.new : styles.dim}>{isNew(t) ? '●' : '☐'}</span>
                  <span className={styles.title}>{t.title}</span>
                  <span className={late ? styles.late : styles.dim}>{t.due ? `${late ? 'was due ' : ''}${dueText(t.due)}` : '—'}</span>
                  <span className={styles.dim}>{colOf(d, t)}</span>
                </button>
              )
            })}
          </section>
        ))}
        {groups.length > 0 && <p className={styles.foot}>● new since you last looked (the count on ☐). A row goes to its task.</p>}
      </div>
      <FocusDock label="Tasks" name={<span className={pane.kind}>mine</span>}>
        {children}
      </FocusDock>
    </div>
  )
}
