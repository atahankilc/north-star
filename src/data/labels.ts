// Text and frames written anywhere in the workspace (D-188): headings, paragraphs, sticky notes, sections and the
// project title. Not bound to a component: each sits on the canvas (`pieceId: 'canvas'`) or on a plane (its id), at x/y
// (top-left) in that space's px (D-050, D-118, D-130, D-156–D-158).
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc, writeBatch, type DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import { snap } from '../model/grid'
import { absent, discardNew, snapshotWith, tracked } from './history'
import { canvasField } from './canvases'

// What text is lives in src/model/labels.ts, without Firebase (S3).
export { CANVAS, LABEL_COLORS, kindOf, HEADING_PX, PARA_PX, STICKY_PX, PARA_W, STICKY_W, STICKY_H, TITLE_W, SECTION_MIN, KICKER_MAX, textMax } from '../model/labels'
export type { LabelSize, TextScale, LabelColor, Label, TextKind } from '../model/labels'
import { CANVAS, kindOf, type Label, type TextKind } from '../model/labels'

const col = (wid: string) => collection(db(), 'workspaces', wid, 'labels')
export const labelRef = (wid: string, id: string) => doc(col(wid), id)

const NAMES: Record<TextKind, string> = { heading: 'a heading', paragraph: 'a paragraph', sticky: 'a sticky note', section: 'a section', title: 'the project title' }

type New = Omit<Label, 'id' | 'createdAt'>

// A new one, at its place: one undo step, which the text typed into it first joins (keyed as its text is, D-250).
export async function addLabel(wid: string, fields: New) {
  const ref = doc(col(wid))
  const now = Date.now()
  // On the canvas: the one shown (D-302).
  const data = Object.fromEntries(Object.entries({ ...fields, ...(fields.pieceId === CANVAS ? canvasField() : {}), createdAt: now, updatedAt: now }).filter(([, v]) => v !== undefined))
  await tracked(`add ${NAMES[kindOf(fields)]}`, [ref], () => setDoc(ref, data), { before: absent([ref]), key: `label:text:${ref.id}` })
  return ref.id
}

// Its text, its setting: typing merges into one undo step; `undefined` takes a field away. `fresh`: the first text of
// one just made, one step with its making.
export function updateLabel(wid: string, l: Label, patch: Partial<Omit<Label, 'id' | 'pieceId' | 'createdAt'>>, key?: string, fresh = false) {
  const ref = labelRef(wid, l.id)
  const data = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? deleteField() : v]))
  return tracked(`change ${NAMES[kindOf(l)]}`, [ref], () => updateDoc(ref, { ...data, updatedAt: Date.now() }), key ? { key: `label:${key}:${l.id}`, mergeAlways: fresh } : {})
}

// One just made, let go before it had any text: gone, with its step (D-250).
export const discardLabel = (wid: string, l: Pick<Label, 'id'>) => discardNew(labelRef(wid, l.id), `label:text:${l.id}`)

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
      // A card's place on another plane (D-281) and a piece's spot on another canvas (D-307) have no `updatedAt`.
      moves.forEach((m) => batch.update(m.ref, { x: m.to.x, y: m.to.y, ...m.extra, ...(m.ref.parent.id === 'places' || m.ref.parent.id === 'pieceSpots' ? {} : { updatedAt: now }) }))
      await batch.commit()
    },
    { before },
  )
}

export const snapPoint = (x: number, y: number, free: boolean): [number, number] => (free ? [Math.round(x), Math.round(y)] : [snap(x), snap(y)])
