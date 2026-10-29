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
import { addLabel, deleteLabel, discardLabel, labelRef, moveMany, updateLabel } from '../../src/data/labels'
import { cardRef } from '../../src/data/cards'
import { addPiece, deletePiece, linkLens, openPiece, placePiece, renamePiece, setDocumentsSetup } from '../../src/data/pieces'
import { addCanvas, alsoOnCanvas, deleteCanvas, moveCanvas, moveToCanvas, renameCanvas, setCanvasHere, takeOffCanvas } from '../../src/data/canvases'
import { apply, recentCount, uiCtx } from '../../src/ops/firestore'
import { buildBatch } from '../../src/ops/registry'
import { counterIds } from '../../src/ops/newId'
import { ALICE, fixtureDocs, ID, LENS, lensDocs, SEC, T, WID, WORKSPACE, wsFrom } from './fixtures/ws'
import { addCardEntry, addNamed, removeEntry, renameEntry, setCell, setOpen, setPart, setSetup, TEMPLATES as MATRIX_TEMPLATES, type MatrixSetup } from '../../src/data/matrix'
import { addNamedRow, moveColumn, removeColumn, removeRow, renameRow, setColumnWidth, setTable, setTablePart, type TableSetup } from '../../src/data/table'
import { dropCriterionScores } from '../../src/data/competitorFeatures'
import { addTask, deleteColumn, deleteTask, deleteTasks, logLearned, moveTask, moveTasks, moveTasksAway, setChecks, setKanbanCols, setKanbanRows, setKanbanSetup, setTimeline, updateTask, updateTasks, type KanbanSetup } from '../../src/data/tasks'
import { TASKS, taskDocs } from './fixtures/ws'

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

function seed(docs = fixtureDocs()) {
  fake.data.clear()
  fake.commits.n = 0
  fake.commits.batches = []
  for (const c of WS_COLLECTIONS) for (const { id, ...d } of docs[c]) fake.data.set(path(c, id), d)
  const { id: _, ...w } = WORKSPACE
  fake.data.set(`workspaces/${WID}`, structuredClone(w))
  useHistory.setState({ wid: WID, past: [], future: [], notice: null })
  echo()
}

