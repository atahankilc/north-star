// What a browser may ask of the agent on the server (D-434, docs/specs/agent-server.md §5.1), read field by field: a
// message, where the person is, who pays. Never a prompt, a tool, a model's request or a changeset: those are the
// server's own, which is what keeps it from being a free general model.
import type { WhereView } from '../../../src/agent/read/tools'

export const PAID_BY = ['workspace', 'own'] as const
export type PaidBy = (typeof PAID_BY)[number]
export const EFFORTS = ['low', 'medium', 'high'] as const

export const ASK_MAX = 20_000
const IDS_MAX = 200
const ID = /^[A-Za-z0-9_-]{1,128}$/
const MODEL = /^[A-Za-z0-9._:-]{1,100}$/
const KEY_MAX = 400

export class BadAsk extends Error {}
const bad = (what: string): never => {
  throw new BadAsk(`Bad request (${what}).`)
}

export type Ask = {
  wid: string
  chatId: string
  text: string
  view: WhereView
  paidBy: PaidBy
  model: string
  effort?: (typeof EFFORTS)[number]
  // An own key kept in the person's browser: for this run only (§6.2).
  key?: string
  // Items unticked in the open preview this message is a note on: ids, never changes.
  off?: string[]
}

const rec = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const id = (v: unknown, what: string): string => (typeof v === 'string' && ID.test(v) ? v : bad(what))
const idOrNull = (v: unknown): string | null => (typeof v === 'string' && ID.test(v) ? v : null)
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && ID.test(x)).slice(0, IDS_MAX) : [])

// Where the person is, as the model is told it: ids only, anything else dropped.
export function readView(v: unknown): WhereView {
  const o = rec(v)
  const panel = rec(o.panel)
  const side = rec(o.side)
  const [card, task] = [idOrNull(panel.card), idOrNull(panel.task)]
  const tab = idOrNull(side.tab)
  return {
    canvas: idOrNull(o.canvas) ?? 'main',
    focus: idOrNull(o.focus),
    selection: ids(o.selection),
    piece: idOrNull(o.piece),
    tasks: ids(o.tasks),
    panel: (card ? { card } : task ? { task } : null) as WhereView['panel'],
    beside: ids(o.beside),
    side: (tab ? { tab, days: side.days === true, linked: idOrNull(side.linked) } : null) as WhereView['side'],
    ...(o.arrived === false ? { arrived: false } : {}),
  }
}

export function readAsk(data: unknown): Ask {
  const o = rec(data)
  const text = typeof o.text === 'string' ? o.text.trim() : ''
  if (!text) bad('text')
  if (text.length > ASK_MAX) throw new BadAsk(`That message is too long: at most ${ASK_MAX.toLocaleString('en')} characters.`)
  const paidBy = PAID_BY.find((p) => p === o.paidBy) ?? bad('paidBy')
  if (typeof o.model !== 'string' || !MODEL.test(o.model)) bad('model')
  const effort = EFFORTS.find((e) => e === o.effort)
  const key = typeof o.key === 'string' && o.key.trim() ? o.key.trim() : undefined
  if (key && (paidBy !== 'own' || key.length > KEY_MAX)) bad('key')
  const off = ids(o.off)
  return { wid: id(o.wid, 'wid'), chatId: id(o.chatId, 'chatId'), text, view: readView(o.view), paidBy, model: o.model as string, ...(effort ? { effort } : {}), ...(key ? { key } : {}), ...(off.length ? { off } : {}) }
}

// What the person did, told to the chat's thread: a preview's outcome, or a button on the job's checklist (D-328).
export const LINES_MAX = 200
const LINE_MAX = 400
const line = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, LINE_MAX) : '')
const lines = (v: unknown) => (Array.isArray(v) ? v.map(line).filter(Boolean).slice(0, LINES_MAX) : [])

export type Told = {
  wid: string
  chatId: string
  what:
    | { kind: 'applied'; text: string; done: string[]; notDone: string[] }
    | { kind: 'discarded'; text: string; done: string[]; notDone: string[] }
    | { kind: 'undone' }
    | { kind: 'job'; act: 'all' | 'each' | 'stopAfter' | 'keepOn' | 'goOn' | 'raise' | 'drop' }
  // What a run that follows by itself (a job's next step) needs, as `Ask` has it.
  paidBy?: PaidBy
  model?: string
  effort?: (typeof EFFORTS)[number]
  key?: string
  view: WhereView
}
const ACTS = ['all', 'each', 'stopAfter', 'keepOn', 'goOn', 'raise', 'drop'] as const

export function readTold(data: unknown): Told {
  const o = rec(data)
  const w = rec(o.what)
  const act = ACTS.find((a) => a === w.act)
  const what: Told['what'] =
    w.kind === 'applied' || w.kind === 'discarded'
      ? { kind: w.kind, text: line(w.text), done: lines(w.done), notDone: lines(w.notDone) }
      : w.kind === 'undone'
        ? { kind: 'undone' }
        : w.kind === 'job' && act
          ? { kind: 'job', act }
          : bad('what')
  const paidBy = PAID_BY.find((p) => p === o.paidBy)
  const effort = EFFORTS.find((e) => e === o.effort)
  const key = typeof o.key === 'string' && o.key.trim() && o.key.length <= KEY_MAX && paidBy === 'own' ? o.key.trim() : undefined
  return {
    wid: id(o.wid, 'wid'),
    chatId: id(o.chatId, 'chatId'),
    what,
    view: readView(o.view),
    ...(paidBy ? { paidBy } : {}),
    ...(typeof o.model === 'string' && MODEL.test(o.model) ? { model: o.model } : {}),
    ...(effort ? { effort } : {}),
    ...(key ? { key } : {}),
  }
}
