// Tasks as a place (D-412, docs/specs/shell.md): the canvas's decks, `mine` and `all · days` as tabs; under them a
// deck's real board (the tasks side view's Board: KanbanView with its dock), the tasks given to you (Mine), or every
// deck's days (Days). Beside the canvas, one at a time; as the page, a deck's board with its days beside it, the line
// between them dragged. A plane's linked deck still opens in the side view (D-300), beside the plane.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { WithId } from '../../../data/hooks'
import type { Piece } from '../../../data/model'
import { MAIN, piecesOn } from '../../../data/canvases'
import { useWs, useWsNow } from '../canvas/context'
import { glidePlaneTo } from '../canvas/Beside'
import type { Card } from '../../../data/cards'
import { Label } from '../../../ui/primitives/Label'
import type { Task } from '../../../data/tasks'
import { useCanvasView } from '../../../state/canvasView'
import { Tabs } from '../../../ui/primitives/Tabs'
import { Button } from '../../../ui/primitives/Button'
import { Empty } from '../../../ui/primitives/Empty'
import { learn } from '../../../onboarding/events'
import { kanbanOf } from './Kanban'
import { setKanbanFilter, useKanbanFilter } from './kanbanFilter'
import { PlaceFind } from '../places/Places'
import { usePlace } from '../places/placeStore'
import { BoardAndDays, Days, deckTab, Mine } from './TasksSide'
import styles from './TasksPlace.module.css'

type Tab = 'mine' | 'all' | string

// The box the parts are drawn in, measured.
function useBox() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(read)
    ro.observe(el)
    read()
    return () => ro.disconnect()
  }, [])
  return { ref, ...size }
}

