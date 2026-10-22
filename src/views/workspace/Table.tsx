// A table on the canvas (D-209), the first lens: rows from rules (source.ts) and added by hand, columns of the cards'
// own fields and of its own. Drawn in its own px through a view, like a matrix (D-204, D-206): on the canvas a picture
// (the pointer goes through to the canvas, D-186); in focus live. There a click selects a cell (again: a scale steps
// on, a check flips), arrows move, 1–9 set a step, Backspace clears, Enter or a double-click types a number or a text;
// a column's head sorts it (up, down, off); a row's name is a card's title or a typed name (double-click to change),
// `×` takes the row out. The rules and columns are set up from the focus dock's `[setup]` (TableSetupPanel).
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { create } from 'zustand'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { retitleCard, TITLE_MAX, type Card } from '../../data/cards'
import { setCell, TEXT_MAX, TONE_VAR, type Cell } from '../../data/matrix'
import { rowsOf, statusOf, type Row } from '../../data/source'
import { addNamedRow, CHECKED, colName, DEFAULT_STEPS, emptyTable, NAME_COL, PAGE_SIZES, readOwn, removeRow, renameRow, setTablePart, type Column, type TableSetup } from '../../data/table'
import { kindOfPiece } from '../../data/pieces'
import { useCanvasView, type Bounds, type PlaneCam } from '../../state/canvasView'
import { Select } from '../../ui/Select'
import { useWs } from './context'
import { TYPE_ACCENT } from './PlaneCards'
import styles from './Table.module.css'

// Its parts in its own px: the head, a row, the name column, the `+` column and row.
export const T = { head: 40, row: 32, name: 260, add: 40 }

const FIELD_W: Record<string, number> = { type: 100, plane: 140, status: 120, tags: 180, regions: 160, priority: 90, impact: 90, effort: 90, evidence: 90 }
const OWN_W: Record<string, number> = { scale: 90, number: 110, text: 220, check: 70 }
export const widthOf = (c: Column) => (c.field ? FIELD_W[c.field] : OWN_W[c.kind ?? 'text']) ?? 120

const NO_SETUP = emptyTable()
export const tableOf = (p: Pick<Piece, 'table'>): TableSetup => p.table ?? NO_SETUP

// The box round a table's rows and columns, in its px: what fit frames.
export function tableBounds(piece: Pick<Piece, 'table'>, cards: Card[]): Bounds {
  const setup = tableOf(piece)
  const w = T.name + setup.cols.reduce((s, c) => s + widthOf(c), 0) + T.add
  const n = rowsOf(setup.rows, cards, !setup.manual).length
  // A page's worth when it's paged (D-213): fit frames the page.
  return { x: 0, y: 0, w, h: T.head + Math.max(setup.pageSize ? Math.min(n, setup.pageSize) : n, 1) * T.row + T.add }
}

// The table whose setup is open (from the focus dock's or its pane's `[setup]`, D-211); a typed row being named; the page
// each table is on here (D-213: yours, not shared).
export const useTableUi = create<{ setup: string | null; naming: string | null; pages: Record<string, number> }>(() => ({ setup: null, naming: null, pages: {} }))

// Its pages (D-213): how many, and the one this table is on, kept in range.
export function pagesOf(setup: TableSetup, count: number, page: number | undefined) {
  const size = setup.pageSize
  const pages = size ? Math.max(1, Math.ceil(count / size)) : 1
  const at = Math.min(pages - 1, Math.max(0, page ?? 0))
  return { size, pages, at, from: size ? at * size : 0, to: size ? Math.min(count, (at + 1) * size) : count }
}

// The selected cell rides on the canvas's card selection (D-187), so Escape and leaving focus let go of it as of a card.
const CELL = 'tcell|'
const selKey = (row: string, col: string) => `${CELL}${row}|${col}`
const parseSel = (s: string | null) => (s?.startsWith(CELL) ? (s.slice(CELL.length).split('|') as [string, string]) : null)

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

