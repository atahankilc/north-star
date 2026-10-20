// Who else is in this workspace right now (D-065, D-067, D-169): a square per person, in the colour their cursor, rings
// and tags use, no names; the squares overlap, the name and where they are show on hover, and past MAX a `+N` opens the
// list of everyone. A click follows them, totally (D-191, collab.tsx): their space, their cursor, their selection; a
// second click, Escape, or a pan or zoom of your own stops it. While following, the page is framed in their colour.
import { useEffect, useRef, useState } from 'react'
import { usePresence, type Peer } from '../data/presence'
import { useThemeAccent } from '../state/theme'
import { useWs } from '../views/workspace/context'
import styles from './PeopleHere.module.css'

// Squares shown before `+N`.
const MAX = 4

export function PeopleHere() {
  const peers = usePresence((s) => s.peers)
  const following = usePresence((s) => s.following)
  const follow = usePresence((s) => s.follow)
  const leader = peers.find((p) => p.uid === following)
  const tone = useThemeAccent()
  const { pieces } = useWs()
  // Where someone is: the canvas, or the plane they have in focus.
  const where = (p: Peer) => (p.plane ? `in ${pieces.find((x) => x.id === p.plane)?.name || 'a plane'}` : 'on the canvas')
  const toggle = (p: Peer) => {
    setListOpen(false)
    follow(following === p.uid ? null : p.uid)
  }
  // Escape stops following, before anything else hears it.
  useEffect(() => {
    if (!following) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      follow(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [following, follow])

  const [listOpen, setListOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  // The list closes on a click outside it or Escape (before Escape stops following).
  useEffect(() => {
    if (!listOpen) return
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setListOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setListOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [listOpen])
  useEffect(() => {
    if (peers.length <= MAX) setListOpen(false)
  }, [peers.length])

  if (peers.length === 0) return null

  const shown = peers.length <= MAX ? peers : peers.slice(0, MAX - 1)
  const more = peers.length - shown.length
  return (
    <div ref={root} className={styles.root}>
      <ul className={`${styles.people} ${styles.stack}`} aria-label={`${peers.length} more ${peers.length === 1 ? 'person' : 'people'} here`}>
        {shown.map((p) => {
          const on = following === p.uid
          return (
            <li key={p.uid}>
              <button
                className={styles.person}
                style={{ ['--peer' as string]: tone(p.color) }}
                aria-label={`${p.name}, ${where(p)}${on ? ', following' : ''}`}
                aria-pressed={on}
                onClick={() => toggle(p)}
              >
                <Swatch p={p} />
                <span className={styles.tip} aria-hidden>
                  {p.name} <span className={styles.where}>· {on ? 'esc to stop' : where(p)}</span>
                </span>
              </button>
            </li>
          )
        })}
        {more > 0 && (
          <li>
            <button
              className={styles.more}
              aria-expanded={listOpen}
              aria-label={`${more} more · everyone here`}
              onClick={() => setListOpen((o) => !o)}
            >
              +{more}
            </button>
          </li>
        )}
      </ul>
      {listOpen && (
        <ul className={styles.list} aria-label="Everyone here">
          {peers.map((p) => (
            <li key={p.uid}>
              <button className={styles.row} style={{ ['--peer' as string]: tone(p.color) }} aria-pressed={following === p.uid} onClick={() => toggle(p)}>
                <Swatch p={p} />
                <span className={styles.rowName}>{p.name}</span>
                <span className={styles.where}>{following === p.uid ? 'following' : where(p)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {leader && (
        <div className={styles.following} style={{ ['--peer' as string]: tone(leader.color) }}>
          <button className={styles.followTag} onClick={() => follow(null)}>
            following {leader.name} · {where(leader)} <span className={styles.stop}>esc to stop</span>
          </button>
        </div>
      )}
    </div>
  )
}

const Swatch = ({ p }: { p: Peer }) => (
  <span className={styles.swatch} aria-hidden>
    {p.photo ? <img src={p.photo} alt="" referrerPolicy="no-referrer" /> : initial(p.name)}
  </span>
)

const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase()
