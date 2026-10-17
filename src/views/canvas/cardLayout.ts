import { colors } from '../../styles/tokens'

// Card sizes in world units, per type: cardShapes.ts. Positions stored in Firestore are card centres.
// The largest card, for spacing new cards apart.
const MAX_W = 3
const MAX_H = 1.5

export const IDEA_COLORS = [
  { name: 'none', value: colors.fg },
  { name: 'magenta', value: colors.magenta },
  { name: 'cyan', value: colors.cyan },
  { name: 'yellow', value: colors.yellow },
  { name: 'blue', value: colors.blue },
  { name: 'green', value: colors.green },
] as const

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

// Nearest spot to `near` where a new card doesn't overlap any existing one (spiral search).
export function findFreeSpot(near: [number, number], cards: { x: number; y: number }[]): [number, number] {
  const gapX = MAX_W + 0.3
  const gapY = MAX_H + 0.3
  const free = (x: number, y: number) => cards.every((c) => Math.abs(c.x - x) >= gapX || Math.abs(c.y - y) >= gapY)
  for (let ring = 0; ring < 12; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue
        const x = near[0] + dx * gapX
        const y = near[1] + dy * gapY
        if (free(x, y)) return [x, y]
      }
    }
  }
  return near
}
