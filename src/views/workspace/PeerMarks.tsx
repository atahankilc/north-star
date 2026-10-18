// What collaborators have selected, outside the board (D-068): in Flow, Table and Matrix an item (or matrix cell)
// someone has open gets a ring in their colour per person, and their names as small tags. Only selection is shown,
// never edits in progress (D-071).
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { usePresence, type Peer } from '../../data/presence'
import { themeAccent, useTheme } from '../../state/theme'
import { MARK_SIGN, MARK_VAR, type Mark } from './preview'
import { markHover, useMarkOf } from './stage'
import styles from './PeerMarks.module.css'

// Everyone who has `id` selected, stable between renders while that doesn't change. Colours come in the current
// theme's shade (D-069), so everything below can use `p.color` as is.
export function usePeersOn(id: string): Peer[] {
  const peers = usePresence(useShallow((s) => s.peers.filter((p) => p.sel === id)))
  const theme = useTheme((s) => s.theme)
  return useMemo(() => peers.map((p) => ({ ...p, color: themeAccent(p.color, theme) })), [peers, theme])
}

// Rings around an element, one per person, with a dark gap between: for `box-shadow`.
export function peerRings(peers: Peer[], inset = false): string | undefined {
  if (peers.length === 0) return undefined
  const i = inset ? 'inset ' : ''
  return peers.flatMap((p, n) => [`${i}0 0 0 ${n * 3 + 1}px var(--bg)`, `${i}0 0 0 ${n * 3 + 3}px ${p.color}`]).join(', ')
}

type Props = { peers: Peer[]; className?: string; max?: number }

export function PeerTags({ peers, className, max = 3 }: Props) {
  if (peers.length === 0) return null
  const shown = peers.slice(0, max)
  const more = peers.length - shown.length
  return (
    <span className={`${styles.tags} ${className ?? ''}`} title={peers.map((p) => p.name).join(', ')}>
      {shown.map((p) => (
        <span key={p.uid} className={styles.tag} style={{ ['--peer' as string]: p.color }}>
          {p.name}
        </span>
      ))}
      {more > 0 && <span className={styles.more}>+{more}</span>}
    </span>
  )
}

// The tags for one item, for places that render items in a loop (hooks can't go in the loop).
export function PeersOn({ id, className, max }: { id: string; className?: string; max?: number }) {
  return <PeerTags peers={usePeersOn(id)} className={className} max={max} />
}

// A table row's marker: a bar in each person's colour down its left edge, and their names. Needs a positioned cell.
export function RowPeers({ id }: { id: string }) {
  const peers = usePeersOn(id)
  if (peers.length === 0) return null
  const stops = peers.map((p, i) => `${p.color} ${(i / peers.length) * 100}% ${((i + 1) / peers.length) * 100}%`).join(', ')
  return (
    <>
      <span className={styles.bar} style={{ background: `linear-gradient(${stops})` }} aria-hidden />
      <PeerTags peers={peers} />
    </>
  )
}

// A matrix cell someone has selected: rings inside it and the first name in its corner.
export function CellPeers({ id }: { id: string }) {
  const peers = usePeersOn(id)
  if (peers.length === 0) return null
  return (
    <>
      <span className={styles.cellRings} style={{ boxShadow: peerRings(peers, true) }} aria-hidden />
      <PeerTags peers={peers} max={1} className={styles.cellTags} />
    </>
  )
}

// The assistant's preview (D-087, D-096): what a change does, as the checklist's diff sign in a diff colour. Filled while
// its checklist row is lit (hovered in the chat, or the stepper's step).
export function MarkSign({ mark, lit, className }: { mark: Mark; lit?: boolean; className?: string }) {
  return (
    <span className={`${styles.mark} ${className ?? ''}`} data-lit={lit || undefined} style={{ ['--mark' as string]: MARK_VAR[mark] }} title={mark}>
      {MARK_SIGN[mark]}
    </span>
  )
}

// The same for one item, for places that render items in a loop.
export function MarkOn({ id, className }: { id: string; className?: string }) {
  const { mark, lit } = useMarkOf(id)
  return mark ? <MarkSign mark={mark} lit={lit} className={className} /> : null
}

// A ring in the mark's colour, for `box-shadow` (thicker while lit).
export const markRing = (mark: Mark | undefined, lit = false, inset = false) =>
  mark ? `${inset ? 'inset ' : ''}0 0 0 ${lit ? 3 : 1}px ${MARK_VAR[mark]}` : undefined

// What an edit replaced, in a few words: tags as #chips, nothing as "—".
export function shownValue(v: unknown): string {
  if (Array.isArray(v)) return v.length ? v.map((t) => `#${t}`).join(' ') : '—'
  if (v === undefined || v === null || v === '') return '—'
  const t = String(v).replace(/\s+/g, ' ').trim()
  return t.length > 80 ? `${t.slice(0, 79)}…` : t
}

// The old value under the new one, struck through (D-096). Nothing when `field` wasn't changed.
export function Was({ before, field, className }: { before: Record<string, unknown> | undefined; field: string | string[]; className?: string }) {
  const key = (Array.isArray(field) ? field : [field]).find((f) => before && f in before)
  if (!before || !key) return null
  return (
    <span className={`${styles.was} ${className ?? ''}`}>
      <span className={styles.wasLabel}>was</span> <s>{shownValue(before[key])}</s>
    </span>
  )
}

// Hover handlers that light the item's checklist row, only for marked items.
export const markHoverOf = (id: string, mark: Mark | undefined) => (mark ? markHover(id) : {})