describe('data/ functions as ops', () => {
  beforeEach(() => seed())

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

  describe('text (S5)', () => {
    const lab = (id: string) => ws().labels.find((l) => l.id === id)!

    it("addLabel + its first text (fresh, mergeAlways) are one step even before the echo; canvas text takes the shown canvas", async () => {
      const id = await addLabel(WID, { pieceId: 'canvas', text: '', size: 'heading', x: 100, y: 100 })
      expect(fake.data.get(path('labels', id))).toMatchObject({ pieceId: 'canvas', text: '', size: 'heading', x: 100, y: 100 })
      expect(fake.data.get(path('labels', id))).not.toHaveProperty('canvasId')
      const made = { id, pieceId: 'canvas', text: '', size: 'heading' as const, x: 100, y: 100, createdAt: 0 }
      await updateLabel(WID, made, { text: 'Market', kicker: '03' }, 'text', true)
      expect(fake.data.get(path('labels', id))).toMatchObject({ text: 'Market', kicker: '03' })
      expect(useHistory.getState().past.map((s) => [s.label, s.key])).toEqual([['add a heading', `label:text:${id}`]])
      await undo()
      await settle()
      expect(fake.data.has(path('labels', id))).toBe(false)
    })

    it('a sticky note from the + keeps its fields; discardLabel takes it and its step away', async () => {
      const id = await addLabel(WID, { pieceId: ID.planeA, text: '', kind: 'sticky', w: 150, color: 'yellow', uid: 'u-alice', author: 'Alice', x: 50, y: 400 })
      const { createdAt: _c, updatedAt: _u, ...d } = fake.data.get(path('labels', id))!
      expect(d).toEqual({ pieceId: ID.planeA, text: '', kind: 'sticky', w: 150, color: 'yellow', uid: 'u-alice', author: 'Alice', x: 50, y: 400 })
      await discardLabel(WID, { id })
      expect(fake.data.has(path('labels', id))).toBe(false)
      expect(useHistory.getState().past).toEqual([])
    })

    it('typing merges into one step; the bar is a step of its own; undefined takes a field away', async () => {
      const before = structuredClone(fake.data.get(path('labels', ID.note)))
      await updateLabel(WID, lab(ID.note), { text: 'Ask Anna' }, 'text')
      await updateLabel(WID, lab(ID.note), { text: 'Ask Anna about Mondays' }, 'text')
      await updateLabel(WID, lab(ID.note), { scale: 'small', folded: undefined })
      expect(fake.data.get(path('labels', ID.note))).toMatchObject({ text: 'Ask Anna about Mondays', scale: 'small' })
      expect(useHistory.getState().past.map((s) => s.label)).toEqual(['change a sticky note', 'change a sticky note'])
      await undo()
      await undo()
      await settle()
      expect(fake.data.get(path('labels', ID.note))).toEqual(before)
    })

    it('deleteLabel: the text alone, one step, ⌘Z brings it back', async () => {
      const before = new Map(fake.data)
      await deleteLabel(WID, lab(ID.note))
      expect(fake.data.has(path('labels', ID.note))).toBe(false)
      expect(useHistory.getState().past.map((s) => s.label)).toEqual(['delete a sticky note'])
      await undo()
      await settle()
      expect(new Map(fake.data)).toEqual(before)
    })

    it('moveMany as a section drag passes it (text, a card, a place): one step with its label; ⌘Z puts all back', async () => {
      fake.data.set(path('labels', SEC.plane), { pieceId: ID.planeA, text: 'Ideas', kind: 'section', x: 525, y: 0, w: 450, h: 375, createdAt: T, updatedAt: T })
      echo()
      const before = new Map(fake.data)
      const placeRef = { path: path('places', `${ID.planeB}_${ID.anna}`), id: `${ID.planeB}_${ID.anna}`, parent: { id: 'places' } }
      await moveMany('move a section and what is in it', [
        { ref: labelRef(WID, SEC.plane), from: { x: 525, y: 0 }, to: { x: 575, y: 100 } },
        { ref: labelRef(WID, ID.note), from: { x: 600, y: 50 }, to: { x: 650, y: 150 } },
        { ref: cardRef(WID, 'idea', ID.preorder), from: { x: 550, y: 225 }, to: { x: 600, y: 325 } },
        { ref: placeRef as never, from: { x: 50, y: 300 }, to: { x: 75, y: 300 } },
      ])
      expect(fake.data.get(path('labels', ID.note))).toMatchObject({ x: 650, y: 150 })
      expect(fake.data.get(path('ideas', ID.preorder))).toMatchObject({ x: 600, y: 325 })
      expect(fake.data.get(path('places', `${ID.planeB}_${ID.anna}`))).toEqual({ ...before.get(path('places', `${ID.planeB}_${ID.anna}`)), x: 75 })
      expect(useHistory.getState().past.map((s) => s.label)).toEqual(['move a section and what is in it'])
      expect(fake.commits.n).toBe(1)
      await undo()
      await settle()
      expect(new Map(fake.data)).toEqual(before)
    })

    it('moveMany with a piece and a piece spot: each written where it is (doc, spot), one step, ⌘Z', async () => {
      fake.data.set(path('canvases', 'canv0000000000000002'), { name: 'Engineering', order: 1, createdAt: T })
      fake.data.set(path('pieceSpots', `canv0000000000000002_${ID.planeB}`), { canvasId: 'canv0000000000000002', pieceId: ID.planeB, x: 0, y: 0, createdAt: T })
      echo()
      const before = new Map(fake.data)
      const r = (coll: string, id: string) => ({ path: path(coll, id), id, parent: { id: coll } }) as never
      await moveMany('move a section and what is in it', [
        { ref: r('pieces', ID.planeA), from: { x: 0, y: 0 }, to: { x: 50, y: 25 } },
        { ref: r('pieceSpots', `canv0000000000000002_${ID.planeB}`), from: { x: 0, y: 0 }, to: { x: 75, y: 0 } },
      ])
      expect(fake.data.get(path('pieces', ID.planeA))).toMatchObject({ x: 50, y: 25 })
      expect(fake.data.get(path('pieces', ID.planeA))!.updatedAt).toBeGreaterThan(T)
      expect(fake.data.get(path('pieceSpots', `canv0000000000000002_${ID.planeB}`))).toEqual({ canvasId: 'canv0000000000000002', pieceId: ID.planeB, x: 75, y: 0, createdAt: T })
      expect(fake.data.get(path('pieces', ID.planeB))).toMatchObject({ x: 1100, y: 0 })
      expect(useHistory.getState().past.map((s) => s.label)).toEqual(['move a section and what is in it'])
      await undo()
      await settle()
      expect(new Map(fake.data)).toEqual(before)
    })

    it('arrange of a package through apply brings its members; one ⌘Z puts them back', async () => {
      const before = new Map(fake.data)
      const ctx = { ws: ws(), actor: ALICE, now: Date.now(), newId: counterIds('n') }
      const a = await apply(WID, buildBatch(ctx, [{ op: 'arrange', args: { items: [ID.pkg], by: [100, 0] } }]))
      await a.written
      expect(fake.data.get(path('features', ID.qr))).toMatchObject({ x: 400 })
      expect(fake.data.get(path('features', ID.loyalty))).toMatchObject({ x: 650 })
      expect(useHistory.getState().past.map((s) => s.label)).toEqual(['move a package'])
      await undo()
      await settle()
      expect(new Map(fake.data)).toEqual(before)
    })

    it('arrange through apply: the op works out what the section carries; one undo step', async () => {
      fake.data.set(path('labels', SEC.plane), { pieceId: ID.planeA, text: 'Ideas', kind: 'section', x: 525, y: 0, w: 450, h: 375, createdAt: T, updatedAt: T })
      echo()
      const before = new Map(fake.data)
      const ctx = { ws: ws(), actor: ALICE, now: Date.now(), newId: counterIds('n') }
      const plans = buildBatch(ctx, [{ op: 'arrange', args: { items: [SEC.plane], by: [0, 50] } }])
      const a = await apply(WID, plans)
      await a.written
      expect(fake.data.get(path('ideas', ID.preorder))).toMatchObject({ y: 275 })
      expect(fake.data.get(path('labels', ID.note))).toMatchObject({ y: 100 })
      expect(useHistory.getState().past.map((s) => s.label)).toEqual(['move a section and what is in it'])
      await undo()
      await settle()
      expect(new Map(fake.data)).toEqual(before)
    })
  })
})

