// One rule for every dragged handle (D-376): the sides it names move, the others stay, and the size holds.
import { describe, expect, it } from 'vitest'
import { resizedBox } from '../../src/model/resizeBox'

const from = { x: 100, y: 100, w: 200, h: 100 }
const min = { w: 100, h: 75 }
const free = (v: number) => v

describe('resizedBox', () => {
  it('the right and bottom edges move alone', () => {
    expect(resizedBox(from, 'e', 50, 30, free, min)).toEqual({ x: 100, y: 100, w: 250, h: 100 })
    expect(resizedBox(from, 's', 50, 30, free, min)).toEqual({ x: 100, y: 100, w: 200, h: 130 })
  })
  it('the left and top edges move, the opposite ones stay', () => {
    expect(resizedBox(from, 'w', -50, 0, free, min)).toEqual({ x: 50, y: 100, w: 250, h: 100 })
    expect(resizedBox(from, 'n', 0, -40, free, min)).toEqual({ x: 100, y: 60, w: 200, h: 140 })
  })
  it('a corner moves its two edges', () => {
    expect(resizedBox(from, 'nw', -10, -20, free, min)).toEqual({ x: 90, y: 80, w: 210, h: 120 })
    expect(resizedBox(from, 'se', 10, 20, free, min)).toEqual({ x: 100, y: 100, w: 210, h: 120 })
  })
  it('stops at the smallest size against the side that stays', () => {
    expect(resizedBox(from, 'w', 500, 0, free, min)).toEqual({ x: 200, y: 100, w: 100, h: 100 })
    expect(resizedBox(from, 'n', 0, 500, free, min)).toEqual({ x: 100, y: 125, w: 200, h: 75 })
  })
  it('stops at the largest size the same way', () => {
    const max = { w: 300, h: 150 }
    expect(resizedBox(from, 'w', -500, 0, free, min, max)).toEqual({ x: 0, y: 100, w: 300, h: 100 })
    expect(resizedBox(from, 'e', 500, 0, free, min, max).w).toBe(300)
  })
  it('lands the moved edge, not the size, on the grid', () => {
    const snap = (v: number) => Math.round(v / 25) * 25
    expect(resizedBox({ ...from, x: 110 }, 'w', -30, 0, snap, min)).toEqual({ x: 75, y: 100, w: 235, h: 100 })
  })
})
