// The `>` line (D-222, D-326): the prompt every typed request starts from (a menu's, the finder's, a comment, the
// agent's, a deck's add-task). A sign (`>` magenta, the Spinner while `running`), then a Field with no line of its own
// (the prompt's border is the row's). Enter submits; in a `multiline` one Shift+Enter is a new line (as the agent and
// threads take it). Escape calls `onEscape`. `framed` draws the row's bottom rule (a menu's head); without it, it sits
// in what holds it.
import { forwardRef, type ReactNode } from 'react'
import { Field } from './Field'
import { Spinner } from './Spinner'
import styles from './PromptField.module.css'

type Props = {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onEscape?: () => void
  label: string
  placeholder?: string
  // What stands before it: `>` by default; a running job shows the Spinner instead.
  sign?: ReactNode
  running?: boolean
  multiline?: boolean
  framed?: boolean
  autoFocus?: boolean
  disabled?: boolean
  maxLength?: number
  className?: string
  // Leaving it (a deck's add-task keeps what was typed, then closes).
  onBlur?: () => void
}

export const PromptField = forwardRef<HTMLInputElement | HTMLTextAreaElement | null, Props>(function PromptField(
  { value, onChange, onSubmit, onEscape, label, placeholder, sign = '>', running, multiline, framed, autoFocus, disabled, maxLength, className, onBlur },
  ref,
) {
  const shared = { value, onChange, label, placeholder, onEscape, autoFocus, disabled, maxLength, onBlur, className: styles.input }
  return (
    <label className={[styles.prompt, className].filter(Boolean).join(' ')} data-framed={framed || undefined} data-running={running || undefined}>
      <span className={styles.sign} aria-hidden>
        {running ? <Spinner /> : sign}
      </span>
      {multiline ? (
        <Field
          {...shared}
          ref={ref}
          multiline
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) (e.preventDefault(), onSubmit(value))
          }}
        />
      ) : (
        <Field {...shared} ref={ref} onEnter={onSubmit} />
      )}
    </label>
  )
})
