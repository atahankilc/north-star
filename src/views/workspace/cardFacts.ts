// What a card says besides its title (D-152, D-205), as the old board's useBoardItems did: the head right of its type
// (a status, a competitor's regions, a feature's priority), its evidence as cells, and the facts line. Counts that come
// from links show 0 until links are back on planes (the user's call).
import type { Card } from '../../data/cards'
import type { WorkspaceData } from '../../data/workspaceData'

export type Proof = { supports: number; contradicts: number; clash: boolean }
// `clash`: the status and the evidence disagree (also with no evidence at all), the head in magenta.
export type Facts = { head?: string; clash?: boolean; proof?: Proof; meta: string }

// Where it operates: `US · Germany +1` (D-145).
const regionText = (regions: string[] | undefined) =>
  regions?.length ? regions.slice(0, 2).join(' · ') + (regions.length > 2 ? ` +${regions.length - 2}` : '') : undefined

export function factsOf(cards: Card[], data: Pick<WorkspaceData, 'evidence' | 'competitorFeatures'>): Map<string, Facts> {
  const learned = new Map<string, { supports: number; contradicts: number }>()
  for (const e of data.evidence) {
    const t = learned.get(e.nodeId) ?? { supports: 0, contradicts: 0 }
    t[e.stance === 'supports' ? 'supports' : 'contradicts']++
    learned.set(e.nodeId, t)
  }
  const featureCount = new Map<string, number>()
  for (const f of data.competitorFeatures) featureCount.set(f.competitorId, (featureCount.get(f.competitorId) ?? 0) + 1)
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? '' : 's'}`

  const out = new Map<string, Facts>()
  for (const c of cards) {
    // Status and evidence (D-137): `!` when they disagree.
    const t = learned.get(c.id)
    const v = c.validation
    const clash = !!v && ((v === 'validated' && (!t || t.supports === 0 || t.contradicts > t.supports)) || (v === 'invalidated' && (!t || t.contradicts === 0)))
    const status = { head: v ? `${v}${clash ? ' !' : ''}` : undefined, clash, proof: t ? { ...t, clash } : undefined }
    switch (c.type) {
      case 'customer':
        out.set(c.id, { ...status, meta: '0 tagged for them' })
        break
      case 'problem':
        out.set(c.id, { ...status, meta: '0 solve it · vs 0' })
        break
      case 'idea':
        out.set(c.id, { ...status, meta: `solves 0 · ${n(0, 'feature')}` })
        break
      case 'competitor':
        out.set(c.id, { head: regionText(c.regions), meta: `vs 0 · ${n(featureCount.get(c.id) ?? 0, 'feature')}` })
        break
      case 'feature':
        out.set(c.id, { head: c.priority, meta: [c.status, c.impact && `impact ${c.impact}`, c.effort && `effort ${c.effort}`].filter(Boolean).join(' · ') })
        break
    }
  }
  return out
}
