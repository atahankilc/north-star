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
// A feature on an axis that unfolds (D-249) carries `[+] 3` in its head: open, what it's judged on are rows of their
// own under it (numbered, renamed by a double-click, written to the card), and its cells read from them; folded, its
// cells show one small square for each. A criterion nobody meets is `◇ open`, the card's head counting them.
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type RefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { create } from 'zustand'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { updateCard, type Card } from '../../data/cards'
import {
  addCardEntry,
  addNamed,
  CONFIDENCE_MARK,
  CONFIDENCES,
  cellView,
  emptySetup,
  isOpen,
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
  setOpen,
  TEXT_MAX,
  TONE_VAR,
  tops,
  type Cell,
  type Entry,
  type MatrixSetup,
  type Reading,
  type Shown,
  type Step,
} from '../../data/matrix'
import { fitInto, glide, useCanvasView, type Bounds, type PlaneCam } from '../../state/canvasView'
import { AutosaveField } from '../../ui/AutosaveField'
import { useWs } from './context'
import { useSeen, within } from './visible'
import { useTheme } from '../../state/theme'
import { TYPE_ACCENT } from './PlaneCards'
import type { FindItem } from './find'
import { useStill } from './still'
import { usePeersOn } from './collab'
import { Marks, zsOf } from '../../ui/Marks'
import styles from './Matrix.module.css'

// The matrix's parts in its own px: the row heads' column, a cell, the column heads' row, a row, the gap between them,
// the end totals' column and row.
export const M = { head: 220, cell: 104, top: 72, row: 44, gap: 6, end: 120, endRow: 36 }

// In focus the heads stick (D-214): panned or zoomed so they'd leave the screen, the column heads stay this far from its
// top (under the breadcrumb's bar) and the row heads this far from its left (just past the side nav's tools, D-217; the
// nav's shade fades while they're held, `html[data-held-heads]`, Hud.module.css), the cells moving under them. Never
// further in than where fit puts them (fitPlane's 96 px round), so a fitted table's heads don't cover its first row or
// column.
const STICK = { top: 64, left: 56 }
const FIT_PAD = 96

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

// What find looks through in a matrix (D-236): the column heads, then each row's head and its cells, a cell by what it
// shows and then its note; each with its box in the matrix's px.
export function matrixFindItems(piece: WithId<Piece>, cards: Card[], cells: Cell[]): FindItem[] {
  const setup = setupOf(piece)
  const rows = entriesOf(setup.rows, cards)
  const cols = entriesOf(setup.cols, cards)
  const byKey = new Map(cells.filter((c) => c.matrixId === piece.id).map((c) => [`${c.row}|${c.col}`, c]))
  const at = (row: string, col: string) => byKey.get(`${row}|${col}`)
  const L = layout(setup, rows.length, cols.length)
  const out: FindItem[] = cols.map((c, i) => ({ key: `cols|${c.key}`, text: c.name, box: { x: L.colX(i), y: 0, w: M.cell, h: M.top } }))
  rows.forEach((r, ri) => {
    const y = L.rowY(ri)
    out.push({ key: `rows|${r.key}`, text: r.name, box: { x: 0, y, w: M.head, h: M.row } })
    cols.forEach((c, ci) => {
      const cell = cellView(piece.id, setup, at, r, c)
      const read = setup.notRelevant && !relevant(cell) ? {} : readCell(setup, cell)
      const shown = read.step?.label ?? (read.number !== undefined ? fmt(read.number) : read.text) ?? ''
      out.push({ key: selKey(piece.id, r.key, c.key), text: [shown, cell?.notes].filter(Boolean).join('\n'), box: { x: L.colX(ci), y, w: M.cell, h: M.row } })
    })
  })
  return out
}

// The setup (D-212): closed (`false`), or open on one of its tabs (`true` is the first); `canvas`: the matrix it's for when
// it's opened from one open on the canvas (D-228), not in focus. The wizard makes a new matrix.
export const SETUP_TABS = ['rows', 'cols', 'cells', 'options'] as const
export type SetupTab = (typeof SETUP_TABS)[number]
export const useMatrixUi = create<{ setup: boolean | SetupTab; canvas: string | null; naming: string | null; wizard: boolean }>(() => ({ setup: false, canvas: null, naming: null, wizard: false }))
export const setupTab = (s: boolean | SetupTab): SetupTab | null => (s === true ? 'rows' : s || null)
export const openMatrixSetup = (tab: SetupTab = 'rows') => useMatrixUi.setState({ setup: tab })
export const closeMatrixSetup = () => useMatrixUi.setState({ setup: false, canvas: null })
export const toggleMatrixSetup = (tab?: SetupTab) => useMatrixUi.setState((s) => ({ setup: s.setup ? false : (tab ?? 'rows') }))

