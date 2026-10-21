// Text and frames written anywhere in the workspace (D-188): headings, paragraphs, sticky notes, sections and the
// project title. Not bound to a component: each sits on the canvas (`pieceId: 'canvas'`) or on a plane (its id), at x/y
// (top-left) in that space's px. The `labels` collection and its fields are the old board's (D-050, D-130, D-156–D-158,
// D-118); its labels have no `pieceId` and aren't shown.
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc, writeBatch, type DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import { snap } from './grid'
import { absent, snapshotWith, tracked } from './history'

// The canvas as a space, beside the planes (whose ids are Firestore's 20-character ones).
export const CANVAS = 'canvas'

export type LabelSize = 'heading' | 'subheading' | 'minor' | 'note'
export type TextScale = 'small' | 'medium' | 'large'
export const LABEL_COLORS = ['ink', 'magenta', 'cyan', 'yellow', 'green', 'blue'] as const
export type LabelColor = (typeof LABEL_COLORS)[number]

export type Label = {
  id: string
  pieceId: string
  text: string
  // heading H1/H2/H3, or `note`: a paragraph. Sticky notes, sections and the title have a `kind` instead.
  size?: LabelSize
  kind?: 'sticky' | 'section' | 'title'
  bold?: boolean
  italic?: boolean
  caps?: boolean
  color?: LabelColor
  scale?: TextScale
  // A heading's small line over it, or the number before a section's name (`02 who we beat`); `''` on a section: none.
  kicker?: string
  // A heading or paragraph turned a quarter: 90 reads upwards, -90 downwards (D-156).
  rotate?: 90 | -90
  // A section's name up its left edge instead of in the top one (D-157).
  side?: 'left'
  // Who wrote a sticky note.
  uid?: string
  author?: string
  x: number
  y: number
  // A paragraph's or sticky note's width, the title block's; a section's size.
  w?: number
  h?: number
  createdAt: number
}

export type TextKind = 'heading' | 'paragraph' | 'sticky' | 'section' | 'title'
export const kindOf = (l: Pick<Label, 'kind' | 'size'>): TextKind =>
  l.kind === 'sticky' || l.kind === 'section' || l.kind === 'title' ? l.kind : l.size === 'note' ? 'paragraph' : 'heading'

// Sizes in space px (the old board's units × 80, a card being 200 wide).
export const HEADING_PX: Record<Exclude<LabelSize, 'note'>, number> = { heading: 48, subheading: 29, minor: 22 }
export const PARA_PX: Record<TextScale, number> = { small: 11, medium: 13, large: 16 }
// A sticky note's text, under a card title's 13 (the old board's 0.085 / 0.105 / 0.13 units).
export const STICKY_PX: Record<TextScale, number> = { small: 6.8, medium: 8.4, large: 10.4 }
export const PARA_W = { initial: 500, min: 120, max: 3200 }
export const STICKY_W = { initial: 200, min: 100, max: 800 }
export const TITLE_W = { initial: 800, min: 500, max: 2400 }
export const SECTION_MIN = { w: 100, h: 75 }
export const KICKER_MAX = 60

// firestore.rules' validLabel: 4000 for a paragraph or a sticky note, 200 for the rest.
export const textMax = (l: Pick<Label, 'kind' | 'size'>) => (l.size === 'note' || l.kind === 'sticky' ? 4000 : 200)

const col = (wid: string) => collection(db(), 'workspaces', wid, 'labels')
export const labelRef = (wid: string, id: string) => doc(col(wid), id)

const NAMES: Record<TextKind, string> = { heading: 'a heading', paragraph: 'a paragraph', sticky: 'a sticky note', section: 'a section', title: 'the project title' }

type New = Omit<Label, 'id' | 'createdAt'>

// A new one, at its place: one undo step.
export async function addLabel(wid: string, fields: New) {
  const ref = doc(col(wid))
  const now = Date.now()
  const data = Object.fromEntries(Object.entries({ ...fields, createdAt: now, updatedAt: now }).filter(([, v]) => v !== undefined))
  await tracked(`add ${NAMES[kindOf(fields)]}`, [ref], () => setDoc(ref, data), { before: absent([ref]) })
  return ref.id
}

// Its text, its setting: typing merges into one undo step; `undefined` takes a field away.
export function updateLabel(wid: string, l: Label, patch: Partial<Omit<Label, 'id' | 'pieceId' | 'createdAt'>>, key?: string) {
  const ref = labelRef(wid, l.id)
  const data = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? deleteField() : v]))
  return tracked(`change ${NAMES[kindOf(l)]}`, [ref], () => updateDoc(ref, { ...data, updatedAt: Date.now() }), key ? { key: `label:${key}:${l.id}` } : {})
}

export function deleteLabel(wid: string, l: Label) {
  const ref = labelRef(wid, l.id)
  return tracked(`delete ${NAMES[kindOf(l)]}`, [ref], () => deleteDoc(ref))
}

// Things moved together (a section and what's in it, D-130): one undo step from where each started.
export type Move = { ref: DocumentReference; from: { x: number; y: number }; to: { x: number; y: number }; extra?: object }
export async function moveMany(label: string, moves: Move[]) {
  if (!moves.length) return
  const before = (await Promise.all(moves.map((m) => snapshotWith(m.ref, { ...m.from })))).flat()
  return tracked(
    label,
    moves.map((m) => m.ref),
    async () => {
      const batch = writeBatch(db())
      const now = Date.now()
      moves.forEach((m) => batch.update(m.ref, { x: m.to.x, y: m.to.y, ...m.extra, updatedAt: now }))
      await batch.commit()
    },
    { before },
  )
}

export const snapPoint = (x: number, y: number, free: boolean): [number, number] => (free ? [Math.round(x), Math.round(y)] : [snap(x), snap(y)])
