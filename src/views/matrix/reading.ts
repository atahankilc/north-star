// How the matrix orders its rows and columns and reads each row; shared by the view and the CSV export (D-080).
import type { WithId } from '../../data/hooks'
import {
  FEATURE_PRIORITIES,
  type Comparison,
  type Competitor,
  type Coverage,
  type Criterion,
  type CriterionScore,
  type Feature,
} from '../../data/model'

export type Verdict = { label: string; tone: string; title: string }

// The feature's criteria scored in one cell (D-133), in the feature's order; null when none is scored yet.
export function scoresOf(cell: Comparison | undefined, feature: Feature): (CriterionScore | undefined)[] | null {
  const list = feature.criteria ?? []
  const scores = list.map((c) => cell?.criteria?.[c.id])
  return scores.some(Boolean) ? scores : null
}

// What a cell reads: from its scores once any is scored (all met = full, none met or part = none), else as set by hand.
// `better` set by hand stays when every criterion is met.
export function coverageOf(cell: Comparison | undefined, feature: Feature): Coverage | undefined {
  const scores = scoresOf(cell, feature)
  if (!scores) return cell?.coverage
  const scored = scores.filter(Boolean)
  if (scored.every((s) => s === 'no')) return 'none'
  if (scores.every((s) => s === 'met')) return cell?.coverage === 'better' ? 'better' : 'full'
  return 'partial'
}

// A competitor that isn't comparable on the feature at all (D-136): left out of readings, counts and the white space.
export const relevant = (cell: Comparison | undefined) => !cell?.notRelevant

// White space (D-133): the criteria no assessed competitor meets, once at least one cell is scored. Our differentiation.
export function openCriteria(feature: Feature, cells: (Comparison | undefined)[]): Criterion[] | null {
  const scored = cells.filter((c) => relevant(c) && scoresOf(c, feature))
  if (!scored.length) return null
  return (feature.criteria ?? []).filter((k) => !scored.some((c) => c!.criteria?.[k.id] === 'met'))
}

// Gap: nobody covers it (an opening). Table stakes: most competitors fully cover it.
export function verdict(all: (Comparison | undefined)[], feature: Feature): Verdict | null {
  const cells = all.filter(relevant)
  const read = cells.map((c) => coverageOf(c, feature))
  const assessed = read.filter(Boolean)
  if (cells.length === 0 || assessed.length === 0) return null
  const covered = assessed.filter((c) => c === 'full' || c === 'better').length
  const some = assessed.filter((c) => c !== 'none').length
  if (some === 0) return { label: 'gap', tone: 'var(--accent-green)', title: 'No competitor covers this: an opening' }
  if (covered * 2 >= cells.length)
    return { label: 'table stakes', tone: 'var(--accent-yellow)', title: 'Most competitors cover this fully' }
  return { label: 'mixed', tone: 'var(--fg-dim)', title: 'Some competitors cover this' }
}

const rank = (f: Feature) => {
  const p = FEATURE_PRIORITIES.indexOf(f.priority as (typeof FEATURE_PRIORITIES)[number])
  return p < 0 ? FEATURE_PRIORITIES.length : p
}

// Rows: by priority, then oldest first. Columns: oldest competitor first.
export const matrixRows = (features: WithId<Feature>[]) => [...features].sort((a, b) => rank(a) - rank(b) || a.createdAt - b.createdAt)
export const matrixCols = (competitors: WithId<Competitor>[]) => [...competitors].sort((a, b) => a.createdAt - b.createdAt)

// For the assistant (D-133): a feature's criteria, and one cell's scores against them, in a line of text.
export const criteriaLine = (feature: Feature | undefined) =>
  feature?.criteria?.length ? `criteria: ${feature.criteria.map((k, i) => `${i + 1}. ${k.text}`).join(' | ')}` : ''

// A cell for the assistant (D-136): left out, or what it reads, its criteria scores and how sure it is.
export function cellLine(cell: Comparison, feature: Feature | undefined) {
  if (!relevant(cell)) return 'not relevant (they don\'t do this kind of thing)'
  const scores = scoresLine(cell, feature)
  return `${(feature && coverageOf(cell, feature)) ?? cell.coverage ?? 'not assessed'}${scores ? ` (${scores})` : ''}${cell.confidence ? `, ${cell.confidence}` : ''}`
}

export function scoresLine(cell: Comparison, feature: Feature | undefined) {
  const scores = feature && scoresOf(cell, feature)
  if (!feature || !scores) return ''
  return `criteria ${scores.map((s, i) => `${i + 1} ${s ?? 'not assessed'}`).join(', ')}`
}
