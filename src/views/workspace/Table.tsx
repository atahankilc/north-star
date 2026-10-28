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
import { addNamedRow, CHECKED, COL_W, colName, DEFAULT_STEPS, emptyTable, NAME_COL, PAGE_SIZES, readOwn, removeRow, renameRow, setColumnWidth, setTablePart, type Column, type TableSetup } from '../../data/table'
import { kindOfPiece } from '../../data/pieces'
import { glide, useCanvasView, type Bounds, type PlaneCam } from '../../state/canvasView'
import { Select } from '../../ui/Select'
import { useWs } from './context'
import { useSeen, within } from './visible'
import { TYPE_ACCENT } from './PlaneCards'
import type { FindItem } from './find'
import { usePeersOn } from './collab'
import { Marks, useSettledZoom, zsIn } from '../../ui/Marks'
import styles from './Table.module.css'

// Its parts in its own px: the head, a row, the name column, the `+` column and row.
export const T = { head: 40, row: 32, name: 260, add: 40 }

const FIELD_W: Record<string, number> = { type: 100, plane: 140, status: 120, tags: 180, regions: 160, priority: 90, impact: 90, effort: 90, evidence: 90 }
const OWN_W: Record<string, number> = { scale: 90, number: 110, text: 220, check: 70 }
export const widthOf = (c: Column) => c.width ?? (c.field ? FIELD_W[c.field] : OWN_W[c.kind ?? 'text']) ?? 120
export const nameWidth = (s: TableSetup) => s.nameWidth ?? T.name

const NO_SETUP = emptyTable()
export const tableOf = (p: Pick<Piece, 'table'>): TableSetup => p.table ?? NO_SETUP

// The box round a table's rows and columns, in its px: what fit frames.
export function tableBounds(piece: Pick<Piece, 'table'>, cards: Card[]): Bounds {
  const setup = tableOf(piece)
  const w = nameWidth(setup) + setup.cols.reduce((s, c) => s + widthOf(c), 0) + T.add
  const n = rowsOf(setup.rows, cards, !setup.manual).length
  // A page's worth when it's paged (D-213): fit frames the page.
  return { x: 0, y: 0, w, h: T.head + Math.max(setup.pageSize ? Math.min(n, setup.pageSize) : n, 1) * T.row + T.add }
}

// The table whose setup is open (from the focus dock's or its pane's `[setup]`, D-211); a typed row being named; the page
// each table is on here (D-213: yours, not shared); a table you just added a row or column to, which its view follows.
export const useTableUi = create<{
  setup: string | null
  tab: TableTab
  naming: string | null
  pages: Record<string, number>
  wizard: boolean
  follow: { piece: string; at: number } | null
}>(() => ({
  setup: null,
  tab: 'rows',
  naming: null,
  pages: {},
  wizard: false,
  follow: null,
}))

// A row or column about to be added here: when it comes in, the table's view glides to it, as the matrix's (D-214).
export const followTable = (piece: string) => useTableUi.setState({ follow: { piece, at: Date.now() } })
const FOLLOW_MS = 4000
// How far down the screen a followed column's head comes to, clear of the breadcrumb.
const HEAD_IN = 64

// The setup's tabs (D-218), as the matrix's (D-212); the wizard makes a new table.
export const TABLE_TABS = ['rows', 'cols', 'view'] as const
export type TableTab = (typeof TABLE_TABS)[number]

// Its pages (D-213): how many, and the one this table is on, kept in range.
export function pagesOf(setup: TableSetup, count: number, page: number | undefined) {
  const size = setup.pageSize
  const pages = size ? Math.max(1, Math.ceil(count / size)) : 1
  const at = Math.min(pages - 1, Math.max(0, page ?? 0))
  return { size, pages, at, from: size ? at * size : 0, to: size ? Math.min(count, (at + 1) * size) : count }
}

// The selected cell rides on the canvas's card selection (D-187), so Escape and leaving focus let go of it as of a card.
// The table's id in it: more than one can be live at once (open on the canvas, D-228; stacked beside a plane, D-211).
const CELL = 'tcell|'
const selKey = (piece: string, row: string, col: string) => `${CELL}${piece}|${row}|${col}`
const parseSel = (piece: string, s: string | null) => (s?.startsWith(`${CELL}${piece}|`) ? (s.slice(CELL.length + piece.length + 1).split('|') as [string, string]) : null)

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

