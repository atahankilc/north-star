// A proposal applied in memory (D-087): the same writes `apply` would make (toWrites), played onto a copy of the
// workspace, plus a mark per item or matrix cell they touch. Nothing reaches Firestore. Deleted items stay, marked,
// so the preview can show what goes; what goes with them (links, matrix cells) is dropped.
import { cellId } from '../data/comparisons'
import type { ChangeRef } from '../data/assistant'
import type { NodeType } from '../data/model'
import type { WorkspaceCtx } from '../views/workspace/context'
import type { Mark } from '../views/workspace/preview'
import type { ItemRef } from './context'
import { toWrites, type Change } from './tools'

type Doc = { id: string } & Record<string, unknown>

const LIST: Record<NodeType, keyof WorkspaceCtx> = {
  customer: 'customers',
  problem: 'problems',
  idea: 'ideas',
  feature: 'features',
  competitor: 'competitors',
  competitorFeature: 'competitorFeatures',
}

export function simulate(ws: WorkspaceCtx, accepted: Change[], refs: Map<string, ItemRef>): { ws: WorkspaceCtx; marks: Map<string, Mark> } {
  const writes = toWrites(accepted, ws, refs)
  const now = Date.now()
  const lists = new Map<keyof WorkspaceCtx, Doc[]>()
  const list = (k: keyof WorkspaceCtx) => {
    if (!lists.has(k)) lists.set(k, [...(ws[k] as unknown as Doc[])])
    return lists.get(k)!
  }
  const marks = new Map<string, Mark>()
  // Edited wins over moved; new and deleted win over both.
  const mark = (id: string, m: Mark) => {
    const was = marks.get(id)
    if (was === 'new' || was === 'deleted' || (was === 'edited' && m === 'moved')) return
    marks.set(id, m)
  }
  const idOf = (r: ChangeRef) => ('id' in r ? r.id : `preview-${r.key}`)
  const patch = (k: keyof WorkspaceCtx, id: string, fields: Record<string, unknown>) => {
    const l = list(k)
    const i = l.findIndex((d) => d.id === id)
    if (i >= 0) l[i] = { ...l[i], ...fields, updatedAt: now }
    return i >= 0
  }
  const drop = (k: keyof WorkspaceCtx, gone: (d: Doc) => boolean) => lists.set(k, list(k).filter((d) => !gone(d)))

  writes.forEach((w, n) => {
    switch (w.do) {
      case 'create': {
        const id = idOf({ key: w.key, type: w.type })
        const parent = w.parent ? { competitorId: idOf(w.parent) } : {}
        list(LIST[w.type]).push({ ...w.fields, ...parent, id, createdAt: now, updatedAt: now })
        mark(id, 'new')
        break
      }
      case 'update':
        if (patch(LIST[w.target.type], w.target.id, w.fields)) {
          mark(w.target.id, Object.keys(w.fields).every((k) => k === 'x' || k === 'y') ? 'moved' : 'edited')
        }
        break
      case 'link':
        list('edges').push({ id: `preview-edge-${n}`, fromId: idOf(w.from), fromType: w.from.type, toId: idOf(w.to), toType: w.to.type, kind: w.kind, ...(w.label ? { label: w.label } : {}) })
        break
      case 'cell': {
        const featureId = idOf(w.feature)
        const competitorId = idOf(w.competitor)
        const id = cellId(featureId, competitorId)
        if (patch('comparisons', id, w.fields)) mark(id, 'edited')
        else {
          list('comparisons').push({ ...w.fields, id, featureId, competitorId, updatedAt: now })
          mark(id, 'new')
        }
        break
      }
      case 'delete': {
        // Like cascadeOf (src/data/nodes.ts): a competitor's own features go too; links and matrix cells go with them.
        const ids = new Set([w.target.id])
        if (w.target.type === 'competitor') for (const f of list('competitorFeatures')) if (f.competitorId === w.target.id) ids.add(f.id)
        for (const id of ids) mark(id, 'deleted')
        drop('edges', (e) => ids.has(e.fromId as string) || ids.has(e.toId as string))
        drop('comparisons', (c) => ids.has(c.featureId as string) || ids.has(c.competitorId as string))
        break
      }
      case 'unlink':
        drop('edges', (e) => w.edgeIds.includes(e.id))
        break
      case 'label':
        if (!w.id) list('labels').push({ ...w.fields, id: `preview-label-${n}`, createdAt: now, updatedAt: now })
        else patch('labels', w.id, w.fields)
        break
      case 'unlabel':
        drop('labels', (l) => l.id === w.id)
        break
    }
  })
  return { ws: { ...ws, ...Object.fromEntries(lists) }, marks }
}
