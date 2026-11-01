// The wizard (D-212, D-218, D-268; D-326's patterns): what the matrix's, the table's and the deck's wizards share, on
// the one Window. Numbered steps as tabs along the top (any of them at any time), the question on the left with the
// step's own content, a preview on the right, the foot: `[back]` on the left, `[cancel] [next] [make …]` on the right.
// Enter goes to the next step and on the last makes it, ⌘Enter makes it from any step (not while typing in one of its
// fields: there Enter is the field's, D-250); Escape or a press outside leaves it. Its height holds still between
// steps. Each wizard keeps its steps' content and what making it does.
import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import { Label } from './Label'
import { Window } from './Window'
import styles from './WizardShell.module.css'

// Enter in a wizard (D-250): the next step, or on the last one makes it; ⌘Enter makes it from any step. Not while typing
// in one of its fields: there Enter is the field's own (adding a name).
export function wizardEnter(e: KeyboardEvent, step: number, steps: number, next: (step: number) => void, make: () => void) {
  if (e.key !== 'Enter' || e.isComposing) return
  if (e.metaKey || e.ctrlKey) return (e.preventDefault(), make())
  if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]')) return
  e.preventDefault()
  if (step < steps - 1) next(step + 1)
  else make()
}

type Props = {
  // Its name, read out (`A new matrix`).
  label: string
  steps: readonly string[]
  step: number
  onStep: (step: number) => void
  // The step's question, over its content.
  title: ReactNode
  children: ReactNode
  // The preview on the right; its `PREVIEW` label is the shell's.
  preview?: ReactNode
  // `make the matrix`.
  make: string
  onMake: () => void
  onClose: () => void
}

export function WizardShell({ label, steps, step, onStep, title, children, preview, make, onMake, onClose }: Props) {
  // Heard first, wherever the focus is: Enter steps on (D-250). Escape is the Window's.
  const enter = useRef<(e: KeyboardEvent) => void>(() => {})
  enter.current = (e) => wizardEnter(e, step, steps.length, onStep, onMake)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element | null)?.closest?.('[data-coach]')) return
      if (e.key === 'Enter') enter.current(e)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
  return (
    <Window label={label} onClose={onClose} className={styles.wizard} data-learn="wizard" onKeyDown={(e) => e.stopPropagation()}>
      <nav className={styles.steps} role="tablist">
        {steps.map((s, i) => (
          <button key={s} type="button" role="tab" aria-selected={step === i} className={styles.step} onClick={() => onStep(i)}>
            <span className={styles.num}>{i + 1}</span>
            {s}
          </button>
        ))}
      </nav>
      <div className={styles.main}>
        <div className={styles.q}>
          <h3 className={styles.title}>{title}</h3>
          {children}
        </div>
        {preview !== undefined && (
          <aside className={styles.preview} aria-label="Preview">
            <Label>preview</Label>
            {preview}
          </aside>
        )}
      </div>
      <footer className={styles.foot}>
        <span>{step > 0 && <Button onClick={() => onStep(step - 1)}>back</Button>}</span>
        <span className={styles.end}>
          <Button onClick={onClose}>cancel</Button>
          {step < steps.length - 1 && <Button onClick={() => onStep(step + 1)}>next</Button>}
          <Button tone="main" onClick={onMake}>
            {make}
          </Button>
        </span>
      </footer>
    </Window>
  )
}
