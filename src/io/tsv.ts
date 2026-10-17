// Matrix → TSV (D-080): one row per feature, a coverage and a notes column per competitor, then the row's reading.
// Tabs, not commas: Excel splits a .csv on the region's list separator (`;` in Turkish or German, `,` in English), but reads tabs
// the same everywhere. A tab or line break inside a cell becomes a space, so nothing needs quoting.
// UTF-8 with a BOM and CRLF line ends, so Excel shows ş, ğ and friends right.
import type { WithId } from '../data/hooks'
import type { Comparison, Competitor, Feature } from '../data/model'
import { matrixCols, matrixRows, verdict } from '../views/matrix/reading'

const cell = (v: string) => v.replace(/[\t\r\n]+/g, ' ').trim()

export function matrixTsv(features: WithId<Feature>[], competitors: WithId<Competitor>[], comparisons: WithId<Comparison>[]): string {
  const rows = matrixRows(features)
  const cols = matrixCols(competitors)
  const cells = new Map(comparisons.map((c) => [c.id, c]))
  const head = ['feature', 'priority', 'status', 'effort', ...cols.flatMap((c) => [c.name || 'untitled', `${c.name || 'untitled'} notes`]), 'reading']
  const body = rows.map((f) => {
    const mine = cols.map((c) => cells.get(`${f.id}_${c.id}`))
    return [
      f.title,
      f.priority ?? '',
      f.status ?? '',
      f.effort ?? '',
      ...mine.flatMap((m) => [m?.coverage ?? '', m?.notes ?? '']),
      verdict(mine)?.label ?? '',
    ]
  })
  return '﻿' + [head, ...body].map((r) => r.map(cell).join('\t')).join('\r\n') + '\r\n'
}
