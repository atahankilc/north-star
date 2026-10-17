// Tools the assistant runs to read the workspace mid-answer (D-084). The brief clips long text and lists links by name;
// these give the whole of a few items. They run in the browser on the workspace as it was when the message was sent.
import type { WorkspaceCtx } from '../views/workspace/context'
import type { ItemRef } from './context'

export const GET_ITEMS = 'get_items'

// One call reads at most this many; each item's text is still capped, so a step stays cheap.
const MAX_ITEMS = 12
const MAX_FIELD = 4000

export const GET_ITEMS_TOOL = {
  type: 'function',
  name: GET_ITEMS,
  description:
    'Read items in full: every field untrimmed (the workspace brief cuts long text with …), their links in both directions ' +
    "with kinds, a competitor's features in full, and the matrix cells they are in. Use it before judging, comparing or " +
    'editing items whose text is cut, or when you need the details. Not needed for what the brief already shows.',
  strict: true,
  parameters: {
    type: 'object',
    properties: {
      refs: { type: 'array', items: { type: 'string' }, description: `Refs from the workspace, without brackets; at most ${MAX_ITEMS}.` },
    },
    required: ['refs'],
    additionalProperties: false,
  },
}

const full = (v: string | undefined) => {
  const t = (v ?? '').trim()
  return t.length > MAX_FIELD ? `${t.slice(0, MAX_FIELD)}…` : t
}
const field = (name: string, v: string | number | undefined) => (v === undefined || v === '' ? [] : [`  ${name}: ${v}`])

// The result text for one get_items call. `refs` are the brief's (ref → item), so the model's refs mean the same here.
export function readItems(args: string, ws: WorkspaceCtx, refs: Map<string, ItemRef>): { text: string; names: string[] } {
  let asked: string[] = []
  try {
    const data = JSON.parse(args) as { refs?: unknown }
    if (Array.isArray(data.refs)) asked = data.refs.map((r) => String(r).replace(/^\[|\]$/g, '').trim()).filter(Boolean)
  } catch {
    return { text: 'Arguments were not valid JSON.', names: [] }
  }
  const refOf = new Map([...refs].map(([ref, it]) => [it.id, ref]))
  const nameOf = (id: string) => {
    for (const it of refs.values()) if (it.id === id) return `[${refOf.get(id)}] ${it.name}`
    return '(deleted item)'
  }

  const names: string[] = []
  const blocks = [...new Set(asked)].slice(0, MAX_ITEMS).map((ref) => {
    const it = refs.get(ref)
    if (!it) return `[${ref}]: no item has this ref.`
    const lines = [`[${ref}] ${it.type} "${it.name}"`]
    const card = [...ws.customers, ...ws.problems, ...ws.ideas, ...ws.features].find((n) => n.id === it.id)
    const comp = ws.competitors.find((c) => c.id === it.id)
    const cf = ws.competitorFeatures.find((f) => f.id === it.id)
    if (!card && !comp && !cf) return `[${ref}]: deleted since the message was sent.`
    names.push(it.name)
    if (card) {
      const f = card as typeof card & { priority?: string; status?: string; effort?: string }
      lines.push(...field('notes', full(card.body)), ...field('tags', card.tags?.join(', ')))
      lines.push(...field('priority', f.priority), ...field('status', f.status), ...field('effort', f.effort))
    }
    if (comp) {
      lines.push(...field('url', comp.url), ...field('description', full(comp.description)), ...field('pricing', full(comp.pricing)))
      lines.push(...field('audience', full(comp.audience)), ...field('notes', full(comp.notes)), ...field('tags', comp.tags?.join(', ')))
      const feats = ws.competitorFeatures.filter((x) => x.competitorId === comp.id)
      if (feats.length) lines.push(`  features (${feats.length}):`)
      for (const x of feats) lines.push(`  · [${refOf.get(x.id)}] ${x.category ? `${x.category} / ` : ''}${x.name}${x.description ? `: ${full(x.description)}` : ''}`)
    }
    if (cf) {
      lines.push(`  of competitor: ${nameOf(cf.competitorId)}`, ...field('category', cf.category), ...field('description', full(cf.description)))
    }
    const out = ws.edges.filter((e) => e.fromId === it.id)
    const into = ws.edges.filter((e) => e.toId === it.id)
    if (out.length || into.length) lines.push('  links:')
    for (const e of out) lines.push(`  → ${e.kind} ${nameOf(e.toId)}${e.label ? ` (${e.label})` : ''}`)
    for (const e of into) lines.push(`  ← ${nameOf(e.fromId)} ${e.kind} this${e.label ? ` (${e.label})` : ''}`)
    const cells = ws.comparisons.filter((c) => (c.featureId === it.id || c.competitorId === it.id) && (c.coverage || c.notes))
    if (cells.length) lines.push('  matrix:')
    for (const c of cells) lines.push(`  ${nameOf(c.featureId)} × ${nameOf(c.competitorId)}: ${c.coverage ?? 'not assessed'}${c.notes ? `; ${full(c.notes)}` : ''}`)
    return lines.join('\n')
  })
  if (!blocks.length) return { text: 'No refs given.', names }
  const more = asked.length > MAX_ITEMS ? `\n\n(Only the first ${MAX_ITEMS} were read; ask for the rest in another call.)` : ''
  return { text: blocks.join('\n\n') + more, names }
}
