// The data/ functions over ops (S4): same signatures, labels, undo keys and merging as before, on a fake Firestore with
// the workspace registered as getWs() would see it.
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---- The fake: docs by path; a batch applies to it when committed (as Firestore applies to its local cache at once).
const fake = vi.hoisted(() => {
  const DEL = { __deleteField: true }
  const data = new Map<string, Record<string, unknown>>()
  const commits = { n: 0, batches: [] as number[], auto: 0 }
  type Ref = { path: string; id: string; parent: { id: string } }
  const ref = (path: string): Ref => {
    const parts = path.split('/')
    return { path, id: parts[parts.length - 1], parent: { id: parts[parts.length - 2] ?? '' } }
  }
  const patch = (cur: Record<string, unknown>, fields: Record<string, unknown>) => {
    const next = structuredClone(cur)
    for (const [path, v] of Object.entries(fields)) {
      const parts = path.split('.')
      let o = next
      for (const p of parts.slice(0, -1)) o = (o[p] ??= {}) as Record<string, unknown>
      const last = parts[parts.length - 1]
      if (v === DEL) delete o[last]
      else o[last] = structuredClone(v)
    }
    return next
  }
  // Set with merge: maps merged key by key, the rest replaced, the sentinel removes.
  const merge = (cur: Record<string, unknown>, d: Record<string, unknown>): Record<string, unknown> => {
    const out = structuredClone(cur)
    for (const [k, v] of Object.entries(d)) {
      if (v === DEL) delete out[k]
      else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = merge((out[k] as Record<string, unknown>) ?? {}, v as Record<string, unknown>)
      else out[k] = structuredClone(v)
    }
    return out
  }
  return { DEL, data, commits, ref, patch, merge }
})

vi.mock('../../src/data/firebase', () => ({ db: () => ({}), firebase: { auth: { currentUser: { uid: 'u-alice' } } }, useEmulators: false }))
vi.mock('firebase/firestore', () => {
  const snap = (path: string) => ({ exists: () => fake.data.has(path), data: () => structuredClone(fake.data.get(path)) })
  return {
    doc: (base: { path?: string }, ...segments: string[]) =>
      base && typeof base.path === 'string' ? fake.ref(`${base.path}/${segments[0] ?? `auto${++fake.commits.auto}`}`) : fake.ref(segments.join('/')),
    collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
    FieldPath: class {
      constructor(...parts: string[]) {
        return parts.join('.')
      }
    },
    deleteField: () => fake.DEL,
    getDocFromCache: async (r: { path: string }) => snap(r.path),
    getDoc: async (r: { path: string }) => snap(r.path),
    deleteDoc: async (r: { path: string }) => void fake.data.delete(r.path),
    writeBatch: () => {
      const ops: (() => void)[] = []
      const b = {
        set: (r: { path: string }, d: Record<string, unknown>, o?: { merge?: boolean }) => (ops.push(() => fake.data.set(r.path, o?.merge ? fake.merge(fake.data.get(r.path) ?? {}, d) : structuredClone(d))), b),
        update: (r: { path: string }, d: Record<string, unknown>) =>
          (ops.push(() => {
            const cur = fake.data.get(r.path)
            if (!cur) throw new Error(`NOT_FOUND ${r.path}`)
            fake.data.set(r.path, fake.patch(cur, d))
          }),
          b),
        delete: (r: { path: string }) => (ops.push(() => fake.data.delete(r.path)), b),
        commit: () => {
          fake.commits.n++
          fake.commits.batches.push(ops.length)
          ops.forEach((op) => op())
          return Promise.resolve()
        },
      }
      return b
    },
  }
})

import { undo, useHistory } from '../../src/data/history'
import { WS_COLLECTIONS, type Docs, type RawDoc } from '../../src/model/fromDocs'
import { makeStore, registerStore } from '../../src/state/wsStore'
import { addCard, deleteCard, deleteCards, discardCard, moveCard, retitleCard, updateCard, copyCards } from '../../src/data/cards'
import { createEdge, deleteEdge, reverseEdge, updateEdge } from '../../src/data/edges'
import { addEvidence, removeEvidence, updateEvidence } from '../../src/data/evidence'
import { addCompetitorFeature, matchOurs, removeCompetitorFeature } from '../../src/data/competitorFeatures'
import { bringIn, cardsOn, removeHere, takeOff } from '../../src/data/places'
import { apply, recentCount, uiCtx } from '../../src/ops/firestore'
import { buildBatch } from '../../src/ops/registry'
import { counterIds } from '../../src/ops/newId'
import { ALICE, fixtureDocs, ID, WID, WORKSPACE, wsFrom } from './fixtures/ws'

