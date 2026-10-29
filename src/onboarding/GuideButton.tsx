// The side nav's `?` (D-315, docs/specs/onboarding.md §4.6), under the compass: opens the guide (every note again, the
// keys, tips on/off), as `?` does. A magenta dot on it while something new is still unseen.
import { openGuide } from './Coach'
import { useGuideDot } from './Guide'
import nav from '../views/workspace/WorkspaceLayout.module.css'
import styles from './GuideButton.module.css'

export function GuideButton() {
  const dot = useGuideDot()
  return (
    <button
      className={`${nav.fit} ${styles.button}`}
      aria-label={`Guide: every note again${dot ? ', something new' : ''}`}
      title={dot ? 'guide (?) · something new' : 'guide (?)'}
      data-viewer-ok
      onClick={openGuide}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        {/* A question mark, drawn like the compass above it. */}
        <path d="M5.75 6.25a3.25 3.25 0 1 1 4.9 2.8c-.95.55-1.65 1.2-1.65 2.3v.9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
        <rect x="8.25" y="14.25" width="1.5" height="1.5" fill="currentColor" />
      </svg>
      {dot && <span className={styles.dot} aria-hidden />}
    </button>
  )
}
