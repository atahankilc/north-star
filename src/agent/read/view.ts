// `view(piece)`: a piece as markdown, the way a person reads it (agent.md §4.4): a plane as its sections and headings
// with their cards and text in reading order, then its links; a matrix as a table with heads by name; a table as the
// table its rules give; a deck as columns with their tasks (or cards by a field); a timeline as tasks by their days; a
// documents list as titles; a document as its text. Paged; every page says how to get the next.
// `read_document(id, range)`: a document's text by lines or a section, with its table of contents.
import { kindOf } from '../../model/labels'
import { kindOfPiece, KIND_NAME } from '../../model/pieces'
import { cellView, entriesOf, isOpen, nounOf, readCell, readingOf, tops, CONFIDENCE_MARK, type Cell, type Entry, type MatrixSetup } from '../../model/matrix'
import { colName, readOwn, DEFAULT_STEPS, type Column, type TableSetup } from '../../model/table'
import { axisEntries, tableRows } from '../../model/lens'
import { statusOf, type Row } from '../../model/source'
import { axisOf, byBox, byColumn, heldCards, rowFieldOf, scorer, boxKey } from '../../model/kanbanCards'
import { pageText } from '../../model/findIndex'
import type { KanbanSetup } from '../../data/tasks'
import type { Card } from '../../model/cards'
import { derive, nameOf, shownTasks, timelineDecks, type Derived, type P, clean } from './derive'
import { resolve, unclear, type Ids } from './ids'
import { cardLine, pieceSays, pieceTitle, taskLine, textLine } from './lines'
import { planeNodes, flatten } from './space'
import { estimateTokens, fit, oneLine, pageLine, pageOf, q, wrap } from './text'
import type { ReadWs, ToolResult } from './types'

export type ViewArgs = { piece: string; page?: number; col_page?: number }

export function view(ws: ReadWs, ids: Ids, a: ViewArgs): ToolResult {
  ws = clean(ws)
  const r = resolve(ws, ids, a.piece, ['piece', 'document'], undefined, 'piece')
  if (!('id' in r)) return { text: unclear(a.piece, r) }
  if (r.kind === 'document') return readDocument(ws, ids, { id: r.id })
  const d = derive(ws)
  const p = d.pieces.get(r.id)!
  let res: ToolResult
  switch (kindOfPiece(p)) {
    case 'plane':
      res = planeView(ws, ids, d, p, a.page)
      break
    case 'matrix':
      res = matrixView(ws, ids, d, p, a.page, a.col_page)
      break
    case 'table':
      res = tableView(ws, ids, d, p, a.page)
      break
    case 'kanban':
      res = p.kanban?.holds === 'cards' ? cardDeckView(ws, ids, d, p, a.page) : deckView(ws, ids, d, p, a.page)
      break
    case 'timeline':
      res = timelineView(ws, ids, d, p, a.page)
      break
    case 'documents':
      res = documentsView(ws, ids, d, p, a.page)
      break
    case 'document':
      res = p.docId && d.docs.has(p.docId) ? readDocument(ws, ids, { id: p.docId, range: a.page && a.page > 1 ? `page ${a.page}` : undefined }) : { text: `${ids.short('piece', p.id)} document: its document is not here (private to someone else, or gone).` }
      break
  }
  return finish(res)
}

// Keeps a result under the ceiling whatever happened above.
export function finish(r: ToolResult): ToolResult {
  const f = fit(r.text)
  return f.cut ? { text: f.text, more: r.more ?? 'The answer was cut: ask for a page, or narrow it.' } : r
}

const title = (ids: Ids, d: Derived, p: P) => `# ${ids.short('piece', p.id)} ${KIND_NAME[kindOfPiece(p)]} ${pieceTitle(d, p)}`

const PLANE_PAGE = 80

