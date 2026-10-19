// A sticky note's layout (D-158): dark paper `w` wide (a card's width and a half until its edge is dragged), a bar
// of its colour along the top, its text in mono (light Markdown, richText.ts), and who wrote it and when at the foot.
// x/y is its centre; it's as tall as its text needs, never shorter than STICKY_MIN_H.
import { MathUtils } from 'three'
import type { Label } from '../../data/model'
import type { Setting } from './richText'
import { layoutOf, shownText } from './textStyle'

export const isSticky = (l: Pick<Label, 'kind'>) => l.kind === 'sticky'

export const STICKY_W = 3.125
export const MIN_STICKY_W = 1.875
export const MAX_STICKY_W = 12
export const STICKY_MIN_H = 1.875
export const STICKY_PAD = 0.2
export const STICKY_BAR = 0.05
export const STICKY_TEXT = 0.15
export const STICKY_FOOT = 0.09
// The default colour: yellow, as a sticky note is.
export const STICKY_COLOR = '#ffd23f'

export const stickyWidth = (l: Pick<Label, 'w'>) => MathUtils.clamp(l.w ?? STICKY_W, MIN_STICKY_W, MAX_STICKY_W)
export const stickySetting = (l: Pick<Label, 'w'>): Setting => ({
  face: 'mono',
  size: STICKY_TEXT,
  leading: 1.55,
  width: stickyWidth(l) - STICKY_PAD * 2,
})

// Its size: [width, height].
export function stickySize(l: Pick<Label, 'w' | 'text' | 'caps'>): [number, number] {
  const w = stickyWidth(l)
  const text = layoutOf(shownText(l, l.text.trim() || 'x'), stickySetting(l))
  // Top: room under the bar for the corner mark; foot: the signature's line.
  const h = STICKY_PAD * 1.6 + text.height + STICKY_PAD + STICKY_FOOT * 2.4
  return [w, Math.max(STICKY_MIN_H, h)]
}

export const stickyHalf = (l: Pick<Label, 'w' | 'text' | 'caps'>): [number, number] => {
  const [w, h] = stickySize(l)
  return [w / 2, h / 2]
}

// How long ago, short: now, 5m, 3h, 2d, 6w, then the date.
export function ago(t: number, now = Date.now()): string {
  const s = Math.max(0, (now - t) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`
  if (s < 86400 * 7 * 8) return `${Math.floor(s / (86400 * 7))}w`
  return new Date(t).toISOString().slice(0, 10)
}
