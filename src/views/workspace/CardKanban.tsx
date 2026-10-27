// A kanban holding cards (D-268, docs/specs/priorities.md P1): the ledger's look (D-252), its columns a field's values
// (kanbanCards.ts), `no value` first. A card is a sheet edged in its type's colour: its type and priority on top, its
// title, then how sure we are of it and its other values. Live (in focus, beside a plane, unframed), a card dragged to
// another column (after 5 px; a click still picks it) takes that column's value, one undo step; columns that don't take
// it (a status of another type's) go faint while it's held. A click selects it and opens its panel (D-221) as a matrix's
// head does (D-247, LensCardPanel); beside a plane, the plane glides to it (`onCard`). No hand order: sorted.
//
// Rows (D-269): with a row field, a row of boxes per value under a lane head (the tasks' lanes, D-258: `▾`, its name, a
// rule, its count; folds, yours), `no value` on top. Dropping in a box sets both fields, one undo step. A box may carry a
// name (the setup's `boxes`), small in its top-left corner; `good` washes the box green, `bad` sets the name magenta.
//
// Priorities (D-271): set up as effort × impact, the suggested order (D-138) stands beside the grid, switched from its
// dock (`[order]`, yours, per kanban per browser; on to start): rated cards best first, their score, `!` when they rest
// on something invalidated, the suggested P1–P3, `P2 → P1` in yellow where the card's own priority differs; a row picks
// the card (its panel). Boxes sort by score too.
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { updateCards, type Card } from '../../data/cards'
import { useCanvasView, type PlaneCam } from '../../state/canvasView'
import { useWs } from './context'
import { TYPE_ACCENT } from './PlaneCards'
import { boxKey, boxPatch, byBox, byColumn, columnsOf, FIELD_NAME, heldCards, isPriorities, NO_VALUE, placeOf, rowFieldOf, rowsOfField, scorer, sureOf, takes, type CardCol } from './kanbanCards'
import { suggestedOrder, type Ranked } from './cardFacts'
import { create } from 'zustand'
import { kanbanOf, K, LaneHead, useKanbanSizes } from './Kanban'
import { loadFolds, saveFolds } from './rows'
import styles from './Kanban.module.css'

type Over = { col: string; row: string }
type Drag = { id: string; from: [number, number]; grab: [number, number]; size: [number, number]; at: [number, number]; moving: boolean; over: Over | null }
type Props = { piece: WithId<Piece>; view: PlaneCam; live: boolean; editor: boolean; onCanvas?: boolean; onCard?: (c: Card) => void }

// Without rows: one row with no head.
const ONE_ROW: CardCol[] = [{ id: '', name: '', types: [] }]