// The selected cell rides on the canvas's card selection (D-187), so Escape and leaving focus let go of it as of a card.
// The matrix's id in it: more than one can be live at once (open on the canvas, D-228; stacked beside a plane, D-211).
const CELL = 'cell|'
const selKey = (piece: string, row: string, col: string) => `${CELL}${piece}|${row}|${col}`
const parseSel = (piece: string, s: string | null) => (s?.startsWith(`${CELL}${piece}|`) ? (s.slice(CELL.length + piece.length + 1).split('|') as [string, string]) : null)

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

// `onCanvas`: live on the canvas itself, opened there (D-228): its heads never stick, nothing cut at its edge.
type Props = { piece: WithId<Piece>; view: PlaneCam; live: boolean; editor: boolean; onCanvas?: boolean }

export function MatrixView({ piece, view, live, editor, onCanvas = false }: Props) {
  const { wid, cards, cells } = useWs()
  const still = useStill()
  const setup = setupOf(piece)
  const rows = useMemo(() => entriesOf(setup.rows, cards), [setup.rows, cards])
  const cols = useMemo(() => entriesOf(setup.cols, cards), [setup.cols, cards])
  const mine = useMemo(() => cells.filter((c) => c.matrixId === piece.id), [cells, piece.id])
  const byKey = useMemo(() => new Map(mine.map((c) => [`${c.row}|${c.col}`, c])), [mine])
  const at = (row: string, col: string) => byKey.get(`${row}|${col}`)
  // A cell as shown: a card that unfolds reads from its parts (D-249).
  // Kept while the cells and the setup are, so the far canvas (CellDots) isn't drawn again on every pan.
  const shownAt = useCallback(
    (r: Entry, c: Entry): Shown | undefined => {
      const get = (row: string, col: string) => byKey.get(`${row}|${col}`)
      return r.subs || c.subs ? cellView(piece.id, setup, get, r, c) : get(r.key, c.key)
    },
    [byKey, setup, piece.id],
  )
  const topRows = useMemo(() => tops(rows), [rows])
  const topCols = useMemo(() => tops(cols), [cols])
  const L = layout(setup, rows.length, cols.length)
  const sel = parseSel(piece.id, useCanvasView((s) => (live ? s.cardSelected : null)))
  const ri = sel ? rows.findIndex((r) => r.key === sel[0]) : -1
  const ci = sel ? cols.findIndex((c) => c.key === sel[1]) : -1
  const selected = ri >= 0 && ci >= 0 ? { r: ri, c: ci } : null
  // The row and column under the pointer: their heads light up and their cells wash.
  // Kept in a little store of its own that each cell and head reads, so the pointer moving over it draws again only
  // the cells and heads it lights or stops lighting, never the whole matrix.
  const [hotStore] = useState(newHot)
  const setHot = (at: Hot) => hotStore.setState({ at })
  // A number or a text being typed in its cell.
  const [typing, setTyping] = useState<string | null>(null)
  const naming = useMatrixUi((s) => s.naming)
  const layer = useRef<HTMLDivElement>(null)
  // Its space's size (the screen in focus, a pane beside a plane), for where fit would put the heads.
  const [room, setRoom] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = layer.current
    if (!el || !live) return
    const ro = new ResizeObserver(() => setRoom({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [live])
  // A row or column just added from its dashed card: the view glides to bring it to the middle (D-214).
  const centre = useRef<'rows' | 'cols' | null>(null)


  const write = (row: string, col: string, fields: Parameters<typeof setCell>[4]) => void setCell(wid, piece.id, row, col, fields)
  const select = (r: number, c: number) => useCanvasView.setState({ cardSelected: selKey(piece.id, rows[r].key, cols[c].key), labelSelected: null })
  // A card's head clicked: the card selected, its panel open as on its plane (LensCardPanel).
  const picked = useCanvasView((s) => (live ? s.cardSelected : null))
  const pick = (card: Card) => useCanvasView.setState({ cardSelected: card.id, labelSelected: null })
  const stepTo = (row: string, col: string, i: number | undefined) => write(row, col, { value: i === undefined ? undefined : setup.steps[i]?.id })

  // A selected cell whose row or column went (taken out, or its card deleted) lets go.
  useEffect(() => {
    if (sel && !selected) useCanvasView.setState({ cardSelected: null })
  }, [sel, selected])
  // The one just added, brought to the middle: a row up or down, a column across. Only on the focus's own view (a pane
  // beside a plane has its own).
  useEffect(() => {
    const which = centre.current
    const el = layer.current
    const { planeCam } = useCanvasView.getState()
    if (!which || !el || !live || planeCam !== view) return
    centre.current = null
    const to =
      which === 'rows'
        ? { ...view, oy: el.clientHeight / 2 - (L.rowY(rows.length - 1) + M.row / 2) * view.zoom }
        : { ...view, ox: el.clientWidth / 2 - (L.colX(cols.length - 1) + M.cell / 2) * view.zoom }
    glide(view, to, 420, (v) => useCanvasView.setState({ planeCam: v }))
    // When one comes in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, cols.length])
  // Leaving focus closes the setup.
  useEffect(() => {
    if (!live) return
    return () => useMatrixUi.setState({ setup: false, canvas: null, naming: null })
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
      return layer.current?.querySelector<HTMLElement>(`[data-cell="${selKey(piece.id, rows[r].key, cols[c].key)}"]`)?.focus()
    }
    // A card's cell read from its parts is set through them; only `-` is its own.
    const rolled = !!shownAt(rows[selected.r], cols[selected.c])?.rolled
    if (!editor) return
    if (e.key === '-' && setup.notRelevant) return write(row, col, { notRelevant: at(row, col)?.notRelevant ? undefined : true })
    if (rolled) return
    if (setup.cell === 'scale' && /^[1-9]$/.test(e.key) && Number(e.key) <= setup.steps.length) return stepTo(row, col, Number(e.key) - 1)
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      return write(row, col, { value: undefined })
    }
    if (e.key === 'Enter' && setup.cell !== 'scale') {
      e.preventDefault()
      setTyping(selKey(piece.id, row, col))
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
  // A total across a row or a column counts each card once: not what it unfolded into (that's in its own cell).
  const rowCells = (r: Entry) => topCols.map((c) => shownAt(r, c))
  const colCells = (c: Entry) => topRows.map((r) => shownAt(r, c))
  // What a card unfolds into that nobody meets, by its key (D-249): across the other axis's cards.
  const openOf = (which: 'rows' | 'cols', key: string) =>
    isOpen(setup, which === 'rows' ? topCols.map((c) => cellView(piece.id, setup, at, { key }, c)) : topRows.map((r) => cellView(piece.id, setup, at, r, { key })))
  const fold = (which: 'rows' | 'cols', e: Entry, open: boolean) => void setOpen(wid, piece.id, setup, which, [e.key], open)
  const renameSub = (e: Entry, text: string) => {
    const card = e.card
    if (!card || !e.sub || !text) return
    void updateCard(wid, card, { criteria: (card.criteria ?? []).map((x) => (x.id === e.sub!.id ? { ...x, text: text.slice(0, NAME_MAX) } : x)) }, 'what it is judged on')
  }
  const shown = [...rows, ...cols].map((e) => e.key)
  // What a cell does, by its row and column: one object kept for good, its functions this render's, so a cell (memoised)
  // is drawn again only when what it shows changes, not when the view moves or another cell is hovered.
  const acts = useRef<CellActs>(null!)
  acts.current = {
    // No press of its own: a press on a cell may pan its space (FocusedPlane, a pane beside a plane, the canvas; D-217).
    // Not while a button's held (a pan passing over): nothing to light then.
    hover: (ri, ci, e) => live && e.buttons === 0 && setHot({ r: ri, c: ci }),
    click: (ri, ci) => {
      if (selected?.r !== ri || selected.c !== ci) return select(ri, ci)
      // Again on a selected scale cell: the next step, then nothing (D-133's cycle). Not on one read from its parts.
      const cell = shownAt(rows[ri], cols[ci])
      if (!editor || setup.cell !== 'scale' || cell?.rolled || (setup.notRelevant && !relevant(cell))) return
      const now = readCell(setup, cell).step
      const i = now ? setup.steps.indexOf(now) + 1 : 0
      stepTo(rows[ri].key, cols[ci].key, i < setup.steps.length ? i : undefined)
    },
    type: (ri, ci) => (select(ri, ci), setTyping(selKey(piece.id, rows[ri].key, cols[ci].key))),
    typed: (ri, ci, value) => {
      setTyping(null)
      // null: cancelled, or not a number.
      if (value !== null) write(rows[ri].key, cols[ci].key, { value })
    },
  }

  const box = (x: number, y: number, w: number, h: number): CSSProperties => ({ left: x, top: y, width: w, height: h })
  // What's drawn of its rows, columns and cells, made again only when they, the selection or what's typed change, not as
  // its view moves (in focus every pan and zoom): the cells are memoised too, so a frame touches only the held heads.
  const heads = headTotals(setup)
  const sr = selected?.r
  const sc = selected?.c
  // Only the cells on the screen (and a block round it), and the selected one wherever it is, so the keys can move to it.
  const seen = useSeen(layer, view, wid, onCanvas ? [piece.x + 1 + view.ox, piece.y + 1 + view.oy] : null)
  // Too small on the screen to read a cell (zoomed out, a big one fitted): every cell a square on one canvas instead.
  const far = useCanvasView((s) => {
    const z = s.cams[wid]?.zoom ?? 1
    return M.cell * (onCanvas ? z : live || still ? view.zoom : view.zoom * z) < FAR_PX
  })
  // Its screen px per its own: for the marks inside it (D-265), set once on its world so the cells needn't draw again.
  const screen = useCanvasView((s) => (onCanvas || !(live || still) ? (s.cams[wid]?.zoom ?? 1) : 1) * view.zoom)
  const [r0, r1] = within(seen.y0, seen.y1, M.top + M.gap, M.row + M.gap, M.row, rows.length)
  const [c0, c1] = within(seen.x0, seen.x1, M.head + M.gap, M.cell + M.gap, M.cell, cols.length)
  const cellsShown = useMemo(() => {
    if (far) return null
    const cellAt = (ri: number, ci: number) => {
      const r = rows[ri]
      const c = cols[ci]
      const key = selKey(piece.id, r.key, c.key)
      return (
        <CellBox
          key={key}
          id={key}
          r={ri}
          c={ci}
          x={L.colX(ci)}
          y={L.rowY(ri)}
          setup={setup}
          cell={shownAt(r, c)}
          label={`${r.name || 'untitled'} × ${c.name || 'untitled'}`}
          selected={sr === ri && sc === ci}
          hot={hotStore}
          live={live}
          typing={typing === key}
          canType={editor && setup.cell !== 'scale' && !(r.subs || c.subs)}
          acts={acts}
        />
      )
    }
    const out = []
    for (let ri = r0; ri < r1; ri++) for (let ci = c0; ci < c1; ci++) out.push(cellAt(ri, ci))
    if (sr !== undefined && sc !== undefined && !(sr >= r0 && sr < r1 && sc >= c0 && sc < c1)) out.push(cellAt(sr, sc))
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols, byKey, setup, sr, sc, typing, live, editor, piece.id, hotStore, r0, r1, c0, c1, far])
  const endsShown = useMemo(
    () =>
      L.ends && (
        <>
          {rows.map((r, i) => (
            <div key={r.key} className={styles.endCell} data-sub={r.parent ? true : undefined} style={box(L.endX, L.rowY(i), M.end, M.row)}>
              <Totals setup={setup} reading={readingOf(setup, rowCells(r))} wide />
            </div>
          ))}
          {cols.map((c, i) => (
            <div key={c.key} className={styles.endCell} data-row data-sub={c.parent ? true : undefined} style={box(L.colX(i), L.endY, M.cell, M.endRow)}>
              <Totals setup={setup} reading={readingOf(setup, colCells(c))} />
            </div>
          ))}
        </>
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, cols, byKey, setup],
  )
  const rowHeads = useMemo(
    () =>
      rows.map((r, i) => (
        <Head key={r.key} entry={r} which="rows" style={box(0, L.rowY(i), M.head, M.row)} at={i} hot={hotStore} lit={selected?.r === i} chosen={!!r.card && !r.parent && picked === r.card.id} live={live} editor={editor} naming={naming === r.item?.id}
          onRename={(name) => (r.sub ? renameSub(r, name) : void renameEntry(wid, piece.id, setup, 'rows', r.item!.id, name))} onRemove={() => remove('rows', r)} onPress={own} onPick={live && r.card ? () => pick(r.card!) : undefined}
          open={r.subs ? { shown: !!setup.rows.open?.includes(r.key), open: r.subs.filter((k) => openOf('rows', k)).length, toggle: (v) => fold('rows', r, v) } : undefined}
          isOpen={r.sub ? openOf('rows', r.key) : undefined}>
          {heads && <Totals setup={setup} reading={readingOf(setup, rowCells(r))} />}
        </Head>
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, cols, byKey, mine, setup, sr, picked, live, editor, naming, piece.id, wid, hotStore],
  )
  const colHeads = useMemo(
    () =>
      cols.map((c, i) => (
        <Head key={c.key} entry={c} which="cols" style={box(L.colX(i), 0, M.cell, M.top)} at={i} hot={hotStore} lit={selected?.c === i} chosen={!!c.card && !c.parent && picked === c.card.id} live={live} editor={editor} naming={naming === c.item?.id}
          onRename={(name) => (c.sub ? renameSub(c, name) : void renameEntry(wid, piece.id, setup, 'cols', c.item!.id, name))} onRemove={() => remove('cols', c)} onPress={own} onPick={live && c.card ? () => pick(c.card!) : undefined}
          open={c.subs ? { shown: !!setup.cols.open?.includes(c.key), open: c.subs.filter((k) => openOf('cols', k)).length, toggle: (v) => fold('cols', c, v) } : undefined}
          isOpen={c.sub ? openOf('cols', c.key) : undefined}>
          {heads && <Totals setup={setup} reading={readingOf(setup, colCells(c))} />}
        </Head>
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, cols, byKey, mine, setup, sc, picked, live, editor, naming, piece.id, wid, hotStore],
  )

  const selBox = selected ? { x: L.colX(selected.c), y: L.rowY(selected.r) } : null
  // How far the heads are held in from where they'd be, in the matrix's px; never past its last row or column.
  const fitted = fitInto({ x: 0, y: 0, w: L.w, h: L.h }, room.w, room.h, FIT_PAD)
  const stickTop = Math.min(STICK.top, Math.max(0, room.h / 2 - (L.h / 2) * fitted.zoom))
  const stickLeft = Math.min(STICK.left, Math.max(0, room.w / 2 - (L.w / 2) * fitted.zoom))
  const stick = (live || still) && !onCanvas
  const dy = stick ? Math.min(Math.max(0, (stickTop - view.oy) / view.zoom), Math.max(0, L.addY - M.top)) : 0
  const dx = stick ? Math.min(Math.max(0, (stickLeft - view.ox) / view.zoom), Math.max(0, L.addX - M.head)) : 0
  const added = (which: 'rows' | 'cols') => (centre.current = which)
  const main = live && useCanvasView.getState().planeCam === view
  // While the row heads are held at the left, the side nav's shade steps aside so it doesn't dim them.
  const held = main && dx > 0
  useEffect(() => {
    if (!held) return
    document.documentElement.dataset.heldHeads = ''
    return () => void delete document.documentElement.dataset.heldHeads
  }, [held])

  return (
    <div ref={layer} className={styles.layer} data-live={live || undefined} data-on-canvas={onCanvas || undefined}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})`, ...zsOf(screen) }}>
        <div className={styles.table} style={{ width: L.w, height: L.h }} role="grid" aria-label={piece.name || 'matrix'} onPointerLeave={() => setHot(null)}>
          {cellsShown}
          {far && <CellDots setup={setup} rows={rows} cols={cols} cellAt={shownAt} L={L} live={live} acts={acts} />}

          {/* The totals at the ends: a column after the cells, a row under them. */}
          {endsShown}

          {/* The row heads, and what closes their column, held in from the left when panned past (D-214). */}
          <div className={styles.stick} data-stuck={dx > 0 || undefined} style={{ width: L.w, height: L.h, transform: `translateX(${dx}px)`, clipPath: `inset(${dy + M.top}px -10000px -10000px -10000px)` }}>
            {/* Paper under them out to the screen's edge, so the cells pass under. */}
            {dx > 0 && <div className={styles.band} style={box(-stickLeft / view.zoom, -stickTop / view.zoom, stickLeft / view.zoom + M.head + M.gap, L.h + stickTop / view.zoom)} />}
            {rowHeads}
            {L.ends && (
              <div className={styles.endHead} data-row style={box(0, L.endY, M.head, M.endRow)}>
                total
              </div>
            )}
            {live && editor && <AddEntry which="rows" label={oneOf(setup.rows, 'rows')} style={box(0, L.addY, M.head, M.row)} piece={piece} setup={setup} shown={shown} onPress={own} onAdded={added} />}
          </div>
          {/* The column heads, held in from the top. */}
          {/* Each layer cut where the other's heads begin, so neither shows past the corner. */}
          <div className={styles.stick} data-stuck={dy > 0 || undefined} style={{ width: L.w, height: L.h, transform: `translateY(${dy}px)`, clipPath: `inset(-10000px -10000px -10000px ${dx + M.head}px)` }}>
            {dy > 0 && <div className={styles.band} style={box(-stickLeft / view.zoom, -stickTop / view.zoom, L.w + stickLeft / view.zoom, stickTop / view.zoom + M.top + M.gap)} />}
            {colHeads}
            {L.ends && (
              <div className={styles.endHead} style={box(L.endX, 0, M.end, M.top)}>
                total
              </div>
            )}
            {live && editor && <AddEntry which="cols" label={oneOf(setup.cols, 'cols')} style={box(L.addX, 0, M.cell, M.top)} piece={piece} setup={setup} shown={shown} onPress={own} onAdded={added} />}
          </div>
          {/* The corner, held in both ways, over both. */}
          <div className={styles.stick} style={{ width: L.w, height: L.h, transform: `translate(${dx}px, ${dy}px)` }}>
            {(dx > 0 || dy > 0) && <div className={styles.band} style={box(-stickLeft / view.zoom, -stickTop / view.zoom, stickLeft / view.zoom + M.head + M.gap, stickTop / view.zoom + M.top + M.gap)} />}
            <div className={styles.corner} data-stuck={dx > 0 || dy > 0 || undefined} style={box(0, 0, M.head, M.top)}>
              <span>{nounOf(setup.rows)}</span>
              <span className={styles.cross}>×</span>
              <span>{nounOf(setup.cols)}</span>
            </div>
          </div>
          {!rows.length && !cols.length && !(live && editor) && (
            <p className={styles.empty} style={box(0, M.top, L.w, M.row * 2)}>
              Nothing to cross yet
            </p>
          )}
        </div>
      </div>
      {/* Not while the cell is under the held heads. */}
      {live && !far && selected && selBox && !((dx > 0 && selBox.x < dx + M.head) || (dy > 0 && selBox.y < dy + M.top)) && (
        <CellBar
          key={selKey(piece.id, rows[selected.r].key, cols[selected.c].key)}
          setup={setup}
          cell={shownAt(rows[selected.r], cols[selected.c])}
          row={rows[selected.r]}
          col={cols[selected.c]}
          editor={editor}
          onFold={(() => {
            const r = rows[selected.r]
            const c = cols[selected.c]
            const which = r.subs ? 'rows' : c.subs ? 'cols' : null
            if (!which || !editor) return undefined
            const e = which === 'rows' ? r : c
            const shown = !!setup[which].open?.includes(e.key)
            return { shown, toggle: () => fold(which, e, !shown) }
          })()}
          // Under the cell, at screen size, kept on the screen.
          at={[view.ox + selBox.x * view.zoom, view.oy + (selBox.y + M.row) * view.zoom]}
          // On the canvas (D-228) it's counter-scaled in CSS and not kept in: the canvas pans.
          room={onCanvas ? 0 : (layer.current?.clientWidth ?? 0)}
          write={(fields) => write(rows[selected.r].key, cols[selected.c].key, fields)}
          onType={() => setTyping(selKey(piece.id, rows[selected.r].key, cols[selected.c].key))}
        />
      )}
    </div>
  )
}

type HeadProps = {
  entry: Entry
  which: 'rows' | 'cols'
  style: CSSProperties
  // Its index on its axis, and the hovered cell: its row's or column's head lights; `lit`, its row's or column's cell is
  // selected; `chosen`, its card's panel is open from it (D-247): its marks (D-265).
  at: number
  hot: HotStore
  lit: boolean
  chosen: boolean
  live: boolean
  editor: boolean
  naming: boolean
  onRename: (name: string) => void
  onRemove: () => void
  onPress?: (e: ReactPointerEvent) => void
  // A card's head: a click opens its panel (not through its `×`, nor while it's being named).
  onPick?: () => void
  // A card that unfolds (D-249): shown open or not, how many of its parts nobody meets, the switch.
  open?: { shown: boolean; open: number; toggle: (open: boolean) => void }
  // What a card unfolded into: whether nobody meets it.
  isOpen?: boolean
  children?: ReactNode
}

// A row's or a column's head: a card's (its title, its type's colour down the left, as on a plane), or a typed name in
// mono over a dashed rule (a double-click renames it). Its totals under the name (a column's) or at its end (a row's).
// What a card unfolded into (D-249) is a step in under it, numbered, in mono, `◇` when nobody meets it; renamed by a
// double-click (on the card), never taken out here; a click opens the card's panel.
function Head({ entry, which, style, at, hot: hotStore, lit, chosen, live, editor, naming, onRename, onRemove, onPress, onPick, open: unfold, isOpen, children }: HeadProps) {
  const hot = hotStore((s) => !!s.at && (which === 'rows' ? s.at.r : s.at.c) === at) || lit || chosen
  const [editing, setEditing] = useState(false)
  const sub = !!entry.sub
  const typed = !entry.card || sub
  const open = (editing || naming) && typed && live && editor
  const tone = entry.card ? TYPE_ACCENT[entry.card.type] : undefined
  // Others who have its card selected, wherever (D-265): their L's on its head.
  const peers = usePeersOn(entry.card && !sub ? entry.card.id : '')
  return (
    <div
      className={which === 'rows' ? styles.rowHead : styles.colHead}
      style={{ ...style, ...(tone ? { ['--type' as string]: tone } : {}) }}
      data-card={entry.card && !sub ? true : undefined}
      data-sub={sub || undefined}
      data-find-box
      // A long one set smaller, so more of it fits (D-216).
      data-long={(entry.name?.length ?? 0) > (which === 'rows' ? 40 : 30) || undefined}
      data-hot={hot || undefined}
      title={entry.name || undefined}
      data-pick={onPick ? true : undefined}
      onPointerDown={onPress}
      onClick={onPick && !open ? (e) => !(e.target as HTMLElement).closest('button') && onPick() : undefined}
      onDoubleClick={live && editor && typed ? () => setEditing(true) : undefined}
    >
      {open ? (
        <input
          className={styles.nameField}
          autoFocus
          aria-label={which === 'rows' ? 'Row name' : 'Column name'}
          defaultValue={entry.name}
          maxLength={NAME_MAX}
          placeholder={sub ? 'what it is judged on' : 'name'}
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
        <>
          {sub && (
            <span className={styles.subN} aria-hidden>
              {entry.n}
            </span>
          )}
          <span className={styles.name} data-unnamed={!entry.name || undefined} data-find={`${which}|${entry.key}`}>
            {entry.name || (sub ? 'unnamed' : entry.card ? `untitled ${entry.card.type}` : 'name')}
          </span>
          {sub && isOpen && (
            <span className={styles.openMark} title="nobody meets it: white space">
              ◇
            </span>
          )}
        </>
      )}
      {children}
      <Marks tier="s" tone={tone} live={!!onPick} selected={chosen} peers={live ? peers : undefined} />
      {unfold && (
        <span className={styles.unfold}>
          {unfold.open > 0 && (
            <span className={styles.openMark} title={`${unfold.open} of what it's judged on nobody meets: white space`}>
              ◇ {unfold.open} open
            </span>
          )}
          <button
            className={styles.fold}
            disabled={!(live && editor)}
            aria-expanded={unfold.shown}
            title={unfold.shown ? 'fold what it is judged on into its cells' : 'unfold what it is judged on, to score each'}
            onClick={(e) => (e.stopPropagation(), unfold.toggle(!unfold.shown))}
          >
            {unfold.shown ? '[−]' : `[+] ${entry.subs!.length}`}
          </button>
        </span>
      )}
      {live && editor && !open && !sub && (
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
  onAdded?: (which: 'rows' | 'cols') => void
}

// The dashed card that closes an axis (D-212): click, type a name and Enter (the field stays for the next), or pick one
// of the cards that match; Escape or leaving it closes it.
function AddEntry({ which, label, style, piece, setup, shown, onPress, onAdded }: AddProps) {
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
          if (e.key === 'Enter' && q.trim()) {
            // Before the write: the local copy shows it before the promise settles.
            onAdded?.(which)
            void addNamed(wid, piece.id, setup, which, q.trim()).then(done)
          }
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
            <button key={c.id} role="option" aria-selected={false} className={styles.pick} style={{ ['--type' as string]: TYPE_ACCENT[c.type] }} onClick={() => (onAdded?.(which), void addCardEntry(wid, piece.id, setup, which, c).then(done))}>
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

// A cell narrower than this on the screen isn't read: the cells are drawn as squares on one canvas (CellDots).
const FAR_PX = 22
// The most a side of that canvas takes, in device px.
const DOTS_MAX = 4096

type DotsProps = {
  setup: MatrixSetup
  rows: Entry[]
  cols: Entry[]
  cellAt: (r: Entry, c: Entry) => Cell | undefined
  L: ReturnType<typeof layout>
  live: boolean
  acts: RefObject<CellActs>
}

// Far out, every cell as a square in its place on one canvas, not thousands of elements: its paper, and a set step in
// its colour (fuller the higher it is), a number or a text a grey mark, `doesn't apply` left empty. Drawn again when the
// cells or the theme change, at a resolution of whole powers of two of what the screen shows. A click picks the cell
// under it (selected, so its bar opens once it's near enough to read).
function CellDots({ setup, rows, cols, cellAt, L, live, acts }: DotsProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const theme = useTheme((s) => s.theme)
  const res = Math.min(1, DOTS_MAX / Math.max(1, L.w), DOTS_MAX / Math.max(1, L.h))
  useEffect(() => {
    const el = ref.current
    const g = el?.getContext('2d')
    if (!el || !g) return
    el.width = Math.ceil(L.w * res)
    el.height = Math.ceil(L.h * res)
    const css = getComputedStyle(el)
    const color = (v: string) => css.getPropertyValue(v.slice(4, -1)).trim() || '#888'
    const paper = color('var(--wash-2)')
    const mark = color('var(--fg-dim)')
    const tones = new Map(setup.steps.map((st) => [st.id, color(TONE_VAR[st.tone])]))
    g.setTransform(res, 0, 0, res, 0, 0)
    for (let ri = 0; ri < rows.length; ri++) {
      const y = L.rowY(ri)
      for (let ci = 0; ci < cols.length; ci++) {
        const x = L.colX(ci)
        const cell = cellAt(rows[ri], cols[ci])
        if (setup.notRelevant && !relevant(cell)) continue
        g.fillStyle = paper
        g.fillRect(x, y, M.cell, M.row)
        const read = readCell(setup, cell)
        if (read.step) {
          const i = setup.steps.indexOf(read.step)
          g.globalAlpha = 0.45 + 0.55 * (setup.steps.length > 1 ? i / (setup.steps.length - 1) : 1)
          g.fillStyle = tones.get(read.step.id) ?? mark
          g.fillRect(x + 10, y + 6, M.cell - 20, M.row - 12)
          g.globalAlpha = 1
        } else if (read.number !== undefined || read.text) {
          g.fillStyle = mark
          g.fillRect(x + 24, y + M.row / 2 - 3, M.cell - 48, 6)
        }
      }
    }
    // L follows rows, cols and setup; cellAt the cells.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, rows, cols, cellAt, res, theme])
  const pick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * L.w
    const y = ((e.clientY - r.top) / r.height) * L.h
    const ci = Math.floor((x - M.head - M.gap) / (M.cell + M.gap))
    const ri = Math.floor((y - M.top - M.gap) / (M.row + M.gap))
    if (ri >= 0 && ri < rows.length && ci >= 0 && ci < cols.length) acts.current.click(ri, ci)
  }
  return <canvas ref={ref} className={styles.dots} style={{ width: L.w, height: L.h }} data-cell="far" onClick={live ? pick : undefined} aria-hidden />
}

// The cell under the pointer: its row and column light up.
type Hot = { r: number; c: number } | null
const newHot = () => create<{ at: Hot }>(() => ({ at: null }))
type HotStore = ReturnType<typeof newHot>

type CellActs = {
  hover: (r: number, c: number, e: ReactPointerEvent) => void
  click: (r: number, c: number) => void
  type: (r: number, c: number) => void
  typed: (r: number, c: number, value: string | number | undefined | null) => void
}

type CellProps = {
  id: string
  // Its row and column, and where it is in the matrix's px.
  r: number
  c: number
  x: number
  y: number
  setup: MatrixSetup
  cell: Shown | undefined
  label: string
  selected: boolean
  hot: HotStore
  live: boolean
  typing: boolean
  canType: boolean
  acts: RefObject<CellActs>
}

// What a cell reads: — left out, a step (its square or glyph), a number, a text, or an empty outline; a folded corner
// when it has a note, `~` / `?` in the other corner when it's not sure. Neither moves what's in the middle.
const CellBox = memo(function CellBox({ id, r, c, x, y, setup, cell, label, selected, hot: hotStore, live, typing, canType, acts }: CellProps) {
  const hot = hotStore((s) => !!s.at && (s.at.r === r || s.at.c === c))
  const style: CSSProperties = { left: x, top: y, width: M.cell, height: M.row }
  const onTyped = (value: string | number | undefined | null) => acts.current.typed(r, c, value)
  const out = setup.notRelevant && !relevant(cell)
  const read = out ? {} : readCell(setup, cell)
  const sure = !out && setup.confidence && cell?.confidence ? CONFIDENCE_MARK[cell.confidence] : ''
  const tone = read.step ? TONE_VAR[read.step.tone] : undefined
  const said = out ? "doesn't apply" : read.step?.label ?? (read.number !== undefined ? fmt(read.number) : read.text) ?? 'empty'
  // A card's cell read from its parts (D-249): one small square each, as D-133's blocks; its own value while none is set.
  const parts = !out && setup.cell === 'scale' && cell?.parts && (cell.rolled || !read.step) ? cell.parts : undefined
  if (typing)
    return (
      <div className={styles.cell} style={style} data-selected>
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
        <Marks tier="s" selected />
      </div>
    )
  return (
    <button
      className={styles.cell}
      style={{ ...style, ...(tone ? { ['--tone' as string]: tone } : {}) }}
      data-cell={id}
      data-find={id}
      data-find-box
      data-selected={selected || undefined}
      data-hot={hot || undefined}
      tabIndex={live ? 0 : -1}
      aria-label={`${label}: ${said}${parts ? `, read from ${parts.length}` : ''}${sure ? `, ${cell!.confidence}` : ''}${cell?.notes ? ', has a note' : ''}`}
      title={cell?.notes ? cell.notes.slice(0, 200) : undefined}
      onPointerEnter={live ? (e) => acts.current.hover(r, c, e) : undefined}
      onClick={live ? () => acts.current.click(r, c) : undefined}
      onDoubleClick={live && canType ? () => acts.current.type(r, c) : undefined}
    >
      {out ? (
        <span className={styles.out} aria-hidden />
      ) : parts ? (
        <PartSquares setup={setup} parts={parts} />
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
      <Marks tier="s" live={live} selected={selected} />
    </button>
  )
})

// What a card's cell is read from, a square each in its step's colour, filled to it; unset an outline, left out a dash.
function PartSquares({ setup, parts }: { setup: MatrixSetup; parts: (Shown | undefined)[] }) {
  return (
    <span className={styles.parts} aria-hidden>
      {parts.map((p, i) => {
        if (setup.notRelevant && !relevant(p)) return <i key={i} data-out />
        const step = readCell(setup, p).step
        if (!step) return <i key={i} data-empty />
        const k = setup.steps.indexOf(step)
        const fill = setup.steps.length > 1 ? (k / (setup.steps.length - 1)) * 100 : 100
        return <i key={i} style={{ ['--tone' as string]: TONE_VAR[step.tone], ['--fill' as string]: `${fill}%` }} />
      })}
    </span>
  )
}

type BarProps = {
  setup: MatrixSetup
  cell: Shown | undefined
  row: Entry
  col: Entry
  editor: boolean
  // A card's cell read from its parts: unfold them to score each (D-249).
  onFold?: { shown: boolean; toggle: () => void }
  at: [number, number]
  room: number
  write: (fields: Parameters<typeof setCell>[4]) => void
  onType: () => void
}

// The selected cell's bar, at screen size under it, kept inside the screen: where it is, then its value (the steps, or
// `[type]`), `doesn't apply`, how sure, and its note.
function CellBar({ setup, cell, row, col, editor, onFold, at, room, write, onType }: BarProps) {
  const out = setup.notRelevant && !relevant(cell)
  const read = readCell(setup, cell)
  const rolled = !!cell?.rolled
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
      {cell?.parts && (
        <div className={styles.barRow}>
          <span className={styles.barNote}>
            {rolled ? `${read.step?.label ?? (read.number !== undefined ? fmt(read.number) : '')} · ` : ''}read from what it's judged on, {cell.parts.length}
          </span>
          {onFold && (
            <button className={styles.tool} onClick={onFold.toggle}>
              {onFold.shown ? 'fold' : 'unfold to score'}
            </button>
          )}
        </div>
      )}
      {!out && !rolled && setup.cell === 'scale' && (
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
      {!out && !rolled && !cell?.parts && setup.cell !== 'scale' && editor && (
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
