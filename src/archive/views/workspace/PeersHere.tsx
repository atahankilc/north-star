// Inside an item's side panel: who else has this item open (D-067). What they type isn't shown; the last write wins
// per field, which is enough (D-071).
import { hasSelected, usePresence } from '../../data/presence'
import { useTheme, themeAccent } from '../../state/theme'
import styles from './PeersHere.module.css'

export function PeersHere({ itemId }: { itemId: string }) {
  const peers = usePresence((s) => s.peers)
  const here = peers.filter((p) => hasSelected(p, itemId))
  const theme = useTheme((s) => s.theme)

  return (
    <div className={styles.here} aria-live="polite" hidden={here.length === 0}>
      {here.map((p) => (
        <span key={p.uid} className={styles.peer} style={{ ['--peer' as string]: themeAccent(p.color, theme) }}>
          {p.name} is here
        </span>
      ))}
    </div>
  )
}
