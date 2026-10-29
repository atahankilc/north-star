// The preview (S15, D-312; docs/specs/agent.md §4.5): the real app drawing a different copy of the data. No React, no
// Firebase: what's previewed, the overlaid workspace and the marks, outside React (the panel and the mark layer read it
// through src/agent/ui/usePreview.ts).
//
// HOW (§4.5's one rule): the changeset's plans are played onto the workspace with the same code apply runs
// (changeset.ts' viewOf → ops' projectLoose → model/fromDocs), and the workspace STORE is overlaid with that copy
// (wsStore.ts' `overlay`): every component reads `useWs()`, so each kind draws the previewed state with no preview code
// of its own. The real value stays underneath and the live listeners keep writing it; the overlay is worked out again
// for each new real value (a collaborator's write shows under the preview too). Writes are refused meanwhile
// (browser.ts' lockPreview), and the ops build on the real value (`freshWs` reads `getRealWs`), so applying never
// starts from the preview.
//
// WHAT IS REMOVED IS STILL DRAWN: the drawn copy is the projection PLUS every doc the changes take away, put back as it
// was (`drawnWs`), so a deleted card, link, text, task, cell or piece is drawn where it is today and the mark layer
// strikes it (faint, magenta `−`, the agent's reason on hover). One approach for every kind: a ghost drawn from the
// real workspace would need each kind's own drawing code. The cost: what's read from the drawn copy counts the removed
// docs too while the preview is open (a matrix total, a deck's `4/3` limit, a table's row count still include a row
// being deleted, struck). The projection itself (what's applied, `viewOf`) never holds them: "applied equals
// previewed" compares that (tests/unit/preview.test.ts, the eval's --emulator mode).
//
// THE MARKS: `targetsOf` turns the diff (changeset.ts' previewDiff: places mapped to their card, spots to their piece)
// into targets for the mark layer: a CSS selector of the element(s) that draw a thing (the attributes the views
// already carry: data-target="card:/plane:/link:", data-id, data-task, data-cell, data-find, the canvas prompt's
// data-key), what changed (added | changed | removed | moved), the chip's words, `was …` lines for hover, the agent's
// reason, and where it was (a ghost: by x/y in its space, or from where its element was drawn when the preview opened).
// Derived things get targets too: a matrix's new heads, a table's rows that join (by a rule or by hand) and new columns.
import { activeStore, type Store, type WorkspaceCtx } from '../state/wsStore'
import { CARD_COLLECTION, type Card } from '../model/cards'
import { canvasOf } from '../model/canvases'
import { kindOfPiece, KIND_NAME } from '../model/pieces'
import { entriesOf } from '../model/matrix'
import { tableRows } from '../model/lens'
import { kindOf } from '../model/labels'
import { fromDocs } from '../model/fromDocs'
import { docsOf, toDocs } from '../ops/docs'
import type { Coll } from '../ops/types'
import { previewDiff, viewOf, type ChangeItem, type Changeset, type PreviewChange } from './changeset'

export type MarkChange = 'added' | 'changed' | 'removed' | 'moved'

export type Target = {
  // Unique among the targets.
  key: string
  // The doc it's about (a card, piece, text, task, link, cell; a place's card, a spot's piece).
  id: string
  change: MarkChange
  // The element(s) drawing it, and (optional) the nearest ancestor to mark instead.
  sel: string
  up?: string
  // Only an element inside this piece (or in its focus, or beside it).
  within?: string
  // A link: its line is drawn by the layer between its two cards' boxes (`ends`), cut at their edges, even when the
  // plane hides its kind (D-128); the SVG hit line when the cards aren't found.
  line?: boolean
  ends?: [string, string]
  // Lit without a chip of its own (its group's first row carries one for all: `+ 8 rows join`, `groupTag`).
  quiet?: boolean
  groupTag?: string
  tier: 's' | 'm' | 'l'
  // The chip's words: `+`, `~ status, title`, `− deleted`, `↦ moved`.
  tag: string
  // `was …` lines, for hover (changed and moved).
  was: string[]
  // The agent's reason (deletes).
  why?: string
  // The changeset's item that makes it (the panel lights an item's marks, the stepper the current one's).
  item?: string
  // Where it was, in its space's px from where it is now (cards, text, pieces moved on their plane or canvas).
  ghost?: { dx: number; dy: number }
  // Where it was, from where its element was drawn when the preview opened (tasks: another column, other days).
  snap?: boolean
  // A thing gone from this canvas to another one: a dashed box where it was, the canvas named.
  away?: { x: number; y: number; w: number; h: number; to: string }
}