// ---- S6: data/pieces.ts and data/canvases.ts over ops.
describe('pieces and canvases as ops (S6)', () => {
  beforeEach(() => seed())
  const piece = (id: string) => ws().pieces.find((p) => p.id === id)!

  it('deletePiece reads its own cascade (whatever lists are passed): one undo step, one ⌘Z brings everything back', async () => {
    const before = new Map(fake.data)
    await deletePiece(WID, ID.planeA, [], [], [], 'plane')
    expect(fake.data.has(path('pieces', ID.planeA))).toBe(false)
    for (const id of [ID.barista, ID.preorder]) expect(fake.data.has(path(id.startsWith('cust') ? 'customers' : 'ideas', id))).toBe(false)
    expect(fake.data.has(path('problems', ID.queue))).toBe(false)
    expect(fake.data.has(path('edges', ID.e1))).toBe(false)
    expect(fake.data.has(path('labels', ID.note))).toBe(false)
    // Anna stays, at home on the market plane.
    expect(fake.data.get(path('customers', ID.anna))).toMatchObject({ pieceId: ID.planeB, x: 50, y: 300 })
    expect(fake.data.has(path('places', `${ID.planeB}_${ID.anna}`))).toBe(false)
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['delete a plane'])
    await undo()
    await settle()
    expect(new Map(fake.data)).toEqual(before)
  })

  it('deletePiece of a matrix takes its cells, of a deck its tasks', async () => {
    await deletePiece(WID, ID.matrix, [], [], [], 'matrix')
    expect([...fake.data.keys()].some((k) => k.includes('/cells/'))).toBe(false)
    echo()
    await deletePiece(WID, ID.deck, [], [], [], 'kanban')
    expect([...fake.data.keys()].some((k) => k.includes('/tasks/'))).toBe(false)
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['delete a matrix', 'delete a deck'])
  })

  it('arrange of a plane through apply carries what is stuck to it; one ⌘Z puts all back', async () => {
    // The deck touching the plane's bottom edge.
    fake.data.set(path('pieces', ID.deck), { ...fake.data.get(path('pieces', ID.deck))!, y: 625 })
    echo()
    const before = new Map(fake.data)
    const ctx = { ws: ws(), actor: ALICE, now: Date.now(), newId: counterIds('n') }
    const a = await apply(WID, buildBatch(ctx, [{ op: 'arrange', args: { items: [ID.planeA], by: [200, 100] } }]))
    await a.written
    expect(fake.data.get(path('pieces', ID.planeA))).toMatchObject({ x: 200, y: 100 })
    expect(fake.data.get(path('pieces', ID.deck))).toMatchObject({ x: 200, y: 725 })
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['move a plane'])
    await undo()
    await settle()
    expect(new Map(fake.data)).toEqual(before)
  })

  it('placePiece (the drag) writes the boxes it is given, followers too, in one step; a resize says so', async () => {
    const a = piece(ID.planeA)
    await placePiece(WID, ID.planeA, a, { ...a, x: 100 }, 'plane', [{ id: ID.deck, from: piece(ID.deck), to: { ...piece(ID.deck), x: 100 } }])
    expect(fake.data.get(path('pieces', ID.deck))).toMatchObject({ x: 100, y: 700 })
    echo()
    await placePiece(WID, ID.planeA, piece(ID.planeA), { ...piece(ID.planeA), w: 1000 }, 'plane')
    expect(fake.data.get(path('pieces', ID.planeA))).toMatchObject({ x: 100, w: 1000 })
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['move a plane', 'resize a plane'])
  })

  it('addPiece makes it on the canvas shown and returns its id; rename merges typing; link and open', async () => {
    const id = await addPiece(WID, 'matrix', [5000, 0], [], undefined, 'Rivals 2')
    expect(fake.data.get(path('pieces', id))).toMatchObject({ kind: 'matrix', name: 'Rivals 2', w: 800, h: 500 })
    expect(fake.data.get(path('pieces', id))!.canvasId).toBeUndefined()
    echo()
    await renamePiece(WID, id, 'Ri', 'matrix')
    await renamePiece(WID, id, 'Rivals', 'matrix')
    echo()
    await linkLens(WID, piece(id), ID.planeB)
    echo()
    await openPiece(WID, piece(id), true)
    expect(fake.data.get(path('pieces', id))).toMatchObject({ name: 'Rivals', stuckTo: ID.planeB, open: true })
    expect(useHistory.getState().past.map((s) => s.label)).toEqual(['add a matrix', 'rename a matrix', 'stick a matrix', 'open a matrix'])
  })

  it('setDocumentsSetup merges into the list setup', async () => {
    fake.data.set(path('pieces', 'docs0000000000000001'), { kind: 'documents', x: 4000, y: 0, w: 800, h: 450, documents: { view: 'table', pageSize: 10 }, createdAt: T, updatedAt: T })
    echo()
    await setDocumentsSetup(WID, piece('docs0000000000000001'), { view: 'shelf', pageSize: undefined })
    expect(fake.data.get(path('pieces', 'docs0000000000000001'))!.documents).toEqual({ view: 'shelf' })
  })

  it('canvases: add (main gets its doc), rename, move, put a plane on it too, take it off, delete it; main is never deleted', async () => {
    const c = await addCanvas(WID, 'Engineering', ws().canvases)
    expect(fake.data.get(path('canvases', c))).toMatchObject({ name: 'Engineering', order: 1, createdBy: 'u-alice' })
    expect(fake.data.get(path('canvases', 'main'))).toMatchObject({ name: 'Main', order: 0 })
    echo()
    await renameCanvas(WID, ws().canvases.find((x) => x.id === c)!, 'Eng')
    echo()
    await moveCanvas(WID, ws().canvases, c, -1)
    echo()
    expect(ws().canvases.map((x) => x.id)).toEqual([c, 'main'])
    const landed = await alsoOnCanvas(WID, ws().canvases.find((x) => x.id === c)!, [piece(ID.planeA)], [piece(ID.planeA)])
    expect(landed).not.toBeNull()
    // planeA with its deck.
    expect(fake.data.has(path('pieceSpots', `${c}_${ID.planeA}`))).toBe(true)
    expect(fake.data.has(path('pieceSpots', `${c}_${ID.deck}`))).toBe(false)
    echo()
    expect(await takeOffCanvas(WID, piece(ID.planeA), c)).toEqual(['main'])
    expect(fake.data.has(path('pieceSpots', `${c}_${ID.planeA}`))).toBe(false)
    echo()
    expect(await takeOffCanvas(WID, piece(ID.planeA), 'main')).toBeNull()
    await deleteCanvas(WID, 'main')
    expect(fake.data.has(path('canvases', 'main'))).toBe(true)
    expect(useHistory.getState().notice?.text ?? '').toMatch(/never deleted/)
    const before = new Map(fake.data)
    await deleteCanvas(WID, c)
    expect(fake.data.has(path('canvases', c))).toBe(false)
    await undo()
    await settle()
    expect(new Map(fake.data)).toEqual(before)
  })

  it('moveToCanvas moves what it is given (by the boxes given) and lets go of a host that stays', async () => {
    const c = await addCanvas(WID, 'Ops', ws().canvases)
    echo()
    setCanvasHere('main')
    const to = ws().canvases.find((x) => x.id === c)!
    const landed = await moveToCanvas(WID, to, [piece(ID.deck)], [], [piece(ID.deck)], [], [])
    expect(landed).toMatchObject({ w: 900, h: 500 })
    expect(fake.data.get(path('pieces', ID.deck))).toMatchObject({ canvasId: c })
    expect(fake.data.get(path('pieces', ID.deck))!.stuckTo).toBeUndefined()
    expect(useHistory.getState().past.at(-1)!.label).toBe('move a deck to Ops')
  })
})


