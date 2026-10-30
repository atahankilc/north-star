// The agent's pending changes (S13, D-312; docs/specs/agent.md §4.4, §4.5, §7.2). Pure: no React, no Firebase.
//
// During a turn the `change` tool writes nothing. Each call's ops are added here as a GROUP of steps; every step is one
// item the person sees in the preview (a plain-words line, where it is, a tick). The plans are the ops layer's own
// (the registry's buildBatch), so the preview (`view`: `project(ws, plans)`, what the agent's later reads in the turn
// see too) is exactly what `accept` writes, as one undo step, as the agent.
//
// HOW IT STAYS RIGHT WHEN THINGS COME OFF. A group is built with buildBatch, so `$handles` resolve inside the call that
// gave them (a later call names new things by the short ids the result gave). Every step keeps the new ids its builder
// took, and is given the same ones again whenever the plans are rebuilt, so a new card keeps its id (and short id)
// when an item before it is unticked. `untick(item)` takes the item off with every item that depends on it (one that
// names or writes something the other made), then rebuilds the plans from the remaining steps on the workspace as it is
// now; a step that no longer builds comes off too, with a warning.
//
// REVISING (the person's note during the preview, agent.md §4.5 foot, §4.10): the changeset stays pending into the next
// turn. The agent's new `change` calls ADD items; `change(drop: ['i2'])` takes items (and what depends on them) off
// first, so "make the second one a problem instead" is one call: drop i2, add the new op. Nothing is ever replaced
// silently.
import { buildBatch, REGISTRY } from '../ops/registry'
import { project, projectLoose } from '../ops/project'
import { validate } from '../ops/validate'
import { diff, type Change } from '../ops/diff'
import { toDocs, type DocStore } from '../ops/docs'
import { OpsRefused, type OpActor, type OpError, type Plan, type Write } from '../ops/types'
import { autoId } from '../ops/newId'
import { CARD_COLLECTION, type Card } from '../model/cards'
import { canvasOf } from '../model/canvases'
import { kindOf } from '../model/labels'
import { kindOfPiece, KIND_NAME } from '../model/pieces'
import { labelBox } from '../model/labelBox'
import { cardBoxes, piecesShown, sectionHolds } from '../model/textPlace'
import type { WorkspaceCtx } from '../state/wsStore'
import { clean, derive, type Derived } from './read/derive'
import { norm, q } from './read/text'
import type { Ids } from './read/ids'
import type { Applied, ApplyAs } from './contract'
import { ID_KEYS } from './idKeys'
import { entriesOf, type MatrixSetup } from '../model/matrix'
import { colName, type Column, type TableSetup } from '../model/table'
import { tableRows } from '../model/lens'
import { lineDiff, notesOf, NOTES_TITLE, type DiffLine } from '../model/notes'

// Handles are read under id keys, and `handle` itself (buildBatch's own default) is never resolved.
const HANDLE_KEYS: ReadonlySet<string> = ID_KEYS

// One op as the change tool hands it over: args already checked and with real ids (handles stay `$a`), and the agent's
// reason (required for deletes).
export type ChangeOp = { op: string; args: Record<string, unknown>; why?: string }

// A step as kept: the op, its item, the new ids its builder took (given back on every rebuild).
type Step = ChangeOp & { item: string; newIds: string[] }
type Group = { call: number; summary?: string; steps: Step[] }

// What the preview lists, one per op (agent.md §4.5's change list).
export type ChangeItem = {
  // `i1`, `i2`…: stable in a chat, never reused.
  id: string
  // The change call it came from (1, 2…).
  call: number
  op: string
  // The registry's kind of op (card, link, task, piece…).
  kind: string
  // The op's own words (its undo label: `add a problem`).
  label: string
  // In plain words, with names: `add a problem: new problem "Stalls run out of paper bags"`.
  line: string
  // Where it is: `Segments · plane`, `Sprint · deck`, `Main · canvas`.
  where: string
  // Every doc it writes, and the ones it makes (didn't exist before it).
  ids: string[]
  made: string[]
  // Items it can't stand without (it names or writes what they make).
  dependsOn: string[]
  // It takes something away; `why`: the agent's reason, shown beside it.
  delete: boolean
  // The mark the preview gives it, the same as its things' marks: `+` makes, `−` takes away, `~` changes.
  sign: '+' | '~' | '−'
  why?: string
  // The agent notes' text before → after, line by line (update_notes only, S16): the preview's diff.
  diff?: DiffLine[]
  // The words in `line` to strike (S17: a merge strikes only the merged card's name).
  strike?: string
}

export type Changeset = {
  groups: Group[]
  // One plan per remaining step, in order: what accept writes.
  plans: Plan[]
  items: ChangeItem[]
  // Handle → real id, the latest call's handles winning (each call's own handles are in its result).
  ids: Record<string, string>
  warnings: string[]
  // Items taken off (unticked, dropped, or no longer buildable): the report's "not done".
  off: ChangeItem[]
  // Counters (ids never reused) and a version that changes with every change (memoised views key on it).
  nextItem: number
  nextCall: number
  version: number
  // What the agent made and applied earlier in this chat (auto-apply may touch those), and what auto-apply has applied
  // in the current turn (≤ 5 a turn).
  agentMade: string[]
  auto?: { turn: string; n: number }
}

export const emptyChangeset = (): Changeset => ({ groups: [], plans: [], items: [], ids: {}, warnings: [], off: [], nextItem: 1, nextCall: 1, version: 0, agentMade: [] })

export const pendingCount = (cs: Changeset | undefined) => cs?.items.length ?? 0

// The ops that take something away: each needs the agent's `why`, and shows struck in the preview.
export const DELETE_OPS = new Set(['delete', 'unlink', 'axis_remove', 'merge_cards'])

