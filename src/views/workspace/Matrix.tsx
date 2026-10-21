// A matrix on the canvas (D-204): two lists crossed, a cell where they meet. Drawn in its own px through a view: on the
// canvas a window (D-208), its table at its own size from the top-left, cut by the edge (the pointer goes through to the canvas, D-186); in
// focus, live, gliding to the middle of the screen while the page fills in behind it (FocusedPlane's `bare`).
// Its look (D-212): the rows' and columns' heads are cards as a plane draws them (their type's colour down the left), a
// typed name is mono over a dashed rule; a scale's cell is a square filled to its step in the step's colour (or its
// glyph, `marks`); a note folds the cell's top-right corner, how sure sits in its top-left, neither moving what's in the
// middle. The totals sit in the heads, at the ends or both, as squares, a number or a line. Each axis ends in a dashed
// card: click, type a name (or pick a card) and Enter, then the next. In focus a click selects a cell (cyan corner
// marks, as a card's, D-150), again steps a scale on, arrows move, 1–9 set a step, Backspace clears, `-` leaves it out
// (when the matrix allows it), Enter or a double-click types a number or a text; under the selected cell, at screen
// size, its bar: the steps, `doesn't apply`, how sure, a note. Rows, columns and cells are set up from the focus dock's
// `[setup]` (MatrixSetupPanel); a typed head is renamed by a double-click, any head taken out by its `×`. Escape lets
// go of the cell (CanvasView), then leaves focus.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { create } from 'zustand'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import type { Card } from '../../data/cards'
import {
  addCardEntry,
  addNamed,
  CONFIDENCE_MARK,
  CONFIDENCES,
  emptySetup,
  entriesOf,
  NAME_MAX,
  nounOf,
  NOTES_MAX,
  oneOf,
  readCell,
  readingOf,
  relevant,
  removeEntry,
  renameEntry,
  setCell,
  TEXT_MAX,
  TONE_VAR,
  type Cell,
  type Entry,
  type MatrixSetup,
  type Reading,
  type Step,
} from '../../data/matrix'
import { useCanvasView, type Bounds, type PlaneCam } from '../../state/canvasView'
import { AutosaveField } from '../../ui/AutosaveField'
import { useWs } from './context'
import { TYPE_ACCENT } from './PlaneCards'
import styles from './Matrix.module.css'

// The matrix's parts in its own px: the row heads' column, a cell, the column heads' row, a row, the gap between them,
// the end totals' column and row.
export const M = { head: 220, cell: 104, top: 72, row: 44, gap: 6, end: 120, endRow: 36 }

const NO_SETUP = emptySetup()
export const setupOf = (p: Pick<Piece, 'matrix'>): MatrixSetup => p.matrix ?? NO_SETUP

const headTotals = (s: MatrixSetup) => !!s.reading && s.totalsAt !== 'end'
const endTotals = (s: MatrixSetup) => !!s.reading && (s.totalsAt === 'end' || s.totalsAt === 'both')

// Where everything is, from how many rows and columns it has. The dashed `+` cards close each axis, after the end totals.
function layout(setup: MatrixSetup, rows: number, cols: number) {
  const colX = (i: number) => M.head + M.gap + i * (M.cell + M.gap)
  const rowY = (i: number) => M.top + M.gap + i * (M.row + M.gap)
  const ends = endTotals(setup)
  const endX = colX(cols)
  const endY = rowY(rows)
  const addX = ends ? endX + M.end + M.gap : endX
  const addY = ends ? endY + M.endRow + M.gap : endY
  return { colX, rowY, ends, endX, endY, addX, addY, w: addX + M.cell, h: addY + M.row }
}

// The box round a matrix, in its px: what fit frames and the canvas shows in its window.
export function matrixBounds(piece: Pick<Piece, 'matrix'>, cards: Card[]): Bounds {
  const setup = setupOf(piece)
  const { w, h } = layout(setup, entriesOf(setup.rows, cards).length, entriesOf(setup.cols, cards).length)
  return { x: 0, y: 0, w, h }
}

