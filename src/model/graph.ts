// The link graph of a set of cards (D-327; docs/specs/agent-bugs.md items 4, 11, 14, 27): what is connected to what,
// as numbers, never a verdict. One module, so the flow layout (4), the lint's undrawable links (11), the one-plane-or-
// several numbers (14) and the `structure` read tool (27) never disagree on what's connected. Pure: no Firebase.
//
// - groups: the connected parts (two cards or more joined by links), largest first; a card with no link here is loose.
// - topics: a large group split where a single link alone holds a part of it to the rest (a bridge with three cards or
//   more on each side), the links cut counted: such a part could stand on its own.
// - chain: the card types a group runs through in the chain order (customer → problem → competitor → idea → feature,
//   D-045) and how many of its links step between neighbouring types: a group that runs the chain is a flow to follow.
// - hubs: cards linked to many others, or to several topics.
// - outside: links from these cards to cards that aren't among them (on another plane): no plane draws them (D-207).

export const CHAIN = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package'] as const
export const chainRank = (type: string) => {
  const i = (CHAIN as readonly string[]).indexOf(type)
  return i < 0 ? CHAIN.length : i
}

export type GraphCard = { id: string; type: string }
export type GraphEdge = { fromId: string; toId: string; kind?: string }

export type Topic = { cards: string[]; links: number }
export type GraphGroup = {
  cards: string[]
  // Links inside the group.
  links: number
  // How many cards of each type, in the chain's order.
  types: [string, number][]
  // Links between neighbouring types of the chain (customer–problem, problem–competitor…) or the same type.
  chainLinks: number
  // It spans three types or more and most of its links step along the chain: a flow.
  flow: boolean
  topics: Topic[]
  // Links from one of its topics to another.
  crossing: number
}

export type Graph = {
  cards: number
  links: number
  groups: GraphGroup[]
  loose: string[]
  hubs: { id: string; degree: number; topics: number }[]
  // Links to cards that aren't in the set, by the outside card.
  outside: { id: string; to: string }[]
}

// Topics only in a group this big; smaller ones read as one.
export const TOPIC_MIN = 8
const HUB_DEGREE = 4

function adjacency(ids: Set<string>, edges: GraphEdge[]) {
  const adj = new Map<string, Map<string, number>>()
  for (const id of ids) adj.set(id, new Map())
  let links = 0
  for (const e of edges) {
    if (!ids.has(e.fromId) || !ids.has(e.toId) || e.fromId === e.toId) continue
    links++
    const a = adj.get(e.fromId)!
    const b = adj.get(e.toId)!
    a.set(e.toId, (a.get(e.toId) ?? 0) + 1)
    b.set(e.fromId, (b.get(e.fromId) ?? 0) + 1)
  }
  return { adj, links }
}

// Connected parts, each sorted, the parts largest first (then by their first id): the same input, the same output.
function components(adj: Map<string, Map<string, number>>): string[][] {
  const seen = new Set<string>()
  const out: string[][] = []
  for (const start of [...adj.keys()].sort()) {
    if (seen.has(start)) continue
    const part: string[] = []
    const stack = [start]
    seen.add(start)
    while (stack.length) {
      const x = stack.pop()!
      part.push(x)
      for (const y of adj.get(x)!.keys()) if (!seen.has(y)) (seen.add(y), stack.push(y))
    }
    out.push(part.sort())
  }
  return out.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]))
}

// Where a large group comes apart: the links that alone hold one part to the rest (bridges), each cut only when both
// sides keep at least BRIDGE_SIDE cards and a quarter of the group (a card or a short branch hanging off a link is no
// topic; in a group shaped like a tree almost every link is a bridge, and cutting each would mean nothing). What's left connected are the
// topics; the cut links are what crosses between them. Deterministic: the same group, the same topics.
export const BRIDGE_SIDE = 3

