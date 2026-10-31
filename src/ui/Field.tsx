// The one text field (D-326, the kit; the audit's 40 raw <input> and 15 <textarea> under ~35 local names): an
// underlined line in the house style, the line cyan while it has the keyboard. `multiline` is a textarea as tall as
// its text (autoGrow.ts). `quiet` shows its line only on hover and focus (a value that reads as text until touched,
// the card panel's fields). Enter and Escape have their own callbacks (Enter in a textarea only with ⌘ or Ctrl); keys
// stay inside it unless `passKeys`, so the canvas's shortcuts never fire while typing. Every other input prop passes on.
import { forwardRef, useImperativeHandle, useRef, type InputHTMLAttributes, type KeyboardEvent } from 'react'
import { useAutoGrow } from './autoGrow'
import styles from './Field.module.css'

type Base = {
  value: string
  onChange: (value: string) => void
  // What it's for, read out (no visible label: the row or the panel section names it).
  label: string
  placeholder?: string
  size?: 'sm' | 'md'
  quiet?: boolean
  onEnter?: (value: string) => void
  onEscape?: () => void
  passKeys?: boolean
}
type Single = Base & { multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, keyof Base | 'size' | 'children'>
type Multi = Base & { multiline: true; rows?: number } & Omit<InputHTMLAttributes<HTMLTextAreaElement>, keyof Base | 'size' | 'children'>
export type FieldProps = Single | Multi

export const Field = forwardRef<HTMLInputElement | HTMLTextAreaElement | null, FieldProps>(function Field(props, ref) {
  const { value, onChange, label, size = 'md', quiet, onEnter, onEscape, passKeys, className, onKeyDown, ...rest } = props
  const el = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => el.current as HTMLInputElement & HTMLTextAreaElement)
  const multiline = props.multiline === true
  useAutoGrow(el, multiline ? value : '')
  const keys = (e: KeyboardEvent<HTMLInputElement & HTMLTextAreaElement>) => {
    if (!passKeys) e.stopPropagation()
    if (e.key === 'Escape' && onEscape) (e.preventDefault(), onEscape())
    else if (e.key === 'Enter' && onEnter && !e.nativeEvent.isComposing && (!multiline || e.metaKey || e.ctrlKey)) (e.preventDefault(), onEnter(value))
    onKeyDown?.(e as never)
  }
  const common = {
    ref: el,
    className: [styles.field, className].filter(Boolean).join(' '),
    'data-size': size,
    'data-quiet': quiet || undefined,
    'aria-label': label,
    value,
    spellCheck: multiline,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    onKeyDown: keys,
  }
  if (multiline) {
    const { multiline: _m, rows = 2, ...area } = rest as Omit<Multi, keyof Base>
    void _m
    return <textarea {...area} {...common} rows={rows} />
  }
  const { multiline: _m, ...input } = rest as Omit<Single, keyof Base>
  void _m
  return <input type="text" autoComplete="off" {...input} {...common} />
})
