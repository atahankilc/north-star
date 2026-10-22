// What a card holds inside it (D-225): a competitor's features, shown in the card as it grows on hover; a feature's
// parts, folded into it as a small tree while it's folded. Sizes in plane px, shared by the card's look, its box for
// links and corner marks, and where a folded part's card tucks into its row.
import { CARD, type Card } from '../../data/cards'
import type { CompetitorFeature } from '../../data/competitorFeatures'
import type { Edge } from '../../data/edges'

// Where the list inside a card starts: under its type line and a title kept to two lines.
export const INNER_TOP = 56
// A part's row in a folded feature; a competitor feature's small card (18 + 3 apart) and a category's name over its.
export const PART_ROW = 15
export const FEATURE_ROW = 21
export const CATEGORY_ROW = 13
// Under the list: a gap, the facts line, the card's padding.
const FOOT = 4 + 8 + 7 + 6

export type Box = { x: number; y: number; w: number; h: number }

export type Folds = {
  // A part's parent, by the first `part of` from it to a card of its own type here (loops left out).
  parentOf: Map<string, string>
  // Every part (all the way down) under a folded feature that shows: which one holds it.
  hidden: Map<string, string>
  // A shown folded feature's parts, depth first, with how deep each sits.
  rows: Map<string, { card: Card; depth: number }[]>
  // How many parts under a feature, all the way down; a package's members with their parts.
  count: Map<string, number>
  // A package's members on this plane with their parts (D-239).
  members: Map<string, Card[]>
}

export function foldsOf(cards: Card[], edges: Edge[]): Folds {
  const byId = new Map(cards.map((c) => [c.id, c]))
  const parentOf = new Map<string, string>()
  for (const e of edges) {
    if (e.kind !== 'part-of' || parentOf.has(e.fromId)) continue
    const [a, b] = [byId.get(e.fromId), byId.get(e.toId)]
    // Same type only, competitors and packages aside (D-226): a sub-problem, a narrower idea or segment, a feature's part.
    if (!a || !b || a.type !== b.type || a.type === 'competitor' || a.type === 'package') continue
    // Not if it would close a loop.
    let up: string | undefined = b.id
    while (up && up !== a.id) up = parentOf.get(up)
    if (up !== a.id) parentOf.set(a.id, b.id)
  }
  const kids = new Map<string, Card[]>()
  for (const [child, parent] of parentOf) kids.set(parent, [...(kids.get(parent) ?? []), byId.get(child)!])
  for (const list of kids.values()) list.sort((p, q) => p.y - q.y || p.x - q.x)
  const below = (id: string, depth: number, out: { card: Card; depth: number }[]) => {
    for (const k of kids.get(id) ?? []) (out.push({ card: k, depth }), below(k.id, depth + 1, out))
    return out
  }
  const count = new Map<string, number>()
  for (const id of kids.keys()) count.set(id, below(id, 0, []).length)
  // A folded feature not itself inside another fold holds everything under it.
  const isHidden = (id: string): boolean => {
    for (let up = parentOf.get(id); up; up = parentOf.get(up)) if (byId.get(up)?.folded) return true
    return false
  }
  const hidden = new Map<string, string>()
  const rows = new Map<string, { card: Card; depth: number }[]>()
  for (const c of cards) {
    if (c.type === 'package' || !c.folded || !kids.has(c.id) || isHidden(c.id)) continue
    const list = below(c.id, 0, [])
    rows.set(c.id, list)
    for (const r of list) hidden.set(r.card.id, c.id)
  }
  // A package (D-239): its members, the ones on this plane, each with its parts all the way down (a parent put in a
  // package brings its parts). Folded, they're its rows, a part under its parent, and hidden in it; a member's own
  // folded parts stay inside that member (no rows of their own).
  const members = new Map<string, Card[]>()
  for (const p of cards) {
    if (p.type !== 'package') continue
    const tree: { card: Card; depth: number }[] = []
    const seen = new Set<string>()
    const add = (c: Card, depth: number) => {
      if (seen.has(c.id) || depth > 8) return
      seen.add(c.id)
      tree.push({ card: c, depth })
      for (const k of kids.get(c.id) ?? []) add(k, depth + 1)
    }
    // A part also named on its own goes under its parent when the parent's in too.
    const named = (p.memberIds ?? []).map((id) => byId.get(id)).filter((c): c is Card => !!c && c.type !== 'package')
    const inPkg = new Set(named.map((c) => c.id))
    const top = named.filter((c) => {
      for (let up = parentOf.get(c.id); up; up = parentOf.get(up)) if (inPkg.has(up)) return false
      return true
    })
    for (const c of top) add(c, 0)
    const list = tree.map((r) => r.card)
    members.set(p.id, list)
    count.set(p.id, list.length)
    if (!p.folded || !list.length) continue
    // What sits inside a folded member isn't a row of the package: it's in that member's own rows.
    rows.set(p.id, tree.filter((r) => !hidden.has(r.card.id)))
    for (const m of list) if (!hidden.has(m.id)) hidden.set(m.id, p.id)
  }
  return { parentOf, hidden, rows, count, members }
}

