// The agent's one write tool, `change` (S13, D-312; docs/specs/agent.md §4.4, §4.5, §7.1, §7.2). It writes NOTHING: its
// ops join the chat's pending changes (changeset.ts), which the person sees as a preview at the turn's end and accepts
// (one undo step, as the agent) or discards. The agent's later reads in the turn see the workspace with them.
//
// What it checks before an op joins, each refusal going back to the model with how to fix it:
// - a viewer's agent is read-only (D-098's lock; agent.md §7.2 point 7);
// - each op's args against the op's schema as the agent sees it (types, enums, required, nested; keys the schema
//   doesn't declare refused: the UI-only `moves`, `order`, `parts`, exact spots never reach a builder from the model),
//   and coordinates refused (NO_COORDS: say where by meaning);
// - ids only where an id goes (ID_KEYS): a short id (c12), a real id, or a title/name resolved through the read layer;
//   a name that fits several things answers with the candidates, a name that only starts one asks for its short id;
//   people (assignee, lane) by name, email or `me`;
// - every delete (delete, unlink, axis_remove) carries the agent's `why`, shown beside it in the preview;
// - the ops built by the registry (buildBatch, `$handles` within the call) and validated with what's already pending,
//   as apply will.
//
// Its result: what changed in names, grouped by where, each with its item id (`i3`: what `drop` takes off), the new
// short ids for what it made, warnings (a title that's already there, an empty section), and a short view of the
// touched pieces after the change. `dry_run`: the same checks and words, nothing added.
import { REGISTRY, type ArgSchema, type OpDef } from '../ops/registry'
import { addCall, accept, byWhere, canAutoApply, emptyChangeset, pendingCount, viewOf, DELETE_OPS, type ChangeItem, type ChangeOp, type Changeset } from './changeset'
import { checkArgs } from './schema'
import { ID_KEYS } from './idKeys'
import { makeIds, resolve, resolvePerson, unclear, view, type IdKind, type Ids } from './read'
import { clean, derive } from './read/derive'
import { norm, wrap } from './read/text'
import type { AgentEnv, AgentWs } from './contract'
import type { OpError } from '../ops/types'

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

export { ID_KEYS } from './idKeys'

// What a name under a key may be (left out: anything). Keys whose names the op reads itself (a matrix's row and col, a
// deck's column, a table's entry) take only short or real ids here; a name passes as written.
const KINDS: Record<string, IdKind[]> = {
  card: ['card'], cards: ['card'], keep: ['card'], merge: ['card'], competitor: ['card'], ours: ['card'], memberIds: ['card'], open: ['card'], fold: ['card'],
  from: ['card'], to: ['card'],
  plane: ['piece'], pieces: ['piece'], deck: ['piece'], stuck_to: ['piece'], tasks_to: ['piece'],
  canvas: ['canvas'],
  task: ['task'], tasks: ['task'], before: ['task'], after: ['task'], from_task: ['task'],
  link: ['link'], evidence: ['evidence'], doc: ['document'], feature: ['feature'],
  in_section: ['text'],
}
const NAMES_AS_WRITTEN = new Set(['row', 'col', 'column', 'values', 'entry'])
// Per op, where a key means something else (a duplicate's from/to are planes; a move_task's before/after are tasks).
const OP_KINDS: Record<string, Record<string, IdKind[]>> = { duplicate: { from: ['piece'], to: ['piece'] }, move_to_canvas: { from: ['canvas'] }, place_on: { from: ['canvas'] } }
const LITERALS = new Set(['new_deck', 'none', 'me', 'canvas', 'clear'])

const SHORT = /^[a-z]\d+$/
const HANDLE = /^\$\w+$/

// A thing's name, to tell an exact name from a prefix the read layer also accepts.
function nameOfThing(ws: AgentWs, kind: IdKind, id: string): string[] {
  const c = clean(ws)
  const d = derive(c)
  switch (kind) {
    case 'card':
      return [d.cards.get(id)?.title ?? '']
    case 'piece':
      return [d.pieces.get(id) ? d.pieceName(d.pieces.get(id)!) : '']
    case 'task':
      return [d.tasks.get(id)?.title ?? '']
    case 'canvas':
      return [c.canvases.find((x) => x.id === id)?.name ?? '']
    case 'document':
      return [d.docs.get(id)?.title ?? '']
    case 'text':
      return [d.labels.get(id)?.text.split('\n')[0] ?? '']
    case 'feature':
      return [d.featuresById.get(id)?.name ?? '']
    case 'person':
      return [d.names.get(id) ?? '', ...(c.members?.filter((m) => m.uid === id).map((m) => m.email ?? '') ?? [])]
    default:
      return []
  }
}

