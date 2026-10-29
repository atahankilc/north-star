// The tasks side view (D-300): decks and their days, from anywhere, on the canvas or in any focus; the one place they
// open (a plane's linked deck too). Left to right it reads plane → deck → days: the side nav's icon or `t` opens it on
// the right, split from what's left by beside's line (D-211); a deck's `[days ›]` adds its days as a third column (the
// left part narrowing to its own share), `[‹ close]` takes them away. Below 1300 px there's no room for three: the days
// slide over the deck, `‹ back to the board`. In a deck's own focus the deck is on the left already: only its days.
// Tabs on top: each deck on this canvas (reading order, its number magenta, `⇆` when linked to a plane, how many
// unfinished tasks it shows, or how many cards: a deck holding cards is a tab too, its board only, D-314); in the corner, apart, what goes across them: `MINE` (given to you, new ones `●`) and
// `ALL · DAYS` (every deck's days, as a timeline linked to nothing). Opened from a plane's dock it's that plane's linked
// deck, a strip under the tabs saying so (`[all decks]` lets go). Days are the deck's linked timeline's when it has one,
// else rows by who it's given to. A task picked opens its panel inside the side view (TaskPanel), and in a plane's
// focus the plane glides to its card; nothing switches view by itself.
import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useAuth } from '../../data/auth'
import { piecesOn } from '../../data/canvases'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import type { Card } from '../../data/cards'
import { finished, overdue, shownTasks, timelineOf, type Task } from '../../data/tasks'
import { heldCards } from './kanbanCards'
import { markTasksSeen, useReads } from '../../data/threads'
import { setSplit, useCanvasView, type Bounds } from '../../state/canvasView'
import { useWs, useWsNow } from './context'
import { glidePlaneTo, usePaneView, type EscNext } from './Beside'
import { dueText, kanbanBounds, KanbanDockTools, KanbanLanes, KanbanView, kanbanOf, selectTask, useKanbanUi } from './Kanban'
import { KanbanFilterDock } from './KanbanFilterDock'
import { KanbanSetupPanel } from './KanbanSetup'
import { T, timelineBounds, TimelineDockTools, TimelineView, WeekTools } from './Timeline'
import { DockAction, FocusDock } from './FocusDock'
import { closeTasksSide, useTasksSide } from './sideState'
import pane from './Beside.module.css'
import styles from './TasksSide.module.css'

// The tabs' row, under the breadcrumb's bar (`--hud-h`, 56) whose shade would cover it; the linked strip under it.
const TABS_H = 56 + 40
const STRIP_H = 30
// Narrower than this, the days slide over the deck instead of standing beside it.
const WIDE = 1300

type Props = {
  editor: boolean
  // What Escape closes next (in a focus); on the canvas Escape closes it first.
  esc: EscNext | null
  // The piece in focus, if any: its deck isn't drawn again here.
  focusedId: string | null
  // The plane in focus, if one is: a task picked glides it to its card.
  plane: WithId<Piece> | null
}

// The left part's share before the days took some (given back when they close).
let splitBefore: number | null = null

