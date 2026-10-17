// One row of `[P1] P2 P3`. Clicking the active option clears it.
import styles from './Choice.module.css'

type Props<T extends string> = {
  label: string
  options: readonly T[]
  value: T | undefined
  onChange: (v: T | undefined) => void
  // Optional colour per option for the active state.
  tones?: Partial<Record<T, string>>
}

export function Choice<T extends string>({ label, options, value, onChange, tones }: Props<T>) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.options} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            role="radio"
            aria-checked={value === o}
            className={styles.option}
            data-active={value === o}
            data-tone={tones?.[o] ? '' : undefined}
            style={tones?.[o] ? { ['--tone' as string]: tones[o] } : undefined}
            onClick={() => onChange(value === o ? undefined : o)}
          >
            {o}
          </button>
        ))}
      </span>
    </div>
  )
}