function planeView(ws: ReadWs, ids: Ids, d: Derived, p: P, page = 1): ToolResult {
  const lines: string[] = []
  for (const { node, depth } of flatten(planeNodes(ws, p.id))) {
    const at = '  '.repeat(depth)
    if (node.kind === 'section') lines.push(`${at}${textLine(ws, ids, node.label, 80)}`)
    else if (node.kind === 'text') {
      const k = kindOf(node.label)
      lines.push(`${at}${textLine(ws, ids, node.label, k === 'paragraph' || k === 'sticky' ? 400 : 120)}`)
    } else if (node.kind === 'card') {
      const c = node.card
      lines.push(`${at}${c.on ? `${cardLine(ws, ids, c, { planes: false })} · ⧉ its home is ${ids.short('piece', c.pieceId)}` : cardLine(ws, ids, c, { except: p.id })}`)
      // What's folded into it, as rows inside it.
      for (const row of d.folds.rows.get(c.id) ?? []) lines.push(`${at}  ${'  '.repeat(row.depth)}↳ ${cardLine(ws, ids, row.card, { except: p.id, links: false })}`)
    }
  }
  const pg = pageOf(lines, page, PLANE_PAGE)
  const cards = new Set((d.onPlane.get(p.id) ?? []).map((c) => c.id))
  const shown = new Set(pg.items.flatMap((l) => /(?:^|\s|↳ )(c\d+) ·/.exec(l)?.[1] ?? []).map((s) => ids.real(s)?.id).filter(Boolean) as string[])
  const links = ws.edges.filter((e) => cards.has(e.fromId) && cards.has(e.toId) && (shown.has(e.fromId) || shown.has(e.toId)))
  const body = [...pg.items]
  if (links.length) {
    body.push('', `## Links${pg.pages > 1 ? ' touching this page' : ''} (${links.length})`)
    const max = 100
    for (const e of links.slice(0, max)) body.push(`${ids.short('card', e.fromId)} —${e.kind}→ ${ids.short('card', e.toId)}${e.label ? ` ${q(e.label, 40)}` : ''}`)
    if (links.length > max) body.push(`… and ${links.length - max} more: neighbours(card) follows them`)
  }
  const stuck = ws.pieces.filter((x) => x.stuckTo === p.id)
  const head = [`${title(ids, d, p)} · ${pieceSays(ws, ids, p)}`]
  if (stuck.length) head.push(`Stuck to it: ${stuck.map((x) => `${ids.short('piece', x.id)} ${KIND_NAME[kindOfPiece(x)]} ${q(d.pieceName(x), 40)}`).join(' · ')}`)
  const more = pageLine(lines.length, pg, 'Lines', `Or query plane=${ids.short('piece', p.id)} with a type or status.`)
  return { text: [...head, wrap('workspace', body.join('\n') || '(empty)'), ...(more ? [more] : [])].join('\n'), more }
}

// ---- Matrix

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
const headOf = (ids: Ids, e: Entry) => (e.parent ? `↳ ${oneLine(e.name, 30)}` : e.card ? `${ids.short('card', e.card.id)} ${oneLine(e.card.title, 30)}` : oneLine(e.name, 30) || '(unnamed)')

function stepText(m: MatrixSetup, c: Cell | undefined, rolled?: boolean): string {
  if (!c) return ''
  // As the matrix draws it (Matrix.tsx' CellBox): `—` only where the matrix allows it, `~`/`?` only where it asks.
  if (m.notRelevant && c.notRelevant) return '—'
  const r = readCell(m, c)
  let v = r.step ? `${r.step.glyph} ${r.step.label}` : r.number !== undefined ? `${+r.number.toFixed(2)}${m.unit ? ` ${m.unit}` : ''}` : r.text ? oneLine(r.text, 30) : ''
  if (rolled && v) v += ' (from criteria)'
  const mark = m.confidence && c.confidence ? CONFIDENCE_MARK[c.confidence] : ''
  return `${v}${mark ? ` ${mark}` : ''}`
}

