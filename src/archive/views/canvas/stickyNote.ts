// A sticky note's layout (D-158, D-162): quieter than a card. Paper a shade darker than a card's, `w` wide (a card's
// width until its edge is dragged), a thin bar of its colour along the top, a small header line (who wrote it and when,
// left; three little checks, right), then its text in mono (light Markdown, richText.ts) at S, M (the default) or L,
// all under a card title's size. x/y is its centre; it's exactly as tall as its text needs.
import { MathUtils } from 'three'
import type { Label } from '../../data/model'
import type { Setting } from './richText'
import { layoutOf, shownText } from './textStyle'

export const isSticky = (l: Pick<Label, 'kind'>) => l.kind === 'sticky'

export const STICKY_W = 2.5
export const MIN_STICKY_W = 1.25
export const MAX_STICKY_W = 10
export const STICKY_PAD = 0.09
export const STICKY_BAR = 0.025
// The header line: who wrote it and when.
export const STICKY_HEAD = 0.065
const HEAD_ROOM = STICKY_HEAD * 1.9
// Its text sizes (a card's title is 0.165); medium is the default and isn't stored.
export const STICKY_SIZES = { small: 0.085, medium: 0.105, large: 0.13 } as const
export const stickyText = (l: Pick<Label, 'scale'>) => STICKY_SIZES[l.scale ?? 'medium']
// The default colour: yellow, as a sticky note is.
export const STICKY_COLOR = '#ffd23f'

export const stickyWidth = (l: Pick<Label, 'w'>) => MathUtils.clamp(l.w ?? STICKY_W, MIN_STICKY_W, MAX_STICKY_W)
export const stickySetting = (l: Pick<Label, 'w' | 'scale'>): Setting => ({
  face: 'mono',
  size: stickyText(l),
  leading: 1.45,
  width: stickyWidth(l) - STICKY_PAD * 2,
})

// Where its text starts, down from its top edge: under the bar and the header line.
export const STICKY_TEXT_TOP = STICKY_BAR + STICKY_PAD * 0.8 + HEAD_ROOM

// Its size: [width, height].
export function stickySize(l: Pick<Label, 'w' | 'text' | 'caps' | 'scale'>): [number, number] {
  const text = layoutOf(shownText(l, l.text.trim() || 'x'), stickySetting(l))
  return [stickyWidth(l), STICKY_TEXT_TOP + text.height + STICKY_PAD]
}

export const stickyHalf = (l: Pick<Label, 'w' | 'text' | 'caps' | 'scale'>): [number, number] => {
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
