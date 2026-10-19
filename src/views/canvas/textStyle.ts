// How text written on the board is set (D-050, D-108, D-130, D-156): its size, H1 (heading, the default) · H2 · H3 ·
// paragraph (`note`), and bold, italic and caps. Shared by text labels and section names, on the board and in the
// field that edits them. A paragraph wraps at its width and reads light Markdown (richText.ts).
import type { CSSProperties } from 'react'
import { MathUtils } from 'three'
import type { Label, LabelSize } from '../../data/model'
import { faceUrl } from '../../three/fonts'
import { fontsLoaded, layout, type Layout, type Setting } from './richText'

export const LABEL_SIZE = 0.6
const SIZES: Record<LabelSize, number> = { heading: LABEL_SIZE, subheading: 0.36, minor: 0.27, note: 0.24 }
export const labelSize = (l: Pick<Label, 'size'>) => SIZES[l.size ?? 'heading']
export const SIZE_NAMES: Record<LabelSize, string> = { heading: 'H1', subheading: 'H2', minor: 'H3', note: '¶' }
export const SIZE_HINTS: Record<LabelSize, string> = { heading: 'Heading', subheading: 'Subheading', minor: 'Minor heading', note: 'Paragraph' }
export const isParagraph = (l: Pick<Label, 'size' | 'kind'>) => l.size === 'note' && !l.kind

type Set = Pick<Label, 'size' | 'bold' | 'italic' | 'caps'>

// The face for the 3D text: Geist, bold and italic as set.
export const labelFace = (l: Set) => faceUrl('display', !!l.bold, !!l.italic)
export const shownText = (l: Pick<Label, 'caps'>, text: string) => (l.caps ? text.toUpperCase() : text)
// Caps read better a little apart; big text a little tighter.
export const labelTracking = (l: Set) => (l.caps ? 0.04 : l.size === 'heading' || !l.size ? -0.03 : -0.02)

// The editing field, set the same way.
export const inputStyle = (l: Set): CSSProperties => ({
  fontWeight: l.bold ? 700 : undefined,
  fontStyle: l.italic ? 'italic' : undefined,
  textTransform: l.caps ? 'uppercase' : undefined,
})

// The small line over a heading or before a section's name (D-156): a leading number stands out in the accent, the
// rest is set small, in mono capitals. `02 who we beat` → `02`, `WHO WE BEAT`.
export function kickerParts(kicker: string | undefined): { num: string; rest: string } | null {
  const k = kicker?.trim()
  if (!k) return null
  const m = /^(\d{1,4})(?:[\s.·:—–-]+(.*))?$/.exec(k)
  return m ? { num: m[1], rest: (m[2] ?? '').toUpperCase() } : { num: '', rest: k.toUpperCase() }
}
// Its size, from the text it sits over.
export const kickerSize = (size: number) => Math.max(0.1, size * 0.3)

// A paragraph (D-156): this wide until its edge is dragged (2.5 cards), within MIN_PARA_W–MAX_PARA_W.
export const PARA_W = 6.25
export const MIN_PARA_W = 1.5
export const MAX_PARA_W = 40
export const PARA_LEADING = 1.55
// A paragraph's text size (D-160): S, M (the default), L.
export const PARA_SIZES = { small: 0.18, medium: 0.24, large: 0.34 } as const
export const paraSize = (l: Pick<Label, 'scale'>) => PARA_SIZES[l.scale ?? 'medium']
export const paraWidth = (l: Pick<Label, 'w'>) => MathUtils.clamp(l.w ?? PARA_W, MIN_PARA_W, MAX_PARA_W)
export const paraSetting = (l: Pick<Label, 'w' | 'size' | 'bold' | 'italic' | 'scale'>): Setting => ({
  face: 'display',
  size: paraSize(l),
  leading: PARA_LEADING,
  width: paraWidth(l),
  bold: l.bold,
  italic: l.italic,
})

// Laid out once per text and width (the board asks often: framing, selecting, the bar's place).
const laid = new Map<string, Layout>()
export function layoutOf(text: string, s: Setting): Layout {
  // Measured again once the real faces are in.
  const key = `${fontsLoaded() ? 1 : 0}|${s.face}|${s.size}|${s.width}|${s.bold ? 1 : 0}${s.italic ? 1 : 0}|${text}`
  let l = laid.get(key)
  if (!l) {
    if (laid.size > 400) laid.clear()
    l = layout(text, s)
    laid.set(key, l)
  }
  return l
}

// A paragraph's box: its set width, or as wide as its text when none is set (an old one-line note stays as it was);
// the height of its lines.
export function paraBox(l: Pick<Label, 'w' | 'size' | 'bold' | 'italic' | 'caps' | 'text' | 'scale'>): [number, number] {
  const s = paraSetting(l)
  const lay = layoutOf(shownText(l, l.text.trim() || 'Text'), s)
  return [l.w === undefined ? lay.width : s.width, lay.height]
}

// Turned a quarter: the box's sides swap.
export const turned = (l: Pick<Label, 'rotate'>) => !!l.rotate
export const turnRad = (l: Pick<Label, 'rotate'>) => ((l.rotate ?? 0) * Math.PI) / 180