type Resolve = { value: unknown; errors: string[] }

// One string where an id goes: a handle stays; a short id becomes its real id (an unknown one is refused); a real id
// stays; a name is looked up (one exact match → its id; several → the candidates; only a prefix → asked for its id;
// none → left as written for the op to judge: deck columns, axis names).
function oneId(ws: AgentWs, ids: Ids, key: string, kinds: IdKind[] | undefined, v: string, path: string): Resolve {
  const t = v.trim()
  if (!t || HANDLE.test(t) || LITERALS.has(t)) return { value: v, errors: [] }
  if (key === 'assignee' || key === 'lane') {
    if (key === 'lane' && t === 'none') return { value: v, errors: [] }
    const p = resolvePerson(ws, ids, t)
    if ('id' in p) return { value: p.id, errors: [] }
    if (key === 'assignee') return { value: v, errors: p.candidates.length ? [`${path}: ${unclear(t, p)}`] : [`${path}: nobody called "${t}" is in this workspace; give a member by name, email or me`] }
    // A lane by card.
    kinds = ['card']
  }
  if (SHORT.test(t)) {
    const r = ids.real(t)
    if (!r) return { value: v, errors: [`${path}: there is no ${t} in this chat (use a short id from the map or a result)`] }
    if (kinds && !kinds.includes(r.kind) && !(key === 'id' || key === 'ids' || key === 'items')) return { value: v, errors: [`${path}: ${t} is a ${r.kind}; this takes a ${kinds.join(' or ')}`] }
    return { value: r.id, errors: [] }
  }
  if (NAMES_AS_WRITTEN.has(key)) return { value: v, errors: [] }
  const r = resolve(ws, ids, t, kinds)
  if ('id' in r) {
    if (r.id === t) return { value: t, errors: [] }
    const exact = nameOfThing(ws, r.kind, r.id).some((n) => n === t || norm(n) === norm(t))
    if (exact) return { value: r.id, errors: [] }
    return { value: v, errors: [`${path}: "${t}" only starts ${r.short} ${JSON.stringify(nameOfThing(ws, r.kind, r.id)[0] ?? '')}; if that's the one, give ${r.short}`] }
  }
  if (r.candidates.length) return { value: v, errors: [`${path}: ${unclear(t, r)}`] }
  return { value: v, errors: [] }
}

// Every id in an op's args resolved, deeply, only under ID_KEYS.
export function resolveIds(ws: AgentWs, ids: Ids, op: string, v: unknown, path = 'args', key = '', asId = false): Resolve {
  if (typeof v === 'string') return asId ? oneId(ws, ids, key, OP_KINDS[op]?.[key] ?? KINDS[key], v, path) : { value: v, errors: [] }
  if (Array.isArray(v)) {
    const out = v.map((x, i) => resolveIds(ws, ids, op, x, `${path}[${i}]`, key, asId))
    return { value: out.map((x) => x.value), errors: out.flatMap((x) => x.errors) }
  }
  if (v && typeof v === 'object') {
    const errors: string[] = []
    const value = Object.fromEntries(
      Object.entries(v).map(([k, x]) => {
        const r = resolveIds(ws, ids, op, x, `${path}.${k}`, k, ID_KEYS.has(k))
        errors.push(...r.errors)
        return [k, r.value]
      }),
    )
    return { value, errors }
  }
  return { value: v, errors: [] }
}

// A task given to someone the op can't name: their name from the people list (S8 reviewer: fill assigneeName).
function withNames(ws: AgentWs, args: Record<string, unknown>): Record<string, unknown> {
  const uid = args.assignee
  if (typeof uid !== 'string' || 'assigneeName' in args) return args
  if (ws.tasks.some((t) => t.assignee === uid && t.assigneeName)) return args
  const name = ws.members?.find((m) => m.uid === uid)?.name
  return name ? { ...args, assigneeName: name } : args
}

const OPS_LIST = [...REGISTRY.keys()].join(', ')
const ENTRY_KEYS = new Set(['op', 'args', 'why'])
// Ops in one call (a bigger job goes in several calls into the same preview).
export const MAX_OPS = 80

export type ParsedChange = { ok: true; ops: ChangeOp[]; drop: string[]; summary?: string; dryRun: boolean } | { ok: false; text: string }

