// S15 (D-312; agent.md §4.5, §6 Phase 5's preview gate): the store's overlay seam (shared with onboarding's demos), the
// preview's drawn copy (removed things kept to be drawn struck), the marks' targets for every kind in agent.md's table,
// the dev stub's demo batches (the screenshots' batches), and "applied equals previewed": for a batch touching each
// kind, what the plans write into a fake Firestore (written apart from src/ops/docs.ts), read back by the listeners'
// converters, equals the preview's projection field by field.
import { describe, expect, it, vi } from 'vitest'
import { makeEnv } from '../../evals/env'
import { loadFixture } from '../../evals/fixtures'
import { AGENT_TOOLS } from '../../src/agent/tools'
import { viewOf } from '../../src/agent/changeset'
import { closePreview, drawnWs, openPreview, previewState, targetsOf, updatePreview, goOf } from '../../src/agent/preview'
import { demoBatch, DEMOS, pickScript } from '../../src/agent/devStub'
import { getRealWs, getWs, makeStore, registerStore, type WorkspaceCtx } from '../../src/state/wsStore'
import { diff } from '../../src/ops/diff'
import { docsOf, toDocs } from '../../src/ops/docs'
import { fromDocs, WS_COLLECTIONS, type Docs, type RawDoc } from '../../src/model/fromDocs'
import type { Write } from '../../src/ops/types'
import type { AgentWs } from '../../src/agent/contract'

const change = AGENT_TOOLS.find((t) => t.def.name === 'change')!

// ---- The overlay seam (wsStore.ts)

const tiny = (wid: string) => ({ wid, canvas: 'main', cards: [] }) as unknown as WorkspaceCtx

describe('the store overlay (S15 + onboarding §6.3: one seam)', () => {
  it('is off by default; on, get() is fn(real), memoised per real value; set() keeps writing the real value; off again, the real one', () => {
    const real = tiny('a')
    const store = makeStore(real)
    expect(store.get()).toBe(real)
    expect(store.overlaid()).toBe(false)
    const fn = vi.fn((ws: WorkspaceCtx) => ({ ...ws, canvas: 'previewed' }))
    const told = vi.fn()
    store.subscribe(told)
    store.overlay(fn)
    expect(told).toHaveBeenCalledTimes(1)
    const a = store.get()
    expect(a.canvas).toBe('previewed')
    expect(store.get()).toBe(a)
    expect(fn).toHaveBeenCalledTimes(1)
    // The listeners go on underneath.
    const next = tiny('b')
    store.set(next)
    expect(store.real()).toBe(next)
    expect(store.get().wid).toBe('b')
    expect(store.get().canvas).toBe('previewed')
    expect(fn).toHaveBeenCalledTimes(2)
    store.overlay(null)
    expect(told).toHaveBeenCalledTimes(2)
    expect(store.get()).toBe(next)
  })

  it('getWs() shows the overlay; getRealWs() (what ops build on) never does', () => {
    const store = makeStore(tiny('w'))
    const off = registerStore(store)
    store.overlay((ws) => ({ ...ws, canvas: 'x' }))
    expect(getWs()?.canvas).toBe('x')
    expect(getRealWs()?.canvas).toBe('main')
    store.overlay(null)
    off()
  })
})

// ---- The demos (the screenshots' batches) are valid changes on the Pazar fixture

const env = () => makeEnv(loadFixture('medium'))

async function proposed(kind: string) {
  const e = env()
  const batch = demoBatch(e, kind)
  expect(batch, kind).toBeTruthy()
  const r = await change.run(e, batch!)
  expect(r.ok, `${kind}: ${r.text}`).toBe(true)
  return e
}

describe("the dev stub's preview demos", () => {
  it('"preview demo: <kind>" picks the demo script', () => {
    expect(pickScript('preview demo: cards')).toBe('demo')
    expect(pickScript('Preview demo timeline')).toBe('demo')
  })
  for (const kind of DEMOS)
    it(`${kind}: one change call the change tool accepts, nothing written`, async () => {
      const e = await proposed(kind)
      expect(e.changes!.items.length).toBeGreaterThan(0)
      expect(e.steps).toHaveLength(0)
    })
})

