// Cleaning a workspace's docs into the shapes firestore.rules accepts (D-246), without Firebase (S3, D-312): moved out of
// io/bundle.ts (which re-exports all of it) so the ops' validate can use it in node.
import { CARD_TYPES, FEATURE_EFFORTS, FEATURE_IMPACTS, FEATURE_PRIORITIES, FEATURE_STATUSES, VALIDATIONS, type AnyType } from './cards'
import { AVAILABILITIES, CARD_FIELDS, CELL_KINDS, COL_W, CONFIDENCES, CRITERION_SCORES, DOC_COLS, DOC_KINDS, DOC_LIMITS, EVIDENCE_KINDS, FIELDS, OWN_KINDS, TONES, TOTALS_AS, TOTALS_AT, UNFOLDS } from './shapes'
import { newId } from './scales'
import { RULE_FIELDS } from './source'
import type { DocBody } from '../data/documents'

export type Raw = Record<string, unknown> & { id: string }

// A document (D-232): its summary with its content beside it.
export type BundleDocument = Raw & { body?: DocBody }

// ---- Cleaning: a bundle is a file anyone could have edited, so every doc is rebuilt from known fields only, in the
// shapes firestore.rules accepts (change both together). Ids are new: `Ids` gives the new id of what a doc points at,
// or nothing when that didn't come over.

export type Ids = {
  // Cards of every type and competitor features.
  card: (old: unknown) => { id: string; type: AnyType | 'competitorFeature' } | undefined
  piece: (old: unknown) => string | undefined
  doc: (old: unknown) => string | undefined
}

export function str(v: unknown, max: number): string | undefined {
  return typeof v === 'string' ? v.slice(0, max) : undefined
}
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const int = (v: unknown, min: number, max: number) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : undefined)
const oneOf = <T extends string | number>(v: unknown, values: readonly T[]) => (values.includes(v as T) ? (v as T) : undefined)
const yes = (v: unknown) => (v === true ? true : undefined)
const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined)
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
const strings = (v: unknown, max: number, len: number) => list(v, max).filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, len))
const tags = (v: unknown, max = 30) => {
  const t = strings(v, max, 60)
  return t.length ? t : undefined
}
// A size the rules take (> 0, ≤ 100000).
const size = (v: unknown) => {
  const n = num(v)
  return n !== undefined && n > 0 && n <= 100000 ? n : undefined
}
const obj = (v: unknown): Record<string, unknown> | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined)

// Drops undefined fields (Firestore refuses them).
function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

const times = (d: Raw, now: number) => ({ createdAt: num(d.createdAt) ?? now, updatedAt: num(d.updatedAt) ?? now })

// Ids a setup gives its own entries (matrix.ts' newId): only safe ones are kept as they are.
const OWN_ID = /^[A-Za-z0-9_-]{1,40}$/
const ownId = (v: unknown) => (typeof v === 'string' && OWN_ID.test(v) ? v : newId())

// ---- Cards (cards.ts). `pieceId` and a package's members are added by the importer.

export function cleanCard(type: AnyType, d: Raw, now: number) {
  const competitor = type === 'competitor'
  const x = num(d.x)
  const y = num(d.y)
  if (x === undefined || y === undefined) return null
  return compact({
    ...(competitor ? { name: str(d.name, 200) ?? '' } : { title: str(d.title, 200) ?? '' }),
    x,
    y,
    tags: tags(d.tags),
    folded: yes(d.folded),
    // Notes: a competitor's `notes`, every other card's `body`.
    ...(competitor
      ? {
          notes: str(d.notes, 20000),
          url: str(d.url, 2000),
          description: str(d.description, 20000),
          pricing: str(d.pricing, 2000),
          audience: str(d.audience, 2000),
          regions: tags(d.regions, 20),
        }
      : { body: str(d.body, 20000), validation: oneOf(d.validation, VALIDATIONS) }),
    ...(type === 'feature' && {
      priority: oneOf(d.priority, FEATURE_PRIORITIES),
      status: oneOf(d.status, FEATURE_STATUSES),
      criteria: criteria(d.criteria),
    }),
    ...((type === 'feature' || type === 'package') && {
      impact: oneOf(d.impact, FEATURE_IMPACTS),
      effort: oneOf(d.effort, FEATURE_EFFORTS),
    }),
    ...times(d, now),
  })
}

