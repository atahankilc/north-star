// The agent's tools (S11 in evals/, moved here in S12, D-312; agent.md §4.4): the read layer's tools as they are
// (READ_TOOLS + where_am_i), `change` (S13, change.ts: ops checked and resolved, added to the chat's pending changes,
// previewed at the turn's end and accepted as one undo step: changeset.ts, workflow.ts) and the UI tools (src/agent/ui.ts in the browser, recorded
// by the eval env). Every tool is an `AgentTool` of the contract; the loop (loop.ts), the evals (evals/tools.ts) and
// the dev stub (devStub.ts) take this one list, and the prompt's test checks every tool it names is here.
import { READ_TOOLS, whereAmI, type Ids } from './read'
import { REGISTRY, type ArgSchema } from '../ops/registry'
import { toolDef, type AgentTool } from './contract'
import { agentArgs, ID_KEYS, runChange } from './change'

export { NO_COORDS, COORDS_FIX, agentArgs, ID_KEYS } from './change'

const SHORT = /^[a-z]\d+$/

const one = (ids: Ids, v: string) => (SHORT.test(v.trim()) ? (ids.real(v.trim())?.id ?? v) : v)

// Short ids (c12, p3…) turned into real ids where the key says an id goes (ID_KEYS), deeply; anything else as it was.
// `asId`: the value itself is an id (a UI tool's argument). (The change tool resolves names too: change.ts' resolveIds.)
export function realIds(ids: Ids, v: unknown, asId = false): unknown {
  if (typeof v === 'string') return asId ? one(ids, v) : v
  if (Array.isArray(v)) return v.map((x) => realIds(ids, x, asId))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, realIds(ids, x, ID_KEYS.has(k))]))
  return v
}

const read: AgentTool[] = READ_TOOLS.map((t) => ({
  def: toolDef(t.name, t.summary, t.args),
  kind: 'read',
  run: async (env, args) => {
    const r = t.run(env.getWs(), env.ids, args as never)
    return { ok: true, text: r.more && !r.text.includes(r.more) ? `${r.text}\n${r.more}` : r.text }
  },
}))

const whereTool: AgentTool = {
  def: toolDef('where_am_i', "Where the person is now: the canvas, what's in focus, beside it, selected, the open panel.", { properties: {} }),
  kind: 'read',
  run: async (env) => ({ ok: true, text: whereAmI(env.getWs(), env.ids, env.ui.currentView()).text }),
}

// ---- change (change.ts: the real write tool, S13)

// Shapes used by several ops, written once under "Types" and named in the signatures (found by their JSON, so the
// registry's helpers that build a fresh object each time still match).
const pathOf = (op: string, ...path: string[]): ArgSchema | undefined => {
  let a: ArgSchema | undefined = REGISTRY.get(op)?.args
  for (const k of path) a = k === '[]' ? a?.items : a?.properties?.[k]
  return a
}
const bare = (a: unknown): string => JSON.stringify(a, (k, v) => (k === 'description' ? undefined : v))
const SHAPES: [string, ArgSchema | undefined][] = [
  ['Fields', pathOf('create_card', 'fields')],
  ['Evidence', pathOf('create_card', 'evidence', '[]')],
  ['Link', pathOf('create_card', 'links', '[]')],
  ['Axis', pathOf('create_piece', 'matrix', 'rows')],
  ['Rule', pathOf('create_piece', 'table', 'rules', '[]')],
  ['Column', pathOf('create_piece', 'table', 'columns', '[]')],
  ['Steps', pathOf('create_piece', 'matrix', 'steps')],
  ['Matrix', pathOf('create_piece', 'matrix')],
  ['Table', pathOf('create_piece', 'table')],
  ['Deck', pathOf('create_piece', 'deck')],
]
const NAMED = new Map(SHAPES.filter(([, a]) => a).map(([n, a]) => [bare(a), n]))

// A short type signature from an ArgSchema: `{type: 'idea'|'problem'|…, plane: str, title?: str, where?: {near?: str},
// links?: Link[]}`. Strings `str` (most are ids or names), numbers `num`, booleans `bool`; long enums cut; a handle
// `"$a"`; a shared shape by its name (`top`: the shape itself, for its definition); nested past depth 3 `{…}`.
export function sig(a: ArgSchema | undefined, depth = 0, key = '', top = false): string {
  if (!a) return '?'
  if (key === 'handle') return '"$a"'
  const named = !top && NAMED.get(bare(a))
  if (named) return named
  if (a.anyOf) return [...new Set(a.anyOf.map((x) => sig(x, depth, key)))].join(' | ')
  const types = a.type === undefined ? [] : Array.isArray(a.type) ? a.type : [a.type]
  const nul = types.includes('null') ? '|null' : ''
  const t = types.find((x) => x !== 'null')
  if (a.enum) {
    const vals = a.enum.map((v) => (typeof v === 'string' ? `'${v}'` : String(v)))
    return (vals.length > 14 ? [...vals.slice(0, 13), '…'] : vals).join('|') + nul
  }
  if (!t && nul) return 'null'
  if (t === 'string') return `str${nul}`
  if (t === 'number' || t === 'integer') return `num${nul}`
  if (t === 'boolean') return `bool${nul}`
  if (t === 'array') {
    const inner = sig(a.items, depth + 1)
    return `${/[|\s]/.test(inner) && !inner.startsWith('{') ? `(${inner})` : inner}[]${nul}`
  }
  if (t === 'object' || a.properties) {
    if (!a.properties || depth >= 3) return `{…}${nul}`
    const req = new Set(a.required ?? [])
    return `{${Object.entries(a.properties)
      .map(([k, v]) => `${k}${req.has(k) ? '' : '?'}: ${sig(v, depth + 1, k)}`)
      .join(', ')}}${nul}`
  }
  return 'any'
}

