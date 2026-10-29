// The one `delete` op (S6): cards, links, evidence, competitor features, matches and text go through cards.ts'
// deleteThings (S4, S5); pieces and canvases through pieces.ts (their cascades read from the snapshot, R5). One plan.
import { deleteThings, type DeleteArgs } from './cards'
import { deleteCanvasWrites, deletePieces } from './pieces'
import type { OpCtx, Plan, Write } from './types'
import { once } from './util'

export type DeleteAnyArgs = DeleteArgs & {
  // A piece on several canvases (D-313): taken off `canvas` only (`here`), or deleted from all of them (`everywhere`).
  scope?: 'here' | 'everywhere'
  canvas?: string
}

export function deleteAny(ctx: OpCtx, args: DeleteAnyArgs): Plan {
  const ids = Array.isArray(args.ids) ? args.ids : []
  const pieces = ids.filter((id) => ctx.ws.pieces.some((p) => p.id === id))
  const canvases = ids.filter((id) => !pieces.includes(id) && ctx.ws.canvases.some((c) => c.id === id))
  const rest = ids.filter((id) => !pieces.includes(id) && !canvases.includes(id))
  if (!pieces.length && !canvases.length) return deleteThings(ctx, args)
  const op = 'delete'
  const plans: Plan[] = []
  if (rest.length) plans.push(deleteThings(ctx, { ...args, ids: rest }))
  if (pieces.length) plans.push(deletePieces(ctx, { ids: pieces, scope: args.scope, everywhere: args.everywhere, canvas: args.canvas }))
  const canvasWrites: Write[] = canvases.flatMap((c) => deleteCanvasWrites(ctx, op, c))
  if (canvases.length) plans.push({ op, label: canvases.length === 1 ? 'delete a canvas' : `delete ${canvases.length} canvases`, writes: canvasWrites, ids: {}, meta: { kind: 'canvas' } })
  const kinds = new Set(plans.map((p) => p.meta?.kind))
  return {
    op,
    label: plans.length === 1 ? plans[0].label : `delete ${ids.length} things`,
    writes: once(plans.flatMap((p) => p.writes)),
    ids: {},
    meta: kinds.size === 1 && [...kinds][0] ? { kind: [...kinds][0] } : {},
  }
}
