// The focus dock (D-189, D-347): the Console standing on the screen's foot, in the middle, while a piece is in focus. It
// holds what can be done there, `unfocus` last; what opens from it (filters, what's linked) opens as its upper floor
// (ConsoleFloor). No plane name: the breadcrumb has it. The same dock is a pane's beside a plane (D-211), named. No keys
// shown (Escape closes what's open next; onboarding teaches it).
import type { ReactNode } from 'react'
import { isReducedMotion } from '../../../state/motion'
import styles from './FocusDock.module.css'
import { Button } from '../../../ui/primitives/Button'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { Console } from '../../../ui/patterns/Console'

// `center`: where its middle sits (screen px); its box's middle when unset (the screen's, or a pane's beside a plane:
// each part has its own dock, D-211). `name`: what it's the dock of, first (a pane's: `TABLE · costs`).
export function FocusDock({ children, center, name, label = 'Focus' }: { children: ReactNode; center?: number; name?: ReactNode; label?: string }) {
  return (
    <Console
      at="foot"
      className={styles.dock}
      aria-label={label}
      name={name}
      data-learn="dock"
      data-reduced={isReducedMotion() || undefined}
      // In a part of the screen (`center` its middle): past most of its width it takes the part's whole foot (D-347).
      room={center !== undefined ? 2 * center : undefined}
      style={center !== undefined ? { left: center, ['--part-w' as string]: `${2 * center}px` } : undefined}
      data-in-part={center !== undefined || undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ButtonGroup>{children}</ButtonGroup>
    </Console>
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
