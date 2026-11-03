// A filter menu's rows (D-233, D-256; D-361: the plane's and the deck's filters had each written them): an `any` row
// first (none picked), then one tick row per value; picking one adds or takes it away.
import type { PromptEntry } from '../../../ui/foundation/promptModel'

export const flip = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

// What a menu's trigger says: `any`, the one picked, or how many.
export const named = <T,>(list: T[], name: (v: T) => string) => (list.length === 0 ? 'any' : list.length === 1 ? name(list[0]) : `${list.length}`)

type Row<T> = { key: T; label: string; hint?: string; tone?: string }
export function pickRows<T extends string>(picked: T[], any: string, rows: Row<T>[], onSet: (next: T[]) => void): PromptEntry[] {
  return [
    { key: 'any', label: any, checked: picked.length === 0, onSelect: () => onSet([]) },
    ...rows.map((r) => ({ key: r.key, label: r.label, checked: picked.includes(r.key), hint: r.hint, tone: r.tone, onSelect: () => onSet(flip(picked, r.key)) })),
  ]
}
