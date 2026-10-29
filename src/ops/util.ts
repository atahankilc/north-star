// What the entity ops (S4+) share: looking things up in the snapshot (refusing, with a fix, what isn't there), the undo
// labels' words, and turning a card's fields into its doc's.
import { CARD_COLLECTION, titleField, type AnyType, type Card } from '../model/cards'
import { DELETE, OpsRefused, type Coll, type OpCtx, type Write } from './types'

export function refuse(op: string, message: string, fix: string): never {
  throw new OpsRefused([{ op, message, fix }])
}

// A word with its article: `an idea`, `a feature`.
export const a = (word: string) => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`
// For undo's labels: `an idea`, `a feature`.
export const one = (type: AnyType) => a(type)
export const plural = (n: number) => (n === 1 ? 'a card' : `${n} cards`)

export const cardColl = (type: AnyType) => CARD_COLLECTION[type] as Coll

export function cardIn(ctx: OpCtx, op: string, id: unknown): Card {
  const c = typeof id === 'string' ? ctx.ws.cards.find((x) => x.id === id) : undefined
  if (!c) refuse(op, `there is no card ${String(id)}`, 'use the id of an existing card (search for it), or a $handle made earlier in the batch')
  return c
}

export function find<T extends { id: string }>(list: T[], op: string, id: unknown, what: string): T {
  const x = typeof id === 'string' ? list.find((y) => y.id === id) : undefined
  if (!x) refuse(op, `there is no ${what} ${String(id)}`, `use the id of an existing ${what}`)
  return x
}

// A card's fields as its doc holds them: `notes` is a competitor's `notes`, any other card's `body`. In a patch an
// `undefined` or `null` takes the field away; in a new doc it's left out.
export function cardData(type: AnyType, fields: Record<string, unknown> | undefined, patch: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields ?? {})) {
    if (k === 'title' || k === 'name') continue
    const key = k === 'notes' && type !== 'competitor' ? 'body' : k
    if (v === undefined || v === null) {
      if (patch) out[key] = DELETE
    } else out[key] = v
  }
  return out
}

export { titleField }

// Writes, each doc once (a doc deleted twice would be refused: it isn't there the second time).
export function once(writes: Write[]): Write[] {
  const seen = new Set<string>()
  return writes.filter((w) => {
    const k = `${w.coll}/${w.id}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export const handleOf = (args: { handle?: string }, fallback = '$new') => args.handle ?? fallback