export function topicsOf(cards: string[], adj: Map<string, Map<string, number>>): Topic[] {
  if (cards.length < TOPIC_MIN) return [{ cards: [...cards], links: linksWithin(cards, adj) }]
  const set = new Set(cards)
  const order = new Map<string, number>()
  const low = new Map<string, number>()
  const size = new Map<string, number>()
  const cut = new Set<string>()
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  let t = 0
  // Tarjan's bridges, iteratively; a double link (weight 2+) is never a bridge.
  const root = [...cards].sort()[0]
  const stack: { v: string; parent: string | null; it: string[] }[] = [{ v: root, parent: null, it: [...adj.get(root)!.keys()].filter((n) => set.has(n)).sort() }]
  order.set(root, t)
  low.set(root, t++)
  size.set(root, 1)
  while (stack.length) {
    const top = stack[stack.length - 1]
    const next = top.it.shift()
    if (next !== undefined) {
      if (next === top.parent && (adj.get(top.v)!.get(next) ?? 0) < 2) continue
      if (order.has(next)) low.set(top.v, Math.min(low.get(top.v)!, order.get(next)!))
      else {
        order.set(next, t)
        low.set(next, t++)
        size.set(next, 1)
        stack.push({ v: next, parent: top.v, it: [...adj.get(next)!.keys()].filter((n) => set.has(n)).sort() })
      }
      continue
    }
    stack.pop()
    const p = top.parent
    if (p === null) continue
    low.set(p, Math.min(low.get(p)!, low.get(top.v)!))
    size.set(p, size.get(p)! + size.get(top.v)!)
    const side = size.get(top.v)!
    const least = Math.max(BRIDGE_SIDE, Math.ceil(cards.length / 4))
    if (low.get(top.v)! > order.get(p)! && side >= least && cards.length - side >= least) cut.add(key(p, top.v))
  }
  // The parts left connected once the cut links are gone.
  const seen = new Set<string>()
  const topics: Topic[] = []
  for (const c of [...cards].sort()) {
    if (seen.has(c)) continue
    const part: string[] = []
    const todo = [c]
    seen.add(c)
    while (todo.length) {
      const x = todo.pop()!
      part.push(x)
      for (const y of adj.get(x)!.keys()) if (set.has(y) && !seen.has(y) && !cut.has(key(x, y))) (seen.add(y), todo.push(y))
    }
    topics.push({ cards: part.sort(), links: linksWithin(part, adj) })
  }
  return topics.sort((a, b) => b.cards.length - a.cards.length || a.cards[0].localeCompare(b.cards[0]))
}

function linksWithin(cards: string[], adj: Map<string, Map<string, number>>): number {
  const set = new Set(cards)
  let n = 0
  for (const c of cards) for (const [m, w] of adj.get(c)!) if (set.has(m) && c < m) n += w
  return n
}

export function linkGraph(cards: GraphCard[], edges: GraphEdge[]): Graph {
  const ids = new Set(cards.map((c) => c.id))
  const typeOf = new Map(cards.map((c) => [c.id, c.type]))
  const { adj, links } = adjacency(ids, edges)
  const parts = components(adj)
  const groups: GraphGroup[] = []
  const loose: string[] = []
  const topicOf = new Map<string, number>()
  for (const part of parts) {
    if (part.length < 2) {
      loose.push(part[0])
      continue
    }
    const counts = new Map<string, number>()
    for (const c of part) counts.set(typeOf.get(c)!, (counts.get(typeOf.get(c)!) ?? 0) + 1)
    const types = [...counts].sort((a, b) => chainRank(a[0]) - chainRank(b[0]) || a[0].localeCompare(b[0]))
    let chainLinks = 0
    const inside = linksWithin(part, adj)
    for (const c of part) for (const [m, w] of adj.get(c)!) if (c < m && Math.abs(chainRank(typeOf.get(c)!) - chainRank(typeOf.get(m)!)) <= 1) chainLinks += w
    const topics = topicsOf(part, adj)
    topics.forEach((t, i) => t.cards.forEach((c) => topicOf.set(c, groups.length * 100 + i)))
    const crossing = inside - topics.reduce((n, t) => n + t.links, 0)
    const ranks = new Set(types.map(([t]) => chainRank(t)))
    groups.push({ cards: part, links: inside, types, chainLinks, flow: ranks.size >= 3 && chainLinks >= inside * 0.6, topics, crossing })
  }
  const hubs = [...ids]
    .map((id) => {
      const ns = adj.get(id)!
      const degree = [...ns.values()].reduce((a, b) => a + b, 0)
      const topics = new Set([...ns.keys()].map((n) => topicOf.get(n)).filter((t) => t !== undefined)).size
      return { id, degree, topics }
    })
    .filter((h) => h.degree >= HUB_DEGREE || h.topics >= 2)
    .sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id))
  const outside: { id: string; to: string }[] = []
  for (const e of edges) {
    if (ids.has(e.fromId) && !ids.has(e.toId)) outside.push({ id: e.fromId, to: e.toId })
    else if (ids.has(e.toId) && !ids.has(e.fromId)) outside.push({ id: e.toId, to: e.fromId })
  }
  return { cards: ids.size, links, groups, loose: loose.sort(), hubs, outside }
}
