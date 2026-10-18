// Matrix → TSV (D-080): one row per feature, a coverage and a notes column per competitor, then the row's reading and
// the criteria nobody meets (D-133). A scored cell says how many criteria it meets: `partial (2/5 met)`.
// Tabs, not commas: Excel splits a .csv on the region's list separator (`;` in Turkish or German, `,` in English), but reads tabs
// the same everywhere. A tab or line break inside a cell becomes a space, so nothing needs quoting.
// UTF-8 with a BOM and CRLF line ends, so Excel shows ş, ğ and friends right.
import type { WithId } from '../data/hooks'
import type { Comparison, Competitor, Feature } from '../data/model'
import { coverageOf, matrixCols, matrixRows, openCriteria, scoresOf, verdict } from '../views/matrix/reading'

const cell = (v: string) => v.replace(/[\t\r\n]+/g, ' ').trim()

function coverageText(m: Comparison | undefined, f: Feature) {
  const read = coverageOf(m, f) ?? ''
  const scores = scoresOf(m, f)
  return scores ? `${read} (${scores.filter((s) => s === 'met').length}/${scores.length} met)` : read
}

export function matrixTsv(features: WithId<Feature>[], competitors: WithId<Competitor>[], comparisons: WithId<Comparison>[]): string {
  const rows = matrixRows(features)
  const cols = matrixCols(competitors)
  const cells = new Map(comparisons.map((c) => [c.id, c]))
  const head = ['feature', 'priority', 'status', 'effort', ...cols.flatMap((c) => [c.name || 'untitled', `${c.name || 'untitled'} notes`]), 'reading', 'nobody meets']
  const body = rows.map((f) => {
    const mine = cols.map((c) => cells.get(`${f.id}_${c.id}`))
    return [
      f.title,
      f.priority ?? '',
      f.status ?? '',
      f.effort ?? '',
      ...mine.flatMap((m) => [coverageText(m, f), m?.notes ?? '']),
      verdict(mine, f)?.label ?? '',
      (openCriteria(f, mine) ?? []).map((k) => k.text).join('; '),
    ]
  })
  return '﻿' + [head, ...body].map((r) => r.map(cell).join('\t')).join('\r\n') + '\r\n'
}