// The call's arguments checked and turned into ops with real ids (nothing built yet).
export function parseChange(ws: AgentWs, ids: Ids, args: Record<string, unknown>): ParsedChange {
  const list = Array.isArray(args.ops) ? (args.ops as unknown[]) : []
  const drop = Array.isArray(args.drop) ? args.drop.filter((x): x is string => typeof x === 'string') : []
  if (!list.length && !drop.length) return { ok: false, text: 'change needs ops: [{ op, args, why? }, …] (or drop: [pending item ids])' }
  if (list.length > MAX_OPS) return { ok: false, text: `change refused, nothing added: ${list.length} ops in one call; at most ${MAX_OPS}. Split the job into several change calls (each adds to the same preview).` }
  const ops: ChangeOp[] = []
  const errors: string[] = []
  list.forEach((raw, i) => {
    const entry = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
    const extra = Object.keys(entry).filter((k) => !ENTRY_KEYS.has(k))
    if (extra.length) return void errors.push(`ops[${i}]: ${extra.join(', ')} not taken here (each op is { op, args, why? })`)
    const def = typeof entry.op === 'string' ? REGISTRY.get(entry.op) : undefined
    if (!def) return void errors.push(`ops[${i}]: there is no op ${String(entry.op)}; use one of ${OPS_LIST}`)
    const a = (entry.args && typeof entry.args === 'object' && !Array.isArray(entry.args) ? entry.args : {}) as Record<string, unknown>
    const coords = Object.keys(a).filter((k) => (NO_COORDS[def.name] ?? []).includes(k))
    if (coords.length) return void errors.push(`${def.name} refused: ${coords.join(', ')} ${coords.length > 1 ? 'are' : 'is'} a coordinate the agent never gives; ${COORDS_FIX}.`)
    const bad = checkArgs(a, agentArgs(def), `${def.name}.args`)
    if (bad.length) return void errors.push(...bad.slice(0, 8).map((b) => `ops[${i}] ${b}`))
    const why = typeof entry.why === 'string' ? entry.why.trim() : ''
    if (entry.why !== undefined && typeof entry.why !== 'string') return void errors.push(`ops[${i}].why: text, the reason the person reads`)
    if (DELETE_OPS.has(def.name) && !why) return void errors.push(`ops[${i}] ${def.name} needs a why: the reason the person reads beside it in the preview (and only after they said yes in this chat)`)
    const r = resolveIds(ws, ids, def.name, a, `ops[${i}] ${def.name}.args`)
    if (r.errors.length) return void errors.push(...r.errors)
    ops.push({ op: def.name, args: withNames(ws, r.value as Record<string, unknown>), ...(why ? { why } : {}) })
  })
  if (errors.length) return { ok: false, text: `change refused, nothing added:\n${errors.slice(0, 10).join('\n')}` }
  return { ok: true, ops, drop, ...(typeof args.summary === 'string' && args.summary.trim() ? { summary: args.summary.trim() } : {}), dryRun: args.dry_run === true }
}

// ---- The result in words

const fixes = (errors: OpError[]) => errors.map((x) => `${x.op}: ${x.message} (fix: ${x.fix})`).join('\n')

// The pieces a list of items touched (planes, decks, matrices, tables…), for the short view.
function touchedPieces(ws: AgentWs, items: ChangeItem[]): string[] {
  const out: string[] = []
  const add = (id: unknown) => typeof id === 'string' && ws.pieces.some((p) => p.id === id) && !out.includes(id) && out.push(id)
  for (const i of items)
    for (const id of i.ids) {
      const card = ws.cards.find((c) => c.id === id)
      const label = ws.labels.find((l) => l.id === id)
      const task = ws.tasks.find((t) => t.id === id)
      const cell = (ws.cells as unknown as { id: string; matrixId: string }[]).find((c) => c.id === id)
      const place = ws.places.find((p) => p.id === id)
      add(card?.pieceId ?? label?.pieceId ?? task?.pieceId ?? cell?.matrixId ?? place?.planeId ?? id)
    }
  return out
}

// The touched pieces after the change, trimmed to their head and the lines that name what changed.
function shortView(ws: AgentWs, ids: Ids, items: ChangeItem[]): string {
  const shorts = new Set<string>()
  for (const i of items)
    for (const id of i.ids)
      for (const k of ['card', 'task', 'text', 'piece'] as const) {
        const s = ids.has(k, id)
        if (s) shorts.add(s)
      }
  const out: string[] = []
  for (const p of touchedPieces(ws, items).slice(0, 2)) {
    let lines: string[]
    try {
      lines = view(ws, ids, { piece: p }).text.split('\n')
    } catch {
      continue
    }
    const head = lines[0]
    const hits = lines.filter((l, i) => i > 0 && [...shorts].some((s) => new RegExp(`(^|[^a-z0-9])${s}([^0-9]|$)`).test(l)) && !l.startsWith('<'))
    const shown = hits.slice(0, 12)
    out.push(head, ...(shown.length ? [wrap('workspace', shown.join('\n'))] : []), ...(hits.length > shown.length ? [`… ${hits.length - shown.length} more lines: view ${ids.short('piece', p)}`] : []))
  }
  return out.join('\n')
}

