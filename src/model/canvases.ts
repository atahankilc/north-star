// A workspace's canvases (D-302) without Firebase (S3, D-312): their names, the one implied, the list in order. data/canvases.ts
// re-exports it and keeps the writes.
import type { WithId } from '../data/hooks'

export const MAIN = 'main'
export const CANVAS_NAME_MAX = 60
// The first canvas's name until someone gives it one.
export const MAIN_NAME = 'Main'

export type Canvas = { id: string; name: string; order: number; createdAt: number; createdBy?: string }

// Which canvas a piece or the canvas's text is on.
export const canvasOf = (x: { canvasId?: string }) => x.canvasId || MAIN
export type Spot = { id: string; canvasId: string; pieceId: string; x: number; y: number; createdAt: number }

// The canvases in order, `main` first even without its doc.
export function canvasList(docs: WithId<Omit<Canvas, 'id'>>[]): Canvas[] {
  const list = docs.filter((c) => typeof c.name === 'string').slice()
  if (!list.some((c) => c.id === MAIN)) list.push({ id: MAIN, name: MAIN_NAME, order: 0, createdAt: 0 })
  return list.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
}
