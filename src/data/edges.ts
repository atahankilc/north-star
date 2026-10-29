// Links between cards (D-059, D-207): the old `edges` collection, as before. A link has no plane of its own: a plane
// draws the links whose two cards are both on it. Every write is one undo step (history.ts).
import { collection, doc, type DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import type { AnyType } from '../model/cards'
import { applyUi, runUi, sayRefused, uiCtx } from '../ops/firestore'
import { link, unlink, updateLink } from '../ops/edges'

// What a link is lives in src/model/edges.ts, without Firebase (S3).
export { FOR, defaultKind, linked, edgesOn } from '../model/edges'
export type { EdgeKind, Edge } from '../model/edges'
import { FOR, type Edge, type EdgeKind } from '../model/edges'

const edgesOf = (wid: string) => collection(db(), 'workspaces', wid, 'edges')
export const edgeRef = (wid: string, id: string): DocumentReference => doc(edgesOf(wid), id)

// Every write is an op (S4, D-312: src/ops/edges.ts) applied as one undo step, with the labels and promises of before.

// Returns the new link's id at once (the write goes on behind), so it can be selected straight away (D-154).
export function createEdge(wid: string, from: { id: string; type: AnyType }, to: { id: string; type: AnyType }, kind: EdgeKind): string {
  return createEdgeOp(wid, from, to, kind).id
}

// As createEdge, with the write to wait for (R4): `applied` resolves once it's recorded and issued locally.
export function createEdgeOp(wid: string, from: { id: string; type: AnyType }, to: { id: string; type: AnyType }, kind: EdgeKind) {
  // Nothing made (no workspace shown, or refused): id '' (callers select it, which selects nothing).
  const none = { id: '', applied: Promise.resolve(null) }
  const ctx = uiCtx(wid)
  if (!ctx) return none
  try {
    const plan = link(ctx, { from: from.id, to: to.id, kind })
    return { id: plan.ids.$new, applied: applyUi(wid, ctx, [plan]) }
  } catch (e) {
    sayRefused(e, kind === FOR ? 'tag' : 'link')
    return none
  }
}

// `undefined` clears the label.
export function updateEdge(wid: string, id: string, fields: { kind?: EdgeKind; label?: string | undefined }) {
  return runUi(wid, (ctx) => [updateLink(ctx, { link: id, ...fields })], { label: 'label' in fields ? 'link label' : 'link type' })
}

// "A solves B" becomes "B solves A".
export function reverseEdge(wid: string, e: Edge) {
  return runUi(wid, (ctx) => [updateLink(ctx, { link: e.id, reverse: true })], { label: 'reverse link' })
}

export function deleteEdge(wid: string, id: string) {
  return runUi(wid, (ctx) => [unlink(ctx, { link: id })], { label: 'unlink' })
}
