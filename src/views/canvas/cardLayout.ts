// Card size in world units, the same for every type (D-055). Positions stored in Firestore are card centres. 4 × 2
// grid steps, so a card snapped to the grid has a `+` mark on every corner (D-148).
export const CARD_W = 2.5
// Type label, a title of up to two lines, tags and one meta line (no notes, D-057).
export const CARD_H = 1.25

// The board renders on demand (D-063), so the first frame after a pause can report a long delta. Glides use at most
// this much per frame, or they'd jump straight to their target instead of moving there.
export const glideDt = (dt: number) => Math.min(dt, 1 / 30)

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

// Nearest spot to `near` where a new card doesn't overlap any existing one (spiral search).
export function findFreeSpot(near: [number, number], cards: { x: number; y: number }[]): [number, number] {
  const gapX = CARD_W + 0.3
  const gapY = CARD_H + 0.3
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
