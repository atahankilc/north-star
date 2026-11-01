// A wizard's numbered steps (D-326, the kit): Tabs with a magenta `01` before each name, all the same width, the
// ones behind a little brighter than the ones ahead; any can be clicked, arrows move. WizardShell's and the
// onboarding's welcome (Pages). `keyboard={false}` keeps them out of Tab and off the arrows when the window steps by
// its own keys; `titles` the whole name of a step when its tab is cut short.
import type { ReactNode } from 'react'
import { Tabs } from '../primitives/Tabs'
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
    <nav className={styles.steps}>
      <Tabs
        label={label}
        progress
        even
        keyboard={keyboard}
        options={steps.map((s, i) => ({ value: String(i), lead: stepNumber(i + 1), label: s, title: titles?.[i] }))}
        value={String(step)}
        onChange={(v) => onStep(Number(v))}
      />
    </nav>
  )
}
