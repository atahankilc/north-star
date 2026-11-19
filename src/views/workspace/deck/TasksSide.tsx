// Tasks' parts (D-412, D-419): a deck's board and its days (BoardAndDays, Board, Days), the tasks given to you (Mine)
// and a deck as a tab (deckTab), drawn in Tasks (TasksPlace.tsx). They were the tasks side view's (D-300), gone with
// D-419: a plane's linked deck and a deck's days open in Tasks now. A deck's board and its days are each a view of
// their own (as beside a plane), with a dock at their part's foot.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../../../data/auth'
import { piecesOn } from '../../../data/canvases'
import type { WithId } from '../../../data/hooks'
import type { Piece } from '../../../data/model'
import type { Card } from '../../../data/cards'
import { finished, overdue, timelineOf, type Task } from '../../../data/tasks'
import { markTasksSeen, useReads } from '../../../data/threads'
import type { Bounds } from '../../../state/canvasView'
import { useWs } from '../canvas/context'
import { usePaneView } from '../canvas/Beside'
import { kanbanBounds, KanbanView, kanbanOf, selectTask, useKanbanUi } from './Kanban'
import { dueText } from '../../../model/tasks'
import { leadingNumber } from '../../../model/words'
import { KanbanFilterDock } from './KanbanFilterDock'
import { LensSetup, LensTools } from '../canvas/pieceKinds'
import { T, timelineBounds, TimelineDockTools, TimelineView, WeekTools } from './Timeline'
import { FocusDock } from '../canvas/FocusDock'
import pane from '../canvas/Beside.module.css'
import styles from './TasksSide.module.css'
import { DragLine } from '../../../ui/primitives/DragLine'
import { Empty } from '../../../ui/primitives/Empty'
import { Num, Rule } from '../../../ui/primitives/Rule'

// A deck's board and, with `days`, its days beside it, the line between them dragged (the side view's and Tasks', D-412).
export function BoardAndDays(p: { deck: WithId<Piece>; top: number; width: number; height: number; deckW: number; days: boolean; editor: boolean; onTask: (t: Task) => void; onCard: (c: Card) => void; boardDock: ReactNode; close: ReactNode; daysDock: ReactNode; onDrag: (e: PointerEvent) => void }) {
  return (
    <>
      <Board key={p.deck.id} box={{ x: 0, y: p.top, w: p.deckW, h: p.height }} deck={p.deck} editor={p.editor} onTask={p.onTask} onCard={p.onCard} dock={p.boardDock} close={p.close} />
      {p.days && (
        <>
          <DragLine at="x" style={{ left: p.deckW, top: p.top }} onDrag={p.onDrag} label="The deck and its days" />
          <Days key={`days:${p.deck.id}`} box={{ x: p.deckW, y: p.top, w: p.width - p.deckW, h: p.height }} deck={p.deck} plane={null} editor={p.editor} onTask={p.onTask} dock={p.daysDock} />
        </>
      )}
    </>
  )
}

// A deck as a tab (D-300; Tasks' too, D-412): its number, its name, `⇆` when it's linked to a plane, what it counts.
// `on`: what it's on, said after it (Tasks, D-419: the plane it's linked to, the canvas it's on when that's another).
export const deckTab = (d: WithId<Piece>, i: number, count?: ReactNode, on?: string) => ({
  value: d.id,
  title: [d.name || 'deck', on].filter(Boolean).join(' · '),
  count,
  label: (
    <>
      {/* One number: the deck's own when its name leads with one (`05 Launch`), else its place in the row. */}
      <Num n={leadingNumber(d.name ?? '')?.num ?? i + 1} /> <span className={styles.tabName}>{leadingNumber(d.name ?? '')?.rest || d.name || 'deck'}</span>
      {d.stuckTo && (
        <span className={styles.link} title="linked to a plane: only its cards' tasks">
          {' '}⇆
        </span>
      )}
      {on && <span className={styles.tabOn}> {on}</span>}
    </>
  ),
})

type PartProps = { box: Bounds; editor: boolean; onTask: (t: Task) => void; dock: ReactNode }

// A deck's board in a view of its own (as beside a plane), its dock with what it does.
function Board({ box, deck, editor, onTask, onCard, dock, close }: PartProps & { deck: WithId<Piece>; onCard: (c: Card) => void; close: ReactNode }) {
  const { tasks } = useWs()
  const { el, view, pan } = usePaneView(kanbanBounds(deck, tasks), box, true, 0.85)
  return (
    <div ref={el} className={styles.part} style={{ left: box.x, top: box.y, width: box.w, height: box.h }} onPointerDown={pan}>
      <KanbanView piece={deck} view={view} live editor={editor} onTask={onTask} onCard={onCard} />
      <LensSetup piece={deck} editor={editor} />
      {/* At its own part's middle (D-419): left to the sheet's, it slid off a narrow part (the Tasks column). */}
      <FocusDock label="Deck" name={<Name deck={deck} />} center={box.w / 2}>
        {dock}
        <LensTools piece={deck} editor={editor} />
        {close}
      </FocusDock>
    </div>
  )
}

