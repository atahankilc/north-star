// A kanban holding cards (D-268, docs/specs/priorities.md P1): the ledger's look (D-252), its columns a field's values
// (kanbanCards.ts), `no value` first. A card is a sheet edged in its type's colour: its type and priority on top, its
// title, then how sure we are of it and its other values. Live (in focus, beside a plane, unframed), a card dragged to
// another column (after 5 px; a click still picks it) takes that column's value, one undo step; columns that don't take
// it (a status of another type's) go faint while it's held. A click selects it and opens its panel (D-221) as a matrix's
// head does (D-247, LensCardPanel); beside a plane, the plane glides to it (`onCard`). No hand order: sorted.
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { updateCards, type Card } from '../../data/cards'
import { useCanvasView, type PlaneCam } from '../../state/canvasView'
import { useWs } from './context'
import { TYPE_ACCENT } from './PlaneCards'
import { byColumn, columnsOf, FIELD_NAME, heldCards, NO_VALUE, patchFor, sureOf, valueOf, type CardCol } from './kanbanCards'
import { kanbanOf, K, useKanbanSizes } from './Kanban'
import styles from './Kanban.module.css'

type Drag = { id: string; from: [number, number]; grab: [number, number]; size: [number, number]; at: [number, number]; moving: boolean; over: string | null }
type Props = { piece: WithId<Piece>; view: PlaneCam; live: boolean; editor: boolean; onCanvas?: boolean; onCard?: (c: Card) => void }