// ---- S7: data/matrix.ts, data/table.ts and dropCriterionScores over ops.
describe('matrices, tables and criteria as ops (S7)', () => {
  beforeEach(() => seed(lensDocs()))
  const piece = (id: string) => ws().pieces.find((p) => p.id === id)!
  const mx = () => piece(ID.matrix).matrix as MatrixSetup
  const tb = () => piece(LENS.table).table as TableSetup
  const cellDoc = (m: string, r: string, c: string) => fake.data.get(path('cells', `${m}_${r}_${c}`))
  const labels = () => useHistory.getState().past.map((x) => x.label)

  it('setCell: a set with merge (the note stays); typing a note merges into one step; ⌘Z puts the cell back as it was', async () => {
    await setCell(WID, ID.matrix, LENS.square, ID.qr, { value: 'full' })
    expect(cellDoc(ID.matrix, LENS.square, ID.qr)).toMatchObject({ value: 'full', notes: 'no QR' })
    echo()
    await setCell(WID, ID.matrix, LENS.square, ID.qr, { notes: 'QR' })
    echo()
    await setCell(WID, ID.matrix, LENS.square, ID.qr, { notes: 'QR soon' })
    echo()
    expect(labels()).toEqual(['matrix cell', 'matrix cell'])
    expect(cellDoc(ID.matrix, LENS.square, ID.qr)).toMatchObject({ value: 'full', notes: 'QR soon' })
    await undo()
    await settle()
    expect(cellDoc(ID.matrix, LENS.square, ID.qr)).toMatchObject({ value: 'full', notes: 'no QR' })
    echo()
    // A step cleared (Backspace), `—`, a new cell made and undone: gone again.
    await setCell(WID, ID.matrix, LENS.square, ID.qr, { value: undefined, notRelevant: true })
    expect(cellDoc(ID.matrix, LENS.square, ID.qr)).toMatchObject({ notRelevant: true, notes: 'no QR' })
    expect(cellDoc(ID.matrix, LENS.square, ID.qr)).not.toHaveProperty('value')
    echo()
    await setCell(WID, ID.matrix, LENS.square, ID.loyalty, { value: 'partial' })
    expect(cellDoc(ID.matrix, LENS.square, ID.loyalty)).toMatchObject({ matrixId: ID.matrix, value: 'partial' })
    await undo()
    await settle()
    expect(cellDoc(ID.matrix, LENS.square, ID.loyalty)).toBeUndefined()
  })

  it('a table cell through setCell (a check), refused out-of-range values say so in the toast', async () => {
    await setCell(WID, LENS.table, ID.qr, LENS.done, { value: 'yes' })
    expect(cellDoc(LENS.table, ID.qr, LENS.done)).toMatchObject({ value: 'yes' })
    echo()
    await setCell(WID, LENS.table, ID.qr, LENS.risk, { value: 'enormous' })
    expect(cellDoc(LENS.table, ID.qr, LENS.risk)).toBeUndefined()
    expect(useHistory.getState().notice?.text ?? '').toMatch(/isn't one of the scale's steps/)
  })

  it('entries: addNamed returns its id, renaming merges, removing a typed row takes its cells (one ⌘Z back), hiding a card keeps them', async () => {
    const id = await addNamed(WID, ID.matrix, mx(), 'rows')
    expect(id).toMatch(/^[A-Za-z0-9]{6,8}$/)
    echo()
    await renameEntry(WID, ID.matrix, mx(), 'rows', id, 'To')
    echo()
    await renameEntry(WID, ID.matrix, mx(), 'rows', id, 'Toast')
    echo()
    expect(mx().rows.items.at(-1)).toEqual({ id, name: 'Toast' })
    expect(labels()).toEqual(['change a matrix', 'change a matrix'])
    const before = new Map(fake.data)
    const sq = { key: LENS.square, name: 'Square', item: mx().rows.items[0], auto: false }
    await removeEntry(WID, ID.matrix, mx(), 'rows', sq, [])
    expect(cellDoc(ID.matrix, LENS.square, ID.qr)).toBeUndefined()
    expect(labels().at(-1)).toBe('take out a row')
    await undo()
    await settle()
    expect(new Map(fake.data)).toEqual(before)
    echo()
    await removeEntry(WID, ID.matrix, mx(), 'rows', { key: ID.orderly, name: 'Orderly', auto: true }, [])
    expect(mx().rows.hide ?? fake.data.get(path('pieces', ID.matrix))!.matrix).toBeDefined()
    expect((fake.data.get(path('pieces', ID.matrix))!.matrix as MatrixSetup).rows.hide).toEqual([ID.orderly])
    expect(cellDoc(ID.matrix, ID.orderly, ID.qr)).toBeDefined()
    echo()
    await addCardEntry(WID, ID.matrix, mx(), 'rows', card(ID.orderly))
    expect((fake.data.get(path('pieces', ID.matrix))!.matrix as MatrixSetup).rows.hide).toBeUndefined()
  })

  it('setPart: an axis with one entry added goes as axis_add (a collaborator\'s change kept); setOpen; setSetup', async () => {
    // A collaborator renamed Square meanwhile: the editor's stale axis adds an entry, and the rename stays.
    const stale = structuredClone(mx().rows)
    const m = fake.data.get(path('pieces', ID.matrix))! as { matrix: MatrixSetup }
    m.matrix.rows.items[0].name = 'Square Inc'
    echo()
    await setPart(WID, ID.matrix, 'rows', { ...stale, items: [...stale.items, { id: 'x1', name: 'Zettle' }] })
    expect((fake.data.get(path('pieces', ID.matrix))!.matrix as MatrixSetup).rows.items.map((i) => i.name)).toEqual(['Square Inc', 'Zettle'])
    echo()
    await setPart(WID, ID.matrix, 'cell', 'number')
    await setPart(WID, ID.matrix, 'unit', '€', 'unit')
    echo()
    await setOpen(WID, ID.matrix, mx(), 'cols', [ID.qr], true)
    echo()
    expect(mx()).toMatchObject({ cell: 'number', unit: '€', cols: { open: [ID.qr] } })
    await setOpen(WID, ID.matrix, mx(), 'cols', [ID.qr], false)
    echo()
    expect(mx().cols.open).toBeUndefined()
    await setSetup(WID, ID.matrix, MATRIX_TEMPLATES[1].setup())
    expect(mx()).toBeDefined()
    expect((fake.data.get(path('pieces', ID.matrix))!.matrix as MatrixSetup).rows.type).toBe('problem')
    expect(labels()).toEqual(['change a matrix', 'change a matrix', 'change a matrix', 'change a matrix', 'change a matrix', 'set up a matrix'])
  })

  it('tables: a named row, a column added through setTablePart (one change → axis_add), width, sort, move, a column taken out with its cells and sort', async () => {
    const r = await addNamedRow(WID, LENS.table, tb())
    echo()
    await renameRow(WID, LENS.table, tb(), r, 'Hiring')
    echo()
    expect(tb().rows.items.at(-1)).toEqual({ id: r, name: 'Hiring' })
    await setTablePart(WID, LENS.table, 'cols', [...tb().cols, { id: 'new001', name: 'owner', kind: 'text' }])
    echo()
    expect(tb().cols.at(-1)).toEqual({ id: 'new001', name: 'owner', kind: 'text' })
    await setColumnWidth(WID, LENS.table, tb(), LENS.cost, 2000)
    await setColumnWidth(WID, LENS.table, tb(), 'name', 100)
    echo()
    expect(tb().cols.find((c) => c.id === LENS.cost)!.width).toBe(640)
    expect(tb().nameWidth).toBe(100)
    await setTablePart(WID, LENS.table, 'sort', { col: LENS.risk, desc: true })
    echo()
    expect(await moveColumn(WID, LENS.table, tb(), LENS.status, -1)).toBeUndefined()
    await moveColumn(WID, LENS.table, tb(), LENS.status, 1)
    echo()
    expect(tb().cols.map((c) => c.id).slice(0, 2)).toEqual([LENS.cost, LENS.status])
    // An edit through the editor's whole list: one column changed → axis_update.
    await setTablePart(WID, LENS.table, 'cols', tb().cols.map((c) => (c.id === LENS.risk ? { ...c, name: 'danger' } : c)), `col:${LENS.risk}:name`)
    echo()
    expect(tb().cols.find((c) => c.id === LENS.risk)!.name).toBe('danger')
    await removeColumn(WID, LENS.table, tb(), LENS.risk, [])
    echo()
    expect(tb().sort).toBeUndefined()
    await removeColumn(WID, LENS.table, tb(), LENS.cost, [])
    expect(cellDoc(LENS.table, ID.qr, LENS.cost)).toBeUndefined()
    echo()
    await removeRow(WID, LENS.table, tb(), { key: LENS.backlog, name: 'Ops work', item: tb().rows.items[0], auto: false }, [])
    expect(cellDoc(LENS.table, LENS.backlog, LENS.done)).toBeUndefined()
    expect(labels().slice(-3)).toEqual(['take out a column', 'take out a column', 'take out a row'])
    await setTable(WID, LENS.table, { rows: { rules: [], items: [] }, cols: [] }, 'Fresh')
    expect(fake.data.get(path('pieces', LENS.table))).toMatchObject({ name: 'Fresh', table: { rows: { rules: [], items: [] }, cols: [] } })
    expect(labels().at(-1)).toBe('set up a table')
  })

  it("a stale column list with one edit, after a collaborator added a column with a cell: their column and cell stay, the edit lands", async () => {
    const stale = structuredClone(tb())
    await setTablePart(WID, LENS.table, 'cols', [...tb().cols, { id: 'theirs', name: 'theirs', kind: 'text' }])
    echo()
    await setCell(WID, LENS.table, ID.qr, 'theirs', { value: 'their words' })
    echo()
    await setTablePart(WID, LENS.table, 'cols', stale.cols.map((c) => (c.id === LENS.cost ? { ...c, name: 'price' } : c)), `col:${LENS.cost}:name`)
    echo()
    expect(tb().cols.map((c) => c.id)).toEqual([LENS.status, LENS.cost, LENS.done, LENS.risk, 'theirs'])
    expect(tb().cols.find((c) => c.id === LENS.cost)!.name).toBe('price')
    expect(cellDoc(LENS.table, ID.qr, 'theirs')).toMatchObject({ value: 'their words' })
    expect(cellDoc(LENS.table, ID.qr, LENS.cost)).toMatchObject({ value: 1200 })
  })

  it('dropCriterionScores reads its cascade from the workspace (whatever is passed): cells and old scores, one step, one ⌘Z back', async () => {
    const before = new Map(fake.data)
    await dropCriterionScores(WID, ID.qr, 'c1', [], { ref: {} as never, write: () => {} }, [])
    expect(fake.data.get(path('features', ID.qr))!.criteria).toBeUndefined()
    expect(cellDoc(ID.matrix, ID.orderly, `${ID.qr}~c1`)).toBeUndefined()
    expect(fake.data.get(path('comparisons', `${ID.qr}_${ID.orderly}`))!.criteria).toBeUndefined()
    expect(labels()).toEqual(['remove a criterion'])
    await undo()
    await settle()
    expect(new Map(fake.data)).toEqual(before)
  })
})

