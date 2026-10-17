// `show: [customers] [problems] …   for: any  SMEs …` under the HUD (docs/specs/board.md §3).
import { useMemo, type ReactNode } from 'react'
import { BOARD_TYPES } from '../../data/model'
import { useWsView } from '../../state/workspaceView'
import { BOARD_KINDS } from '../canvas/boardKinds'
import { useWs } from './context'
import styles from './Bars.module.css'

// `children` adds a group of its own after the filters (the board's jump list).
export function FilterBar({ children }: { children?: ReactNode }) {
  const { customers } = useWs()
  const { types, forIds, toggleType, toggleFor, clearFor } = useWsView()
  const options = useMemo(() => [...customers].sort((a, b) => a.createdAt - b.createdAt), [customers])

  return (
    <div className={styles.filters}>
      <span className={styles.group} role="group" aria-label="Item types">
        <span className={styles.label}>show</span>
        {BOARD_TYPES.map((t) => (
          <button key={t} className={styles.toggle} aria-pressed={types.includes(t)} onClick={() => toggleType(t)}>
            {BOARD_KINDS[t].plural}
          </button>
        ))}
      </span>
      {options.length > 0 && (
        <span className={styles.group} role="group" aria-label="For customers">
          <span className={styles.label}>for</span>
          <button className={styles.toggle} aria-pressed={forIds.length === 0} onClick={clearFor}>
            any
          </button>
          {options.map((c) => (
            <button
              key={c.id}
              className={styles.toggle}
              style={{ ['--tone' as string]: 'var(--accent-green)' }}
              aria-pressed={forIds.includes(c.id)}
              onClick={() => toggleFor(c.id)}
            >
              {c.title || 'Untitled'}
            </button>
          ))}
        </span>
      )}
      {children}
    </div>
  )
}
