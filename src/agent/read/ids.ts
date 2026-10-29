// Short, typed ids for one chat (agent.md §1 point 9, §4.4): `c12` instead of a 20-character Firestore id. The model
// reads and writes these; the browser maps them back. One registry per chat, saved with it (S16): `toJSON()` and
// `makeIds(saved)`.
//
// Prefixes: c card (packages too) · p piece (plane, matrix, table, deck, timeline, documents, document) · x text
// (heading, paragraph, sticky, section, the project title) · t task · e link · v evidence · f a competitor's feature ·
// d document · k canvas · m comment thread · u person.
//
// Order: `sync(ws)` gives everything in the snapshot that has no id yet the next number of its prefix, in a stable
// order: by creation time where the thing carries one, else by where it is (a card: its home plane's order, the chain's
// type order, then reading order), then by its real id. The same snapshot gives the same ids; something new gets the
// next number; a number is never given twice in a chat, even when its thing is deleted.
import { ALL_TYPES } from '../../model/cards'
import { canvasOf } from '../../model/canvases'
import { kindOf } from '../../model/labels'
import { kindOfPiece, KIND_NAME } from '../../model/pieces'
import { derive, nameOf, type Derived, clean } from './derive'
import { norm, oneLine } from './text'
import type { ReadWs } from './types'

export type IdKind = 'card' | 'piece' | 'text' | 'task' | 'link' | 'evidence' | 'feature' | 'document' | 'canvas' | 'thread' | 'person'
export const PREFIX: Record<IdKind, string> = {
  card: 'c',
  piece: 'p',
  text: 'x',
  task: 't',
  link: 'e',
  evidence: 'v',
  feature: 'f',
  document: 'd',
  canvas: 'k',
  thread: 'm',
  person: 'u',
}
const KIND_OF_PREFIX = Object.fromEntries(Object.entries(PREFIX).map(([k, p]) => [p, k as IdKind])) as Record<string, IdKind>
export const ID_KINDS = Object.keys(PREFIX) as IdKind[]

export type IdsState = { v: 1; next: Record<string, number>; ids: Record<string, string> }

export type Ids = {
  // Gives everything in the snapshot without a short id one.
  sync: (ws: ReadWs) => void
  // The short id of a real one (given now if it has none).
  short: (kind: IdKind, real: string) => string
  // Only if it has one already.
  has: (kind: IdKind, real: string) => string | undefined
  // The real id and kind behind a short id.
  real: (short: string) => { kind: IdKind; id: string } | undefined
  toJSON: () => IdsState
}

const SHORT = /^([a-z])(\d+)$/

