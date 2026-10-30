// The agent column's entries as a saved chat keeps them, and back (S16, D-312; src/agent/chats.ts' SavedTurn): the
// person's asks, the agent's answers with their steps as labels (never a tool's result), a preview's change list (its
// ticked lines with where they were, and what became of it), the status line after it, notes. Types only from the
// store, so this runs without the browser.
import { NO_USAGE, type TurnEnd } from '../contract'
import type { SavedTurn } from '../chats'
import type { ChangeLine, Entry } from './agentStore'

let n = 0
const entryAt = new Map<string, number>()
const atOf = (id: string) => {
  let t = entryAt.get(id)
  if (!t) entryAt.set(id, (t = Date.now()))
  return t
}

// The column's entries as kept turns (what's still running is left for the next save).
export function turnsOf(entries: Entry[]): SavedTurn[] {
  return entries.flatMap((e): SavedTurn[] => {
    const at = atOf(e.id)
    switch (e.kind) {
      case 'user':
        return [{ role: 'user', text: e.text, at }]
      case 'agent':
        if (e.running) return []
        return [{ role: 'agent', text: e.text, at, steps: e.steps.filter((x) => !x.say).map((x) => ({ label: x.label, ...(x.ms !== undefined ? { ms: x.ms } : {}), ...(x.ok === false ? { ok: false } : {}) })), usage: { input: e.usage.input, output: e.usage.output }, ...(e.ms !== undefined ? { ms: e.ms } : {}), ...(e.end ? { end: e.end } : {}), model: e.model, ...(e.error ? { text: e.text || `! ${e.error}` } : {}) }]
      case 'changes': {
        const on = e.items.filter((i) => i.on)
        return [{ role: 'changes', text: on.map((i) => `${i.sign} ${i.where}\t${i.line}`).join('\n'), at, applied: { state: e.state === 'pending' || e.state === 'applying' || e.state === 'revising' || e.state === 'unapplied' ? 'not applied' : e.state, count: on.length } }]
      }
      case 'report':
        return [{ role: 'report', text: e.report.text, at, applied: { state: e.report.undone ? 'undone' : 'applied', count: e.count } }]
      case 'note':
        return [{ role: 'note', text: e.text, at }]
    }
  })
}

// Kept turns back as the column's entries.
export function entriesOf(turns: SavedTurn[]): Entry[] {
  return turns.map((t, i): Entry => {
    const id = `r${Date.now().toString(36)}${(++n).toString(36)}-${i}`
    entryAt.set(id, t.at)
    switch (t.role) {
      case 'user':
        return { id, kind: 'user', text: t.text }
      case 'agent':
        return { id, kind: 'agent', text: t.text, live: '', steps: (t.steps ?? []).map((x, j) => ({ id: `${id}-${j}`, label: x.label, running: false, ...(x.ok === false ? { ok: false } : { ok: true }), ...(x.ms !== undefined ? { ms: x.ms } : {}) })), usage: { ...NO_USAGE, ...(t.usage ?? {}) }, running: false, ...(t.ms !== undefined ? { ms: t.ms } : {}), ...(t.end ? { end: t.end as TurnEnd } : {}), model: t.model ?? '' }
      case 'changes': {
        const items: ChangeLine[] = t.text
          .split('\n')
          .filter(Boolean)
          .map((l, j) => {
            const sign = (l[0] === '+' || l[0] === '−' ? l[0] : '~') as ChangeLine['sign']
            const [where, line] = l.slice(2).split('\t')
            return { id: `${id}-${j}`, line: line ?? where, where: line === undefined ? '' : where, delete: sign === '−', on: true, kind: '', op: '', sign }
          })
        // A preview still open when the chat was saved comes back as "not applied" (nothing was written).
        const state = (['applied', 'undone', 'discarded'].includes(t.applied?.state ?? '') ? t.applied!.state : 'unapplied') as 'applied' | 'undone' | 'discarded' | 'unapplied'
        return { id, kind: 'changes', items, warnings: [], state }
      }
      case 'report':
        return { id, kind: 'report', report: { text: t.text, done: [], notDone: [], step: null, ...(t.applied?.state === 'undone' ? { undone: true } : {}) }, wheres: [], count: t.applied?.count ?? 0 }
      default:
        return { id, kind: 'note', text: t.text }
    }
  })
}

