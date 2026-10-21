// A matrix on the canvas (D-204): two lists crossed, a cell where they meet. Drawn in its own px through a view: on the
// canvas it's just the table, at its own size, no frame or marks (the pointer goes through to the canvas, D-186); in
// focus, live, gliding to the middle of the screen while the page fills in behind it (FocusedPlane's `bare`). There a click selects a cell (and again steps a scale on, as the old matrix did), arrows move, 1–9 set a
// step, Backspace clears, `-` leaves it out (when the matrix allows it), Enter or a double-click types a number or a text.
// Under the selected cell, at screen size, its bar: the steps, `not relevant`, how sure, a note. Rows and columns are
// set up from the focus dock's `[setup]` (MatrixSetupPanel); a typed one is renamed by a double-click, any one taken out
// by its `×`. Escape lets go of the cell (CanvasView), then leaves focus.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
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
} from '../../data/matrix'
import { useCanvasView, type Bounds, type PlaneCam } from '../../state/canvasView'
import { AutosaveField } from '../../ui/AutosaveField'
import { useWs } from './context'
import { TYPE_ACCENT } from './PlaneCards'
import styles from './Matrix.module.css'

// The matrix's parts in its own px: the row names' column, a cell, the reading, the column names' row, a row, the `+`.
export const M = { head: 225, cell: 75, read: 150, top: 75, row: 40, add: 40 }

const NO_SETUP = emptySetup()
export const setupOf = (p: Pick<Piece, 'matrix'>): MatrixSetup => p.matrix ?? NO_SETUP

// Where everything is, from how many rows and columns it has.
function layout(setup: MatrixSetup, rows: number, cols: number) {
  const readX = M.head + cols * M.cell
  const addX = readX + (setup.reading ? M.read : 0)
  const readY = M.top + rows * M.row
  const addY = readY + (setup.reading ? M.row : 0)
  return { readX, addX, readY, addY, w: addX + M.add, h: addY + M.add }
}

// The box round a matrix, in its px: what fit frames and the canvas shows fitted in its piece.
export function matrixBounds(piece: Pick<Piece, 'matrix'>, cards: Card[]): Bounds {
  const setup = setupOf(piece)
  const { w, h } = layout(setup, entriesOf(setup.rows, cards).length, entriesOf(setup.cols, cards).length)
  return { x: 0, y: 0, w, h }
}