// A feature's must-haves (D-133): ids kept as they are (the cells' scores refer to them), only safe ones.
const CRITERION_ID = /^[a-z0-9]{1,16}$/
function criteria(v: unknown) {
  const out = list(v, 8)
    .map(obj)
    .filter((c): c is Record<string, unknown> => !!c && typeof c.id === 'string' && CRITERION_ID.test(c.id))
    .map((c) => ({ id: c.id as string, text: str(c.text, 200) ?? '' }))
  return out.length ? out : undefined
}

function scores(v: unknown) {
  const o = obj(v)
  if (!o) return undefined
  const kept = Object.entries(o).filter(([id, s]) => CRITERION_ID.test(id) && oneOf(s, CRITERION_SCORES)).slice(0, 8)
  return kept.length ? Object.fromEntries(kept) : undefined
}

// ---- What hangs off the cards

export function cleanCompetitorFeature(d: Raw, now: number) {
  return compact({
    name: str(d.name, 200) ?? '',
    description: str(d.description, 20000),
    category: str(d.category, 100),
    availability: oneOf(d.availability, AVAILABILITIES),
    url: str(d.url, 2000),
    ...times(d, now),
  })
}

export function cleanComparison(d: Raw, now: number) {
  return compact({ criteria: scores(d.criteria), updatedAt: num(d.updatedAt) ?? now })
}

// One piece of evidence (D-137), without its card.
export function cleanEvidence(d: Raw, now: number) {
  const text = str(d.text, 2000)?.trim()
  const kind = oneOf(d.kind, EVIDENCE_KINDS)
  const stance = oneOf(d.stance, ['supports', 'contradicts'] as const)
  if (!text || !kind || !stance) return null
  const date = typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : undefined
  return compact({ text, kind, stance, source: str(d.source, 200), url: str(d.url, 2000), date, ...times(d, now) })
}

// A link, without its ends; bend points in an older file are left out (D-292).
export function cleanEdge(d: Raw) {
  const kind = str(d.kind, 40)
  if (!kind) return null
  return compact({ kind, label: str(d.label, 200) })
}

// ---- Text (labels.ts), without its space

export function cleanLabel(d: Raw, now: number) {
  const x = num(d.x)
  const y = num(d.y)
  if (x === undefined || y === undefined) return null
  const kind = oneOf(d.kind, ['title', 'section', 'sticky'] as const)
  const w = size(d.w)
  const h = size(d.h)
  // A section without a size isn't one (rules).
  if (kind === 'section' && (!w || !h)) return null
  const sizeName = oneOf(d.size, ['heading', 'subheading', 'minor', 'note'] as const)
  const long = sizeName === 'note' || kind === 'sticky'
  return compact({
    text: kind === 'title' ? '' : (str(d.text, long ? 4000 : 200) ?? ''),
    x,
    y,
    kind,
    size: sizeName,
    color: str(d.color, 20),
    bold: yes(d.bold),
    italic: yes(d.italic),
    caps: yes(d.caps),
    rotate: oneOf(d.rotate, [90, -90] as const),
    kicker: str(d.kicker, 60),
    side: kind === 'section' && d.side === 'left' ? ('left' as const) : undefined,
    scale: oneOf(d.scale, ['small', 'medium', 'large'] as const),
    uid: kind === 'sticky' ? str(d.uid, 128) : undefined,
    author: kind === 'sticky' ? str(d.author, 200) : undefined,
    folded: kind === 'sticky' ? yes(d.folded) : undefined,
    w,
    h: kind === 'section' ? h : undefined,
    ...times(d, now),
  })
}

// ---- Pieces (pieces.ts): their setups point at cards, planes and documents, all given their new ids here.

const PIECE_KINDS = ['plane', 'matrix', 'table', 'documents', 'document', 'kanban', 'timeline'] as const