// ---- The drawn copy and the marks

describe('the preview: drawn copy and marks for every kind (agent.md §4.5 table)', () => {
  const targets = async (kind: string) => {
    const e = await proposed(kind)
    const real = e.getWs() as WorkspaceCtx
    const { ws, view, diff: d } = drawnWs(real, e.changes!)
    return { e, real, ws, view, d, t: targetsOf(d, real, ws, e.changes!) }
  }

  it('removed things stay in the drawn copy (to be struck) but not in the projection', async () => {
    const { ws, view, d } = await targets('cards')
    const gone = [...d].filter(([, c]) => c.change === 'removed' && c.kind === 'customers').map(([id]) => id)
    expect(gone.length).toBe(1)
    expect(ws.cards.some((c) => c.id === gone[0])).toBe(true)
    expect(view.cards.some((c) => c.id === gone[0])).toBe(false)
  })

  it('an unchanged item keeps its object in the drawn copy (D-287)', async () => {
    const { real, ws, d } = await targets('cards')
    const same = real.cards.find((c) => !d.has(c.id))!
    expect(ws.cards.find((c) => c.id === same.id)).toBe(same)
  })

  it('cards: new (+), changed with was-lines, moved with a ghost, deleted with the reason, a package, evidence on its card', async () => {
    const { t } = await targets('cards')
    const card = t.filter((x) => x.sel.startsWith('[data-target="card:'))
    expect(card.filter((x) => x.change === 'added').length).toBeGreaterThanOrEqual(3)
    const changed = card.find((x) => x.change === 'changed' && x.was.some((w) => w.startsWith('status:')))
    expect(changed?.was.join(' ')).toMatch(/evidence/)
    expect(card.find((x) => x.ghost && (x.ghost.dx || x.ghost.dy))).toBeTruthy()
    expect(card.find((x) => x.change === 'removed')?.why).toBe('a duplicate of an older segment, with no links')
  })

  it('links: new lines, a removed one, one turned round', async () => {
    const { t } = await targets('links')
    const links = t.filter((x) => x.line)
    expect(links.filter((x) => x.change === 'added')).toHaveLength(2)
    expect(links.find((x) => x.change === 'removed')?.why).toMatch(/different markets/)
    expect(links.find((x) => x.tag === '⇄ turned round')).toBeTruthy()
  })

  it('text: a heading, a sticky and a section new; a sticky changed; one deleted', async () => {
    const { t } = await targets('text')
    const text = t.filter((x) => x.sel.startsWith('[data-target="label:'))
    expect(text.filter((x) => x.change === 'added')).toHaveLength(3)
    expect(text.find((x) => x.change === 'changed')?.was[0]).toMatch(/^text: /)
    expect(text.find((x) => x.change === 'removed')).toBeTruthy()
  })

  it('matrix: a row back and a typed column as new heads, cells lit with was, a row taken out', async () => {
    const { t } = await targets('matrix')
    expect(t.filter((x) => x.sel.startsWith('[data-find="rows|') && x.change === 'added')).toHaveLength(1)
    expect(t.filter((x) => x.sel.startsWith('[data-find="cols|') && x.change === 'added')).toHaveLength(1)
    expect(t.filter((x) => x.sel.startsWith('[data-cell=')).length).toBeGreaterThanOrEqual(3)
    expect(t.find((x) => x.sel.startsWith('[data-target="plane:'))?.change).toBe('changed')
  })

  it('table: a new column and rows that join by the new rule and by hand', async () => {
    const { t } = await targets('table')
    expect(t.filter((x) => x.sel.startsWith('[data-find="h|'))).toHaveLength(1)
    expect(t.filter((x) => x.sel.startsWith('[data-find="n|') && x.change === 'added').length).toBeGreaterThan(5)
    expect(t.filter((x) => x.sel.startsWith('[data-cell=')).length).toBeGreaterThanOrEqual(2)
  })

  it('deck: new tasks, one moved to another column (a ghost from where it was drawn), one changed, one deleted', async () => {
    const { t } = await targets('deck')
    const tasks = t.filter((x) => x.sel.startsWith('[data-task='))
    expect(tasks.filter((x) => x.change === 'added')).toHaveLength(2)
    expect(tasks.find((x) => x.change === 'moved')?.snap).toBe(true)
    expect(tasks.find((x) => x.change === 'changed')?.was.join(' ')).toMatch(/due/)
    expect(tasks.find((x) => x.change === 'removed')?.why).toMatch(/pilot/)
  })

  it('timeline: days changed with a ghost of the old span, a new bar', async () => {
    const { t } = await targets('timeline')
    const tasks = t.filter((x) => x.sel.startsWith('[data-task='))
    expect(tasks.filter((x) => x.snap).length).toBeGreaterThanOrEqual(2)
    expect(tasks.filter((x) => x.change === 'added')).toHaveLength(1)
  })

  it('pieces: a new table where it lands, a piece moved with a ghost, one resized', async () => {
    const { t } = await targets('pieces')
    const pieces = t.filter((x) => x.sel.startsWith('[data-target="plane:'))
    expect(pieces.find((x) => x.change === 'added')).toBeTruthy()
    expect(pieces.find((x) => x.ghost && (x.ghost.dx || x.ghost.dy))).toBeTruthy()
    expect(pieces.find((x) => x.was.some((w) => w.startsWith('size:')))).toBeTruthy()
  })

  it('canvases: the new canvas in the breadcrumb prompt; the piece moved shown on both (an away box where it was)', async () => {
    const { t } = await targets('canvases')
    expect(t.find((x) => x.sel.startsWith('[role="menu"] [data-key='))?.change).toBe('added')
    expect(t.find((x) => x.away)).toBeTruthy()
    expect(t.find((x) => x.tag.startsWith('↦ from'))).toBeTruthy()
  })

  it('places: each card marked on the plane it lands on, and its ⧉ count', async () => {
    const { t } = await targets('places')
    expect(t.filter((x) => x.within && x.change === 'added')).toHaveLength(2)
    expect(t.filter((x) => x.tag.startsWith('~ ⧉'))).toHaveLength(2)
  })

  it('the stepper has somewhere to go for every item of every demo', async () => {
    for (const kind of DEMOS) {
      const e = await proposed(kind)
      const { ws } = drawnWs(e.getWs() as WorkspaceCtx, e.changes!)
      for (const i of e.changes!.items) expect(goOf(i, ws), `${kind} ${i.id} ${i.op}`).toBeTruthy()
    }
  })

  it('open → the store overlaid; untick → recomputed; close → the real workspace again', async () => {
    const e = await proposed('cards')
    const real = e.getWs() as WorkspaceCtx
    const store = makeStore(real)
    openPreview(e.changes!, store)
    expect(store.get()).not.toBe(real)
    expect(store.get().cards.some((c) => c.title === 'Weekend flower sellers')).toBe(true)
    const n = previewState()!.targets.length
    e.untick('i2')
    updatePreview(e.changes!)
    expect(store.get().cards.some((c) => c.title === 'Weekend flower sellers')).toBe(false)
    expect(previewState()!.targets.length).toBeLessThan(n)
    closePreview()
    expect(store.get()).toBe(real)
    expect(previewState()).toBeNull()
  })
})

