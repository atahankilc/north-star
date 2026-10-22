// What a card says besides its title (D-152, D-205), as the old board's useBoardItems did: the head right of its type
// (a status, a competitor's regions, a feature's priority), its evidence as cells, and the facts line. Counts that come
// from links (D-207): how many solve a problem, compete, are tagged for a customer; a card's customers by name.
import type { Card } from '../../data/cards'
import type { WorkspaceData } from '../../data/workspaceData'
import { FOR } from '../../data/edges'
import { packageTree } from './cardInside'

export type Proof = { supports: number; contradicts: number; clash: boolean }
// `clash`: the status and the evidence disagree (also with no evidence at all), the head in magenta.
export type Facts = { head?: string; clash?: boolean; proof?: Proof; meta: string; sure?: string }

// Where it operates: `US · Germany +1` (D-145).
const regionText = (regions: string[] | undefined) =>
  regions?.length ? regions.slice(0, 2).join(' · ') + (regions.length > 2 ? ` +${regions.length - 2}` : '') : undefined

export function factsOf(cards: Card[], data: Pick<WorkspaceData, 'evidence' | 'competitorFeatures' | 'edges'>): Map<string, Facts> {
  const { edges } = data
  const count = (id: string, kind: string, dir: 'from' | 'to') => edges.filter((e) => e.kind === kind && (dir === 'from' ? e.fromId : e.toId) === id).length
  const linkedTo = (id: string, other: string) =>
    edges.filter((e) => e.kind !== FOR && ((e.fromId === id && e.toType === other) || (e.toId === id && e.fromType === other))).length
  // The customers it's for (D-044), as `[Owners]`.
  const names = new Map(cards.filter((c) => c.type === 'customer').map((c) => [c.id, c.title || 'Untitled']))
  const forOf = (id: string) =>
    edges
      .filter((e) => e.kind === FOR && e.fromId === id && e.toType === 'customer')
      .map((e) => `[${names.get(e.toId) ?? '?'}]`)
      .join(' ')
  const line = (...parts: string[]) => parts.filter(Boolean).join('   ')
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
        out.set(c.id, { ...status, meta: `${count(c.id, FOR, 'to')} tagged for them` })
        break
      case 'problem': {
        const rivals = count(c.id, 'competes-with', 'to') + count(c.id, 'competes-with', 'from')
        out.set(c.id, { ...status, meta: line(`${count(c.id, 'solves', 'to')} solve it · vs ${rivals}`, forOf(c.id)) })
        break
      }
      case 'idea':
        out.set(c.id, { ...status, meta: line(`solves ${count(c.id, 'solves', 'from')} · ${n(linkedTo(c.id, 'feature'), 'feature')}`, forOf(c.id)) })
        break
      case 'competitor': {
        const rivals = new Set(edges.filter((e) => e.kind === 'competes-with' && (e.fromId === c.id || e.toId === c.id)).map((e) => (e.fromId === c.id ? e.toId : e.fromId)))
        out.set(c.id, { head: regionText(c.regions), meta: line(`vs ${rivals.size} · ${n(featureCount.get(c.id) ?? 0, 'feature')}`, forOf(c.id)) })
        break
      }
      case 'feature':
        out.set(c.id, { head: c.priority, meta: line([c.status, c.impact && `impact ${c.impact}`, c.effort && `effort ${c.effort}`].filter(Boolean).join(' · '), forOf(c.id)) })
        break
      case 'package': {
        // What it holds by type, in chain order; its rating and how sure we are (D-239).
        // Its members' parts are in it too.
        const held = packageTree(c, cards, edges).map((r) => r.card)
        const sure = confidenceOf(held)
        out.set(c.id, {
          head: [c.impact && `impact ${c.impact}`, c.effort].filter(Boolean).join(' · ') || undefined,
          clash: sure === 'broken',
          meta:
            ORDER.map((t) => [t, held.filter((k) => k.type === t).length] as const)
              .filter(([, k]) => k)
              .map(([t, k]) => n(k, t))
              .join(' · ') || 'nothing inside',
          // In its panel only: the card has no room.
          sure: sure && `confidence ${sure}`,
        })
        break
      }
    }
  }
  return out
}

const ORDER = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package'] as const

// How sure a package is (D-239, the old feature rule D-138): from the status of what it holds that has one (customers,
// problems, ideas). `broken` when any of them is invalidated; none with a status, nothing to say.
export function confidenceOf(held: Card[]): 'high' | 'medium' | 'low' | 'broken' | undefined {
  const rated = held.filter((k) => k.type === 'customer' || k.type === 'problem' || k.type === 'idea')
  if (!rated.length) return undefined
  if (rated.some((k) => k.validation === 'invalidated')) return 'broken'
  const share = rated.filter((k) => k.validation === 'validated').length / rated.length
  return share >= 0.67 ? 'high' : share >= 0.34 ? 'medium' : 'low'
}
