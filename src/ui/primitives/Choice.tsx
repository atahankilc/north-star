// One row of options, one of them picked (`P1 P2 P3`, D-344): Tabs' segments, so every one-of-several in the app is
// drawn by one component (Tabs), the picked one lit (cyan, or its own colour from `tones`). Clicking the picked option
// clears it only when it's `clearable`; else it stays picked.
import { Tabs } from './Tabs'
import styles from './Choice.module.css'

type Props<T extends string> = {
  label: string
  options: readonly T[]
  value: T | undefined
  // Optional colour per option for the active state.
  tones?: Partial<Record<T, string>>
  // Only the options; the label is still read out (a settings Row shows its own, D-097).
  bare?: boolean
  // Who can't edit sees it, can't change it.
  disabled?: boolean
} & ({ clearable: true; onChange: (v: T | undefined) => void } | { clearable?: false; onChange: (v: T) => void })

export function Choice<T extends string>({ label, options, value, tones, bare, disabled, ...pick }: Props<T>) {
  const group = (
    <Tabs<T>
      look="segments"
      label={label}
      // A picker: locked for a viewer it still shows the value (D-098).
      edit
      disabled={disabled}
      options={options.map((o) => ({ value: o, label: o, tone: tones?.[o] }))}
      value={value}
      onChange={(v) => pick.onChange(v)}
      onReclick={pick.clearable ? () => pick.onChange(undefined) : undefined}
    />
  )
  if (bare) return group
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      {group}
    </div>
  )
}
