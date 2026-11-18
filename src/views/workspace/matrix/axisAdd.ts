// What's typed to add to an axis, and what it offers (D-216; D-403: the setup's pill and the matrix's own dashed card
// each had it, and only the pill had the arrow keys). Typed, the name as typed comes first (where names are taken),
// then the cards whose title holds it, the axis's own type first, six at most; the arrows move through them, Enter
// takes the lit one (the name, until an arrow moved it). `whenEmpty`: focused with nothing typed, the axis's type's
// cards not on it yet are offered.
import { useState, type KeyboardEvent } from 'react'
import type { Card, CardType } from '../../../data/cards'
import { useWs } from '../canvas/context'
import { NAME_MAX } from '../../../data/matrix'

export type AxisOption = { name: string } | { card: Card }
export const axisKey = (o: AxisOption) => ('card' in o ? o.card.id : '+name')

type Opts = { taken: (cardId: string) => boolean; prefer?: CardType; names: boolean; whenEmpty?: boolean }

export function useAxisAdd({ taken, prefer, names, whenEmpty = false }: Opts) {
  const { cards } = useWs()
  const [q, setTyped] = useState('')
  const [lit, setLit] = useState(0)
  const query = q.trim().toLowerCase()
  const free = cards.filter((c) => !taken(c.id))
  const matches = (query ? free.filter((c) => c.title.toLowerCase().includes(query)) : whenEmpty ? free.filter((c) => c.type === prefer) : [])
    .sort((a, b) => Number(b.type === prefer) - Number(a.type === prefer))
    .slice(0, 6)
  const options: AxisOption[] = [...(query && names ? [{ name: q.trim().slice(0, NAME_MAX) }] : []), ...matches.map((card) => ({ card }))]
  const setQ = (v: string) => {
    setTyped(v)
    setLit(0)
  }
  // The arrows and Enter, from the field's own keydown; true when the key was one of them.
  const onKey = (e: KeyboardEvent, take: (o: AxisOption) => void): boolean => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = options.length
      if (n) setLit((lit + (e.key === 'ArrowDown' ? 1 : n - 1)) % n)
      return true
    }
    if (e.key === 'Enter') {
      if (options[lit]) take(options[lit])
      return true
    }
    return false
  }
  return { q, setQ, query, options, lit, setLit, onKey, point: (key: string) => setLit(Math.max(0, options.findIndex((o) => axisKey(o) === key))) }
}
