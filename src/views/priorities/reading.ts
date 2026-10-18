// How sure we are a feature is worth building, and how it ranks (D-138). Confidence isn't set by hand: it comes from the
// status of what the feature rests on, its chain (the ideas it comes from, the problems they solve, the customers they
// are for, as the focus view follows it, D-127), which evidence informs (D-137). Shared by the priorities view, the
// feature's panel and the assistant's brief.
import type { WithId } from '../../data/hooks'
import { FEATURE_EFFORTS, FEATURE_IMPACTS, type Feature, type Validation } from '../../data/model'
import { focusSet } from '../canvas/focus'
import type { WorkspaceCtx } from '../workspace/context'

export const LEVELS = ['low', 'medium', 'high'] as const
export type Level = (typeof LEVELS)[number]

export type Basis = { id: string; type: 'customer' | 'problem' | 'idea'; title: string; validation?: Validation }

export type Confidence = {
  level: Level
  // The chain's customers, problems and ideas it rests on.
  basis: Basis[]
  // One of them was shown wrong.
  invalidated: Basis[]
  why: string
}

type Chain = Pick<WorkspaceCtx, 'customers' | 'problems' | 'ideas' | 'features' | 'competitors' | 'edges' | 'competitorFeatures'>

const POINTS: Partial<Record<Validation, number>> = { validated: 2, testing: 1 }

export function confidenceOf(feature: { id: string }, ws: Chain): Confidence {
  const cards = [
    ...ws.customers.map((c) => ({ ...c, type: 'customer' as const })),
    ...ws.problems.map((c) => ({ ...c, type: 'problem' as const })),
    ...ws.ideas.map((c) => ({ ...c, type: 'idea' as const })),
  ]
  const items = [
    ...cards.map((c) => ({ id: c.id, type: c.type })),
    ...ws.features.map((f) => ({ id: f.id, type: 'feature' as const })),
    ...ws.competitors.map((c) => ({ id: c.id, type: 'competitor' as const })),
  ]
  const chain = focusSet(feature.id, items, ws.edges, ws.competitorFeatures)
  const basis: Basis[] = cards.filter((c) => chain.has(c.id)).map((c) => ({ id: c.id, type: c.type, title: c.title || 'Untitled', validation: c.validation }))
  const invalidated = basis.filter((b) => b.validation === 'invalidated')
  if (!basis.length) return { level: 'low', basis, invalidated, why: 'Nothing behind it: link it to the idea and problem it comes from.' }
  if (invalidated.length) return { level: 'low', basis, invalidated, why: `Rests on something shown wrong: ${invalidated.map((b) => b.title).join(', ')}.` }
  const share = basis.reduce((n, b) => n + (POINTS[b.validation!] ?? 0), 0) / (2 * basis.length)
  const level: Level = share >= 0.75 ? 'high' : share >= 0.34 ? 'medium' : 'low'
  const count = (v: Validation) => basis.filter((b) => b.validation === v).length
  const parts = [count('validated') && `${count('validated')} validated`, count('testing') && `${count('testing')} testing`]
  const guesses = basis.length - count('validated') - count('testing')
  if (guesses) parts.push(`${guesses} still a guess`)
  return { level, basis, invalidated, why: `Of the ${basis.length} it rests on: ${parts.filter(Boolean).join(', ')}.` }
}

const rank = (list: readonly string[], v: string | undefined) => (v ? list.indexOf(v) + 1 : 0)

// Impact × confidence ÷ effort, each 1–3: 9 for a high-impact, well-backed small thing, 1/3 for the opposite; 0 when it
// rests on something shown wrong, however cheap. Null until both impact and effort are set.
export function scoreOf(f: Feature, confidence: Confidence): number | null {
  const impact = rank(FEATURE_IMPACTS, f.impact)
  const effort = rank(FEATURE_EFFORTS, f.effort)
  if (!impact || !effort) return null
  if (confidence.invalidated.length) return 0
  return (impact * rank(LEVELS, confidence.level)) / effort
}

export type Ranked = { feature: WithId<Feature>; confidence: Confidence; score: number | null; suggested?: 'P1' | 'P2' | 'P3' }

// Every feature with its confidence and score, best first; the rated ones split into thirds as P1, P2, P3 (a
// suggestion beside the priority you set, never written).
export function ranked(ws: Chain): Ranked[] {
  const all = ws.features.map((feature) => {
    const confidence = confidenceOf(feature, ws)
    return { feature, confidence, score: scoreOf(feature, confidence) } as Ranked
  })
  const rated = all.filter((r) => r.score !== null).sort((a, b) => b.score! - a.score! || a.feature.createdAt - b.feature.createdAt)
  // Equal scores share a suggestion: by where the first of them stands.
  rated.forEach((r) => {
    const i = rated.findIndex((x) => x.score === r.score)
    r.suggested = i < rated.length / 3 ? 'P1' : i < (2 * rated.length) / 3 ? 'P2' : 'P3'
  })
  return [...rated, ...all.filter((r) => r.score === null)]
}
