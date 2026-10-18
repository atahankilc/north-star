// A package's panel rows (D-141): rated like a feature (impact, effort, confidence from what it holds), and its members,
// with its home plane to open.
import { useNavigate } from 'react-router-dom'
import { workspacePath } from '../../app/paths'
import type { WithId } from '../../data/hooks'
import { FEATURE_EFFORTS, FEATURE_IMPACTS, type Package } from '../../data/model'
import { updateNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { Choice } from '../../ui/Choice'
import { BOARD_KINDS, TYPE_ACCENT, type BoardItem } from '../canvas/boardKinds'
import { packageConfidence } from '../priorities/reading'
import { Sure } from '../priorities/Sure'
import { useWs } from './context'
import styles from './PackageFields.module.css'

// Its members that still exist, in chain order (D-045).
export function membersOf(pkg: { memberIds: string[] }, items: BoardItem[]): BoardItem[] {
  const order = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package']
  const byId = new Map(items.map((i) => [i.id, i]))
  return pkg.memberIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
}

export function PackageFields({ pkg, items }: { pkg: WithId<Package>; items: BoardItem[] }) {
  const ws = useWs()
  const navigate = useNavigate()
  const set = (fields: Partial<Package>) => void updateNode(ws.wid, 'package', pkg.id, fields)
  const members = membersOf(pkg, items)
  const c = packageConfidence(pkg, ws)
  const home = ws.planes.find((p) => p.id === pkg.homePlaneId)
  return (
    <>
      <Choice label="impact" options={FEATURE_IMPACTS} value={pkg.impact} onChange={(impact) => set({ impact })} />
      <Choice label="effort" options={FEATURE_EFFORTS} value={pkg.effort} onChange={(effort) => set({ effort })} />
      <div className={styles.row}>
        <span className={styles.label}>confidence</span>
        <span className={styles.value}>
          <span className={styles.level}>
            <Sure level={c.level} /> {c.level}
          </span>
          <span className={styles.why} data-warn={c.invalidated.length > 0}>
            {c.why}
          </span>
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>holds</span>
        <span className={styles.value}>
          <ul className={styles.members}>
            {members.map((m) => (
              <li key={m.id}>
                <button className={styles.member} style={{ ['--tone' as string]: TYPE_ACCENT[m.type] }} onClick={() => useCanvas.getState().select(m.id)}>
                  <span className={styles.kind}>{BOARD_KINDS[m.type].label}</span> {m.title || 'Untitled'}
                </button>
              </li>
            ))}
            {!members.length && <li className={styles.why}>Nothing left in it.</li>}
          </ul>
          {home && (
            <button className={styles.small} onClick={() => navigate(`${workspacePath(ws.wid)}?plane=${home.id}`)}>
              open its plane: {home.name}
            </button>
          )}
        </span>
      </div>
    </>
  )
}
