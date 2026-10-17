// Who else is in this workspace right now (D-065): a square per person in their colour, beside the account chip.
// Clicking someone glides to their cursor on the board, or opens the view they're on.
import { useNavigate } from 'react-router-dom'
import { usePresence, type Peer } from '../data/presence'
import { useCanvas } from '../state/canvasStore'
import styles from './PeopleHere.module.css'

const MAX = 5

type Props = { wid: string; onBoard: boolean }

export function PeopleHere({ wid, onBoard }: Props) {
  const peers = usePresence((s) => s.peers)
  const navigate = useNavigate()
  if (peers.length === 0) return null

  const go = (p: Peer) => {
    if (p.view === 'board' && onBoard && p.x !== undefined && p.y !== undefined) useCanvas.getState().flyTo([p.x, p.y])
    else navigate(p.view === 'board' ? `/w/${wid}` : `/w/${wid}/${p.view}`)
  }

  const shown = peers.slice(0, MAX)
  const more = peers.length - shown.length
  return (
    <ul className={styles.people} aria-label={`${peers.length} more ${peers.length === 1 ? 'person' : 'people'} here`}>
      {shown.map((p) => {
        const where = p.view === 'board' && p.x === undefined ? 'board' : p.view
        return (
          <li key={p.uid}>
            <button
              className={styles.person}
              style={{ ['--peer' as string]: p.color }}
              title={`${p.name} · ${where}`}
              aria-label={`${p.name}, on ${where}`}
              onClick={() => go(p)}
            >
              {p.photo ? <img src={p.photo} alt="" referrerPolicy="no-referrer" /> : initial(p.name)}
            </button>
          </li>
        )
      })}
      {more > 0 && <li className={styles.more}>+{more}</li>}
    </ul>
  )
}

const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase()