export type BuildCtx = { live: WorkspaceCtx; actor: OpActor; now: number; newId?: () => string }

// ---- Building

type Built = { plans: Plan[]; args: Record<string, unknown>[] }

// One group's steps built with buildBatch on `ws`, each step given back its own new ids.
function buildGroup(ws: WorkspaceCtx, steps: Step[], c: BuildCtx): Built {
  const fresh = c.newId ?? (() => autoId())
  let cur = -1
  const used: number[] = steps.map(() => 0)
  const args: Record<string, unknown>[] = []
  const newId = () => {
    const s = steps[cur]
    if (!s) return fresh()
    const k = used[cur]++
    if (k < s.newIds.length) return s.newIds[k]
    const id = fresh()
    s.newIds.push(id)
    return id
  }
  const plans = buildBatch(
    { ws, actor: c.actor, now: c.now, newId },
    steps.map((s) => ({ op: s.op, args: s.args })),
    (i, a) => {
      cur = i
      args[i] = a
    },
    HANDLE_KEYS,
  )
  return { plans, args }
}

type Rebuilt = { groups: Group[]; built: Built[]; dropped: { step: Step; error: string }[] }

const errText = (e: unknown) => (e instanceof OpsRefused ? e.errors.map((x) => `${x.message} (fix: ${x.fix})`).join('; ') : (e as Error)?.message ?? String(e))

// Every group rebuilt in order on the workspace as it is now. `strict`: the last group must build whole (a new call:
// its refusal goes back to the model); the others drop a step that no longer builds (and say so).
function rebuild(groups: Group[], c: BuildCtx, strictLast: boolean): Rebuilt {
  let ws = c.live
  const out: Group[] = []
  const built: Built[] = []
  const dropped: Rebuilt['dropped'] = []
  groups.forEach((g, gi) => {
    let steps = g.steps
    let b: Built
    try {
      b = buildGroup(ws, steps, c)
    } catch (e) {
      if (strictLast && gi === groups.length - 1) throw e
      // Step by step: keep what still builds with what's kept before it.
      const kept: Step[] = []
      b = { plans: [], args: [] }
      for (const s of steps) {
        try {
          b = buildGroup(ws, [...kept, s], c)
          kept.push(s)
        } catch (err) {
          dropped.push({ step: s, error: errText(err) })
          if (kept.length) b = buildGroup(ws, kept, c)
        }
      }
      steps = kept
    }
    if (!steps.length) return
    out.push({ ...g, steps })
    // Handles last only for their call: kept apart per call (`$a#2`), so two calls' `$a` never clash in validate.
    built.push({ ...b, plans: b.plans.map((p) => ({ ...p, ids: Object.fromEntries(Object.entries(p.ids).map(([h, id]) => [`${h}#${g.call}`, id])) })) })
    ws = project(ws, b.plans)
  })
  return { groups: out, built, dropped }
}

// ---- Describing (plain words, names; what the preview lists and the tool's result says)

const strings = (v: unknown, out: Set<string> = new Set()): Set<string> => {
  if (typeof v === 'string') out.add(v)
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out))
  return out
}

type Named = { ws: WorkspaceCtx; d: Derived }
const named = (ws: WorkspaceCtx): Named => {
  const c = clean(ws) as WorkspaceCtx
  return { ws: c, d: derive(c) }
}

const pieceWhere = (n: Named, id: string | undefined): string => {
  if (!id) return ''
  const p = n.d.pieces.get(id)
  if (!p) return ''
  return `${n.d.pieceName(p) || 'untitled'} · ${KIND_NAME[kindOfPiece(p)]}`
}
const canvasWhere = (n: Named, id: string) => `${n.ws.canvases.find((c) => c.id === id)?.name ?? 'Main'} · canvas`
const cardOf = (n: Named, id: string | undefined): Card | undefined => (id ? n.d.cards.get(id) : undefined)
const cardName = (n: Named, id: string | undefined) => {
  const c = cardOf(n, id)
  return c ? `${c.type} ${q(c.title, 50)}` : 'a card'
}

// Where a changed doc is, in the workspace that has it.
function whereOf(n: Named, kind: Change['kind'], item: Record<string, unknown>): string {
  const s = (k: string) => (typeof item[k] === 'string' ? (item[k] as string) : undefined)
  if (Object.values(CARD_COLLECTION).includes(kind as never)) return pieceWhere(n, s('pieceId'))
  switch (kind) {
    case 'labels':
      return s('pieceId') === 'canvas' ? canvasWhere(n, s('canvasId') ?? 'main') : pieceWhere(n, s('pieceId'))
    case 'tasks':
      return pieceWhere(n, s('pieceId'))
    case 'cells':
      return pieceWhere(n, s('matrixId') ?? String(item.id).split('_')[0])
    case 'places':
      return pieceWhere(n, s('planeId'))
    case 'edges':
    case 'evidence':
    case 'competitorFeatures':
    case 'comparisons': {
      const card = s('fromId') ?? s('nodeId') ?? s('cardId') ?? s('competitorId') ?? s('featureId')
      return pieceWhere(n, cardOf(n, card)?.pieceId)
    }
    case 'pieces': {
      const p = n.d.pieces.get(String(item.id))
      return p ? canvasWhere(n, canvasOf(p)) : ''
    }
    case 'pieceSpots':
      return canvasWhere(n, s('canvasId') ?? 'main')
    case 'canvases':
      return 'canvases'
    case 'workspace':
      return 'the workspace'
    default:
      return ''
  }
}

const verb: Record<Change['change'], string> = { added: 'new', changed: 'changed', moved: 'moved', removed: 'deleted' }

