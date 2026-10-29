// The agent's tools (S11 in evals/, moved here in S12, D-312; agent.md §4.4): the read layer's tools as they are
// (READ_TOOLS + where_am_i), a stand-in `change` (ops by name with short ids, args checked against each op's schema,
// built with the registry's buildBatch, applied through `env.apply` as the agent; a turn's applies = one undo step:
// S13 replaces it with the real write tool and its workflow) and the UI tools (src/agent/ui.ts in the browser, recorded
// by the eval env). Every tool is an `AgentTool` of the contract; the loop (loop.ts), the evals (evals/tools.ts) and
// the dev stub (devStub.ts) take this one list, and the prompt's test checks every tool it names is here.
import { READ_TOOLS, whereAmI, type Ids } from './read'
import { REGISTRY, buildBatch, type ArgSchema, type OpDef, type Step } from '../ops/registry'
import { OpsRefused, type OpCtx } from '../ops/types'
import { autoId } from '../ops/newId'
import { toolDef, type AgentTool } from './contract'
import { checkArgs } from './schema'

const SHORT = /^[a-z]\d+$/

// The argument names that hold ids (of cards, pieces, text, tasks, links, evidence, canvases…) in the ops registry's
// schemas. Only strings under these are read as short ids: a title, name, text or note that happens to look like `c12`
// stays as written.
export const ID_KEYS = new Set([
  'id', 'ids', 'card', 'cards', 'plane', 'canvas', 'from', 'to', 'link', 'items', 'pieces', 'near', 'in_section', 'deck', 'task', 'tasks',
  'stuck_to', 'evidence', 'competitor', 'ours', 'memberIds', 'around', 'doc', 'before', 'after', 'lane', 'from_task', 'row', 'col',
  'entry', 'open', 'fold', 'tasks_to', 'values', 'column',
])

const one = (ids: Ids, v: string) => (SHORT.test(v.trim()) ? (ids.real(v.trim())?.id ?? v) : v)

// Short ids (c12, p3…) turned into real ids where the key says an id goes (ID_KEYS), deeply; anything else as it was.
// `asId`: the value itself is an id (a UI tool's argument).
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

// ---- change (the stand-in; S13 replaces it)

const OPS_LIST = [...REGISTRY.keys()].join(', ')

// ---- No coordinates (agent.md §4.4, §7.1 rule 4): the args the UI uses to put things at exact spots stay out of the
// agent's view of each op and are refused when sent: a card's x/y, a duplicate's or arrange's [dx, dy] (`by`, and `stick`,
// which only goes with it), a text's width/height at creation (update_text never takes them). Sizing a piece on purpose
// stays (`resize`); `by: 'up' | 'down' | 'left' | 'right'` (canvases, deck columns) is an order, not a coordinate.
export const NO_COORDS: Record<string, string[]> = { update_card: ['x', 'y'], duplicate: ['by'], create_text: ['w', 'h'], update_text: ['w', 'h', 'x', 'y'], arrange: ['by', 'stick'] }
export const COORDS_FIX = 'say where by meaning instead: arrange with layout (grid, row, column, cluster, align-…) and where (near a thing, in_section, at: clear); new things take where: near or in_section'

// An op's schema as the agent sees it: the coordinate args taken out.
export function agentArgs(def: OpDef): ArgSchema {
  const hide = new Set(NO_COORDS[def.name] ?? [])
  if (!hide.size || !def.args.properties) return def.args
  return { ...def.args, properties: Object.fromEntries(Object.entries(def.args.properties).filter(([k]) => !hide.has(k))), required: (def.args.required ?? []).filter((k) => !hide.has(k)) }
}

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
  def: toolDef('change', `Change the workspace: ops: [{ op, args }] applied together as one undo step; calls see the workspace as it was before this step. Ids: short ids (c12, p3) or titles. A new thing gets a handle (args.handle: \"$a\") that later ops in the same list use in place of an id (to: \"$a\"). Say where by meaning (a plane, where: near / in_section, arrange's layout); coordinates are refused. str = an id, a name or text; ? = optional. The result names what changed and the new short ids; a refusal says how to fix it.\nTypes:\n${TYPE_LINES}\nOps:\n${OPS_LINES}`, {
    properties: {
      ops: { type: 'array', items: { type: 'object', properties: { op: { type: 'string', enum: [...REGISTRY.keys()] }, args: { type: 'object' } }, required: ['op', 'args'] } },
      summary: { type: 'string', description: 'one line for the undo list' },
    },
    required: ['ops'],
  }),
  kind: 'write',
  run: async (env, args) => {
    const list = Array.isArray(args.ops) ? (args.ops as { op?: unknown; args?: unknown }[]) : []
    if (!list.length) return { ok: false, text: 'change needs ops: [{ op, args }, …]' }
    const steps: Step[] = []
    for (const s of list) {
      const def = typeof s.op === 'string' ? REGISTRY.get(s.op) : undefined
      if (!def) return { ok: false, text: `there is no op ${String(s.op)}; use one of ${OPS_LIST}` }
      const raw = (s.args && typeof s.args === 'object' && !Array.isArray(s.args) ? s.args : {}) as Record<string, unknown>
      // Checked against the op's schema: types, enums, required, nested; keys it doesn't declare refused (agent-run.md
      // "S13 must": UI-only args never reach the builders from the model). Errors go back to the model.
      const coords = Object.keys(raw).filter((k) => (NO_COORDS[def.name] ?? []).includes(k))
      if (coords.length) return { ok: false, text: `${def.name} refused, nothing changed: ${coords.join(', ')} ${coords.length > 1 ? 'are' : 'is'} a coordinate the agent never gives; ${COORDS_FIX}.` }
      const bad = checkArgs(raw, agentArgs(def), `${def.name}.args`)
      if (bad.length) return { ok: false, text: `${def.name} refused, nothing changed:\n${bad.slice(0, 8).join('\n')}` }
      steps.push({ op: def.name, args: realIds(env.ids, raw) as Record<string, unknown> })
    }
    const ctx: OpCtx = { ws: env.getWs(), actor: env.actor, now: env.now(), newId: env.newId ?? (() => autoId()) }
    let plans
    try {
      plans = buildBatch(ctx, steps)
    } catch (e) {
      if (e instanceof OpsRefused) return { ok: false, text: e.errors.map((x) => `${x.op}: ${x.message} (fix: ${x.fix})`).join('\n') }
      return { ok: false, text: `change failed: ${(e as Error).message}` }
    }
    const done = await env.apply(plans, { actor: 'agent', label: typeof args.summary === 'string' ? args.summary : undefined })
    if (!done.ok) return { ok: false, text: done.errors.map((x) => `${x.op}: ${x.message} (fix: ${x.fix})`).join('\n') }
    const made = plans.flatMap((p) =>
      Object.entries(p.ids).map(([h, id]) => {
        const r = env.ids.has('card', id) ?? env.ids.has('piece', id) ?? env.ids.has('text', id) ?? env.ids.has('task', id) ?? env.ids.has('link', id) ?? env.ids.has('evidence', id) ?? env.ids.has('canvas', id) ?? id
        return `${h} → ${r}`
      }),
    )
    return { ok: true, text: `Applied as one undo step: ${done.label}.${made.length ? ` Made: ${made.join(', ')}.` : ''}` }
  },
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