// What a row reads in a column, as text: for a card's field, and for sorting.
export type FieldText = (row: Row, field: NonNullable<Column['field']>) => string
export function useFieldText(): FieldText {
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
          // Every plane it's on, its home first (D-281).
          return (c.planes ?? [c.pieceId]).map((p) => planeName.get(p) ?? '').filter(Boolean).join(', ')
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

// A table's rows, in its source's order or sorted by a column (empty ones last, whichever way).
export function tableRows(setup: TableSetup, cards: Card[], fieldText: FieldText, byKey: Map<string, Cell>): Row[] {
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
}

// What find looks through in a table (D-236): its heads, then each row's name and cells, on every page, in reading
// order, each with its box in the table's px and its page.
export function tableFindItems(piece: WithId<Piece>, cards: Card[], cells: Cell[], fieldText: FieldText): FindItem[] {
  const setup = tableOf(piece)
  const byKey = new Map(cells.filter((c) => c.matrixId === piece.id).map((c) => [`${c.row}|${c.col}`, c]))
  const cols = setup.cols
  const nameW = nameWidth(setup)
  const ws = cols.map(widthOf)
  const xs = ws.reduce<number[]>((out, _, i) => [...out, i ? out[i - 1] + ws[i - 1] : nameW], [])
  const out: FindItem[] = cols.map((c, i) => ({ key: `h|${c.id}`, text: colName(c), box: { x: xs[i], y: 0, w: ws[i], h: T.head } }))
  const size = setup.pageSize
  tableRows(setup, cards, fieldText, byKey).forEach((r, i) => {
    const page = size ? Math.floor(i / size) : undefined
    const y = T.head + (i - (page ?? 0) * (size ?? 0)) * T.row
    out.push({ key: `n|${r.key}`, text: r.name, box: { x: 0, y, w: nameW, h: T.row }, page })
    cols.forEach((c, ci) => {
      const v = c.field ? null : readOwn(c, byKey.get(`${r.key}|${c.id}`))
      const text = c.field ? fieldText(r, c.field) : (v!.step?.label ?? (v!.number !== undefined ? fmt(v!.number) : v!.text) ?? '')
      out.push({ key: selKey(piece.id, r.key, c.id), text, box: { x: xs[ci], y, w: ws[ci], h: T.row }, page })
    })
  })
  return out
}

// `onCard`: a card's row name clicked, beside its plane (D-211): the plane goes to the card. `onView`: a pane's own view
// moved (beside a plane); without it, the focus's. `onCanvas`: live on the canvas itself, opened there (D-228): nothing
// cut at its edge.
// `page`: this page rather than the one it's on here (the finder's preview, D-236).
type Props = { piece: WithId<Piece>; view: PlaneCam; live: boolean; editor: boolean; onCard?: (card: Card) => void; onView?: (v: PlaneCam) => void; onCanvas?: boolean; page?: number }

export function TableView({ piece, view, live, editor, onCard, onView, onCanvas = false, page: pageAt }: Props) {
  const { wid, cards, cells } = useWs()
  // Marks and chips at screen size take the zoom once it settles (D-278): a wheel step restyles none of them.
  const settled = useSettledZoom(view.zoom, live)
  const setup = tableOf(piece)
  const fieldText = useFieldText()
  const mine = useMemo(() => cells.filter((c) => c.matrixId === piece.id), [cells, piece.id])
  const byKey = useMemo(() => new Map(mine.map((c) => [`${c.row}|${c.col}`, c])), [mine])
  const at = (row: string, col: string) => byKey.get(`${row}|${col}`)
  // The rows, in the source's order or sorted by a column.
  const all = useMemo(() => tableRows(setup, cards, fieldText, byKey), [setup, cards, fieldText, byKey])
  // The page shown (D-213); the rest wait on their pages.
  const myPage = useTableUi((s) => s.pages[piece.id])
  const page = pagesOf(setup, all.length, pageAt ?? myPage)
  const rows = useMemo(() => all.slice(page.from, page.to), [all, page.from, page.to])

  const cols = setup.cols
  // A column's right edge being dragged: its width shown while it moves, written once let go.
  const [sizing, setSizing] = useState<{ col: string; w: number } | null>(null)
  const nameW = sizing?.col === NAME_COL ? sizing.w : nameWidth(setup)
  const wOf = (c: Column) => (sizing?.col === c.id ? sizing.w : widthOf(c))
  const ws = cols.map(wOf)
  const xs = ws.reduce<number[]>((out, _, i) => [...out, i ? out[i - 1] + ws[i - 1] : nameW], [])
  const width = nameW + ws.reduce((s, w) => s + w, 0)
  const sel = parseSel(piece.id, useCanvasView((s) => (live ? s.cardSelected : null)))
  // A card selected (on the plane beside it, D-211, or from its row): its row lit.
  const lit = useCanvasView((s) => (live ? s.cardSelected : null))
  // A card's row name clicked: beside its plane the plane goes to it; either way the card's selected, its panel open as
  // on its plane (LensCardPanel).
  const pick = onCard ?? ((card: Card) => useCanvasView.setState({ cardSelected: card.id, labelSelected: null }))
  const ri = sel ? rows.findIndex((r) => r.key === sel[0]) : -1
  const ci = sel ? cols.findIndex((c) => c.id === sel[1]) : -1
  const selected = ri >= 0 && ci >= 0 ? { r: ri, c: ci } : null
  const [typing, setTyping] = useState<string | null>(null)
  const naming = useTableUi((s) => s.naming)
  const layer = useRef<HTMLDivElement>(null)

  const write = (row: string, col: string, value: Cell['value']) => void setCell(wid, piece.id, row, col, { value })
  const select = (r: number, c: number) => useCanvasView.setState({ cardSelected: selKey(piece.id, rows[r].key, cols[c].id), labelSelected: null })
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
  // A row or column you just added (followTable): the view glides to bring it to the middle, a row up or down (its page
  // turned to if it's on another), a column across. Others' adds don't move you.
  const seen = useRef<{ rows: Set<string>; cols: Set<string> } | null>(null)
  const rowKeys = all.map((r) => r.key).join('|')
  const colIds = cols.map((c) => c.id).join('|')
  useEffect(() => {
    const was = seen.current
    seen.current = { rows: new Set(all.map((r) => r.key)), cols: new Set(cols.map((c) => c.id)) }
    const f = useTableUi.getState().follow
    const el = layer.current
    if (!was || !el || !live || f?.piece !== piece.id || Date.now() - f.at > FOLLOW_MS) return
    const move = onView ?? (useCanvasView.getState().planeCam === view ? (v: PlaneCam) => useCanvasView.setState({ planeCam: v }) : null)
    const ri = all.findIndex((r) => !was.rows.has(r.key))
    const ci = cols.findIndex((c) => !was.cols.has(c.id))
    if (!move || (ri < 0 && ci < 0)) return
    useTableUi.setState({ follow: null })
    let to = view
    if (ri >= 0) {
      const at = setup.pageSize ? Math.floor(ri / setup.pageSize) : 0
      if (at !== page.at) useTableUi.setState((s) => ({ pages: { ...s.pages, [piece.id]: at } }))
      const y = T.head + (ri - at * (setup.pageSize ?? 0)) * T.row + T.row / 2
      to = { ...to, oy: el.clientHeight / 2 - y * view.zoom }
    }
    // A column across to the middle, its head brought down into sight if it's above (the setup sits over the middle).
    if (ci >= 0) to = { ...to, ox: el.clientWidth / 2 - (xs[ci] + ws[ci] / 2) * view.zoom, oy: Math.max(to.oy, HEAD_IN) }
    glide(view, to, 420, move)
    // When one comes in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKeys, colIds])

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
      return layer.current?.querySelector<HTMLElement>(`[data-cell="${selKey(piece.id, rows[r].key, cols[c].id)}"]`)?.focus()
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
      setTyping(selKey(piece.id, row, col.id))
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
  // What's drawn of its rows and heads, made again only when they, the selection, what's typed or a width change, not
  // as its view moves (in focus every pan and zoom). The grips follow the zoom, so they're made every time.
  const sr = selected?.r
  const sc = selected?.c
  // Only the rows on the screen (and a block round it), and the selected one wherever it is, so the keys can move to it.
  const onScreen = useSeen(layer, view, wid, onCanvas ? [piece.x + 1 + view.ox, piece.y + 1 + view.oy] : null)
  const [r0, r1] = within(onScreen.y0, onScreen.y1, T.head, T.row, T.row, rows.length)
  const seenRows = useMemo(() => {
    const out = rows.slice(r0, r1).map((r, k) => [r, r0 + k] as const)
    if (sr !== undefined && (sr < r0 || sr >= r1)) out.push([rows[sr], sr])
    return out
  }, [rows, r0, r1, sr])
  const widths = ws.join(',')
  const headsShown = useMemo(
    () => (
      <>
        {seenRows.map(([r, i]) => (
          <div key={r.key} className={styles.band} data-selected={selected?.r === i || undefined} style={box(0, T.head + i * T.row, width, T.row)}>
            {r.card && <Marks tier="s" tone={TYPE_ACCENT[r.card.type]} live={false} selected={lit === r.key} />}
          </div>
        ))}
        <div className={styles.headRule} style={box(0, T.head - 1, width, 1)} />

        <button className={styles.head} data-name style={box(0, 0, nameW, T.head)} onPointerDown={own} onClick={() => sortBy(NAME_COL)} tabIndex={live ? 0 : -1} title={live && editor ? 'sort by it' : undefined}>
          {setup.manual ? 'name' : 'title'}
          <span className={styles.arrow}>{arrow(NAME_COL)}</span>
        </button>
        {cols.map((c, i) => (
          <button
            key={c.id}
            className={styles.head}
            data-own={c.field ? undefined : true}
            data-find-box
            style={box(xs[i], 0, ws[i], T.head)}
            onPointerDown={own}
            onClick={() => sortBy(c.id)}
            tabIndex={live ? 0 : -1}
            title={live && editor ? 'sort by it' : undefined}
          >
            <span className={styles.headName} data-find={`h|${c.id}`}>{colName(c)}</span>
            {c.kind === 'number' && c.unit && <span className={styles.unit}>{c.unit}</span>}
            <span className={styles.arrow}>{arrow(c.id)}</span>
          </button>
        ))}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seenRows, cols, setup, sr, live, editor, lit, nameW, widths],
  )
  const rowsShown = useMemo(
    () => (
      <>
        {seenRows.map(([r, ri]) => (
          <NameCell
            key={r.key}
            row={r}
            style={box(0, T.head + ri * T.row, nameW, T.row)}
            live={live}
            editor={editor}
            naming={naming === r.item?.id}
            onPress={own}
            onRename={(name) => {
              if (r.card) void retitleCard(wid, r.card, name)
              else if (r.item) void renameRow(wid, piece.id, setup, r.item.id, name)
            }}
            onRemove={() => void removeRow(wid, piece.id, setup, r, mine)}
            onPick={r.card ? () => pick(r.card!) : undefined}
          />
        ))}

        {seenRows.map(([r, ri]) =>
          cols.map((c, ci) => {
            const key = selKey(piece.id, r.key, c.id)
            const style = box(xs[ci], T.head + ri * T.row, ws[ci], T.row)
            const isSel = selected?.r === ri && selected.c === ci
            if (c.field) {
              const text = fieldText(r, c.field)
              const tone = c.field === 'type' && r.card ? TYPE_ACCENT[r.card.type] : undefined
              return (
                <button key={key} className={styles.cell} data-field={c.field} data-cell={key} data-find={key} data-find-box data-selected={isSel || undefined} style={{ ...style, ...(tone ? { ['--tone' as string]: tone } : {}) }}
                  tabIndex={live ? 0 : -1} onClick={live ? () => press(ri, ci) : undefined} aria-label={`${r.name || 'untitled'}, ${colName(c)}: ${text || 'empty'}`}>
                  {text ? <span className={styles.text}>{text}</span> : <span className={styles.unset}>·</span>}
                  <Marks tier="s" live={live} selected={isSel} />
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
            <button className={styles.add} data-col style={box(width, 0, T.add, T.head)} title="add a column" aria-label="Add a column" onPointerDown={own} onClick={() => useTableUi.setState({ setup: piece.id, tab: 'cols' })}>
              +
            </button>
            <button
              className={styles.add}
              style={box(0, bottom, nameW, T.add)}
              title="add a named row"
              aria-label="Add a row"
              onPointerDown={own}
              onClick={() => {
                followTable(piece.id)
                void addNamedRow(wid, piece.id, setup).then((id) => useTableUi.setState({ naming: id }))
              }}
            >
              + row
            </button>
          </>
        )}
        {!rows.length && (
          <p className={styles.empty} style={box(nameW, T.head, Math.max(width - nameW, 200), T.row)}>
            {setup.manual ? 'No rows yet' : 'No card meets its rules'}
          </p>
        )}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seenRows, cols, byKey, mine, setup, sr, sc, typing, naming, live, editor, fieldText, onCard, nameW, widths, piece.id, wid],
  )


  return (
    <div ref={layer} className={styles.layer} data-live={live || undefined} data-on-canvas={onCanvas || undefined}>
      <div className={styles.world} style={{ transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})`, ...zsIn(settled, onCanvas || !live) }}>
        <div className={styles.table} style={{ width: width + (live && editor ? T.add : 0), height: bottom + T.add }} role="grid" aria-label={piece.name || 'table'}>
          {headsShown}

          {live && editor &&
            [{ id: NAME_COL, x: nameW, w: nameWidth(setup) }, ...cols.map((c, i) => ({ id: c.id, x: xs[i] + ws[i], w: widthOf(c) }))].map((g) => (
              <WidthGrip
                key={g.id}
                x={g.x}
                height={bottom}
                // Open on the canvas (D-228) its view stays at 1 under the canvas's zoom: the piece's `--z` (CSS) sizes it.
                zoom={onCanvas ? undefined : view.zoom}
                sizing={sizing?.col === g.id ? sizing.w : null}
                onMove={(dx) => setSizing({ col: g.id, w: Math.round(Math.min(COL_W.max, Math.max(COL_W.min, g.w + dx))) })}
                onDone={(dx) => {
                  setSizing(null)
                  if (dx) void setColumnWidth(wid, piece.id, setup, g.id, g.w + dx)
                }}
                onReset={() => void setColumnWidth(wid, piece.id, setup, g.id, undefined)}
              />
            ))}

          {rowsShown}
        </div>
      </div>
    </div>
  )
}

type GripProps = { x: number; height: number; zoom?: number; sizing: number | null; onMove: (dx: number) => void; onDone: (dx: number) => void; onReset: () => void }

// A column's right edge, on its head: dragged, the column widens or narrows (the rows follow); a double-click puts it
// back to its own width. As wide on the screen at any zoom. Its look is D-265's edge handle: a cyan bar at the head's
// middle under the pointer (a column isn't selected, so its head's edge is where it's found); dragged, the edge lit cyan
// down the whole table and the width beside it.
function WidthGrip({ x, height, zoom, sizing, onMove, onDone, onReset }: GripProps) {
  // The zoom it's drawn at: given, or the canvas's (`--z` on the piece) when it isn't.
  const z = zoom ?? 'var(--z, 1)'
  const from = useRef<number | null>(null)
  // How much it's scaled on the screen, measured as the press starts: a drag's px back in the table's.
  const scale = useRef(1)
  const dx = (e: ReactPointerEvent) => (from.current === null ? 0 : (e.clientX - from.current) / scale.current)
  return (
    <div
      className={styles.grip}
      data-sizing={sizing !== null || undefined}
      style={{ left: `calc(${x}px - 4.5px / ${z})`, top: 0, width: `calc(9px / ${z})`, height: T.head, ['--rule-h' as string]: `${height}px`, ['--hair' as string]: `calc(1px / ${z})` }}
      role="separator"
      aria-orientation="vertical"
      aria-label="Column width (drag; double-click for its own)"
      title="drag to widen · double-click for its own width"
      onPointerDown={(e) => {
        e.stopPropagation()
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        scale.current = e.currentTarget.getBoundingClientRect().height / T.head || 1
        from.current = e.clientX
      }}
      onPointerMove={(e) => from.current !== null && onMove(dx(e))}
      onPointerUp={(e) => {
        if (from.current === null) return
        const d = dx(e)
        from.current = null
        onDone(Math.round(d))
      }}
      onPointerCancel={() => {
        from.current = null
        onDone(0)
      }}
      onDoubleClick={onReset}
    >
      {sizing !== null && <span className={styles.readout}>{sizing}</span>}
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
  // Others who have its card selected, wherever (D-265): their L's on its name.
  const peers = usePeersOn(row.card?.id ?? '')
  return (
    <div className={styles.name} style={{ ...style, ...(tone ? { ['--type' as string]: tone } : {}) }} data-find-box data-card={row.card ? true : undefined} title={row.name || undefined} data-pick={onPick ? true : undefined} onPointerDown={onPress} onClick={live && !open && onPick ? (e) => !(e.target as HTMLElement).closest('button') && onPick() : undefined} onDoubleClick={live && editor ? () => setEditing(true) : undefined}>
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
        <span className={styles.nameText} data-unnamed={!row.name || undefined} data-find={`n|${row.key}`}>
          {row.name || (row.card ? `untitled ${row.card.type}` : 'name')}
        </span>
      )}
      {live && editor && !open && (
        <button className={styles.remove} title={row.auto ? `take it out of the table (it stays a ${row.card!.type})` : 'take it out'} aria-label="Take it out" onClick={onRemove}>
          ×
        </button>
      )}
      <Marks tier="s" tone={tone} live={live && !!onPick} peers={live ? peers : undefined} />
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
        <Marks tier="s" selected />
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
      data-find={id}
      data-find-box
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
      <Marks tier="s" live={live} selected={selected} />
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