// What a row reads in a column, as text: for a card's field, and for sorting.
function useFieldText() {
  const { pieces, evidence } = useWs()
  return useMemo(() => {
    const planeName = new Map(pieces.filter((p) => kindOfPiece(p) === 'plane').map((p) => [p.id, p.name || 'unnamed plane']))
    const learned = new Map<string, [number, number]>()
    for (const e of evidence) {
      const t = learned.get(e.nodeId) ?? [0, 0]
      t[e.stance === 'supports' ? 0 : 1]++
      learned.set(e.nodeId, t)
    }
    return (row: Row, field: NonNullable<Column['field']>): string => {
      const c = row.card
      if (!c) return ''
      switch (field) {
        case 'type':
          return c.type
        case 'plane':
          return planeName.get(c.pieceId) ?? ''
        case 'status':
          return statusOf(c) ?? ''
        case 'tags':
          return (c.tags ?? []).map((t) => `#${t}`).join(' ')
        case 'regions':
          return (c.regions ?? []).join(' · ')
        case 'evidence': {
          const t = learned.get(c.id)
          return t ? [t[0] && `+${t[0]}`, t[1] && `−${t[1]}`].filter(Boolean).join(' ') : ''
        }
        default:
          return c[field] ?? ''
      }
    }
  }, [pieces, evidence])
}

// `onCard`: a card's row name clicked, beside its plane (D-211): the plane goes to the card.
type Props = { piece: WithId<Piece>; view: PlaneCam; live: boolean; editor: boolean; onCard?: (card: Card) => void }