// `head`: the place's head, given what goes in it (the tabs: one row, D-419).
export function TasksPlace({ page = false, editor, head }: { page?: boolean; editor: boolean; head: (tabs: ReactNode) => ReactNode }) {
  const { pieces, canvas, spots, canvases } = useWs()
  const now = useWsNow()
  // Every deck in the workspace (D-419: Tasks is the workspace's, as Talk and Docs are): this canvas's first, then the
  // others' by their canvas's order.
  const decks = useMemo(() => {
    const here = new Set(piecesOn(canvas, pieces, spots).map((p) => p.id))
    const order = (p: WithId<Piece>) => (here.has(p.id) ? -1 : (canvases.find((c) => c.id === (p.canvasId ?? MAIN))?.order ?? 0))
    return (pieces.filter((p) => p.kind === 'kanban') as WithId<Piece>[]).sort((a, b) => order(a) - order(b))
  }, [canvas, pieces, spots, canvases])
  // What a deck's tab says it's on: the plane it's linked to; another canvas's name.
  const onOf = (d: WithId<Piece>) => {
    if (d.stuckTo) return pieces.find((p) => p.id === d.stuckTo)?.name || 'a plane'
    const c = d.canvasId ?? MAIN
    return canvases.length > 1 && !piecesOn(canvas, pieces, spots).some((p) => p.id === d.id) ? canvases.find((x) => x.id === c)?.name : undefined
  }
  const taskDecks = decks.filter((d) => kanbanOf(d).holds !== 'cards')
  // The tab: asked for (a task's `show on…`, openTasks), else the first deck as the page and `mine` beside the canvas.
  const asked = usePlace((s) => s.tasks)
  const tab: Tab = asked?.tab ?? (page ? (decks[0]?.id ?? 'mine') : 'mine')
  // Opened from a plane (D-419, the old side view's `linked`): its deck, or every deck's days for its cards.
  const linked = asked?.linked ? pieces.find((p) => p.id === asked.linked) : undefined
  const setTab = (t: Tab) => usePlace.setState({ tasks: { tab: t, days: false, linked: linked && (t === 'all' || decks.find((d) => d.id === t)?.stuckTo === linked.id) ? linked.id : null } })
  const [withDays, setWithDays] = useState(page)
  // The board's share of the page: room for its columns, its days beside them.
  const [inner, setInner] = useState(0.68)
  const box = useBox()
  // Tasks' find (D-419): a deck's tasks through its filter's `text` (as its filter dock narrows it); mine's rows.
  const [find, setFind] = useState('')
  // Its lesson, as the side view's was (onboarding: `side-view`).
  useEffect(() => learn('side-view'), [])
  const deck = decks.find((d) => d.id === tab)
  const filter = useKanbanFilter(deck?.id ?? '')
  useEffect(() => {
    if (!deck) return
    if ((filter.text ?? '') !== find) setKanbanFilter(deck.id, { ...filter, text: find || undefined })
    // Only when what's typed or the deck changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find, deck?.id])
  const ofCards = !!deck && kanbanOf(deck).holds === 'cards'
  const two = !!deck && !ofCards && withDays && page
  const deckW = two ? Math.round(box.w * inner) : box.w
  // A task or a card picked while its plane is in focus glides the plane to the card (as the side view did, D-300).
  const inFocus = () => !!linked && linked.kind === 'plane' && new URLSearchParams(window.location.search).get('focus') === linked.id
  const onTask = (t: Task) => {
    const card = t.cardId ? now().cards.find((c) => c.id === t.cardId) : undefined
    if (card && linked && inFocus()) glidePlaneTo(card, linked.id, now().cards, now().places)
  }
  const onCard = (c: Card) => {
    useCanvasView.setState({ cardSelected: c.id, labelSelected: null })
    if (linked && inFocus()) glidePlaneTo(c, linked.id, now().cards, now().places)
  }
  // Beside the canvas a deck's days (from a plane's timeline, or its deck's `⇆ days`) take the column.
  const daysAlone = !page && !!deck && !ofCards && !!asked?.days
  const drag = (e: PointerEvent) => {
    const r = box.ref.current?.getBoundingClientRect()
    if (r) setInner(Math.min(0.75, Math.max(0.3, (e.clientX - r.left) / r.width)))
  }
  const daysToggle = page && deck && !ofCards && (
    <Button aria-pressed={withDays} title={withDays ? 'close its days' : 'its days beside it'} onClick={() => setWithDays(!withDays)}>
      {withDays ? 'days ‹' : 'days ›'}
    </Button>
  )
  return (
    <>
      {head(
      <div className={styles.tabs}>
        {decks.length > 0 && (
          <Tabs
            label="Decks"
            value={deck ? tab : ''}
            onChange={setTab}
            options={decks.map((d, i) => deckTab(d, i, undefined, onOf(d)))}
          />
        )}
        <Tabs label="Across decks" value={deck ? '' : tab} onChange={setTab} options={[{ value: 'mine', label: 'mine' }, { value: 'all', label: 'all · days' }]} />
      </div>,
      )}
      {linked && (tab === 'all' || deck?.stuckTo === linked.id) && (
        <div className={styles.linked}>
          <span>
            <Label className={styles.linkedWord}>⇆ linked to</Label> <b>{linked.name || 'a plane'}</b> <span className={styles.dim}>· its cards only</span>
          </span>
          <Button onClick={() => usePlace.setState({ tasks: { tab, days: false, linked: null } })} title="every deck, as from the HUD">
            all decks
          </Button>
        </div>
      )}
      {tab !== 'all' && !daysAlone && <PlaceFind value={find} onChange={setFind} label="Find in Tasks" />}
      <div ref={box.ref} className={styles.area}>
        {box.w > 0 &&
          (tab === 'mine' ? (
            <Mine decks={taskDecks} top={0} find={find}>
              {null}
            </Mine>
          ) : tab === 'all' ? (
            <Days key={`all:${linked?.id ?? ''}`} box={{ x: 0, y: 0, w: box.w, h: box.h }} deck={null} plane={linked ?? null} editor={editor} onTask={onTask} dock={null} />
          ) : deck && daysAlone ? (
            <Days key={`days:${deck.id}`} box={{ x: 0, y: 0, w: box.w, h: box.h }} deck={deck} plane={null} editor={editor} onTask={onTask} dock={null} />
          ) : deck ? (
            <BoardAndDays deck={deck} top={0} width={box.w} height={box.h} deckW={deckW} days={two} editor={editor} onTask={onTask} onCard={onCard} boardDock={daysToggle} close={null} daysDock={null} onDrag={drag} />
          ) : (
            <Empty className={styles.none}>No deck yet: the canvas’s + makes one (deck…).</Empty>
          ))}
      </div>
    </>
  )
}
