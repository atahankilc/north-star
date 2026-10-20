// A card's planes in its panel (D-139): every plane it's on (click to see it there), `place on ▾` another, and on a plane
// other than All, `take off this plane`.
import { useNavigate } from 'react-router-dom'
import { workspacePath } from '../../app/paths'
import { ALL, place } from '../../data/planes'
import { usePlaneView } from '../../state/plane'
import { useWsView } from '../../state/workspaceView'
import { Menu } from '../../ui/Menu'
import { useWs } from '../workspace/context'
import { unplaceCards } from '../workspace/useEditKeys'
import { useViewer } from '../workspace/viewerLock'
import type { BoardItem } from './boardKinds'
import { findFreeSpot } from './cardLayout'
import styles from './CardPlanes.module.css'

export function CardPlanes({ item }: { item: Pick<BoardItem, 'id' | 'type'> }) {
  const ws = useWs()
  const open = usePlaneView((s) => s.plane)
  const viewer = useViewer((s) => s.viewer)
  const navigate = useNavigate()
  if (!ws.planes.length) return null
  const planes = [...ws.planes].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
  const on = new Set(ws.placements.filter((p) => p.itemId === item.id).map((p) => p.planeId))
  const see = (planeId: string) => {
    useWsView.getState().setPlane(planeId)
    navigate(`${workspacePath(ws.wid)}?${planeId === ALL ? '' : `plane=${planeId}&`}item=${item.id}`)
  }
  // Clear of the cards already there, near the middle of them.
  const placeOn = (planeId: string) => {
    const there = ws.placements.filter((p) => p.planeId === planeId)
    const mid: [number, number] = there.length
      ? [there.reduce((n, p) => n + p.x, 0) / there.length, there.reduce((n, p) => n + p.y, 0) / there.length]
      : [0, 0]
    const [x, y] = findFreeSpot(mid, there)
    void place(ws.wid, planeId, [{ id: item.id, type: item.type, x, y }])
  }
  const others = planes.filter((p) => !on.has(p.id))

  return (
    <div className={styles.row}>
      <span className={styles.label}>planes</span>
      <span className={styles.list}>
        {[{ id: ALL, name: 'All' }, ...planes.filter((p) => on.has(p.id))].map((p) => (
          <button key={p.id} className={styles.plane} data-open={p.id === open} onClick={() => see(p.id)} title={`See it on ${p.name}`}>
            {p.name}
          </button>
        ))}
        {!viewer && others.length > 0 && (
          <Menu
            label="place on"
            items={others.map((p) => ({ key: p.id, label: p.name, glyph: '+', onSelect: () => placeOn(p.id) }))}
            ariaLabel="Place this card on another plane"
          />
        )}
        {!viewer && open !== ALL && on.has(open) && (
          <button className={styles.small} onClick={() => unplaceCards(ws, open, [item.id])}>
            take off this plane
          </button>
        )}
      </span>
    </div>
  )
}
