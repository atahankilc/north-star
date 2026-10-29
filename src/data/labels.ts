// Text and frames written anywhere in the workspace (D-188): headings, paragraphs, sticky notes, sections and the
// project title. Not bound to a component: each sits on the canvas (`pieceId: 'canvas'`) or on a plane (its id), at x/y
// (top-left) in that space's px (D-050, D-118, D-130, D-156–D-158).
import { collection, doc, type DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import { snap } from '../model/grid'
import { discardNew } from './history'
import { applyUi, forgetRecent, present, runUi, sayRefused, serverHas, uiCtx } from '../ops/firestore'
import { arrange, createText, TEXT_NAMES, updateText, type CreateTextArgs, type UpdateTextArgs } from '../ops/text'
import { deleteThings } from '../ops/cards'

// What text is lives in src/model/labels.ts, without Firebase (S3).
export { CANVAS, LABEL_COLORS, kindOf, HEADING_PX, PARA_PX, STICKY_PX, PARA_W, STICKY_W, STICKY_H, TITLE_W, SECTION_MIN, KICKER_MAX, textMax } from '../model/labels'
export type { LabelSize, TextScale, LabelColor, Label, TextKind } from '../model/labels'
import { CANVAS, kindOf, type Label } from '../model/labels'
import { MAIN } from '../model/canvases'

const col = (wid: string) => collection(db(), 'workspaces', wid, 'labels')
export const labelRef = (wid: string, id: string) => doc(col(wid), id)

type New = Omit<Label, 'id' | 'createdAt'>

// Every write below is an op (S5, D-312: src/ops/text.ts) applied as one undo step; the functions keep their old
// signatures, labels, undo keys and promises (resolved once the server has the write).

// A new one, at its place: one undo step, which the text typed into it first joins (keyed as its text is, D-250).
// On the canvas: the canvas of the workspace shown (the ops' ctx, R1), unless `canvasId` says. '' when nothing was made.
export async function addLabel(wid: string, fields: New) {
  const ctx = uiCtx(wid)
  if (!ctx) return ''
  const kind = kindOf(fields)
  const { pieceId, x, y, kind: _k, size, canvasId, ...rest } = fields
  const style = Object.fromEntries(Object.entries(rest).filter(([k, v]) => v !== undefined && !(kind === 'title' && k === 'text')))
  const args: CreateTextArgs = {
    ...style,
    kind,
    ...(size && size !== 'note' ? { size } : {}),
    ...(pieceId === CANVAS ? (canvasId ? { canvas: canvasId } : {}) : { plane: pieceId }),
    where: { x, y },
  }
  let plan
  try {
    plan = createText(ctx, args)
  } catch (e) {
    sayRefused(e, `add ${TEXT_NAMES[kind]}`)
    return ''
  }
  const id = plan.ids.$new
  await serverHas(applyUi(wid, ctx, [plan], { key: `label:text:${id}` }))
  return id
}

// Its text, its setting: typing merges into one undo step; `undefined` takes a field away. `fresh`: the first text of
// one just made, one step with its making.
export function updateLabel(wid: string, l: Label, patch: Partial<Omit<Label, 'id' | 'pieceId' | 'createdAt'>>, key?: string, fresh = false) {
  const args = { id: l.id, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? null : v])) } as UpdateTextArgs
  return runUi(wid, (ctx) => [updateText(ctx, args)], { label: `change ${TEXT_NAMES[kindOf(l)]}`, ...(key ? { key: `label:${key}:${l.id}`, mergeAlways: fresh } : {}) })
}

// One just made, let go before it had any text: gone, with its step (D-250).
export const discardLabel = (wid: string, l: Pick<Label, 'id'>) => {
  // The UI's overlay may still replay its making.
  forgetRecent()
  return discardNew(labelRef(wid, l.id), `label:text:${l.id}`)
}

export function deleteLabel(wid: string, l: Label) {
  const label = `delete ${TEXT_NAMES[kindOf(l)]}`
  return runUi(wid, (ctx) => [{ ...deleteThings(ctx, { ids: present(ctx, [l.id]) }), label }], { label })
}

// Things moved together (a section and what's in it, D-130; a selection, a package's band, line up): one undo step
// from where each started. The refs say what moves (text, a card's doc or place, a piece's doc or spot); the caller has
// worked out what goes along, so the op carries nothing more. `extra`: more fields for that doc.
export type Move = { ref: DocumentReference; from: { x: number; y: number }; to: { x: number; y: number }; extra?: object }
export async function moveMany(label: string, moves: Move[]) {
  if (!moves.length) return
  // workspaces/<wid>/<collection>/<id>
  const wid = moves[0].ref.path.split('/')[1]
  return runUi(
    wid,
    (ctx) => {
      const all = moves.map((m) => {
        const coll = m.ref.parent.id
        const id = m.ref.id
        if (coll === 'places') {
          const p = ctx.ws.places.find((x) => x.id === id)
          return p && { id: p.cardId, plane: p.planeId, x: m.to.x, y: m.to.y }
        }
        if (coll === 'pieceSpots') {
          const sp = ctx.ws.spots.find((x) => x.id === id)
          return sp && { id: sp.pieceId, canvas: sp.canvasId, x: m.to.x, y: m.to.y }
        }
        if (coll === 'pieces') {
          const pc = ctx.ws.pieces.find((x) => x.id === id)
          return pc && { id, canvas: pc.canvasId || MAIN, x: m.to.x, y: m.to.y }
        }
        return present(ctx, [id]).length ? { id, x: m.to.x, y: m.to.y } : undefined
      })
      // What a collaborator deleted a moment ago is left out; the rest moves.
      const kept = moves.flatMap((m, i) => (all[i] ? [{ m, to: all[i]! }] : []))
      if (!kept.length) return []
      const plan = arrange(ctx, { to: kept.map((k) => k.to), carry: false })
      // `extra` fields ride on their doc's write.
      kept.forEach(({ m }, i) => m.extra && plan.writes[i].patch && Object.assign(plan.writes[i].patch!, m.extra))
      return [{ ...plan, label }]
    },
    { label },
  )
}

export const snapPoint = (x: number, y: number, free: boolean): [number, number] => (free ? [Math.round(x), Math.round(y)] : [snap(x), snap(y)])
