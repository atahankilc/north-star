// Text on the board (D-050): headings like "COMPETITORS" over an area, and the places the jump list flies to.
// Undoable (history.ts) except the live position stream during a drag.
import { collection, deleteDoc, deleteField, doc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { absent, snapshotWith, tracked } from './history'
import type { Label } from './model'
import { ALL, openPlane } from './planes'

const labelsOf = (wid: string) => collection(db(), 'workspaces', wid, 'labels')

// On the open plane (D-139): text and sections belong to one plane.
export async function createLabel(wid: string, fields: Omit<Label, 'createdAt' | 'updatedAt'>) {
  const now = Date.now()
  const ref = doc(labelsOf(wid))
  const plane = openPlane() === ALL ? {} : { planeId: openPlane() }
  await tracked('new text', [ref], () => setDoc(ref, { ...fields, ...plane, createdAt: now, updatedAt: now }), {
    before: absent([ref]),
    key: `label:${ref.id}:text`,
  })
  return ref.id
}

// `undefined` clears a field. `first`: the text a new label is given, which undoes together with creating it.
export type LabelEdit = Partial<Pick<Label, 'text' | 'color' | 'size' | 'bold' | 'italic' | 'caps' | 'rotate' | 'kicker' | 'side' | 'w' | 'x' | 'y'>>
export function updateLabel(wid: string, id: string, fields: LabelEdit, first = false) {
  const data: Record<string, unknown> = { updatedAt: Date.now() }
  for (const [k, v] of Object.entries(fields)) data[k] = v === undefined ? deleteField() : v
  const ref = doc(labelsOf(wid), id)
  return tracked('edit text', [ref], () => updateDoc(ref, data), {
    key: `label:${id}:${Object.keys(fields).sort().join(',')}`,
    mergeAlways: first,
  })
}

export function deleteLabel(wid: string, id: string) {
  const ref = doc(labelsOf(wid), id)
  return tracked('delete text', [ref], () => deleteDoc(ref))
}

// The live stream while dragging: not undoable on its own, see endLabelMove.
export function moveLabel(wid: string, id: string, x: number, y: number) {
  return updateDoc(doc(labelsOf(wid), id), { x, y })
}

export async function endLabelMove(wid: string, id: string, from: [number, number], to: [number, number]) {
  const ref = doc(labelsOf(wid), id)
  const before = await snapshotWith(ref, { x: from[0], y: from[1] })
  return tracked('move text', [ref], () => updateDoc(ref, { x: to[0], y: to[1] }), { before })
}

// A section's frame (D-130) while its corner is dragged: its centre and size together, streamed like a move.
export type SectionRect = { x: number; y: number; w: number; h: number }
export function resizeSection(wid: string, id: string, r: SectionRect) {
  return updateDoc(doc(labelsOf(wid), id), r)
}

export async function endSectionResize(wid: string, id: string, from: SectionRect, to: SectionRect) {
  const ref = doc(labelsOf(wid), id)
  const before = await snapshotWith(ref, from)
  return tracked('resize section', [ref], () => updateDoc(ref, { ...to, updatedAt: Date.now() }), { before })
}

// The project title block's width (D-132) while its edge is dragged, its left edge staying put: centre and width
// together, streamed like a move. Its height follows its text.
export type TitleSpan = { x: number; w: number }
export function resizeTitle(wid: string, id: string, s: TitleSpan) {
  return updateDoc(doc(labelsOf(wid), id), s)
}

export async function endTitleResize(wid: string, id: string, from: TitleSpan, to: TitleSpan) {
  const ref = doc(labelsOf(wid), id)
  const before = await snapshotWith(ref, from)
  return tracked('resize project title', [ref], () => updateDoc(ref, { ...to, updatedAt: Date.now() }), { before })
}

// A paragraph's or sticky note's width (D-156, D-158) while its edge is dragged, its other edge staying put: centre
// and width together (a turned one's centre moves up or down), streamed like a move.
export type TextSpan = { x: number; y: number; w: number }
export function resizeText(wid: string, id: string, s: TextSpan) {
  return updateDoc(doc(labelsOf(wid), id), s)
}

export async function endTextResize(wid: string, id: string, from: TextSpan, to: TextSpan) {
  const ref = doc(labelsOf(wid), id)
  const before = await snapshotWith(ref, from)
  return tracked('resize text', [ref], () => updateDoc(ref, { ...to, updatedAt: Date.now() }), { before })
}
