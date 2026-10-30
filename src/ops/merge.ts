// merge_cards (S17, D-312; docs/specs/agent.md §4.10's `/dedupe`): near-duplicate cards made one. One card is kept;
// every other is folded into it and then deleted, in one plan (one undo step). Pure, read from the snapshot (R5).
//
// What moves to the kept card, from each merged one:
// - links (from and to it): pointed at the kept card; one that would link the card to itself, or repeat a link the kept
//   card already has (same other end and kind), goes instead;
// - evidence, tasks, a competitor's features and the matches naming it: pointed at the kept card;
// - its planes: where the kept card isn't shown yet, the kept card is placed at the merged one's spot (a place), so
//   every plane that showed either still shows the one card;
// - packages listing it: list the kept card instead (once);
// - matrices, tables and decks naming it in their setup (rows or columns added by hand, hand-picked cards): the kept
//   card instead (once); in their `hide` lists the merged card is just dropped (the kept card stays shown or hidden as it was); a matrix cell keyed by it moves to the kept card's key when that cell is
//   free (else it stays, unread, as cells of deleted cards do, D-141);
// - its fields where the kept card has none (status, regions, priority, impact, effort, profile, criteria…), its tags
//   added to the kept card's, its notes added under the kept card's.
// Comments (threads) are not ops yet (validate refuses them): a merged card's threads stay where they were.
import { titleField, TITLE_MAX, type Card } from '../model/cards'
import { placeId } from '../model/placement'
import { kindOfPiece } from '../model/pieces'
import type { OpCtx, Plan, Write } from './types'
import { cardColl, cardData, cardIn, once, refuse } from './util'

export type MergeCardsArgs = {
  // The card that stays.
  keep: string
  // The cards folded into it, then deleted.
  merge: string[] | string
  // A new title for the kept card (left out: its own).
  title?: string
}

// A title cut for an undo line.
const cut = (t: string) => (t.length > 40 ? `${t.slice(0, 39)}…` : t)

const OP = 'merge_cards'

// Fields filled from a merged card where the kept one has none.
const FILL = ['validation', 'regions', 'priority', 'status', 'impact', 'effort', 'description', 'audience', 'pricing', 'url', 'criteria'] as const

// A JSON value with one id swapped for another, lists then kept unique (strings, and objects by their `cardId`).
function swapped(v: unknown, from: Set<string>, to: string): unknown {
  if (typeof v === 'string') return from.has(v) ? to : v
  if (Array.isArray(v)) {
    const out: unknown[] = []
    const seen = new Set<string>()
    for (const x of v.map((y) => swapped(y, from, to))) {
      const key = typeof x === 'string' ? `s:${x}` : x && typeof x === 'object' && typeof (x as { cardId?: unknown }).cardId === 'string' ? `c:${(x as { cardId: string }).cardId}` : null
      if (key && seen.has(key)) continue
      if (key) seen.add(key)
      out.push(x)
    }
    return out
  }
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swapped(x, from, to)]))
  return v
}

// `hide` lists (cards taken out of a matrix axis, a table's or deck's source) lose the merged ids: the kept card keeps
// its own shown or hidden state, never the merged one's.
function unhidden(v: unknown, ids: Set<string>): unknown {
  if (Array.isArray(v)) return v.map((x) => unhidden(x, ids))
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v).flatMap(([k, x]) => {
        if (k !== 'hide' || !Array.isArray(x)) return [[k, unhidden(x, ids)]]
        const left = x.filter((y) => !(typeof y === 'string' && ids.has(y)))
        // An empty list isn't kept (the setup's cleaner leaves it out).
        return left.length ? [[k, left]] : []
      }),
    )
  return v
}

const mentions = (v: unknown, ids: Set<string>): boolean => {
  if (typeof v === 'string') return ids.has(v)
  if (Array.isArray(v)) return v.some((x) => mentions(x, ids))
  if (v && typeof v === 'object') return Object.values(v).some((x) => mentions(x, ids))
  return false
}