// Where the stepper goes for an item: a thing (the facade's goTo), a card on a given plane, a piece on a given canvas.
// `focus`: into the piece's focus (a matrix's or table's cells and heads are drawn readable only there).
export type Go = { id: string; plane?: string; canvas?: string; focus?: boolean }

const CARD_COLLS = new Set<string>(Object.values(CARD_COLLECTION))
const isCardColl = (k: string) => CARD_COLLS.has(k)
// Never named in `was` lines or chips.
const QUIET = new Set(['updatedAt', 'createdAt', 'id', 'by', 'uid', 'givenAt', 'givenBy', 'order'])

// ---- The drawn copy

// The projection plus every doc the changes take away, as it is now (see the header).
export function drawnWs(real: WorkspaceCtx, cs: Changeset): { ws: WorkspaceCtx; view: WorkspaceCtx; diff: Map<string, PreviewChange> } {
  const view = viewOf(cs, real)
  const diff = previewDiff(cs, real)
  const removed = [...diff].filter(([, ch]) => ch.change === 'removed' && ch.kind !== 'workspace')
  if (!removed.length) return { ws: takenOutKept(kept(view, real, diff), real, diff), view, diff }
  const store = toDocs(view)
  const was = toDocs(real)
  for (const [id, ch] of removed) {
    const doc = was.get(ch.kind)?.get(id)
    if (doc) store.get(ch.kind)?.set(id, doc)
  }
  const data = fromDocs(docsOf(store), view.documents)
  return { ws: takenOutKept(kept({ ...view, ...data, workspace: view.workspace }, real, diff), real, diff), view, diff }
}

// A matrix's or table's rows and columns the changes take out stay drawn (struck by the marks), as removed docs do: the
// drawn setup hides only what was hidden before, keeps the typed rows, columns and by-hand items taken away, and a table
// keeps the rows its new rules let go (as by-hand rows at its end). The projection (what's applied) has none of them.
function takenOutKept(ws: WorkspaceCtx, real: WorkspaceCtx, diff: Map<string, PreviewChange>): WorkspaceCtx {
  let pieces = ws.pieces
  for (const p of ws.pieces) {
    if (diff.get(p.id)?.change !== 'changed') continue
    const was = real.pieces.find((x) => x.id === p.id)
    if (!was) continue
    const keepAxis = <A extends { hide?: string[]; items: { id: string }[] }>(now: A, before: A): A => ({
      ...now,
      hide: (now.hide ?? []).filter((k) => (before.hide ?? []).includes(k)),
      items: [...now.items, ...before.items.filter((i) => !now.items.some((x) => x.id === i.id))],
    })
    let next = p
    if (p.matrix && was.matrix) next = { ...p, matrix: { ...p.matrix, rows: keepAxis(p.matrix.rows, was.matrix.rows), cols: keepAxis(p.matrix.cols, was.matrix.cols) } }
    else if (p.table && was.table) {
      const rows = keepAxis(p.table.rows, was.table.rows)
      const nowKeys = new Set(tableRows(p.table, ws.cards).map((r) => r.key))
      const leaving = tableRows(was.table, real.cards).filter((r) => r.card && !nowKeys.has(r.key) && !rows.items.some((i) => (i as { cardId?: string }).cardId === r.card!.id))
      next = {
        ...p,
        table: {
          ...p.table,
          rows: { ...rows, items: [...rows.items, ...leaving.map((r) => ({ id: `${LEAVING}${r.card!.id}`, cardId: r.card!.id }))] },
          cols: [...p.table.cols, ...was.table.cols.filter((c) => !p.table!.cols.some((x) => x.id === c.id))],
        },
      }
    }
    if (next !== p) pieces = pieces.map((x) => (x.id === p.id ? next : x))
  }
  return pieces === ws.pieces ? ws : { ...ws, pieces }
}
const LEAVING = 'preview-leaving-'

// The lists the workspace holds, by field.
const LISTS = ['cards', 'labels', 'tasks', 'pieces', 'cells', 'edges', 'evidence', 'competitorFeatures', 'comparisons', 'places', 'spots', 'canvases', 'threads'] as const

