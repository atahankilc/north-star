// Every node in the workspace by id: what it's called and where it's shown, so a link can
// point anywhere. Everything opens on the board (D-040); a competitor's feature opens in its competitor's panel.
import { useMemo } from 'react'
import type { NodeType } from '../../data/model'
import { useWs } from './context'

export type NodeInfo = {
  id: string
  type: NodeType
  title: string
  // Route that shows the node; `?n=` selects it there.
  path: string
}

export const TYPE_LABELS: Record<NodeType, string> = {
  customer: 'customer',
  problem: 'problem',
  idea: 'idea',
  group: 'group',
  feature: 'feature',
  competitor: 'competitor',
  competitorFeature: 'their feature',
}

export function useNodeIndex(): Map<string, NodeInfo> {
  const { wid, customers, problems, ideas, features, competitors, competitorFeatures } = useWs()
  return useMemo(() => {
    const base = `/w/${wid}`
    const index = new Map<string, NodeInfo>()
    const add = (id: string, type: NodeType, title: string, path: string) => index.set(id, { id, type, title, path })
    for (const c of customers) add(c.id, 'customer', c.title || 'Untitled', `${base}?n=${c.id}`)
    for (const p of problems) add(p.id, 'problem', p.title || 'Untitled', `${base}?n=${p.id}`)
    for (const i of ideas) add(i.id, 'idea', i.title || 'Untitled', `${base}?n=${i.id}`)
    for (const f of features) add(f.id, 'feature', f.title || 'Untitled', `${base}?n=${f.id}`)
    const names = new Map(competitors.map((c) => [c.id, c.name]))
    for (const c of competitors) add(c.id, 'competitor', c.name || 'Untitled', `${base}?n=${c.id}`)
    for (const f of competitorFeatures) {
      const owner = names.get(f.competitorId)
      add(f.id, 'competitorFeature', `${owner ? `${owner} · ` : ''}${f.name || 'Untitled'}`, `${base}?n=${f.competitorId}&f=${f.id}`)
    }
    return index
  }, [wid, customers, problems, ideas, features, competitors, competitorFeatures])
}
