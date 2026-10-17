// What collaborators have selected, outside the board (D-068): in Flow, Table and Matrix an item (or matrix cell)
// someone has open gets a ring in their colour per person, and their names as small tags. Only selection is shown,
// not edits in progress (the side panel's PeersHere strip covers typing).
import { useShallow } from 'zustand/react/shallow'
import { usePresence, type Peer } from '../../data/presence'
import styles from './PeerMarks.module.css'

// Everyone who has `id` selected (or is typing in it), stable between renders while that doesn't change.
export function usePeersOn(id: string): Peer[] {
  return usePresence(useShallow((s) => s.peers.filter((p) => p.sel === id || p.edit === id)))
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
