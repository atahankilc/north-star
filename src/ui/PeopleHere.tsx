// Who else is in this workspace right now (D-065, D-067, D-169): a square per person, in the colour their cursor, rings
// and tags use, no names; the squares overlap, the name shows on hover, and past MAX a `+N` opens the list of everyone.
// Following someone (D-067, D-170) is archived with the views (D-177): it comes back once the canvas has cursors.
import { useEffect, useRef, useState } from 'react'
import { usePresence, type Peer } from '../data/presence'
import { useThemeAccent } from '../state/theme'
import styles from './PeopleHere.module.css'

// Squares shown before `+N`.
const MAX = 4

export function PeopleHere() {
  const peers = usePresence((s) => s.peers)
  const tone = useThemeAccent()

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
        {shown.map((p) => (
          <li key={p.uid}>
            <span className={styles.person} style={{ ['--peer' as string]: tone(p.color) }} aria-label={p.name} tabIndex={0}>
              <Swatch p={p} />
              <span className={styles.tip} aria-hidden>
                {p.name}
              </span>
            </span>
          </li>
        ))}
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
              <span className={styles.row} style={{ ['--peer' as string]: tone(p.color) }}>
                <Swatch p={p} />
                <span className={styles.rowName}>{p.name}</span>
              </span>
            </li>
          ))}
        </ul>
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
