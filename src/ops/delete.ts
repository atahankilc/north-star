// The one `delete` op (S6): cards, links, evidence, competitor features, matches and text go through cards.ts'
// deleteThings (S4, S5); pieces and canvases through pieces.ts (their cascades read from the snapshot, R5). One plan.
import { deleteThings, type DeleteArgs } from './cards'
import { deleteCanvasWrites, deletePieces } from './pieces'
import { deleteTasksPlan } from './tasks'
import { columnById, deleteColumnPlan } from './deck'
import type { OpCtx, Plan, Write } from './types'
import { once, refuse } from './util'

export type DeleteAnyArgs = DeleteArgs & {
  // A piece on several canvases (D-313): taken off `canvas` only (`here`), or deleted from all of them (`everywhere`).
  scope?: 'here' | 'everywhere'
  canvas?: string
  // A deck column's id shared by several decks: the deck it's on.
  deck?: string
}

export function deleteAny(ctx: OpCtx, args: DeleteAnyArgs): Plan {
  const ids = Array.isArray(args.ids) ? args.ids : []
  const pieces = ids.filter((id) => ctx.ws.pieces.some((p) => p.id === id))
  const canvases = ids.filter((id) => !pieces.includes(id) && ctx.ws.canvases.some((c) => c.id === id))
  const op = 'delete'
  // Tasks (S8), and deck columns (their tasks go to the column before, D-251).
  const tasks = ids.filter((id) => !pieces.includes(id) && !canvases.includes(id) && ctx.ws.tasks.some((t) => t.id === id))
  const columns = ids.filter((id) => !pieces.includes(id) && !canvases.includes(id) && !tasks.includes(id)).flatMap((id) => {
    if ([...ctx.ws.cards, ...ctx.ws.labels, ...ctx.ws.edges, ...ctx.ws.evidence, ...ctx.ws.competitorFeatures, ...ctx.ws.comparisons].some((x) => x.id === id)) return []
    const c = columnById(ctx, op, id, args.deck)
    return c ? [{ id, ...c }] : []
  })
  const rest = ids.filter((id) => !pieces.includes(id) && !canvases.includes(id) && !tasks.includes(id) && !columns.some((c) => c.id === id))
  if (!pieces.length && !canvases.length && !tasks.length && !columns.length) return deleteThings(ctx, args)
  const plans: Plan[] = []
  if (rest.length) plans.push(deleteThings(ctx, { ...args, ids: rest }))
  if (tasks.length) plans.push(deleteTasksPlan(ctx, tasks, op))
  if (pieces.length) plans.push(deletePieces(ctx, { ids: pieces, scope: args.scope, everywhere: args.everywhere, canvas: args.canvas }))
  const canvasWrites: Write[] = canvases.flatMap((c) => deleteCanvasWrites(ctx, op, c))
  if (canvases.length) plans.push({ op, label: canvases.length === 1 ? 'delete a canvas' : `delete ${canvases.length} canvases`, writes: canvasWrites, ids: {}, meta: { kind: 'canvas' } })
  // Last: a column's patches give way to what's deleted with its deck (once keeps a doc's first write).
  if (columns.length > 1) refuse(op, 'one deck column at a time', 'delete the columns in separate steps (each one\'s tasks move to the column before it)')
  if (columns.length) plans.push(deleteColumnPlan(ctx, columns[0].deck, columns[0].col, op))
  const kinds = new Set(plans.map((p) => p.meta?.kind))
  return {
    op,
    label: plans.length === 1 ? plans[0].label : `delete ${ids.length} things`,
    writes: once(plans.flatMap((p) => p.writes)),
    ids: {},
    meta: kinds.size === 1 && [...kinds][0] ? { kind: [...kinds][0] } : {},
  }
}
