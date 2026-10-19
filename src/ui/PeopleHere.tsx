// Who else is in this workspace right now (D-065, D-067): a chip per person, in the colour their cursor, rings and
// tags use. Clicking someone follows them: their view, and on the board their cursor, until you pan, zoom, switch
// view yourself, press Escape or click them again. While following, the page is framed in their colour.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALL } from '../data/planes'
import { usePlaneView } from '../state/plane'
import { useWsView } from '../state/workspaceView'
import { workspacePath } from '../app/paths'
import { usePresence, type Peer, type PresenceView } from '../data/presence'
import { useThemeAccent } from '../state/theme'
import styles from './PeopleHere.module.css'

const MAX = 5
// More people than this, and only their initials fit beside the account chip.
const NAMES_UP_TO = 3

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

  if (peers.length === 0) return null

  const toggle = (p: Peer) => {
    if (following === p.uid) return follow(null)
    follow(p.uid)
    if (p.view !== view) navigate(path(p.view) + (p.view === 'board' && p.plane ? `?plane=${p.plane}` : ''))
  }

  const shown = peers.slice(0, MAX)
  const more = peers.length - shown.length
  const names = peers.length <= NAMES_UP_TO
  return (
    <>
      <ul className={styles.people} aria-label={`${peers.length} more ${peers.length === 1 ? 'person' : 'people'} here`}>
        {shown.map((p) => {
          const where = p.view === 'board' && p.x === undefined ? 'board' : p.view
          const on = following === p.uid
          return (
            <li key={p.uid}>
              <button
                className={styles.person}
                style={{ ['--peer' as string]: tone(p.color) }}
                title={on ? `Following ${p.name} · click or Esc to stop` : `${p.name} · ${where} · click to follow`}
                aria-label={`${p.name}, on ${where}${on ? ', following' : ''}`}
                aria-pressed={on}
                onClick={() => toggle(p)}
              >
                <span className={styles.swatch} aria-hidden>
                  {p.photo ? <img src={p.photo} alt="" referrerPolicy="no-referrer" /> : initial(p.name)}
                </span>
                {names && <span className={styles.name}>{p.name}</span>}
              </button>
            </li>
          )
        })}
        {more > 0 && <li className={styles.more}>+{more}</li>}
      </ul>
      {leader && (
        <div className={styles.following} style={{ ['--peer' as string]: tone(leader.color) }}>
          <button className={styles.followTag} onClick={() => follow(null)}>
            following {leader.name} · {leader.view} <span className={styles.stop}>esc to stop</span>
          </button>
        </div>
      )}
    </>
  )
}

const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase()
