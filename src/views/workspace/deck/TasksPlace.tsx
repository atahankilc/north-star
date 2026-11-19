// Tasks as a place (D-412, docs/specs/shell.md): the canvas's decks, `mine` and `all · days` as tabs; under them a
// deck's real board (the tasks side view's Board: KanbanView with its dock), the tasks given to you (Mine), or every
// deck's days (Days). Beside the canvas, one at a time; as the page, a deck's board with its days beside it, the line
// between them dragged. A plane's linked deck still opens in the side view (D-300), beside the plane.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { WithId } from '../../../data/hooks'
import type { Piece } from '../../../data/model'
import { piecesOn } from '../../../data/canvases'
import { useWs } from '../canvas/context'
import { useCanvasView } from '../../../state/canvasView'
import { Tabs } from '../../../ui/primitives/Tabs'
import { Num } from '../../../ui/primitives/Rule'
import { Button } from '../../../ui/primitives/Button'
import { Empty } from '../../../ui/primitives/Empty'
import { DragLine } from '../../../ui/primitives/DragLine'
import { learn } from '../../../onboarding/events'
import { kanbanOf } from './Kanban'
import { Board, Days, Mine } from './TasksSide'
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

export function TasksPlace({ page = false, editor }: { page?: boolean; editor: boolean }) {
  const { pieces, canvas, spots } = useWs()
  const decks = useMemo(() => piecesOn(canvas, pieces, spots).filter((p) => p.kind === 'kanban') as WithId<Piece>[], [canvas, pieces, spots])
  const taskDecks = decks.filter((d) => kanbanOf(d).holds !== 'cards')
  const [tab, setTab] = useState<Tab>(() => (page ? (decks[0]?.id ?? 'mine') : 'mine'))
  const [withDays, setWithDays] = useState(page)
  const [inner, setInner] = useState(0.58)
  const box = useBox()
  // Its lesson, as the side view's was (onboarding: `side-view`).
  useEffect(() => learn('side-view'), [])
  const deck = decks.find((d) => d.id === tab)
  const ofCards = !!deck && kanbanOf(deck).holds === 'cards'
  const two = !!deck && !ofCards && withDays && page
  const deckW = two ? Math.round(box.w * inner) : box.w
  const onCard = (c: { id: string }) => useCanvasView.setState({ cardSelected: c.id, labelSelected: null })
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
      <div className={styles.tabs}>
        {decks.length > 0 && (
          <Tabs
            label="Decks"
            value={deck ? tab : ''}
            onChange={setTab}
            options={decks.map((d, i) => ({
              value: d.id,
              title: d.name || 'deck',
              label: (
                <>
                  <Num n={i + 1} /> {d.name || 'deck'}
                </>
              ),
            }))}
          />
        )}
        <Tabs label="Across decks" value={deck ? '' : tab} onChange={setTab} options={[{ value: 'mine', label: 'mine' }, { value: 'all', label: 'all · days' }]} />
      </div>
      <div ref={box.ref} className={styles.area}>
        {box.w > 0 &&
          (tab === 'mine' ? (
            <Mine decks={taskDecks} top={0}>
              {null}
            </Mine>
          ) : tab === 'all' ? (
            <Days key="all" box={{ x: 0, y: 0, w: box.w, h: box.h }} deck={null} plane={null} editor={editor} onTask={() => {}} dock={null} />
          ) : deck ? (
            <>
              <Board key={deck.id} box={{ x: 0, y: 0, w: deckW, h: box.h }} deck={deck} editor={editor} onTask={() => {}} onCard={onCard} dock={daysToggle} close={null} />
              {two && (
                <>
                  <DragLine at="x" style={{ left: deckW, top: 0 }} onDrag={drag} label="The deck and its days" />
                  <Days key={`days:${deck.id}`} box={{ x: deckW, y: 0, w: box.w - deckW, h: box.h }} deck={deck} plane={null} editor={editor} onTask={() => {}} dock={null} />
                </>
              )}
            </>
          ) : (
            <Empty className={styles.none}>no deck on this canvas yet</Empty>
          ))}
      </div>
    </>
  )
}