export const TYPE_LINES = SHAPES.filter(([, a]) => a)
  .map(([n, a]) => `- ${n} = ${sig(a, 0, '', true)}`)
  .join('\n')

// The op's summary, cut to its first two sentences (the rest is in the refusals' fixes when it matters).
const brief = (summary: string) => {
  const flat = summary.replace(/\s+/g, ' ').trim()
  const parts = flat.match(/[^.]+(?:\.\)?(?=\s|$)|$)/g) ?? [flat]
  let out = parts.slice(0, 2).join('').trim()
  // A sentence cut inside brackets gets them closed.
  for (let open = (out.match(/\(/g) ?? []).length - (out.match(/\)/g) ?? []).length; open > 0; open--) out += ')'
  return out
}

// Each op as one line for the tool's description: its name, its args as a short signature, its summary in brief.
export const OPS_LINES = [...REGISTRY.values()].map((d) => `- ${d.name} ${sig(agentArgs(d))}: ${brief(d.summary)}`).join('\n')

const changeTool: AgentTool = {
  def: toolDef('change', `Propose changes to the workspace: ops: [{ op, args, why? }]. Nothing is written yet: the person sees every pending change as a preview when your turn ends and accepts them as one undo step (or unticks some, or says what to change). Your reads in this turn show them. Ids: short ids (c12, p3) or exact titles. A new thing gets a handle (args.handle: \"$a\") that later ops in the same call use in place of an id (to: \"$a\"); the result gives its short id. Say where by meaning (a plane, where: near / in_section, arrange's layout); coordinates are refused. A delete (delete, unlink, axis_remove) needs why: the reason the person reads, and only after they said yes. drop: [item ids] takes pending items off (and what depends on them) before adding, to revise. dry_run: true checks and describes without adding. str = an id, a name or text; ? = optional. The result names each change with its item id (i3), the new short ids, warnings and a short view; a refusal says how to fix it.\nTypes:\n${TYPE_LINES}\nOps:\n${OPS_LINES}`, {
    properties: {
      ops: { type: 'array', items: { type: 'object', properties: { op: { type: 'string', enum: [...REGISTRY.keys()] }, args: { type: 'object' }, why: { type: 'string', description: 'why: required for delete, unlink and axis_remove' } }, required: ['op', 'args'] } },
      drop: { type: 'array', items: { type: 'string' }, description: 'pending item ids (i2…) to take off first' },
      dry_run: { type: 'boolean', description: 'check and describe only; nothing is added' },
      summary: { type: 'string', description: 'one line for the undo list' },
    },
  }),
  kind: 'write',
  run: runChange,
}

// ---- UI tools (the facade; the eval records them)

const id = (description: string) => ({ type: 'string', description })
const ui: AgentTool[] = [
  { def: toolDef('go_to', 'Bring something into view (into its plane\'s focus when it is inside one).', { properties: { id: id('a card, text, piece or task') }, required: ['id'] }), kind: 'ui', run: async (env, a) => (await env.ui.goTo(String(realIds(env.ids, a.id, true))), { ok: true, text: 'there' }) },
  { def: toolDef('focus', 'Focus a plane (null: back to the canvas).', { properties: { plane: { type: ['string', 'null'] } }, required: ['plane'] }), kind: 'ui', run: async (env, a) => (await env.ui.focus(a.plane == null ? null : String(realIds(env.ids, a.plane, true))), { ok: true, text: 'focused' }) },
  { def: toolDef('select', 'Select cards, text or tasks.', { properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] }), kind: 'ui', run: async (env, a) => (await env.ui.select((realIds(env.ids, a.ids ?? [], true) as string[]).map(String)), { ok: true, text: 'selected' }) },
  { def: toolDef('open_panel', "Open a card's or task's panel.", { properties: { id: id('a card or task') }, required: ['id'] }), kind: 'ui', run: async (env, a) => (await env.ui.openPanel(String(realIds(env.ids, a.id, true))), { ok: true, text: 'open' }) },
  { def: toolDef('show_beside', 'Open a piece stuck to a plane beside it (a deck or timeline: the tasks side view).', { properties: { piece: id('a piece') }, required: ['piece'] }), kind: 'ui', run: async (env, a) => (await env.ui.showBeside(String(realIds(env.ids, a.piece, true))), { ok: true, text: 'beside' }) },
]

export const AGENT_TOOLS: AgentTool[] = [...read, whereTool, changeTool, ...ui]
export const WRITE_TOOLS = new Set(AGENT_TOOLS.filter((t) => t.kind === 'write').map((t) => t.def.name))
export const TOOL_NAMES = AGENT_TOOLS.map((t) => t.def.name)
