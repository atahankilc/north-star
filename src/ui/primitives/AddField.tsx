// What a `+ tag` (`+ region`, `+ criterion`, `+ label`, `+ step`) turns into (D-359): a small field that has the
// keyboard at once; Enter adds what's typed (trimmed, when there's something) and the caller says whether it stays open
// for the next. Leaving it adds what's typed too, then closes (the user, 2026-11-03: nothing typed is lost); Escape
// closes it and drops what's typed. The caller holds what's typed (its suggestions read it).
import { useRef } from 'react'
import { Field } from './Field'

type Props = {
  value: string
  onChange: (value: string) => void
  onAdd: (text: string) => void
  onClose: () => void
  label: string
  placeholder?: string
  maxLength?: number
  className?: string
}

export function AddField({ value, onChange, onAdd, onClose, label, placeholder, maxLength, className }: Props) {
  // Escape closes it; the blur that may follow as it goes adds nothing.
  const dropped = useRef(false)
  return (
    <Field
      size="sm"
      autoFocus
      className={className}
      label={label}
      placeholder={placeholder}
      value={value}
      maxLength={maxLength}
      onChange={onChange}
      onBlur={() => {
        const t = value.trim()
        if (t && !dropped.current) onAdd(t)
        onClose()
      }}
      onEscape={() => {
        dropped.current = true
        onClose()
      }}
      onEnter={(v) => {
        const t = v.trim()
        if (t) onAdd(t)
      }}
    />
  )
}