function readingText(m: MatrixSetup, cells: (Cell | undefined)[]): string {
  const r = readingOf(m, cells)
  if (m.cell === 'scale') return m.steps.map((s, i) => (r.counts[i] ? `${r.counts[i]} ${s.label}` : '')).filter(Boolean).join(' · ') || '—'
  if (m.cell === 'number') return r.avg !== undefined ? `avg ${+r.avg.toFixed(2)}${m.unit ? ` ${m.unit}` : ''}` : '—'
  return `${r.filled}/${r.of} written`
}

const ROWS_PAGE = 25
const COLS_PAGE = 8

function matrixView(ws: ReadWs, ids: Ids, d: Derived, p: P, page = 1, colPage = 1): ToolResult {
  const m = p.matrix as MatrixSetup | undefined
  if (!m) return { text: `${title(ids, d, p)} · not set up` }
  const rows = entriesOf(m.rows, ws.cards)
  const cols = entriesOf(m.cols, ws.cards)
  const at = new Map(ws.cells.filter((c) => c.matrixId === p.id).map((c) => [`${c.row}|${c.col}`, c]))
  const get = (r: string, c: string) => at.get(`${r}|${c}`)
  const shown = (r: Entry, c: Entry) => cellView(p.id, m, get, r, c)
  const rp = pageOf(rows, page, ROWS_PAGE)
  const cp = pageOf(cols, colPage, COLS_PAGE)
  const notes: string[] = []
  const say = (r: Entry, c: Entry) => {
    const v = shown(r, c)
    let s = stepText(m, v, v?.rolled)
    if (v?.notes) {
      notes.push(`*${notes.length + 1} ${headOf(ids, r)} × ${headOf(ids, c)}: ${oneLine(v.notes, 200)}`)
      s += ` *${notes.length}`
    }
    return cell(s)
  }
  const totals = !!m.reading
  // What nobody meets (D-133's white space, Matrix.tsx' ◇): a criterion scored across and met nowhere; its card counts them.
  const allRows = axisEntries(m.rows, ws.cards)
  const allCols = axisEntries(m.cols, ws.cards)
  const openOf = (which: 'rows' | 'cols', key: string) =>
    isOpen(m, which === 'rows' ? tops(allCols).map((c) => cellView(p.id, m, get, { key }, c)) : tops(allRows).map((r) => cellView(p.id, m, get, r, { key })))
  const headOfEntry = (which: 'rows' | 'cols', e: Entry) => {
    const base = headOf(ids, e)
    if (e.sub) return openOf(which, e.key) ? `${base} ◇ open` : base
    const n = (e.subs ?? []).filter((k) => openOf(which, k)).length
    return n ? `${base} · ◇ ${n} open` : base
  }
  const headRow = `| ${cell(nounOf(m.rows))} \\ ${cell(nounOf(m.cols))} | ${cp.items.map((c) => cell(headOfEntry('cols', c))).join(' | ')}${totals ? ' | total' : ''} |`
  const lines = [headRow, `|${'---|'.repeat(cp.items.length + 1 + (totals ? 1 : 0))}`]
  const topCols = tops(cols)
  for (const r of rp.items) lines.push(`| ${cell(headOfEntry('rows', r))} | ${cp.items.map((c) => say(r, c)).join(' | ')}${totals ? ` | ${cell(r.parent ? '' : readingText(m, topCols.map((c) => shown(r, c))))}` : ''} |`)
  if (totals && rp.page === rp.pages) lines.push(`| total | ${cp.items.map((c) => cell(c.parent ? '' : readingText(m, tops(rows).map((r) => shown(r, c))))).join(' | ')} | |`)
  const scale = m.cell === 'scale' ? `scale ${m.steps.map((s) => `${s.glyph} ${s.label}`).join(' < ')}` : m.cell === 'number' ? `numbers${m.unit ? ` in ${m.unit}` : ''}` : 'text'
  const head = [
    `${title(ids, d, p)}${p.stuckTo ? ` · stuck to ${ids.short('piece', p.stuckTo)}` : ''}`,
    `${pieceSays(ws, ids, p)}`,
    `Cells: ${scale}${m.notRelevant ? ' · — not relevant' : ''}${m.confidence ? ' · ~ inferred, ? a guess' : ''} · empty = not filled`,
  ]
  const more = [
    pageLine(rows.length, rp, 'Rows', ''),
    pageLine(cols.length, cp, 'Columns', '', 'col_page'),
  ].filter(Boolean).join(' ')
  return { text: [...head, wrap('workspace', [...lines, ...(notes.length ? ['', 'Notes:', ...notes] : [])].join('\n')), ...(more ? [more] : [])].join('\n'), more: more || undefined }
}