export function TableView({ piece, view, live, editor, onCard }: Props) {
  const { wid, cards, cells } = useWs()
  const setup = tableOf(piece)
  const fieldText = useFieldText()
  const mine = useMemo(() => cells.filter((c) => c.matrixId === piece.id), [cells, piece.id])
  const byKey = useMemo(() => new Map(mine.map((c) => [`${c.row}|${c.col}`, c])), [mine])
  const at = (row: string, col: string) => byKey.get(`${row}|${col}`)
  // The rows, in the source's order or sorted by a column.
  const all = useMemo(() => {
    const out = rowsOf(setup.rows, cards, !setup.manual)
    const s = setup.sort
    const col = s && (s.col === NAME_COL ? NAME_COL : setup.cols.find((c) => c.id === s.col))
    if (!s || !col) return out
    const key = (r: Row): string | number => {
      if (col === NAME_COL) return r.name.toLowerCase()
      if (col.field) return fieldText(r, col.field).toLowerCase()
      const v = readOwn(col, byKey.get(`${r.key}|${col.id}`))
      if (v.step) return (col.steps ?? DEFAULT_STEPS).indexOf(v.step)
      if (v.number !== undefined) return v.number
      if (v.checked) return 1
      return v.text?.toLowerCase() ?? ''
    }
    const empty = (k: string | number) => k === ''
    // Empty ones last, whichever way.
    return [...out].sort((a, b) => {
      const [x, y] = [key(a), key(b)]
      if (empty(x) !== empty(y)) return empty(x) ? 1 : -1
      const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return s.desc ? -d : d
    })
  }, [setup, cards, fieldText, byKey])
  // The page shown (D-213); the rest wait on their pages.
  const page = pagesOf(setup, all.length, useTableUi((s) => s.pages[piece.id]))
  const rows = useMemo(() => all.slice(page.from, page.to), [all, page.from, page.to])

  const cols = setup.cols
  const xs = useMemo(() => {
    let x = T.name
    return cols.map((c) => {
      const at = x
      x += widthOf(c)
      return at
    })
  }, [cols])
  const width = T.name + cols.reduce((s, c) => s + widthOf(c), 0)
  const sel = parseSel(useCanvasView((s) => (live ? s.cardSelected : null)))
  // A card selected on the plane beside it (D-211): its row lit.
  const lit = useCanvasView((s) => (live && onCard ? s.cardSelected : null))
  const ri = sel ? rows.findIndex((r) => r.key === sel[0]) : -1
  const ci = sel ? cols.findIndex((c) => c.id === sel[1]) : -1
  const selected = ri >= 0 && ci >= 0 ? { r: ri, c: ci } : null
  const [typing, setTyping] = useState<string | null>(null)
  const naming = useTableUi((s) => s.naming)
  const layer = useRef<HTMLDivElement>(null)

  const write = (row: string, col: string, value: Cell['value']) => void setCell(wid, piece.id, row, col, { value })
  const select = (r: number, c: number) => useCanvasView.setState({ cardSelected: selKey(rows[r].key, cols[c].id), labelSelected: null })
  // A press on a cell: selects it; again, a scale steps on (then nothing) and a check flips.
  const press = (r: number, c: number) => {
    if (selected?.r !== r || selected.c !== c) return select(r, c)
    const col = cols[c]
    if (!editor || col.field) return
    const row = rows[r].key
    const v = readOwn(col, at(row, col.id))
    if (col.kind === 'check') return write(row, col.id, v.checked ? undefined : CHECKED)
    if (col.kind === 'scale') {
      const steps = col.steps ?? DEFAULT_STEPS
      const i = v.step ? steps.indexOf(v.step) + 1 : 0
      write(row, col.id, i < steps.length ? steps[i].id : undefined)
    }
  }

  // A selected cell whose row or column went lets go.
  useEffect(() => {
    if (sel && !selected) useCanvasView.setState({ cardSelected: null })
  }, [sel, selected])
  // Leaving focus closes the setup.
  useEffect(() => {
    if (!live) return
    return () => useTableUi.setState((s) => ({ setup: s.setup === piece.id ? null : s.setup, naming: null }))
  }, [live])

  const keysRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keysRef.current = (e: KeyboardEvent) => {
    if (!selected) return
    const t = e.target as HTMLElement | null
    if (t?.closest('input, textarea, [contenteditable], [role=menu], [role=dialog], [role=listbox]')) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const row = rows[selected.r].key
    const col = cols[selected.c]
    const move = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, number[]>)[e.key]
    if (move) {
      e.preventDefault()
      const r = Math.min(rows.length - 1, Math.max(0, selected.r + move[0]))
      const c = Math.min(cols.length - 1, Math.max(0, selected.c + move[1]))
      select(r, c)
      return layer.current?.querySelector<HTMLElement>(`[data-cell="${selKey(rows[r].key, cols[c].id)}"]`)?.focus()
    }
    if (!editor || col.field) return
    const steps = col.steps ?? DEFAULT_STEPS
    if (col.kind === 'scale' && /^[1-9]$/.test(e.key) && Number(e.key) <= steps.length) return write(row, col.id, steps[Number(e.key) - 1].id)
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      return write(row, col.id, undefined)
    }
    if (e.key === 'Enter' && (col.kind === 'number' || col.kind === 'text' || !col.kind)) {
      e.preventDefault()
      setTyping(selKey(row, col.id))
    }
    if (e.key === ' ' && col.kind === 'check') {
      e.preventDefault()
      write(row, col.id, readOwn(col, at(row, col.id)).checked ? undefined : CHECKED)
    }
  }
  useEffect(() => {
    if (!live) return
    const onKey = (e: KeyboardEvent) => keysRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [live])

  const own = live ? (e: ReactPointerEvent) => e.stopPropagation() : undefined
  const sortBy = (col: string) => {
    if (!live || !editor) return
    const s = setup.sort
    const next = s?.col !== col ? { col } : !s.desc ? { col, desc: true } : undefined
    void setTablePart(wid, piece.id, 'sort', next)
  }
  const box = (x: number, y: number, w: number, h: number): CSSProperties => ({ left: x, top: y, width: w, height: h })
  const arrow = (col: string) => (setup.sort?.col === col ? (setup.sort.desc ? ' ↓' : ' ↑') : '')
  const bottom = T.head + rows.length * T.row

  return (
    <div ref={layer} className={styles.layer} data-live={live || undefined}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }}>
        <div className={styles.table} style={{ width: width + (live && editor ? T.add : 0), height: bottom + T.add }} role="grid" aria-label={piece.name || 'table'}>
          {rows.map((r, i) => (
            <div key={r.key} className={styles.band} data-selected={selected?.r === i || undefined} data-lit={lit === r.key || undefined} style={box(0, T.head + i * T.row, width, T.row)} />
          ))}
          <div className={styles.headRule} style={box(0, T.head - 1, width, 1)} />

          <button className={styles.head} data-name style={box(0, 0, T.name, T.head)} onPointerDown={own} onClick={() => sortBy(NAME_COL)} tabIndex={live ? 0 : -1} title={live && editor ? 'sort by it' : undefined}>
            {setup.manual ? 'name' : 'title'}
            <span className={styles.arrow}>{arrow(NAME_COL)}</span>
          </button>
          {cols.map((c, i) => (
            <button
              key={c.id}
              className={styles.head}
              data-own={c.field ? undefined : true}
              style={box(xs[i], 0, widthOf(c), T.head)}
              onPointerDown={own}
              onClick={() => sortBy(c.id)}
              tabIndex={live ? 0 : -1}
              title={live && editor ? 'sort by it' : undefined}
            >
              <span className={styles.headName}>{colName(c)}</span>
              {c.kind === 'number' && c.unit && <span className={styles.unit}>{c.unit}</span>}
              <span className={styles.arrow}>{arrow(c.id)}</span>
            </button>
          ))}

          {rows.map((r, ri) => (
            <NameCell
              key={r.key}
              row={r}
              style={box(0, T.head + ri * T.row, T.name, T.row)}
              live={live}
              editor={editor}
              naming={naming === r.item?.id}
              onPress={own}
              onRename={(name) => {
                if (r.card) void retitleCard(wid, r.card, name)
                else if (r.item) void renameRow(wid, piece.id, setup, r.item.id, name)
              }}
              onRemove={() => void removeRow(wid, piece.id, setup, r, mine)}
              onPick={onCard && r.card ? () => onCard(r.card!) : undefined}
            />
          ))}

          {rows.map((r, ri) =>
            cols.map((c, ci) => {
              const key = selKey(r.key, c.id)
              const style = box(xs[ci], T.head + ri * T.row, widthOf(c), T.row)
              const isSel = selected?.r === ri && selected.c === ci
              if (c.field) {
                const text = fieldText(r, c.field)
                const tone = c.field === 'type' && r.card ? TYPE_ACCENT[r.card.type] : undefined
                return (
                  <button key={key} className={styles.cell} data-field={c.field} data-cell={key} data-selected={isSel || undefined} style={{ ...style, ...(tone ? { ['--tone' as string]: tone } : {}) }}
                    tabIndex={live ? 0 : -1} onClick={live ? () => press(ri, ci) : undefined} aria-label={`${r.name || 'untitled'}, ${colName(c)}: ${text || 'empty'}`}>
                    {text ? <span className={styles.text}>{text}</span> : <span className={styles.unset}>·</span>}
                  </button>
                )
              }
              return (
                <OwnCell
                  key={key}
                  id={key}
                  col={c}
                  cell={at(r.key, c.id)}
                  style={style}
                  label={`${r.name || 'untitled'}, ${colName(c)}`}
                  selected={isSel}
                  live={live}
                  typing={typing === key}
                  // A cell lets the press through (D-217): its view pans once it moves 5 px, a click still selects.
                  onPress={typing === key ? own : undefined}
                  onClick={() => press(ri, ci)}
                  onType={editor && (c.kind === 'number' || c.kind === 'text') ? () => (select(ri, ci), setTyping(key)) : undefined}
                  onTyped={(value) => {
                    setTyping(null)
                    if (value !== null) write(r.key, c.id, value)
                  }}
                />
              )
            }),
          )}

          {live && editor && (
            <>
              <button className={styles.add} data-col style={box(width, 0, T.add, T.head)} title="add a column" aria-label="Add a column" onPointerDown={own} onClick={() => useTableUi.setState({ setup: piece.id })}>
                +
              </button>
              <button
                className={styles.add}
                style={box(0, bottom, T.name, T.add)}
                title="add a named row"
                aria-label="Add a row"
                onPointerDown={own}
                onClick={() => void addNamedRow(wid, piece.id, setup).then((id) => useTableUi.setState({ naming: id }))}
              >
                + row
              </button>
            </>
          )}
          {!rows.length && (
            <p className={styles.empty} style={box(T.name, T.head, Math.max(width - T.name, 200), T.row)}>
              {setup.manual ? 'No rows yet' : 'No card meets its rules'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

type NameProps = {
  row: Row
  style: CSSProperties
  live: boolean
  editor: boolean
  naming: boolean
  onPress?: (e: ReactPointerEvent) => void
  onRename: (name: string) => void
  onRemove: () => void
  onPick?: () => void
}

// A row's name: a card's live title by its type's colour, or a typed name. A double-click changes it.
function NameCell({ row, style, live, editor, naming, onPress, onRename, onRemove, onPick }: NameProps) {
  const [editing, setEditing] = useState(false)
  const open = (editing || naming) && live && editor
  const tone = row.card ? TYPE_ACCENT[row.card.type] : undefined
  return (
    <div className={styles.name} style={{ ...style, ...(tone ? { ['--type' as string]: tone } : {}) }} data-card={row.card ? true : undefined} title={row.name || undefined} data-pick={onPick ? true : undefined} onPointerDown={onPress} onClick={live && !open ? onPick : undefined} onDoubleClick={live && editor ? () => setEditing(true) : undefined}>
      {open ? (
        <input
          className={styles.nameField}
          autoFocus
          aria-label={row.card ? `${row.card.type} title` : 'Row name'}
          defaultValue={row.name}
          maxLength={row.card ? TITLE_MAX : 200}
          placeholder={row.card ? `untitled ${row.card.type}` : 'name'}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              e.currentTarget.value = row.name
              e.currentTarget.blur()
            }
          }}
          onBlur={(e) => {
            setEditing(false)
            useTableUi.setState({ naming: null })
            if (e.currentTarget.value.trim() !== row.name) onRename(e.currentTarget.value.trim())
          }}
        />
      ) : (
        <span className={styles.nameText} data-unnamed={!row.name || undefined}>
          {row.name || (row.card ? `untitled ${row.card.type}` : 'name')}
        </span>
      )}
      {live && editor && !open && (
        <button className={styles.remove} title={row.auto ? `take it out of the table (it stays a ${row.card!.type})` : 'take it out'} aria-label="Take it out" onClick={onRemove}>
          ×
        </button>
      )}
    </div>
  )
}