// The setup (D-212): closed (`false`), or open on one of its tabs (`true` is the first). The wizard makes a new matrix.
export const SETUP_TABS = ['rows', 'cols', 'cells', 'options'] as const
export type SetupTab = (typeof SETUP_TABS)[number]
export const useMatrixUi = create<{ setup: boolean | SetupTab; naming: string | null; wizard: boolean }>(() => ({ setup: false, naming: null, wizard: false }))
export const setupTab = (s: boolean | SetupTab): SetupTab | null => (s === true ? 'rows' : s || null)
export const openMatrixSetup = (tab: SetupTab = 'rows') => useMatrixUi.setState({ setup: tab })
export const closeMatrixSetup = () => useMatrixUi.setState({ setup: false })
export const toggleMatrixSetup = (tab?: SetupTab) => useMatrixUi.setState((s) => ({ setup: s.setup ? false : (tab ?? 'rows') }))

// The selected cell rides on the canvas's card selection (D-187), so Escape and leaving focus let go of it as of a card.
const CELL = 'cell|'
const selKey = (row: string, col: string) => `${CELL}${row}|${col}`
const parseSel = (s: string | null) => (s?.startsWith(CELL) ? (s.slice(CELL.length).split('|') as [string, string]) : null)

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

type Props = { piece: WithId<Piece>; view: PlaneCam; live: boolean; editor: boolean }