// ---- Table

// A card's field as its column shows it.
function fieldText(d: Derived, c: Card | undefined, f: string): string {
  if (!c) return ''
  switch (f) {
    case 'type':
      return c.type
    case 'plane':
      return (d.planesOf.get(c.id) ?? []).map((x) => oneLine(d.nameById(x), 20)).join(', ')
    case 'status':
      return statusOf(c) ?? ''
    case 'tags':
      return (c.tags ?? []).map((t) => `#${t}`).join(' ')
    case 'regions':
      return (c.regions ?? []).join(', ')
    case 'evidence': {
      const p = d.facts.get(c.id)?.proof
      return p ? `+${p.supports} −${p.contradicts}` : ''
    }
    default:
      return String((c as Record<string, unknown>)[f] ?? '')
  }
}

function ownText(col: Column, c: Cell | undefined): string {
  const r = readOwn(col, c)
  const v = r.step ? r.step.label : r.number !== undefined ? `${r.number}${col.unit ? ` ${col.unit}` : ''}` : r.checked ? '✓' : r.text ? oneLine(r.text, 40) : ''
  return c?.notes ? `${v} (note: ${oneLine(c.notes, 40)})` : v
}

export function tableValues(ws: ReadWs, ids: Ids, p: P): { cols: string[]; rows: { row: Row; values: string[]; raw: (string | number)[] }[] } {
  ws = clean(ws)
  const d = derive(ws)
  const t = p.table as TableSetup
  const at = new Map(ws.cells.filter((c) => c.matrixId === p.id).map((c) => [`${c.row}|${c.col}`, c]))
  const rows = tableRows(t, ws.cards).map((row) => {
    const raw: (string | number)[] = [row.name.toLowerCase()]
    const values = [row.card ? `${ids.short('card', row.card.id)} ${oneLine(row.name, 40)}` : oneLine(row.name, 40) || '(unnamed)']
    for (const col of t.cols) {
      if (col.field) {
        const v = fieldText(d, row.card, col.field)
        values.push(v)
        raw.push(v.toLowerCase())
      } else {
        const c = at.get(`${row.key}|${col.id}`)
        values.push(ownText(col, c))
        const r = readOwn(col, c)
        raw.push(r.number ?? (r.step ? (col.steps ?? DEFAULT_STEPS).indexOf(r.step) : (r.text?.toLowerCase() ?? (r.checked ? 1 : ''))))
      }
    }
    return { row, values, raw }
  })
  if (t.sort) {
    const i = t.sort.col === 'name' ? 0 : t.cols.findIndex((c) => c.id === t.sort!.col) + 1
    if (i >= 0) {
      const dir = t.sort.desc ? -1 : 1
      rows.sort((a, b) => {
        const [x, y] = [a.raw[i], b.raw[i]]
        if (x === '' && y !== '') return 1
        if (y === '' && x !== '') return -1
        return dir * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)))
      })
    }
  }
  return { cols: ['name', ...t.cols.map((c) => colName(c) + (c.unit ? ` (${c.unit})` : '') + (c.field ? '' : ''))], rows }
}

