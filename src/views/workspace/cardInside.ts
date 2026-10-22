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

// Parts by `part of` (D-226): a part's parent, by the first link from it to a card of its own type here (loops left
// out), and each card's parts in reading order.
function partsOf(cards: Card[], edges: Edge[]) {
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
  return { byId, parentOf, kids }
}

type Entry = { card: Card; depth: number; named: boolean }

// What a package holds (D-239, D-240), as a tree: the cards and packages named in it, each followed by what's under it
// (a card's parts, a package's own contents), all the way down, each once; something named under another named one
// goes under it. `stop`: what's not gone into (a folded thing's insides stay in it).
function treeIn(pkg: Card, byId: Map<string, Card>, kids: Map<string, Card[]>, stop?: (c: Card) => boolean): Entry[] {
  const under = (c: Card, path: Set<string>): Card[] => {
    if (c.type !== 'package') return kids.get(c.id) ?? []
    const named = (c.memberIds ?? []).map((id) => byId.get(id)).filter((k): k is Card => !!k && !path.has(k.id))
    // Everything below each named one, to leave out what's under another.
    const below = new Set<string>()
    const walk = (k: Card, seen: Set<string>) => {
      for (const x of under(k, new Set([...seen, k.id]))) if (!seen.has(x.id) && !below.has(x.id)) (below.add(x.id), walk(x, new Set([...seen, k.id])))
    }
    for (const k of named) walk(k, new Set([...path, c.id]))
    return named.filter((k) => !below.has(k.id))
  }
  const out: Entry[] = []
  const seen = new Set<string>([pkg.id])
  const named = new Set(pkg.memberIds ?? [])
  const add = (c: Card, depth: number, path: Set<string>) => {
    if (seen.has(c.id) || depth > 8) return
    seen.add(c.id)
    out.push({ card: c, depth, named: named.has(c.id) })
    if (stop?.(c)) return
    for (const k of under(c, path)) add(k, depth + 1, new Set([...path, c.id]))
  }
  for (const c of under(pkg, new Set([pkg.id]))) add(c, 0, new Set([pkg.id]))
  return out
}

export function foldsOf(cards: Card[], edges: Edge[]): Folds {
  const { byId, parentOf, kids } = partsOf(cards, edges)
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
  // A package (D-239, D-240, D-243): what it holds, all the way down (a card's parts, a package's own contents). Folded,
  // all of it is its rows, as a tree like a folded feature's, a package inside it and what that holds too; a folded
  // package inside another folded one is just there in the outer's tree.
  const members = new Map<string, Card[]>()
  const packages = cards.filter((p) => p.type === 'package')
  const trees = new Map(packages.map((p) => [p.id, treeIn(p, byId, kids)]))
  for (const p of packages) {
    const list = trees.get(p.id)!.map((r) => r.card)
    members.set(p.id, list)
    count.set(p.id, list.length)
  }
  const inFolded = new Set(packages.filter((p) => p.folded).flatMap((p) => members.get(p.id)!.map((c) => c.id)))
  for (const p of packages) {
    if (!p.folded || inFolded.has(p.id) || !members.get(p.id)!.length) continue
    const tree = trees.get(p.id)!
    rows.set(p.id, tree.map(({ card, depth }) => ({ card, depth })))
    for (const r of tree) hidden.set(r.card.id, p.id)
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

// A package's cards (D-239, D-240): what it holds as a tree (its named cards and packages and what's under them), each
// with how deep it sits and whether it was named.
export function packageTree(pkg: Card, cards: Card[], edges: Edge[]): Entry[] {
  const { byId, kids } = partsOf(cards, edges)
  return treeIn(pkg, byId, kids)
}
