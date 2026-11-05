// Writing together's provider (D-374, src/data/liveText.ts) on two or three in-memory tabs (src/data/liveMemory.ts):
// orders, duplicates, a compaction racing a packet, a seed race. Plain Y.Text stands in for the editor's fragment.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { memoryHub } from '../../src/data/liveMemory'
import { decodePosition, encodePosition, openLiveText, type LiveText } from '../../src/data/liveText'
import { CARET_MAX } from '../../src/model/limits'

const seedOf = (text: string) => () => {
  const d = new Y.Doc()
  d.getText('t').insert(0, text)
  return Y.encodeStateAsUpdate(d)
}
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))
const textOf = (l: LiveText) => l.doc.getText('t').toString()

function tab(hub: ReturnType<typeof memoryHub>, seed = '', extra: Partial<Parameters<typeof openLiveText>[1]> = {}) {
  return openLiveText(hub.transport(), { seed: seedOf(seed), sendEvery: 5, foldJitter: () => 0, ...extra })
}

describe('liveText', () => {
  it('seeds once from the Markdown and two tabs see the same text', async () => {
    const hub = memoryHub()
    const a = tab(hub, 'hello')
    await a.ready
    const b = tab(hub, 'hello')
    await b.ready
    expect(textOf(a)).toBe('hello')
    expect(textOf(b)).toBe('hello')
    expect(hub.state?.v).toBe(0)
  })

  it('two opening at once seed only once (the text is never there twice)', async () => {
    const hub = memoryHub()
    const a = tab(hub, 'one text')
    const b = tab(hub, 'one text')
    await Promise.all([a.ready, b.ready])
    expect(textOf(a)).toBe('one text')
    expect(textOf(b)).toBe('one text')
  })

  it('both typing in the same word at once merge to the same text', async () => {
    const hub = memoryHub()
    const a = tab(hub, 'price first')
    await a.ready
    const b = tab(hub)
    await b.ready
    hub.hold = true
    a.doc.getText('t').insert(5, ' and speed')
    b.doc.getText('t').insert(5, ' always')
    a.flush()
    b.flush()
    hub.release(true)
    expect(textOf(a)).toBe(textOf(b))
    expect(textOf(a)).toContain(' and speed')
    expect(textOf(a)).toContain(' always')
  })

  it('packets out of order and twice still give one text', async () => {
    const hub = memoryHub()
    const a = tab(hub, 'x')
    await a.ready
    const b = tab(hub)
    await b.ready
    hub.hold = true
    hub.twice = true
    const t = a.doc.getText('t')
    for (const w of ['a', 'b', 'c', 'd']) (t.insert(t.length, w), a.flush())
    hub.release(true)
    expect(textOf(b)).toBe('xabcd')
  })

  it("a change made before the seed is never lost, nor anyone else's after", async () => {
    const hub = memoryHub()
    const a = tab(hub, 'text')
    await a.ready
    a.doc.getText('t').insert(4, '!')
    await tick(20)
    const b = tab(hub, 'text')
    await b.ready
    expect(textOf(b)).toBe('text!')
  })

  it('folds past the packet count, deletes only what it applied, and a new tab reads it all', async () => {
    const hub = memoryHub()
    const a = tab(hub, '', { fold: { packets: 10, bytes: 1e9 } })
    await a.ready
    const t = a.doc.getText('t')
    for (let i = 0; i < 12; i++) (t.insert(t.length, String(i % 10)), a.flush())
    await tick(10)
    expect(hub.state?.v).toBeGreaterThanOrEqual(1)
    expect(hub.packets.size).toBeLessThan(10)
    const c = tab(hub)
    await c.ready
    expect(textOf(c)).toBe('012345678901')
  })

  it("a compaction racing someone's packet keeps that packet", async () => {
    const hub = memoryHub()
    const a = tab(hub, 'base', { fold: { packets: 3, bytes: 1e9 } })
    await a.ready
    const b = tab(hub, '', { fold: { packets: 1e9, bytes: 1e9 } })
    await b.ready
    // B's packet reaches the hub, but not A, before A folds.
    hub.hold = true
    b.doc.getText('t').insert(0, '[b]')
    b.flush()
    hub.hold = false
    const t = a.doc.getText('t')
    for (let i = 0; i < 4; i++) (t.insert(t.length, '.'), a.flush())
    await tick(10)
    expect(hub.packets.size).toBeGreaterThan(0)
    const c = tab(hub)
    await c.ready
    hub.release()
    expect(textOf(c)).toBe('[b]base....')
    expect(textOf(a)).toBe('[b]base....')
  })

  it('a change too big for a packet goes straight into the state', async () => {
    const hub = memoryHub()
    const a = tab(hub, '')
    await a.ready
    a.doc.getText('t').insert(0, 'x'.repeat(70_000))
    a.flush()
    await tick(5)
    expect(hub.packets.size).toBe(0)
    expect(hub.state?.v).toBe(1)
    const b = tab(hub)
    await b.ready
    expect(textOf(b).length).toBe(70_000)
  })

  it('undo takes only your own change', async () => {
    const hub = memoryHub()
    const a = tab(hub, 'one')
    await a.ready
    const b = tab(hub)
    await b.ready
    const ta = a.doc.getText('t')
    const undo = new Y.UndoManager(ta)
    ta.insert(3, ' two')
    a.flush()
    b.doc.getText('t').insert(0, 'zero ')
    b.flush()
    undo.undo()
    a.flush()
    expect(textOf(a)).toBe('zero one')
    expect(textOf(b)).toBe('zero one')
  })

  it('carets travel as base64 under the presence cap and land on the same letter', () => {
    const d = new Y.Doc()
    const t = d.getText('t')
    t.insert(0, 'hello world')
    const rp = Y.createRelativePositionFromTypeIndex(t, 6)
    const s = encodePosition(Y.relativePositionToJSON(rp))
    expect(s.length).toBeLessThanOrEqual(CARET_MAX)
    t.insert(0, '>> ')
    const back = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(decodePosition(s)), d)
    expect(back?.index).toBe(9)
  })

  it("presence's caret cap matches database.rules.json", () => {
    const rules = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8')
    const doc = rules.slice(rules.indexOf('"doc"'))
    expect(doc).toContain(`length <= ${CARET_MAX}`)
  })
})