function tableView(ws: ReadWs, ids: Ids, d: Derived, p: P, page = 1): ToolResult {
  const t = p.table as TableSetup | undefined
  if (!t) return { text: `${title(ids, d, p)} · not set up` }
  const { cols, rows } = tableValues(ws, ids, p)
  const pg = pageOf(rows, page, t.pageSize ?? 25)
  const lines = [`| ${cols.map(cell).join(' | ')} |`, `|${'---|'.repeat(cols.length)}`, ...pg.items.map((r) => `| ${r.values.map(cell).join(' | ')} |`)]
  const sorted = t.sort ? ` · sorted by ${t.sort.col === 'name' ? 'name' : colName(t.cols.find((c) => c.id === t.sort!.col) ?? { id: '' })}${t.sort.desc ? ' (high first)' : ''}` : ''
  const more = pageLine(rows.length, pg, 'Rows', '')
  return {
    text: [`${title(ids, d, p)}${p.stuckTo ? ` · stuck to ${ids.short('piece', p.stuckTo)}` : ''}`, `${pieceSays(ws, ids, p)}${sorted}`, wrap('workspace', lines.join('\n')), ...(more ? [more] : [])].join('\n'),
    more,
  }
}

// ---- Decks

const TASKS_PAGE = 60

function deckView(ws: ReadWs, ids: Ids, d: Derived, p: P, page = 1): ToolResult {
  const k = p.kanban as KanbanSetup | undefined
  const cols = k?.cols ?? []
  const tasks = shownTasks(ws, d, p)
  const lines: string[] = []
  cols.forEach((c, i) => {
    const list = tasks.filter((t) => t.col === c.id).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    lines.push(`## ${String(i + 1).padStart(2, '0')} ${c.name.toUpperCase()} (${list.length}${c.limit ? `/${c.limit} limit` : ''})${c.done ? ' · finished' : ''}`)
    for (const t of list) lines.push(`- ${taskLine(ws, ids, t)}`)
  })
  const orphans = tasks.filter((t) => !cols.some((c) => c.id === t.col))
  if (orphans.length) lines.push(`## (no column) (${orphans.length})`, ...orphans.map((t) => `- ${taskLine(ws, ids, t)}`))
  const pg = pageOf(lines, page, TASKS_PAGE)
  const stuck = p.stuckTo && d.pieces.get(p.stuckTo)?.kind === 'plane' ? `Stuck to ${ids.short('piece', p.stuckTo)} ${q(d.nameById(p.stuckTo), 40)}: shows only that plane's tasks (and those for no card).` : ''
  const more = pageLine(lines.length, pg, 'Lines', 'Or query deck=… with column, assignee, due_before.')
  const lanes = k?.rows ? ` · lanes by ${k.rows}` : ''
  return { text: [`${title(ids, d, p)} · ${pieceSays(ws, ids, p)}${lanes}`, ...(stuck ? [stuck] : []), wrap('workspace', pg.items.join('\n') || '(no tasks)'), ...(more ? [more] : [])].join('\n'), more }
}

function cardDeckView(ws: ReadWs, ids: Ids, d: Derived, p: P, page = 1): ToolResult {
  const k = p.kanban as KanbanSetup
  const field = k.colField ?? 'status'
  const rowField = rowFieldOf(k)
  const cards = heldCards(p, ws.cards)
  const cols = axisOf(field, cards)
  const lines: string[] = []
  const short = (c: Card) => cardLine(ws, ids, c, { links: false, tags: false, planes: false, max: 60 })
  if (!rowField) {
    const by = byColumn(field, cols, cards)
    for (const c of cols) {
      const list = by.get(c.id) ?? []
      lines.push(`## ${field} ${c.name} (${list.length})`)
      for (const x of list) lines.push(`- ${short(x)}`)
    }
  } else {
    const rows = axisOf(rowField, cards, true)
    const boxes = byBox(field, cols, rowField, rows, cards, scorer(ws.cards, ws.edges))
    for (const r of rows)
      for (const c of cols) {
        const list = boxes.get(boxKey(c.id, r.id)) ?? []
        if (!list.length) continue
        const name = k.names?.find((n) => n.col === c.id && n.row === r.id)?.name
        lines.push(`## ${field} ${c.name} × ${rowField} ${r.name}${name ? ` "${name}"` : ''} (${list.length})`)
        for (const x of list) lines.push(`- ${short(x)}`)
      }
  }
  const pg = pageOf(lines, page, TASKS_PAGE)
  const more = pageLine(lines.length, pg, 'Lines', '')
  return { text: [`${title(ids, d, p)} · ${pieceSays(ws, ids, p)}`, wrap('workspace', pg.items.join('\n') || '(no cards)'), ...(more ? [more] : [])].join('\n'), more }
}