export function TasksSide({ editor, esc, focusedId, plane }: Props) {
  const { pieces, tasks, cards, canvas, spots } = useWs()
  const now = useWsNow()
  const { user } = useAuth()
  const size = useCanvasView((s) => s.size)
  const split = useCanvasView((s) => s.split)
  const tab = useTasksSide((s) => s.tab)
  const daysOpen = useTasksSide((s) => s.days)
  const linkedTo = useTasksSide((s) => s.linked)
  const inner = useTasksSide((s) => s.inner)

  // The decks on this canvas, in reading order (holding tasks or cards).
  const decks = useMemo(() => piecesOn(canvas, pieces, spots).filter((p) => p.kind === 'kanban').sort((a, b) => a.y - b.y || a.x - b.x), [pieces, canvas, spots])
  const deck = decks.find((d) => d.id === tab) ?? (focusedId === tab ? pieces.find((p) => p.id === tab && p.kind === 'kanban') : undefined)
  // A deck gone (deleted, elsewhere, holding cards now): MINE.
  const shown = deck ? 'deck' : tab === 'all' ? 'all' : 'mine'
  const deckOnLeft = !!deck && focusedId === deck.id
  // A deck holding cards has no days.
  const ofCards = !!deck && kanbanOf(deck).holds === 'cards'
  const days = daysOpen && !ofCards
  const wide = size.w >= WIDE
  const twoCols = !!deck && days && wide && !deckOnLeft
  const plane2 = linkedTo ? pieces.find((p) => p.id === linkedTo) : undefined
  const strip = plane2 && (shown === 'all' || (deck && deck.stuckTo === plane2.id)) ? plane2 : undefined

  // The days as a third column take the left part down to its own share; closing them gives it back.
  useEffect(() => {
    const cv = useCanvasView.getState()
    if (twoCols) {
      if (splitBefore === null) splitBefore = cv.split
      useCanvasView.setState({ split: useTasksSide.getState().splitDays })
    } else if (splitBefore !== null) {
      useCanvasView.setState({ split: splitBefore })
      splitBefore = null
    }
  }, [twoCols])
  useEffect(
    () => () => {
      if (splitBefore === null) return
      useCanvasView.setState({ split: splitBefore })
      splitBefore = null
    },
    [],
  )

  const left = Math.round(size.w * split)
  const width = size.w - left
  const top = TABS_H + (strip ? STRIP_H : 0)
  const deckW = twoCols ? Math.round(width * inner) : width

  // The line between the left part and the side view drags (the days' share kept apart from beside's).
  const drag = (e: ReactPointerEvent<HTMLDivElement>) =>
    follow(e, (x) => {
      const at = x / Math.max(1, size.w)
      if (!twoCols) return setSplit(at)
      const v = Math.min(0.6, Math.max(0.15, at))
      useTasksSide.setState({ splitDays: v })
      useCanvasView.setState({ split: v })
    })
  // The line between the deck and its days.
  const dragInner = (e: ReactPointerEvent<HTMLDivElement>) => follow(e, (x) => useTasksSide.setState({ inner: Math.min(0.7, Math.max(0.3, (x - left) / Math.max(1, width))) }))

  const count = (d: WithId<Piece>) => (kanbanOf(d).holds === 'cards' ? `${heldCards(d, cards).length} cards` : shownTasks(tasks.filter((t) => t.pieceId === d.id), d, cards).filter((t) => !finished(t, pieces)).length)
  const me = user?.id ?? null
  const taskDecks = decks.filter((d) => kanbanOf(d).holds !== 'cards')
  const mine = tasks.filter((t) => me && t.assignee === me && !finished(t, pieces) && taskDecks.some((d) => d.id === t.pieceId))

  // Escape's `esc`: on the days' `[‹ close]` while they're open beside the deck, else on the side view's `[close]`.
  const escSide = esc === null || (esc !== 'unfocus' && esc.what === 'close' && esc.id === 'tasks')
  const daysClose = !!deck && days && !deckOnLeft
  const close = <DockAction label="close" main keyHint={escSide && !daysClose ? 'esc' : undefined} title="close decks and days (t)" onClick={closeTasksSide} />
  const closeDays = (
    <DockAction label={wide ? '‹ close' : '‹ back to the board'} keyHint={escSide && daysClose ? 'esc' : undefined} title="the board without its days" onClick={() => useTasksSide.setState({ days: false })} />
  )
  const daysToggle = !deckOnLeft && !ofCards && <DockAction label={days ? 'days ‹' : 'days ›'} pressed={days} title={days ? 'close its days' : 'its days beside it'} onClick={() => useTasksSide.setState({ days: !days })} />
  const onTask = (t: Task) => {
    const card = plane && t.cardId ? cards.find((c) => c.id === t.cardId) : undefined
    if (card && plane) glidePlaneTo(card, plane.id, cards, now().places, true)
  }
  // A card picked on a deck holding cards: its panel, and in a plane's focus the plane glides to it (as beside, D-211).
  const onCard = (c: Card) => {
    useCanvasView.setState({ cardSelected: c.id, labelSelected: null })
    if (plane) glidePlaneTo(c, plane.id, cards, now().places)
  }

  if (!size.w) return null
  const colH = size.h - top
  return (
    <>
      <div className={pane.divider} style={{ left, zIndex: 6 }} onPointerDown={drag} role="separator" aria-orientation="vertical" aria-label="The side view's width" />
      <aside className={styles.side} style={{ left, width }} aria-label="Decks and days" onPointerDown={(e) => e.stopPropagation()}>
        <div className={styles.tabs}>
          <div className={styles.decks} role="tablist" aria-label="Decks">
            {decks.map((d, i) => (
              <button key={d.id} role="tab" aria-selected={tab === d.id} className={styles.tab} onClick={() => useTasksSide.setState({ tab: d.id, linked: null })} title={d.name || 'deck'}>
                <b>{String(i + 1).padStart(2, '0')}</b>
                <span className={styles.tabName}>{d.name || 'deck'}</span>
                {d.stuckTo && (
                  <span className={styles.link} title="linked to a plane: only its cards' tasks">
                    ⇆
                  </span>
                )}
                <em>· {count(d)}</em>
              </button>
            ))}
            {!decks.length && <span className={styles.dim}>no deck on this canvas yet</span>}
          </div>
          {/* Across every deck, apart from them (D-300). */}
          <div className={styles.corner} role="tablist" aria-label="Across decks">
            <button role="tab" aria-selected={shown === 'mine'} className={styles.chip} onClick={() => useTasksSide.setState({ tab: 'mine', linked: null })} title="given to you, across decks">
              mine <em>· {mine.length}</em>
              <NewMark />
            </button>
            <button role="tab" aria-selected={shown === 'all'} className={styles.chip} onClick={() => useTasksSide.setState({ tab: 'all', linked: null })} title="every deck's tasks on days">
              all · days
            </button>
          </div>
        </div>
        {strip && (
          <div className={styles.strip} style={{ top: TABS_H, height: STRIP_H }}>
            <span>
              ⇆ linked to <b>{strip.name || 'a plane'}</b> <span className={styles.dim}>· its cards only</span>
            </span>
            <button className={styles.stripAll} onClick={() => useTasksSide.setState({ linked: null })} title="the side view's tabs as from the side nav">
              [all decks]
            </button>
          </div>
        )}
        {shown === 'mine' ? (
          <Mine decks={taskDecks} top={top}>
            {close}
          </Mine>
        ) : shown === 'all' ? (
          <Days key={`all:${strip?.id ?? ''}`} box={{ x: 0, y: top, w: width, h: colH }} deck={null} plane={strip ?? null} editor={editor} onTask={onTask} dock={close} />
        ) : deck && !ofCards && (deckOnLeft || (days && !wide)) ? (
          <Days key={`days:${deck.id}`} box={{ x: 0, y: top, w: width, h: colH }} deck={deck} plane={null} editor={editor} onTask={onTask} dock={deckOnLeft ? close : <>{closeDays}{close}</>} />
        ) : deck ? (
          <>
            <Board key={deck.id} box={{ x: 0, y: top, w: deckW, h: colH }} deck={deck} editor={editor} onTask={onTask} onCard={onCard} esc={esc} dock={<>{daysToggle}</>} close={close} />
            {twoCols && (
              <>
                <div className={`${pane.divider} ${styles.innerLine}`} style={{ left: deckW, top }} onPointerDown={dragInner} role="separator" aria-orientation="vertical" aria-label="The deck and its days" />
                <Days key={`days:${deck.id}`} box={{ x: deckW, y: top, w: width - deckW, h: colH }} deck={deck} plane={null} editor={editor} onTask={onTask} dock={closeDays} />
              </>
            )}
          </>
        ) : null}
      </aside>
    </>
  )
}

