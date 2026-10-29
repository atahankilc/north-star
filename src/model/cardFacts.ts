// What a card says besides its title (D-152, D-205), as the old board's useBoardItems did: the head right of its type
// (a status, a competitor's regions, a feature's priority), its evidence as cells, and the facts line. Counts that come
// from links (D-207): how many solve a problem, compete, are tagged for a customer; a card's customers by name. Its
// tasks on any kanban, finished and all (D-254), kept apart so the line's cut never hides them.
import type { Card } from './cards'
import type { WorkspaceData } from '../data/workspaceData'
import { FOR, type Edge } from './edges'
import { packageTree } from './cardInside'

export type Proof = { supports: number; contradicts: number; clash: boolean }
// `clash`: the status and the evidence disagree (also with no evidence at all), the head in magenta.
// `planes`: how many planes it's on, when more than one (D-281).
export type Facts = { head?: string; clash?: boolean; proof?: Proof; meta: string; sure?: string; tasks?: { done: number; all: number }; planes?: number }

// Where it operates: `US · Germany +1` (D-145).
const regionText = (regions: string[] | undefined) =>
  regions?.length ? regions.slice(0, 2).join(' · ') + (regions.length > 2 ? ` +${regions.length - 2}` : '') : undefined

export function factsOf(cards: Card[], data: Pick<WorkspaceData, 'evidence' | 'competitorFeatures' | 'edges'>, tasks?: Map<string, { done: number; all: number }>, planes?: Map<string, number>): Map<string, Facts> {
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
        const sure = confidenceOf(held).level
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
    const t2 = tasks?.get(c.id)
    if (t2) out.get(c.id)!.tasks = t2
    const on = planes?.get(c.id)
    if (on && on > 1) out.get(c.id)!.planes = on
  }
  return out
}

const ORDER = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package'] as const

// How sure we are of a feature or a package: one rule (D-253, D-271; D-138's), used by its panel, a package's facts, a
// kanban's sheets and the suggested order. Of the customers, problems and ideas it rests on (a feature: the ideas linked to
// it and the problems they solve, or its parent's when it has none; a package: what it holds, D-239), validated counts
// 2, testing 1, anything else 0; the share of the most it could be: ≥ 0.75 high, ≥ 0.34 medium, else low. Nothing
// behind it: low. Anything there invalidated: `broken` (`!`, and a score of 0).
export type Sure = 'high' | 'medium' | 'low' | 'broken'
export type Confidence = { level: Sure; why: string }
const RATED = (k: Card) => k.type === 'customer' || k.type === 'problem' || k.type === 'idea'
export function confidenceOf(held: Card[]): Confidence {
  const rated = [...new Map(held.filter(RATED).map((k) => [k.id, k])).values()]
  if (!rated.length) return { level: 'low', why: 'nothing behind it yet' }
  const out = rated.find((k) => k.validation === 'invalidated')
  if (out) return { level: 'broken', why: `"${out.title || `untitled ${out.type}`}" is invalidated` }
  const validated = rated.filter((k) => k.validation === 'validated').length
  const testing = rated.filter((k) => k.validation === 'testing').length
  const share = (2 * validated + testing) / (2 * rated.length)
  const guess = rated.length - validated - testing
  const why = `of the ${rated.length} it rests on: ${[validated && `${validated} validated`, testing && `${testing} testing`, guess && `${guess} still a guess`].filter(Boolean).join(', ')}`
  return { level: share >= 0.75 ? 'high' : share >= 0.34 ? 'medium' : 'low', why: rated.length === 1 ? why.replace('of the 1 it rests on', 'what it rests on') : why }
}

// What a feature or a package rests on (see confidenceOf). Others rest on nothing here.
export function restsOn(c: Card, cards: Card[], edges: Edge[]): Card[] {
  if (c.type === 'package') return packageTree(c, cards, edges).map((r) => r.card)
  if (c.type !== 'feature') return []
  const byId = new Map(cards.map((x) => [x.id, x]))
  const ideas = edges
    .filter((e) => e.kind !== FOR && e.kind !== 'part-of' && ((e.fromId === c.id && e.toType === 'idea') || (e.toId === c.id && e.fromType === 'idea')))
    .flatMap((e) => byId.get(e.fromId === c.id ? e.toId : e.fromId) ?? [])
  if (!ideas.length) {
    // A part with nothing of its own rests on what its parent rests on (D-221's "what its parent rests on").
    const parent = edges.find((e) => e.kind === 'part-of' && e.fromId === c.id)
    const p = parent && byId.get(parent.toId)
    return p && p.type === 'feature' ? restsOn(p, cards, edges.filter((e) => e !== parent)) : []
  }
  const problems = ideas.flatMap((i) => edges.filter((e) => e.kind === 'solves' && e.fromId === i.id).flatMap((e) => byId.get(e.toId) ?? []))
  return [...ideas, ...problems]
}

// A feature's or a package's confidence; others have none.
export const confidenceFor = (c: Card, cards: Card[], edges: Edge[]): Confidence | undefined =>
  c.type === 'feature' || c.type === 'package' ? confidenceOf(restsOn(c, cards, edges)) : undefined

// The suggested order (D-138, D-271): impact × confidence ÷ effort, each 1–3; 0 when it rests on something invalidated;
// null until impact and effort are both set (not rated). Rated cards in thirds, best first, as P1–P3; equal scores alike.
const STEP: Record<string, number> = { low: 1, medium: 2, high: 3, S: 1, M: 2, L: 3 }
export function scoreOf(c: Card, sure: Sure | undefined): number | null {
  if (!c.impact || !c.effort) return null
  if (sure === 'broken') return 0
  return (STEP[c.impact] * STEP[sure ?? 'low']) / STEP[c.effort]
}
export type Ranked = { card: Card; score: number; sure: Confidence; suggested: 'P1' | 'P2' | 'P3' }
export function suggestedOrder(list: Card[], cards: Card[], edges: Edge[]): Ranked[] {
  const rated = list.flatMap((card) => {
    const sure = confidenceFor(card, cards, edges) ?? confidenceOf([])
    const score = scoreOf(card, sure.level)
    return score === null ? [] : [{ card, score, sure }]
  })
  rated.sort((a, b) => b.score - a.score || (a.card.title || '').localeCompare(b.card.title || ''))
  const n = rated.length
  // Its third by its place; a score equal to the one before it takes that one's.
  const out: Ranked[] = []
  rated.forEach((r, i) => {
    const third = (Math.min(2, Math.floor((3 * i) / n)) + 1) as 1 | 2 | 3
    const prev = out[i - 1]
    out.push({ ...r, suggested: prev && prev.score === r.score ? prev.suggested : (`P${third}` as Ranked['suggested']) })
  })
  return out
}