describe('tasks, decks and timelines as ops (S8)', () => {
  beforeEach(() => seed(taskDocs()))
  const taskDoc = (id: string) => fake.data.get(path('tasks', id))
  const deckDoc = (id: string) => fake.data.get(path('pieces', id))!.kanban as KanbanSetup
  const labels = () => useHistory.getState().past.map((x) => x.label)

  it('addTask returns its id at once, one step; given to someone, given by the signed-in person; ⌘Z takes it away', async () => {
    const id = addTask(WID, ID.deck, 'doing', 2, 'Call the printer', 'u-alice', { assignee: 'u-bob', assigneeName: 'Bob', cardId: ID.qr, cardType: 'feature' })
    expect(id).toBeTruthy()
    await settle()
    expect(taskDoc(id)).toMatchObject({ pieceId: ID.deck, col: 'doing', order: 2, title: 'Call the printer', assignee: 'u-bob', assigneeName: 'Bob', givenBy: 'u-alice', cardId: ID.qr, cardType: 'feature', uid: 'u-alice' })
    expect(labels()).toEqual(['add a task'])
    await undo()
    await settle()
    expect(taskDoc(id)).toBeUndefined()
    // A deck holding cards: nothing made, said in the toast.
    expect(addTask(WID, TASKS.cardsDeck, 'k1', 1, 'x', 'u-alice')).toBe('')
    expect(useHistory.getState().notice?.text ?? '').toMatch(/holds cards/)
  })

  it('typing a title merges into one step; checklist typing in one row merges; other fields are their own steps; ⌘Z puts them back', async () => {
    const before = structuredClone(taskDoc(TASKS.task3))
    await updateTask(WID, { id: TASKS.task3 }, { title: 'Write the' }, 'rename a task')
    echo()
    await updateTask(WID, { id: TASKS.task3 }, { title: 'Write the deck' }, 'rename a task')
    echo()
    expect(labels()).toEqual(['rename a task'])
    const checks = (text: string) => [{ id: 'ch1', text }, { id: 'ch2', text: 'slides', done: true }]
    await setChecks(WID, { id: TASKS.task3 }, checks('outl'), `check:${TASKS.task3}:ch1`)
    echo()
    await setChecks(WID, { id: TASKS.task3 }, checks('outline v2'), `check:${TASKS.task3}:ch1`)
    echo()
    await updateTask(WID, { id: TASKS.task3 }, { due: '2026-11-12' }, 'set a due day')
    echo()
    await updateTask(WID, { id: TASKS.task3 }, { assignee: 'u-bob', assigneeName: 'Bob' }, 'give a task')
    echo()
    await updateTask(WID, { id: TASKS.task3 }, { priority: undefined }, 'clear a task’s priority')
    echo()
    expect(labels()).toEqual(['rename a task', 'change a checklist', 'set a due day', 'give a task', 'clear a task’s priority'])
    expect(taskDoc(TASKS.task3)).toMatchObject({ title: 'Write the deck', due: '2026-11-12', assignee: 'u-bob', givenBy: 'u-alice', checks: checks('outline v2') })
    expect(taskDoc(TASKS.task3)).not.toHaveProperty('priority')
    for (let i = 0; i < 5; i++) await undo()
    await settle()
    expect(taskDoc(TASKS.task3)).toEqual(before)
  })

  it('moveTasks: several tasks, one step, one batch, their lane fields too; moveTask and updateTasks one step each', async () => {
    fake.commits.batches = []
    await moveTasks(WID, [{ id: ID.task1, col: 'doing', order: 2, fields: { assignee: 'u-bob', assigneeName: 'Bob' } }, { id: TASKS.task3, col: 'doing', order: 3 }], 'move 2 tasks')
    expect(fake.commits.batches).toEqual([2])
    expect([taskDoc(ID.task1), taskDoc(TASKS.task3)].map((t) => [t!.col, t!.order])).toEqual([['doing', 2], ['doing', 3]])
    expect(taskDoc(ID.task1)).toMatchObject({ assignee: 'u-bob', givenBy: 'u-alice' })
    echo()
    await moveTask(WID, { id: ID.task1 }, 'done', 1)
    echo()
    await updateTasks(WID, [ID.task1, TASKS.task3], { due: undefined }, 'clear 2 tasks’ due day')
    expect(taskDoc(ID.task1)).not.toHaveProperty('due')
    expect(labels()).toEqual(['move 2 tasks', 'move a task', 'clear 2 tasks’ due day'])
    await undo()
    await undo()
    await undo()
    await settle()
    expect(taskDoc(ID.task1)).toMatchObject({ col: 'todo', order: 1, due: '2026-11-05' })
    expect(taskDoc(ID.task1)).not.toHaveProperty('assignee')
  })

  it('deleteColumn reads the tasks itself (only its deck’s), moves them to the column before: one step; ⌘Z brings the column and their places back', async () => {
    const before = new Map(fake.data)
    // The lists passed are ignored: the op reads the workspace.
    await deleteColumn(WID, ID.deck, [], 'todo', [])
    expect(deckDoc(ID.deck).cols.map((c) => c.id)).toEqual(['doing', 'done'])
    expect([taskDoc(ID.task1), taskDoc(TASKS.task3)].map((t) => [t!.col, t!.order])).toEqual([['doing', 2], ['doing', 3]])
    expect(taskDoc(TASKS.task4)!.col).toBe('review')
    expect(labels()).toEqual(['delete a column'])
    await undo()
    await settle()
    expect(new Map(fake.data)).toEqual(before)
  })

  it('setKanbanCols: an added column, a rename, a limit, a move each go through the one column op; a name typed with a key merges', async () => {
    const cols = () => deckDoc(TASKS.ops).cols
    await setKanbanCols(WID, TASKS.ops, [...cols(), { id: 'newc', name: 'new column' }], 'add a column')
    echo()
    expect(cols().at(-1)).toEqual({ id: 'newc', name: 'new column' })
    await setKanbanCols(WID, TASKS.ops, cols().map((c) => (c.id === 'newc' ? { ...c, name: 'blo' } : c)), 'rename a column', 'col:newc')
    echo()
    await setKanbanCols(WID, TASKS.ops, cols().map((c) => (c.id === 'newc' ? { ...c, name: 'blocked' } : c)), 'rename a column', 'col:newc')
    echo()
    await setKanbanCols(WID, TASKS.ops, cols().map((c) => (c.id === 'review' ? { ...c, limit: undefined } : c)), 'take a column’s limit away')
    echo()
    const c = cols()
    await setKanbanCols(WID, TASKS.ops, [c[1], c[0], ...c.slice(2)], 'move a column')
    echo()
    expect(cols().map((x) => [x.id, x.name, x.limit ?? null])).toEqual([['review', 'review', null], ['todo', 'Todo', null], ['shipped', 'shipped', null], ['newc', 'blocked', null]])
    expect(labels()).toEqual(['add a column', 'rename a column', 'take a column’s limit away', 'move a column'])
  })

  it('setKanbanCols with a stale list (a column someone took away since): written whole, the rename kept, not read as an add', async () => {
    // The editor still holds `review`, which a collaborator deleted; it renames `todo`.
    const stale = structuredClone(deckDoc(TASKS.ops).cols)
    const now = stale.filter((c) => c.id !== 'review')
    fake.data.set(path('pieces', TASKS.ops), { ...fake.data.get(path('pieces', TASKS.ops))!, kanban: { cols: now } })
    echo()
    await setKanbanCols(WID, TASKS.ops, stale.map((c) => (c.id === 'todo' ? { ...c, name: 'inbox' } : c)), 'rename a column')
    expect(deckDoc(TASKS.ops).cols.map((c) => [c.id, c.name])).toEqual([['todo', 'inbox'], ['review', 'review'], ['shipped', 'shipped']])
    expect(labels()).toEqual(['rename a column'])
  })

  it('setKanbanCols with a stale list whose last column was taken away since: written whole, the rename kept', async () => {
    const stale = structuredClone(deckDoc(TASKS.ops).cols)
    fake.data.set(path('pieces', TASKS.ops), { ...fake.data.get(path('pieces', TASKS.ops))!, kanban: { cols: stale.slice(0, -1) } })
    echo()
    await setKanbanCols(WID, TASKS.ops, stale.map((c) => (c.id === 'todo' ? { ...c, name: 'inbox' } : c)), 'rename a column')
    expect(deckDoc(TASKS.ops).cols.map((c) => [c.id, c.name])).toEqual([['todo', 'inbox'], ['review', 'review'], ['shipped', 'shipped']])
    expect(labels()).toEqual(['rename a column'])
  })

  it('setKanbanRows, setKanbanSetup and setTimeline: one step each, as before', async () => {
    await setKanbanRows(WID, ID.deck, 'assignee')
    expect(deckDoc(ID.deck).rows).toBe('assignee')
    echo()
    await setKanbanSetup(WID, TASKS.cardsDeck, { rowField: 'impact' }, 'a deck’s rows by impact')
    expect(deckDoc(TASKS.cardsDeck).rowField).toBe('impact')
    echo()
    await setTimeline(WID, TASKS.timeline, { rows: 'card' }, 'change a timeline’s rows')
    expect(fake.data.get(path('pieces', TASKS.timeline))!.timeline).toEqual({ rows: 'card' })
    expect(labels()).toEqual(['lanes by who', 'a deck’s rows by impact', 'change a timeline’s rows'])
  })

  it('moveTasksAway (D-300): the tasks moved and the deck holding cards, one step; ⌘Z puts all back', async () => {
    const before = new Map(fake.data)
    await moveTasksAway(
      WID,
      [
        { id: ID.task1, pieceId: TASKS.ops, col: 'todo', order: 1 },
        { id: TASKS.task3, pieceId: TASKS.ops, col: 'todo', order: 2 },
        { id: ID.task2, pieceId: TASKS.ops, col: 'todo', order: 3 },
      ],
      ID.deck,
      { holds: 'cards', colField: 'status', source: { rules: [{ field: 'type', values: ['feature'] }], items: [] } },
      'move 3 tasks to Ops, hold cards',
    )
    expect(deckDoc(ID.deck)).toMatchObject({ holds: 'cards', colField: 'status' })
    expect([ID.task1, TASKS.task3, ID.task2].map((id) => taskDoc(id)!.pieceId)).toEqual([TASKS.ops, TASKS.ops, TASKS.ops])
    expect(labels()).toEqual(['move 3 tasks to Ops, hold cards'])
    await undo()
    await settle()
    expect(new Map(fake.data)).toEqual(before)
  })

  it('logLearned: evidence on the card and the task marked, one step; deleteTask and deleteTasks', async () => {
    await logLearned(WID, { id: ID.task1 }, { nodeId: ID.anna, nodeType: 'customer', kind: 'interview', text: 'Sundays are slow', stance: 'supports', source: '' })
    const ev = [...fake.data.entries()].find(([p, d]) => p.includes('/evidence/') && d.text === 'Sundays are slow')!
    expect(ev[1]).toMatchObject({ nodeId: ID.anna, nodeType: 'customer' })
    expect(ev[1]).not.toHaveProperty('source')
    expect(taskDoc(ID.task1)!.learned).toBe(ev[0].split('/').pop())
    echo()
    await deleteTask(WID, { id: ID.task2 })
    echo()
    await deleteTasks(WID, [ID.task1, TASKS.task3, 'gone-already'])
    expect([ID.task1, ID.task2, TASKS.task3].map((id) => taskDoc(id))).toEqual([undefined, undefined, undefined])
    expect(labels()).toEqual(['log what a task taught', 'delete a task', 'delete 3 tasks'])
  })
})