function timelineView(ws: ReadWs, ids: Ids, d: Derived, p: P, page = 1): ToolResult {
  const decks = timelineDecks(ws, p)
  const rowsBy = p.timeline?.rows ?? 'kanban'
  const tasks = decks.flatMap((k) => shownTasks(ws, d, k))
  const dated = tasks.filter((t) => t.start || t.due).sort((a, b) => (a.start ?? a.due!).localeCompare(b.start ?? b.due!) || (a.due ?? '').localeCompare(b.due ?? '') || a.createdAt - b.createdAt)
  const undated = tasks.filter((t) => !t.start && !t.due)
  const rowOf = (t: (typeof tasks)[number]) =>
    rowsBy === 'assignee' ? (t.assignee ? `${ids.short('person', t.assignee)} ${nameOf(d, t.assignee)}` : 'given to nobody') : rowsBy === 'card' ? (t.cardId && d.cards.get(t.cardId) ? `${ids.short('card', t.cardId)} ${q(d.cards.get(t.cardId)!.title, 40)}` : 'no card') : `${ids.short('piece', t.pieceId)} ${q(d.nameById(t.pieceId), 40)}`
  const groups = new Map<string, string[]>()
  for (const t of dated) {
    const finished = d.doneCols.get(t.pieceId)?.has(t.col)
    const late = !finished && t.due && t.due < d.today
    const span = t.start ? `${t.start} → ${t.due ?? '…'}` : `◆ ${t.due}`
    const line = `- ${span}${late ? ' (late)' : ''}${finished ? ' ✓' : ''} · ${taskLine(ws, ids, t, { days: false })}`
    groups.set(rowOf(t), [...(groups.get(rowOf(t)) ?? []), line])
  }
  const lines: string[] = []
  for (const [row, list] of groups) lines.push(`## ${row} (${list.length})`, ...list)
  if (undated.length) lines.push(`## no day yet (${undated.length})`, ...undated.slice(0, 20).map((t) => `- ${taskLine(ws, ids, t, { where: rowsBy !== 'kanban' })}`), ...(undated.length > 20 ? [`… and ${undated.length - 20} more`] : []))
  const pg = pageOf(lines, page, TASKS_PAGE)
  const more = pageLine(lines.length, pg, 'Lines', 'Or query with due_before / due_after.')
  return { text: [`${title(ids, d, p)} · ${pieceSays(ws, ids, p)} · today ${d.today}`, wrap('workspace', pg.items.join('\n') || '(no tasks)'), ...(more ? [more] : [])].join('\n'), more }
}

function documentsView(ws: ReadWs, ids: Ids, d: Derived, p: P, page = 1): ToolResult {
  const kinds = p.documents?.kinds
  const list = ws.documents.filter((x) => !kinds?.length || kinds.includes(x.kind)).sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1))
  const pg = pageOf(list, page, p.documents?.pageSize ?? 30)
  const lines = pg.items.map((x) => `- ${ids.short('document', x.id)} · ${x.kind} · ${q(x.title, 80)} · by ${x.name} · ${new Date(x.createdAt).toISOString().slice(0, 10)}${x.shared ? '' : ' · private'}${x.excerpt ? ` — ${oneLine(x.excerpt, 100)}` : ''}`)
  const more = pageLine(list.length, pg, 'Documents', 'read_document(d…) opens one.')
  return { text: [`${title(ids, d, p)} · ${pieceSays(ws, ids, p)}`, wrap('workspace', lines.join('\n') || '(none)'), ...(more ? [more] : [])].join('\n'), more }
}

// ---- Documents

export type ReadDocArgs = { id: string; range?: string; from?: number; to?: number; section?: string }

const DOC_LINES = 250

