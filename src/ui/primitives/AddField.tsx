// What a `+ tag` (`+ region`, `+ criterion`, `+ label`) turns into (D-359): a small field that has the keyboard at once;
// Enter adds what's typed (trimmed, when there's something) and the caller says whether it stays open for the next;
// Escape or leaving it closes it. The caller holds what's typed (its suggestions read it).
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
      onBlur={onClose}
      onEscape={onClose}
      onEnter={(v) => {
        const t = v.trim()
        if (t) onAdd(t)
      }}
    />
  )
}