// A deck's days: the timeline linked to it, else one of its own here (rows by who). Every deck's (`deck` null): the
// timeline stuck to `plane` when there's one (a plane with no deck, D-300), else one of its own (rows by deck).
export function Days({ box, deck, plane, editor, onTask, dock }: PartProps & { deck: WithId<Piece> | null; plane: WithId<Piece> | null }) {
  const { pieces, tasks, cards, canvas, spots } = useWs()
  // A deck's timeline, linked to it or through its plane; a plane's, linked to it (a plane with no deck).
  const linked = deck ? timelineOf(deck.id, pieces) : plane ? pieces.find((p) => p.kind === 'timeline' && p.stuckTo === plane.id) : undefined
  // Not stored: a timeline with no piece, its weeks and filter kept under its own key.
  // ALL · DAYS keeps to this canvas's decks, as the tabs do (`only`).
  const onCanvas = useMemo(() => piecesOn(canvas, pieces, spots).filter((p) => p.kind === 'kanban').map((p) => p.id), [canvas, pieces, spots])
  const onKey = onCanvas.join()
  const own = useMemo(
    () => ({ id: deck ? `tasks-side:${deck.id}` : 'tasks-side:all', kind: 'timeline', x: 0, y: 0, w: 0, h: 0, createdAt: 0, updatedAt: 0, ...(deck ? { stuckTo: deck.id, timeline: { rows: 'assignee' } } : { only: onCanvas }) }) as WithId<Piece>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deck?.id, onKey],
  )
  const piece = linked ?? own
  const pool = useMemo(() => tasks.filter((t) => (deck ? t.pieceId === deck.id : onCanvas.includes(t.pieceId))), [tasks, onCanvas, deck])
  const { el, view, pan } = usePaneView(timelineBounds(piece, pieces, tasks, cards, T.besideDays), box, true)
  return (
    <div ref={el} className={styles.part} style={{ left: box.x, top: box.y, width: box.w, height: box.h }} onPointerDown={pan}>
      <TimelineView piece={piece} view={view} live editor={editor} onTask={onTask} span={T.besideDays} />
      <FocusDock label="Days" name={<span className={pane.kind}>{deck ? 'days' : 'all · days'}</span>} center={box.w / 2}>
        {linked ? (
          <TimelineDockTools piece={linked} editor={editor} compact />
        ) : (
          <>
            <KanbanFilterDock piece={piece} pool={pool} />
            <WeekTools piece={piece} compact />
          </>
        )}
        {dock}
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

// Tasks given to you, not finished, across this canvas's decks, by deck; the new ones (given by someone else since you
// last looked) marked `●`, and seen once shown. A row picks its task: its panel opens here, nothing else moves.
// `find`: only the tasks whose title has it (Tasks' find, D-419).
export function Mine({ decks, top, find = '', children }: { decks: WithId<Piece>[]; top: number; find?: string; children: ReactNode }) {
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
  const k = find.trim().toLowerCase()
  const mine = tasks.filter((t) => me && t.assignee === me && !finished(t, pieces) && (!k || t.title.toLowerCase().includes(k)))
  const fresh = mine.some((t) => (t.givenAt ?? 0) > lookedAt && t.givenBy !== me)
  useEffect(() => {
    if (!fresh) return
    const id = setTimeout(() => {
      setHeld((h) => h ?? lookedAt)
      void markTasksSeen(wid)
    }, 600)
    return () => clearTimeout(id)
  }, [fresh, lookedAt, wid])
  const picked = useKanbanUi((s) => s.selected?.task ?? null)
  const colOf = (d: WithId<Piece>, t: Task) => kanbanOf(d).cols.find((c) => c.id === t.col)?.name
  const groups = decks.map((d) => ({ d, list: mine.filter((t) => t.pieceId === d.id).sort((a, b) => Number(isNew(b)) - Number(isNew(a)) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt - b.createdAt) })).filter((g) => g.list.length)
  return (
    <div className={styles.part} style={{ left: 0, right: 0, top, bottom: 0 }}>
      <div className={styles.mine} data-scrolls>
        {!groups.length && (
          <Empty className={styles.none}>
            nothing given to you{decks.length ? '' : ': no deck yet'}
          </Empty>
        )}
        {groups.map(({ d, list }) => (
          <section key={d.id} className={styles.group} aria-label={d.name || 'deck'}>
            <Rule className={styles.groupHead} n={leadingNumber(d.name ?? '')?.num ?? decks.indexOf(d) + 1} name={leadingNumber(d.name ?? '')?.rest || d.name || 'deck'} count={list.length} countAt="end" />
            {list.map((t) => {
              const late = overdue(t, false)
              return (
                <button /* kit-ok: a task's whole row (mark, title, due) that picks it */ key={t.id} className={styles.row} aria-pressed={picked === t.id} onClick={() => selectTask(d.id, t.id)}>
                  <span className={isNew(t) ? styles.new : styles.dim}>{isNew(t) ? '●' : '☐'}</span>
                  <span className={styles.title}>{t.title}</span>
                  <span className={late ? styles.late : styles.dim}>{t.due ? `${late ? 'was due ' : ''}${dueText(t.due)}` : '—'}</span>
                  <span className={styles.dim}>{colOf(d, t)}</span>
                </button>
              )
            })}
          </section>
        ))}
      </div>
      <FocusDock label="Mine" name={<span className={pane.kind}>mine</span>}>
        {children}
      </FocusDock>
    </div>
  )
}
