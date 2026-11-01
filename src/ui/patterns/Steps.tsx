// A wizard's numbered steps (D-326, the kit): tabs along the top, `01 START FROM`, the current one lit with a magenta
// line under it, the ones behind a little brighter than the ones ahead; any can be clicked. WizardShell's and the
// onboarding's welcome (Pages) drew it twice. `keyboard={false}` keeps them out of Tab when the window steps by its own
// keys; `titles` the whole name of a step when its tab is cut short.
import type { ReactNode } from 'react'
import styles from './Steps.module.css'

type Props = {
  steps: readonly ReactNode[]
  step: number
  onStep: (step: number) => void
  label?: string
  titles?: readonly (string | undefined)[]
  keyboard?: boolean
}

export const stepNumber = (n: number) => String(n).padStart(2, '0')

export function Steps({ steps, step, onStep, label = 'steps', titles, keyboard = true }: Props) {
  return (
    <nav className={styles.steps} role="tablist" aria-label={label}>
      {steps.map((s, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={step === i}
          data-done={i < step || undefined}
          tabIndex={keyboard ? undefined : -1}
          className={styles.step}
          title={titles?.[i]}
          onClick={() => onStep(i)}
        >
          <span className={styles.num}>{stepNumber(i + 1)}</span>
          {s}
        </button>
      ))}
    </nav>
  )
}