// What the changes don't touch keeps the real workspace's objects, and a list with nothing touched is the real list
// itself (D-287: `useWs()` draws again only what reads a field that changed; the converters make a new card object
// for a doc made again from a card). Places and spots changed are in the diff with their card or piece, so a card or
// piece kept here is truly the same.
function kept(ws: WorkspaceCtx, real: WorkspaceCtx, diff: Map<string, PreviewChange>): WorkspaceCtx {
  const out = { ...ws } as Record<string, unknown>
  for (const k of LISTS) {
    const now = ws[k] as unknown as { id: string }[]
    const was = real[k] as unknown as { id: string }[]
    if (!now || !was) continue
    const byId = new Map(was.map((x) => [x.id, x]))
    let same = now.length === was.length
    const list = now.map((x, i) => {
      const r = !diff.has(x.id) || diff.get(x.id)?.change === 'removed' ? byId.get(x.id) : undefined
      const v = r ?? x
      if (v !== was[i]) same = false
      return v
    })
    out[k] = same ? was : list
  }
  return out as WorkspaceCtx
}

// ---- Words

const short = (v: unknown, n = 36): string => {
  if (v === undefined || v === null || v === '') return '—'
  if (typeof v === 'string') return `"${v.length > n ? `${v.slice(0, n - 1)}…` : v}"`
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.length ? (v.every((x) => typeof x === 'string') ? short(v.join(', '), n) : `${v.length} item${v.length === 1 ? '' : 's'}`) : 'none'
  const s = JSON.stringify(v)
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

const FIELD_WORD: Record<string, string> = { x: 'spot', y: 'spot', w: 'size', h: 'size', pieceId: 'plane', canvasId: 'canvas', col: 'column', stuckTo: 'stuck to', fromId: 'from', toId: 'to', validation: 'status', open: 'unframed' }
const said = (fields: string[]) => [...new Set(fields.filter((f) => !QUIET.has(f)).map((f) => FIELD_WORD[f] ?? f))]

// `field: was → now` lines for a changed doc (spots and sizes in words).
function wasLines(fields: string[], was: Record<string, unknown> | undefined, now: Record<string, unknown> | undefined): string[] {
  if (!was) return []
  const out: string[] = []
  const f = fields.filter((x) => !QUIET.has(x))
  if (f.includes('x') || f.includes('y')) out.push('spot: moved')
  if (f.includes('w') || f.includes('h')) out.push(`size: ${was.w ?? '?'} × ${was.h ?? '?'} → ${now?.w ?? '?'} × ${now?.h ?? '?'}`)
  for (const k of f) {
    if (['x', 'y', 'w', 'h'].includes(k)) continue
    if (k === 'validation') {
      const st = (v: unknown) => (typeof v === 'string' ? v : (v as { status?: string } | undefined)?.status)
      out.push(`status: ${st(was.validation) ?? '—'} → ${st(now?.validation) ?? '—'}`)
      continue
    }
    if (k === 'planes') continue
    out.push(`${FIELD_WORD[k] ?? k}: ${short(was[k])} → ${short(now?.[k])}`)
  }
  return out.slice(0, 6)
}

// ---- Lists of the workspace by collection

function listOf(ws: WorkspaceCtx, kind: Coll): { id: string }[] {
  if (isCardColl(kind)) return ws.cards
  const m: Partial<Record<Coll, { id: string }[]>> = {
    labels: ws.labels,
    tasks: ws.tasks,
    pieces: ws.pieces,
    cells: ws.cells as unknown as { id: string }[],
    edges: ws.edges,
    evidence: ws.evidence,
    competitorFeatures: ws.competitorFeatures,
    comparisons: ws.comparisons,
    places: ws.places,
    pieceSpots: ws.spots,
    canvases: ws.canvases,
    threads: ws.threads,
  }
  return m[kind] ?? []
}
const find = (ws: WorkspaceCtx, kind: Coll, id: string) => listOf(ws, kind).find((x) => x.id === id) as Record<string, unknown> | undefined

// ---- Targets

const sel = {
  card: (id: string) => `[data-target="card:${id}"]`,
  piece: (id: string) => `[data-target="plane:${id}"]`,
  label: (id: string) => `[data-target="label:${id}"]`,
  task: (id: string) => `[data-task="${id}"]`,
  link: (id: string) => `[data-target="link:${id}"]`,
  // A cell's element is keyed `cell|<matrix>|<row>|<col>` (a table's `tcell|…`), Matrix.tsx' and Table.tsx' selKey.
  cell: (c: { matrixId?: string; row?: string; col?: string }, id: string) => {
    const [m, r, k] = [c.matrixId ?? id.split('_')[0], c.row ?? id.split('_')[1], c.col ?? id.split('_')[2]]
    return `[data-cell="cell|${m}|${r}|${k}"], [data-cell="tcell|${m}|${r}|${k}"]`
  },
  canvasRow: (id: string) => `[role="menu"] [data-key="${id}"]`,
}

const verbTag = (ch: MarkChange, fields?: string[]) =>
  ch === 'added' ? '+' : ch === 'removed' ? '− deleted' : ch === 'moved' ? (fields?.includes('canvasId') ? '↦ other canvas' : fields?.includes('pieceId') ? '↦ other plane' : '↦ moved') : `~ ${said(fields ?? []).slice(0, 3).join(', ') || 'changed'}`

// The targets for the diff, on the drawn copy (`ws`) and the real workspace.
export function targetsOf(diff: Map<string, PreviewChange>, real: WorkspaceCtx, ws: WorkspaceCtx, cs: Changeset, view?: WorkspaceCtx): Target[] {
  const out: Target[] = []
  const items = new Map(cs.items.map((i) => [i.id, i]))
  const whyOf = (ch: PreviewChange) => (ch.item ? items.get(ch.item)?.why : undefined)
  const canvasName = (id: string) => ws.canvases.find((c) => c.id === id)?.name ?? 'Main'
  const planeName = (id: string) => {
    const p = ws.pieces.find((x) => x.id === id)
    return p ? p.name?.trim() || KIND_NAME[kindOfPiece(p)] : 'a plane'
  }
  const push = (t: Omit<Target, 'key' | 'was'> & { was?: string[] }) => out.push({ was: [], ...t, key: `${t.id}:${out.length}` })
  // Extra words on a card or piece's chip (evidence, features, matches added to it).
  const extra = new Map<string, { item?: string; words: string[] }>()
  const addExtra = (id: string, item: string | undefined, w: string) => {
    const e = extra.get(id) ?? { item, words: [] }
    e.words.push(w)
    extra.set(id, e)
  }

  for (const [id, c0] of diff) {
    // Only its spot (and when) changed: moved, whatever else the diff counts (an `updatedAt`).
    const ch: PreviewChange = c0.change === 'changed' && c0.fields?.length && c0.fields.every((f) => QUIET.has(f) || ['x', 'y', 'pieceId', 'canvasId'].includes(f)) && c0.fields.some((f) => !QUIET.has(f)) ? { ...c0, change: 'moved' } : c0
    const now = ch.change === 'removed' ? (ch.was as Record<string, unknown>) : find(ws, ch.kind, id)
    const was = ch.was as Record<string, unknown> | undefined
    const base = { id, change: ch.change, item: ch.item, ...(ch.change === 'removed' && whyOf(ch) ? { why: whyOf(ch) } : {}) }
    const lines = ch.change === 'changed' || ch.change === 'moved' ? wasLines(ch.fields ?? [], was, now) : []
    const sameSpace = (k: string) => was && now && was[k] === now[k]
    const geo = (ch.change === 'moved' || ch.change === 'changed') && was && now && typeof was.x === 'number' && typeof now.x === 'number' && (was.x !== now.x || was.y !== now.y) ? { dx: (was.x as number) - (now.x as number), dy: (was.y as number) - (now.y as number) } : undefined
    if (isCardColl(ch.kind)) {
      if (ch.fields?.length === 1 && ch.fields[0] === 'planes') {
        // A card brought onto (or taken off) another plane: its places carry the marks; here only the count.
        const a = ((was as Card | undefined)?.planes?.length ?? 0) + 1
        const b = ((now as Card | undefined)?.planes?.length ?? 0) + 1
        push({ ...base, change: 'changed', sel: sel.card(id), tier: 'm', tag: `~ ⧉ ${a} → ${b}`, was: [`on ${a} plane${a === 1 ? '' : 's'} → ${b}`] })
        continue
      }
      push({ ...base, sel: sel.card(id), tier: 'm', tag: verbTag(ch.change, ch.fields), was: lines, ...(geo && sameSpace('pieceId') ? { ghost: geo } : {}) })
      continue
    }
    switch (ch.kind) {
      case 'pieces': {
        const p = now as { kind?: string; x?: number; y?: number; w?: number; h?: number; canvasId?: string } | undefined
        const k = p ? kindOfPiece(p as never) : 'plane'
        const movedCanvas = ch.fields?.includes('canvasId') && was && canvasOf(was) !== canvasOf(now ?? {})
        const extraWords = k === 'kanban' && ch.fields?.includes('kanban') ? deckWords(was as never, now as never) : []
        push({
          ...base,
          sel: sel.piece(id),
          tier: 'l',
          tag: movedCanvas ? `↦ from ${canvasName(canvasOf(was!))}` : ch.change === 'changed' && ch.fields?.some((f) => ['matrix', 'table', 'kanban', 'timeline', 'documents'].includes(f)) ? `~ setup${extraWords.length ? `: ${extraWords[0]}` : ''}` : verbTag(ch.change, ch.fields),
          was: [...extraWords, ...lines.filter((l) => !/^(matrix|table|kanban|timeline|documents):/.test(l))],
          ...(geo && !movedCanvas ? { ghost: geo } : {}),
        })
        // Gone to another canvas: a dashed box where it was, on the canvas it leaves.
        if (movedCanvas && was) push({ ...base, change: 'moved', sel: '', tier: 'l', tag: `↦ to ${canvasName(canvasOf(now ?? {}))}`, away: { x: was.x as number, y: was.y as number, w: was.w as number, h: was.h as number, to: canvasOf(was) } })
        break
      }
      case 'labels': {
        const k = now ? kindOf(now as never) : 'paragraph'
        push({ ...base, sel: sel.label(id), tier: k === 'section' ? 'l' : 'm', tag: verbTag(ch.change, ch.fields), was: lines, ...(geo ? { ghost: geo } : {}) })
        break
      }
      case 'tasks': {
        const f = ch.fields ?? []
        const moved = f.some((x) => ['col', 'order', 'pieceId', 'start', 'due', 'lane', 'uid', 'cardId'].includes(x))
        push({ ...base, change: ch.change === 'changed' && f.includes('col') ? 'moved' : ch.change, sel: sel.task(id), tier: 's', tag: ch.change === 'changed' && f.includes('col') ? `↦ ${columnName(ws, now)}` : verbTag(ch.change, f), was: lines, ...(ch.change !== 'added' && ch.change !== 'removed' && moved ? { snap: true } : {}) })
        break
      }
      case 'edges': {
        const turned = ch.fields?.includes('fromId') && ch.fields?.includes('toId') && was?.fromId === now?.toId
        const ends: [string, string] | undefined = now && typeof now.fromId === 'string' && typeof now.toId === 'string' ? [now.fromId, now.toId] : undefined
        push({ ...base, sel: sel.link(id), line: true, ...(ends ? { ends } : {}), tier: 's', tag: turned ? '⇄ turned round' : verbTag(ch.change, ch.fields), was: turned ? ['turned round'] : lines })
        break
      }
      case 'cells': {
        push({ ...base, sel: sel.cell((now ?? {}) as { matrixId?: string; row?: string; col?: string }, id), tier: 's', tag: ch.change === 'added' ? '+' : ch.change === 'removed' ? '− cleared' : '~', was: ch.change === 'changed' ? lines : ch.change === 'added' ? ['was empty'] : [] })
        break
      }
      case 'places': {
        const pl = (now ?? was) as { planeId: string; cardId: string; x?: number; y?: number }
        if (!pl) break
        push({ ...base, id: pl.cardId, sel: sel.card(pl.cardId), within: pl.planeId, tier: 'm', tag: ch.change === 'added' ? '+ ⧉ also here' : ch.change === 'removed' ? '− off this plane' : '↦ moved', was: ch.change === 'removed' ? [`taken off ${planeName(pl.planeId)}; it stays on its other planes`] : lines, ...(geo ? { ghost: geo } : {}) })
        break
      }
      case 'pieceSpots': {
        const s = (now ?? was) as { pieceId: string; canvasId: string }
        if (!s) break
        const here = ws.canvas === s.canvasId
        push({ ...base, id: s.pieceId, change: here ? ch.change : 'changed', sel: sel.piece(s.pieceId), tier: 'l', tag: here ? (ch.change === 'added' ? '+ ⧉ also on this canvas' : ch.change === 'removed' ? '− off this canvas' : '↦ moved') : `~ ${ch.change === 'removed' ? 'off' : 'also on'} ${canvasName(s.canvasId)}`, was: [], ...(geo && here ? { ghost: geo } : {}) })
        break
      }
      case 'canvases':
        push({ ...base, sel: sel.canvasRow(id), tier: 's', tag: verbTag(ch.change, ch.fields), was: lines })
        break
      case 'evidence': {
        const e = (now ?? was) as { nodeId?: string; stance?: string }
        if (e?.nodeId) addExtra(e.nodeId, ch.item, `${ch.change === 'added' ? '+' : ch.change === 'removed' ? '−' : '~'} evidence${e.stance === 'contradicts' ? ' −' : e.stance === 'supports' ? ' +' : ''}`)
        break
      }
      case 'competitorFeatures': {
        const f = (now ?? was) as { competitorId?: string; name?: string }
        if (f?.competitorId) addExtra(f.competitorId, ch.item, `${ch.change === 'added' ? '+' : ch.change === 'removed' ? '−' : '~'} feature ${short(f.name, 24)}`)
        break
      }
      case 'comparisons': {
        const m = (now ?? was) as { competitorId?: string }
        if (m?.competitorId) addExtra(m.competitorId, ch.item, `${ch.change === 'added' ? '+' : ch.change === 'removed' ? '−' : '~'} match`)
        break
      }
      default:
        break
    }
  }

  // Evidence, features and matches: on their card, joined to its own target (or one of their own).
  for (const [id, e] of extra) {
    const t = out.find((x) => x.id === id && !x.within && x.sel === sel.card(id))
    if (t) {
      t.was = [...t.was, ...e.words]
      if (t.change === 'changed') t.tag = `${t.tag}, ${e.words.length > 1 ? `${e.words.length} more` : e.words[0].replace(/^[+−~] /, '')}`
    } else push({ id, change: 'changed', sel: sel.card(id), tier: 'm', tag: `~ ${e.words.length === 1 ? e.words[0].replace(/^~ /, '') : `${e.words.length} changes`}`, was: e.words, item: e.item })
  }

  // Lenses: a matrix's heads and a table's rows and columns that come (`+`) or go (`−`, still drawn: takenOutKept),
  // measured on the real workspace, the projection (`after`) and the drawn copy. Many rows of one table: one chip on the
  // table (`+ 8 rows join`), the rows lit without chips of their own.
  const after = view ?? viewOf(cs, real)
  const gone = new Set([...diff].filter(([, c]) => c.change === 'removed').map(([i]) => i))
  const onPiece = (p: { id: string }, words: string[], item?: string) => {
    if (!words.length) return
    const pt = out.find((t) => t.id === p.id && t.sel === sel.piece(p.id))
    if (pt) (pt.was = [...words, ...pt.was]), (pt.tag = `${pt.tag} · ${words.join(' · ')}`)
    else push({ id: p.id, change: 'changed', sel: sel.piece(p.id), tier: 'l', tag: `~ ${words.join(' · ')}`, was: words, item })
  }
  for (const p of ws.pieces) {
    const k = kindOfPiece(p)
    if (k !== 'matrix' && k !== 'table') continue
    const before = real.pieces.find((x) => x.id === p.id)
    const then = after.pieces.find((x) => x.id === p.id)
    if (!before || !then) continue
    const item = diff.get(p.id)?.item ?? cs.items.find((i) => i.ids.includes(p.id))?.id
    if (k === 'matrix' && p.matrix && before.matrix && then.matrix) {
      for (const which of ['rows', 'cols'] as const) {
        const had = new Set(entriesOf(before.matrix[which], real.cards).map((e) => e.key))
        const stays = new Set(entriesOf(then.matrix[which], after.cards).map((e) => e.key))
        const one = which === 'rows' ? 'row' : 'column'
        for (const e of entriesOf(p.matrix[which], ws.cards)) {
          const s_ = `[data-find="${which}|${e.key}"]`
          if (!had.has(e.key)) push({ id: `${p.id}|${which}|${e.key}`, change: 'added', sel: s_, up: '[data-find-box]', within: p.id, tier: 's', tag: '+', was: [`new ${one}`], item: e.card ? (diff.get(e.card.id)?.item ?? item) : item })
          else if (!stays.has(e.key) || gone.has(e.key)) push({ id: `${p.id}|${which}|${e.key}`, change: 'removed', sel: s_, up: '[data-find-box]', within: p.id, tier: 's', tag: '−', was: [`${one} taken out`], why: items.get(diff.get(p.id)?.item ?? '')?.why ?? (e.card ? items.get(diff.get(e.card.id)?.item ?? '')?.why : undefined), item: diff.get(e.key)?.item ?? item })
        }
      }
    }
    if (k === 'table' && p.table && before.table && then.table) {
      const had = new Set(tableRows(before.table, real.cards).map((r) => r.key))
      const stays = new Set(tableRows(then.table, after.cards).map((r) => r.key))
      const rows = tableRows(p.table, ws.cards)
      const joins = rows.filter((r) => !had.has(r.key))
      const leaves = rows.filter((r) => had.has(r.key) && (!stays.has(r.key) || gone.has(r.key)))
      const many = (n: number) => n > 3
      joins.forEach((r, i) => push({ id: `${p.id}|row|${r.key}`, change: 'added', sel: `[data-find="n|${r.key}"]`, up: '[data-find-box]', within: p.id, tier: 's', tag: '+', was: ['joins the table'], ...(many(joins.length) ? (i ? { quiet: true } : { groupTag: `+ ${joins.length} rows join` }) : {}), item: r.card ? (diff.get(r.card.id)?.item ?? item) : item }))
      leaves.forEach((r, i) => push({ id: `${p.id}|row|${r.key}`, change: 'removed', sel: `[data-find="n|${r.key}"]`, up: '[data-find-box]', within: p.id, tier: 's', tag: '−', was: ['leaves the table'], ...(many(leaves.length) ? (i ? { quiet: true } : { groupTag: `− ${leaves.length} rows leave` }) : {}), item: diff.get(r.key)?.item ?? item }))
      onPiece(p, [...(many(joins.length) ? [`+ ${joins.length} rows join`] : []), ...(many(leaves.length) ? [`− ${leaves.length} rows leave`] : [])], item)
      const cols = new Set(before.table.cols.map((c) => c.id))
      const keep = new Set(then.table.cols.map((c) => c.id))
      for (const c of p.table.cols) {
        if (!cols.has(c.id)) push({ id: `${p.id}|col|${c.id}`, change: 'added', sel: `[data-find="h|${c.id}"]`, up: '[data-find-box]', within: p.id, tier: 's', tag: '+', was: ['new column'], item })
        else if (!keep.has(c.id)) push({ id: `${p.id}|col|${c.id}`, change: 'removed', sel: `[data-find="h|${c.id}"]`, up: '[data-find-box]', within: p.id, tier: 's', tag: '−', was: ['column taken out'], item })
      }
    }
  }
  return out
}

function columnName(ws: WorkspaceCtx, task: Record<string, unknown> | undefined): string {
  if (!task) return 'moved'
  const deck = ws.pieces.find((p) => p.id === task.pieceId)
  const col = deck?.kanban?.cols.find((c) => c.id === task.col)
  return col?.name ? col.name : 'another column'
}

function deckWords(was: { kanban?: { cols: { id: string; name: string }[] } } | undefined, now: { kanban?: { cols: { id: string; name: string }[] } } | undefined): string[] {
  const a = was?.kanban?.cols ?? []
  const b = now?.kanban?.cols ?? []
  const out: string[] = []
  for (const c of b) if (!a.some((x) => x.id === c.id)) out.push(`+ column "${c.name}"`)
  for (const c of a) if (!b.some((x) => x.id === c.id)) out.push(`− column "${c.name}"`)
  for (const c of b) {
    const o = a.find((x) => x.id === c.id)
    if (o && o.name !== c.name) out.push(`column "${o.name}" → "${c.name}"`)
  }
  return out
}

// Where the stepper goes for an item: the first thing it makes or writes that has a place to be seen.
export function goOf(item: ChangeItem, ws: WorkspaceCtx): Go | null {
  const order = [...item.made, ...item.ids.filter((x) => !item.made.includes(x))]
  for (const id of order) {
    if (ws.cards.some((c) => c.id === id) || ws.tasks.some((t) => t.id === id) || ws.labels.some((l) => l.id === id) || ws.canvases.some((c) => c.id === id)) return { id }
    const piece = ws.pieces.find((p) => p.id === id)
    if (piece) return ['matrix', 'table'].includes(kindOfPiece(piece)) && !item.made.includes(id) ? { id, focus: true } : { id }
    const place = ws.places.find((p) => p.id === id)
    if (place) return { id: place.cardId, plane: place.planeId }
    const spot = ws.spots.find((s) => s.id === id)
    if (spot) return { id: spot.pieceId, canvas: spot.canvasId }
    const edge = ws.edges.find((e) => e.id === id)
    if (edge) return { id: edge.fromId }
    const cell = (ws.cells as unknown as { id: string; matrixId?: string }[]).find((c) => c.id === id)
    if (cell) return { id: cell.matrixId ?? id.split('_')[0], focus: true }
    const ev = ws.evidence.find((e) => e.id === id)
    if (ev) return { id: ev.nodeId }
    const f = ws.competitorFeatures.find((x) => x.id === id)
    if (f) return { id: f.competitorId }
    const m = ws.comparisons.find((x) => x.id === id)
    if (m) return { id: m.competitorId }
  }
  return null
}

// ---- The preview's state (one at a time), outside React

type Computed = { real: WorkspaceCtx; version: number; cs: Changeset; ws: WorkspaceCtx; view: WorkspaceCtx; diff: Map<string, PreviewChange>; targets: Target[] }
type Open = { store: Store; cs: Changeset; overlay: (real: WorkspaceCtx) => WorkspaceCtx; current: string | null }

let open: Open | null = null
let made: Computed | null = null
const subs = new Set<() => void>()
const tellAll = () => subs.forEach((on) => on())

function compute(real: WorkspaceCtx, cs: Changeset): Computed {
  if (made && made.real === real && made.cs === cs && made.version === cs.version) return made
  const { ws, view, diff } = drawnWs(real, cs)
  made = { real, cs, version: cs.version, ws, view, diff, targets: targetsOf(diff, real, ws, cs, view) }
  return made
}

// Called with the targets just before the store is overlaid, while the real workspace is still drawn (the mark layer
// notes where things were: a task's old column, a bar's old days).
let beforeOpen: ((targets: Target[]) => void) | null = null
export const setBeforeOpen = (fn: ((targets: Target[]) => void) | null) => void (beforeOpen = fn)

// Opens the preview of `cs` on `store` (the workspace shown when left out): the store overlaid, marks worked out.
export function openPreview(cs: Changeset, store: Store | null = activeStore()) {
  if (!store) return
  if (open && open.store !== store) open.store.overlay(null)
  const o: Open = { store, cs, overlay: (real) => compute(real, o.cs).ws, current: null }
  made = null
  if (beforeOpen && !store.overlaid()) beforeOpen(compute(store.real(), cs).targets)
  open = o
  store.overlay(o.overlay)
  tellAll()
}

// The changes changed (an untick, a tick back on, a rebuilt accept): the overlay and marks again.
export function updatePreview(cs: Changeset) {
  if (!open) return openPreview(cs)
  if (open.cs === cs) return
  const o: Open = { ...open, cs, overlay: (real) => compute(real, o.cs).ws }
  open = o
  o.store.overlay(o.overlay)
  tellAll()
}

// Closed (applied, discarded, revising): the store shows the real workspace again.
export function closePreview() {
  if (!open) return
  open.store.overlay(null)
  open = null
  made = null
  tellAll()
}

// The item the stepper is on (its marks lit).
export function setCurrent(item: string | null) {
  if (!open || open.current === item) return
  open = { ...open, current: item }
  tellAll()
}

export type PreviewState = { cs: Changeset; ws: WorkspaceCtx; real: WorkspaceCtx; view: WorkspaceCtx; diff: Map<string, PreviewChange>; targets: Target[]; current: string | null }

// The preview as it is now (null when none is open): worked out for the store's real value at the time.
// The same object while nothing changed (React's useSyncExternalStore reads it as a snapshot).
let shown: { c: Computed; current: string | null; s: PreviewState } | null = null
export function previewState(): PreviewState | null {
  if (!open) return null
  const c = compute(open.store.real(), open.cs)
  if (shown && shown.c === c && shown.current === open.current) return shown.s
  const s = { cs: c.cs, ws: c.ws, real: c.real, view: c.view, diff: c.diff, targets: c.targets, current: open.current }
  shown = { c, current: open.current, s }
  return s
}

export const previewOpen = () => !!open

// A canvas the open preview shows (one it adds included), for the layout's `?canvas=` check.
export const previewHasCanvas = (id: string) => !!open && !!previewState()?.ws.canvases.some((c) => c.id === id)
// Its name, for the breadcrumb on a canvas only the preview has.
export const previewCanvasName = (id: string): string | undefined => (open ? previewState()?.ws.canvases.find((c) => c.id === id)?.name : undefined)

// Told when the preview opens, closes or changes, and when the workspace under it changes.
export function subscribePreview(on: () => void): () => void {
  subs.add(on)
  let unStore: (() => void) | null = null
  let store: Store | null = null
  const follow = () => {
    if (open?.store === store) return
    unStore?.()
    store = open?.store ?? null
    unStore = store ? store.subscribe(on) : null
  }
  const wrapped = () => {
    follow()
    on()
  }
  subs.delete(on)
  subs.add(wrapped)
  follow()
  return () => {
    subs.delete(wrapped)
    unStore?.()
  }
}