// ---- Applied equals previewed

class FakeFirestore {
  data = new Map<string, Record<string, unknown>>()
  constructor(docs: Docs, workspace: RawDoc) {
    for (const c of WS_COLLECTIONS) for (const d of docs[c]) this.data.set(`${c}/${d.id}`, strip(d))
    this.data.set(`workspace/${workspace.id}`, strip(workspace))
  }
  run(w: Write) {
    const key = `${w.coll}/${w.id}`
    if (w.del) this.data.delete(key)
    else if (w.set && w.merge) this.data.set(key, merged(this.data.get(key) ?? {}, w.set))
    else if (w.set) this.data.set(key, clone(w.set))
    else if (w.patch) {
      const cur = this.data.get(key)
      if (!cur) throw new Error(`NOT_FOUND ${key}`)
      const next = clone(cur)
      for (const [path, v] of Object.entries(w.patch)) {
        const parts = path.split('.')
        let o = next
        for (const p of parts.slice(0, -1)) {
          if (typeof o[p] !== 'object' || o[p] === null) o[p] = {}
          o = o[p] as Record<string, unknown>
        }
        if (isDel(v)) delete o[parts[parts.length - 1]]
        else o[parts[parts.length - 1]] = clone(v)
      }
      this.data.set(key, next)
    }
  }
  docs(): Docs {
    const out = Object.fromEntries(WS_COLLECTIONS.map((c) => [c, [] as RawDoc[]])) as Docs
    for (const [key, d] of this.data) {
      const [c, id] = key.split('/') as [keyof Docs, string]
      if (c in out) out[c].push({ ...d, id })
    }
    for (const c of WS_COLLECTIONS) out[c].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    return out
  }
}
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const strip = ({ id: _, ...rest }: RawDoc) => clone(rest)
const isDel = (v: unknown) => !!v && typeof v === 'object' && (v as { $delete?: boolean }).$delete === true
function merged(cur: Record<string, unknown>, d: Record<string, unknown>): Record<string, unknown> {
  const out = clone(cur)
  for (const [k, v] of Object.entries(d)) {
    if (isDel(v)) delete out[k]
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = merged(typeof out[k] === 'object' && out[k] && !Array.isArray(out[k]) ? (out[k] as Record<string, unknown>) : {}, v as Record<string, unknown>)
    else out[k] = clone(v)
  }
  return out
}

