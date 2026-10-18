// One row of `[P1] P2 P3`. Clicking the active option clears it.
import styles from './Choice.module.css'

type Props<T extends string> = {
  label: string
  options: readonly T[]
  value: T | undefined
  onChange: (v: T | undefined) => void
  // Optional colour per option for the active state.
  tones?: Partial<Record<T, string>>
  // Only the options; the label is still read out (a settings Row shows its own, D-097).
  bare?: boolean
}

export function Choice<T extends string>({ label, options, value, onChange, tones, bare }: Props<T>) {
  const group = (
    <span className={styles.options} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          role="radio"
          aria-checked={value === o}
          className={styles.option}
          // A picker: locked for a viewer it still shows the value (D-098).
          data-edit
          data-active={value === o}
          data-tone={tones?.[o] ? '' : undefined}
          style={tones?.[o] ? { ['--tone' as string]: tones[o] } : undefined}
          onClick={() => onChange(value === o ? undefined : o)}
        >
          {o}
        </button>
      ))}
    </span>
  )
  if (bare) return group
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      {group}
    </div>
  )
}
