// A text field that saves itself: debounced while typing, immediately on blur or unmount.
// Remote edits flow in, except while you're typing in it (last write wins per field).
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { useAutoGrow } from './autoGrow'

const SAVE_AFTER_MS = 400

type Props = {
  value: string
  onSave: (value: string) => void
  /** A textarea as tall as its text (never scrolls). */
  multiline?: boolean
  /** One line of text, wrapped and as tall as it: Enter finishes it, line breaks become spaces. For titles. */
  wrap?: boolean
  rows?: number
  className?: string
  placeholder?: string
  label: string
  autoFocus?: boolean
  list?: string
  maxLength?: number
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
}

export function AutosaveField({ value, onSave, multiline, wrap, rows = 4, label, autoFocus, ...rest }: Props) {
  const [draft, setDraft] = useState(value)
  const el = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const focused = useRef(false)
  const pending = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const save = useRef(onSave)
  save.current = onSave
  useAutoGrow(el, multiline || wrap ? draft : '')

  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])

  const flush = () => {
    window.clearTimeout(timer.current)
    if (pending.current === null) return
    save.current(pending.current)
    pending.current = null
  }
  useEffect(() => flush, [])

  // Also when it turns true after mounting (e.g. the new item's data arrived first).
  useEffect(() => {
    if (autoFocus) el.current?.focus()
  }, [autoFocus])

  const props = {
    ...rest,
    ref: el,
    'aria-label': label,
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = wrap ? e.target.value.replace(/\s*\n\s*/g, ' ') : e.target.value
      setDraft(next)
      pending.current = next
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, SAVE_AFTER_MS)
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
