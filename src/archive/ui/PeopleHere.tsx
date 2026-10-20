// Who else is in this workspace right now (D-065, D-067, D-169): a square per person, in the colour their cursor, rings
// and tags use, no names; the squares overlap, the name shows on hover, and past MAX a `+N` opens the list of everyone. Clicking someone follows them: their view, and on the board their cursor, until you pan, zoom, switch
// view yourself, press Escape or click them again. What they select is selected for you too, so their side panel opens
// on your screen (D-170); a click of your own holds until they pick something else. While following, the page is framed in their colour.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALL } from '../data/planes'
import { usePlaneView } from '../state/plane'
import { useWsView } from '../state/workspaceView'
import { workspacePath } from '../app/paths'
import { selectionOf, usePresence, type Peer, type PresenceView } from '../data/presence'
import { useCanvas } from '../state/canvasStore'
import { useThemeAccent } from '../state/theme'
import styles from './PeopleHere.module.css'

// Squares shown before `+N`.
const MAX = 4

type Props = { wid: string; view: PresenceView }

export function PeopleHere({ wid, view }: Props) {
  const peers = usePresence((s) => s.peers)
  const following = usePresence((s) => s.following)
  const follow = usePresence((s) => s.follow)
  const tone = useThemeAccent()
  const leader = peers.find((p) => p.uid === following)
  const navigate = useNavigate()
  const path = (v: PresenceView) => workspacePath(wid, v)

  // Go where they go.
  useEffect(() => {
    if (leader && leader.view !== view) navigate(path(leader.view))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leader?.view])
  // And to the plane they're on (D-139).
  const plane = usePlaneView((s) => s.plane)
  useEffect(() => {
    if (!leader || leader.view !== 'board' || view !== 'board') return
    const theirs = leader.plane ?? ALL
    if (theirs === plane) return
    useWsView.getState().setPlane(theirs)
    navigate(theirs === ALL ? path('board') : `${path('board')}?plane=${theirs}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leader?.plane, leader?.view])
  // Their selection becomes yours (D-170), once you're on their view. Not in the matrix (a cell there is its own
  // selection) or reports (the open report is in the address).
  const theirs = leader && leader.view === view && view !== 'matrix' && view !== 'reports' ? selectionOf(leader).join(' ') : null
  useEffect(() => {
    if (theirs === null) return
    const [sel, ...more] = theirs ? theirs.split(' ') : []
    const { select, selectMany } = useCanvas.getState()
    // The panel shows the last one picked: theirs.
    if (more.length) selectMany([...more, sel])
    else select(sel ?? null)
  }, [theirs])
  // Switching view yourself stops following.
  useEffect(() => {
    const { following, peers } = usePresence.getState()
    const p = peers.find((x) => x.uid === following)
    if (p && p.view !== view) follow(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])
  useEffect(() => {
    if (!following) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && follow(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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

  const toggle = (p: Peer) => {
    setListOpen(false)
    if (following === p.uid) return follow(null)
    follow(p.uid)
    if (p.view !== view) navigate(path(p.view) + (p.view === 'board' && p.plane ? `?plane=${p.plane}` : ''))
  }

  // Whoever you follow stays among the squares even when they'd be in the `+N`.
  const lead = peers.findIndex((p) => p.uid === following)
  const shown = peers.length <= MAX ? peers : lead >= MAX - 1 ? [...peers.slice(0, MAX - 2), peers[lead]] : peers.slice(0, MAX - 1)
  const more = peers.length - shown.length
  const label = (p: Peer, on: boolean) => `${p.name}, on ${p.view}${on ? ', following' : ''}`
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
                aria-label={label(p, on)}
                aria-pressed={on}
                onClick={() => toggle(p)}
              >
                <Swatch p={p} />
                <span className={styles.tip} aria-hidden>
                  {p.name} <span className={styles.where}>· {on ? 'esc to stop' : p.view}</span>
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
          {peers.map((p) => {
            const on = following === p.uid
            return (
              <li key={p.uid}>
                <button
                  className={styles.row}
                  style={{ ['--peer' as string]: tone(p.color) }}
                  aria-label={label(p, on)}
                  aria-pressed={on}
                  onClick={() => toggle(p)}
                >
                  <Swatch p={p} />
                  <span className={styles.rowName}>{p.name}</span>
                  <span className={styles.where}>{on ? 'following' : p.view}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {leader && (
        <div className={styles.following} style={{ ['--peer' as string]: tone(leader.color) }}>
          <button className={styles.followTag} onClick={() => follow(null)}>
            following {leader.name} · {leader.view} <span className={styles.stop}>esc to stop</span>
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
