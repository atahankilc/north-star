// A text field that saves itself: after a pause while typing (foundation/pausedSave.ts, as canvas text does: a hidden
// tab saves too), at once on blur or unmount.
// Remote edits flow in, except while you're typing in it (last write wins per field).
// It draws nothing of its own (a note typed where it reads brings its own class); `well` gives it Field's look, the
// round well (D-384), for a setup's or the settings' fields, whose class then only places it.
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { useAutoGrow } from '../foundation/autoGrow'
import { usePausedSave } from '../foundation/pausedSave'
import field from './Field.module.css'

type Props = {
  value: string
  onSave: (value: string) => void
  /** A textarea as tall as its text (never scrolls). */
  multiline?: boolean
  /** One line of text, wrapped and as tall as it: Enter finishes it, line breaks become spaces. For titles. */
  wrap?: boolean
  rows?: number
  well?: boolean
  className?: string
  placeholder?: string
  label: string
  autoFocus?: boolean
  list?: string
  maxLength?: number
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
}

export function AutosaveField({ value, onSave, multiline, wrap, rows = 4, label, autoFocus, well, className, ...rest }: Props) {
  const [draft, setDraft] = useState(value)
  const el = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const focused = useRef(false)
  const pending = useRef<string | null>(null)
  const save = useRef(onSave)
  save.current = onSave
  useAutoGrow(el, multiline || wrap ? draft : '')

  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])

  const { later, flush } = usePausedSave(() => {
    if (pending.current === null) return
    save.current(pending.current)
    pending.current = null
  })

  // Also when it turns true after mounting (e.g. the new item's data arrived first).
  useEffect(() => {
    if (autoFocus) el.current?.focus()
  }, [autoFocus])

  const props = {
    ...rest,
    className: [well ? field.field : undefined, className].filter(Boolean).join(' ') || undefined,
    ref: el,
    'aria-label': label,
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = wrap ? e.target.value.replace(/\s*\n\s*/g, ' ') : e.target.value
      setDraft(next)
      pending.current = next
      later()
    },
    onFocus: () => (focused.current = true),
    onBlur: () => {
      focused.current = false
      flush()
    },
  }
  const finishOnEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }
  if (wrap) return <textarea rows={1} onKeyDown={finishOnEnter} {...props} />
  return multiline ? <textarea rows={rows} {...props} /> : <input {...props} />
}
