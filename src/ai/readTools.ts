// Tools the assistant runs to read the workspace mid-answer (D-084). The brief clips long text and lists links by name;
// these give the whole of a few items. They run in the browser on the workspace as it was when the message was sent.
import { fetchReport } from '../data/reports'
import type { ReportContent, ReportPoint } from '../data/model'
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
// `missed`: some refs matched nothing (or were deleted since).
export function readItems(args: string, ws: WorkspaceCtx, refs: Map<string, ItemRef>): { text: string; names: string[]; missed: number } {
  let asked: string[] = []
  try {
    const data = JSON.parse(args) as { refs?: unknown }
    if (Array.isArray(data.refs)) asked = data.refs.map((r) => String(r).replace(/^\[|\]$/g, '').trim()).filter(Boolean)
  } catch {
    return { text: 'Arguments were not valid JSON.', names: [], missed: 1 }
  }
  const refOf = new Map([...refs].map(([ref, it]) => [it.id, ref]))
  const nameOf = (id: string) => {
    for (const it of refs.values()) if (it.id === id) return `[${refOf.get(id)}] ${it.name}`
    return '(deleted item)'
  }

  const names: string[] = []
  let missed = 0
  const blocks = [...new Set(asked)].slice(0, MAX_ITEMS).map((ref) => {
    const it = refs.get(ref)
    if (!it) return missed++, `[${ref}]: no item has this ref.`
    const lines = [`[${ref}] ${it.type} "${it.name}"`]
    const card = [...ws.customers, ...ws.problems, ...ws.ideas, ...ws.features].find((n) => n.id === it.id)
    const comp = ws.competitors.find((c) => c.id === it.id)
    const cf = ws.competitorFeatures.find((f) => f.id === it.id)
    if (!card && !comp && !cf) return missed++, `[${ref}]: deleted since the message was sent.`
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
    const cells = ws.comparisons.filter((c) => (c.featureId === it.id || c.competitorId === it.id) && (c.coverage || c.notes || c.competitorFeatureId))
    if (cells.length) lines.push('  matrix:')
    for (const c of cells) lines.push(`  ${nameOf(c.featureId)} × ${nameOf(c.competitorId)}: ${c.coverage ?? 'not assessed'}${c.competitorFeatureId ? `; their version: ${nameOf(c.competitorFeatureId)}` : ''}${c.notes ? `; ${full(c.notes)}` : ''}`)
    return lines.join('\n')
  })
  if (!blocks.length) return { text: 'No refs given.', names, missed: 1 }
  const more = asked.length > MAX_ITEMS ? `\n\n(Only the first ${MAX_ITEMS} were read; ask for the rest in another call.)` : ''
  return { text: blocks.join('\n\n') + more, names, missed }
}

// Reports (D-099): the one open on the report screen is in the brief in full; the others are listed by handle and read
// with get_report, so the assistant can build or rework the board from any of them.
export const GET_REPORT = 'get_report'

export const GET_REPORT_TOOL = {
  type: 'function',
  name: GET_REPORT,
  description:
    'Read a saved report in full: its answer, every section and point with numbered sources, what it means for us (with the ' +
    'refs of the items it concerns), open questions and the sources with their URLs. The brief lists reports with a ' +
    '[report:…] handle and only their answer; the report the user has open is already in full under OPEN REPORT.',
  strict: true,
  parameters: {
    type: 'object',
    properties: { report: { type: 'string', description: 'The handle after "report:", without brackets.' } },
    required: ['report'],
    additionalProperties: false,
  },
}

// Long enough for any report the assistant writes; an uploaded file (D-091) may be cut.
const MAX_REPORT = 24_000

// A report as the model reads it: like the report screen, sources by number with their URLs, our items by ref.
export function reportFull(r: ReportContent, refOf: (id: string) => string | undefined): string {
  const cite = (p: ReportPoint) => (p.sources.length ? ` ${p.sources.map((n) => `[${n}]`).join('')}` : '')
  const items = (ids: string[]) => {
    const refs = ids.map(refOf).filter(Boolean)
    return refs.length ? ` (items: ${refs.map((x) => `[${x}]`).join(' ')})` : ''
  }
  const text = [
    `TITLE: ${r.title}`,
    `ANSWER: ${r.answer}`,
    ...r.sections.flatMap((s) => ['', `## ${s.question}`, ...s.points.map((p) => `- ${p.text}${cite(p)}`)]),
    ...(r.implications.length ? ['', '## What it means for us', ...r.implications.map((i) => `- ${i.text}${items(i.items)}`)] : []),
    ...(r.openQuestions.length ? ['', '## Open questions', ...r.openQuestions.map((q) => `- ${q}`)] : []),
    ...(r.sources.length ? ['', '## Sources', ...r.sources.map((s, i) => `${i + 1}. ${s.title} ${s.url}`)] : []),
  ].join('\n')
  return text.length > MAX_REPORT ? `${text.slice(0, MAX_REPORT)}\n… (report cut short here)` : text
}

// The result text for one get_report call. `reports`: the brief's handles (handle → report id).
export async function readReport(
  args: string,
  wid: string,
  reports: Map<string, string>,
  refOf: (id: string) => string | undefined,
): Promise<{ text: string; title: string | null }> {
  let handle = ''
  try {
    handle = String((JSON.parse(args) as { report?: unknown }).report ?? '').replace(/^\[|\]$/g, '').replace(/^report:/, '').trim()
  } catch {
    return { text: 'Arguments were not valid JSON.', title: null }
  }
  const id = reports.get(handle)
  if (!id) return { text: `No report has the handle ${handle}. Use one listed under REPORTS.`, title: null }
  const r = await fetchReport(wid, id).catch(() => null)
  if (!r) return { text: `[report:${handle}] was deleted, or it isn't shared with this user any more.`, title: null }
  return { text: `[report:${handle}]\n${reportFull(r, refOf)}`, title: r.title }
}