export function cleanPiece(d: Raw, now: number, ids: Ids) {
  const kind = oneOf(d.kind, PIECE_KINDS)
  const x = num(d.x)
  const y = num(d.y)
  const w = size(d.w)
  const h = size(d.h)
  if (!kind || x === undefined || y === undefined || !w || !h) return null
  const docId = kind === 'document' ? ids.doc(d.docId) : undefined
  // A document on its own that didn't come over (someone else's private one) shows nothing.
  if (kind === 'document' && !docId) return null
  const lens = kind === 'matrix' || kind === 'table'
  const matrix = kind === 'matrix' ? cleanMatrix(d.matrix, ids) : undefined
  const table = kind === 'table' ? cleanTable(d.table, ids) : undefined
  return compact({
    kind,
    x,
    y,
    w,
    h,
    name: str(d.name, 80)?.trim() || undefined,
    matrix,
    table,
    documents: kind === 'documents' ? cleanDocumentsSetup(d.documents) : undefined,
    kanban: kind === 'kanban' ? cleanKanban(d.kanban, ids) : undefined,
    timeline: kind === 'timeline' ? cleanTimeline(d.timeline, ids) : undefined,
    docId,
    stuckTo: lens || kind === 'kanban' || kind === 'timeline' ? ids.piece(d.stuckTo) : undefined,
    open: kind !== 'plane' ? bool(d.open) : undefined,
    ...times(d, now),
  })
}

type Item = { id: string; name?: string; cardType?: string; cardId?: string }

// Entries added by hand: a typed name, or a card (dropped when the card didn't come over).
function items(v: unknown, ids: Ids): Item[] {
  return list(v, 200).flatMap((raw) => {
    const i = obj(raw)
    if (!i) return []
    if (i.cardId !== undefined) {
      const card = ids.card(i.cardId)
      return card && card.type !== 'competitorFeature' ? [{ id: ownId(i.id), cardType: card.type, cardId: card.id }] : []
    }
    return [compact({ id: ownId(i.id), name: str(i.name, 200) ?? '' }) as Item]
  })
}

// Cards taken out by hand (or shown open, D-249): only those that came over.
const hidden = (v: unknown, ids: Ids) => {
  const out = list(v, 200).flatMap((c) => ids.card(c)?.id ?? [])
  return out.length ? out : undefined
}

function steps(v: unknown) {
  return list(v, 9).flatMap((raw) => {
    const s = obj(raw)
    if (!s) return []
    return [{ id: str(s.id, 40) || newId(), glyph: str(s.glyph, 4) ?? '', label: str(s.label, 40) ?? '', tone: oneOf(s.tone, TONES) ?? 'fg' }]
  })
}

function cleanAxis(v: unknown, ids: Ids) {
  const a = obj(v) ?? {}
  const plane = a.plane === undefined ? undefined : (ids.piece(a.plane) ?? str(a.plane, 128))
  return compact({
    type: oneOf(a.type, CARD_TYPES),
    plane,
    hide: hidden(a.hide, ids),
    items: items(a.items, ids),
    noun: str(a.noun, 40),
    // Unfolded into what they're judged on (D-249); the cards shown open, those that came over.
    unfold: oneOf(a.unfold, UNFOLDS),
    open: hidden(a.open, ids),
  })
}

function cleanMatrix(v: unknown, ids: Ids) {
  const m = obj(v)
  if (!m) return undefined
  return compact({
    rows: cleanAxis(m.rows, ids),
    cols: cleanAxis(m.cols, ids),
    cell: oneOf(m.cell, CELL_KINDS) ?? 'scale',
    steps: steps(m.steps),
    unit: str(m.unit, 20),
    notRelevant: bool(m.notRelevant),
    confidence: bool(m.confidence),
    reading: bool(m.reading),
    totalsAt: oneOf(m.totalsAt, TOTALS_AT),
    totalsAs: oneOf(m.totalsAs, TOTALS_AS),
    marks: bool(m.marks),
  })
}

// Where a lens's rows (or a kanban's cards, D-268) come from (D-209): its rules, the planes they name and the cards
// hidden or added that came over.
function cleanSource(v: unknown, ids: Ids) {
  const rows = obj(v) ?? {}
  const rules = list(rows.rules, 12).flatMap((raw) => {
    const r = obj(raw)
    const field = oneOf(r?.field, RULE_FIELDS)
    if (!r || !field) return []
    let values = strings(r.values, 50, 200)
    // A plane rule names planes: only those that came over.
    if (field === 'plane') values = values.flatMap((p) => ids.piece(p) ?? [])
    return [compact({ field, not: yes(r.not), values, auto: yes(r.auto) })]
  })
  return compact({ rules, hide: hidden(rows.hide, ids), items: items(rows.items, ids) })
}