export function MatrixView({ piece, view, live, editor }: Props) {
  const { wid, cards, cells } = useWs()
  const setup = setupOf(piece)
  const rows = useMemo(() => entriesOf(setup.rows, cards), [setup.rows, cards])
  const cols = useMemo(() => entriesOf(setup.cols, cards), [setup.cols, cards])
  const mine = useMemo(() => cells.filter((c) => c.matrixId === piece.id), [cells, piece.id])
  const byKey = useMemo(() => new Map(mine.map((c) => [`${c.row}|${c.col}`, c])), [mine])
  const at = (row: string, col: string) => byKey.get(`${row}|${col}`)
  const L = layout(setup, rows.length, cols.length)
  const sel = parseSel(useCanvasView((s) => (live ? s.cardSelected : null)))
  const ri = sel ? rows.findIndex((r) => r.key === sel[0]) : -1
  const ci = sel ? cols.findIndex((c) => c.key === sel[1]) : -1
  const selected = ri >= 0 && ci >= 0 ? { r: ri, c: ci } : null
  // The row and column under the pointer: their heads light up and their cells wash.
  const [hot, setHot] = useState<{ r: number; c: number } | null>(null)
  // A number or a text being typed in its cell.
  const [typing, setTyping] = useState<string | null>(null)
  const naming = useMatrixUi((s) => s.naming)
  const layer = useRef<HTMLDivElement>(null)

  const write = (row: string, col: string, fields: Parameters<typeof setCell>[4]) => void setCell(wid, piece.id, row, col, fields)
  const select = (r: number, c: number) => useCanvasView.setState({ cardSelected: selKey(rows[r].key, cols[c].key), labelSelected: null })
  const stepTo = (row: string, col: string, i: number | undefined) => write(row, col, { value: i === undefined ? undefined : setup.steps[i]?.id })

  // A selected cell whose row or column went (taken out, or its card deleted) lets go.
  useEffect(() => {
    if (sel && !selected) useCanvasView.setState({ cardSelected: null })
  }, [sel, selected])
  // Leaving focus closes the setup.
  useEffect(() => {
    if (!live) return
    return () => useMatrixUi.setState({ setup: false, naming: null })
  }, [live])

  // The keys on a selected cell; not while typing anywhere.
  const keysRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keysRef.current = (e: KeyboardEvent) => {
    if (!selected) return
    const t = e.target as HTMLElement | null
    if (t?.closest('input, textarea, [contenteditable], [role=menu], [role=dialog]')) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const row = rows[selected.r].key
    const col = cols[selected.c].key
    const move = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, number[]>)[e.key]
    if (move) {
      e.preventDefault()
      const r = Math.min(rows.length - 1, Math.max(0, selected.r + move[0]))
      const c = Math.min(cols.length - 1, Math.max(0, selected.c + move[1]))
      select(r, c)
      // The keyboard's focus goes along, so the one left behind isn't ringed.
      return layer.current?.querySelector<HTMLElement>(`[data-cell="${selKey(rows[r].key, cols[c].key)}"]`)?.focus()
    }
    if (!editor) return
    if (setup.cell === 'scale' && /^[1-9]$/.test(e.key) && Number(e.key) <= setup.steps.length) return stepTo(row, col, Number(e.key) - 1)
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      return write(row, col, { value: undefined })
    }
    if (e.key === '-' && setup.notRelevant) return write(row, col, { notRelevant: at(row, col)?.notRelevant ? undefined : true })
    if (e.key === 'Enter' && setup.cell !== 'scale') {
      e.preventDefault()
      setTyping(selKey(row, col))
    }
  }
  useEffect(() => {
    if (!live) return
    const onKey = (e: KeyboardEvent) => keysRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [live])

  // A press on anything live is its own: the plane's pan would take the click.
  const own = live ? (e: ReactPointerEvent) => e.stopPropagation() : undefined
  const remove = (which: 'rows' | 'cols', entry: Entry) => void removeEntry(wid, piece.id, setup, which, entry, mine)
  const rowCells = (r: Entry) => cols.map((c) => at(r.key, c.key))
  const colCells = (c: Entry) => rows.map((r) => at(r.key, c.key))
  const shown = [...rows, ...cols].map((e) => e.key)

  const box = (x: number, y: number, w: number, h: number): CSSProperties => ({ left: x, top: y, width: w, height: h })
  const selBox = selected ? { x: L.colX(selected.c), y: L.rowY(selected.r) } : null
  const heads = headTotals(setup)

  return (
    <div ref={layer} className={styles.layer} data-live={live || undefined}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }}>
        <div className={styles.table} style={{ width: L.w, height: L.h }} role="grid" aria-label={piece.name || 'matrix'} onPointerLeave={() => setHot(null)}>
          <div className={styles.corner} style={box(0, 0, M.head, M.top)}>
            <span>{nounOf(setup.rows)}</span>
            <span className={styles.cross}>×</span>
            <span>{nounOf(setup.cols)}</span>
          </div>

          {cols.map((c, i) => (
            <Head key={c.key} entry={c} which="cols" style={box(L.colX(i), 0, M.cell, M.top)} hot={hot?.c === i || selected?.c === i} live={live} editor={editor} naming={naming === c.item?.id}
              onRename={(name) => void renameEntry(wid, piece.id, setup, 'cols', c.item!.id, name)} onRemove={() => remove('cols', c)} onPress={own}>
              {heads && <Totals setup={setup} reading={readingOf(setup, colCells(c))} />}
            </Head>
          ))}
          {rows.map((r, i) => (
            <Head key={r.key} entry={r} which="rows" style={box(0, L.rowY(i), M.head, M.row)} hot={hot?.r === i || selected?.r === i} live={live} editor={editor} naming={naming === r.item?.id}
              onRename={(name) => void renameEntry(wid, piece.id, setup, 'rows', r.item!.id, name)} onRemove={() => remove('rows', r)} onPress={own}>
              {heads && <Totals setup={setup} reading={readingOf(setup, rowCells(r))} />}
            </Head>
          ))}

          {rows.map((r, ri) =>
            cols.map((c, ci) => {
              const cell = at(r.key, c.key)
              const key = selKey(r.key, c.key)
              const isSel = selected?.r === ri && selected.c === ci
              return (
                <CellBox
                  key={key}
                  id={key}
                  setup={setup}
                  cell={cell}
                  style={box(L.colX(ci), L.rowY(ri), M.cell, M.row)}
                  label={`${r.name || 'untitled'} × ${c.name || 'untitled'}`}
                  selected={isSel}
                  hot={hot?.r === ri || hot?.c === ci}
                  live={live}
                  typing={typing === key}
                  onPress={own}
                  onHover={live ? () => setHot({ r: ri, c: ci }) : undefined}
                  onClick={() => {
                    if (!isSel) return select(ri, ci)
                    // Again on a selected scale cell: the next step, then nothing (D-133's cycle).
                    if (!editor || setup.cell !== 'scale' || (setup.notRelevant && !relevant(cell))) return
                    const now = readCell(setup, cell).step
                    const i = now ? setup.steps.indexOf(now) + 1 : 0
                    stepTo(r.key, c.key, i < setup.steps.length ? i : undefined)
                  }}
                  onType={editor && setup.cell !== 'scale' ? () => (select(ri, ci), setTyping(key)) : undefined}
                  onTyped={(value) => {
                    setTyping(null)
                    // null: cancelled, or not a number.
                    if (value !== null) write(r.key, c.key, { value })
                  }}
                />
              )
            }),
          )}

          {/* The totals at the ends: a column after the cells, a row under them. */}
          {L.ends && (
            <>
              <div className={styles.endHead} style={box(L.endX, 0, M.end, M.top)}>
                total
              </div>
              {rows.map((r, i) => (
                <div key={r.key} className={styles.endCell} style={box(L.endX, L.rowY(i), M.end, M.row)}>
                  <Totals setup={setup} reading={readingOf(setup, rowCells(r))} wide />
                </div>
              ))}
              <div className={styles.endHead} data-row style={box(0, L.endY, M.head, M.endRow)}>
                total
              </div>
              {cols.map((c, i) => (
                <div key={c.key} className={styles.endCell} data-row style={box(L.colX(i), L.endY, M.cell, M.endRow)}>
                  <Totals setup={setup} reading={readingOf(setup, colCells(c))} />
                </div>
              ))}
            </>
          )}

          {live && editor && (
            <>
              <AddEntry which="cols" label={oneOf(setup.cols, 'cols')} style={box(L.addX, 0, M.cell, M.top)} piece={piece} setup={setup} shown={shown} onPress={own} />
              <AddEntry which="rows" label={oneOf(setup.rows, 'rows')} style={box(0, L.addY, M.head, M.row)} piece={piece} setup={setup} shown={shown} onPress={own} />
            </>
          )}
          {!rows.length && !cols.length && !(live && editor) && (
            <p className={styles.empty} style={box(0, M.top, L.w, M.row * 2)}>
              Nothing to cross yet
            </p>
          )}
        </div>
      </div>
      {live && selected && selBox && (
        <CellBar
          key={selKey(rows[selected.r].key, cols[selected.c].key)}
          setup={setup}
          cell={at(rows[selected.r].key, cols[selected.c].key)}
          row={rows[selected.r]}
          col={cols[selected.c]}
          editor={editor}
          // Under the cell, at screen size, kept on the screen.
          at={[view.ox + selBox.x * view.zoom, view.oy + (selBox.y + M.row) * view.zoom]}
          room={layer.current?.clientWidth ?? 0}
          write={(fields) => write(rows[selected.r].key, cols[selected.c].key, fields)}
          onType={() => setTyping(selKey(rows[selected.r].key, cols[selected.c].key))}
        />
      )}
    </div>
  )
}