export function makeIds(saved?: IdsState): Ids {
  const next: Record<string, number> = { ...(saved?.next ?? {}) }
  const ids: Record<string, string> = { ...(saved?.ids ?? {}) }
  const back = new Map<string, string>()
  for (const [s, real] of Object.entries(ids)) back.set(`${s[0]}:${real}`, s)
  const give = (kind: IdKind, real: string) => {
    const p = PREFIX[kind]
    const key = `${p}:${real}`
    const had = back.get(key)
    if (had) return had
    const n = (next[p] ?? 0) + 1
    next[p] = n
    const s = `${p}${n}`
    ids[s] = real
    back.set(key, s)
    return s
  }
  let synced: WeakRef<object> | undefined
  const self: Ids = {
    short: give,
    has: (kind, real) => back.get(`${PREFIX[kind]}:${real}`),
    real: (s) => {
      const m = SHORT.exec(s.trim())
      const kind = m && KIND_OF_PREFIX[m[1]]
      const real = kind ? ids[s.trim()] : undefined
      return kind && real ? { kind, id: real } : undefined
    },
    toJSON: () => ({ v: 1, next: { ...next }, ids: { ...ids } }),
    sync: (ws) => {
      if (synced?.deref() === ws) return
      for (const [kind, list] of inOrder(ws, derive(ws))) for (const id of list) give(kind, id)
      synced = typeof WeakRef === 'function' ? new WeakRef(ws) : undefined
    },
  }
  return self
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const byTime = (a: { id: string; createdAt?: number }, b: { id: string; createdAt?: number }) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || byId(a, b)

// Everything that gets an id, kind by kind, each list in the order ids are given.
function inOrder(ws: ReadWs, d: Derived): [IdKind, string[]][] {
  const pieceRank = new Map(d.pieceOrder.map((p, i) => [p.id, i]))
  const typeRank = new Map(ALL_TYPES.map((t, i) => [t, i]))
  const cards = [...ws.cards].sort(
    (a, b) => (pieceRank.get(a.pieceId) ?? 1e9) - (pieceRank.get(b.pieceId) ?? 1e9) || typeRank.get(a.type)! - typeRank.get(b.type)! || a.y - b.y || a.x - b.x || byId(a, b),
  )
  const deckCols = (deck: string) => {
    const p = d.pieces.get(deck)
    return (p?.kanban?.cols ?? []).map((c) => c.id)
  }
  const tasks = [...ws.tasks].sort(
    (a, b) =>
      (pieceRank.get(a.pieceId) ?? 1e9) - (pieceRank.get(b.pieceId) ?? 1e9) ||
      deckCols(a.pieceId).indexOf(a.col) - deckCols(b.pieceId).indexOf(b.col) ||
      a.order - b.order ||
      byTime(a, b),
  )
  const uids = new Set<string>([...(ws.members ?? []).map((m) => m.uid), ...(ws.workspace?.memberIds ?? [])])
  const others = [...d.names.keys()].filter((u) => !uids.has(u)).sort()
  return [
    ['canvas', ws.canvases.map((c) => c.id)],
    ['piece', d.pieceOrder.map((p) => p.id)],
    ['card', cards.map((c) => c.id)],
    ['text', [...ws.labels].sort(byTime).map((l) => l.id)],
    ['task', tasks.map((t) => t.id)],
    ['document', [...ws.documents].sort(byTime).map((x) => x.id)],
    ['person', [...uids, ...others]],
    ['evidence', [...ws.evidence].sort(byTime).map((v) => v.id)],
    ['feature', [...ws.competitorFeatures].sort(byTime).map((f) => f.id)],
    ['thread', [...ws.threads].sort(byTime).map((t) => t.id)],
    ['link', [...ws.edges].sort(byId).map((e) => e.id)],
  ]
}

// ---- Resolving what the model wrote

export type Candidate = { short: string; kind: IdKind; title: string; where: string }
// `wrong`: the ref named something of another kind than asked for (`c3` given to view, which takes a piece).
export type Resolved = { id: string; kind: IdKind; short: string } | { candidates: Candidate[]; none?: true; wrong?: { short: string; kind: IdKind; asked: string } }

// Every named thing of the kinds asked for, with its names (a card's title, a piece's name, a person's name and email…).
type Named = { kind: IdKind; id: string; names: string[]; title: string; where: string }

function named(ws: ReadWs, d: Derived, kinds: Set<IdKind>): Named[] {
  const out: Named[] = []
  const planeNames = (id: string) => (d.planesOf.get(id) ?? []).map((p) => d.nameById(p)).join(', ')
  const canvasName = (id: string) => ws.canvases.find((c) => c.id === id)?.name ?? id
  if (kinds.has('card'))
    for (const c of ws.cards) out.push({ kind: 'card', id: c.id, names: [c.title], title: `${c.type} "${oneLine(c.title, 60)}"`, where: `on ${planeNames(c.id)}` })
  if (kinds.has('piece'))
    for (const p of ws.pieces) out.push({ kind: 'piece', id: p.id, names: [d.pieceName(p)], title: `${KIND_NAME[kindOfPiece(p)]} "${oneLine(d.pieceName(p), 60)}"`, where: `on canvas ${canvasName(canvasOf(p))}` })
  if (kinds.has('canvas')) for (const c of ws.canvases) out.push({ kind: 'canvas', id: c.id, names: [c.name], title: `canvas "${c.name}"`, where: '' })
  if (kinds.has('document')) for (const x of ws.documents) out.push({ kind: 'document', id: x.id, names: [x.title], title: `${x.kind} "${oneLine(x.title, 60)}"`, where: `by ${x.name}` })
  if (kinds.has('task'))
    for (const t of ws.tasks) {
      const deck = d.pieces.get(t.pieceId)
      const col = deck?.kanban?.cols.find((c) => c.id === t.col)?.name ?? t.col
      out.push({ kind: 'task', id: t.id, names: [t.title], title: `task "${oneLine(t.title, 60)}"`, where: `in ${deck ? d.pieceName(deck) : '?'} · ${col}` })
    }
  if (kinds.has('text'))
    for (const l of ws.labels) {
      const first = (kindOf(l) === 'title' ? ws.workspace?.name : l.text.split('\n')[0]) ?? ''
      const space = l.pieceId === 'canvas' ? 'the canvas' : d.pieces.get(l.pieceId) ? d.nameById(l.pieceId) : '?'
      out.push({ kind: 'text', id: l.id, names: [first], title: `${kindOf(l)} "${oneLine(first, 60)}"`, where: `on ${space}` })
    }
  if (kinds.has('person'))
    for (const [uid, name] of d.names) {
      const email = ws.members?.find((m) => m.uid === uid)?.email
      out.push({ kind: 'person', id: uid, names: [name, ...(email ? [email] : [])], title: `person ${name}`, where: email ?? '' })
    }
  if (kinds.has('feature'))
    for (const f of ws.competitorFeatures) out.push({ kind: 'feature', id: f.id, names: [f.name], title: `competitor feature "${oneLine(f.name, 60)}"`, where: `of ${d.cards.get(f.competitorId)?.title ?? '?'}` })
  return out
}

// What a real id is, looked up in the snapshot.
function kindOfReal(ws: ReadWs, d: Derived, id: string): IdKind | undefined {
  if (d.cards.has(id)) return 'card'
  if (d.pieces.has(id)) return 'piece'
  if (d.labels.has(id)) return 'text'
  if (d.tasks.has(id)) return 'task'
  if (d.edges.has(id)) return 'link'
  if (d.evidenceById.has(id)) return 'evidence'
  if (d.featuresById.has(id)) return 'feature'
  if (d.docs.has(id)) return 'document'
  if (ws.canvases.some((c) => c.id === id)) return 'canvas'
  if (d.threads.has(id)) return 'thread'
  if (d.names.has(id)) return 'person'
  return undefined
}

const exists = (ws: ReadWs, d: Derived, kind: IdKind, id: string) => kindOfReal(ws, d, id) === kind

// A short id, a real id, or a title or name: exact first, then ignoring case and spaces, then the start of one. One
// thing → its id; several → the candidates; none → no candidates (`none`). `kinds` narrows what's looked through,
// `accept` narrows further (query's deck= takes only decks); `asked` names what's wanted when it's the wrong kind.
export function resolve(ws: ReadWs, ids: Ids, ref: string, kinds?: IdKind[], accept?: (kind: IdKind, id: string) => boolean, asked?: string): Resolved {
  ws = clean(ws)
  ids.sync(ws)
  const d = derive(ws)
  const want = new Set<IdKind>(kinds?.length ? kinds : ID_KINDS)
  const r = (ref ?? '').trim()
  if (!r) return { candidates: [], none: true }
  const ok = (kind: IdKind, id: string) => want.has(kind) && (!accept || accept(kind, id))
  const what = asked ?? [...want].join(' or ')
  const s = ids.real(r)
  if (s && exists(ws, d, s.kind, s.id)) return ok(s.kind, s.id) ? { ...s, short: r } : { candidates: [], none: true, wrong: { short: r, kind: s.kind, asked: what } }
  const k = kindOfReal(ws, d, r)
  if (k) return ok(k, r) ? { id: r, kind: k, short: ids.short(k, r) } : { candidates: [], none: true, wrong: { short: ids.short(k, r), kind: k, asked: what } }
  // A name: an `@` before a person's is fine.
  const all = named(ws, d, want).filter((x) => !accept || accept(x.kind, x.id))
  const pick = (list: Named[]): Resolved | null => {
    if (list.length === 1) return { id: list[0].id, kind: list[0].kind, short: ids.short(list[0].kind, list[0].id) }
    if (list.length > 1) return { candidates: list.slice(0, 20).map((x) => ({ short: ids.short(x.kind, x.id), kind: x.kind, title: x.title, where: x.where })) }
    return null
  }
  const plain = r.replace(/^@/, '')
  const n = norm(plain)
  return (
    pick(all.filter((x) => x.names.some((v) => v === plain))) ??
    pick(all.filter((x) => x.names.some((v) => norm(v) === n))) ??
    (n.length >= 2 ? pick(all.filter((x) => x.names.some((v) => norm(v).startsWith(n)))) : null) ?? { candidates: [], none: true }
  )
}

// A resolve's answer as a line for the model: what it found, or the candidates to pick from.
export function unclear(ref: string, r: Exclude<Resolved, { id: string }>): string {
  if (r.wrong) {
    const piece = r.wrong.kind === 'piece' || r.wrong.kind === 'document'
    return `${r.wrong.short} is ${/^[aeiou]/.test(r.wrong.kind) ? 'an' : 'a'} ${r.wrong.kind}; this takes ${/^[aeiou]/.test(r.wrong.asked) ? 'an' : 'a'} ${r.wrong.asked}. Try ${piece ? 'view' : 'get'}(${r.wrong.short}).`
  }
  if (!r.candidates.length) return `Nothing called "${oneLine(ref, 60)}" was found. Try search, or a short id from the map.`
  return [`"${oneLine(ref, 60)}" could be any of these; ask again with a short id:`, ...r.candidates.map((c) => `- ${c.short} ${c.title}${c.where ? ` · ${c.where}` : ''}`)].join('\n')
}

// A person's uid from a name, an email, `me` or a uid (members, S10: assignees and mentions).
export function resolvePerson(ws: ReadWs, ids: Ids, ref: string): Resolved {
  ws = clean(ws)
  if (ref.trim().toLowerCase() === 'me' && ws.me) return { id: ws.me, kind: 'person', short: ids.short('person', ws.me) }
  return resolve(ws, ids, ref, ['person'])
}

// A person as a short handle and a name: `u2 Bob`.
export const personLabel = (ws: ReadWs, ids: Ids, uid: string | undefined) => (uid ? `${ids.short('person', uid)} ${nameOf(derive(ws), uid)}` : 'nobody')
