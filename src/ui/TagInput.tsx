// Tags as chips with a free-text box (D-057): type to filter the workspace's existing tags, Enter or comma adds
// (an existing one or a new one), × or Backspace in the empty box removes. Arrow keys move through suggestions.
import { useId, useMemo, useRef, useState } from 'react'
import styles from './TagInput.module.css'

type Props = {
  value: string[]
  onChange: (tags: string[]) => void
  // Every tag already used in the workspace, most used first.
  suggestions: string[]
  label: string
  // Other lists of names use it too (a competitor's regions, D-145): no `#`, their own wording and cleaning.
  prefix?: string
  placeholder?: string
  clean?: (s: string) => string
}

const cleanTag = (s: string) => s.trim().replace(/^#+/, '').replace(/,/g, '').trim()

export function TagInput({ value, onChange, suggestions, label, prefix = '#', placeholder = 'add a tag', clean = cleanTag }: Props) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()

  const typed = clean(draft)
  const matches = useMemo(() => {
    const needle = typed.toLowerCase()
    return suggestions.filter((t) => !value.includes(t) && (!needle || t.toLowerCase().includes(needle))).slice(0, 8)
  }, [suggestions, value, typed])
  // Offer to create what's typed when it isn't a tag yet.
  const isNew = typed !== '' && !suggestions.some((t) => t.toLowerCase() === typed.toLowerCase()) && !value.includes(typed)
  const options = [...matches.map((t) => ({ tag: t, isNew: false })), ...(isNew ? [{ tag: typed, isNew: true }] : [])]

  const add = (tag: string) => {
    const t = clean(tag)
    if (t && !value.includes(t)) onChange([...value, t])
    setDraft('')
    setActive(0)
  }
  const remove = (tag: string) => onChange(value.filter((t) => t !== tag))

  return (
    <div className={styles.box} onClick={() => input.current?.focus()}>
      {value.map((t) => (
        <span key={t} className={styles.chip}>
          {prefix}
          {t}
          <button
            className={styles.remove}
            onClick={(e) => {
              e.stopPropagation()
              remove(t)
            }}
            aria-label={`Remove ${t}`}
          >
            ×
          </button>
        </span>
      ))}
      <div className={styles.field}>
        <input
          ref={input}
          className={styles.input}
          value={draft}
          placeholder={value.length ? 'add' : placeholder}
          aria-label={label}
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(e) => {
            const v = e.target.value
            // A comma finishes a tag.
            if (v.includes(',')) {
              v.split(',').slice(0, -1).forEach(add)
              setDraft(v.split(',').at(-1) ?? '')
            } else setDraft(v)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Leaving with something typed keeps it.
            if (typed) add(typed)
            setOpen(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const pick = options[active]
              if (pick) add(pick.tag)
              else if (typed) add(typed)
            } else if (e.key === 'Backspace' && !draft && value.length) {
              remove(value[value.length - 1])
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(options.length - 1, a + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
            e.stopPropagation()
          }}
        />
        {open && options.length > 0 && (
          <ul id={listId} className={styles.list} role="listbox" aria-label={label}>
            {options.map((o, i) => (
              <li key={o.tag} role="option" aria-selected={i === active}>
                <button
                  className={styles.option}
                  data-active={i === active}
                  tabIndex={-1}
                  // Before the input's blur, so the click lands.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    add(o.tag)
                  }}
                >
                  {o.isNew ? (
                    <>
                      <span className={styles.create}>create</span> {prefix}
                      {o.tag}
                    </>
                  ) : (
                    `${prefix}${o.tag}`
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