type HeadProps = {
  entry: Entry
  which: 'rows' | 'cols'
  style: CSSProperties
  hot: boolean
  live: boolean
  editor: boolean
  naming: boolean
  onRename: (name: string) => void
  onRemove: () => void
  onPress?: (e: ReactPointerEvent) => void
  children?: ReactNode
}

// A row's or a column's head: a card's (its title, its type's colour down the left, as on a plane), or a typed name in
// mono over a dashed rule (a double-click renames it). Its totals under the name (a column's) or at its end (a row's).
function Head({ entry, which, style, hot, live, editor, naming, onRename, onRemove, onPress, children }: HeadProps) {
  const [editing, setEditing] = useState(false)
  const typed = !entry.card
  const open = (editing || naming) && typed && live && editor
  const tone = entry.card ? TYPE_ACCENT[entry.card.type] : undefined
  return (
    <div
      className={which === 'rows' ? styles.rowHead : styles.colHead}
      style={{ ...style, ...(tone ? { ['--type' as string]: tone } : {}) }}
      data-card={entry.card ? true : undefined}
      data-hot={hot || undefined}
      title={entry.name || undefined}
      onPointerDown={onPress}
      onDoubleClick={live && editor && typed ? () => setEditing(true) : undefined}
    >
      {open ? (
        <input
          className={styles.nameField}
          autoFocus
          aria-label={which === 'rows' ? 'Row name' : 'Column name'}
          defaultValue={entry.name}
          maxLength={NAME_MAX}
          placeholder="name"
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              e.currentTarget.value = entry.name
              e.currentTarget.blur()
            }
          }}
          onBlur={(e) => {
            setEditing(false)
            useMatrixUi.setState({ naming: null })
            if (e.currentTarget.value.trim() !== entry.name) onRename(e.currentTarget.value.trim())
          }}
        />
      ) : (
        <span className={styles.name} data-unnamed={!entry.name || undefined}>
          {entry.name || (entry.card ? `untitled ${entry.card.type}` : 'name')}
        </span>
      )}
      {children}
      {live && editor && !open && (
        <button className={styles.remove} title={entry.auto ? `take it out (it stays a ${entry.card!.type})` : 'take it out'} aria-label="Take it out" onClick={onRemove}>
          ×
        </button>
      )}
    </div>
  )
}