// One changed doc in words, in the workspace that has it (after, or before for a removal).
function wordsOf(n: Named, ids: Ids | undefined, id: string, ch: Change, item: Record<string, unknown>, nb?: Named): string | null {
  const sid = (kind: Parameters<Ids['short']>[0]) => (ids && ch.change !== 'removed' ? `${ids.short(kind, id)} ` : '')
  // Spots and sizes in words: "moved", "resized" (never bare x, y, w, h).
  // In words: a link's two ends swapped "turned round", a canvas or plane by name of what it is, never a field's id.
  const fs = (ch.fields ?? []).filter((f) => !['updatedAt', 'createdAt'].includes(f))
  const turned = fs.includes('fromId') && fs.includes('toId')
  const FIELD: Record<string, string> = { canvasId: 'to another canvas', pieceId: 'to another plane', col: 'column', fromType: '', toType: '', ...(turned ? { fromId: 'turned round', toId: '' } : {}) }
  const said = [...new Set(fs.map((f) => (f === 'x' || f === 'y' ? 'moved' : f === 'w' || f === 'h' ? 'resized' : (FIELD[f] ?? f))).filter(Boolean))]
  const fields = ch.change === 'changed' && said.length ? `: ${said.slice(0, 5).join(', ')}` : ''
  const v = verb[ch.change]
  if (Object.values(CARD_COLLECTION).includes(ch.kind as never)) {
    const c = cardOf(n, id)
    return `${v} ${c?.type ?? 'card'} ${sid('card')}${q(c?.title ?? String(item.title ?? item.name ?? ''), 50)}${fields}`
  }
  switch (ch.kind) {
    case 'edges': {
      const e = item as { fromId?: string; toId?: string; kind?: string }
      return `${ch.change === 'added' ? 'new link' : ch.change === 'removed' ? 'link removed' : 'link changed'} ${e.kind ?? ''}: ${cardName(n, e.fromId)} → ${cardName(n, e.toId)}${fields}`
    }
    case 'evidence':
      return `${v} evidence on ${cardName(n, (item.nodeId ?? item.cardId) as string)}: ${q(String(item.text ?? ''), 60)}`
    case 'tasks':
      return `${v} task ${sid('task')}${q(String(item.title ?? ''), 50)}${fields}`
    case 'labels': {
      const k = kindOf(item as never)
      return `${v} ${k} ${sid('text')}${q(String(item.text ?? '').split('\n')[0], 50)}${fields}`
    }
    case 'pieces': {
      const p = n.d.pieces.get(id)
      const setup = ch.change === 'changed' && nb && ch.was ? setupWords(ch.was as never, item as never, nb.ws, n.ws) : []
      if (setup.length) return setup.join('; ')
      return `${v} ${p ? KIND_NAME[kindOfPiece(p)] : 'piece'} ${sid('piece')}${q(p ? n.d.pieceName(p) : String(item.name ?? ''), 50)}${fields}`
    }
    case 'cells': {
      const row = String(item.row ?? id.split('_')[1])
      const col = String(item.col ?? id.split('_')[2])
      const piece = n.d.pieces.get(String(item.matrixId ?? id.split('_')[0]))
      const table = piece?.kind === 'table' ? piece.table : undefined
      // A table's rows and columns by name (a card's title, a typed row's name, a column's head), never their ids.
      const rowName = (x: string) => cardOf(n, x)?.title ?? table?.rows.items.find((i) => i.id === x)?.name ?? piece?.matrix?.rows.items.find((i) => i.id === x)?.name ?? x
      const colNm = (x: string) => (table ? (table.cols.find((c: Column) => c.id === x) ? colName(table.cols.find((c: Column) => c.id === x)!) : x) : (cardOf(n, x)?.title ?? piece?.matrix?.cols.items.find((i) => i.id === x)?.name ?? x))
      const what = table ? 'table cell' : 'cell'
      return `${ch.change === 'removed' ? `${what} cleared` : what} ${q(rowName(row), 30)} × ${q(colNm(col), 30)}${item.value !== undefined ? ` = ${JSON.stringify(item.value)}` : ''}`
    }
    case 'places': {
      const p = item as { planeId?: string; cardId?: string }
      return ch.change === 'added' ? `${cardName(n, p.cardId)} also on ${pieceWhere(n, p.planeId)}` : ch.change === 'removed' ? `${cardName(n, p.cardId)} off ${pieceWhere(n, p.planeId)}` : `${cardName(n, p.cardId)} moved on ${pieceWhere(n, p.planeId)}`
    }
    case 'pieceSpots':
      return `${n.d.nameById(String(item.pieceId))} ${ch.change === 'removed' ? 'off' : 'also on'} ${canvasWhere(n, String(item.canvasId ?? 'main'))}`
    case 'competitorFeatures':
      return `${v} feature ${q(String(item.name ?? ''), 40)} of ${cardName(n, item.competitorId as string)}${fields}`
    case 'comparisons':
      return `${v} match for ${cardName(n, item.competitorId as string)}`
    case 'canvases':
      return `${v} canvas ${q(String(item.name ?? ''), 40)}${fields}`
    case 'workspace':
      return `the workspace's ${(ch.fields ?? []).join(', ')}`
    default:
      return `${v} ${ch.kind}`
  }
}

// The docs a plan writes, and the ones it makes (a whole set on a doc that wasn't there).
function writtenBy(plan: Plan, before: DocStore): { ids: string[]; made: string[] } {
  const ids = [...new Set(plan.writes.map((w) => w.id))]
  const made = new Set(Object.values(plan.ids))
  for (const w of plan.writes) if (w.set && !w.merge && !before.get(w.coll)?.has(w.id)) made.add(w.id)
  return { ids, made: [...made].filter((x) => ids.includes(x) || Object.values(plan.ids).includes(x)) }
}