export function readDocument(ws: ReadWs, ids: Ids, a: ReadDocArgs): ToolResult {
  ws = clean(ws)
  const r = resolve(ws, ids, a.id, ['document', 'piece'], (k, id) => k === 'document' || derive(ws).pieces.get(id)?.kind === 'document', 'document')
  if (!('id' in r)) return { text: unclear(a.id, r) }
  const d = derive(ws)
  const docId = r.kind === 'piece' ? d.pieces.get(r.id)?.docId : r.id
  const doc = docId ? d.docs.get(docId) : undefined
  if (!doc) return { text: `${r.short} is not a document you can read (not a document, private to someone else, or gone).` }
  const s = ids.short('document', doc.id)
  const head = `# ${s} ${doc.kind} ${q(doc.title, 120)} · by ${doc.name}${doc.shared ? '' : ' · private'}${doc.words ? ` · ${doc.words} words` : ''}`
  const body = ws.bodies?.[doc.id]
  if (!body) {
    return finish({
      text: [head, `Its text isn't loaded here${doc.kind === 'image' || doc.kind === 'pdf' ? ` (a ${doc.kind}: files come with Storage)` : ''}; what the list shows:`, wrap(doc.name, doc.excerpt ? oneLine(doc.excerpt, 400) : '(no excerpt)')].join('\n'),
    })
  }
  const text = doc.kind === 'report' ? pageText(doc, body) : (body.text ?? '')
  const lines = text.split('\n')
  const heads = lines.flatMap((l, i) => {
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l)
    return m ? [{ line: i + 1, level: m[1].length, text: m[2] }] : []
  })
  const toc = heads.length ? ['Contents (line: heading):', ...heads.slice(0, 60).map((h) => `${'  '.repeat(h.level - 1)}${h.line}: ${oneLine(h.text, 80)}`), ...(heads.length > 60 ? [`… +${heads.length - 60} headings`] : [])] : []
  // Which lines: a range `12-80`, `from`/`to`, a section by heading (or its number in the contents), `page N`.
  let from = 1
  let to = lines.length
  let asked = false
  const range = a.range?.trim()
  const pageM = range && /^page\s+(\d+)$/i.exec(range)
  if (pageM) {
    from = (Number(pageM[1]) - 1) * DOC_LINES + 1
    to = from + DOC_LINES - 1
    asked = true
  } else if (range && /^\d+\s*[-–:]\s*\d*$/.test(range)) {
    const [x, y] = range.split(/[-–:]/).map((v) => v.trim())
    from = Number(x)
    to = y ? Number(y) : from + DOC_LINES - 1
    asked = true
  } else if (a.from || a.to) {
    from = a.from ?? 1
    to = a.to ?? from + DOC_LINES - 1
    asked = true
  }
  const section = a.section ?? (range && !asked ? range : undefined)
  if (section) {
    const n = section.trim().toLowerCase().replace(/^#+\s*/, '')
    const h = heads.find((x) => x.text.toLowerCase() === n) ?? heads.find((x) => x.text.toLowerCase().startsWith(n)) ?? heads.find((x) => x.text.toLowerCase().includes(n))
    if (!h) return finish({ text: [head, `No section "${oneLine(section, 60)}" in it.`, ...toc].join('\n') })
    const end = heads.find((x) => x.line > h.line && x.level <= h.level)
    from = h.line
    to = end ? end.line - 1 : lines.length
    asked = true
  }
  const whole = !asked && estimateTokens(text) <= 6000
  if (!asked && !whole) to = Math.min(lines.length, 80)
  from = Math.max(1, from)
  to = Math.min(lines.length, to, from + DOC_LINES - 1)
  const numbered = lines.slice(from - 1, to).map((l, i) => `${from + i}│ ${l}`)
  const more = to < lines.length ? `Lines ${from}–${to} of ${lines.length}. Next: range "${to + 1}-${Math.min(lines.length, to + DOC_LINES)}", or a section by its heading.` : undefined
  return finish({ text: [head, ...(whole || asked ? [] : toc), wrap(doc.name, numbered.join('\n')), ...(more ? [more] : [])].join('\n'), more })
}

