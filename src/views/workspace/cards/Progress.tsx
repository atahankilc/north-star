// How far along something is (D-254, D-358): `done/all`, green once all are done, never cut. `cells`: a checklist's
// steps as small cells before it (`▮▮▯ 2/3`, the cells only up to eight); `box`: a card's tasks (`☐ 2/5`, `☑` when
// all are finished).
import { checkCells, CHECK_CELLS_MAX } from '../../../model/tasks'
import styles from './parts.module.css'

type Props = { done: number; all: number; look: 'cells' | 'box'; title: string; className?: string }

export function Progress({ done, all, look, title, className }: Props) {
  const full = done === all
  return (
    <span className={[styles.progress, className].filter(Boolean).join(' ')} data-all={full || undefined} title={title}>
      {look === 'box' ? (full ? '☑' : '☐') : all <= CHECK_CELLS_MAX && <span className={styles.cells}>{checkCells(done, all)}</span>} {done}/{all}
    </span>
  )
}
