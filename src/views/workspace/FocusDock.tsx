// The focus dock (D-189): a tab sitting on the bottom edge of the screen, in the middle, while a plane is in focus. It
// holds what can be done there, `[unfocus] esc` last; more actions come in before it. No plane name: the breadcrumb has it.
import type { ReactNode } from 'react'
import { isReducedMotion } from '../../state/motion'
import styles from './FocusDock.module.css'

export function FocusDock({ children }: { children: ReactNode }) {
  return (
    <div
      className={styles.dock}
      role="toolbar"
      aria-label="Focus"
      data-reduced={isReducedMotion() || undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

// One action: `[verb]` and its key, faint, after it. `main` is the strong one (unfocus).
export function DockAction({ label, keyHint, title, main, onClick }: {
  label: string
  keyHint?: string
  title?: string
  main?: boolean
  onClick: () => void
}) {
  return (
    <span className={styles.action}>
      <button className={styles.tool} data-main={main || undefined} title={title} onClick={onClick}>
        {label}
      </button>
      {keyHint && <span className={styles.key}>{keyHint}</span>}
    </span>
  )
}
