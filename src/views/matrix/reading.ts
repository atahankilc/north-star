// How the matrix orders its rows and columns and reads each row; shared by the view and the CSV export (D-080).
import type { WithId } from '../../data/hooks'
import { FEATURE_PRIORITIES, type Comparison, type Competitor, type Feature } from '../../data/model'

export type Verdict = { label: string; tone: string; title: string }

// Gap: nobody covers it (an opening). Table stakes: most competitors fully cover it.
export function verdict(cells: (Comparison | undefined)[]): Verdict | null {
  const assessed = cells.filter((c) => c?.coverage)
  if (cells.length === 0 || assessed.length === 0) return null
  const covered = assessed.filter((c) => c!.coverage === 'full' || c!.coverage === 'better').length
  const some = assessed.filter((c) => c!.coverage !== 'none').length
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