export const foldedHeight = (parts: number) => Math.max(CARD.h, INNER_TOP + parts * PART_ROW + FOOT)

// A competitor's features as its panel lists them (D-221): by category, none first, oldest first within one.
export function byCategory(list: CompetitorFeature[]) {
  const groups = new Map<string, CompetitorFeature[]>()
  for (const f of [...list].sort((a, b) => a.createdAt - b.createdAt)) groups.set(f.category ?? '', [...(groups.get(f.category ?? '') ?? []), f])
  return [...groups.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b))).map((cat) => ({ cat, items: groups.get(cat)! }))
}

export function openHeight(groups: { cat: string; items: unknown[] }[]) {
  const named = groups.filter((g) => g.cat).length
  const rows = groups.reduce((n, g) => n + g.items.length, 0)
  return Math.max(CARD.h, INNER_TOP + named * CATEGORY_ROW + rows * FEATURE_ROW + FOOT)
}

// A folded part's row inside its feature: where links to it end and its card tucks into.
export function partRowBox(parent: Box, index: number, depth: number): Box {
  const left = 11 + depth * 12
  return { x: parent.x + left, y: parent.y + INNER_TOP + index * PART_ROW, w: CARD.w - left - 7, h: PART_ROW }
}

// An unfolded package (D-239): a frame round its members, the band that is the package over it. The whole box, band and
// frame, in plane px; null without members to frame.
export const BAND_H = 30
const FRAME_PAD = 20
export function packageBox(members: Box[]): Box | null {
  if (!members.length) return null
  const [l, t] = [Math.min(...members.map((b) => b.x)), Math.min(...members.map((b) => b.y))]
  const [r, b] = [Math.max(...members.map((m) => m.x + m.w)), Math.max(...members.map((m) => m.y + m.h))]
  return { x: l - FRAME_PAD, y: t - FRAME_PAD - BAND_H, w: r - l + 2 * FRAME_PAD, h: b - t + 2 * FRAME_PAD + BAND_H }
}

// A package's cards (D-239): the ones named in it, each followed by its parts all the way down (same-type `part of`),
// with how deep each sits and whether it was named; each card once.
export function packageTree(ids: string[], cards: Card[], edges: Edge[]): { card: Card; depth: number; named: boolean }[] {
  const byId = new Map(cards.map((c) => [c.id, c]))
  const kids = new Map<string, Card[]>()
  for (const e of edges) {
    if (e.kind !== 'part-of') continue
    const [a, b] = [byId.get(e.fromId), byId.get(e.toId)]
    if (a && b && a.type === b.type && a.type !== 'competitor' && a.type !== 'package') kids.set(b.id, [...(kids.get(b.id) ?? []), a])
  }
  const named = new Set(ids)
  const out: { card: Card; depth: number; named: boolean }[] = []
  const seen = new Set<string>()
  const add = (c: Card, depth: number) => {
    if (seen.has(c.id) || depth > 8) return
    seen.add(c.id)
    out.push({ card: c, depth, named: named.has(c.id) })
    for (const k of (kids.get(c.id) ?? []).sort((p, q) => p.y - q.y || p.x - q.x)) add(k, depth + 1)
  }
  // A named part goes under its parent when that's in too.
  const under = new Set([...kids.entries()].filter(([p]) => named.has(p)).flatMap(([, list]) => list.map((k) => k.id)))
  const isUnder = (id: string): boolean => under.has(id) || [...kids.entries()].some(([p, list]) => list.some((k) => k.id === id) && (named.has(p) || isUnder(p)))
  for (const id of ids) {
    const c = byId.get(id)
    if (c && c.type !== 'package' && !isUnder(id)) add(c, 0)
  }
  return out
}