export function mergeCards(ctx: OpCtx, args: MergeCardsArgs): Plan {
  const ws = ctx.ws
  const keep = cardIn(ctx, OP, args.keep)
  const list = [...new Set(Array.isArray(args.merge) ? args.merge : [args.merge])]
  if (!list.length) refuse(OP, 'nothing to merge into the kept card', 'give merge: the cards to fold into it')
  const gone: Card[] = list.map((id) => cardIn(ctx, OP, id))
  if (gone.some((c) => c.id === keep.id)) refuse(OP, 'the kept card is also in merge', 'leave the kept card out of merge')
  if (keep.type === 'package' || gone.some((c) => c.type === 'package')) refuse(OP, "packages aren't merged", 'merge cards; a package is changed by what it holds')
  const other = gone.find((c) => c.type !== keep.type)
  if (other) refuse(OP, `"${other.title}" is ${other.type === 'idea' ? 'an' : 'a'} ${other.type} and the kept card is ${keep.type === 'idea' ? 'an' : 'a'} ${keep.type}: only cards of one type merge`, 'merge cards of the same type; link the others instead')
  const ids = new Set(gone.map((c) => c.id))
  const now = ctx.now
  const writes: Write[] = []

  // The kept card: its title, fields it lacks, tags, notes.
  const own: Record<string, unknown> = {}
  const k = keep as Card & Record<string, unknown>
  for (const f of FILL) {
    if (k[f] !== undefined && !(Array.isArray(k[f]) && !(k[f] as unknown[]).length)) continue
    const from = gone.map((c) => (c as Card & Record<string, unknown>)[f]).find((v) => v !== undefined && !(Array.isArray(v) && !v.length))
    if (from !== undefined) own[f] = from
  }
  const tags = [...new Set([...(keep.tags ?? []), ...gone.flatMap((c) => c.tags ?? [])])].slice(0, 20)
  if (tags.length !== (keep.tags ?? []).length) own.tags = tags
  const notes = [keep.notes, ...gone.map((c) => c.notes)].map((x) => x?.trim()).filter((x): x is string => !!x)
  if (notes.length > (keep.notes?.trim() ? 1 : 0)) own.notes = [...new Set(notes)].join('\n\n')
  const patch: Record<string, unknown> = cardData(keep.type, own, true)
  if (args.title !== undefined) {
    const t = String(args.title).trim()
    if (!t) refuse(OP, 'the new title is empty', 'give a title, or leave title out to keep its own')
    patch[titleField(keep.type)] = t.slice(0, TITLE_MAX)
  }
  if (Object.keys(patch).length) writes.push({ coll: cardColl(keep.type), id: keep.id, patch: { ...patch, updatedAt: now } })

  // Links: pointed at the kept card; self-links and repeats go.
  const pair = (a: string, b: string, kind: string) => `${a}|${b}|${kind}`
  const have = new Set(ws.edges.filter((e) => !ids.has(e.fromId) && !ids.has(e.toId)).map((e) => pair(e.fromId, e.toId, e.kind)))
  for (const e of ws.edges) {
    if (!ids.has(e.fromId) && !ids.has(e.toId)) continue
    const from = ids.has(e.fromId) ? keep.id : e.fromId
    const to = ids.has(e.toId) ? keep.id : e.toId
    const key = pair(from, to, e.kind)
    if (from === to || have.has(key)) {
      writes.push({ coll: 'edges', id: e.id, del: true })
      continue
    }
    have.add(key)
    writes.push({ coll: 'edges', id: e.id, patch: { ...(from !== e.fromId ? { fromId: from, fromType: keep.type } : {}), ...(to !== e.toId ? { toId: to, toType: keep.type } : {}) } })
  }

  // Evidence, tasks, a competitor's features, matches.
  for (const v of ws.evidence) if (ids.has(v.nodeId)) writes.push({ coll: 'evidence', id: v.id, patch: { nodeId: keep.id, nodeType: keep.type, updatedAt: now } })
  for (const t of ws.tasks) if (t.cardId && ids.has(t.cardId)) writes.push({ coll: 'tasks', id: t.id, patch: { cardId: keep.id, cardType: keep.type, updatedAt: now } })
  for (const f of ws.competitorFeatures) if (ids.has(f.competitorId)) writes.push({ coll: 'competitorFeatures', id: f.id, patch: { competitorId: keep.id, updatedAt: now } })
  const matched = new Set(ws.comparisons.filter((c) => !ids.has(c.featureId) && !ids.has(c.competitorId)).map((c) => `${c.featureId}|${c.competitorId}`))
  for (const c of ws.comparisons) {
    if (!ids.has(c.featureId) && !ids.has(c.competitorId)) continue
    const f = ids.has(c.featureId) ? keep.id : c.featureId
    const r = ids.has(c.competitorId) ? keep.id : c.competitorId
    // A match is kept under its pair's id: a moved one is made again under the new pair (when free) and the old goes.
    const key = `${f}|${r}`
    writes.push({ coll: 'comparisons', id: c.id, del: true })
    if (f === r || matched.has(key)) continue
    matched.add(key)
    const { id: _, ...rest } = c as typeof c & { id: string }
    writes.push({ coll: 'comparisons', id: `${f}_${r}`, set: { ...rest, featureId: f, competitorId: r, updatedAt: now } })
  }

  // Planes: the kept card shown wherever a merged one was.
  const shownOn = new Set([keep.pieceId, ...ws.places.filter((p) => p.cardId === keep.id).map((p) => p.planeId)])
  for (const c of gone) {
    const spots = [{ planeId: c.pieceId, x: c.x, y: c.y, folded: c.folded }, ...ws.places.filter((p) => p.cardId === c.id)]
    for (const s of spots) {
      if (shownOn.has(s.planeId)) continue
      const plane = ws.pieces.find((p) => p.id === s.planeId)
      if (!plane || kindOfPiece(plane) !== 'plane') continue
      shownOn.add(s.planeId)
      writes.push({ coll: 'places', id: placeId(s.planeId, keep.id), set: { planeId: s.planeId, cardId: keep.id, type: keep.type, x: s.x, y: s.y, ...(s.folded ? { folded: true } : {}), createdAt: now } })
    }
    for (const p of ws.places) if (p.cardId === c.id) writes.push({ coll: 'places', id: p.id, del: true })
  }

  // Packages listing it.
  for (const p of ws.cards) {
    if (p.type !== 'package' || !p.memberIds?.some((m) => ids.has(m))) continue
    writes.push({ coll: cardColl('package'), id: p.id, patch: { memberIds: swapped(p.memberIds, ids, keep.id), updatedAt: now } })
  }

  // Matrices, tables and decks naming it in their setup; matrix cells keyed by it.
  for (const p of ws.pieces) {
    const raw = p as unknown as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    for (const key of ['matrix', 'table', 'kanban'] as const) if (raw[key] && mentions(raw[key], ids)) patch[key] = swapped(unhidden(raw[key], ids), ids, keep.id)
    if (Object.keys(patch).length) writes.push({ coll: 'pieces', id: p.id, patch: { ...patch, updatedAt: now } })
  }
  const cellIds = new Set(ws.cells.map((c) => (c as { id?: string }).id ?? `${c.matrixId}_${c.row}_${c.col}`))
  const swapKey = (key: string) => {
    const [card, ...rest] = key.split('~')
    return ids.has(card) ? [keep.id, ...rest].join('~') : key
  }
  for (const c of ws.cells) {
    const row = swapKey(c.row)
    const col = swapKey(c.col)
    if (row === c.row && col === c.col) continue
    const id = `${c.matrixId}_${row}_${col}`
    if (cellIds.has(id)) continue
    cellIds.add(id)
    const old = (c as { id?: string }).id ?? `${c.matrixId}_${c.row}_${c.col}`
    const { id: _, ...rest } = c as typeof c & { id?: string }
    writes.push({ coll: 'cells', id: old, del: true }, { coll: 'cells', id, set: { ...rest, row, col, updatedAt: now } })
  }

  // Last, the merged cards themselves.
  for (const c of gone) writes.push({ coll: cardColl(c.type), id: c.id, del: true })

  const n = gone.length
  return { op: OP, label: `merge ${n === 1 ? 'a card' : `${n} cards`} into "${cut(keep.title)}"`, writes: once(writes), ids: {}, meta: { kind: keep.type, ids: [keep.id, ...ids] } }
}
