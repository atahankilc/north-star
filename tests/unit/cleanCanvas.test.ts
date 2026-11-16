// A canvas and a piece's spot are cleaned one way (D-394): an import's file and an op's write through the same cleaners.
import { describe, expect, it } from 'vitest'
import { cleanCanvas, cleanSpot } from '../../src/model/clean'
import { CANVAS_NAME_MAX } from '../../src/model/limits'
import { validate } from '../../src/ops/validate'
import type { Plan } from '../../src/ops/types'
import { ALICE, textWs } from './fixtures/ws'

const plan = (coll: string, id: string, set: Record<string, unknown>) => [{ op: 'test', label: 'test', writes: [{ coll, id, set }], ids: {} }] as unknown as Plan[]
const said = (plans: Plan[]) => JSON.stringify(validate(plans, textWs(), ALICE))

describe('cleanCanvas, cleanSpot', () => {
  it('a canvas keeps its name (trimmed, cut), its order and when it was made; no name, no canvas', () => {
    expect(cleanCanvas({ name: '  Build ', order: 2, createdAt: 5, createdBy: 'u', extra: 1 }, 9)).toEqual({ name: 'Build', order: 2, createdAt: 5 })
    expect(cleanCanvas({ name: 'x'.repeat(200), order: 1 }, 9)?.name).toHaveLength(CANVAS_NAME_MAX)
    expect(cleanCanvas({ name: '   ', order: 1 }, 9)).toBeNull()
    expect(cleanCanvas({ order: 1 }, 9)).toBeNull()
  })
  it('a canvas that lost its order goes first', () => {
    expect(cleanCanvas({ name: 'Build' }, 9)).toEqual({ name: 'Build', order: 0, createdAt: 9 })
    expect(cleanCanvas({ name: 'Build', order: NaN }, 9)?.order).toBe(0)
  })
  it('a spot needs both its numbers', () => {
    expect(cleanSpot({ canvasId: 'c', pieceId: 'p', x: 1, y: 2 }, 9)).toEqual({ x: 1, y: 2, createdAt: 9 })
    expect(cleanSpot({ x: 1 }, 9)).toBeNull()
    expect(cleanSpot({ x: 1, y: Infinity }, 9)).toBeNull()
  })
})

describe('validate: an op writing a canvas or a spot', () => {
  it('a canvas as the app writes it passes', () => {
    expect(validate(plan('canvases', 'c9', { name: 'Build', order: 3, createdAt: 1, createdBy: ALICE.uid }), textWs(), ALICE)).toEqual({ ok: true })
  })
  it('no order, a name too long, a field it cannot have: each is said', () => {
    expect(said(plan('canvases', 'c9', { name: 'Build', createdAt: 1 }))).toContain('a canvas needs an order')
    expect(said(plan('canvases', 'c9', { name: 'x'.repeat(200), order: 1, createdAt: 1 }))).toContain('name is too long')
    expect(said(plan('canvases', 'c9', { name: 'Build', order: 1, createdAt: 1, colour: 'red' }))).toContain("colour isn't a field")
    expect(said(plan('canvases', 'c9', { order: 1, createdAt: 1 }))).toContain("isn't a valid canvas")
  })
  it('a spot without a number is refused', () => {
    expect(said(plan('pieceSpots', 'a_b', { canvasId: 'a', pieceId: 'b', x: 'left', y: 0, createdAt: 1 }))).toContain("isn't a valid spot")
  })
})