// The ops that make something (their items read `+`).
const MAKES = /^(create_|link$|duplicate$|axis_add$|place_on$)/

// Plain English for the ops' own labels: "arrange 1 things" → "arrange 1 thing", "resize a documents" → "resize a
// documents list".
const plainer = (line: string) => line.replace(/\b1 things\b/g, '1 thing').replace(/\ba documents\b(?! list)/g, 'a documents list')

// A matrix's or table's setup change in words: the rows and columns that come or go (`+ column "Tourists"`, `− row
// "…"`), a table's rules (`rule: type is feature or idea`), how many rows join or leave by them.
function setupWords(was: { matrix?: MatrixSetup; table?: TableSetup }, now: { matrix?: MatrixSetup; table?: TableSetup }, wasWs: WorkspaceCtx, nowWs: WorkspaceCtx): string[] {
  const out: string[] = []
  const nameOfPlane = (v: string) => nowWs.pieces.find((p) => p.id === v)?.name ?? v
  if (was.matrix && now.matrix) {
    for (const which of ['rows', 'cols'] as const) {
      const a = entriesOf(was.matrix[which], wasWs.cards)
      const b = entriesOf(now.matrix[which], nowWs.cards)
      const one = which === 'rows' ? 'row' : 'column'
      for (const e of b) if (!a.some((x) => x.key === e.key)) out.push(`+ ${one} ${q(e.name || 'unnamed', 40)}`)
      for (const e of a) if (!b.some((x) => x.key === e.key)) out.push(`− ${one} ${q(e.name || 'unnamed', 40)}`)
    }
  }
  if (was.table && now.table) {
    for (const c of now.table.cols) if (!was.table.cols.some((x) => x.id === c.id)) out.push(`+ column ${q(colName(c), 40)}`)
    for (const c of was.table.cols) if (!now.table.cols.some((x) => x.id === c.id)) out.push(`− column ${q(colName(c), 40)}`)
    for (const i of now.table.rows.items) if (!was.table.rows.items.some((x) => x.id === i.id)) out.push(`+ row ${q(i.name ?? nowWs.cards.find((c) => c.id === i.cardId)?.title ?? 'unnamed', 40)}`)
    for (const i of was.table.rows.items) if (!now.table.rows.items.some((x) => x.id === i.id)) out.push(`− row ${q(i.name ?? wasWs.cards.find((c) => c.id === i.cardId)?.title ?? 'unnamed', 40)}`)
    if (JSON.stringify(was.table.rows.rules) !== JSON.stringify(now.table.rows.rules)) {
      const rules = now.table.rows.rules.map((r) => `${r.field} ${r.not ? 'is not' : 'is'} ${r.values.map((v) => (r.field === 'plane' ? nameOfPlane(v) : v)).join(' or ')}`)
      out.push(rules.length ? `rule: ${rules.join(' and ')}` : 'rules: none (every card)')
      const a = new Set(tableRows(was.table, wasWs.cards).map((r) => r.key))
      const b = new Set(tableRows(now.table, nowWs.cards).map((r) => r.key))
      const join = [...b].filter((k) => !a.has(k)).length
      const leave = [...a].filter((k) => !b.has(k)).length
      if (join) out.push(`${join} row${join === 1 ? '' : 's'} join`)
      if (leave) out.push(`${leave} row${leave === 1 ? '' : 's'} leave`)
    }
  }
  return out
}

// The order a doc's change is worth naming first: what the person thinks of (cards, text, tasks, pieces) before what
// comes with it (places, spots, cells).
const RANK: Partial<Record<string, number>> = { places: 5, pieceSpots: 5, cells: 3, edges: 2, evidence: 2 }