// A row or a column summed up (D-212), the ones left out (—) aside. A scale's: as squares (one per cell, in its step's
// colour, an outline when unset), a number (`3/5`) or a line of the steps' shares; numbers' average; texts written.
function Totals({ setup, reading, wide }: { setup: MatrixSetup; reading: Reading; wide?: boolean }) {
  const { counts, filled, of, avg } = reading
  const as = setup.totalsAs ?? 'squares'
  const tip = setup.cell === 'scale' ? `${setup.steps.map((s, i) => `${s.label} ${counts[i]}`).join(' · ')} · ${filled} of ${of} set` : undefined
  if (setup.cell === 'number')
    return (
      <span className={styles.totals} data-as="number">
        {avg !== undefined ? `${wide ? 'avg ' : ''}${fmt(avg)}${setup.unit ?? ''}` : '–'}
      </span>
    )
  if (setup.cell === 'text' || as === 'number')
    return (
      <span className={styles.totals} data-as="number" title={tip}>
        {filled}/{of}
      </span>
    )
  const line = (
    <span className={styles.track}>
      {setup.steps.map((s, i) => (counts[i] ? <span key={s.id} style={{ flexGrow: counts[i], background: TONE_VAR[s.tone] }} /> : null))}
      {of > filled && <span style={{ flexGrow: of - filled }} />}
    </span>
  )
  // Squares: one per cell, up to what fits; past that, the line.
  const max = wide ? 14 : 10
  const marks = setup.steps.flatMap((s, i) => Array.from({ length: counts[i] }, () => TONE_VAR[s.tone]))
  return (
    <span className={styles.totals} data-as={as} title={tip}>
      {as === 'bar' || of > max ? (
        line
      ) : (
        <span className={styles.squares}>
          {marks.map((tone, i) => (
            <i key={i} style={{ background: tone }} />
          ))}
          {Array.from({ length: of - filled }, (_, i) => (
            <i key={`e${i}`} data-empty />
          ))}
        </span>
      )}
      {wide && (
        <span className={styles.tally}>
          {filled}/{of}
        </span>
      )}
    </span>
  )
}

type AddProps = {
  which: 'rows' | 'cols'
  label: string
  style: CSSProperties
  piece: WithId<Piece>
  setup: MatrixSetup
  shown: string[]
  onPress?: (e: ReactPointerEvent) => void
}

