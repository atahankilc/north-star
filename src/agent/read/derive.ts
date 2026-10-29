// What the read layer works out once per snapshot (kept while the snapshot object is the same): lookups by id, each
// plane's cards at their spots there, facts, folds, links and tasks by card, people's names, today.
import type { Card } from '../../model/cards'
import { isOnPlane } from '../../model/cards'
import { factsOf, type Facts } from '../../model/cardFacts'
import { foldsOf, type Folds } from '../../model/cardInside'
import { cardsByPlane, planesOf } from '../../model/placement'
import { canvasOf, MAIN } from '../../model/canvases'
import { CANVAS, type Label } from '../../model/labels'
import { kindOfPiece, KIND_NAME } from '../../model/pieces'
import { today } from '../../model/tasks'
import type { Edge } from '../../model/edges'
import type { Task, KanbanSetup } from '../../data/tasks'
import type { Piece, Thread } from '../../data/model'
import type { WithId } from '../../data/hooks'
import type { Evidence } from '../../data/evidence'
import type { CompetitorFeature } from '../../data/competitorFeatures'
import type { ReadWs } from './types'
import { defang } from './text'

export type P = WithId<Piece>

export type Derived = {
  cards: Map<string, Card>
  pieces: Map<string, P>
  // Pieces in the order the ids are given: canvas by canvas, then by creation.
  pieceOrder: P[]
  labels: Map<string, Label>
  tasks: Map<string, Task>
  edges: Map<string, Edge>
  threads: Map<string, WithId<Thread>>
  evidenceById: Map<string, Evidence>
  featuresById: Map<string, CompetitorFeature>
  docs: Map<string, ReadWs['documents'][number]>
  // Each plane's cards at their spot there (a card brought from elsewhere with `on` set).
  onPlane: Map<string, Card[]>
  // Every plane a card is on, its home first.
  planesOf: Map<string, string[]>
  facts: Map<string, Facts>
  folds: Folds
  linksOf: Map<string, Edge[]>
  tasksOf: Map<string, Task[]>
  evidenceOf: Map<string, Evidence[]>
  featuresOf: Map<string, CompetitorFeature[]>
  threadsOn: Map<string, WithId<Thread>[]>
  // A card's packages (named in them).
  packagesOf: Map<string, string[]>
  // uid → name, as well as the snapshot knows it.
  names: Map<string, string>
  today: string
  // A piece's name as shown (a document piece: its document's title).
  pieceName: (p: P) => string
  // A piece's name by id; one that's gone says so.
  nameById: (id: string) => string
  // The finished columns of each deck.
  doneCols: Map<string, Set<string>>
}

// The snapshot with every string defanged (text.ts): a name that would close the content wrapper can't, wherever the
// read layer prints it, wrapped or not. Shares every object that had nothing to change, and is kept per snapshot; a
// cleaned snapshot cleans to itself. Every exported tool starts here.
const cleaned = new WeakMap<object, ReadWs>()
function scrub<T>(v: T, depth = 0): T {
  if (typeof v === 'string') return defang(v) as T
  if (!v || typeof v !== 'object' || depth > 12) return v
  if (Array.isArray(v)) {
    let changed = false
    const out = v.map((x) => {
      const y = scrub(x, depth + 1)
      if (y !== x) changed = true
      return y
    })
    return (changed ? out : v) as T
  }
  let out: Record<string, unknown> | null = null
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const y = scrub(x, depth + 1)
    if (y !== x) (out ??= { ...(v as Record<string, unknown>) })[k] = y
  }
  return (out ?? v) as T
}
export function clean(ws: ReadWs): ReadWs {
  const was = cleaned.get(ws)
  if (was) return was
  const c = scrub(ws)
  cleaned.set(ws, c)
  if (c !== ws) cleaned.set(c, c)
  return c
}

const kept = new WeakMap<object, Derived>()