type OwnProps = {
  id: string
  col: Column
  cell: Cell | undefined
  style: CSSProperties
  label: string
  selected: boolean
  live: boolean
  typing: boolean
  onPress?: (e: ReactPointerEvent) => void
  onClick: () => void
  onType?: () => void
  onTyped: (value: string | number | undefined | null) => void
}

// One of its own columns' cells: a step's glyph in its colour, a number, a text, a check, or a faint dot.
function OwnCell({ id, col, cell, style, label, selected, live, typing, onPress, onClick, onType, onTyped }: OwnProps) {
  const read = readOwn(col, cell)
  const tone = read.step ? TONE_VAR[read.step.tone] : read.checked ? 'var(--accent-green)' : undefined
  const said = read.step?.label ?? (read.number !== undefined ? fmt(read.number) : read.text) ?? (read.checked ? 'yes' : 'empty')
  if (typing)
    return (
      <div className={styles.cell} style={style} data-selected onPointerDown={onPress}>
        <input
          className={styles.cellField}
          autoFocus
          aria-label={label}
          inputMode={col.kind === 'number' ? 'decimal' : undefined}
          defaultValue={read.number !== undefined ? String(read.number) : (read.text ?? '')}
          maxLength={TEXT_MAX}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              e.currentTarget.dataset.cancel = 'true'
              e.currentTarget.blur()
            }
          }}
          onBlur={(e) => {
            if (e.currentTarget.dataset.cancel) return onTyped(null)
            const raw = e.currentTarget.value.trim()
            if (col.kind !== 'number') return onTyped(raw || undefined)
            const n = Number(raw.replace(',', '.'))
            onTyped(raw === '' ? undefined : Number.isFinite(n) ? n : null)
          }}
        />
      </div>
    )
  return (
    <button
      className={styles.cell}
      data-kind={col.kind}
      style={{ ...style, ...(tone ? { ['--tone' as string]: tone } : {}) }}
      data-cell={id}
      data-selected={selected || undefined}
      tabIndex={live ? 0 : -1}
      aria-label={`${label}: ${said}`}
      onPointerDown={onPress}
      onClick={live ? onClick : undefined}
      onDoubleClick={live ? onType : undefined}
    >
      {read.step ? (
        <span className={styles.glyph} title={read.step.label}>
          {read.step.glyph}
        </span>
      ) : read.number !== undefined ? (
        <span className={styles.number}>
          {fmt(read.number)}
          {col.unit && <span className={styles.unit}>{col.unit}</span>}
        </span>
      ) : read.text ? (
        <span className={styles.text}>{read.text}</span>
      ) : read.checked ? (
        <span className={styles.glyph}>✓</span>
      ) : (
        <span className={styles.unset}>·</span>
      )}
    </button>
  )
}

