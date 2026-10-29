// The workspaces page with no workspaces (D-315, docs/specs/onboarding.md §4.7, onboarding-lessons.md `workspaces-empty`):
// not a modal, the empty state itself teaches. Drawn by the coach into the page's empty box (`data-learn=
// "workspaces-empty"`, Workspaces.tsx), in place of its own line: three framed choices, each one line, each going to what
// it says (the name field, the code field, the file picker). Gone (and seen) at the first workspace made or the first
// join asked for; the page's own line shows after that, should it ever be empty again.
import { createPortal } from 'react-dom'
import { Appear } from '../ui/Appear'
import type { Choice } from './lessons'
import styles from './Coach.module.css'

// What each choice goes to on the page (Workspaces.tsx's fields), by its place in the list.
const GO: (() => void)[] = [
  () => document.getElementById('ws-name')?.focus(),
  () => document.getElementById('ws-code')?.focus(),
  () => document.getElementById('ws-import')?.click(),
]

export function Choices({ into, choices }: { into: Element; choices: readonly Choice[] }) {
  return createPortal(
    <ul className={styles.choices} data-coach aria-label="ways to start">
      {choices.map((c, i) => (
        <Appear as="li" key={c.label} className={styles.choiceItem}>
          <button type="button" className={styles.choice} onClick={() => GO[i]?.()}>
            <span className={styles.choiceNo}>{String(i + 1).padStart(2, '0')}</span>
            <span className={styles.choiceLabel}>{c.label}</span>
            <span className={styles.choiceLine}>{c.line}</span>
          </button>
        </Appear>
      ))}
    </ul>,
    into,
  )
}