export function derive(ws: ReadWs): Derived {
  const was = kept.get(ws)
  if (was) return was
  const cards = new Map(ws.cards.map((c) => [c.id, c]))
  const pieces = new Map(ws.pieces.map((p) => [p.id, p]))
  const canvasRank = new Map(ws.canvases.map((c, i) => [c.id, i]))
  const pieceOrder = [...ws.pieces].sort(
    (a, b) => (canvasRank.get(canvasOf(a)) ?? 99) - (canvasRank.get(canvasOf(b)) ?? 99) || (a.createdAt ?? 0) - (b.createdAt ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
  const onPlane = cardsByPlane(ws.cards, ws.places)
  const planes = new Map(ws.cards.map((c) => [c.id, planesOf(c, ws.places).filter((p) => pieces.has(p))]))
  const tasksOf = new Map<string, Task[]>()
  for (const t of ws.tasks) if (t.cardId) tasksOf.set(t.cardId, [...(tasksOf.get(t.cardId) ?? []), t])
  const doneCols = new Map<string, Set<string>>()
  for (const p of ws.pieces) if (p.kind === 'kanban') doneCols.set(p.id, new Set(((p.kanban as KanbanSetup | undefined)?.cols ?? []).filter((c) => c.done).map((c) => c.id)))
  const taskCounts = new Map<string, { done: number; all: number }>()
  for (const [id, list] of tasksOf) taskCounts.set(id, { all: list.length, done: list.filter((t) => doneCols.get(t.pieceId)?.has(t.col)).length })
  const planeCounts = new Map([...planes].map(([id, l]) => [id, l.length]))
  const facts = factsOf(ws.cards, ws, taskCounts, planeCounts)
  const linksOf = new Map<string, Edge[]>()
  for (const e of ws.edges) {
    linksOf.set(e.fromId, [...(linksOf.get(e.fromId) ?? []), e])
    if (e.toId !== e.fromId) linksOf.set(e.toId, [...(linksOf.get(e.toId) ?? []), e])
  }
  const evidenceOf = new Map<string, Evidence[]>()
  for (const v of ws.evidence) evidenceOf.set(v.nodeId, [...(evidenceOf.get(v.nodeId) ?? []), v])
  for (const l of evidenceOf.values()) l.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || (a.id < b.id ? -1 : 1))
  const featuresOf = new Map<string, CompetitorFeature[]>()
  for (const f of ws.competitorFeatures) featuresOf.set(f.competitorId, [...(featuresOf.get(f.competitorId) ?? []), f])
  const threadsOn = new Map<string, WithId<Thread>[]>()
  for (const t of ws.threads) threadsOn.set(t.targetId, [...(threadsOn.get(t.targetId) ?? []), t])
  const packagesOf = new Map<string, string[]>()
  for (const c of ws.cards) if (c.type === 'package') for (const m of c.memberIds ?? []) packagesOf.set(m, [...(packagesOf.get(m) ?? []), c.id])
  // Names: the people list first, then what people signed.
  const names = new Map<string, string>()
  for (const m of ws.members ?? []) if (m.name) names.set(m.uid, m.name)
  const learn = (uid: string | undefined, name: string | undefined) => {
    if (uid && name && !names.has(uid)) names.set(uid, name)
  }
  for (const t of ws.tasks) learn(t.assignee, t.assigneeName)
  for (const l of ws.labels) learn(l.uid, l.author)
  for (const t of ws.threads) (learn(t.uid, t.name), learn(t.lastUid, t.lastName))
  for (const d of ws.documents) learn(d.uid, d.name)
  for (const list of Object.values(ws.messages ?? {})) for (const m of list) learn(m.uid, m.name)
  const docs = new Map(ws.documents.map((d) => [d.id, d]))
  const pieceName = (p: P) => {
    if (p.kind === 'document') return (p.docId && docs.get(p.docId)?.title) || p.name || 'document'
    return p.name || `unnamed ${KIND_NAME[kindOfPiece(p)]}`
  }
  const d: Derived = {
    cards,
    pieces,
    pieceOrder,
    labels: new Map(ws.labels.map((l) => [l.id, l])),
    tasks: new Map(ws.tasks.map((t) => [t.id, t])),
    edges: new Map(ws.edges.map((e) => [e.id, e])),
    threads: new Map(ws.threads.map((t) => [t.id, t])),
    evidenceById: new Map(ws.evidence.map((v) => [v.id, v])),
    featuresById: new Map(ws.competitorFeatures.map((f) => [f.id, f])),
    docs,
    onPlane,
    planesOf: planes,
    facts,
    folds: foldsOf(ws.cards, ws.edges),
    linksOf,
    tasksOf,
    evidenceOf,
    featuresOf,
    threadsOn,
    packagesOf,
    names,
    today: today(ws.now !== undefined ? new Date(ws.now) : new Date()),
    pieceName,
    nameById: (id: string) => (pieces.get(id) ? pieceName(pieces.get(id)!) : '(gone)'),
    doneCols,
  }
  kept.set(ws, d)
  return d
}

// A person's name, or their uid when the snapshot doesn't know it.
export const nameOf = (d: Derived, uid: string | undefined) => (uid ? (d.names.get(uid) ?? uid) : 'nobody')

// What a deck shows (data/tasks.ts' shownTasks, D-255/D-303; copied here because data/ isn't pure): stuck to a plane,
// the tasks for that plane's cards and those for no card (or one that's gone); otherwise all of them.
export function shownTasks(ws: ReadWs, d: Derived, deck: P & { cardsOnly?: boolean }): Task[] {
  const tasks = ws.tasks.filter((t) => t.pieceId === deck.id)
  const plane = deck.stuckTo && d.pieces.get(deck.stuckTo)?.kind === 'plane' ? deck.stuckTo : undefined
  if (!plane) return tasks
  return tasks.filter((t) => {
    const c = t.cardId ? d.cards.get(t.cardId) : undefined
    return c ? isOnPlane(c, plane) : !deck.cardsOnly
  })
}

// Which decks a timeline shows (data/tasks.ts' timelineKanbans, D-289/D-300/D-314; copied for the same reason).
export function timelineDecks(ws: ReadWs, t: P): (P & { cardsOnly?: boolean })[] {
  const decks = ws.pieces.filter((p) => p.kind === 'kanban' && (p.kanban as KanbanSetup | undefined)?.holds !== 'cards')
  const host = ws.pieces.find((p) => p.id === t.stuckTo)
  if (!host) return decks.filter((k) => canvasOf(k) === canvasOf(t))
  if (host.kind === 'kanban') return [host]
  if (host.kind !== 'plane') return decks
  const deck = decks.filter((k) => k.stuckTo === host.id).sort((a, b) => a.y - b.y || a.x - b.x)[0]
  return deck ? [deck] : decks.map((k) => ({ ...k, stuckTo: host.id, cardsOnly: true }))
}

// The canvas a space is on: a plane's own canvas; the canvas's text its `canvasId`.
export const canvasOfLabel = (d: Derived, l: Label) => (l.pieceId === CANVAS ? canvasOf(l) : (d.pieces.get(l.pieceId) && canvasOf(d.pieces.get(l.pieceId)!)) || MAIN)

export const byReading = (a: { x: number; y: number }, b: { x: number; y: number }) => a.y - b.y || a.x - b.x
