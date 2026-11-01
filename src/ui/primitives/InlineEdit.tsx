// Click-to-rename text. Enter or blur saves, Escape cancels (the blur that follows it saves nothing).
import { useEffect, useRef, useState } from 'react'
import styles from './InlineEdit.module.css'

type Props = {
  value: string
  onSave: (value: string) => void | Promise<unknown>
  // Start in edit mode (e.g. from a "rename" action elsewhere).
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
  className?: string
  label: string
  maxLength?: number
}

export function InlineEdit({ value, onSave, editing: controlled, onEditingChange, className, label, maxLength = 80 }: Props) {
  const [own, setOwn] = useState(false)
  const editing = controlled ?? own
  const setEditing = (v: boolean) => (onEditingChange ? onEditingChange(v) : setOwn(v))
  const [draft, setDraft] = useState(value)
  const input = useRef<HTMLInputElement>(null)
  const cancelled = useRef(false)

  useEffect(() => {
    if (!editing) return
    setDraft(value)
    cancelled.current = false
    requestAnimationFrame(() => input.current?.select())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const commit = () => {
    if (cancelled.current) return
    setEditing(false)
    const next = draft.trim()
    if (next && next !== value) void onSave(next)
  }

  if (!editing) {
    return (
      <button className={`${styles.text} ${className ?? ''}`} onClick={() => setEditing(true)} title={`Rename ${label}`}>
        {value}
      </button>
    )
  }

  return (
    <input
      ref={input}
      className={`${styles.input} ${className ?? ''}`}
      value={draft}
      maxLength={maxLength}
      aria-label={`${label} name`}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') {
          cancelled.current = true
          setEditing(false)
        }
        e.stopPropagation()
      }}
    />
  )
}