// The tool's answer: the items grouped by where, the new ids, warnings, the short view.
export function describeResult(o: { cs: Changeset; added: ChangeItem[]; handles: Record<string, string>; ws: AgentWs; ids: Ids; head: string }): string {
  const { cs, added, handles, ws, ids } = o
  const lines: string[] = [o.head]
  const groups = byWhere(added)
  const body: string[] = []
  for (const [where, items] of groups) {
    body.push(`${where}:`)
    for (const i of items) body.push(`  ${i.id} ${i.line}${i.delete && i.why ? ` (why: ${i.why})` : ''}`)
  }
  if (body.length) lines.push(wrap('workspace', body.join('\n')))
  const made = Object.entries(handles).flatMap(([h, id]) => {
    for (const k of ['card', 'piece', 'text', 'task', 'link', 'evidence', 'feature', 'canvas', 'document'] as const) {
      const s = ids.has(k, id)
      if (s) return [`${h} → ${s}`]
    }
    return []
  })
  if (made.length) lines.push(`New: ${made.join(', ')}.`)
  if (cs.warnings.length) lines.push('Warnings:', ...cs.warnings.map((w) => `- ${w}`))
  const v = shortView(ws, ids, added)
  if (v) lines.push('After the change:', v)
  return lines.join('\n')
}

// ---- The tool's run

export async function runChange(env: AgentEnv, args: Record<string, unknown>): Promise<{ ok: boolean; text: string }> {
  if (env.actor.role === 'viewer') return { ok: false, text: "change refused: a viewer's agent is read-only (viewers can only read this workspace). Answer, explain and suggest; an editor can make the change." }
  const live = env.liveWs?.() ?? env.getWs()
  const cs = env.changes ?? emptyChangeset()
  const seen = env.getWs()
  env.ids.sync(seen)
  const parsed = parseChange(seen, env.ids, args)
  if (!parsed.ok) return { ok: false, text: parsed.text }
  // A dry run names things with a copy of the short ids: nothing it would make gets a real short id in the chat.
  const ids = parsed.dryRun ? makeIds(env.ids.toJSON()) : env.ids
  const r = addCall(cs, parsed.ops, { live, actor: env.actor, now: env.now(), ...(env.newId ? { newId: env.newId } : {}), ids, ...(parsed.summary ? { summary: parsed.summary } : {}), drop: parsed.drop })
  if (!r.ok) return { ok: false, text: `change refused, nothing added:\n${fixes(r.errors)}` }
  const after = viewOf(r.cs, live)
  const dropped = parsed.drop.length ? `Took off ${r.cs.off.slice(cs.off.length).map((i) => i.id).join(', ')}. ` : ''
  if (parsed.dryRun) {
    ids.sync(after)
    return { ok: true, text: describeResult({ cs: r.cs, added: r.added, handles: r.handles, ws: after, ids, head: `Dry run: nothing was added. ${dropped}Would propose ${r.added.length} change${r.added.length === 1 ? '' : 's'} (its item and short ids are only examples: they are given when it is really proposed):` }) }
  }
  env.ids.sync(after)
  env.changes = r.cs
  // Auto-apply (off by default): a small batch of the agent's own new things lands at once, joining the turn's step.
  const turn = env.turnId ?? 'turn'
  const auto = r.cs.auto?.turn === turn ? r.cs.auto.n : 0
  if (canAutoApply(r.cs, env.settings, { appliedThisTurn: auto, agentMade: r.cs.agentMade })) {
    const n = r.cs.items.length
    const done = await accept(r.cs, env.apply, { key: `agent-turn:${env.chatId ?? 'chat'}:${turn}`, mergeAlways: true })
    if (done.ok) {
      env.changes = { ...done.cs, auto: { turn, n: auto + n } }
      return { ok: true, text: describeResult({ cs: r.cs, added: r.added, handles: r.handles, ws: env.getWs(), ids: env.ids, head: `${dropped}Applied at once (auto-apply is on; one undo step for the turn): ${n} change${n === 1 ? '' : 's'}.` }) }
    }
    // Refused at apply: it stays pending for the preview.
  }
  const pending = pendingCount(r.cs)
  return {
    ok: true,
    text: describeResult({
      cs: r.cs,
      added: r.added,
      handles: r.handles,
      ws: after,
      ids: env.ids,
      head: `${dropped}Proposed ${r.added.length} change${r.added.length === 1 ? '' : 's'} (${pending} pending in all). Nothing is written yet: the person sees them as a preview when your turn ends, and accepts them as one undo step or not. Your reads now show them.`,
    }),
  }
}
