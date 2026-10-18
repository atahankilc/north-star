// A proposal applied in memory (D-087): the same writes `apply` would make (toWrites), played onto a copy of the
// workspace, plus a mark per item, matrix cell or label they touch. Nothing reaches Firestore. Deleted items and labels
// stay, marked, so the preview can show what goes; what goes with them (links, matrix cells) is dropped.
// For the preview's look (D-096) it also keeps what an edit replaced, where a moved card was, and which items each
// checklist row touches (the stepper and the rows lit between chat and stage).
import { cellId } from '../data/comparisons'
import type { ChangeRef } from '../data/assistant'
import type { NodeType } from '../data/model'
import type { WorkspaceCtx } from '../views/workspace/context'
import { isTitle } from '../views/canvas/titleBlock'
import type { Mark } from '../views/workspace/preview'
import type { ItemRef } from './context'
import { itemsOf, refKey, toWrites, type Change } from './tools'

type Doc = { id: string } & Record<string, unknown>

// One checklist row on the stage: its number in the proposal and the ids it touches (items, cells, labels), the one to
// look at first.
export type Step = { n: number; ids: string[] }

export type Simulation = {
  ws: WorkspaceCtx
  marks: Map<string, Mark>
  // Per edited item or cell: the fields an edit changed, with their values before.
  before: Map<string, Record<string, unknown>>
  // Per moved card or label: where it was.
  from: Map<string, [number, number]>
  steps: Step[]
}

const LIST: Record<NodeType, keyof WorkspaceCtx> = {
  customer: 'customers',
  problem: 'problems',
  idea: 'ideas',
  feature: 'features',
  competitor: 'competitors',
  competitorFeature: 'competitorFeatures',
  package: 'packages',
}

const POSITION = new Set(['x', 'y'])
// A write's null removes a field (D-122): here it's left undefined.
const kept = (fields: Record<string, unknown>) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === null ? undefined : v]))

