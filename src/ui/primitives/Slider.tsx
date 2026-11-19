// The one slider (D-417): a number picked along a line, for a setting with too many steps for a Choice (the
// interface's size). A real range input to the keyboard and screen readers (arrows, Page Up/Down, Home, End). The line is
// faint, the part up to the knob in ink; the knob an empty circle with a line (D-384), cyan with the keyboard; a small
// tick under `mark` (where it starts). The value is read beside it in mono (`110 %`).
// `onChange` gets the value when it's let go (or a key moves it); while dragging, only the number beside it follows.
// A setting that resizes the page under the pointer would otherwise move the line away from the hand mid-drag.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import styles from './Slider.module.css'

type Props = {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  // Where it starts (the default): a small tick under that spot.
  mark?: number
  // The number as read beside it.
  format?: (value: number) => string
  disabled?: boolean
}

export function Slider({ label, value, min, max, step, onChange, mark, format = String, disabled }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const [held, setHeld] = useState<number | null>(null)
  const shown = held ?? value
  const share = (n: number) => (n - min) / (max - min)
  const commit = useRef(onChange)
  commit.current = onChange
  // The native `change` comes when the knob is let go, or at once from a key; React's onChange is every step (`input`).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const done = () => {
      setHeld(null)
      commit.current(Number(el.value))
    }
    el.addEventListener('change', done)
    return () => el.removeEventListener('change', done)
  }, [])
  return (
    <span className={styles.slider} data-disabled={disabled || undefined}>
      <span className={styles.track} style={{ '--at-share': share(shown) } as CSSProperties}>
        {mark !== undefined && <span className={styles.mark} style={{ '--mark-share': share(mark) } as CSSProperties} aria-hidden />}
        <input
          ref={ref}
          type="range"
          className={styles.input}
          aria-label={label}
          aria-valuetext={format(shown)}
          min={min}
          max={max}
          step={step}
          value={shown}
          disabled={disabled}
          onChange={(e) => setHeld(Number(e.currentTarget.value))}
        />
        <span className={styles.knob} aria-hidden />
      </span>
      <output className={styles.value} aria-hidden>
        {format(shown)}
      </output>
    </span>
  )
}
