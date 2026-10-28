// Rows made again from the same things are the rows from before: a matrix's heads and a table's rows built again
// because some card changed keep their objects while their own card, name and the rest are the same, and the list stays
// the same list while every row does. What's memoised on them (cells, heads, rows) then draws only what changed.
import { isValidElement, useRef } from 'react'

// The same fields with the same values (a list compared item by item).
function alike(a: object, b: object) {
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((k) => {
    const x = (a as Record<string, unknown>)[k]
    const y = (b as Record<string, unknown>)[k]
    if (x === y) return true
    return Array.isArray(x) && Array.isArray(y) && x.length === y.length && x.every((v, i) => v === y[i])
  })
}

export function useKept<T extends { key: string }>(list: T[]): T[] {
  const kept = useRef(list)
  const was = kept.current
  if (was === list) return was
  const old = new Map(was.map((e) => [e.key, e]))
  let same = was.length === list.length
  const next = list.map((e, i) => {
    const o = old.get(e.key)
    const keep = o && alike(o, e) ? o : e
    if (keep !== was[i]) same = false
    return keep
  })
  kept.current = same ? was : next
  return kept.current
}

// For a memo whose handlers only read a ref (so two of them do the same): props alike when everything but the handlers
// holds the same, lists, plain objects and an element's props compared by what's in them, `depth` levels down.
export function alikeProps(a: object, b: object, depth = 3): boolean {
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((k) => similar((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], depth))
}

function similar(x: unknown, y: unknown, depth: number): boolean {
  if (x === y) return true
  if (typeof x === 'function' && typeof y === 'function') return true
  if (!depth || !x || !y || typeof x !== 'object' || typeof y !== 'object') return false
  if (isValidElement(x) || isValidElement(y)) return isValidElement(x) && isValidElement(y) && x.type === y.type && x.key === y.key && alikeProps(x.props as object, y.props as object, depth - 1)
  if (Array.isArray(x)) return Array.isArray(y) && x.length === y.length && x.every((v, i) => similar(v, y[i], depth - 1))
  if (Object.getPrototypeOf(x) !== Object.prototype || Object.getPrototypeOf(y) !== Object.prototype) return false
  return alikeProps(x, y, depth - 1)
}
