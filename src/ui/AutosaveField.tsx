// A text field that saves itself: debounced while typing, immediately on blur or unmount.
// Remote edits flow in, except while you're typing in it (last write wins per field).
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'

const SAVE_AFTER_MS = 400

type Props = {
  value: string
  onSave: (value: string) => void
  multiline?: boolean
  rows?: number
  className?: string
  placeholder?: string
  label: string
  autoFocus?: boolean
  list?: string
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
}

export function AutosaveField({ value, onSave, multiline, rows = 4, label, autoFocus, ...rest }: Props) {
  const [draft, setDraft] = useState(value)
  const el = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const focused = useRef(false)
  const pending = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const save = useRef(onSave)
  save.current = onSave

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
      setDraft(e.target.value)
      pending.current = e.target.value
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, SAVE_AFTER_MS)
    },
    onFocus: () => (focused.current = true),
    onBlur: () => {
      focused.current = false
      flush()
    },
  }
  return multiline ? <textarea rows={rows} {...props} /> : <input {...props} />
}
