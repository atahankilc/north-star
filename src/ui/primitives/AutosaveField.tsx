// A text field that saves itself: after a pause while typing (foundation/pausedSave.ts, as canvas text does: a hidden
// tab saves too), at once on blur or unmount.
// Remote edits flow in, except while you're typing in it (last write wins per field).
// It's the kit's Field (D-406: it drew its own input and textarea): nothing of its own (`plain`: a note typed where it
// reads brings its own class), or with `well` the round well (D-384), for a setup's or the settings' fields, whose class
// then only places it. Keys pass on as they did (`passKeys`).
import { useEffect, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react'
import { usePausedSave } from '../foundation/pausedSave'
import { Field } from './Field'
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

  const common = {
    ...rest,
    ref: el as never,
    look: well ? ('well' as const) : ('plain' as const),
    className,
    label,
    value: draft,
    passKeys: true,
    onChange: (v: string) => {
      const next = wrap ? v.replace(/\s*\n\s*/g, ' ') : v
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
  // One wrapped line: Enter finishes it.
  const finishOnEnter = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }
  if (wrap) return <Field {...common} multiline rows={1} onKeyDown={finishOnEnter} />
  return multiline ? <Field {...common} multiline rows={rows} /> : <Field {...common} />
}
