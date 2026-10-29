// The tools the eval's stand-in loop gives the model (S11, D-312) until S12/S13 bring the real ones: the read layer's
// tools as they are (READ_TOOLS + where_am_i), a stand-in `change` (S13's write tool: ops by name with short ids, built
// with the registry's buildBatch, applied through `env.apply` as the agent, a turn's applies = one undo step) and the UI tools
// (recorded by the eval env, never drawn). Every tool is an `AgentTool` of the contract, so S12's loop takes them as is.
import { READ_TOOLS, whereAmI, type Ids } from '../src/agent/read'
import { REGISTRY, buildBatch, type Step } from '../src/ops/registry'
import { OpsRefused, type OpCtx } from '../src/ops/types'
import { autoId } from '../src/ops/newId'
import { toolDef, type AgentTool } from '../src/agent/contract'
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

// ---- change (S13 replaces it)

const OPS_LIST = [...REGISTRY.keys()].join(', ')

const changeTool: AgentTool = {
  def: toolDef('change', `Change the workspace: a list of ops applied together as one undo step (ops: ${OPS_LIST}). Use short ids; a $handle names something made earlier in the same list.`, {
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
      const bad = checkArgs(raw, def.args, `${def.name}.args`)
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

export const EVAL_TOOLS: AgentTool[] = [...read, whereTool, changeTool, ...ui]
export const WRITE_TOOLS = new Set(EVAL_TOOLS.filter((t) => t.kind === 'write').map((t) => t.def.name))