export function CardKanbanView({ piece, view, live, editor, onCanvas = false, onCard }: Props) {
  const { wid, cards, edges } = useWs()
  const setup = kanbanOf(piece)
  const field = setup.colField ?? 'status'
  const held = useMemo(() => heldCards(piece, cards), [piece, cards])
  const cols = useMemo(() => columnsOf(field, held), [field, held])
  const byCol = useMemo(() => byColumn(field, cols, held), [field, cols, held])
  const selected = useCanvasView((s) => (live ? s.cardSelected : null))
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
      const was = useKanbanSizes.getState()[piece.id]
      if (!was || was.w !== size.w || was.h !== size.h) useKanbanSizes.setState({ [piece.id]: size })
    }
    note()
    const ro = new ResizeObserver(note)
    ro.observe(el)
    return () => ro.disconnect()
  }, [piece.id])

  const scale = () => {
    const el = board.current
    return el ? el.getBoundingClientRect().width / (el.offsetWidth || 1) : 1
  }
  const local = (x: number, y: number): [number, number] => {
    const r = board.current?.getBoundingClientRect()
    const s = scale()
    return r ? [(x - r.left) / s, (y - r.top) / s] : [0, 0]
  }
  // The column under the pointer, or the nearest, of those that take the held card.
  const landing = (x: number, y: number, card: Card): string | null => {
    const at = [...(board.current?.querySelectorAll<HTMLElement>('[data-ccol]') ?? [])].filter((c) => takes(cols.find((k) => k.id === c.dataset.ccol), card))
    if (!at.length) return null
    const dist = (c: HTMLElement) => {
      const r = c.getBoundingClientRect()
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0
      return Math.hypot(dx, dy)
    }
    return at.reduce((a, b) => (dist(b) < dist(a) ? b : a)).dataset.ccol!
  }

  const pick = (card: Card) => {
    const again = useCanvasView.getState().cardSelected === card.id
    useCanvasView.setState({ cardSelected: again ? null : card.id, labelSelected: null })
    if (!again) onCard?.(card)
  }
  const drop = (card: Card) => {
    const d = dragRef.current
    setDrag(null)
    if (!d) return
    if (!d.moving) return pick(card)
    if (!d.over) return
    const patch = patchFor(card, field, d.over)
    if (patch) void updateCards(wid, [{ card, fields: patch }], d.over === NO_VALUE ? `take away the ${FIELD_NAME[field]} of a card` : `set a card’s ${FIELD_NAME[field]} to ${d.over}`)
  }
  const press = (card: Card) => (e: ReactPointerEvent<HTMLElement>) => {
    if (!live || e.button !== 0) return
    e.stopPropagation()
    if (!editor) return
    const r = e.currentTarget.getBoundingClientRect()
    const s = scale()
    setDrag({ id: card.id, from: [e.clientX, e.clientY], grab: [(e.clientX - r.left) / s, (e.clientY - r.top) / s], size: [r.width / s, r.height / s], at: local(e.clientX, e.clientY), moving: false, over: null })
    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const moving = d.moving || Math.hypot(ev.clientX - d.from[0], ev.clientY - d.from[1]) > 5
      if (moving) setDrag({ ...d, at: local(ev.clientX, ev.clientY), moving, over: landing(ev.clientX, ev.clientY, card) ?? d.over })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      drop(card)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const lifted = drag?.moving ? held.find((c) => c.id === drag.id) : undefined
  const own = live ? (e: ReactPointerEvent) => e.stopPropagation() : undefined
  const vars = { ['--col' as string]: `${K.col}px`, ['--gap' as string]: `${K.gap}px`, ['--head' as string]: `${K.head}px`, ['--card-gap' as string]: `${K.cardGap}px` } as CSSProperties
  const sheet = (c: Card, col: CardCol | undefined, extra: { lifted?: boolean } = {}) => (
    <CardSheet card={c} field={field} sure={sureOf(c, cards, edges)} finished={!!col?.done} selected={!extra.lifted && selected === c.id} live={live} lifted={extra.lifted} onPointerDown={extra.lifted ? undefined : press(c)} onClick={live && !editor ? () => pick(c) : undefined} />
  )

  return (
    <div className={styles.layer} data-live={live || undefined} data-on-canvas={onCanvas || undefined}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }}>
        <div ref={board} className={styles.board} style={vars} role="list" aria-label={piece.name || `cards by ${FIELD_NAME[field]}`} data-dragging={lifted ? true : undefined}>
          <div className={styles.row}>
            {cols.map((c, i) => {
              const off = !!lifted && !takes(c, lifted)
              return (
                <div key={c.id} className={styles.colHead} data-done={c.done || undefined} data-out={c.out || undefined} data-none={c.id === NO_VALUE || undefined} data-over={(lifted && drag?.over === c.id) || undefined} data-off={off || undefined}>
                  <div className={styles.head}>
                    <span className={styles.n}>{String(i).padStart(2, '0')}</span>
                    <span className={styles.name}>{c.name}</span>
                    <span className={styles.rule} aria-hidden />
                    <span className={styles.count}>{byCol.get(c.id)?.length ?? 0}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className={styles.row}>
            {cols.map((c) => {
              const list = (byCol.get(c.id) ?? []).filter((x) => x.id !== lifted?.id)
              const over = !!lifted && drag?.over === c.id
              return (
                <div key={c.id} className={styles.column} data-ccol={c.id} data-done={c.done || undefined} data-over={over || undefined} data-off={(!!lifted && !takes(c, lifted)) || undefined} role="listitem" aria-label={`${c.name}, ${list.length} cards`} onPointerDown={own}>
                  <div className={styles.list}>
                    {list.map((x) => (
                      <div key={x.id}>{sheet(x, c)}</div>
                    ))}
                    {over && valueOf(lifted, field) !== (c.id === NO_VALUE ? undefined : c.id) && <span className={styles.slot} aria-hidden />}
                    {!list.length && !over && <span className={styles.empty}>· none</span>}
                  </div>
                </div>
              )
            })}
          </div>
          {!held.length && (
            <p className={styles.empty} data-wide>
              no cards here yet: its setup picks which ({FIELD_NAME[field]} applies to {field === 'status' ? 'customers, problems, ideas and features' : field === 'priority' ? 'features' : 'features and packages'})
            </p>
          )}
          {lifted && drag && (
            <div className={styles.ghost} style={{ left: drag.at[0] - drag.grab[0], top: drag.at[1] - drag.grab[1], width: drag.size[0] }} aria-hidden>
              {sheet(lifted, cols.find((c) => c.id === drag.over), { lifted: true })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Whether a column takes a card: `no value` any; a value only its own types'.
const takes = (col: CardCol | undefined, card: Card) => !!col && col.types.includes(card.type)

type SheetProps = {
  card: Card
  field: string
  sure?: 'high' | 'medium' | 'low' | 'broken'
  finished: boolean
  selected: boolean
  live: boolean
  lifted?: boolean
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void
  onClick?: () => void
}

// A card on a kanban: a sheet as a task's (D-252), edged in its type's colour. Its type in that colour and its priority
// (P1 magenta) on top, its title (Geist, up to three lines), then how sure we are (`◆ high`, `! broken` magenta) and the
// values it has other than the columns' own.
function CardSheet({ card, field, sure, finished, selected, live, lifted, onPointerDown, onClick }: SheetProps) {
  const rest = [
    field !== 'status' && card.type === 'feature' ? card.status : undefined,
    field !== 'status' && card.type !== 'feature' ? card.validation : undefined,
    field !== 'impact' && card.impact ? `impact ${card.impact}` : undefined,
    field !== 'effort' && card.effort ? `effort ${card.effort}` : undefined,
  ].filter(Boolean)
  return (
    <div
      className={styles.task}
      data-sheet
      data-card
      data-ccard={card.id}
      data-selected={selected || undefined}
      data-finished={finished || undefined}
      data-lifted={lifted || undefined}
      style={{ ['--tone' as string]: TYPE_ACCENT[card.type] } as CSSProperties}
      role={live && !lifted ? 'button' : undefined}
      tabIndex={live && !lifted ? 0 : -1}
      aria-label={`${card.type}: ${card.title || 'untitled'}`}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={live && onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <span className={styles.sheetHead}>
        <span className={styles.sheetType}>{card.type}</span>
        <span className={styles.push} />
        {field !== 'priority' && card.priority && (
          <span className={styles.priority} data-p={card.priority}>
            {card.priority}
          </span>
        )}
      </span>
      <span className={styles.title}>{card.title || `untitled ${card.type}`}</span>
      {(sure || rest.length > 0) && (
        <span className={styles.meta}>
          {sure && (
            <span className={styles.sure} data-level={sure} title={sure === 'broken' ? 'something it rests on is invalidated' : `confidence ${sure}, from the status of what it rests on`}>
              {sure === 'broken' ? '! broken' : `◆ ${sure}`}
            </span>
          )}
          <span className={styles.push} />
          {rest.join(' · ')}
        </span>
      )}
      {(['nw', 'ne', 'se', 'sw'] as const).map((c) => (
        <span key={c} className={styles.mark} data-corner={c} aria-hidden />
      ))}
    </div>
  )
}
