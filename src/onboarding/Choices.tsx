// The workspaces page with no workspaces (D-315, docs/specs/onboarding.md §4.7, onboarding-lessons.md `workspaces-empty`;
// D-338): not a modal, the empty state itself teaches. Drawn by the coach into the page's start row (`data-learn=
// "workspaces-empty"`, Workspaces.tsx), in place of its own three pieces: the same three ways in, each going to what it
// says (the prompt for a name or a code, the file picker). Gone (and seen) at the first workspace made or the first join
// asked for; the page's own pieces show after that.
import { createPortal } from 'react-dom'
import { Appear } from '../ui/primitives/Appear'
import type { Choice } from './lessons'
import styles from './Coach.module.css'
import { Label } from '../ui/primitives/Label'

// What each choice goes to on the page (D-338: Workspaces.tsx), by its place in the list: the prompt takes a name or a
// code, the third opens the file picker.
const GO: (() => void)[] = [
  () => document.querySelector<HTMLElement>('[data-ws-prompt]')?.focus(),
  () => document.querySelector<HTMLElement>('[data-ws-prompt]')?.focus(),
  () => document.getElementById('ws-import')?.click(),
]
// Drawn as the page's own three pieces (D-338): the name cut into the edge, a band in its colour.
const CUT = ['new', 'join', 'import']
const BAND = ['var(--accent-magenta)', 'var(--accent-cyan)', 'var(--accent-blue)']

export function Choices({ into, choices }: { into: Element; choices: readonly Choice[] }) {
  return createPortal( // kit-ok: the three choices drawn into the page's own box for them
    <ul className={styles.choices} data-coach aria-label="ways to start">
      {choices.map((c, i) => (
        <Appear as="li" key={c.label} className={styles.choiceItem}>
          <button /* kit-ok: a choice drawn as a piece (its name cut in, a line), the whole of it the target */ type="button" className={styles.choice} style={{ '--band': BAND[i] } as React.CSSProperties} onClick={() => GO[i]?.()}>
            <Label className={styles.choiceNo}>{CUT[i] ?? ''}</Label>
            <span className={styles.choiceLabel}>{c.label}</span>
            <span className={styles.choiceLine}>{c.line}</span>
          </button>
        </Appear>
      ))}
    </ul>,
    into,
  )
}