const path = (coll: string, id: string) => `workspaces/${WID}/${coll}/${id}`

// The fake store as the listeners would read it.
function listened() {
  const docs = Object.fromEntries(WS_COLLECTIONS.map((c) => [c, [] as RawDoc[]])) as Docs
  const prefix = `workspaces/${WID}/`
  for (const [p, d] of fake.data) {
    if (!p.startsWith(prefix)) continue
    const [c, id] = p.slice(prefix.length).split('/') as [keyof Docs, string]
    docs[c].push({ ...structuredClone(d), id })
  }
  for (const c of WS_COLLECTIONS) docs[c].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return wsFrom(docs, { ...structuredClone(fake.data.get(`workspaces/${WID}`)!), id: WID })
}

const store = makeStore(wsFrom(fixtureDocs()))
registerStore(store)
// The listeners catching up (React's render sets the store).
const echo = () => (store.set(listened()), store.tell())
const ws = () => store.get()
const card = (id: string) => ws().cards.find((c) => c.id === id)!
const settle = () => new Promise((r) => setTimeout(r, 0))

function seed() {
  fake.data.clear()
  fake.commits.n = 0
  fake.commits.batches = []
  const docs = fixtureDocs()
  for (const c of WS_COLLECTIONS) for (const { id, ...d } of docs[c]) fake.data.set(path(c, id), d)
  const { id: _, ...w } = WORKSPACE
  fake.data.set(`workspaces/${WID}`, structuredClone(w))
  useHistory.setState({ wid: WID, past: [], future: [], notice: null })
  echo()
}

