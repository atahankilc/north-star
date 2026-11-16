// A table read two ways gives one answer (D-388): the app's view and the agent's reading both stand on
// src/model/table.ts (fieldText, sortedRows). The agent once sorted and worded a table by its own copy, so it saw the
// rows in another order than the person. Here every table of the fixtures is sorted by each of its columns, both ways,
// and the agent's rows must come in the order the model gives.
import { describe, expect, it } from 'vitest'
import { bigWs, mediumWs, smallWs } from './fixtures/workspaces'
import { makeIds, type ReadWs } from '../../src/agent/read'
import { tableValues } from '../../src/agent/read/view'
import { derive } from '../../src/agent/read/derive'
import { kindOfPiece } from '../../src/model/pieces'
import { tableRows } from '../../src/model/lens'
import { cellsByKey, fieldText, NAME_COL, sortedRows, sortKey, type Column, type FieldCtx, type TableSetup } from '../../src/model/table'
import type { Card } from '../../src/model/cards'
import type { Row } from '../../src/model/source'

const card = (over: Partial<Card>): Card => ({ id: 'c1', type: 'competitor', title: 'Wolt', pieceId: 'p1', x: 0, y: 0, ...over }) as Card
const ctx: FieldCtx = { planes: () => ['Market', '', 'Rivals'], proof: () => ({ supports: 2, contradicts: 0 }) }

describe('a field as its column shows it', () => {
  it('evidence leaves out a side with none', () => {
    expect(fieldText(ctx, card({}), 'evidence')).toBe('+2')
    expect(fieldText({ ...ctx, proof: () => ({ supports: 1, contradicts: 3 }) }, card({}), 'evidence')).toBe('+1 −3')
    expect(fieldText({ ...ctx, proof: () => undefined }, card({}), 'evidence')).toBe('')
  })
  it('regions, tags and planes', () => {
    expect(fieldText(ctx, card({ regions: ['US', 'Germany'] }), 'regions')).toBe('US · Germany')
    expect(fieldText(ctx, card({ tags: ['a', 'b'] }), 'tags')).toBe('#a #b')
    expect(fieldText(ctx, card({}), 'plane')).toBe('Market, Rivals')
    expect(fieldText(ctx, undefined, 'type')).toBe('')
  })
})

describe('sorted rows', () => {
  const rows: Row[] = ['b', '', 'a'].map((name, i) => ({ key: `r${i}`, name, auto: false }))
  const setup = (sort: TableSetup['sort']): TableSetup => ({ rows: { rules: [], items: [] }, cols: [], sort })
  it('keeps the source order without a sort', () => expect(sortedRows(setup(undefined), rows, () => '', new Map())).toBe(rows))
  it('puts empty ones last, whichever way', () => {
    expect(sortedRows(setup({ col: NAME_COL }), rows, () => '', new Map()).map((r) => r.name)).toEqual(['a', 'b', ''])
    expect(sortedRows(setup({ col: NAME_COL, desc: true }), rows, () => '', new Map()).map((r) => r.name)).toEqual(['b', 'a', ''])
  })
})

describe("the agent reads a table in the person's order", () => {
  const FIXTURES: [string, () => ReadWs][] = [['small', smallWs], ['medium', mediumWs], ['big', bigWs]]
  for (const [name, make] of FIXTURES) {
    it(name, () => {
      const ws = make()
      const ids = makeIds()
      const d = derive(ws)
      // The plain context the app builds in Table.tsx' useFieldText: every plane's whole name, the evidence counted.
      const plain: FieldCtx = { planes: (c) => (d.planesOf.get(c.id) ?? []).map((p) => d.nameById(p)), proof: (c) => d.facts.get(c.id)?.proof }
      const text = (r: Row, f: NonNullable<Column['field']>) => fieldText(plain, r.card, f)
      let seen = 0
      for (const p of ws.pieces.filter((x) => kindOfPiece(x) === 'table' && x.table)) {
        const t = p.table as TableSetup
        const byKey = cellsByKey(ws.cells, p.id)
        for (const col of [NAME_COL, ...t.cols.map((c) => c.id)])
          for (const desc of [false, true]) {
            const sorted = { ...t, sort: { col, desc } }
            const want = sortedRows(sorted, tableRows(sorted, ws.cards), text, byKey).map((r) => r.key)
            const got = tableValues(ws, ids, { ...p, table: sorted }).rows.map((r) => r.row.key)
            expect(got, `${p.name} by ${col}${desc ? ' desc' : ''}`).toEqual(want)
            seen++
          }
        // A sort key is never undefined (a column of any kind).
        for (const c of t.cols) for (const r of tableRows(t, ws.cards)) expect(sortKey(c, r, text, byKey)).toBeDefined()
      }
      if (name !== 'small') expect(seen).toBeGreaterThan(0)
    })
  }
})