// The dashed card that closes an axis (D-212): click, type a name and Enter (the field stays for the next), or pick one
// of the cards that match; Escape or leaving it closes it.
function AddEntry({ which, label, style, piece, setup, shown, onPress }: AddProps) {
  const { wid, cards } = useWs()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const query = q.trim().toLowerCase()
  const type = setup[which].type
  // Cards not on the matrix yet that match what's typed, the axis's own type first.
  const matches = query
    ? cards
        .filter((c) => !shown.includes(c.id) && c.title.toLowerCase().includes(query))
        .sort((a, b) => Number(b.type === type) - Number(a.type === type))
        .slice(0, 6)
    : []
  const done = () => {
    setQ('')
    field.current?.focus()
  }
  if (!open)
    return (
      <button className={styles.add} data-which={which} style={style} onPointerDown={onPress} onClick={() => setOpen(true)} title={`add a ${label}`}>
        + {label}
      </button>
    )
  return (
    <div className={styles.add} data-which={which} data-open style={style} onPointerDown={onPress}>
      <input
        ref={field}
        className={styles.addField}
        autoFocus
        value={q}
        maxLength={NAME_MAX}
        placeholder="type a name"
        aria-label={`Add a ${label}`}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') return setOpen(false)
          if (e.key === 'Enter' && q.trim()) void addNamed(wid, piece.id, setup, which, q.trim()).then(done)
        }}
        onBlur={(e) => {
          // Not when picking a card from the list under it.
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setOpen(false)
        }}
      />
      <span className={styles.addHint}>{matches.length ? 'enter adds the name · or a card' : 'enter adds it'}</span>
      {matches.length > 0 && (
        <div className={styles.picks} role="listbox" aria-label="Cards that match">
          {matches.map((c) => (
            <button key={c.id} role="option" aria-selected={false} className={styles.pick} style={{ ['--type' as string]: TYPE_ACCENT[c.type] }} onClick={() => void addCardEntry(wid, piece.id, setup, which, c).then(done)}>
              <span className={styles.pickName}>{c.title || `untitled ${c.type}`}</span>
              <span className={styles.pickType}>{c.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// A scale's step as a square filled to it, low to high, in its colour (D-212); the first an outline.
export function StepSquare({ steps, step }: { steps: Step[]; step: Step }) {
  const i = steps.indexOf(step)
  const fill = steps.length > 1 ? (i / (steps.length - 1)) * 100 : 100
  return <span className={styles.square} style={{ ['--tone' as string]: TONE_VAR[step.tone], ['--fill' as string]: `${fill}%` }} aria-hidden />
}

type CellProps = {
  id: string
  setup: MatrixSetup
  cell: Cell | undefined
  style: CSSProperties
  label: string
  selected: boolean
  hot: boolean
  live: boolean
  typing: boolean
  onPress?: (e: ReactPointerEvent) => void
  onHover?: () => void
  onClick: () => void
  onType?: () => void
  onTyped: (value: string | number | undefined | null) => void
}

// What a cell reads: — left out, a step (its square or glyph), a number, a text, or an empty outline; a folded corner
// when it has a note, `~` / `?` in the other corner when it's not sure. Neither moves what's in the middle.
function CellBox({ id, setup, cell, style, label, selected, hot, live, typing, onPress, onHover, onClick, onType, onTyped }: CellProps) {
  const out = setup.notRelevant && !relevant(cell)
  const read = out ? {} : readCell(setup, cell)
  const sure = !out && setup.confidence && cell?.confidence ? CONFIDENCE_MARK[cell.confidence] : ''
  const tone = read.step ? TONE_VAR[read.step.tone] : undefined
  const said = out ? "doesn't apply" : read.step?.label ?? (read.number !== undefined ? fmt(read.number) : read.text) ?? 'empty'
  if (typing)
    return (
      <div className={styles.cell} style={style} data-selected onPointerDown={onPress}>
        <input
          className={styles.cellField}
          autoFocus
          aria-label={label}
          inputMode={setup.cell === 'number' ? 'decimal' : undefined}
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
            if (setup.cell === 'text') return onTyped(raw || undefined)
            const n = Number(raw.replace(',', '.'))
            onTyped(raw === '' ? undefined : Number.isFinite(n) ? n : null)
          }}
        />
        <span className={styles.marks} aria-hidden />
      </div>
    )
  return (
    <button
      className={styles.cell}
      style={{ ...style, ...(tone ? { ['--tone' as string]: tone } : {}) }}
      data-cell={id}
      data-selected={selected || undefined}
      data-hot={hot || undefined}
      tabIndex={live ? 0 : -1}
      aria-label={`${label}: ${said}${sure ? `, ${cell!.confidence}` : ''}${cell?.notes ? ', has a note' : ''}`}
      title={cell?.notes ? cell.notes.slice(0, 200) : undefined}
      onPointerDown={onPress}
      onPointerEnter={onHover}
      onClick={live ? onClick : undefined}
      onDoubleClick={live ? onType : undefined}
    >
      {out ? (
        <span className={styles.out} aria-hidden />
      ) : read.step ? (
        setup.marks ? (
          <span className={styles.glyph}>{read.step.glyph}</span>
        ) : (
          <StepSquare steps={setup.steps} step={read.step} />
        )
      ) : read.number !== undefined ? (
        <span className={styles.number}>
          {fmt(read.number)}
          {setup.unit && <span className={styles.unit}>{setup.unit}</span>}
        </span>
      ) : read.text ? (
        <span className={styles.text}>{read.text}</span>
      ) : setup.cell === 'scale' ? (
        <span className={styles.unset} aria-hidden />
      ) : (
        <span className={styles.unsetDot}>·</span>
      )}
      {cell?.notes && <span className={styles.noted} aria-hidden />}
      {sure && (
        <span className={styles.sure} aria-hidden>
          {sure}
        </span>
      )}
      <span className={styles.marks} aria-hidden />
    </button>
  )
}

type BarProps = {
  setup: MatrixSetup
  cell: Cell | undefined
  row: Entry
  col: Entry
  editor: boolean
  at: [number, number]
  room: number
  write: (fields: Parameters<typeof setCell>[4]) => void
  onType: () => void
}

// The selected cell's bar, at screen size under it, kept inside the screen: where it is, then its value (the steps, or
// `[type]`), `doesn't apply`, how sure, and its note.
function CellBar({ setup, cell, row, col, editor, at, room, write, onType }: BarProps) {
  const out = setup.notRelevant && !relevant(cell)
  const read = readCell(setup, cell)
  const bar = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = bar.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.offsetWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const left = room && w ? Math.max(8, Math.min(at[0], room - w - 8)) : at[0]
  return (
    <div ref={bar} className={styles.cellBar} style={{ left, top: at[1] + 8 }} role="toolbar" aria-label="Cell" onPointerDown={(e) => e.stopPropagation()}>
      <div className={styles.where}>
        <span>{row.name || 'untitled'}</span>
        <span className={styles.cross}>×</span>
        <span>{col.name || 'untitled'}</span>
      </div>
      {!out && setup.cell === 'scale' && (
        <div className={styles.barRow}>
          {setup.steps.map((s, i) => (
            <button
              key={s.id}
              className={styles.tool}
              aria-pressed={read.step?.id === s.id}
              disabled={!editor}
              style={{ ['--tone' as string]: TONE_VAR[s.tone] }}
              title={`${s.label} (${i + 1})`}
              onClick={() => write({ value: read.step?.id === s.id ? undefined : s.id })}
            >
              {setup.marks ? <span className={styles.stepGlyph}>{s.glyph}</span> : <StepSquare steps={setup.steps} step={s} />} {s.label}
            </button>
          ))}
        </div>
      )}
      {!out && setup.cell !== 'scale' && editor && (
        <div className={styles.barRow}>
          <button className={styles.tool} onClick={onType} title="type it (Enter)">
            {read.number !== undefined || read.text ? 'change' : 'type'}
          </button>
          {(read.number !== undefined || read.text) && (
            <button className={styles.tool} onClick={() => write({ value: undefined })} title="clear it (Backspace)">
              clear
            </button>
          )}
        </div>
      )}
      {(setup.notRelevant || setup.confidence) && (
        <div className={styles.barRow}>
          {setup.notRelevant && (
            <button className={styles.tool} aria-pressed={out} disabled={!editor} title="they can't be compared here: left out of the totals (-)" onClick={() => write({ notRelevant: out ? undefined : true })}>
              — doesn't apply
            </button>
          )}
          {setup.confidence && !out &&
            CONFIDENCES.map((c) => (
              <button key={c} className={styles.tool} aria-pressed={cell?.confidence === c} disabled={!editor} onClick={() => write({ confidence: cell?.confidence === c ? undefined : c })}>
                {CONFIDENCE_MARK[c] ? `${CONFIDENCE_MARK[c]} ` : ''}
                {c}
              </button>
            ))}
        </div>
      )}
      {editor ? (
        <AutosaveField
          multiline
          rows={1}
          className={styles.note}
          label="note"
          placeholder="a note: where it's from, why"
          maxLength={NOTES_MAX}
          value={cell?.notes ?? ''}
          onSave={(v) => v !== (cell?.notes ?? '') && write({ notes: v.trim() ? v : undefined })}
        />
      ) : (
        cell?.notes && <p className={styles.noteText}>{cell.notes}</p>
      )}
    </div>
  )
}

// For the setup panel: a card picked to be a row or a column.
export const addCard = (wid: string, piece: WithId<Piece>, which: 'rows' | 'cols', card: Card) => void addCardEntry(wid, piece.id, setupOf(piece), which, card)
