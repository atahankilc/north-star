// D-327: the link graph (src/model/graph.ts), the flow layout (src/model/layout.ts' flowSpots) and the `structure` read
// tool: numbers about what is connected, a layout that follows the links, and the shape of a plane or a canvas as text.
import { describe, expect, it } from 'vitest'
import { chainRank, linkGraph, TOPIC_MIN } from '../../src/model/graph'
import { flowSpots, FLOW_COL_GAP, GAP, GROUP_GAP } from '../../src/model/layout'
import { structure } from '../../src/agent/read/tools'
import { makeIds } from '../../src/agent/read/ids'
import { workspaceMap } from '../../src/agent/read'
import { loadFixture } from '../../evals/fixtures'
import { TOOL_NAMES } from '../../src/agent/tools'

const card = (id: string, type: string) => ({ id, type })
const link = (fromId: string, toId: string) => ({ fromId, toId })

describe('the link graph', () => {
  it('groups, loose cards, the chain a group runs, links that leave the set', () => {
    const cards = [card('cu', 'customer'), card('p1', 'problem'), card('i1', 'idea'), card('f1', 'feature'), card('x', 'idea'), card('c1', 'competitor'), card('c2', 'competitor')]
    const g = linkGraph(cards, [link('p1', 'cu'), link('i1', 'p1'), link('f1', 'i1'), link('c1', 'c2'), link('x', 'elsewhere')])
    expect([g.cards, g.links]).toEqual([7, 4])
    expect(g.groups.map((x) => x.cards)).toEqual([['cu', 'f1', 'i1', 'p1'], ['c1', 'c2']])
    expect(g.loose).toEqual(['x'])
    expect(g.groups[0]).toMatchObject({ links: 3, chainLinks: 2, flow: true, types: [['customer', 1], ['problem', 1], ['idea', 1], ['feature', 1]] })
    expect(g.outside).toEqual([{ id: 'x', to: 'elsewhere' }])
    // A run along neighbouring types reads as a flow.
    const run = linkGraph([card('a', 'customer'), card('b', 'problem'), card('c', 'competitor'), card('d', 'idea')], [link('a', 'b'), link('b', 'c'), link('c', 'd')])
    expect(run.groups[0]).toMatchObject({ chainLinks: 3, flow: true })
    expect([chainRank('customer'), chainRank('feature'), chainRank('sticky')]).toEqual([0, 4, 6])
  })

  it('a big group held by one link splits into two topics, the crossing link counted; the bridge cards are hubs', () => {
    const ring = (p: string) => Array.from({ length: 5 }, (_, i) => link(`${p}${i}`, `${p}${(i + 1) % 5}`)).concat([link(`${p}0`, `${p}2`), link(`${p}1`, `${p}3`)])
    const cards = [...'abcde'.split('').map((_, i) => card(`a${i}`, 'problem')), ...'abcde'.split('').map((_, i) => card(`b${i}`, 'idea'))]
    expect(cards.length).toBeGreaterThanOrEqual(TOPIC_MIN)
    const g = linkGraph(cards, [...ring('a'), ...ring('b'), link('a0', 'b0')])
    expect(g.groups).toHaveLength(1)
    expect(g.groups[0].topics.map((t) => t.cards)).toEqual([['a0', 'a1', 'a2', 'a3', 'a4'], ['b0', 'b1', 'b2', 'b3', 'b4']])
    expect(g.groups[0].crossing).toBe(1)
    expect(g.hubs.map((h) => h.id)).toEqual(expect.arrayContaining(['a0', 'b0']))
    // The same input, the same output.
    expect(linkGraph(cards, [...ring('a'), ...ring('b'), link('a0', 'b0')])).toEqual(g)
  })
})

describe('the flow layout', () => {
  const S = { w: 200, h: 100 }
  it('a band reads along the chain; a card level with what it links to; loose cards apart; nothing overlaps', () => {
    // 0 customer; 1, 2 problems; 3 idea solving 2; 4 loose.
    const ranks = [0, 1, 1, 3, 3]
    const f = flowSpots([S, S, S, S, S], [[0, 1, 2, 3]], [4], (i) => ranks[i], [[1, 0], [2, 0], [3, 2]], 2000)
    expect(f.spots[0]).toEqual({ x: 0, y: 0 })
    expect(f.spots[1].x).toBe(200 + FLOW_COL_GAP)
    expect(f.spots[2]).toEqual({ x: 200 + FLOW_COL_GAP, y: 100 + GAP })
    // The idea sits level with the problem it solves, in the column after.
    expect(f.spots[3]).toEqual({ x: 2 * (200 + FLOW_COL_GAP), y: 0 })
    // Loose beside the band (the width is there), not under it.
    expect(f.spots[4].y).toBe(0)
    expect(f.spots[4].x).toBeGreaterThanOrEqual(f.spots[3].x + 200 + GROUP_GAP)
    const hit = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x < b.x + 200 && b.x < a.x + 200 && a.y < b.y + 100 && b.y < a.y + 100
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) expect(hit(f.spots[i], f.spots[j]), `${i} × ${j}`).toBe(false)
  })

  it('bands past the width wrap onto a new shelf', () => {
    const bands = [[0, 1], [2, 3], [4, 5]]
    const f = flowSpots(Array(6).fill(S), bands, [], (i) => i % 2, [[0, 1], [2, 3], [4, 5]], 1000)
    // Each band is 200 + gap + 200 wide: two don't fit in 1000, so each starts a shelf.
    expect(f.spots[2].x).toBe(0)
    expect(f.spots[2].y).toBeGreaterThan(f.spots[0].y)
    expect(f.w).toBeLessThanOrEqual(1000)
  })
})

describe('the structure tool', () => {
  const ws = loadFixture('medium')
  const ids = makeIds()
  workspaceMap(ws as never, ids)

  it('a plane: its groups, the chain they run, loose cards, links leaving it; one link said as one', () => {
    const t = structure(ws as never, ids, { space: 'p1' }).text
    expect(t).toMatch(/^## Structure of p1 "Segments" \(plane\): 33 cards, 11 links between them/)
    expect(t).toMatch(/- group 1: 8 cards, 7 links; runs customer 1 → problem 7/)
    expect(t).toMatch(/Loose: c1 "/)
    expect(t).toMatch(/Links to cards not on this plane \(drawn on no plane, D-207\): 90/)
    expect(structure(ws as never, ids, { space: 'p4' }).text).toMatch(/1 link;|1 link between/)
    expect(structure(ws as never, ids, { space: 'p4' }).text).not.toMatch(/\b1 links\b/)
  })

  it('a canvas: its planes and the links between them; a piece that is no plane says so', () => {
    const t = structure(ws as never, ids, { space: 'k1' }).text
    expect(t).toMatch(/^## Structure of k1 \(canvas\): 4 planes/)
    expect(t).toMatch(/Links between planes \(each drawn on neither\): p1 "Segments" – p3 "Bets": 33/)
    expect(TOOL_NAMES).toContain('structure')
  })
})
