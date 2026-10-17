// `show: [customers] [problems] …   for: any  SMEs …` under the HUD (docs/specs/domains.md §3).
import { useMemo } from 'react'
import { BOARD_TYPES } from '../../data/model'
import { ALL, useWsView } from '../../state/workspaceView'
import { BOARD_KINDS } from '../canvas/boardKinds'
import { useWs } from './context'
import styles from './Bars.module.css'

export function FilterBar() {
  const { customers } = useWs()
  const { domain, types, forIds, toggleType, toggleFor, clearFor } = useWsView()

  // Customers of this domain (and unsorted ones), plus any still picked from elsewhere.
  const options = useMemo(
    () =>
      [...customers]
        .filter((c) => domain === ALL || !c.domainIds?.length || c.domainIds.includes(domain) || forIds.includes(c.id))
        .sort((a, b) => a.createdAt - b.createdAt),
    [customers, domain, forIds],
  )

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
    </div>
  )
}