// The focus dock's `[setup]` opens the panel (MatrixSetupPanel); a typed row or column being named.
export const useMatrixUi = create<{ setup: boolean; naming: string | null }>(() => ({ setup: false, naming: null }))

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
  const add = async (which: 'rows' | 'cols') => useMatrixUi.setState({ naming: await addNamed(wid, piece.id, setup, which) })
  const rowCells = (r: Entry) => cols.map((c) => at(r.key, c.key))
  const colCells = (c: Entry) => rows.map((r) => at(r.key, c.key))

  const box = (x: number, y: number, w: number, h: number): CSSProperties => ({ left: x, top: y, width: w, height: h })
  const selBox = selected ? { x: M.head + selected.c * M.cell, y: M.top + selected.r * M.row } : null

  return (
    <div ref={layer} className={styles.layer} data-live={live || undefined}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})` }}>
        <div className={styles.table} style={{ width: L.w, height: L.h }} role="grid" aria-label={piece.name || 'matrix'}>
          {/* The rules: one under the column names, a dashed one under each row; the columns' edges faint. */}
          {rows.map((r, i) => (
            <div key={r.key} className={styles.band} data-selected={selected?.r === i || undefined} style={box(0, M.top + i * M.row, L.addX, M.row)} />
          ))}
          {cols.map((c, i) => (
            <div key={c.key} className={styles.colBand} data-selected={selected?.c === i || undefined} style={box(M.head + i * M.cell, 0, M.cell, L.readY)} />
          ))}
          <div className={styles.headRule} style={box(0, M.top - 1, L.addX, 1)} />

          {/* Its name, or what it crosses while it has none. */}
          <div className={styles.corner} style={box(0, 0, M.head, M.top)}>
            {piece.name ? (
              <span>{piece.name}</span>
            ) : (
              <>
                <span>{nounOf(setup.rows)}</span>
                <span className={styles.cross}>×</span>
                <span>{nounOf(setup.cols)}</span>
              </>
            )}
          </div>

          {cols.map((c, i) => (
            <Head key={c.key} entry={c} which="cols" style={box(M.head + i * M.cell, 0, M.cell, M.top)} live={live} editor={editor} naming={naming === c.item?.id}
              onRename={(name) => void renameEntry(wid, piece.id, setup, 'cols', c.item!.id, name)} onRemove={() => remove('cols', c)} onPress={own} />
          ))}
          {rows.map((r, i) => (
            <Head key={r.key} entry={r} which="rows" style={box(0, M.top + i * M.row, M.head, M.row)} live={live} editor={editor} naming={naming === r.item?.id}
              onRename={(name) => void renameEntry(wid, piece.id, setup, 'rows', r.item!.id, name)} onRemove={() => remove('rows', r)} onPress={own} />
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
                  style={box(M.head + ci * M.cell, M.top + ri * M.row, M.cell, M.row)}
                  label={`${r.name || 'untitled'} × ${c.name || 'untitled'}`}
                  selected={isSel}
                  live={live}
                  typing={typing === key}
                  onPress={own}
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

          {setup.reading && (
            <>
              <div className={styles.readHead} style={box(L.readX, 0, M.read, M.top)}>
                reading
              </div>
              {rows.map((r, i) => (
                <ReadingBox key={r.key} setup={setup} reading={readingOf(setup, rowCells(r))} style={box(L.readX, M.top + i * M.row, M.read, M.row)} />
              ))}
              <div className={styles.readFoot} style={box(0, L.readY, M.head, M.row)}>
                reading
              </div>
              {cols.map((c, i) => (
                <ReadingBox key={c.key} setup={setup} reading={readingOf(setup, colCells(c))} short style={box(M.head + i * M.cell, L.readY, M.cell, M.row)} />
              ))}
            </>
          )}

          {live && editor && (
            <>
              <button className={styles.add} data-col style={box(L.addX, 0, M.add, M.top)} title="add a named column" aria-label="Add a column" onPointerDown={own} onClick={() => void add('cols')}>
                +
              </button>
              <button className={styles.add} style={box(0, L.addY, M.head, M.add)} title="add a named row" aria-label="Add a row" onPointerDown={own} onClick={() => void add('rows')}>
                + row
              </button>
            </>
          )}
          {!rows.length && !cols.length && (
            <p className={styles.empty} style={box(0, M.top, L.w, M.row * 2)}>
              Nothing to cross yet: set up its rows and columns
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
          // Under the cell, at screen size.
          at={[view.ox + selBox.x * view.zoom, view.oy + (selBox.y + M.row) * view.zoom]}
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
  live: boolean
  editor: boolean
  naming: boolean
  onRename: (name: string) => void
  onRemove: () => void
  onPress?: (e: ReactPointerEvent) => void
}

// A row's or a column's name: a card's title by its type's colour, or a typed name (a double-click renames it).
function Head({ entry, which, style, live, editor, naming, onRename, onRemove, onPress }: HeadProps) {
  const [editing, setEditing] = useState(false)
  const typed = !entry.card
  const open = (editing || naming) && typed && live && editor
  const tone = entry.card ? TYPE_ACCENT[entry.card.type] : undefined
  return (
    <div
      className={which === 'rows' ? styles.rowHead : styles.colHead}
      style={{ ...style, ...(tone ? { ['--type' as string]: tone } : {}) }}
      data-card={entry.card ? true : undefined}
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
      {live && editor && !open && (
        <button className={styles.remove} title={entry.auto ? `take it out (it stays a ${entry.card!.type})` : 'take it out'} aria-label="Take it out" onClick={onRemove}>
          ×
        </button>
      )}
    </div>
  )
}

type CellProps = {
  id: string
  setup: MatrixSetup
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

// What a cell reads: — left out, a step's glyph in its colour, a number, a text, or a faint dot; a tick when it has a
// note, `~` / `?` when it's not sure.
function CellBox({ id, setup, cell, style, label, selected, live, typing, onPress, onClick, onType, onTyped }: CellProps) {
  const out = setup.notRelevant && !relevant(cell)
  const read = out ? {} : readCell(setup, cell)
  const sure = !out && setup.confidence && cell?.confidence ? CONFIDENCE_MARK[cell.confidence] : ''
  const tone = read.step ? TONE_VAR[read.step.tone] : undefined
  const said = out ? 'not relevant' : read.step?.label ?? (read.number !== undefined ? fmt(read.number) : read.text) ?? 'empty'
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
      </div>
    )
  return (
    <button
      className={styles.cell}
      style={{ ...style, ...(tone ? { ['--tone' as string]: tone } : {}) }}
      data-cell={id}
      data-selected={selected || undefined}
      data-filled={read.step || read.number !== undefined || read.text ? true : undefined}
      tabIndex={live ? 0 : -1}
      aria-label={`${label}: ${said}${sure ? `, ${cell!.confidence}` : ''}${cell?.notes ? ', has a note' : ''}`}
      title={cell?.notes ? cell.notes.slice(0, 200) : undefined}
      onPointerDown={onPress}
      onClick={live ? onClick : undefined}
      onDoubleClick={live ? onType : undefined}
    >
      {out ? (
        <span className={styles.out}>—</span>
      ) : read.step ? (
        <span className={styles.glyph}>{read.step.glyph}</span>
      ) : read.number !== undefined ? (
        <span className={styles.number}>
          {fmt(read.number)}
          {setup.unit && <span className={styles.unit}>{setup.unit}</span>}
        </span>
      ) : read.text ? (
        <span className={styles.text}>{read.text}</span>
      ) : (
        <span className={styles.unset}>·</span>
      )}
      {cell?.notes && <span className={styles.noted} aria-hidden />}
      {sure && (
        <span className={styles.sure} aria-hidden>
          {sure}
        </span>
      )}
    </button>
  )
}

// A row or a column read together: a scale's steps as a bar in their colours and how many are set; numbers' average;
// how many texts are written.
function ReadingBox({ setup, reading, style, short }: { setup: MatrixSetup; reading: Reading; style: CSSProperties; short?: boolean }) {
  const { counts, filled, of, avg } = reading
  const tally = `${filled}/${of}`
  return (
    <div className={styles.reading} style={style} data-short={short || undefined} title={setup.cell === 'scale' ? setup.steps.map((s, i) => `${s.label} ${counts[i]}`).join(' · ') : undefined}>
      {setup.cell === 'scale' && filled > 0 && (
        <span className={styles.bar} aria-hidden>
          {setup.steps.map((s, i) =>
            counts[i] ? <span key={s.id} style={{ flexGrow: counts[i], background: TONE_VAR[s.tone] }} /> : null,
          )}
        </span>
      )}
      {setup.cell === 'number' && avg !== undefined ? (
        <span className={styles.tally}>
          {short ? '' : 'avg '}
          {fmt(avg)}
          {setup.unit ?? ''}
        </span>
      ) : (
        <span className={styles.tally}>{of ? tally : ''}</span>
      )}
    </div>
  )
}

type BarProps = {
  setup: MatrixSetup
  cell: Cell | undefined
  row: Entry
  col: Entry
  editor: boolean
  at: [number, number]
  write: (fields: Parameters<typeof setCell>[4]) => void
  onType: () => void
}

// The selected cell's bar, at screen size under it: where it is, then its value (the steps, or `[type]`), `not
// relevant`, how sure, and its note.
function CellBar({ setup, cell, row, col, editor, at, write, onType }: BarProps) {
  const out = setup.notRelevant && !relevant(cell)
  const read = readCell(setup, cell)
  return (
    <div className={styles.cellBar} style={{ left: at[0], top: at[1] + 6 }} role="toolbar" aria-label="Cell" onPointerDown={(e) => e.stopPropagation()}>
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
              <span className={styles.stepGlyph}>{s.glyph}</span> {s.label}
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
            <button className={styles.tool} aria-pressed={out} disabled={!editor} title="they aren't comparable here at all: left out of the readings (-)" onClick={() => write({ notRelevant: out ? undefined : true })}>
              — not relevant
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
