// The focus dock (D-189): a tab sitting on the bottom edge of the screen, in the middle, while a plane is in focus. It
// holds what can be done there, `unfocus` last; more actions come in before it, joined in one strip (ButtonGroup,
// D-344). No plane name: the breadcrumb has it. The same dock is a pane's beside a plane (D-211), named. No keys shown
// (Escape closes what's open next; onboarding teaches it).
import type { ReactNode } from 'react'
import { isReducedMotion } from '../../../state/motion'
import styles from './FocusDock.module.css'
import { Button } from '../../../ui/primitives/Button'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'

// `center`: where its middle sits (screen px); its box's middle when unset (the screen's, or a pane's beside a plane:
// each part has its own dock, D-211). `name`: what it's the dock of, first, set off by `|` (a pane's: `TABLE · costs`).
export function FocusDock({ children, center, name, label = 'Focus' }: { children: ReactNode; center?: number; name?: ReactNode; label?: string }) {
  return (
    <div
      className={styles.dock}
      role="toolbar"
      aria-label={label}
      data-learn="dock"
      data-reduced={isReducedMotion() || undefined}
      // In a part of the screen (`center` its middle), kept inside it: past its width it scrolls sideways (D-314).
      style={center !== undefined ? { left: center, maxWidth: Math.max(160, 2 * center - 16) } : undefined}
      data-in-part={center !== undefined || undefined}
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
      <ButtonGroup>{children}</ButtonGroup>
    </div>
  )
}

// One action, a Button cell. `main` is the strong one (unfocus).
export function DockAction({ label, title, main, pressed, tone, onClick }: {
  label: string
  title?: string
  main?: boolean
  // A switch (what's open beside the plane, D-211): lit while on.
  pressed?: boolean
  // Its colour when it warns (tasks hidden on a kanban, D-300).
  tone?: string
  onClick: () => void
}) {
  return (
    <Button tone={main ? 'main' : undefined} pressed={pressed} title={title} style={tone ? { color: tone } : undefined} onClick={onClick}>
      {label}
    </Button>
  )
}