const ALL = 'all'

// The page controls in a table's dock (D-213): `‹ 2 / 5 ›` and how many rows a page (shared). Arrows step pages here.
export function TablePager({ piece, editor }: { piece: WithId<Piece>; editor: boolean }) {
  const { cards } = useWs()
  const setup = tableOf(piece)
  const count = useMemo(() => rowsOf(setup.rows, cards, !setup.manual).length, [setup.rows, setup.manual, cards])
  const p = pagesOf(setup, count, useTableUi((s) => s.pages[piece.id]))
  const go = (at: number) => useTableUi.setState((s) => ({ pages: { ...s.pages, [piece.id]: at } }))
  const { wid } = useWs()
  return (
    <span className={styles.pager} role="group" aria-label="Pages">
      {p.size && (
        <>
          <button className={styles.tool} disabled={p.at === 0} title="the page before" aria-label="Page before" onClick={() => go(p.at - 1)}>
            ‹
          </button>
          <span className={styles.pageAt}>
            {p.at + 1} / {p.pages}
          </span>
          <button className={styles.tool} disabled={p.at >= p.pages - 1} title="the page after" aria-label="Page after" onClick={() => go(p.at + 1)}>
            ›
          </button>
        </>
      )}
      {editor ? (
        <Select<string>
          ariaLabel="Rows a page"
          className={styles.pageSize}
          value={p.size ? String(p.size) : ALL}
          options={[{ value: ALL, label: `all ${count}` }, ...PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} a page` }))]}
          onChange={(v) => {
            go(0)
            void setTablePart(wid, piece.id, 'pageSize', v === ALL ? undefined : Number(v))
          }}
        />
      ) : (
        <span className={styles.pageAt}>{p.size ? `${p.size} a page` : `all ${count}`}</span>
      )}
    </span>
  )
}