// A press on a line, then the pointer followed until it lets go.
function follow(e: ReactPointerEvent<HTMLDivElement>, to: (x: number) => void) {
  if (e.button !== 0) return
  e.stopPropagation()
  const el = e.currentTarget
  el.setPointerCapture(e.pointerId)
  const move = (ev: PointerEvent) => to(ev.clientX)
  const up = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}

// MINE's `●N`: tasks given to you since you last looked.
function NewMark() {
  const { wid, tasks, pieces } = useWs()
  const { user } = useAuth()
  const me = user?.id ?? null
  const reads = useReads(wid, me)
  if (reads.isLoading) return null
  const n = tasks.filter((t) => me && t.assignee === me && !finished(t, pieces) && (t.givenAt ?? 0) > (reads.data?.tasks ?? 0) && t.givenBy !== me).length
  return n ? <span className={styles.new}> ●{n}</span> : null
}

type PartProps = { box: Bounds; editor: boolean; onTask: (t: Task) => void; dock: ReactNode }

// A deck's board in a view of its own (as beside a plane), its dock with what it does.
function Board({ box, deck, editor, onTask, onCard, esc, dock, close }: PartProps & { deck: WithId<Piece>; onCard: (c: Card) => void; esc: EscNext | null; close: ReactNode }) {
  const { tasks } = useWs()
  const { el, view, pan } = usePaneView(kanbanBounds(deck, tasks), box, true, 0.85)
  const setupOpen = useKanbanUi((s) => s.setup === deck.id)
  return (
    <div ref={el} className={styles.part} style={{ left: box.x, top: box.y, width: box.w, height: box.h }} onPointerDown={pan}>
      <KanbanView piece={deck} view={view} live editor={editor} onTask={onTask} onCard={onCard} />
      {setupOpen && editor && <KanbanSetupPanel piece={deck} />}
      <FocusDock label="Deck" name={<Name deck={deck} />}>
        {dock}
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

// A deck's days: the timeline linked to it, else one of its own here (rows by who). Every deck's (`deck` null): the
// timeline stuck to `plane` when there's one (a plane with no deck, D-300), else one of its own (rows by deck).
function Days({ box, deck, plane, editor, onTask, dock }: PartProps & { deck: WithId<Piece> | null; plane: WithId<Piece> | null }) {
  const { pieces, tasks, cards } = useWs()
  // A deck's timeline, linked to it or through its plane; a plane's, linked to it (a plane with no deck).
  const linked = deck ? timelineOf(deck.id, pieces) : plane ? pieces.find((p) => p.kind === 'timeline' && p.stuckTo === plane.id) : undefined
  // Not stored: a timeline with no piece, its weeks and filter kept under its own key.
  const own = useMemo(
    () => ({ id: deck ? `tasks-side:${deck.id}` : 'tasks-side:all', kind: 'timeline', x: 0, y: 0, w: 0, h: 0, createdAt: 0, updatedAt: 0, ...(deck ? { stuckTo: deck.id, timeline: { rows: 'assignee' } } : {}) }) as WithId<Piece>,
    [deck?.id],
  )
  const piece = linked ?? own
  const pool = useMemo(() => tasks.filter((t) => (deck ? t.pieceId === deck.id : pieces.some((p) => p.id === t.pieceId && p.kind === 'kanban'))), [tasks, pieces, deck])
  const { el, view, pan } = usePaneView(timelineBounds(piece, pieces, tasks, cards, T.besideDays), box, true)
  return (
    <div ref={el} className={styles.part} style={{ left: box.x, top: box.y, width: box.w, height: box.h }} onPointerDown={pan}>
      <TimelineView piece={piece} view={view} live editor={editor} onTask={onTask} span={T.besideDays} />
      <FocusDock label="Days" name={<span className={pane.kind}>{deck ? 'days' : 'all · days'}</span>}>
        {linked ? (
          <TimelineDockTools piece={linked} editor={editor} />
        ) : (
          <>
            <KanbanFilterDock piece={piece} pool={pool} />
            <WeekTools piece={piece} />
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
function Mine({ decks, top, children }: { decks: WithId<Piece>[]; top: number; children: ReactNode }) {
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
  const picked = useKanbanUi((s) => s.selected?.task ?? null)
  const colOf = (d: WithId<Piece>, t: Task) => kanbanOf(d).cols.find((c) => c.id === t.col)?.name
  const groups = decks.map((d) => ({ d, list: mine.filter((t) => t.pieceId === d.id).sort((a, b) => Number(isNew(b)) - Number(isNew(a)) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt - b.createdAt) })).filter((g) => g.list.length)
  return (
    <div className={styles.part} style={{ left: 0, right: 0, top, bottom: 0 }}>
      <div className={styles.mine} data-scrolls>
        {!groups.length && <p className={styles.none}>nothing given to you{decks.length ? '' : ': no deck on this canvas yet, put one on it from its +'}</p>}
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
                <button key={t.id} className={styles.row} aria-pressed={picked === t.id} onClick={() => selectTask(d.id, t.id)}>
                  <span className={isNew(t) ? styles.new : styles.dim}>{isNew(t) ? '●' : '☐'}</span>
                  <span className={styles.title}>{t.title}</span>
                  <span className={late ? styles.late : styles.dim}>{t.due ? `${late ? 'was due ' : ''}${dueText(t.due)}` : '—'}</span>
                  <span className={styles.dim}>{colOf(d, t)}</span>
                </button>
              )
            })}
          </section>
        ))}
        {groups.length > 0 && <p className={styles.foot}>● new since you last looked (the count on the side nav&apos;s icon). A row opens its task here.</p>}
      </div>
      <FocusDock label="Mine" name={<span className={pane.kind}>mine</span>}>
        {children}
      </FocusDock>
    </div>
  )
}
