// A feature's confidence (D-138) as three blocks, lit up to its level.
import styles from './PrioritiesView.module.css'
import { LEVELS, type Level } from './reading'

export function Sure({ level }: { level: Level }) {
  const n = LEVELS.indexOf(level) + 1
  return (
    <span className={styles.sure} data-level={level} aria-label={`confidence ${level}`}>
      {[1, 2, 3].map((i) => (
        <span key={i} data-on={i <= n} />
      ))}
    </span>
  )
}