function itemsOf(groups: Group[], built: Built[], live: WorkspaceCtx, ids: Ids | undefined, keep: Map<string, ChangeItem>): ChangeItem[] {
  const items: ChangeItem[] = []
  const madeBy = new Map<string, string>()
  let ws = live
  groups.forEach((g, gi) => {
    g.steps.forEach((s, si) => {
      const plan = built[gi].plans[si]
      const before = ws
      const after = project(ws, [plan])
      const store = toDocs(before)
      const { ids: wrote, made } = writtenBy(plan, store)
      const named = strings(built[gi].args[si])
      const dependsOn = [...new Set([...named, ...wrote.filter((x) => !made.includes(x))].flatMap((x) => (madeBy.has(x) ? [madeBy.get(x)!] : [])))]
      for (const m of made) madeBy.set(m, s.item)
      const d = diff(before, after)
      const nb = namedOf(before)
      const na = namedOf(after)
      const parts = [...d.entries()]
        .sort((a, b) => (RANK[a[1].kind] ?? 1) - (RANK[b[1].kind] ?? 1))
        .map(([id, ch]) => {
          const n = ch.change === 'removed' ? nb : na
          const item = (ch.change === 'removed' ? ch.was : itemIn(after, ch.kind, id)) as Record<string, unknown> | undefined
          return item ? { words: wordsOf(n, ids, id, ch, { ...item, id }, nb), where: whereOf(n, ch.kind, { ...item, id }), kind: ch.kind, change: ch.change } : null
        })
        .filter((x): x is { words: string | null; where: string; kind: Change['kind']; change: Change['change'] } => !!x)
      // A card on another plane is said by its place ("… also on Bets · plane"), not by the planes its card now counts.
      const placed = parts.some((p) => p.kind === 'places')
      const words = parts.flatMap((p) => (p.words && !(placed && p.change === 'changed' && /: planes$/.test(p.words)) ? [p.words] : []))
      const del = DELETE_OPS.has(s.op) || plan.writes.some((w) => w.del && w.coll !== 'places' && w.coll !== 'pieceSpots')
      const was = keep.get(s.item)
      if (s.op === 'update_notes') {
        // The notes in words: how many lines come and go; the preview shows the lines themselves (`diff`).
        const lines = lineDiff(notesOf(before as never).text, notesOf(after as never).text)
        const plus = lines.filter((l) => l.sign === '+' && l.text.trim()).length
        const minus = lines.filter((l) => l.sign === '-' && l.text.trim()).length
        const said = [plus ? `+${plus} line${plus === 1 ? '' : 's'}` : '', minus ? `−${minus} line${minus === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ') || 'the same lines'
        items.push({ id: s.item, call: g.call, op: s.op, kind: 'notes', label: plan.label, line: `${plan.label}: ${said}`, where: `${NOTES_TITLE} · document`, sign: notesOf(before as never).doc ? '~' : '+', ids: wrote, made, dependsOn, delete: false, diff: lines, ...(s.why ? { why: s.why } : {}) })
        ws = after
        return
      }
      if (s.op === 'merge_cards') {
        // A merge in words (S17): what moves to the kept card, and the merged card that goes (its name struck, not the line).
        const keepId = String((built[gi].args[si] as { keep?: unknown }).keep ?? '')
        const keepCard = before.cards.find((c) => c.id === keepId)
        const goneIds = new Set(plan.writes.filter((w) => w.del && before.cards.some((c) => c.id === w.id)).map((w) => w.id))
        const gone = before.cards.filter((c) => goneIds.has(c.id))
        const sid = (id: string) => (ids ? `${ids.short('card', id)} ` : '')
        const name = (c: { id: string; title: string }) => `${sid(c.id)}"${c.title.length > 40 ? `${c.title.slice(0, 39)}…` : c.title}"`
        const moved = (coll: string) => plan.writes.filter((w) => w.coll === coll && w.patch).length
        const n = (k: number, one: string, many = `${one}s`) => (k ? [`${k} ${k === 1 ? one : many}`] : [])
        const what = [...n(moved('edges'), 'link'), ...n(moved('evidence'), 'evidence', 'evidence'), ...n(moved('tasks'), 'task'), ...n(moved('competitorFeatures'), 'competitor feature'), ...n(plan.writes.filter((w) => w.coll === 'places' && w.set).length, 'plane')]
        const goneWords = gone.map(name).join(', ')
        const line = `merge ${goneWords} into ${keepCard ? name(keepCard) : 'the kept card'}: ${what.length ? `${what.join(', ')} move` : 'nothing else to move'}; ${gone.map((c) => sid(c.id).trim() || `"${c.title}"`).join(', ')} goes`
        items.push({ id: s.item, call: g.call, op: s.op, kind: 'card', label: plan.label, line, strike: goneWords, where: (parts.find((p) => p.change === 'removed' && p.where) ?? parts.find((p) => p.where))?.where ?? was?.where ?? 'the workspace', sign: '~', ids: wrote, made, dependsOn, delete: false, ...(s.why ? { why: s.why } : {}) })
        ws = after
        return
      }
      if (s.op === 'create_document') {
        // A new document (S17): its whole text as added lines, the preview's diff (the notes' look).
        const text = String(plan.writes.find((w) => w.coll === 'docBodies')?.set?.text ?? '')
        const sum = plan.writes.find((w) => w.coll === 'documents')?.set ?? {}
        const lines: DiffLine[] = text.split('\n').map((t) => ({ sign: '+', text: t }))
        const n = lines.filter((l) => l.text.trim()).length
        items.push({ id: s.item, call: g.call, op: s.op, kind: 'document', label: plan.label, line: `${plan.label}: ${n} line${n === 1 ? '' : 's'}, ${sum.shared ? 'shared with everyone here' : 'private to you'}`, where: `${String(sum.title ?? 'a document')} · document`, sign: '+', ids: wrote, made, dependsOn, delete: false, diff: lines, ...(s.why ? { why: s.why } : {}) })
        ws = after
        return
      }
      items.push({
        id: s.item,
        call: g.call,
        op: s.op,
        kind: REGISTRY.get(s.op)?.kind ?? 'any',
        label: plan.label,
        line: plainer(`${plan.label}${words.length ? `: ${words.slice(0, 3).join('; ')}${words.length > 3 ? `; and ${words.length - 3} more` : ''}` : ' (nothing to change)'}`),
        // A card placed on another plane is listed under the plane it lands on.
        where: (parts.find((p) => p.kind === 'places' && p.change !== 'removed' && p.where) ?? parts.find((p) => p.where))?.where ?? was?.where ?? 'the workspace',
        sign: del ? '−' : MAKES.test(s.op) || (parts.length > 0 && parts.every((p) => p.change === 'added')) ? '+' : '~',
        ids: wrote,
        made,
        dependsOn,
        delete: del,
        ...(s.why ? { why: s.why } : {}),
      })
      ws = after
    })
  })
  return items
}

// Names are read off a cleaned copy (defanged), kept per snapshot.
const namedCache = new WeakMap<WorkspaceCtx, Named>()
const namedOf = (ws: WorkspaceCtx) => {
  let n = namedCache.get(ws)
  if (!n) namedCache.set(ws, (n = named(ws)))
  return n
}

// A doc's item as the snapshot holds it (for its words): by collection.
function itemIn(ws: WorkspaceCtx, kind: Change['kind'], id: string): object | undefined {
  if (Object.values(CARD_COLLECTION).includes(kind as never)) return ws.cards.find((c) => c.id === id)
  const lists: Partial<Record<Change['kind'], { id: string }[]>> = {
    labels: ws.labels,
    tasks: ws.tasks,
    pieces: ws.pieces,
    cells: ws.cells as unknown as { id: string }[],
    edges: ws.edges,
    evidence: ws.evidence,
    competitorFeatures: ws.competitorFeatures,
    comparisons: ws.comparisons,
    places: ws.places,
    pieceSpots: ws.spots,
    canvases: ws.canvases,
    threads: ws.threads,
  }
  if (kind === 'workspace') return ws.workspace
  return lists[kind]?.find((x) => x.id === id)
}

// ---- Warnings: a card titled like one already there, an empty new section.

function warningsOf(cs: Pick<Changeset, 'items'>, live: WorkspaceCtx, after: WorkspaceCtx, ids: Ids | undefined): string[] {
  const out: string[] = []
  const made = new Set(cs.items.flatMap((i) => i.made))
  const n = namedOf(after)
  for (const c of after.cards) {
    if (!made.has(c.id) || !c.title.trim()) continue
    const twin = live.cards.find((x) => x.id !== c.id && norm(x.title) === norm(c.title)) ?? after.cards.find((x) => x.id !== c.id && made.has(x.id) && x.id < c.id && norm(x.title) === norm(c.title))
    if (twin) out.push(`≈ ${ids ? `${ids.short('card', twin.id)} ` : ''}${q(namedOf(live.cards.includes(twin) ? live : after).d.cards.get(twin.id)?.title ?? twin.title, 50)} already exists (${twin.type}): link to it instead of a second card? (change with drop: [the item] to take the new one off)`)
  }
  for (const l of after.labels) {
    if (!made.has(l.id) || kindOf(l) !== 'section') continue
    const labels = after.labels.filter((x) => x.pieceId === l.pieceId)
    const others = l.pieceId === 'canvas' ? piecesShown(canvasOf(l), after.pieces, after.spots) : cardBoxes(n.d.onPlane.get(l.pieceId) ?? [])
    if (!sectionHolds(l, labels, others, labelBox(l)).length) out.push(`the new section ${ids ? `${ids.short('text', l.id)} ` : ''}${q(l.text, 40)} is empty: put things in it (arrange with where: {in_section: …}) or give it around: [ids] when making it`)
  }
  return out
}

// ---- The changeset's operations

export type AddResult = { ok: true; cs: Changeset; added: ChangeItem[]; handles: Record<string, string> } | { ok: false; errors: OpError[] }

// The steps of a new change call added (after `drop`ping items, with what depends on them). Builds every group again on
// the workspace as it is now, the new call strictly (a refusal comes back, and nothing changes), then validates every
// plan together the way apply will. Returns a new changeset; the one given is left as it was.
export function addCall(cs: Changeset, ops: ChangeOp[], c: BuildCtx & { ids?: Ids; summary?: string; drop?: string[] }): AddResult {
  let base = cs
  if (c.drop?.length) {
    const bad = c.drop.filter((d) => !cs.items.some((i) => i.id === d))
    const list = cs.items.map((i) => i.id)
    if (bad.length) return { ok: false, errors: [{ op: 'change', message: `there is no pending item ${bad.slice(0, 10).join(', ')}${bad.length > 10 ? ` (and ${bad.length - 10} more)` : ''}`, fix: `drop one of the pending items: ${list.slice(0, 20).join(', ') || 'none are pending'}${list.length > 20 ? `, … (${list.length} in all)` : ''}` }] }
  }
  let next = cs.nextItem
  const call = cs.nextCall
  const steps: Step[] = ops.map((o, i) => ({ op: o.op, args: { ...o.args, ...('handle' in o.args ? {} : { handle: `$${i + 1}` }) }, ...(o.why ? { why: o.why } : {}), item: `i${next++}`, newIds: [] }))
  const removed = new Set(c.drop?.length ? closure(cs.items, c.drop) : [])
  const groups = [...cs.groups.map((g) => ({ ...g, steps: g.steps.filter((s) => !removed.has(s.item)) })).filter((g) => g.steps.length), ...(steps.length ? [{ call, ...(c.summary ? { summary: c.summary } : {}), steps }] : [])]
  let r: Rebuilt
  try {
    r = rebuild(groups, c, steps.length > 0)
  } catch (e) {
    if (e instanceof OpsRefused) return { ok: false, errors: e.errors }
    return { ok: false, errors: [{ op: 'change', message: (e as Error).message, fix: 'read the workspace again and retry with what is there' }] }
  }
  const out = settle(cs, r, c, removed)
  const plans = out.plans
  const v = validate(plans, c.live, c.actor)
  if (!v.ok) return { ok: false, errors: v.errors }
  base = { ...out, nextItem: next, nextCall: steps.length ? call + 1 : call }
  const added = base.items.filter((i) => steps.some((s) => s.item === i.id))
  const handles: Record<string, string> = {}
  const gi = r.groups.findIndex((g) => g.call === call)
  if (gi >= 0) for (const p of r.built[gi].plans) for (const [h, id] of Object.entries(p.ids)) handles[h.replace(/#\d+$/, '')] = id
  return { ok: true, cs: { ...base, ids: { ...base.ids, ...handles } }, added, handles }
}

// The items `ids` and every item that depends on them, however far.
export function closure(items: ChangeItem[], ids: string[]): string[] {
  const out = new Set(ids)
  let grew = true
  while (grew) {
    grew = false
    for (const i of items) if (!out.has(i.id) && i.dependsOn.some((d) => out.has(d))) (out.add(i.id), (grew = true))
  }
  return [...out]
}

// A rebuild turned into the changeset it gives: plans, items (in order), warnings, what came off.
function settle(cs: Changeset, r: Rebuilt, c: BuildCtx & { ids?: Ids }, removed: Set<string>): Changeset {
  const plans = r.built.flatMap((b) => b.plans)
  const keep = new Map(cs.items.map((i) => [i.id, i]))
  const items = itemsOf(r.groups, r.built, c.live, c.ids, keep)
  const after = plans.length ? project(c.live, plans) : c.live
  const lost = [...removed, ...r.dropped.map((d) => d.step.item)].flatMap((id) => (keep.has(id) ? [keep.get(id)!] : []))
  const warnings = [...warningsOf({ items }, c.live, after, c.ids), ...r.dropped.map((d) => `${d.step.item} "${keep.get(d.step.item)?.line ?? d.step.op}" came off: it no longer works on the workspace as it is now (${inNames(d.error, c.live)})`)]
  return { ...cs, groups: r.groups, plans, items, warnings, off: [...cs.off, ...lost], version: cs.version + 1 }
}

// Unticked in the preview: the item and every item that depends on it come off; the rest is rebuilt on the workspace
// as it is now. Returns the new changeset and the items that came off.
export function untick(cs: Changeset, item: string, c: BuildCtx & { ids?: Ids }): { cs: Changeset; off: ChangeItem[] } {
  if (!cs.items.some((i) => i.id === item)) return { cs, off: [] }
  const removed = new Set(closure(cs.items, [item]))
  const groups = cs.groups.map((g) => ({ ...g, steps: g.steps.filter((s) => !removed.has(s.item)) })).filter((g) => g.steps.length)
  const r = rebuild(groups, c, false)
  const next = settle(cs, r, c, removed)
  return { cs: next, off: next.off.slice(cs.off.length) }
}

// What the agent's reads see while changes are pending: the workspace with the plans played on (loose: a doc a
// collaborator deleted meanwhile is skipped, not thrown). Kept per (snapshot, version).
const views = new WeakMap<object, { version: number; plans: Plan[]; ws: WorkspaceCtx }>()
export function viewOf<W extends WorkspaceCtx>(cs: Changeset | undefined, live: W): W {
  if (!cs || !cs.plans.length) return live
  const had = views.get(live)
  if (had && had.version === cs.version && had.plans === cs.plans) return had.ws as W
  const ws = projectLoose(live, cs.plans) as W
  views.set(live, { version: cs.version, plans: cs.plans, ws })
  return ws
}

// ---- For the preview (S15): what changed, with places and spots mapped to their card or piece.

export type PreviewChange = Change & { owner?: string; item?: string }

// diff(live, view) with each place mapped to its card and each spot to its piece (the card or piece itself marked
// `changed` with `planes` / `canvases` when nothing else of it changed), and each change tagged with the item that made it.
export function previewDiff(cs: Changeset, live: WorkspaceCtx): Map<string, PreviewChange> {
  const after = viewOf(cs, live)
  const out = new Map<string, PreviewChange>(diff(live, after))
  const byDoc = new Map<string, string>()
  for (const i of cs.items) for (const id of i.ids) if (!byDoc.has(id)) byDoc.set(id, i.id)
  for (const [id, ch] of [...out]) {
    const item = (ch.change === 'removed' ? ch.was : itemIn(after, ch.kind, id)) as Record<string, unknown> | undefined
    const owner = ch.kind === 'places' ? (item?.cardId as string | undefined) : ch.kind === 'pieceSpots' ? (item?.pieceId as string | undefined) : undefined
    out.set(id, { ...ch, ...(owner ? { owner } : {}), ...(byDoc.has(id) ? { item: byDoc.get(id) } : {}) })
    if (owner && !out.has(owner)) {
      const card = after.cards.find((c) => c.id === owner)
      const piece = after.pieces.find((p) => p.id === owner)
      if (card) out.set(owner, { kind: CARD_COLLECTION[card.type] as Change['kind'], change: 'changed', fields: ['planes'], was: live.cards.find((c) => c.id === owner) ?? card, ...(byDoc.has(id) ? { item: byDoc.get(id) } : {}) })
      else if (piece) out.set(owner, { kind: 'pieces', change: 'changed', fields: ['canvases'], was: live.pieces.find((p) => p.id === owner) ?? piece, ...(byDoc.has(id) ? { item: byDoc.get(id) } : {}) })
    }
  }
  return out
}

// ---- Accept and discard

// A short summary for the undo line: the calls' summaries, else the items' labels counted (`add a problem, 2 × add a task`).
export function summaryOf(cs: Changeset): string {
  const said = cs.groups.flatMap((g) => (g.summary ? [g.summary] : []))
  if (said.length) return cut(said.join('; '), 80)
  const counts = new Map<string, number>()
  for (const i of cs.items) counts.set(i.label, (counts.get(i.label) ?? 0) + 1)
  return cut([...counts].map(([l, n]) => (n > 1 ? `${n} × ${l}` : l)).join(', '), 80) || 'nothing'
}
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export const agentLabel = (cs: Changeset) => `agent: ${summaryOf(cs)}`

// `said`: for the person, in names (a thing's Firestore id never shows). `stale`: the workspace changed since the
// preview and some changes came off: nothing was written, the preview shows what's left.
export type Accepted =
  | { ok: true; label: string; applied: ChangeItem[]; notDone: ChangeItem[]; step: { key: string; label: string } | null; cs: Changeset }
  | { ok: false; errors: OpError[]; cs: Changeset; said: string; stale?: boolean }

// Ids in a message turned into names (a card's title, a piece's or canvas's name, a text's first words, a task's
// title); an id the workspace doesn't hold any more: "something that is gone" ("there is no card <id>": "that card is gone").
export function inNames(text: string, ws: WorkspaceCtx): string {
  const n = namedOf(ws)
  const name = (id: string): string | undefined => {
    const c = n.d.cards.get(id)
    if (c) return `${c.type} ${q(c.title, 50)}`
    const p = n.d.pieces.get(id)
    if (p) return `${KIND_NAME[kindOfPiece(p)]} ${q(n.d.pieceName(p), 50)}`
    const t = n.d.tasks.get(id)
    if (t) return `task ${q(t.title, 50)}`
    const l = n.d.labels.get(id)
    if (l) return `${kindOf(l)} ${q(l.text.split('\n')[0], 40)}`
    const k = n.ws.canvases.find((x) => x.id === id)
    if (k) return `canvas ${q(k.name, 40)}`
    return undefined
  }
  // "there is no card <id>" for an id that's gone reads "that card is gone" (S14), not "there is no card something…".
  const gone = text.replace(/\bthere is no ((?:[a-z]+ or )*[a-z]+) ([A-Za-z0-9]{20})\b/g, (m, what: string, id: string) => (name(id) ? m : `that ${what} is gone`))
  return gone.replace(/\b[A-Za-z0-9]{20}\b/g, (id) => name(id) ?? 'something that is gone')
}

// Every remaining plan written as ONE undo step, as the agent (`apply` is the env's: the browser's writes through
// src/ops/firestore.ts, the evals' in memory). `key`/`mergeAlways`: auto-apply's several applies in one turn joining one
// step (agent-turn:<chatId>:<turnId>). `rebuild`: the workspace as it is now; the plans are built again on it first
// (as untick does), and if anything comes off (a collaborator deleted what a change names) nothing is written: the
// preview goes back to the person with what's left and why, in names. On success the changeset is emptied (counters
// kept); on a refusal kept (or, stale, as rebuilt).
export async function accept(cs: Changeset, apply: (plans: Plan[], as: ApplyAs) => Promise<Applied>, o: { key?: string; mergeAlways?: boolean; rebuild?: BuildCtx & { ids?: Ids } } = {}): Promise<Accepted> {
  let cur = cs
  if (o.rebuild && cs.groups.length) {
    const r = rebuild(cs.groups, o.rebuild, false)
    cur = settle(cs, r, o.rebuild, new Set())
    const came = cur.off.slice(cs.off.length)
    if (came.length) {
      const why = r.dropped.map((d) => inNames(d.error, o.rebuild!.live))
      const said = `Not applied: the workspace changed since the preview, so ${came.length === 1 ? 'one change' : `${came.length} changes`} no longer work${came.length === 1 ? 's' : ''} and came off: ${came.map((i) => i.line).join('; ')}${why.length ? ` (${why.slice(0, 3).join('; ')})` : ''}. Look at what's left in the preview and apply again.`
      return { ok: false, stale: true, said, cs: { ...cur, warnings: [said, ...cur.warnings.filter((w) => !/came off: it no longer works/.test(w))] }, errors: came.map((i) => ({ op: i.op, message: `${i.line}: no longer works on the workspace as it is now`, fix: 'look at the preview again and apply what is left, or ask the agent to redo it' })) }
    }
  }
  const label = agentLabel(cur)
  if (!cur.plans.length) return { ok: true, label, applied: [], notDone: cur.off, step: null, cs: cleared(cur) }
  const r = await apply(cur.plans, { actor: 'agent', label, ...(o.key ? { key: o.key } : {}), ...(o.mergeAlways ? { mergeAlways: true } : {}) })
  if (!r.ok) {
    const ws = o.rebuild?.live
    const said = `Not applied: ${r.errors.map((e) => (ws ? inNames(e.message, ws) : e.message)).slice(0, 3).join('; ')}. Nothing changed.`
    return { ok: false, errors: r.errors, cs: cur, said }
  }
  const made = cur.items.flatMap((i) => i.made)
  return { ok: true, label: r.label, applied: cur.items, notDone: cur.off, step: r.step ?? null, cs: { ...cleared(cur), agentMade: [...cur.agentMade, ...made] } }
}

// Nothing pending (the counters go on, so ids are never reused in the chat; what the agent made stays known).
export const cleared = (cs: Changeset): Changeset => ({ ...emptyChangeset(), nextItem: cs.nextItem, nextCall: cs.nextCall, version: cs.version + 1, agentMade: cs.agentMade, ...(cs.auto ? { auto: cs.auto } : {}) })
export const discard = cleared

// ---- Auto-apply (agent.md §4.5's last paragraph; off until the person turns it on)

export type AgentSettings = { autoApply?: boolean }
export const AUTO_APPLY_MAX = 5

// Whether a batch may skip the preview: the setting on, ≤ 5 changes in this turn (with what it already applied), no
// delete, and it only touches the agent's own new things (what it makes now, or made earlier in the chat: `agentMade`).
export function canAutoApply(cs: Changeset, settings: AgentSettings | undefined, o: { appliedThisTurn?: number; agentMade?: Iterable<string> } = {}): boolean {
  if (!settings?.autoApply || !cs.items.length) return false
  if (cs.items.length + (o.appliedThisTurn ?? 0) > AUTO_APPLY_MAX) return false
  if (cs.items.some((i) => i.delete)) return false
  const own = new Set(o.agentMade ?? [])
  for (const i of cs.items) {
    for (const m of i.made) own.add(m)
    if (i.ids.some((id) => !own.has(id))) return false
  }
  return true
}

// Where the items are, grouped (agent.md §4.5's list: `Segments · plane: 4 new cards, 3 links`), in the order first
// touched.
export function byWhere(items: ChangeItem[]): [string, ChangeItem[]][] {
  const out = new Map<string, ChangeItem[]>()
  for (const i of items) out.set(i.where, [...(out.get(i.where) ?? []), i])
  return [...out]
}

export type { Write }
