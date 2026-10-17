// `view: [board] flow table matrix`, bottom-right on every workspace view (docs/specs/board.md §3).
import { NavLink } from 'react-router-dom'
import { useWs } from './context'
import styles from './Bars.module.css'

export function ViewSwitch() {
  const { wid } = useWs()
  const base = `/w/${wid}`
  const views = [
    { label: 'board', to: base, end: true },
    { label: 'flow', to: `${base}/flow`, end: false },
    { label: 'table', to: `${base}/table`, end: false },
    { label: 'matrix', to: `${base}/matrix`, end: false },
  ]
  return (
    <nav className={styles.views} aria-label="Views">
      <span className={styles.label}>view</span>
      {views.map((v) => (
        <NavLink key={v.label} to={v.to} end={v.end} className={styles.toggle}>
          {v.label}
        </NavLink>
      ))}
    </nav>
  )
}
