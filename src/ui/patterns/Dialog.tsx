// A small window that asks one thing (D-359): its title, what it asks (fields, a line or two), its answers joined at the
// foot on the right, the go last (`primary`). On the one Window (modal, Escape and the scrim close it, `[×] esc` in the
// corner, focus inside and back). A naming window (a new workspace, a rename) is one; a wizard (WizardShell) and Settings
// have their own shapes on the same Window.
import type { ReactNode } from 'react'
import { ButtonGroup } from '../primitives/ButtonGroup'
import { Window } from './Window'
import styles from './Dialog.module.css'

type Props = {
  title: string
  onClose: () => void
  // Its answers (Buttons), joined at the foot.
  foot: ReactNode
  children?: ReactNode
}

export function Dialog({ title, onClose, foot, children }: Props) {
  return (
    <Window label={title} onClose={onClose} close>
      <div className={styles.dialog}>
        <h3 className={styles.title}>{title}</h3>
        {children}
        <ButtonGroup className={styles.foot}>{foot}</ButtonGroup>
      </div>
    </Window>
  )
}