function cleanTable(v: unknown, ids: Ids) {
  const t = obj(v)
  if (!t) return undefined
  const cols = list(t.cols, 30).flatMap((raw) => {
    const c = obj(raw)
    if (!c) return []
    const width = num(c.width)
    const kind = oneOf(c.kind, OWN_KINDS)
    return [
      compact({
        id: ownId(c.id),
        field: oneOf(c.field, FIELDS),
        name: str(c.name, 40),
        kind,
        steps: c.steps === undefined ? undefined : steps(c.steps),
        unit: str(c.unit, 20),
        width: width === undefined ? undefined : Math.round(Math.min(COL_W.max, Math.max(COL_W.min, width))),
      }),
    ]
  })
  const sort = obj(t.sort)
  const nameWidth = num(t.nameWidth)
  return compact({
    rows: cleanSource(t.rows, ids),
    manual: yes(t.manual),
    cols,
    sort: sort && typeof sort.col === 'string' ? compact({ col: sort.col.slice(0, 128), desc: yes(sort.desc) }) : undefined,
    pageSize: int(t.pageSize, 1, 1000),
    nameWidth: nameWidth === undefined ? undefined : Math.round(Math.min(COL_W.max, Math.max(COL_W.min, nameWidth))),
  })
}

// A documents list's setup (rules: these keys only).
function cleanDocumentsSetup(v: unknown) {
  const t = obj(v)
  const sort = obj(t?.sort)
  const kinds = strings(t?.kinds, 4, 20).filter((k) => (DOC_KINDS as readonly string[]).includes(k))
  return compact({
    view: oneOf(t?.view, ['table', 'shelf'] as const) ?? 'table',
    kinds: kinds.length ? kinds : undefined,
    sort: sort && oneOf(sort.col, DOC_COLS) ? compact({ col: sort.col as string, desc: bool(sort.desc) }) : undefined,
    pageSize: int(t?.pageSize, 1, 100),
  })
}

// A kanban's columns (D-251; rules: 1–12, these keys only); none left, it starts over.
// A timeline's setup (D-262): the kanbans it shows that came over, its rows.
export function cleanTimeline(v: unknown, ids: Ids) {
  const kanbans = list(obj(v)?.kanbans, 20).flatMap((k) => ids.piece(k) ?? [])
  return compact({ kanbans: kanbans.length ? kanbans : undefined, rows: oneOf(obj(v)?.rows, ['kanban', 'assignee', 'card'] as const) })
}

// Holding cards (D-268): which (its source) and the field its columns come from.
export function cleanKanban(v: unknown, ids: Ids) {
  const seen = new Set<string>()
  const cols = list(obj(v)?.cols, 12).flatMap((raw) => {
    const c = obj(raw)
    const name = str(c?.name, 40)?.trim()
    const id = ownId(c?.id)
    if (!c || !name || seen.has(id)) return []
    seen.add(id)
    const limit = num(c.limit)
    return [compact({ id, name, done: yes(c.done), limit: limit && limit >= 1 ? Math.min(99, Math.round(limit)) : undefined })]
  })
  const cards = oneOf(obj(v)?.holds, ['cards'] as const)
  return compact({
    cols: cols.length ? cols : [{ id: newId(), name: 'todo' }],
    everyPlane: yes(obj(v)?.everyPlane),
    rows: oneOf(obj(v)?.rows, ['assignee', 'card'] as const),
    holds: cards,
    source: obj(v)?.source ? cleanSource(obj(v)!.source, ids) : undefined,
    colField: oneOf(obj(v)?.colField, CARD_FIELDS),
    // Its rows and its boxes' names (D-269).
    rowField: oneOf(obj(v)?.rowField, CARD_FIELDS),
    names: boxNames(obj(v)?.names),
  })
}

// A kanban's box names (D-269): a column, a row, a name (≤ 40) and a tone; none left, none.
function boxNames(v: unknown) {
  const out = list(v, 40).flatMap((raw) => {
    const n = obj(raw)
    const col = str(n?.col, 40)
    const row = str(n?.row, 40)
    const name = str(n?.name, 40) ?? ''
    const tone = oneOf(n?.tone, ['good', 'bad'] as const)
    return n && col !== undefined && row !== undefined && (name.trim() || tone) ? [compact({ col, row, name, tone })] : []
  })
  return out.length ? out : undefined
}

// A card on a plane besides its home (D-281), without the two (their new ids are the importer's).
export function cleanPlace(d: Raw, now: number) {
  const x = num(d.x)
  const y = num(d.y)
  if (x === undefined || y === undefined) return null
  return compact({ x, y, folded: yes(d.folded), createdAt: num(d.createdAt) ?? now })
}