export function CardKanbanView({ piece, view, live, editor, onCanvas = false, onCard }: Props) {
  const { wid, cards, edges } = useWs()
  const setup = kanbanOf(piece)
  const field = setup.colField ?? 'status'
  const rowField = rowFieldOf(setup)
  const held = useMemo(() => heldCards(piece, cards), [piece, cards])
  const cols = useMemo(() => columnsOf(field, held), [field, held])
  const rows = useMemo(() => (rowField ? rowsOfField(rowField, held) : ONE_ROW), [rowField, held])
  const byCol = useMemo(() => byColumn(field, cols, held), [field, cols, held])
  const boxes = useMemo(() => byBox(field, cols, rowField, rows, held, scorer(cards, edges)), [field, cols, rowField, rows, held, cards, edges])
  // The suggested order beside it (D-271).
  const orderOn = useOrderShown((s) => s[piece.id] ?? orderSaved(piece.id)) && isPriorities(setup)
  const order = useMemo(() => (orderOn ? suggestedOrder(held, cards, edges) : []), [orderOn, held, cards, edges])
  const names = useMemo(() => new Map((setup.names ?? []).map((n) => [boxKey(n.col, n.row), n])), [setup.names])
  const selected = useCanvasView((s) => (live ? s.cardSelected : null))
  const board = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag
  const [folds, setFolds] = useState(() => loadFolds(piece.id))
  const fold = (row: string) => {
    const next = folds.includes(row) ? folds.filter((x) => x !== row) : [...folds, row]
    setFolds(next)
    saveFolds(piece.id, next)
  }
  // Whether a box takes the held card: its column and its row both.
  const boxTakes = (col: CardCol, row: CardCol, card: Card) => takes(col, card) && (!rowField || takes(row, card))

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
  // The box under the pointer, or the nearest, of those that take the held card (folded rows have none drawn).
  const landing = (x: number, y: number, card: Card): Over | null => {
    const at = [...(board.current?.querySelectorAll<HTMLElement>('[data-ccol]') ?? [])].filter((c) => {
      const col = cols.find((k) => k.id === c.dataset.ccol)
      const row = rows.find((k) => k.id === (c.dataset.crow ?? ''))
      return !!col && !!row && boxTakes(col, row, card)
    })
    if (!at.length) return null
    const dist = (c: HTMLElement) => {
      const r = c.getBoundingClientRect()
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0
      return Math.hypot(dx, dy)
    }
    const best = at.reduce((a, b) => (dist(b) < dist(a) ? b : a))
    return { col: best.dataset.ccol!, row: best.dataset.crow ?? '' }
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
    const patch = boxPatch(card, field, d.over.col, rowField, d.over.row)
    if (!patch) return
    // Says what changed: one field, or both.
    const said = (f: string, v: string) => (v === NO_VALUE ? `no ${f}` : `${f} ${v}`)
    const parts = [placeOf(card, field, cols) !== d.over.col && said(FIELD_NAME[field], d.over.col), rowField && placeOf(card, rowField, rows) !== d.over.row && said(FIELD_NAME[rowField], d.over.row)].filter(Boolean)
    void updateCards(wid, [{ card, fields: patch }], `set a card to ${parts.join(', ')}`)
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
    <CardSheet card={c} field={field} rowField={rowField} sure={sureOf(c, cards, edges)} finished={!!col?.done} selected={!extra.lifted && selected === c.id} live={live} lifted={extra.lifted} onPointerDown={extra.lifted ? undefined : press(c)} onClick={live && !editor ? () => pick(c) : undefined} />
  )

  return (
    <div className={styles.layer} data-live={live || undefined} data-on-canvas={onCanvas || undefined}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }}>
        <div ref={board} className={styles.board} style={vars} role="list" aria-label={piece.name || `cards by ${FIELD_NAME[field]}`} data-dragging={lifted ? true : undefined} data-order={orderOn || undefined}>
          <div className={styles.grid}>
          <div className={styles.row}>
            {cols.map((c, i) => {
              const off = !!lifted && !takes(c, lifted)
              return (
                <div key={c.id} className={styles.colHead} data-done={c.done || undefined} data-out={c.out || undefined} data-none={c.id === NO_VALUE || undefined} data-over={(lifted && drag?.over?.col === c.id) || undefined} data-off={off || undefined}>
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
          {rows.map((r) => {
            const folded = !!rowField && folds.includes(r.id)
            const count = cols.reduce((n, c) => n + (boxes.get(boxKey(c.id, r.id))?.length ?? 0), 0)
            return (
              <div key={r.id || 'all'} className={styles.lane} data-folded={folded || undefined} data-off={(!!lifted && !!rowField && !takes(r, lifted)) || undefined}>
                {rowField && (
                  <LaneHead
                    lane={{ key: r.id, label: r.id === NO_VALUE ? `no ${FIELD_NAME[rowField]}` : `${FIELD_NAME[rowField]} ${r.name}`, drop: true }}
                    count={count}
                    folded={folded}
                    onFold={() => fold(r.id)}
                    onPress={own}
                  />
                )}
                {!folded && (
                  <div className={styles.row}>
                    {cols.map((c) => {
                      // The held card keeps its room (hidden), so nothing under the pointer moves while it's dragged.
                      const list = boxes.get(boxKey(c.id, r.id)) ?? []
                      const over = !!lifted && drag?.over?.col === c.id && drag.over.row === r.id
                      const here = !!lifted && placeOf(lifted, field, cols) === c.id && (!rowField || placeOf(lifted, rowField, rows) === r.id)
                      const name = rowField ? names.get(boxKey(c.id, r.id)) : undefined
                      return (
                        <div
                          key={c.id}
                          className={styles.column}
                          data-ccol={c.id}
                          data-crow={r.id}
                          data-box={rowField ? true : undefined}
                          data-tone={name?.tone}
                          data-done={c.done || undefined}
                          data-over={over || undefined}
                          data-off={(!!lifted && !boxTakes(c, r, lifted)) || undefined}
                          role="listitem"
                          aria-label={`${c.name}${rowField ? `, ${r.name}` : ''}${name ? ` (${name.name})` : ''}, ${list.length} cards`}
                          onPointerDown={own}
                        >
                          {name && <span className={styles.boxName}>{name.name}</span>}
                          <div className={styles.list}>
                            {list.map((x) => (
                              <div key={x.id} style={x.id === lifted?.id ? { visibility: 'hidden' } : undefined}>
                                {sheet(x, c)}
                              </div>
                            ))}
                            {over && !here && <span className={styles.slot} aria-hidden />}
                            {!list.length && !over && !rowField && <span className={styles.empty}>· none</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          {!held.length && (
            <p className={styles.empty} data-wide>
              no cards here yet: its setup picks which ({FIELD_NAME[field]} applies to {field === 'status' ? 'customers, problems, ideas and features' : field === 'priority' ? 'features' : 'features and packages'})
            </p>
          )}
          </div>
          {orderOn && <OrderList order={order} unrated={held.length - order.length} live={live} selected={selected} onPick={(c) => live && pick(c)} onPress={own} />}
          {lifted && drag && (
            <div className={styles.ghost} style={{ left: drag.at[0] - drag.grab[0], top: drag.at[1] - drag.grab[1], width: drag.size[0] }} aria-hidden>
              {sheet(lifted, cols.find((c) => c.id === drag.over?.col), { lifted: true })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type SheetProps = {
  card: Card
  field: string
  // Its row's field (D-269): left off the sheet too, as the column's.
  rowField?: string
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
function CardSheet({ card, field, rowField, sure, finished, selected, live, lifted, onPointerDown, onClick }: SheetProps) {
  const shown = (f: string) => f !== field && f !== rowField
  const rest = [
    shown('status') && card.type === 'feature' ? card.status : undefined,
    shown('status') && card.type !== 'feature' ? card.validation : undefined,
    shown('impact') && card.impact ? `impact ${card.impact}` : undefined,
    shown('effort') && card.effort ? `effort ${card.effort}` : undefined,
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
        {shown('priority') && card.priority && (
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

// Whether the suggested order shows beside a priorities kanban (D-271): yours, per kanban, in this browser; on to start.
const ORDER_KEY = (id: string) => `north-star:kanban-order:${id}`
function orderSaved(id: string) {
  try {
    return localStorage.getItem(ORDER_KEY(id)) !== 'off'
  } catch {
    return true
  }
}
const useOrderShown = create<Record<string, boolean>>(() => ({}))
export const orderShown = (id: string) => useOrderShown.getState()[id] ?? orderSaved(id)
export function useOrderOn(id: string) {
  return useOrderShown((s) => s[id] ?? orderSaved(id))
}
export function toggleOrder(id: string) {
  const on = !orderShown(id)
  useOrderShown.setState({ [id]: on })
  try {
    if (on) localStorage.removeItem(ORDER_KEY(id))
    else localStorage.setItem(ORDER_KEY(id), 'off')
  } catch {
    // This tab only.
  }
}

type OrderProps = { order: Ranked[]; unrated: number; live: boolean; selected: string | null; onPick: (c: Card) => void; onPress?: (e: ReactPointerEvent) => void }

// The suggested order (D-138, D-271), a column beside the grid in the ledger's look: `SUGGESTED ORDER ──── 6`, then a row
// a card: its place, its type's bar, its title, its score (`!` magenta and 0.0 when it rests on something invalidated),
// the suggested priority, and `P2 → P1` in yellow where its own differs. A suggestion only: nothing is ever written.
function OrderList({ order, unrated, live, selected, onPick, onPress }: OrderProps) {
  return (
    <aside className={styles.order} aria-label="Suggested order" onPointerDown={live ? onPress : undefined}>
      <div className={styles.head}>
        <span className={styles.name}>suggested order</span>
        <span className={styles.rule} aria-hidden />
        <span className={styles.count}>{order.length}</span>
      </div>
      <p className={styles.orderHow}>impact × confidence ÷ effort</p>
      {order.map((r, i) => {
        const own = r.card.priority
        const differs = !!own && own !== r.suggested
        return (
          <button
            key={r.card.id}
            className={styles.orderRow}
            data-selected={selected === r.card.id || undefined}
            style={{ ['--tone' as string]: TYPE_ACCENT[r.card.type] } as CSSProperties}
            tabIndex={live ? 0 : -1}
            title={`confidence ${r.sure.level}: ${r.sure.why}`}
            onClick={() => onPick(r.card)}
          >
            <span className={styles.n}>{String(i + 1).padStart(2, '0')}</span>
            <span className={styles.orderTitle}>{r.card.title || `untitled ${r.card.type}`}</span>
            <span className={styles.orderScore} data-broken={r.sure.level === 'broken' || undefined}>
              {r.sure.level === 'broken' ? '! ' : ''}
              {r.score.toFixed(1)}
            </span>
            <span className={styles.priority} data-p={r.suggested} data-differs={differs || undefined}>
              {differs ? `${own} → ${r.suggested}` : r.suggested}
            </span>
          </button>
        )
      })}
      {!order.length && <p className={styles.empty}>· nothing rated yet</p>}
      {unrated > 0 && <p className={styles.orderHow}>{unrated} not rated yet: give them an impact and an effort</p>}
    </aside>
  )
}
