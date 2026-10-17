// HUD control: cycles motion between following the OS, full and reduced.
import { useMotion, type MotionPref } from '../state/motion'
import styles from './MotionToggle.module.css'

const NEXT: Record<MotionPref, MotionPref> = { system: 'full', full: 'reduced', reduced: 'system' }

export function MotionToggle() {
  const pref = useMotion((s) => s.pref)
  const reduced = useMotion((s) => s.reduced)
  const setPref = useMotion((s) => s.setPref)

  return (
    <button
      className={styles.toggle}
      onClick={() => setPref(NEXT[pref])}
      title={pref === 'system' ? `Following your system (${reduced ? 'reduced' : 'full'})` : 'Click to change'}
    >
      <span className={styles.glyph} data-on={!reduced} aria-hidden>
        {reduced ? '◌' : '◉'}
      </span>
      motion: {pref}
    </button>
  )
}