describe('data/ functions as ops', () => {
  beforeEach(seed)

  it('addCard + its first title (fresh) are one undo step, even before the snapshot shows the card; undo takes it away', async () => {
    const id = await addCard(WID, ID.planeA, 'idea', [150, 400], cardsOn(ws().cards, ws().places, ID.planeA))
    expect(fake.data.get(path('ideas', id))).toMatchObject({ title: '', pieceId: ID.planeA, x: 50, y: 350 })
    // Not echoed yet: the made card is only in the adapter's recent writes.
    const made = { id, type: 'idea' as const, pieceId: ID.planeA, title: "", x: 50, y: 350 }
    await retitleCard(WID, made, 'Tip jar', true)
    expect(fake.data.get(path('ideas', id))).toMatchObject({ title: 'Tip jar' })
    const { past } = useHistory.getState()
    expect(past.map((s) => [s.label, s.key])).toEqual([['add an idea', `card-title:${id}`]])
    await undo()
    await settle()
    expect(fake.data.has(path('ideas', id))).toBe(false)
  })

  it('discardCard takes a card just made and its step away', async () => {
    const id = await addCard(WID, ID.planeA, 'idea', [150, 400], [])
    await discardCard(WID, { id, type: 'idea' })
    expect(fake.data.has(path('ideas', id))).toBe(false)
    expect(useHistory.getState().past).toEqual([])
  })

  it('typing a title merges into one step; the write is the title and updatedAt, as before', async () => {
    const before = structuredClone(fake.data.get(path('problems', ID.menu)))
    await retitleCard(WID, card(ID.menu), 'Menus change')
    await retitleCard(WID, card(ID.menu), 'Menus change hourly')
    const after = fake.data.get(path('problems', ID.menu))!
    expect(Object.keys(after).sort()).toEqual(Object.keys(before!).sort())
    expect(after.title).toBe('Menus change hourly')
    expect(after.updatedAt).toBeGreaterThan(before!.updatedAt as number)
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['rename a problem'])
    await updateCard(WID, card(ID.menu), { validation: 'testing' }, 'status of')
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['rename a problem', 'status of a problem'])
    await undo()
    await undo()
    await settle()
    expect(fake.data.get(path('problems', ID.menu))).toEqual(before)
  })

  it('deleteCard reads its own cascade (links, places, evidence), whatever lists are passed; one ⌘Z brings all back', async () => {
    const before = new Map(fake.data)
    await deleteCard(WID, card(ID.anna), [], [])
    expect(fake.data.has(path('customers', ID.anna))).toBe(false)
    expect(fake.data.has(path('edges', ID.e1))).toBe(false)
    expect(fake.data.has(path('places', `${ID.planeB}_${ID.anna}`))).toBe(false)
    expect(fake.data.has(path('evidence', ID.ev1))).toBe(false)
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['delete a customer'])
    await undo()
    await settle()
    expect(new Map(fake.data)).toEqual(before)
  })

  it('deleteCards of a competitor takes its features and matches; removeHere takes a card off when it is elsewhere', async () => {
    await deleteCards(WID, [card(ID.orderly)], ws().edges, [], ws().places)
    expect(fake.data.has(path('competitorFeatures', ID.cf1))).toBe(false)
    expect(fake.data.has(path('comparisons', `${ID.qr}_${ID.orderly}`))).toBe(false)
    expect(useHistory.getState().past.at(-1)!.label).toBe('delete 1 cards')
    echo()
    const off = await removeHere(WID, ID.planeA, [card(ID.anna)], { edges: [], places: [] })
    expect(off.map((c) => c.id)).toEqual([ID.anna])
    expect(fake.data.get(path('customers', ID.anna))).toMatchObject({ pieceId: ID.planeB, x: 50, y: 300 })
    expect(useHistory.getState().past.at(-1)!.label).toBe('take a card off this plane')
  })

  it('links: createEdge returns the id at once; label, turn round, unlink', async () => {
    const id = createEdge(WID, card(ID.preorder), card(ID.menu), 'solves')
    await settle()
    expect(fake.data.get(path('edges', id))).toEqual({ fromId: ID.preorder, fromType: 'idea', toId: ID.menu, toType: 'problem', kind: 'solves' })
    echo()
    await updateEdge(WID, id, { label: 'often' })
    await reverseEdge(WID, ws().edges.find((e) => e.id === id)!)
    echo()
    await updateEdge(WID, id, { label: undefined })
    expect(fake.data.get(path('edges', id))).toEqual({ fromId: ID.menu, fromType: 'problem', toId: ID.preorder, toType: 'idea', kind: 'solves' })
    await deleteEdge(WID, id)
    expect(fake.data.has(path('edges', id))).toBe(false)
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['link', 'link label', 'reverse link', 'link label', 'unlink'])
  })

  it('evidence and competitor features', async () => {
    await addEvidence(WID, { nodeId: ID.queue, nodeType: 'problem', kind: 'data', text: 'Twelve minutes', stance: 'supports', source: '' })
    const ev = [...fake.data.entries()].find(([p, d]) => p.includes('/evidence/') && d.text === 'Twelve minutes')!
    expect(ev[1]).not.toHaveProperty('source')
    echo()
    const evId = ev[0].split('/').pop()!
    await updateEvidence(WID, evId, { text: 'Twelve min' })
    await updateEvidence(WID, evId, { text: 'Twelve minutes on average' })
    await removeEvidence(WID, evId)
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['add evidence', 'edit evidence', 'remove evidence'])
    await addCompetitorFeature(WID, ID.orderly, { name: 'Stamps' }, ID.loyalty)
    echo()
    const f = ws().competitorFeatures.find((x) => x.name === 'Stamps')!
    expect(fake.data.get(path('comparisons', `${ID.loyalty}_${ID.orderly}`))).toMatchObject({ competitorFeatureId: f.id })
    await matchOurs(WID, f, null, [])
    expect(fake.data.get(path('comparisons', `${ID.loyalty}_${ID.orderly}`))).not.toHaveProperty('competitorFeatureId')
    echo()
    await removeCompetitorFeature(WID, f, [])
    expect(fake.data.has(path('competitorFeatures', f.id))).toBe(false)
  })

  it('bringIn says what comes and its box at once; takeOff takes it off; moveCard moves its place there', async () => {
    const res = bringIn(WID, ID.planeB, [card(ID.barista)], { cards: ws().cards, places: ws().places, edges: ws().edges }, [480, 300])
    expect(res.ids).toEqual([ID.barista])
    expect(res.box).toMatchObject({ w: 200, h: 100 })
    await res.written
    expect(fake.data.get(path('places', `${ID.planeB}_${ID.barista}`))).toMatchObject({ planeId: ID.planeB, cardId: ID.barista, type: 'customer' })
    echo()
    const shown = cardsOn(ws().cards, ws().places, ID.planeB).find((c) => c.id === ID.barista)!
    await moveCard(WID, shown, [600, 450])
    expect(fake.data.get(path('places', `${ID.planeB}_${ID.barista}`))).toMatchObject({ x: 600, y: 450 })
    echo()
    expect(await takeOff(WID, ID.planeB, [card(ID.barista)], [])).toBe(1)
    expect(fake.data.has(path('places', `${ID.planeB}_${ID.barista}`))).toBe(false)
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['bring a card here', 'move a customer', 'take a card off this plane'])
  })

  it('copyCards returns the new ids at once, cards then text', async () => {
    const ids = copyCards(WID, ID.planeA, [card(ID.anna), card(ID.queue)], ws().edges, [50, 50], [ws().labels.find((l) => l.id === ID.note)! as never])
    expect(ids).toHaveLength(3)
    await settle()
    expect(fake.data.get(path('customers', ids[0]))).toMatchObject({ title: 'Anna, café owner', x: 100, y: 100 })
    expect(fake.data.get(path('labels', ids[2]))).toMatchObject({ kind: 'sticky', x: 650, y: 100 })
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['paste 3 things'])
  })

  it('a batch built with handles applies as one step; undo restores everything', async () => {
    const before = new Map(fake.data)
    const plans = buildBatch({ ws: ws(), actor: ALICE, now: Date.now(), newId: counterIds('n') }, [
      { op: 'create_card', args: { type: 'idea', plane: ID.planeA, title: 'Order by text', handle: '$a' } },
      { op: 'link', args: { from: '$a', to: ID.queue } },
      { op: 'delete', args: { ids: [ID.orderly] } },
    ])
    const res = await apply(WID, plans, { ws: ws(), by: ALICE })
    await res.written
    expect(useHistory.getState().past).toHaveLength(1)
    expect(fake.data.has(path('competitorFeatures', ID.cf1))).toBe(false)
    await undo()
    await settle()
    expect(new Map(fake.data)).toEqual(before)
  })

  // Undo through apply for every op family: one step, and ⌘Z puts every doc back.
  const batches: [string, (w: ReturnType<typeof ws>) => { op: string; args: Record<string, unknown> }[]][] = [
    ['duplicate', () => [{ op: 'duplicate', args: { ids: [ID.anna, ID.queue, ID.note], to: ID.planeA } }]],
    ['create_package', () => [{ op: 'create_package', args: { cards: [ID.anna, ID.barista] } }]],
    ['link + update_link', () => [{ op: 'link', args: { from: ID.preorder, to: ID.menu, handle: '$l' } }, { op: 'update_link', args: { link: '$l', label: 'mostly', kind: 'relates' } }, { op: 'update_link', args: { link: ID.e2, reverse: true } }]],
    ['evidence', () => [{ op: 'create_evidence', args: { card: ID.queue, kind: 'data', text: 'Twelve minutes', stance: 'supports' } }, { op: 'update_evidence', args: { evidence: ID.ev1, fields: { stance: 'contradicts', date: null } } }, { op: 'delete', args: { ids: [ID.ev1] } }]],
    ['create_competitor_feature', () => [{ op: 'create_competitor_feature', args: { competitor: ID.orderly, name: 'Stamps', ours: ID.loyalty, handle: '$f' } }, { op: 'update_competitor_feature', args: { feature: ID.cf1, ours: ID.loyalty } }]],
    ['place_on + take_off', () => [{ op: 'place_on', args: { cards: [ID.barista], plane: ID.planeB } }, { op: 'take_off', args: { cards: [ID.anna], plane: ID.planeA } }, { op: 'place_on', args: { cards: [ID.pkg], plane: ID.planeA, move: true } }]],
  ]
  for (const [name, steps] of batches)
    it(`undo through apply: ${name}`, async () => {
      const before = new Map(fake.data)
      const plans = buildBatch({ ws: ws(), actor: ALICE, now: Date.now(), newId: counterIds('u') }, steps(ws()))
      const res = await apply(WID, plans, { ws: ws(), by: ALICE })
      await res.written
      expect(new Map(fake.data)).not.toEqual(before)
      expect(useHistory.getState().past).toHaveLength(1)
      await undo()
      await settle()
      expect(new Map(fake.data)).toEqual(before)
    })

  it('delete wrappers leave out what a collaborator just deleted and delete the rest', async () => {
    const gone = card(ID.barista)
    fake.data.delete(path('customers', ID.barista))
    echo()
    await deleteCards(WID, [gone, card(ID.menu)], [], [], [])
    expect(fake.data.has(path('problems', ID.menu))).toBe(false)
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['delete 2 cards'])
    await deleteCard(WID, gone)
    expect(useHistory.getState().past).toHaveLength(1)
  })

  it('createEdge with a refused plan returns its id, toasts, and leaves no rejection behind', async () => {
    const spy = vi.fn()
    process.on('unhandledRejection', spy)
    // validate refuses a link whose label is too long (> 200).
    const { createEdgeOp } = await import('../../src/data/edges')
    const r = createEdgeOp(WID, card(ID.preorder), card(ID.menu), 'solves')
    expect(await r.applied).not.toBeNull()
    const bad = await (await import('../../src/data/edges')).updateEdge(WID, ID.e2, { label: 'x'.repeat(300) })
    expect(bad).toBeUndefined()
    await settle()
    expect(useHistory.getState().notice?.text).toMatch(/^Couldn't link label: /)
    process.off('unhandledRejection', spy)
    expect(spy).not.toHaveBeenCalled()
  })

  describe('the UI overlay', () => {
    it('holds a write until the store shows it', async () => {
      await addCard(WID, ID.planeA, 'idea', [150, 400], [])
      expect(recentCount()).toBe(1)
      echo()
      expect(recentCount()).toBe(0)
    })

    it('is cleared by an undo', async () => {
      await addCard(WID, ID.planeA, 'idea', [150, 400], [])
      await retitleCard(WID, card(ID.menu), 'Menus change')
      expect(recentCount()).toBe(2)
      await undo()
      expect(recentCount()).toBe(0)
    })

    it('drops a refused write (and says why)', async () => {
      // A wrapper whose plan validate refuses resolves (nothing written) and says why.
      await expect(updateCard(WID, card(ID.menu), { validation: 'sure' as never }, 'status of')).resolves.toBeUndefined()
      await settle()
      expect(recentCount()).toBe(0)
      expect(useHistory.getState().notice?.text).toMatch(/^Couldn't status of a problem: .*validation/)
      expect(fake.data.get(path('problems', ID.menu))).not.toHaveProperty('validation')
    })

    it('retires after its cap, even if the store never shows it', async () => {
      const id = await addCard(WID, ID.planeA, 'idea', [150, 400], [])
      expect(uiCtx(WID)!.ws.cards.some((c) => c.id === id)).toBe(true)
      const now = Date.now()
      const spy = vi.spyOn(Date, 'now').mockReturnValue(now + 4000)
      try {
        expect(uiCtx(WID)!.ws.cards.some((c) => c.id === id)).toBe(false)
        expect(recentCount()).toBe(0)
      } finally {
        spy.mockRestore()
      }
    })

    it("doesn't hide a collaborator's newer value once the store has shown ours", async () => {
      await retitleCard(WID, card(ID.menu), 'Mine')
      echo()
      fake.data.set(path('problems', ID.menu), { ...fake.data.get(path('problems', ID.menu))!, title: 'Theirs' })
      echo()
      expect(uiCtx(WID)!.ws.cards.find((c) => c.id === ID.menu)!.title).toBe('Theirs')
    })
  })
})
