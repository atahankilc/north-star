// The focus dock (D-189, D-347): the Console standing on the screen's foot, in the middle, while a piece is in focus. It
// holds what can be done there, `unfocus` last; what opens from it (filters, what's linked) opens as its upper floor
// (ConsoleFloor). No plane name: the breadcrumb has it. The same dock is a pane's beside a plane (D-211), named. No keys
// shown (Escape closes what's open next; onboarding teaches it).
import { useEffect, type ReactNode } from 'react'
import { isReducedMotion } from '../../../state/motion'
import styles from './FocusDock.module.css'
import { Button } from '../../../ui/primitives/Button'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { Console } from '../../../ui/patterns/Console'

// A setup open on the dock (matrix, table, deck): it's the dock's floor, so the dock's own top L's go. Said by a mark on
// <html> while one is open, not by `body:has(…)`: that made every change of text anywhere restyle the whole page, and a
// focus left (each card fitting its title) froze for a second.
export function useSetupOnDock() {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.setupOpen = String(Number(root.dataset.setupOpen ?? 0) + 1)
    return () => {
      const n = Number(root.dataset.setupOpen ?? 1) - 1
      if (n > 0) root.dataset.setupOpen = String(n)
      else delete root.dataset.setupOpen
    }
  }, [])
}

// `part`: the part of its box it stands in the middle of (px); its box's middle when unset (the screen's, or a pane's
// beside a plane: each part has its own dock, D-211). `name`: what it's the dock of, first (a pane's: `TABLE · costs`).
export function FocusDock({ children, part, name, label = 'Focus' }: { children: ReactNode; part?: { x: number; w: number }; name?: ReactNode; label?: string }) {
  return (
    <Console
      at="foot"
      className={styles.dock}
      aria-label={label}
      name={name}
      data-learn="dock"
      data-reduced={isReducedMotion() || undefined}
      // In a part of the screen: past most of its width it takes the part's whole foot (D-347).
      room={part?.w}
      style={part ? { left: part.x + part.w / 2, ['--part-x' as string]: `${part.x}px`, ['--part-w' as string]: `${part.w}px` } : undefined}
      data-in-part={!!part || undefined}
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
