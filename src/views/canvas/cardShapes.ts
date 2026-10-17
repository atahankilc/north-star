// One silhouette per card type (D-051), so a card's type reads at a glance, even zoomed out:
// customer = pill, problem = dog-eared corner, competitor = wide with a double rim, idea = post-it, feature = tag.
import { ExtrudeGeometry, Shape, ShapeGeometry } from 'three'
import type { BoardType } from '../../data/model'

export const CARD_SIZE: Record<BoardType, [number, number]> = {
  customer: [2.6, 1.1],
  problem: [2.4, 1.5],
  competitor: [3, 1.5],
  idea: [2.4, 1.5],
  feature: [2.6, 1.1],
}

// Left edge of the text, from the card's left side: rounder and pointier shapes need more room.
export const TEXT_INSET: Record<BoardType, number> = { customer: 0.42, problem: 0.18, competitor: 0.2, idea: 0.18, feature: 0.36 }

export const DOG_EAR = 0.36
const TAG_POINT = 0.28
const DEPTH = 0.06

function polygon(points: [number, number][]) {
  const s = new Shape()
  points.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)))
  s.closePath()
  return s
}

function rounded(w: number, h: number, r: number) {
  const s = new Shape()
  s.moveTo(-w / 2 + r, -h / 2)
  s.lineTo(w / 2 - r, -h / 2)
  s.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false)
  s.lineTo(w / 2, h / 2 - r)
  s.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false)
  s.lineTo(-w / 2 + r, h / 2)
  s.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-w / 2, -h / 2 + r)
  s.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

// `grow` pads the outline evenly, for rims.
export function cardShape(type: BoardType, grow = 0): Shape {
  const [w0, h0] = CARD_SIZE[type]
  const w = w0 + grow * 2
  const h = h0 + grow * 2
  switch (type) {
    case 'customer':
      return rounded(w, h, h / 2)
    case 'problem': {
      const c = DOG_EAR + grow * 0.4
      return polygon([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2 - c], [w / 2 - c, h / 2], [-w / 2, h / 2]])
    }
    case 'feature': {
      const p = TAG_POINT + grow * 0.4
      return polygon([[-w / 2 + p, -h / 2], [w / 2 - p, -h / 2], [w / 2, 0], [w / 2 - p, h / 2], [-w / 2 + p, h / 2], [-w / 2, 0]])
    }
    case 'idea':
      return rounded(w, h, 0.04 + grow)
    case 'competitor':
      return rounded(w, h, 0.01 + grow)
  }
}

// Geometries are shared by every card of a type.
const slabs = new Map<BoardType, ExtrudeGeometry>()
const outlines = new Map<string, ShapeGeometry>()

export function slabGeometry(type: BoardType) {
  let g = slabs.get(type)
  if (!g) {
    g = new ExtrudeGeometry(cardShape(type), { depth: DEPTH, bevelEnabled: false, curveSegments: 16 })
    g.translate(0, 0, -DEPTH / 2)
    slabs.set(type, g)
  }
  return g
}

export function outlineGeometry(type: BoardType, grow: number) {
  const key = `${type}:${grow}`
  let g = outlines.get(key)
  if (!g) {
    g = new ShapeGeometry(cardShape(type, grow), 16)
    outlines.set(key, g)
  }
  return g
}
