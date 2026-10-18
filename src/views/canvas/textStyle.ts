// How text written on the board is set (D-050, D-108, D-130): its size, H1 (heading, the default) · H2 · H3 · note, and
// bold, italic and caps. Shared by text labels and section names, on the board and in the field that edits them.
import type { CSSProperties } from 'react'
import type { Label, LabelSize } from '../../data/model'
import { faceUrl } from '../../three/fonts'

export const LABEL_SIZE = 0.6
// Notes are mono, like an annotation.
const SIZES: Record<LabelSize, number> = { heading: LABEL_SIZE, subheading: 0.36, minor: 0.27, note: 0.2 }
export const labelSize = (l: Pick<Label, 'size'>) => SIZES[l.size ?? 'heading']
export const SIZE_NAMES: Record<LabelSize, string> = { heading: 'H1', subheading: 'H2', minor: 'H3', note: 'note' }

type Set = Pick<Label, 'size' | 'bold' | 'italic' | 'caps'>

// The face for the 3D text: Geist (mono for notes), bold and italic as set.
export const labelFace = (l: Set) => faceUrl(l.size === 'note' ? 'mono' : 'display', !!l.bold, !!l.italic)
export const shownText = (l: Pick<Label, 'caps'>, text: string) => (l.caps ? text.toUpperCase() : text)
// Caps read better a little apart.
export const labelTracking = (l: Set) => (l.size === 'note' ? 0 : l.caps ? 0.04 : -0.02)

// The editing field, set the same way.
export const inputStyle = (l: Set): CSSProperties => ({
  fontWeight: l.bold ? 700 : undefined,
  fontStyle: l.italic ? 'italic' : undefined,
  textTransform: l.caps ? 'uppercase' : undefined,
})
