// The focus dock (D-189): a tab sitting on the bottom edge of the screen, in the middle, while a plane is in focus. It
// holds what can be done there, `[unfocus]` last; more actions come in before it. No plane name: the breadcrumb has it.
// The same dock is a pane's beside a plane (D-211), named. `esc` shows on whatever Escape closes next, in whichever dock.
import type { ReactNode } from 'react'
import { isReducedMotion } from '../../state/motion'
import styles from './FocusDock.module.css'

// `center`: where its middle sits (screen px); its box's middle when unset (the screen's, or a pane's beside a plane:
// each part has its own dock, D-211). `name`: what it's the dock of, first, set off by `|` (a pane's: `TABLE · costs`).
export function FocusDock({ children, center, name, label = 'Focus' }: { children: ReactNode; center?: number; name?: ReactNode; label?: string }) {
  return (
    <div
      className={styles.dock}
      role="toolbar"
      aria-label={label}
      data-reduced={isReducedMotion() || undefined}
      style={center !== undefined ? { left: center } : undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {name && (
        <>
          <span className={styles.name}>{name}</span>
          <span className={styles.sep} aria-hidden>
            |
          </span>
        </>
      )}
      {children}
    </div>
  )
}

// One action: `[verb]` and its key, faint, after it. `main` is the strong one (unfocus).
export function DockAction({ label, keyHint, title, main, pressed, tone, onClick }: {
  label: string
  keyHint?: string
  title?: string
  main?: boolean
  // A switch (what's open beside the plane, D-211): lit while on.
  pressed?: boolean
  // Its colour when it warns (tasks hidden on a kanban, D-300).
  tone?: string
  onClick: () => void
}) {
  return (
    <span className={styles.action}>
      <button className={styles.tool} data-main={main || undefined} aria-pressed={pressed} title={title} style={tone ? { color: tone } : undefined} onClick={onClick}>
        {label}
      </button>
      {keyHint && <span className={styles.key}>{keyHint}</span>}
    </span>
  )
}

// Something it says, not a button (a deck linked to a plane: what it leaves out, D-303).
export function DockNote({ label, title }: { label: string; title?: string }) {
  return (
    <span className={styles.note} title={title}>
      {label}
    </span>
  )
}