export function simulate(ws: WorkspaceCtx, accepted: Change[], refs: Map<string, ItemRef>): Simulation {
  const writes = toWrites(accepted, ws, refs)
  const now = Date.now()
  const lists = new Map<keyof WorkspaceCtx, Doc[]>()
  const list = (k: keyof WorkspaceCtx) => {
    if (!lists.has(k)) lists.set(k, [...(ws[k] as unknown as Doc[])])
    return lists.get(k)!
  }
  const marks = new Map<string, Mark>()
  const before = new Map<string, Record<string, unknown>>()
  const from = new Map<string, [number, number]>()
  // Edited wins over moved; new and deleted win over both.
  const mark = (id: string, m: Mark) => {
    const was = marks.get(id)
    if (was === 'new' || was === 'deleted' || (was === 'edited' && m === 'moved')) return
    marks.set(id, m)
  }
  const idOf = (r: ChangeRef) => ('id' in r ? r.id : `preview-${r.key}`)
  // Applies `fields` and remembers what they replaced (the first value, if two rows touch the same field).
  const patch = (k: keyof WorkspaceCtx, id: string, fields: Record<string, unknown>) => {
    const l = list(k)
    const i = l.findIndex((d) => d.id === id)
    if (i < 0) return false
    const old = l[i]
    const changed = Object.keys(fields).filter((f) => !POSITION.has(f) && fields[f] !== old[f] && JSON.stringify(fields[f]) !== JSON.stringify(old[f]))
    if (changed.length) before.set(id, { ...Object.fromEntries(changed.map((f) => [f, old[f]])), ...before.get(id) })
    if ((fields.x !== undefined || fields.y !== undefined) && typeof old.x === 'number' && typeof old.y === 'number' && !from.has(id)) {
      if (fields.x !== old.x || fields.y !== old.y) from.set(id, [old.x, old.y])
    }
    l[i] = { ...old, ...fields, updatedAt: now }
    return true
  }
  const drop = (k: keyof WorkspaceCtx, gone: (d: Doc) => boolean) => lists.set(k, list(k).filter((d) => !gone(d)))
  // The ids each write touches, for its row's step.
  const touched: string[][] = []
  // The workspace's own name and description (D-120): marked on the project block, if the board has one.
  let workspace = ws.workspace
  const titleBlock = ws.labels.find(isTitle)

  writes.forEach((w, n) => {
    const ids: string[] = []
    touched[n] = ids
    switch (w.do) {
      case 'create': {
        const id = idOf({ key: w.key, type: w.type })
        const parent = w.parent ? { competitorId: idOf(w.parent) } : {}
        list(LIST[w.type]).push({ ...w.fields, ...parent, id, createdAt: now, updatedAt: now })
        mark(id, 'new')
        ids.push(id)
        // A competitor's feature sits behind its card on the board: look at the card.
        if (w.parent) ids.push(idOf(w.parent))
        break
      }
      case 'update':
        if (patch(LIST[w.target.type], w.target.id, kept(w.fields))) {
          mark(w.target.id, before.has(w.target.id) ? 'edited' : from.has(w.target.id) ? 'moved' : 'edited')
        }
        ids.push(w.target.id)
        break
      case 'link':
        list('edges').push({ id: `preview-edge-${n}`, fromId: idOf(w.from), fromType: w.from.type, toId: idOf(w.to), toType: w.to.type, kind: w.kind, ...(w.label ? { label: w.label } : {}) })
        ids.push(idOf(w.from), idOf(w.to))
        break
      case 'edge': {
        if (patch('edges', w.id, kept(w.fields))) mark(w.id, 'edited')
        const e = list('edges').find((d) => d.id === w.id)
        if (e) ids.push(e.fromId as string, e.toId as string)
        break
      }
      case 'cell': {
        const featureId = idOf(w.feature)
        const competitorId = idOf(w.competitor)
        const id = cellId(featureId, competitorId)
        const fields = kept({ ...w.fields, ...(w.theirs === undefined ? {} : { competitorFeatureId: w.theirs && idOf(w.theirs) }) })
        if (patch('comparisons', id, fields)) mark(id, 'edited')
        else {
          list('comparisons').push({ ...fields, id, featureId, competitorId, updatedAt: now })
          mark(id, 'new')
        }
        ids.push(id, featureId, competitorId)
        break
      }
      // Evidence (D-137): in its card's panel and tally; the card is what changes on the board.
      case 'evidence': {
        const nodeId = idOf(w.on)
        list('evidence').push({ ...w.fields, id: `preview-evidence-${n}`, nodeId, nodeType: w.on.type, createdAt: now, updatedAt: now })
        if (!marks.has(nodeId)) mark(nodeId, 'edited')
        ids.push(nodeId)
        break
      }
      // A feature's criteria and its cells' scores (D-133); scores of criteria gone are left, unread, as in the app.
      case 'criteria': {
        const featureId = w.feature.id
        if (w.criteria && patch('features', featureId, { criteria: w.criteria })) mark(featureId, 'edited')
        ids.push(featureId)
        for (const c of w.cells) {
          const competitorId = idOf(c.competitor)
          const id = cellId(featureId, competitorId)
          const old = list('comparisons').find((d) => d.id === id)
          const merged = { ...((old?.criteria as Record<string, unknown>) ?? {}), ...c.scores }
          const criteria = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== null))
          const sure = c.confidence === undefined ? {} : { confidence: c.confidence ?? undefined }
          if (patch('comparisons', id, { criteria, ...sure })) mark(id, 'edited')
          else {
            list('comparisons').push({ id, featureId, competitorId, criteria, ...sure, updatedAt: now })
            mark(id, 'new')
          }
          ids.push(id, competitorId)
        }
        break
      }
      case 'delete': {
        // Like cascadeOf (src/data/nodes.ts): a competitor's own features go too; links and matrix cells go with them.
        const gone = new Set([w.target.id])
        if (w.target.type === 'competitor') for (const f of list('competitorFeatures')) if (f.competitorId === w.target.id) gone.add(f.id)
        for (const id of gone) mark(id, 'deleted')
        drop('edges', (e) => gone.has(e.fromId as string) || gone.has(e.toId as string))
        drop('comparisons', (c) => gone.has(c.featureId as string) || gone.has(c.competitorId as string))
        ids.push(w.target.id)
        break
      }
      case 'unlink':
        for (const e of list('edges')) if (w.edgeIds.includes(e.id)) ids.push(e.fromId as string, e.toId as string)
        drop('edges', (e) => w.edgeIds.includes(e.id))
        break
      case 'label':
        if (!w.id) {
          const id = `preview-label-${n}`
          list('labels').push({ ...w.fields, id, createdAt: now, updatedAt: now })
          mark(id, 'new')
          ids.push(id)
        } else {
          patch('labels', w.id, kept(w.fields))
          mark(w.id, before.has(w.id) ? 'edited' : 'moved')
          ids.push(w.id)
        }
        break
      // Kept on the board, marked, like a deleted card.
      case 'unlabel':
        mark(w.id, 'deleted')
        ids.push(w.id)
        break
      case 'project': {
        const old: Record<string, unknown> = workspace
        const changed = Object.keys(w.fields).filter((f) => w.fields[f as 'name'] !== (old[f] ?? ''))
        workspace = { ...workspace, ...w.fields }
        if (titleBlock && changed.length) {
          before.set(titleBlock.id, { ...Object.fromEntries(changed.map((f) => [f, old[f]])), ...before.get(titleBlock.id) })
          mark(titleBlock.id, 'edited')
          ids.push(titleBlock.id)
        }
        break
      }
    }
  })

  // The first writes are the rows, in order (toWrites); an area's row also covers the cards it gathers.
  const steps = accepted.map((c, i): Step => {
    const ids = [...(touched[i] ?? [])]
    if (c.raw.op === 'arrange_area') {
      for (const v of itemsOf(c.raw)) {
        const k = refKey(v)
        if (k) ids.push(refs.get(k)?.id ?? `preview-${k}`)
      }
    }
    return { n: c.n, ids: [...new Set(ids)] }
  })
  return { ws: { ...ws, ...Object.fromEntries(lists), workspace }, marks, before, from, steps }
}