// One of a kanban's tasks (D-251), without its kanban, its card or who made it; who it was given to stays behind (the
// people don't travel).
export function cleanTask(d: Raw, now: number) {
  const title = str(d.title, 200)?.trim()
  const order = num(d.order)
  if (!title || order === undefined) return null
  const checks = list(d.checks, 50).flatMap((raw) => {
    const c = obj(raw)
    const text = str(c?.text, 200)
    return c && text ? [compact({ id: ownId(c.id), text, done: yes(c.done) })] : []
  })
  const due = typeof d.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.due) ? d.due : undefined
  const labels = [...new Set(list(d.labels, 20).flatMap((l) => str(l, 40)?.trim() || []))]
  const priority = oneOf(d.priority, ['P1', 'P2', 'P3'] as const)
  return compact({ order, title, notes: str(d.notes, 20000), due, checks: checks.length ? checks : undefined, labels: labels.length ? labels : undefined, priority, ...times(d, now) })
}

// One of a matrix's or a table's cells, without its matrix, row and column.
export function cleanCell(d: Raw, now: number) {
  const value = num(d.value) ?? str(d.value, 200)
  return compact({
    value,
    notes: str(d.notes, 20000),
    notRelevant: bool(d.notRelevant),
    confidence: oneOf(d.confidence, CONFIDENCES),
    updatedAt: num(d.updatedAt) ?? now,
  })
}

// ---- Documents (documents.ts): a .md or a report, whose content travels with it. Images and PDFs are files in Storage,
// which needs the Blaze plan: not exported yet. The importer adds whose it is now.

export function cleanDocument(d: BundleDocument, now: number, ids: Ids) {
  const kind = oneOf(d.kind, ['markdown', 'report'] as const)
  const title = str(d.title, DOC_LIMITS.title)?.trim()
  const b = obj(d.body) ?? {}
  if (!kind || !title) return null
  const body: DocBody = kind === 'markdown' ? { text: str(b.text, DOC_LIMITS.text) ?? '' } : reportBody(b, ids)
  const summary = compact({
    kind,
    title,
    excerpt: str(d.excerpt, DOC_LIMITS.excerpt),
    origin: oneOf(d.origin, ['upload', 'assistant', 'moved'] as const) ?? 'upload',
    // Whoever added it, by name (the importer's when the file has none).
    name: str(d.name, 200) || undefined,
    shared: d.shared === true,
    contentType: kind === 'markdown' ? ('text/markdown' as const) : undefined,
    size: bytes(kind === 'markdown' ? (body.text ?? '') : JSON.stringify(body)),
    words: kind === 'markdown' ? (body.text?.match(/\S+/g) ?? []).length : undefined,
    sections: kind === 'report' ? body.sections!.length : undefined,
    sources: kind === 'report' ? body.sources!.length : undefined,
    topic: str(d.topic, 500),
    model: str(d.model, 100),
    reportKind: kind === 'report' ? (oneOf(d.reportKind, ['research', 'chat', 'upload'] as const) ?? 'research') : undefined,
    ...times(d, now),
  })
  return { summary, body }
}

const bytes = (s: string) => new TextEncoder().encode(s).length

// A report's content within the rules' limits; the cards its implications name follow them.
function reportBody(b: Record<string, unknown>, ids: Ids): DocBody {
  const sources = list(b.sources, 200)
    .map((s) => ({ title: str(obj(s)?.title, 500) ?? '', url: str(obj(s)?.url, 2000) ?? '' }))
    .filter((s) => /^https?:\/\//.test(s.url))
  const nums = (v: unknown) => list(v, 20).filter((n): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= sources.length)
  return {
    answer: str(b.answer, 4000) ?? '',
    sections: list(b.sections, 30).map((s) => ({
      question: str(obj(s)?.question, 1000) ?? '',
      points: list(obj(s)?.points, 40).map((p) => ({ text: str(obj(p)?.text, 2000) ?? '', sources: nums(obj(p)?.sources) })),
    })),
    implications: list(b.implications, 20).map((x) => ({
      text: str(obj(x)?.text, 2000) ?? '',
      items: list(obj(x)?.items, 20).flatMap((i) => ids.card(i)?.id ?? []),
    })),
    openQuestions: list(b.openQuestions, 30).map((q) => str(q, 2000) ?? ''),
    sources,
  }
}
