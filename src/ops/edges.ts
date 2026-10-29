// Link ops (S4, D-312; agent-actions.md §2): link, unlink, update_link (kind, label, turn round).
import { defaultKind, FOR, type EdgeKind } from '../model/edges'
import { DELETE, type OpCtx, type Plan } from './types'
import { cardIn, find, handleOf, refuse } from './util'

// The kinds a link can be (the link bar's and the panel's; `for` tags a card with a customer).
export const EDGE_KINDS = ['relates', 'solves', 'part-of', 'competes-with', 'contradicts', 'inspired-by', 'depends-on', FOR] as const

function kindOk(op: string, kind: unknown) {
  if (kind !== undefined && !(EDGE_KINDS as readonly unknown[]).includes(kind)) refuse(op, `${String(kind)} isn't a kind of link`, `use one of ${EDGE_KINDS.join(', ')}`)
}

export type LinkArgs = { from: string; to: string; kind?: EdgeKind; label?: string; handle?: string }

export function link(ctx: OpCtx, args: LinkArgs): Plan {
  kindOk('link', args.kind)
  const from = cardIn(ctx, 'link', args.from)
  const to = cardIn(ctx, 'link', args.to)
  const kind = args.kind ?? defaultKind(from.type, to.type)
  const id = ctx.newId()
  return {
    op: 'link',
    label: kind === FOR ? 'tag' : 'link',
    writes: [{ coll: 'edges', id, set: { fromId: from.id, fromType: from.type, toId: to.id, toType: to.type, kind, ...(args.label ? { label: args.label } : {}) } }],
    ids: { [handleOf(args)]: id },
    meta: { kind: 'link' },
  }
}

export function unlink(ctx: OpCtx, args: { link: string }): Plan {
  const e = find(ctx.ws.edges, 'unlink', args.link, 'link')
  return { op: 'unlink', label: 'unlink', writes: [{ coll: 'edges', id: e.id, del: true }], ids: {}, meta: { kind: 'link' } }
}

// `label: null` or `''` takes the label away; `reverse` turns it round ("A solves B" becomes "B solves A").
export type UpdateLinkArgs = { link: string; kind?: EdgeKind; label?: string | null; reverse?: boolean }

export function updateLink(ctx: OpCtx, args: UpdateLinkArgs): Plan {
  const e = find(ctx.ws.edges, 'update_link', args.link, 'link')
  kindOk('update_link', args.kind)
  const patch: Record<string, unknown> = {}
  if (args.kind !== undefined) patch.kind = args.kind
  if ('label' in args) patch.label = args.label ? args.label : DELETE
  if (args.reverse) Object.assign(patch, { fromId: e.toId, fromType: e.toType, toId: e.fromId, toType: e.fromType })
  const label = args.reverse && args.kind === undefined && !('label' in args) ? 'reverse link' : 'label' in args ? 'link label' : 'link type'
  return { op: 'update_link', label, writes: [{ coll: 'edges', id: e.id, patch }], ids: {}, meta: { kind: 'link' } }
}
