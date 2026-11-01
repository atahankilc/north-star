// agent-bugs 2 and 22: a short id is shown with its name. read/names.ts is the one resolver: the chat draws every
// short id with its name (linked where it has a place), and create_document writes a bare `c12` as `c12 "title"`.
import { describe, expect, it } from 'vitest'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'
import { AGENT_TOOLS } from '../../src/agent/tools'
import { namedShort, plainCites, withNames } from '../../src/agent/read/names'

const ws = loadFixture('medium')
const env = () => makeEnv(ws)

describe('namedShort: every letter', () => {
  it('names cards, pieces, text, tasks, canvases, links, evidence, features, documents, people; go where there is a place', () => {
    const e = env()
    const card = ws.cards[0]
    const piece = ws.pieces.find((p) => p.kind === 'plane')!
    const label = ws.labels.find((l) => l.text.trim())!
    const task = ws.tasks[0]
    const edge = ws.edges[0]
    const ev = ws.evidence[0]
    const doc = ws.documents[0]
    const c = namedShort(ws, e.ids, e.ids.short('card', card.id))!
    expect(c).toMatchObject({ kind: 'card', name: expect.stringContaining(card.title.slice(0, 20)), go: card.id })
    expect(namedShort(ws, e.ids, e.ids.short('piece', piece.id))).toMatchObject({ kind: 'piece', go: piece.id })
    expect(namedShort(ws, e.ids, e.ids.short('text', label.id))).toMatchObject({ kind: 'text', go: label.id })
    expect(namedShort(ws, e.ids, e.ids.short('task', task.id))).toMatchObject({ kind: 'task', name: expect.stringContaining(task.title.slice(0, 20)), go: task.id })
    expect(namedShort(ws, e.ids, e.ids.short('canvas', ws.canvases[0].id))).toMatchObject({ kind: 'canvas', go: ws.canvases[0].id })
    expect(namedShort(ws, e.ids, e.ids.short('link', edge.id))).toMatchObject({ kind: 'link', name: expect.stringContaining('→'), go: edge.fromId })
    expect(namedShort(ws, e.ids, e.ids.short('evidence', ev.id))).toMatchObject({ kind: 'evidence', go: ev.nodeId })
    const d = namedShort(ws, e.ids, e.ids.short('document', doc.id))!
    expect(d).toMatchObject({ kind: 'document', name: expect.stringContaining(doc.title.slice(0, 20)) })
    expect(d.go).toBeUndefined()
    if (ws.competitorFeatures.length) expect(namedShort(ws, e.ids, e.ids.short('feature', ws.competitorFeatures[0].id))).toMatchObject({ kind: 'feature', go: ws.competitorFeatures[0].competitorId })
    expect(namedShort(ws, e.ids, 'c99999')).toBeUndefined()
  })
})

describe('withNames: bare ids get their names', () => {
  it('a bare id named; a titled one, one in code, an unknown one left', () => {
    const e = env()
    const card = ws.cards[0]
    const s = e.ids.short('card', card.id)
    const out = withNames(`Linked to ${s}, and ${s} "${card.title}", \`${s}\`, c99999.`, ws, e.ids)
    expect(out).toContain(`Linked to ${s} "`)
    expect(out.split(`${s} "`).length - 1).toBe(2)
    expect(out).toContain(`\`${s}\``)
    expect(out).toContain('c99999.')
  })
  it('a person already named stays once', () => {
    const e = env()
    const uid = ws.members?.[0]?.uid
    if (!uid) return
    const u = e.ids.short('person', uid)
    const name = ws.members![0].name
    expect(withNames(`${u} ${name} wrote it`, ws, e.ids)).toBe(`${u} ${name} wrote it`)
    expect(withNames(`by ${u}.`, ws, e.ids)).toBe(`by ${u} ${name}.`)
  })
})

describe('plainCites: ids written as Markdown links or in brackets read as plain ids', () => {
  it('[c58](c58), [c58 "Bread"](c58) and [p6] become plain; a real link and a bracketed word stay', () => {
    expect(plainCites('See [c58](c58), [c58 "Bread"](c58) and [p6] and [p13].')).toBe('See c58, c58 "Bread" and p6 and p13.')
    expect(plainCites('[the site](https://pazar.example) and [note] and [c5](https://x.y)')).toBe('[the site](https://pazar.example) and [note] and [c5](https://x.y)')
  })
  it('withNames names them once', () => {
    const e = env()
    const card = ws.cards[0]
    const s = e.ids.short('card', card.id)
    expect(withNames(`[${s}](${s})`, ws, e.ids)).toBe(`${s} ${namedShort(ws, e.ids, s)!.name}`)
  })
})

describe('create_document writes names, not bare ids (bug 22)', () => {
  it('the text it proposes has each card\'s title after its id', async () => {
    const e = env()
    const change = AGENT_TOOLS.find((t) => t.def.name === 'change')!
    const [a, b] = ws.cards
    const sa = e.ids.short('card', a.id)
    const sb = e.ids.short('card', b.id)
    const r = await change.run(e, { ops: [{ op: 'create_document', args: { title: 'Notes', text: `# Notes\n\nBuilt on ${sa} and ${sb}.` } }] })
    expect(r.ok, r.text).toBe(true)
    const write = e.changes!.plans.flatMap((p) => p.writes).find((w) => w.coll === 'docBodies')!
    const body = String((write as { set?: { text?: string } }).set?.text ?? '')
    expect(body).toContain(`${sa} "`)
    expect(body).toContain(`${sb} "`)
  })
})
