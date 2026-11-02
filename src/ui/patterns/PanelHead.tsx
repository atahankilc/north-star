// A docked panel's top line (D-359): what it is (`problem`, `agent`, `threads`) in mono caps in its tone, what the caller
// puts after it, then its tools joined with the one `×` at the far right (D-219, D-344). The right panel's and the
// agent's column's; where it sits (its padding) is the caller's class.
import type { CSSProperties, ReactNode } from 'react'
import { Button } from '../primitives/Button'
import { ButtonGroup } from '../primitives/ButtonGroup'
import styles from './PanelHead.module.css'

type Props = {
  kind: ReactNode
  // The kind's colour (a token); the panel's `--tone` without it.
  tone?: string
  // After the kind (the agent's model).
  children?: ReactNode
  // Along the top before the `×`, joined with it.
  tools?: ReactNode
  onClose?: () => void
  closeLabel?: string
  closeTitle?: string
  className?: string
}

export function PanelHead({ kind, tone, children, tools, onClose, closeLabel = 'close', closeTitle = 'Close (Esc)', className }: Props) {
  return (
    <header className={[styles.head, className].filter(Boolean).join(' ')} style={tone ? ({ '--tone': tone } as CSSProperties) : undefined}>
      <span className={styles.kind}>{kind}</span>
      {children}
      {(tools || onClose) && (
        <ButtonGroup className={styles.tools}>
          {tools}
          {onClose && (
            <Button icon onClick={onClose} title={closeTitle} aria-label={closeLabel}>
              ×
            </Button>
          )}
        </ButtonGroup>
      )}
    </header>
  )
}