describe('applied equals previewed (agent.md §6 Phase 5 gate), for every kind', () => {
  for (const kind of DEMOS)
    it(kind, async () => {
      const e = await proposed(kind)
      const start = e.start as WorkspaceCtx
      const previewed = viewOf(e.changes!, start)
      const r = await e.accept()
      expect(r.ok).toBe(true)
      expect(e.steps).toHaveLength(1)
      // The plans written into a fake Firestore holding the start, read back as the listeners read it.
      const store = toDocs(start)
      const fake = new FakeFirestore(docsOf(store), { ...(store.get('workspace')!.get(start.wid) as RawDoc), id: start.wid })
      for (const p of e.steps[0].plans) for (const w of p.writes) fake.run(w)
      const read = { ...start, ...fromDocs(fake.docs(), start.documents) } as WorkspaceCtx
      expect([...diff(previewed, read).keys()]).toEqual([])
      // And the env's own applied state (the same apply the browser runs, validate + project) too.
      expect([...diff(previewed, e.getWs() as AgentWs).keys()]).toEqual([])
    })
})

// ---- The revising turn keeps the person locked (S15 review)

describe('a note during the preview', () => {
  it('locks the turn right after the preview closes: never unlocked while the agent revises', async () => {
    const { step, initialWorkflow } = await import('../../src/agent/workflow')
    const { lockPreview, unlockPreview, lockTurn, unlockTurn, locksHeld, releaseAgentLocks } = await import('../../src/agent/browser')
    const { writable } = await import('../../src/data/history')
    let s = step(initialWorkflow(), { type: 'send', text: 'add three ideas' }).state
    s = step(s, { type: 'turn_end', answer: 'Here.', pending: 3, end: 'answered' }).state
    lockPreview()
    const r = step(s, { type: 'send', text: "don't add the third" })
    // The driver's effects, in order (agentStore.ts' run).
    const seen: string[][] = []
    for (const e of r.effects) {
      if (e.type === 'close_preview') unlockPreview()
      if (e.type === 'lock') lockTurn()
      if (e.type === 'unlock') (unlockTurn(), unlockPreview())
      seen.push(locksHeld())
    }
    // After the close the preview's lock is gone, and the turn's is on from the next effect to the end.
    expect(seen.slice(1).every((l) => l.includes('agent'))).toBe(true)
    expect(locksHeld()).toEqual(['agent'])
    expect(writable()).toBe(false)
    releaseAgentLocks()
  })
})
